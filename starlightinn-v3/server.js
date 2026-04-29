/**
 * Starlight Inn v3.0 — Socket.IO Multiplayer Server
 * Real-time social virtual world backend with room management,
 * presence tracking, trade system, mini-games, and heartbeat monitoring.
 *
 * @module server
 * @version 3.0.0
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

// =====================================================================
// Static files (serve game root for local dev + deployment)
// =====================================================================
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// =====================================================================
// In-memory stores (upgrade to Redis/PostgreSQL for production scale)
// =====================================================================
const players = new Map();    // socketId -> playerData
const areas = new Map();      // areaId -> Set of socketIds
const messages = new Map();   // areaId -> [messages]
const trades = new Map();     // tradeId -> tradeData
const chests = new Map();     // areaId -> { chestId -> chestData }
const minigameLobbies = new Map(); // lobbyId -> lobbyData
const ipChatTimestamps = new Map();  // ip -> [timestamps]

// =====================================================================
// Configuration & Constants
// =====================================================================
const CONFIG = {
  CHAT_RATE_LIMIT_WINDOW_MS: 5000,
  CHAT_RATE_LIMIT_MAX: 6,
  INACTIVE_TIMEOUT_MS: 120000,
  CLEANUP_INTERVAL_MS: 30000,
  MAX_MESSAGES_PER_AREA: 100,
  TRADE_COUNTDOWN_MS: 3000,
  MINIGAME_MAX_PLAYERS: 4,
  LOOT_TABLE: [
    { id: 'coin', name: 'Star Coin', chance: 0.50, qty: [1, 5] },
    { id: 'gem', name: 'Moon Gem', chance: 0.20, qty: [1, 2] },
    { id: 'seed', name: 'Magic Seed', chance: 0.20, qty: [1, 3] },
    { id: 'feather', name: 'Phoenix Feather', chance: 0.08, qty: [1, 1] },
    { id: 'crown', name: 'Tiny Crown', chance: 0.02, qty: [1, 1] }
  ]
};

// Simple profanity filter word list (MVP — swap for external service in prod)
const PROFANITY_LIST = [
  'badword', 'spam', 'toxic', 'hate', 'kill', 'die'
];

// =====================================================================
// Utility / Auth Helpers
// =====================================================================

/**
 * Generate a random alphanumeric token for simple token-based auth.
 * @returns {string}
 */
function generateToken() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * Roll a random integer in [min, max].
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function rollInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Filter profanity by replacing matched substrings with asterisks.
 * @param {string} text
 * @returns {string}
 */
function filterProfanity(text) {
  if (!text || typeof text !== 'string') return '';
  let safe = text;
  for (const word of PROFANITY_LIST) {
    const regex = new RegExp(word, 'gi');
    safe = safe.replace(regex, '*'.repeat(word.length));
  }
  return safe;
}

/**
 * Check whether an IP is within the chat rate limit window.
 * @param {string} ip
 * @returns {boolean}
 */
function isRateLimited(ip) {
  const now = Date.now();
  if (!ipChatTimestamps.has(ip)) ipChatTimestamps.set(ip, []);
  const stamps = ipChatTimestamps.get(ip);
  // Remove stale timestamps
  const windowStart = now - CONFIG.CHAT_RATE_LIMIT_WINDOW_MS;
  while (stamps.length && stamps[0] < windowStart) stamps.shift();
  return stamps.length >= CONFIG.CHAT_RATE_LIMIT_MAX;
}

/**
 * Record a chat timestamp for rate-limit tracking.
 * @param {string} ip
 */
function recordChat(ip) {
  if (!ipChatTimestamps.has(ip)) ipChatTimestamps.set(ip, []);
  ipChatTimestamps.get(ip).push(Date.now());
}

/**
 * Pick loot from the weighted loot table.
 * @returns {{id:string, name:string, qty:number}[]}
 */
