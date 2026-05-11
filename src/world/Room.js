// ============================================================
// Starlight Engine — Room
// ============================================================

import { Furniture } from './Furniture.js';
import { FURNITURE_CATALOG } from './Data.js';

export class Room {
  constructor(template) {
    this.id = template.id;
    this.name = template.name;
    this.description = template.description;
    this.width = template.width;
    this.height = template.height;
    this.floorType = template.floor;
    this.wallColor = template.wall;
    this.map = template.map.map(row => [...row]);
    this.furniture = (template.furniture || []).map(f => new Furniture(f.type, f.x, f.y, f.z));
    this.scenery = (template.scenery || []).map(s => ({ type: s.type, x: s.x, y: s.y }));
    this.avatars = [];
    this.particles = [];
  }

  isWalkable(x, y, ignoreAvatar = null) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    if (!this.map[y] || !this.map[y][x]) return false;
    for (const f of this.furniture) {
      if (f.occupies(x, y)) {
        const cat = FURNITURE_CATALOG.find(c => c.id === f.type);
        if (!cat || !cat.stackable) return false;
      }
    }
    for (const a of this.avatars) {
      if (a !== ignoreAvatar && Math.round(a.x) === x && Math.round(a.y) === y) return false;
    }
    return true;
  }

  getStackHeight(x, y) {
    let h = 0;
    for (const f of this.furniture) {
      if (f.occupies(x, y)) h = Math.max(h, f.z + 1);
    }
    return h;
  }

  canPlaceFurniture(type, x, y, rotation = 0) {
    if (this.furniture.length >= 30) return false;
    const cat = FURNITURE_CATALOG.find(c => c.id === type);
    if (!cat) return false;
    const fp = rotation % 2 === 0 ? cat.footprint : [cat.footprint[1], cat.footprint[0]];
    if (x < 0 || y < 0 || x + fp[0] > this.width || y + fp[1] > this.height) return false;
    for (let dx = 0; dx < fp[0]; dx++) {
      for (let dy = 0; dy < fp[1]; dy++) {
        if (!this.map[y + dy] || !this.map[y + dy][x + dx]) return false;
      }
    }
    for (const f of this.furniture) {
      for (let dx = 0; dx < fp[0]; dx++) {
        for (let dy = 0; dy < fp[1]; dy++) {
          if (f.occupies(x + dx, y + dy) && !f.stackable) return false;
        }
      }
    }
    return true;
  }

  placeFurniture(type, x, y, rotation = 0) {
    if (!this.canPlaceFurniture(type, x, y, rotation)) return false;
    const z = this.getStackHeight(x, y);
    this.furniture.push(new Furniture(type, x, y, z, rotation));
    return true;
  }

  removeFurnitureAt(x, y) {
    const idx = this.furniture.findIndex(f => f.occupies(x, y));
    if (idx >= 0) {
      const f = this.furniture[idx];
      this.furniture.splice(idx, 1);
      return f.type;
    }
    return null;
  }
}
