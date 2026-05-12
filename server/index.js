// ============================================================
// Starlight Inn Server — WebSocket Multiplayer Server
// ============================================================

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const { RoomManager } = require('./RoomManager');
const { PlayerManager } = require('./PlayerManager');

const PORT = process.env.PORT || 3000;

// ── HTTP Server (serves static client files) ──
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Simple status endpoint
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      online: playerManager.getCount(),
      rooms: roomManager.getPublicRooms(),
      uptime: process.uptime()
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// ── WebSocket Server ──
const wss = new WebSocket.Server({ server });
const roomManager = new RoomManager();
const playerManager = new PlayerManager();

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

wss.on('connection', (ws, req) => {
  console.log(`[CONNECT] ${req.socket.remoteAddress} connected. Total: ${wss.clients.size}`);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    handleMessage(ws, msg);
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });

  ws.on('error', (err) => {
    console.error('[WS ERROR]', err.message);
  });

  // Send welcome
  ws.send(JSON.stringify({
    type: 'welcome',
    server: 'Starlight Inn Server',
    version: '1.0',
    playersOnline: playerManager.getCount()
  }));
});

function handleMessage(ws, msg) {
  const player = playerManager.get(ws);

  switch (msg.type) {
    case 'auth': {
      // Client authenticates / identifies
      const id = msg.id || generateId();
      const name = msg.name || 'Guest';
      const newPlayer = playerManager.add(ws, id, name);
      if (msg.outfit) newPlayer.setOutfit(msg.outfit);

      ws.send(JSON.stringify({
        type: 'auth_success',
        id: newPlayer.id,
        name: newPlayer.name,
        playersOnline: playerManager.getCount()
      }));

      console.log(`[AUTH] ${name} (${id}) authenticated`);
      break;
    }

    case 'join_room': {
      if (!player) return;
      const roomId = msg.roomId || 'lobby';
      const roomName = msg.roomName || roomId;

      // Leave current room
      if (player.roomId) {
        const oldRoom = roomManager.get(player.roomId);
        if (oldRoom) {
          oldRoom.leave(ws);
          oldRoom.broadcast({
            type: 'player_left',
            id: player.id,
            name: player.name
          });
        }
      }

      // Join new room
      const room = roomManager.getOrCreate(roomId, roomName);
      if (!room.join(player)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
        return;
      }

      player.roomId = roomId;
      player.x = msg.x || 5;
      player.y = msg.y || 5;

      // Send room state to joining player
      ws.send(JSON.stringify({
        type: 'room_state',
        roomId,
        roomName: room.name,
        players: room.getPlayerList(),
        furniture: room.furniture
      }));

      // Notify others
      room.broadcast({
        type: 'player_joined',
        player: player.toJSON()
      }, ws);

      console.log(`[ROOM] ${player.name} joined ${roomId}`);
      break;
    }

    case 'move': {
      if (!player || !player.roomId) return;
      player.updatePos(msg.x, msg.y, msg.facing);

      const room = roomManager.get(player.roomId);
      if (room) {
        room.broadcast({
          type: 'player_moved',
          id: player.id,
          x: player.x,
          y: player.y,
          facing: player.facing
        }, ws);
      }
      break;
    }

    case 'chat': {
      if (!player || !player.roomId) return;
      const room = roomManager.get(player.roomId);
      if (!room) return;

      const chatMsg = {
        type: 'chat',
        id: player.id,
        name: player.name,
        text: msg.text,
        chatType: msg.chatType || 'normal',
        timestamp: Date.now()
      };

      room.broadcast(chatMsg);

      // Keep last 50 messages
      room.chatHistory.push(chatMsg);
      if (room.chatHistory.length > 50) room.chatHistory.shift();
      break;
    }

    case 'emote': {
      if (!player || !player.roomId) return;
      const room = roomManager.get(player.roomId);
      if (room) {
        room.broadcast({
          type: 'emote',
          id: player.id,
          emote: msg.emote
        }, ws);
      }
      break;
    }

    case 'place_furniture': {
      if (!player || !player.roomId) return;
      if (player.roomId !== 'myroom') {
        ws.send(JSON.stringify({ type: 'error', message: 'Can only place furniture in My Room' }));
        return;
      }
      const room = roomManager.get(player.roomId);
      if (room) {
        room.furniture.push(msg.furniture);
        room.broadcast({
          type: 'furniture_placed',
          furniture: msg.furniture,
          by: player.id
        });
      }
      break;
    }

    case 'remove_furniture': {
      if (!player || !player.roomId) return;
      const room = roomManager.get(player.roomId);
      if (room) {
        room.furniture = room.furniture.filter(f =>
          !(f.x === msg.x && f.y === msg.y && f.type === msg.furnitureType)
        );
        room.broadcast({
          type: 'furniture_removed',
          x: msg.x,
          y: msg.y,
          by: player.id
        });
      }
      break;
    }

    case 'global_chat': {
      if (!player) return;
      roomManager.broadcastGlobal({
        type: 'global_chat',
        id: player.id,
        name: player.name,
        text: msg.text,
        timestamp: Date.now()
      }, ws);
      break;
    }

    case 'whisper': {
      if (!player) return;
      const target = playerManager.getById(msg.targetId);
      if (target && target.ws.readyState === 1) {
        target.ws.send(JSON.stringify({
          type: 'whisper',
          from: player.name,
          fromId: player.id,
          text: msg.text
        }));
        ws.send(JSON.stringify({
          type: 'whisper_sent',
          to: target.name,
          text: msg.text
        }));
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Player not found or offline' }));
      }
      break;
    }

    case 'ping': {
      ws.send(JSON.stringify({ type: 'pong', time: msg.time }));
      if (player) player.lastPing = Date.now();
      break;
    }

    case 'get_rooms': {
      ws.send(JSON.stringify({
        type: 'rooms_list',
        rooms: roomManager.getPublicRooms()
      }));
      break;
    }

    case 'leaderboard_score': {
      if (!player) return;
      const { game, score } = msg;
      if (!game || typeof score !== 'number') return;
      // Store in a global leaderboard map
      if (!global.leaderboard) global.leaderboard = {};
      if (!global.leaderboard[game]) global.leaderboard[game] = [];
      global.leaderboard[game].push({
        name: player.name,
        id: player.id,
        score,
        timestamp: Date.now()
      });
      // Keep top 50 per game
      global.leaderboard[game].sort((a, b) => b.score - a.score);
      if (global.leaderboard[game].length > 50) global.leaderboard[game].length = 50;
      ws.send(JSON.stringify({ type: 'leaderboard_saved', game }));
      break;
    }

    case 'get_leaderboard': {
      const { game } = msg;
      const scores = (global.leaderboard && global.leaderboard[game]) || [];
      ws.send(JSON.stringify({
        type: 'leaderboard_data',
        game,
        scores: scores.slice(0, 20)
      }));
      break;
    }

    case 'trade_request': {
      if (!player || !player.roomId) return;
      const target = playerManager.getById(msg.targetId);
      if (target && target.ws.readyState === 1) {
        target.ws.send(JSON.stringify({
          type: 'trade_request',
          from: player.name,
          fromId: player.id
        }));
      }
      break;
    }

    case 'trade_accept': {
      if (!player) return;
      const target = playerManager.getById(msg.targetId);
      if (target && target.ws.readyState === 1) {
        target.ws.send(JSON.stringify({
          type: 'trade_accept',
          from: player.name,
          fromId: player.id
        }));
      }
      break;
    }

    case 'trade_offer': {
      if (!player) return;
      const target = playerManager.getById(msg.targetId);
      if (target && target.ws.readyState === 1) {
        target.ws.send(JSON.stringify({
          type: 'trade_offer',
          from: player.name,
          fromId: player.id,
          items: msg.items
        }));
      }
      break;
    }

    case 'trade_confirm': {
      if (!player) return;
      const target = playerManager.getById(msg.targetId);
      if (target && target.ws.readyState === 1) {
        target.ws.send(JSON.stringify({
          type: 'trade_confirm',
          from: player.name,
          fromId: player.id
        }));
      }
      break;
    }

    case 'trade_cancel': {
      if (!player) return;
      const target = playerManager.getById(msg.targetId);
      if (target && target.ws.readyState === 1) {
        target.ws.send(JSON.stringify({
          type: 'trade_cancel',
          from: player.name,
          fromId: player.id
        }));
      }
      break;
    }

    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
  }
}

function handleDisconnect(ws) {
  const player = playerManager.remove(ws);
  if (player && player.roomId) {
    const room = roomManager.get(player.roomId);
    if (room) {
      room.leave(ws);
      room.broadcast({
        type: 'player_left',
        id: player.id,
        name: player.name
      });

      // Clean up empty custom rooms
      if (!roomManager.defaultRooms.includes(room.id) && room.players.size === 0) {
        roomManager.remove(room.id);
      }
    }
  }
  console.log(`[DISCONNECT] ${player ? player.name : 'Unknown'} disconnected. Total: ${wss.clients.size}`);
}

// ── Cleanup inactive players every 5 minutes ──
setInterval(() => {
  const inactive = playerManager.cleanupInactive(600000);
  for (const ws of inactive) {
    console.log('[CLEANUP] Removing inactive player');
    handleDisconnect(ws);
    ws.terminate();
  }
}, 300000);

// ── Start Server ──
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║  ✨ Starlight Inn Server v1.0              ║
║  WebSocket: ws://localhost:${PORT}              ║
║  Status: http://localhost:${PORT}/status         ║
╚════════════════════════════════════════════════╝
  `);
});