function rollLoot() {
  const rewards = [];
  for (const item of CONFIG.LOOT_TABLE) {
    if (Math.random() < item.chance) {
      rewards.push({
        id: item.id,
        name: item.name,
        qty: rollInt(item.qty[0], item.qty[1])
      });
    }
  }
  return rewards;
}

// =====================================================================
// Player / Area Helpers
// =====================================================================

/**
 * Remove sensitive fields before broadcasting a player to other clients.
 * @param {Object} player
 * @returns {Object}
 */
function sanitizePlayer(player) {
  return {
    id: player.id,
    name: player.name,
    x: player.x,
    y: player.y,
    charId: player.charId,
    expression: player.expression,
    facing: player.facing,
    moving: player.moving,
    status: player.status,
    skinColor: player.skinColor,
    hairColor: player.hairColor,
    outfitColor: player.outfitColor,
    accessories: player.accessories
  };
}

/**
 * Find a connected player by display name (case-insensitive).
 * @param {string} name
 * @returns {Object|undefined}
 */
function findPlayerByName(name) {
  const needle = name.toLowerCase().trim();
  return Array.from(players.values()).find(
    p => p.name.toLowerCase().trim() === needle
  );
}

/**
 * Broadcast an event to every socket in a given area room.
 * @param {string} areaId
 * @param {string} event
 * @param {*} data
 */
function broadcastToArea(areaId, event, data) {
  io.to(areaId).emit(event, data);
}

/**
 * Add a chat message to an area's history, trimming if over max size.
 * @param {string} areaId
 * @param {Object} message
 */
function addMessage(areaId, message) {
  if (!messages.has(areaId)) messages.set(areaId, []);
  const list = messages.get(areaId);
  list.push(message);
  if (list.length > CONFIG.MAX_MESSAGES_PER_AREA) list.shift();
}

/**
 * Retrieve recent chat messages for an area.
 * @param {string} areaId
 * @returns {Object[]}
 */
function getMessages(areaId) {
  return messages.get(areaId) || [];
}

/**
 * Move a player into an area room and sync state.
 * @param {import('socket.io').Socket} socket
 * @param {string} areaId
 */
function joinArea(socket, areaId) {
  const player = players.get(socket.id);
  if (!player) return;
  leaveArea(socket);
  player.area = areaId;
  socket.join(areaId);
  if (!areas.has(areaId)) areas.set(areaId, new Set());
  areas.get(areaId).add(socket.id);

  // Send current area state to the joining player
  const areaPlayers = Array.from(areas.get(areaId) || [])
    .map(id => players.get(id))
    .filter(p => p && p.id !== socket.id)
    .map(sanitizePlayer);

  socket.emit('area_state', {
    area: areaId,
    players: areaPlayers,
    messages: getMessages(areaId),
    chests: getChests(areaId)
  });
}

/**
 * Remove a player from their current area room.
 * @param {import('socket.io').Socket|{id:string,leave:Function}} socket
 */
function leaveArea(socket) {
  const player = players.get(socket.id);
  if (!player) return;
  socket.leave(player.area);
  if (areas.has(player.area)) areas.get(player.area).delete(socket.id);
  broadcastToArea(player.area, 'player_left', { id: socket.id });
}

/**
 * Retrieve or create chest state for an area.
 * @param {string} areaId
 * @returns {Object}
 */
function getChests(areaId) {
  if (!chests.has(areaId)) {
    const map = {};
    // Seed with 2–3 chests per area for demo purposes
    const count = rollInt(2, 3);
    for (let i = 0; i < count; i++) {
      const cid = `chest_${areaId}_${i}`;
      map[cid] = {
        id: cid,
        x: parseFloat((Math.random() * 0.8 + 0.1).toFixed(3)),
        y: parseFloat((Math.random() * 0.8 + 0.1).toFixed(3)),
        claimedBy: null,
        claimedAt: null,
        loot: rollLoot()
      };
    }
    chests.set(areaId, map);
  }
  return chests.get(areaId);
}

