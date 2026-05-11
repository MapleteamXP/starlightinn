// ============================================================
// Starlight Engine — Core Math & Utilities
// ============================================================

export const TILE_W = 64;
export const TILE_H = 32;
export const WALL_H = 48;
export const AVATAR_H = 52;

export function isoToScreen(ix, iy) {
  return { x: (ix - iy) * (TILE_W / 2), y: (ix + iy) * (TILE_H / 2) };
}

export function screenToIso(sx, sy) {
  return {
    x: (sx / (TILE_W / 2) + sy / (TILE_H / 2)) / 2,
    y: (sy / (TILE_H / 2) - sx / (TILE_W / 2)) / 2
  };
}

export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
export function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
export function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
export function randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================
// A* Pathfinding
// ============================================================
class PriorityQueue {
  constructor() { this.items = []; }
  enqueue(item, priority) { this.items.push({ item, priority }); this.items.sort((a, b) => a.priority - b.priority); }
  dequeue() { return this.items.shift()?.item; }
  isEmpty() { return this.items.length === 0; }
}

export function aStar(start, goal, walkableFn) {
  const open = new PriorityQueue();
  open.enqueue(start, 0);
  const cameFrom = new Map();
  const gScore = new Map();
  const startKey = `${start.x},${start.y}`;
  gScore.set(startKey, 0);
  const fScore = new Map();
  fScore.set(startKey, dist(start, goal));
  const visited = new Set();
  while (!open.isEmpty()) {
    const current = open.dequeue();
    const cKey = `${current.x},${current.y}`;
    if (visited.has(cKey)) continue;
    visited.add(cKey);
    if (current.x === goal.x && current.y === goal.y) {
      const path = [];
      let cur = current;
      while (cameFrom.has(`${cur.x},${cur.y}`)) {
        path.unshift(cur);
        cur = cameFrom.get(`${cur.x},${cur.y}`);
      }
      path.unshift(start);
      return path;
    }
    for (const [dx, dy] of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]]) {
      const nx = current.x + dx, ny = current.y + dy;
      if (!walkableFn(nx, ny)) continue;
      const nKey = `${nx},${ny}`;
      const moveCost = (dx !== 0 && dy !== 0) ? 1.414 : 1;
      const tentative = (gScore.get(cKey) || Infinity) + moveCost;
      if (tentative < (gScore.get(nKey) || Infinity)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentative);
        fScore.set(nKey, tentative + dist({x:nx,y:ny}, goal));
        open.enqueue({x:nx,y:ny}, fScore.get(nKey));
      }
    }
  }
  return [];
}
