// ============================================================
// Starlight Inn Server — Room Manager
// ============================================================

class Room {
  constructor(id, name, maxPlayers = 50) {
    this.id = id;
    this.name = name;
    this.maxPlayers = maxPlayers;
    this.players = new Map(); // ws -> playerData
    this.furniture = [];
    this.chatHistory = [];
    this.createdAt = Date.now();
  }

  join(player) {
    if (this.players.size >= this.maxPlayers) return false;
    this.players.set(player.ws, player);
    return true;
  }

  leave(ws) {
    this.players.delete(ws);
  }

  broadcast(msg, excludeWs = null) {
    const data = JSON.stringify(msg);
    for (const [ws, player] of this.players) {
      if (ws === excludeWs) continue;
      if (ws.readyState === 1) ws.send(data);
    }
  }

  getPlayerList() {
    const list = [];
    for (const [ws, p] of this.players) {
      list.push({ id: p.id, name: p.name, x: p.x, y: p.y, facing: p.facing, outfit: p.outfit });
    }
    return list;
  }

  getState() {
    return {
      id: this.id,
      name: this.name,
      playerCount: this.players.size,
      furniture: this.furniture,
      maxPlayers: this.maxPlayers
    };
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.defaultRooms = [
      'lobby', 'beach', 'forest', 'game', 'rooftop',
      'club', 'pool', 'restaurant', 'library', 'spa',
      'cinema', 'garden', 'myroom'
    ];
    this.defaultRooms.forEach(id => {
      this.rooms.set(id, new Room(id, id.charAt(0).toUpperCase() + id.slice(1)));
    });
  }

  getOrCreate(id, name) {
    if (!this.rooms.has(id)) {
      this.rooms.set(id, new Room(id, name || id));
    }
    return this.rooms.get(id);
  }

  get(id) {
    return this.rooms.get(id);
  }

  remove(id) {
    this.rooms.delete(id);
  }

  getPublicRooms() {
    const list = [];
    for (const [id, room] of this.rooms) {
      if (id !== 'myroom') {
        list.push({ id, name: room.name, playerCount: room.players.size, maxPlayers: room.maxPlayers });
      }
    }
    return list;
  }

  broadcastGlobal(msg, excludeWs = null) {
    for (const [id, room] of this.rooms) {
      room.broadcast(msg, excludeWs);
    }
  }
}

module.exports = { RoomManager, Room };
