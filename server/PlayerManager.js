// ============================================================
// Starlight Inn Server — Player Manager
// ============================================================

class Player {
  constructor(ws, id, name) {
    this.ws = ws;
    this.id = id;
    this.name = name;
    this.x = 5;
    this.y = 5;
    this.facing = 'se';
    this.roomId = null;
    this.outfit = {};
    this.isAFK = false;
    this.joinedAt = Date.now();
    this.lastPing = Date.now();
  }

  updatePos(x, y, facing) {
    this.x = x;
    this.y = y;
    if (facing) this.facing = facing;
    this.lastPing = Date.now();
  }

  setOutfit(outfit) {
    this.outfit = outfit;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      facing: this.facing,
      outfit: this.outfit,
      isAFK: this.isAFK
    };
  }
}

class PlayerManager {
  constructor() {
    this.players = new Map(); // ws -> Player
    this.idToPlayer = new Map(); // id -> Player
  }

  add(ws, id, name) {
    const player = new Player(ws, id, name);
    this.players.set(ws, player);
    this.idToPlayer.set(id, player);
    return player;
  }

  remove(ws) {
    const player = this.players.get(ws);
    if (player) {
      this.players.delete(ws);
      this.idToPlayer.delete(player.id);
    }
    return player;
  }

  get(ws) {
    return this.players.get(ws);
  }

  getById(id) {
    return this.idToPlayer.get(id);
  }

  getAll() {
    return Array.from(this.players.values());
  }

  getCount() {
    return this.players.size;
  }

  // Clean up inactive players (AFK > 10 minutes)
  cleanupInactive(maxAgeMs = 600000) {
    const now = Date.now();
    const inactive = [];
    for (const [ws, player] of this.players) {
      if (now - player.lastPing > maxAgeMs) {
        inactive.push(ws);
      }
    }
    return inactive;
  }
}

module.exports = { PlayerManager, Player };
