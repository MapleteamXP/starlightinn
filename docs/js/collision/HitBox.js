/**
 * HitBox.js — v8.0 Hit Box Definitions
 * Reusable hitbox shapes for characters, projectiles, items.
 */
export class HitBox {
  constructor(x, y, w, h, type = 'rect') {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.type = type; // rect, circle, point
    this.r = Math.max(w, h) / 2;
  }

  set(x, y) { this.x = x; this.y = y; return this; }
  setSize(w, h) { this.w = w; this.h = h; this.r = Math.max(w, h) / 2; return this; }

  intersects(other) {
    if (this.type === 'rect' && other.type === 'rect') {
      return this.x < other.x + other.w && this.x + this.w > other.x &&
             this.y < other.y + other.h && this.y + this.h > other.y;
    }
    if (this.type === 'circle' && other.type === 'circle') {
      const dx = this.x - other.x, dy = this.y - other.y;
      return Math.hypot(dx, dy) < this.r + other.r;
    }
    // rect-circle / circle-rect hybrid
    const cx = Math.max(this.x, Math.min(other.x, this.x + this.w));
    const cy = Math.max(this.y, Math.min(other.y, this.y + this.h));
    const dx = other.x - cx;
    const dy = other.y - cy;
    return (dx * dx + dy * dy) < (other.r * other.r);
  }

  contains(px, py) {
    if (this.type === 'rect') return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
    if (this.type === 'circle') return Math.hypot(px - this.x, py - this.y) <= this.r;
    return false;
  }

  center() { return { x: this.x + this.w / 2, y: this.y + this.h / 2 }; }

  clone() { return new HitBox(this.x, this.y, this.w, this.h, this.type); }
}

export const HITBOX_PRESETS = {
  player: { w: 24, h: 32, type: 'rect' },
  npc: { w: 24, h: 32, type: 'rect' },
  item: { w: 16, h: 16, type: 'rect' },
  projectile: { w: 8, h: 8, type: 'circle' },
  portal: { w: 48, h: 48, type: 'rect' },
  trigger: { w: 64, h: 64, type: 'rect' },
  chatZone: { w: 96, h: 96, type: 'circle' },
};