// =====================================================================
// Trade System Helpers
// =====================================================================

/**
 * Create a new trade session.
 * @param {string} initiatorId
 * @param {string} targetId
 * @returns {Object}
 */
function createTrade(initiatorId, targetId) {
  return {
    id: `trade_${Date.now()}_${rollInt(1000, 9999)}`,
    initiatorId,
    targetId,
    initiatorOffer: [],
    targetOffer: [],
    initiatorLocked: false,
    targetLocked: false,
    initiatorConfirmed: false,
    targetConfirmed: false,
    state: 'open',
    createdAt: Date.now()
  };
}

/**
 * Check whether both sides of a trade are locked.
 * @param {Object} trade
 * @returns {boolean}
 */
function bothLocked(trade) {
  return trade.initiatorLocked && trade.targetLocked;
}

/**
 * Check whether both sides have confirmed the trade.
 * @param {Object} trade
 * @returns {boolean}
 */
function bothConfirmed(trade) {
  return trade.initiatorConfirmed && trade.targetConfirmed;
}

/**
 * Execute the final item transfer and notify both parties.
 * @param {Object} trade
 */
function executeTrade(trade) {
  trade.state = 'completed';
  io.to(trade.initiatorId).emit('trade_complete', {
    success: true,
    received: trade.targetOffer,
    given: trade.initiatorOffer
  });
  io.to(trade.targetId).emit('trade_complete', {
    success: true,
    received: trade.initiatorOffer,
    given: trade.targetOffer
  });
  trades.delete(trade.id);
}

/**
 * Start a short countdown after both sides lock, before confirmation.
 * @param {Object} trade
 */
function startTradeCountdown(trade) {
  trade.state = 'countdown';
  io.to(trade.initiatorId).emit('trade_countdown', { tradeId: trade.id, ms: CONFIG.TRADE_COUNTDOWN_MS });
  io.to(trade.targetId).emit('trade_countdown', { tradeId: trade.id, ms: CONFIG.TRADE_COUNTDOWN_MS });

  setTimeout(() => {
    const t = trades.get(trade.id);
    if (!t) return;
    if (t.state === 'countdown') {
      t.state = 'confirm';
      io.to(t.initiatorId).emit('trade_confirm_ready', { tradeId: t.id });
      io.to(t.targetId).emit('trade_confirm_ready', { tradeId: t.id });
    }
  }, CONFIG.TRADE_COUNTDOWN_MS);
}

// =====================================================================
// Mini-game Helpers
// =====================================================================

/**
 * Get or create a mini-game lobby.
 * @param {string} gameType
 * @returns {Object}
 */
function getLobby(gameType) {
  if (!minigameLobbies.has(gameType)) {
    minigameLobbies.set(gameType, {
      type: gameType,
      players: [],
      scores: {},
      state: 'waiting',
      startedAt: null,
      endedAt: null
    });
  }
  return minigameLobbies.get(gameType);
}

/**
 * Broadcast the current lobby state to every participant.
 * @param {Object} lobby
 */
function broadcastLobby(lobby) {
  for (const sid of lobby.players) {
    io.to(sid).emit('minigame_lobby', {
      type: lobby.type,
      players: lobby.players.map(id => {
        const p = players.get(id);
        return p ? { id: p.id, name: p.name } : { id, name: 'Unknown' };
      }),
      scores: lobby.scores,
      state: lobby.state
    });
  }
}

