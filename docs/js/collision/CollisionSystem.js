/**
 * CollisionSystem.js — v8.0 Proper Collisions
 * AABB + circle collision with spatial partitioning.
 */
export class CollisionSystemV8 {
  constructor(cellSize = 64) {
    this.cellSize = cellSize;
    this.grid = new Map();
    this.objects = new Map();
    this.staticBodies = [];
  }

  clear() {
    this.grid.clear();
    this.objects.clear();
  }

  addStatic(x, y, w, h, type = 'wall', meta = {}) {
    this.staticBodies.push({ x, y, w, h, type, meta });
    this._insert({ id: '_static_' + this.staticBodies.length, x, y, w, h, type, meta, static: true });
  }

  add(id, x, y, w, h, type = 'player', meta = {}) {
    const obj = { id, x, y, w, h, type, meta, vx: 0, vy: 0 };
    this.objects.set(id, obj);
    this._insert(obj);
    return obj;
  }

  update(id, x, y) {
    const obj = this.objects.get(id);
    if (!obj) return;
    this._remove(obj);
    obj.x = x; obj.y = y;
    this._insert(obj);
  }

  remove(id) {
    const obj = this.objects.get(id);
    if (obj) {
      this._remove(obj);
      this.objects.delete(id);
    }
  }

  _key(cx, cy) { return `${cx},${cy}`; }

  _insert(obj) {
    const cMin = Math.floor(obj.x / this.cellSize);
    const cMax = Math.floor((obj.x + obj.w) / this.cellSize);
    const rMin = Math.floor(obj.y / this.cellSize);
    const rMax = Math.floor((obj.y + obj.h) / this.cellSize);
    for (let cx = cMin; cx <= cMax; cx++) {
      for (let cy = rMin; cy <= rMax; cy++) {
        const k = this._key(cx, cy);
        if (!this.grid.has(k)) this.grid.set(k, new Set());
        this.grid.get(k).add(obj);
      }
    }
    obj._cells = { cMin, cMax, rMin, rMax };
  }

  _remove(obj) {
    if (!obj._cells) return;
    const { cMin, cMax, rMin, rMax } = obj._cells;
    for (let cx = cMin; cx <= cMax; cx++) {
      for (let cy = rMin; cy <= rMax; cy++) {
        const k = this._key(cx, cy);
        this.grid.get(k)?.delete(obj);
      }
    }
  }

  check(id) {
    const obj = this.objects.get(id);
    if (!obj) return [];
    const checked = new Set();
    const hits = [];
    const { cMin, cMax, rMin, rMax } = obj._cells || { cMin: 0, cMax: 0, rMin: 0, rMax: 0 };
    for (let cx = cMin; cx <= cMax; cx++) {
      for (let cy = rMin; cy <= rMax; cy++) {
        const k = this._key(cx, cy);
        const cell = this.grid.get(k);
        if (!cell) continue;
        for (const other of cell) {
          if (other.id === id || checked.has(other.id)) continue;
          checked.add(other.id);
          if (this._aabb(obj, other)) {
            hits.push(other);
          }
        }
      }
    }
    return hits;
  }

  _aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  resolve(id, dx, dy) {
    const obj = this.objects.get(id);
    if (!obj) return { x: dx, y: dy };
    const newX = obj.x + dx;
    const newY = obj.y + dy;
    let outX = dx, outY = dy;

    // Check against all static bodies
    for (const wall of this.staticBodies) {
      if (newX < wall.x + wall.w && newX + obj.w > wall.x && newY < wall.y + wall.h && newY + obj.h > wall.y) {
        // X collision
        if (obj.x + obj.w <= wall.x && newX + obj.w > wall.x) outX = Math.min(outX, wall.x - (obj.x + obj.w));
        else if (obj.x >= wall.x + wall.w && newX < wall.x + wall.w) outX = Math.max(outX, (wall.x + wall.w) - obj.x);
        // Y collision
        if (obj.y + obj.h <= wall.y && newY + obj.h > wall.y) outY = Math.min(outY, wall.y - (obj.y + obj.h));
        else if (obj.y >= wall.y + wall.h && newY < wall.y + wall.h) outY = Math.max(outY, (wall.y + wall.h) - obj.y);
      }
    }
    return { x: outX, y: outY };
  }

  raycast(x, y, dx, dy, maxDist = 200) {
    const steps = Math.ceil(maxDist / this.cellSize);
    for (let i = 0; i < steps; i++) {
      const rx = x + (dx / steps) * i;
      const ry = y + (dy / steps) * i;
      const cx = Math.floor(rx / this.cellSize);
      const cy = Math.floor(ry / this.cellSize);
      const k = this._key(cx, cy);
      const cell = this.grid.get(k);
      if (cell) {
        for (const obj of cell) {
          if (obj.static && rx >= obj.x && rx <= obj.x + obj.w && ry >= obj.y && ry <= obj.y + obj.h) {
            return { hit: true, x: rx, y: ry, obj };
          }
        }
      }
    }
    return { hit: false };
  }
}
