// ============================================================
// Starlight Engine — Avatar
// ============================================================

import { aStar, TILE_W, TILE_H, AVATAR_H, isoToScreen, dist, randInt, randChoice } from '../engine/Core.js';
import { FURNITURE_CATALOG } from './Data.js';

export class Avatar {
  constructor(name, x, y, opts = {}) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.path = [];
    this.pathIndex = 0;
    this.speed = opts.speed || 0.10;
    this.skinColor = opts.skinColor || '#F5CBA7';
    this.hairColor = opts.hairColor || '#5D4037';
    this.hairStyle = opts.hairStyle || 'short';
    this.shirtColor = opts.shirtColor || '#3498DB';
    this.pantsColor = opts.pantsColor || '#2C3E50';
    this.shoeColor = opts.shoeColor || '#555555';
    this.hatType = opts.hatType || 'none';
    this.glassesType = opts.glassesType || 'none';
    this.facing = opts.facing || 'se';
    this.animFrame = 0;
    this.animTimer = 0;
    this.isWalking = false;
    this.isDancing = opts.isDancing || false;
    this.isWaving = opts.isWaving || false;
    this.isSitting = opts.isSitting || false;
    this.z = 0;
    this.chatBubble = null;
    this.chatTimer = 0;
    this.chatColor = opts.chatColor || '#fffde7';
    this.chatType = 'normal';
    this.id = opts.id || Math.random().toString(36).slice(2, 10);
    this.isNPC = opts.isNPC || false;
    this.npcTimer = 0;
    this.waveTimer = 0;
    this.lastChatTime = 0;
    this.game = opts.game || null;
  }

  get assetKey() {
    return [this.skinColor, this.hairColor, this.hairStyle, this.shirtColor, this.pantsColor, this.shoeColor, this.hatType, this.glassesType].join('|');
  }

  update(dt, room) {
    this.animTimer += dt;
    if (this.animTimer > 0.12) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 4;
    }
    if (this.chatTimer > 0) {
      this.chatTimer -= dt;
      if (this.chatTimer <= 0) this.chatBubble = null;
    }
    if (this.isWaving) {
      this.waveTimer += dt;
      if (this.waveTimer > 1.5) {
        this.isWaving = false;
        this.waveTimer = 0;
      }
    }

    if (this.path.length > 0 && this.pathIndex < this.path.length) {
      this.isWalking = true;
      this.isSitting = false;
      const target = this.path[this.pathIndex];
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const step = this.speed;
      const oldX = this.x;
      const oldY = this.y;
      if (Math.abs(dx) < step && Math.abs(dy) < step) {
        this.x = target.x;
        this.y = target.y;
        this.pathIndex++;
        if (this.pathIndex >= this.path.length) {
          this.isWalking = false;
          this.path = [];
          this.pathIndex = 0;
        }
      } else {
        this.x += Math.sign(dx) * Math.min(Math.abs(dx), step);
        this.y += Math.sign(dy) * Math.min(Math.abs(dy), step);
        if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'se' : 'nw';
        else this.facing = dy > 0 ? 'se' : 'nw';
      }
      if (Math.floor(this.x) !== Math.floor(oldX) || Math.floor(this.y) !== Math.floor(oldY)) {
        if (this.game && this.game.spawnFootstep) {
          this.game.spawnFootstep(this.x, this.y);
        }
      }
    } else {
      this.isWalking = false;
    }

    // NPC AI
    if (this.isNPC) {
      this.npcTimer -= dt;
      if (this.npcTimer <= 0 && !this.isWalking) {
        this.npcTimer = randInt(2, 6);
        for (let i = 0; i < 10; i++) {
          const tx = randInt(0, room.width - 1);
          const ty = randInt(0, room.height - 1);
          if (room.isWalkable(tx, ty)) {
            this.moveTo(tx, ty, room);
            break;
          }
        }
      }
      if (Math.random() < 0.0008) {
        const phrases = ['Hello there!', 'Nice room!', 'Anyone here?', 'Cool place!', 'lol', 'Hey!', 'This is fun', 'Where is everyone?', 'Love the decor!', 'Nice furniture!'];
        this.say(randChoice(phrases), '#fffde7', 'normal');
      }
    }
  }

  moveTo(tx, ty, room) {
    const start = { x: Math.round(this.x), y: Math.round(this.y) };
    const goal = { x: tx, y: ty };
    const path = aStar(start, goal, (x, y) => {
      if (x < 0 || y < 0 || x >= room.width || y >= room.height) return false;
      if (!room.map[y] || !room.map[y][x]) return false;
      for (const f of room.furniture) {
        if (f.occupies(x, y)) {
          const cat = FURNITURE_CATALOG.find(c => c.id === f.type);
          if (!cat || !cat.stackable) return false;
        }
      }
      return true;
    });
    if (path.length > 1) {
      this.path = path.slice(1);
      this.pathIndex = 0;
    }
  }

  say(text, color, type) {
    this.chatBubble = text;
    this.chatTimer = type === 'shout' ? 6 : (type === 'whisper' ? 3 : 4.5);
    this.chatColor = color || this.chatColor || '#fffde7';
    this.chatType = type || 'normal';
    return true;
  }

  get screenPos() {
    const sp = isoToScreen(this.x, this.y);
    let bob = 0;
    if (this.isWalking) bob = Math.sin(this.animFrame * Math.PI / 2) * 3;
    if (this.isDancing) bob = Math.sin(Date.now() / 120) * 5;
    if (this.isSitting) bob = 0;
    return { x: sp.x, y: sp.y - AVATAR_H / 2 - this.z * TILE_H / 2 + bob };
  }
}