// =====================================================================
// Socket.IO Connection Handler
// =====================================================================

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id} | IP: ${socket.handshake.address}`);

  // -----------------------------------------------------------------
  // AUTHENTICATION
  // -----------------------------------------------------------------
  socket.on('auth', (data) => {
    if (players.has(socket.id)) {
      socket.emit('auth_error', { reason: 'Already authenticated' });
      return;
    }

    const player = {
      id: socket.id,
      name: (data.name || 'Guest').toString().substring(0, 24),
      token: generateToken(),
      charId: (data.charId || 'human').toString(),
      skinColor: typeof data.skinColor === 'number' ? data.skinColor : 0,
      hairColor: typeof data.hairColor === 'number' ? data.hairColor : 0,
      outfitColor: typeof data.outfitColor === 'number' ? data.outfitColor : 0,
      accessories: Array.isArray(data.accessories) ? data.accessories : [],
      expression: (data.expression || 'happy').toString(),
      x: 0.5,
      y: 0.5,
      facing: 'down',
      moving: false,
      area: 'hub',
      status: 'online',
      lastPing: Date.now(),
      inventory: data.inventory || [],
      stats: data.stats || { coins: 0, gems: 0 }
    };

    players.set(socket.id, player);
    socket.emit('auth_success', { token: player.token, player: sanitizePlayer(player) });

    // Default spawn area
    joinArea(socket, 'hub');
    broadcastToArea('hub', 'player_joined', sanitizePlayer(player));
  });

  // -----------------------------------------------------------------
  // AREA MANAGEMENT
  // -----------------------------------------------------------------
  socket.on('join_area', (areaId) => {
    const player = players.get(socket.id);
    if (!player) return;
    const target = (areaId || 'hub').toString();
    joinArea(socket, target);
    broadcastToArea(target, 'player_joined', sanitizePlayer(player));
  });

  socket.on('leave_area', () => leaveArea(socket));

  // -----------------------------------------------------------------
  // PLAYER MOVEMENT
  // -----------------------------------------------------------------
  socket.on('move', (pos) => {
    const player = players.get(socket.id);
    if (!player) return;
    if (pos && typeof pos.x === 'number') player.x = pos.x;
    if (pos && typeof pos.y === 'number') player.y = pos.y;
    if (pos && pos.facing) player.facing = pos.facing;
    if (pos && typeof pos.moving === 'boolean') player.moving = pos.moving;

    broadcastToArea(player.area, 'player_moved', {
      id: socket.id,
      x: player.x,
      y: player.y,
      facing: player.facing,
      moving: player.moving
    });
  });

  // -----------------------------------------------------------------
  // CHAT
  // -----------------------------------------------------------------
  socket.on('chat', (data) => {
    const player = players.get(socket.id);
    if (!player) return;

    const ip = socket.handshake.address || 'unknown';
    if (isRateLimited(ip)) {
      socket.emit('chat_error', { reason: 'Rate limited. Please slow down.' });
      return;
    }

    const rawText = (data && data.text ? String(data.text) : '').trim();
    if (!rawText) return;

    const safeText = filterProfanity(rawText.substring(0, 240));
    recordChat(ip);

    const message = {
      name: player.name,
      text: safeText,
      time: Date.now(),
      id: socket.id
    };
    addMessage(player.area, message);
    broadcastToArea(player.area, 'chat_message', message);
  });

  // -----------------------------------------------------------------
  // WHISPER (direct message)
  // -----------------------------------------------------------------
  socket.on('whisper', (data) => {
    const from = players.get(socket.id);
    if (!from || !data) return;
    const to = findPlayerByName(data.to);
    if (!to) {
      socket.emit('whisper_error', { reason: 'Player not found' });
      return;
    }
    const safeText = filterProfanity(String(data.text || '').substring(0, 240));
    const message = { from: from.name, to: to.name, text: safeText, time: Date.now() };
    io.to(to.id).emit('whisper', message);
    socket.emit('whisper_sent', message);
  });

  // -----------------------------------------------------------------
  // GESTURES / EMOTES
  // -----------------------------------------------------------------
  socket.on('gesture', (data) => {
    const player = players.get(socket.id);
    if (!player || !data) return;
    broadcastToArea(player.area, 'player_gesture', {
      id: socket.id,
      gesture: String(data.gesture || 'wave')
    });
  });

  // -----------------------------------------------------------------
  // TRADE SYSTEM
  // -----------------------------------------------------------------
  socket.on('trade_initiate', (data) => {
    const initiator = players.get(socket.id);
    if (!initiator || !data || !data.target) return;
    const target = findPlayerByName(data.target);
    if (!target) {
      socket.emit('trade_error', { reason: 'Target player not found' });
      return;
    }
    if (target.area !== initiator.area) {
      socket.emit('trade_error', { reason: 'Player is not in your area' });
      return;
    }
    io.to(target.id).emit('trade_request', {
      from: initiator.name,
      fromId: socket.id
    });
    socket.emit('trade_request_sent', { to: target.name });
  });

  socket.on('trade_accept', (data) => {
    if (!data || !data.fromId) return;
    const trade = createTrade(data.fromId, socket.id);
    trades.set(trade.id, trade);
    io.to(socket.id).emit('trade_started', trade);
    io.to(data.fromId).emit('trade_started', trade);
  });

  socket.on('trade_decline', (data) => {
    if (!data || !data.fromId) return;
    io.to(data.fromId).emit('trade_declined', { by: socket.id });
  });

  socket.on('trade_update', (data) => {
    if (!data || !data.tradeId) return;
    const trade = trades.get(data.tradeId);
    if (!trade) return;
    if (data.side === 'initiator' && socket.id === trade.initiatorId) {
      trade.initiatorOffer = Array.isArray(data.offer) ? data.offer : [];
      trade.initiatorLocked = false;
      trade.initiatorConfirmed = false;
    } else if (data.side === 'target' && socket.id === trade.targetId) {
      trade.targetOffer = Array.isArray(data.offer) ? data.offer : [];
      trade.targetLocked = false;
      trade.targetConfirmed = false;
    }
    io.to(trade.initiatorId).emit('trade_updated', trade);
    io.to(trade.targetId).emit('trade_updated', trade);
  });

  socket.on('trade_lock', (data) => {
    if (!data || !data.tradeId) return;
    const trade = trades.get(data.tradeId);
    if (!trade) return;
    if (socket.id === trade.initiatorId) trade.initiatorLocked = true;
    if (socket.id === trade.targetId) trade.targetLocked = true;
    io.to(trade.initiatorId).emit('trade_updated', trade);
    io.to(trade.targetId).emit('trade_updated', trade);
    if (bothLocked(trade)) startTradeCountdown(trade);
  });

  socket.on('trade_unlock', (data) => {
    if (!data || !data.tradeId) return;
    const trade = trades.get(data.tradeId);
    if (!trade) return;
    if (socket.id === trade.initiatorId) {
      trade.initiatorLocked = false;
      trade.initiatorConfirmed = false;
    }
    if (socket.id === trade.targetId) {
      trade.targetLocked = false;
      trade.targetConfirmed = false;
    }
    trade.state = 'open';
    io.to(trade.initiatorId).emit('trade_updated', trade);
    io.to(trade.targetId).emit('trade_updated', trade);
  });

  socket.on('trade_confirm', (data) => {
    if (!data || !data.tradeId) return;
    const trade = trades.get(data.tradeId);
    if (!trade || trade.state !== 'confirm') return;
    if (socket.id === trade.initiatorId) trade.initiatorConfirmed = true;
    if (socket.id === trade.targetId) trade.targetConfirmed = true;
    io.to(trade.initiatorId).emit('trade_updated', trade);
    io.to(trade.targetId).emit('trade_updated', trade);
    if (bothConfirmed(trade)) executeTrade(trade);
  });

  socket.on('trade_cancel', (data) => {
    if (!data || !data.tradeId) return;
    const trade = trades.get(data.tradeId);
    if (!trade) return;
    trade.state = 'cancelled';
    io.to(trade.initiatorId).emit('trade_cancelled', { tradeId: trade.id });
    io.to(trade.targetId).emit('trade_cancelled', { tradeId: trade.id });
    trades.delete(trade.id);
  });

  // -----------------------------------------------------------------
  // POWER-UPS
  // -----------------------------------------------------------------
  socket.on('powerup', (data) => {
    const player = players.get(socket.id);
    if (!player) return;
    broadcastToArea(player.area, 'powerup_used', {
      id: socket.id,
      powerup: (data && data.powerup) || 'sparkle',
      target: (data && data.target) || null,
      x: player.x,
      y: player.y
    });
  });

  // -----------------------------------------------------------------
  // CHEST CLAIM
  // -----------------------------------------------------------------
  socket.on('claim_chest', (data) => {
    const player = players.get(socket.id);
    if (!player || !data || !data.chestId) return;
    const areaChests = getChests(player.area);
    const chest = areaChests[data.chestId];
    if (!chest) {
      socket.emit('chest_error', { reason: 'Chest does not exist' });
      return;
    }
    if (chest.claimedBy) {
      socket.emit('chest_error', { reason: 'Chest already claimed' });
      return;
    }
    chest.claimedBy = socket.id;
    chest.claimedAt = Date.now();

    // Award loot to player inventory
    for (const loot of chest.loot) {
      const existing = player.inventory.find(i => i.id === loot.id);
      if (existing) {
        existing.qty = (existing.qty || 0) + loot.qty;
      } else {
        player.inventory.push({ ...loot });
      }
    }

    broadcastToArea(player.area, 'chest_claimed', {
      chestId: chest.id,
      claimedBy: socket.id,
      loot: chest.loot
    });

    socket.emit('chest_reward', {
      chestId: chest.id,
      loot: chest.loot,
      inventory: player.inventory
    });

    // Respawn a new chest after a delay to keep areas lively
    setTimeout(() => {
      delete areaChests[data.chestId];
      const newChest = {
        id: data.chestId,
        x: parseFloat((Math.random() * 0.8 + 0.1).toFixed(3)),
        y: parseFloat((Math.random() * 0.8 + 0.1).toFixed(3)),
        claimedBy: null,
        claimedAt: null,
        loot: rollLoot()
      };
      areaChests[data.chestId] = newChest;
      broadcastToArea(player.area, 'chest_spawned', newChest);
    }, 60000);
  });

  // -----------------------------------------------------------------
  // MINI-GAME LOBBY
  // -----------------------------------------------------------------
  socket.on('minigame_join', (data) => {
    const player = players.get(socket.id);
    if (!player || !data || !data.gameType) return;
    const lobby = getLobby(data.gameType);
    if (lobby.players.length >= CONFIG.MINIGAME_MAX_PLAYERS) {
      socket.emit('minigame_error', { reason: 'Lobby is full' });
      return;
    }
    if (!lobby.players.includes(socket.id)) lobby.players.push(socket.id);
    lobby.scores[socket.id] = 0;
    broadcastLobby(lobby);
  });

  socket.on('minigame_leave', (data) => {
    if (!data || !data.gameType) return;
    const lobby = minigameLobbies.get(data.gameType);
    if (!lobby) return;
    lobby.players = lobby.players.filter(id => id !== socket.id);
    delete lobby.scores[socket.id];
    if (lobby.players.length === 0) minigameLobbies.delete(data.gameType);
    else broadcastLobby(lobby);
  });

  socket.on('minigame_score', (data) => {
    if (!data || typeof data.gameType !== 'string' || typeof data.score !== 'number') return;
    const lobby = minigameLobbies.get(data.gameType);
    if (!lobby || !lobby.players.includes(socket.id)) return;
    lobby.scores[socket.id] = data.score;
    broadcastLobby(lobby);
  });

  socket.on('minigame_start', (data) => {
    if (!data || !data.gameType) return;
    const lobby = minigameLobbies.get(data.gameType);
    if (!lobby) return;
    lobby.state = 'playing';
    lobby.startedAt = Date.now();
    broadcastLobby(lobby);
  });

  socket.on('minigame_end', (data) => {
    if (!data || !data.gameType) return;
    const lobby = minigameLobbies.get(data.gameType);
    if (!lobby) return;
    lobby.state = 'ended';
    lobby.endedAt = Date.now();
    broadcastLobby(lobby);
  });

  // -----------------------------------------------------------------
  // PRESENCE / STATUS
  // -----------------------------------------------------------------
  socket.on('status', (data) => {
    const player = players.get(socket.id);
    if (!player || !data) return;
    const allowed = ['online', 'away', 'busy', 'dnd', 'invisible'];
    const next = allowed.includes(data.status) ? data.status : 'online';
    player.status = next;
    broadcastToArea(player.area, 'player_status', {
      id: socket.id,
      status: next
    });
  });

  // -----------------------------------------------------------------
  // HEARTBEAT / PING-PONG
  // -----------------------------------------------------------------
  socket.on('ping', () => {
    const player = players.get(socket.id);
    if (player) player.lastPing = Date.now();
    socket.emit('pong', { serverTime: Date.now() });
  });

  // -----------------------------------------------------------------
  // DISCONNECT
  // -----------------------------------------------------------------
  socket.on('disconnect', (reason) => {
    const player = players.get(socket.id);
    if (player) {
      leaveArea(socket);
      players.delete(socket.id);
      // Remove from any trade
      for (const [tid, trade] of trades) {
        if (trade.initiatorId === socket.id || trade.targetId === socket.id) {
          const other = trade.initiatorId === socket.id ? trade.targetId : trade.initiatorId;
          io.to(other).emit('trade_cancelled', { tradeId: tid, reason: 'Partner disconnected' });
          trades.delete(tid);
        }
      }
      // Remove from any mini-game lobby
      for (const [type, lobby] of minigameLobbies) {
        if (lobby.players.includes(socket.id)) {
          lobby.players = lobby.players.filter(id => id !== socket.id);
          delete lobby.scores[socket.id];
          if (lobby.players.length === 0) minigameLobbies.delete(type);
          else broadcastLobby(lobby);
        }
      }
      console.log(`Player disconnected: ${socket.id} (${reason})`);
    } else {
      console.log(`Anonymous socket disconnected: ${socket.id} (${reason})`);
    }
  });
});

// =====================================================================
// HTTP Endpoints (diagnostics & health)
// =====================================================================

/**
 * Health check endpoint for load balancers / uptime monitoring.
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    players: players.size,
    areas: areas.size,
    trades: trades.size,
    lobbies: minigameLobbies.size
  });
});

/**
 * List currently connected players (admin/debug).
 */
app.get('/players', (_req, res) => {
  const list = Array.from(players.values()).map(sanitizePlayer);
  res.json({ count: list.length, players: list });
});

// =====================================================================
// Cleanup: evict inactive players on a scheduled interval
// =====================================================================
setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const [id, player] of players) {
    if (now - player.lastPing > CONFIG.INACTIVE_TIMEOUT_MS) {
      console.log(`Removing inactive player: ${id} (last ping ${now - player.lastPing}ms ago)`);
      const fakeSocket = {
        id,
        leave: () => {},
        emit: () => {}
      };
      leaveArea(fakeSocket);
      players.delete(id);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`Cleanup pass complete: removed ${removed} inactive player(s)`);
  }
}, CONFIG.CLEANUP_INTERVAL_MS);

// =====================================================================
// Server Bootstrap
// =====================================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌟 Starlight Inn server running on port ${PORT}`);
  console.log(`   WebSocket transports: websocket, polling`);
  console.log(`   Health endpoint: http://localhost:${PORT}/health`);
});
