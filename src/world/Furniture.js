// ============================================================
// Starlight Engine — Furniture
// ============================================================

import { FURNITURE_CATALOG } from './Data.js';
import { TILE_H, isoToScreen } from '../engine/Core.js';

export class Furniture {
  constructor(type, x, y, z = 0, rotation = 0) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.z = z;
    this.rotation = rotation;
    const cat = FURNITURE_CATALOG.find(f => f.id === type);
    this.footprint = cat ? [...cat.footprint] : [1, 1];
    this.stackable = cat ? cat.stackable : false;
  }

  occupies(tx, ty) {
    for (let dx = 0; dx < this.footprint[0]; dx++) {
      for (let dy = 0; dy < this.footprint[1]; dy++) {
        if (this.x + dx === tx && this.y + dy === ty) return true;
      }
    }
    return false;
  }

  get screenPos() {
    const sp = isoToScreen(this.x, this.y);
    return { x: sp.x, y: sp.y - this.z * TILE_H / 2 };
  }
}
