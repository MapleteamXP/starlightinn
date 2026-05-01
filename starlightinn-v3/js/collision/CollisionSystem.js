/**
 * @file CollisionSystem.js
 * @description Procedural collision detection and spatial query system for Starlight Inn v8.0.
 * Provides AABB, tilemap, furniture, wall, and raycast collision with resolution
 * and debug visualization. Integrates with the HitBox class for consistent bounds.
 *
 * @module collision/CollisionSystem
 * @version 8.0.0
 */

import HitBox from './HitBox.js';

// ============================================================
// CONSTANTS
// ============================================================

/** @constant {number} TILE_SIZE - World tile size in pixels */
const TILE_SIZE = 32;

/** @constant {number} SPATIAL_CELL_SIZE - Spatial hash cell size */
const SPATIAL_CELL_SIZE = 128;

/** @constant {number} DEFAULT_TILE_COLLISION_PADDING - Inset for tile hitboxes */
const TILE_PADDING = 0;

/** @constant {number} FRICTION_SLIDE - Velocity retention during slide resolution */
const FRICTION_SLIDE = 0.85;

/** @constant {number} MIN_PENETRATION - Minimum penetration to resolve */
const MIN_PENETRATION = 0.01;

// ============================================================
// COLLISION BOX PRESETS
// ============================================================

/**
 * @constant {Object<string, {w: number, h: number}>} ENTITY_COLLISION_SIZES
 * Width and height for known entity archetypes.
 */
export const ENTITY_COLLISION_SIZES = {
  player: { w: 24, h: 24 },
  npc: { w: 24, h: 24 },
  pet: { w: 16, h: 16 },
  mount: { w: 32, h: 32 },
};

/**
 * @constant {Object<string, {w: number, h: number}>} FURNITURE_COLLISION_SIZES
 * Width and height for furniture types.
 */
export const FURNITURE_COLLISION_SIZES = {
  chair: { w: 16, h: 16 },
  sofa: { w: 48, h: 32 },
  table: { w: 32, h: 32 },
  bed: { w: 32, h: 48 },
  desk: { w: 40, h: 24 },
  dresser: { w: 24, h: 16 },
  lamp: { w: 8, h: 8 },
  rug: { w: 32, h: 32 },
  plant: { w: 12, h: 12 },
  bookshelf: { w: 16, h: 16 },
  counter: { w: 48, h: 16 },
  fireplace: { w: 32, h: 16 },
  piano: { w: 48, h: 24 },
  tv_stand: { w: 32, h: 16 },
  clock: { w: 8, h: 8 },
};

/**
 * @constant {Object<string, {w: number, h: number}>} PROP_COLLISION_SIZES
 * Width and height for prop / decorative objects.
 */
export const PROP_COLLISION_SIZES = {
  small: { w: 8, h: 8 },
  medium: { w: 16, h: 16 },
  large: { w: 24, h: 24 },
  xl: { w: 32, h: 32 },
};

// ============================================================
// SPATIAL HASH — broad-phase acceleration
// ============================================================

/**
 * @private
 * @class _SpatialHash
 * @description Uniform grid spatial hash for O(1) broad-phase entity queries.
 */
class _SpatialHash {
  /**
   * @param {number} [cellSize=128]
   */
  constructor(cellSize = SPATIAL_CELL_SIZE) {
    /** @type {number} */
    this.cellSize = cellSize;
    /** @type {Map<string, Set<Object>>} */
    this.cells = new Map();
    /** @type {Map<Object, Set<string>>} */
    this.entityCells = new Map();
    /** @type {number} */
    this.entityCount = 0;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {{cx: number, cy: number}}
   */
  worldToCell(x, y) {
    return {
      cx: Math.floor(x / this.cellSize),
      cy: Math.floor(y / this.cellSize),
    };
  }

  /**
   * @param {number} cx
   * @param {number} cy
   * @returns {string}
   */
  _key(cx, cy) {
    return `${cx},${cy}`;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @returns {Array<string>}
   */
  _getOverlappingKeys(x, y, w, h) {
    const tl = this.worldToCell(x, y);
    const br = this.worldToCell(x + w - 1, y + h - 1);
    const keys = [];
    for (let cy = tl.cy; cy <= br.cy; cy++) {
      for (let cx = tl.cx; cx <= br.cx; cx++) {
        keys.push(this._key(cx, cy));
      }
    }
    return keys;
  }

  /**
   * @param {Object} entity
   */
  insert(entity) {
    this.remove(entity);
    const bounds = getEntityBounds(entity);
    const keys = this._getOverlappingKeys(bounds.x, bounds.y, bounds.w, bounds.h);
    const keySet = new Set();
    for (const key of keys) {
      keySet.add(key);
      let cell = this.cells.get(key);
      if (!cell) {
        cell = new Set();
        this.cells.set(key, cell);
      }
      cell.add(entity);
    }
    this.entityCells.set(entity, keySet);
    this.entityCount++;
  }

  /**
   * @param {Object} entity
   */
  remove(entity) {
    const keys = this.entityCells.get(entity);
    if (!keys) return;
    for (const key of keys) {
      const cell = this.cells.get(key);
      if (cell) {
        cell.delete(entity);
        if (cell.size === 0) this.cells.delete(key);
      }
    }
    this.entityCells.delete(entity);
    this.entityCount--;
  }

  /**
   * @param {Object} entity
   */
  update(entity) {
    this.remove(entity);
    this.insert(entity);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @returns {Array<Object>}
   */
  queryAABB(x, y, w, h) {
    const keys = this._getOverlappingKeys(x, y, w, h);
    const results = [];
    const seen = new Set();
    for (const key of keys) {
      const cell = this.cells.get(key);
      if (!cell) continue;
      for (const entity of cell) {
        if (!seen.has(entity)) {
          seen.add(entity);
          results.push(entity);
        }
      }
    }
    return results;
  }

  /**
   * @param {number} cx
   * @param {number} cy
   * @param {number} radius
   * @returns {Array<Object>}
   */
  queryCircle(cx, cy, radius) {
    return this.queryAABB(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  /** Clears all cells. */
  clear() {
    this.cells.clear();
    this.entityCells.clear();
    this.entityCount = 0;
  }
}

// ============================================================
// COLLISION BOX GENERATION
// ============================================================

/**
 * Computes an axis-aligned bounding box for an entity using its position
 * and collision preset. Supports explicit override via entity.hitBox.
 *
 * @param {Object} entity — Must have {x, y} and optionally {type, hitBox, collisionOffset}
 * @returns {{x: number, y: number, w: number, h: number}}
 */
export function getEntityBounds(entity) {
  if (!entity) return { x: 0, y: 0, w: 0, h: 0 };

  // Explicit HitBox override
  if (entity.hitBox instanceof HitBox) {
    return {
      x: entity.x + entity.hitBox.x,
      y: entity.y + entity.hitBox.y,
      w: entity.hitBox.w,
      h: entity.hitBox.h,
    };
  }

  const type = entity.type || 'player';
  let size = ENTITY_COLLISION_SIZES[type] || ENTITY_COLLISION_SIZES.player;

  // Furniture override
  if (entity.furnitureType && FURNITURE_COLLISION_SIZES[entity.furnitureType]) {
    size = FURNITURE_COLLISION_SIZES[entity.furnitureType];
  }
  // Prop override
  if (entity.propSize && PROP_COLLISION_SIZES[entity.propSize]) {
    size = PROP_COLLISION_SIZES[entity.propSize];
  }
  // Wall override
  if (entity.isWall || type === 'wall') {
    size = { w: TILE_SIZE, h: TILE_SIZE };
  }

  const offsetX = entity.collisionOffset?.x ?? -(size.w / 2);
  const offsetY = entity.collisionOffset?.y ?? -(size.h / 2);

  return {
    x: entity.x + offsetX,
    y: entity.y + offsetY,
    w: size.w,
    h: size.h,
  };
}

/**
 * Creates a HitBox instance for an entity based on its type.
 * @param {Object} entity
 * @param {string} [hitType='solid']
 * @returns {HitBox}
 */
export function makeEntityHitBox(entity, hitType = 'solid') {
  const bounds = getEntityBounds(entity);
  return new HitBox(bounds.x - entity.x, bounds.y - entity.y, bounds.w, bounds.h, hitType);
}

/**
 * Creates a tile HitBox for a given grid coordinate.
 * @param {number} tx — Tile X index
 * @param {number} ty — Tile Y index
 * @param {string} [type='solid']
 * @returns {HitBox}
 */
export function makeTileHitBox(tx, ty, type = 'solid') {
  return new HitBox(
    tx * TILE_SIZE + TILE_PADDING,
    ty * TILE_SIZE + TILE_PADDING,
    TILE_SIZE - TILE_PADDING * 2,
    TILE_SIZE - TILE_PADDING * 2,
    type
  );
}

// ============================================================
// AABB INTERSECTION UTILITIES
// ============================================================

/**
 * AABB intersection test between two boxes.
 * @param {{x:number,y:number,w:number,h:number}} a
 * @param {{x:number,y:number,w:number,h:number}} b
 * @returns {boolean}
 */
export function aabbIntersects(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * Computes the minimum translation vector to separate two overlapping AABBs.
 * @param {{x:number,y:number,w:number,h:number}} a
 * @param {{x:number,y:number,w:number,h:number}} b
 * @returns {{nx: number, ny: number, penetration: number}|null}
 */
export function aabbMTV(a, b) {
  const overlapLeft = (b.x + b.w) - a.x;
  const overlapRight = (a.x + a.w) - b.x;
  const overlapTop = (b.y + b.h) - a.y;
  const overlapBottom = (a.y + a.h) - b.y;

  const left = overlapLeft < overlapRight;
  const top = overlapTop < overlapBottom;

  const minX = left ? -overlapLeft : overlapRight;
  const minY = top ? -overlapTop : overlapBottom;

  if (Math.abs(minX) < Math.abs(minY)) {
    return { nx: left ? -1 : 1, ny: 0, penetration: Math.abs(minX) };
  } else {
    return { nx: 0, ny: top ? -1 : 1, penetration: Math.abs(minY) };
  }
}

/**
 * Point-in-rectangle test.
 * @param {number} px
 * @param {number} py
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @returns {boolean}
 */
export function pointInRect(px, py, rect) {
  return px >= rect.x && px < rect.x + rect.w && py >= rect.y && py < rect.y + rect.h;
}

// ============================================================
// CORE COLLISION API
// ============================================================

/**
 * Checks whether two entities collide using their collision bounds.
 * @param {Object} a
 * @param {Object} b
 * @returns {boolean}
 */
export function checkEntityEntity(a, b) {
  const boxA = getEntityBounds(a);
  const boxB = getEntityBounds(b);
  return aabbIntersects(boxA, boxB);
}

/**
 * Checks whether an entity collides with a tile.
 * @param {Object} entity
 * @param {Object} tile — Must have {tx, ty, blocked?: boolean}
 * @returns {boolean}
 */
export function checkEntityTile(entity, tile) {
  if (!tile || tile.blocked === false) return false;
  const boxA = getEntityBounds(entity);
  const boxB = {
    x: tile.tx * TILE_SIZE,
    y: tile.ty * TILE_SIZE,
    w: TILE_SIZE,
    h: TILE_SIZE,
  };
  return aabbIntersects(boxA, boxB);
}

/**
 * Checks whether an entity collides with a furniture piece.
 * @param {Object} entity
 * @param {Object} furniture — Must have {x, y, furnitureType?: string, hitBox?: HitBox}
 * @returns {boolean}
 */
export function checkEntityFurniture(entity, furniture) {
  const boxA = getEntityBounds(entity);
  const boxB = getEntityBounds(furniture);
  return aabbIntersects(boxA, boxB);
}

/**
 * Checks whether an entity collides with a wall.
 * Walls are full-tile blocking objects.
 * @param {Object} entity
 * @param {Object} wall — Must have {x, y} or {tx, ty}
 * @returns {boolean}
 */
export function checkEntityWall(entity, wall) {
  const boxA = getEntityBounds(entity);
  let boxB;
  if (wall.tx !== undefined && wall.ty !== undefined) {
    boxB = {
      x: wall.tx * TILE_SIZE,
      y: wall.ty * TILE_SIZE,
      w: TILE_SIZE,
      h: TILE_SIZE,
    };
  } else {
    boxB = getEntityBounds(wall);
  }
  return aabbIntersects(boxA, boxB);
}

/**
 * Resolves an overlap between two entities by pushing them apart along
 * the axis of least penetration. Mutates entity positions.
 * @param {Object} a
 * @param {Object} b
 * @returns {{nx: number, ny: number, penetration: number}|null}
 */
export function resolveCollision(a, b) {
  const boxA = getEntityBounds(a);
  const boxB = getEntityBounds(b);

  if (!aabbIntersects(boxA, boxB)) return null;

  const mtv = aabbMTV(boxA, boxB);
  if (!mtv || mtv.penetration < MIN_PENETRATION) return null;

  // Determine which entities are movable
  const aMovable = a.movable !== false && a.isStatic !== true;
  const bMovable = b.movable !== false && b.isStatic !== true;

  if (aMovable && bMovable) {
    const halfPen = mtv.penetration * 0.5;
    a.x += mtv.nx * halfPen;
    a.y += mtv.ny * halfPen;
    b.x -= mtv.nx * halfPen;
    b.y -= mtv.ny * halfPen;

    // Slide damping
    if (a.velocityX !== undefined && a.velocityY !== undefined) {
      a.velocityX *= FRICTION_SLIDE;
      a.velocityY *= FRICTION_SLIDE;
    }
    if (b.velocityX !== undefined && b.velocityY !== undefined) {
      b.velocityX *= FRICTION_SLIDE;
      b.velocityY *= FRICTION_SLIDE;
    }
  } else if (aMovable) {
    a.x += mtv.nx * mtv.penetration;
    a.y += mtv.ny * mtv.penetration;
    if (a.velocityX !== undefined && a.velocityY !== undefined) {
      a.velocityX *= FRICTION_SLIDE;
      a.velocityY *= FRICTION_SLIDE;
    }
  } else if (bMovable) {
    b.x -= mtv.nx * mtv.penetration;
    b.y -= mtv.ny * mtv.penetration;
    if (b.velocityX !== undefined && b.velocityY !== undefined) {
      b.velocityX *= FRICTION_SLIDE;
      b.velocityY *= FRICTION_SLIDE;
    }
  }

  return mtv;
}

/**
 * Point-in-entity test using the entity's collision bounds.
 * @param {number} x
 * @param {number} y
 * @param {Object} entity
 * @returns {boolean}
 */
export function isPointInEntity(x, y, entity) {
  const bounds = getEntityBounds(entity);
  return pointInRect(x, y, bounds);
}

// ============================================================
// RAYCASTING
// ============================================================

/**
 * Performs a raycast from (x1,y1) to (x2,y2), returning the first collision.
 * Uses a DDA-like grid traversal against tile maps, plus optional entity checks.
 *
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {Object} [options]
 * @param {Array<Object>} [options.entities=[]] — Extra entities to test
 * @param {Function} [options.tileBlocked] — (tx, ty) => boolean
 * @param {number} [options.step=1] — Pixel step size
 * @returns {{hit: boolean, x: number, y: number, entity: Object|null, tx: number|null, ty: number|null}|null}
 */
export function raycast(x1, y1, x2, y2, options = {}) {
  const { entities = [], tileBlocked = null, step = 1 } = options;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { hit: false, x: x1, y: y1, entity: null, tx: null, ty: null };

  const nx = dx / dist;
  const ny = dy / dist;

  // Check entity collisions along the ray
  for (const ent of entities) {
    const bounds = getEntityBounds(ent);
    if (!aabbIntersects({ x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(dx) + 1, h: Math.abs(dy) + 1 }, bounds)) {
      continue;
    }
    const hit = _raycastAABB(x1, y1, nx, ny, dist, bounds);
    if (hit) {
      return { hit: true, x: hit.x, y: hit.y, entity: ent, tx: null, ty: null };
    }
  }

  // Tile grid traversal
  if (tileBlocked) {
    let cx = x1;
    let cy = y1;
    const steps = Math.ceil(dist / step);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const tx = Math.floor(px / TILE_SIZE);
      const ty = Math.floor(py / TILE_SIZE);
      if (tileBlocked(tx, ty)) {
        return { hit: true, x: px, y: py, entity: null, tx, ty };
      }
    }
  }

  return { hit: false, x: x2, y: y2, entity: null, tx: null, ty: null };
}

/**
 * Ray-AABB intersection using slab method.
 * @private
 * @param {number} ox — Ray origin X
 * @param {number} oy — Ray origin Y
 * @param {number} rdx — Ray direction X (normalized)
 * @param {number} rdy — Ray direction Y (normalized)
 * @param {number} maxDist — Max ray distance
 * @param {{x:number,y:number,w:number,h:number}} box
 * @returns {{x:number,y:number,t:number}|null}
 */
function _raycastAABB(ox, oy, rdx, rdy, maxDist, box) {
  const invDx = rdx === 0 ? Infinity : 1 / rdx;
  const invDy = rdy === 0 ? Infinity : 1 / rdy;

  const t1 = (box.x - ox) * invDx;
  const t2 = (box.x + box.w - ox) * invDx;
  const t3 = (box.y - oy) * invDy;
  const t4 = (box.y + box.h - oy) * invDy;

  const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4));
  const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4));

  if (tmax < 0 || tmin > tmax || tmin > maxDist) return null;
  const t = tmin >= 0 ? tmin : tmax;
  if (t > maxDist) return null;

  return {
    x: ox + rdx * t,
    y: oy + rdy * t,
    t,
  };
}

// ============================================================
// SPATIAL QUERIES
// ============================================================

/**
 * Returns all entities within a radius of a point.
 * Uses the spatial hash if one is provided, otherwise brute-force.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {Array<Object>} [allEntities=[]]
 * @param {_SpatialHash|null} [spatialHash=null]
 * @returns {Array<Object>}
 */
export function getEntitiesInRadius(x, y, radius, allEntities = [], spatialHash = null) {
  const candidates = spatialHash
    ? spatialHash.queryCircle(x, y, radius)
    : allEntities;

  const results = [];
  const rSq = radius * radius;
  for (const ent of candidates) {
    const bounds = getEntityBounds(ent);
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    const dx = cx - x;
    const dy = cy - y;
    if (dx * dx + dy * dy <= rSq) {
      results.push(ent);
    }
  }
  return results;
}

/**
 * Returns all entities that are currently colliding with the target entity.
 * @param {Object} entity
 * @param {Array<Object>} allEntities
 * @param {_SpatialHash|null} [spatialHash=null]
 * @returns {Array<Object>}
 */
export function getCollidingEntities(entity, allEntities, spatialHash = null) {
  const bounds = getEntityBounds(entity);
  const candidates = spatialHash
    ? spatialHash.queryAABB(bounds.x - 1, bounds.y - 1, bounds.w + 2, bounds.h + 2)
    : allEntities;

  const results = [];
  for (const other of candidates) {
    if (other === entity) continue;
    if (checkEntityEntity(entity, other)) {
      results.push(other);
    }
  }
  return results;
}

// ============================================================
// TILE MAP COLLISION BATCH
// ============================================================

/**
 * Checks a single entity against a 2D tile map and returns all colliding tiles.
 *
 * @param {Object} entity
 * @param {Array<Array<{blocked?:boolean}>>} tileMap — 2D array of tile objects
 * @returns {Array<{tx: number, ty: number, tile: Object}>}
 */
export function getEntityTileCollisions(entity, tileMap) {
  const results = [];
  const bounds = getEntityBounds(entity);

  const startTx = Math.floor(bounds.x / TILE_SIZE);
  const endTx = Math.floor((bounds.x + bounds.w) / TILE_SIZE);
  const startTy = Math.floor(bounds.y / TILE_SIZE);
  const endTy = Math.floor((bounds.y + bounds.h) / TILE_SIZE);

  for (let ty = startTy; ty <= endTy; ty++) {
    const row = tileMap[ty];
    if (!row) continue;
    for (let tx = startTx; tx <= endTx; tx++) {
      const tile = row[tx];
      if (tile && tile.blocked !== false) {
        if (checkEntityTile(entity, { tx, ty, blocked: true })) {
          results.push({ tx, ty, tile });
        }
      }
    }
  }
  return results;
}

/**
 * Resolves all tile collisions for an entity, sliding along walls.
 * Mutates entity position.
 *
 * @param {Object} entity
 * @param {Array<Array<{blocked?:boolean}>>} tileMap
 * @returns {number} Count of resolved collisions
 */
export function resolveTileCollisions(entity, tileMap) {
  let count = 0;
  const maxIterations = 4;
  for (let i = 0; i < maxIterations; i++) {
    const hits = getEntityTileCollisions(entity, tileMap);
    if (hits.length === 0) break;
    for (const hit of hits) {
      const boxA = getEntityBounds(entity);
      const boxB = {
        x: hit.tx * TILE_SIZE,
        y: hit.ty * TILE_SIZE,
        w: TILE_SIZE,
        h: TILE_SIZE,
      };
      const mtv = aabbMTV(boxA, boxB);
      if (mtv) {
        entity.x += mtv.nx * mtv.penetration;
        entity.y += mtv.ny * mtv.penetration;
        count++;
      }
    }
  }
  return count;
}

// ============================================================
// MULTI-ENTITY RESOLUTION
// ============================================================

/**
 * Resolves all pairwise collisions within a list of entities.
 * Iterates up to a fixed number of passes for stability.
 *
 * @param {Array<Object>} entities
 * @param {number} [passes=3]
 * @returns {number} Total resolved count
 */
export function resolveAllCollisions(entities, passes = 3) {
  let total = 0;
  for (let p = 0; p < passes; p++) {
    let passResolved = 0;
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const result = resolveCollision(entities[i], entities[j]);
        if (result) passResolved++;
      }
    }
    total += passResolved;
    if (passResolved === 0) break;
  }
  return total;
}

// ============================================================
// DEBUG VISUALISATION
// ============================================================

/**
 * Draws collision bounds for an array of entities.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<Object>} entities
 * @param {string} [color='#00FF00']
 * @param {boolean} [fill=false]
 */
export function drawEntityBounds(ctx, entities, color = '#00FF00', fill = false) {
  ctx.save();
  for (const ent of entities) {
    const b = getEntityBounds(ent);
    if (fill) {
      ctx.fillStyle = color + '33';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    // centre cross
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.moveTo(b.x + b.w, b.y);
    ctx.lineTo(b.x, b.y + b.h);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws tile grid collision overlay.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<Array<{blocked?:boolean}>>} tileMap
 * @param {number} offsetX
 * @param {number} offsetY
 * @param {string} [color='#FF0000']
 */
export function drawTileBounds(ctx, tileMap, offsetX, offsetY, color = '#FF0000') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.fillStyle = color + '22';
  for (let ty = 0; ty < tileMap.length; ty++) {
    const row = tileMap[ty];
    if (!row) continue;
    for (let tx = 0; tx < row.length; tx++) {
      const tile = row[tx];
      if (tile && tile.blocked !== false) {
        const x = tx * TILE_SIZE + offsetX;
        const y = ty * TILE_SIZE + offsetY;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      }
    }
  }
  ctx.restore();
}

// ============================================================
// COLLISION SYSTEM CLASS
// ============================================================

/**
 * @class CollisionSystem
 * @description Centralised collision manager. Maintains a spatial hash of all
 * registered entities and provides broad-phase + narrow-phase queries.
 */
export class CollisionSystem {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.cellSize=128]
   * @param {boolean} [options.debug=false]
   */
  constructor(options = {}) {
    /** @type {_SpatialHash} */
    this._spatial = new _SpatialHash(options.cellSize ?? SPATIAL_CELL_SIZE);

    /** @type {Map<string, Object>} */
    this._entities = new Map();

    /** @type {Array<Array<{blocked?:boolean}>>|null} */
    this.tileMap = null;

    /** @type {boolean} */
    this.debug = options.debug ?? false;

    /** @type {Set<Function>} */
    this._listeners = new Set();
  }

  /**
   * Registers an entity with the collision system.
   * @param {string} id
   * @param {Object} entity
   * @returns {Object}
   */
  register(id, entity) {
    this._entities.set(id, entity);
    this._spatial.insert(entity);
    return entity;
  }

  /**
   * Unregisters an entity.
   * @param {string} id
   */
  unregister(id) {
    const entity = this._entities.get(id);
    if (entity) {
      this._spatial.remove(entity);
      this._entities.delete(id);
    }
  }

  /**
   * Updates the spatial position of an entity after it moves.
   * @param {string} id
   */
  updateEntity(id) {
    const entity = this._entities.get(id);
    if (entity) this._spatial.update(entity);
  }

  /** Clears all registered entities. */
  clear() {
    this._spatial.clear();
    this._entities.clear();
  }

  /**
   * Returns a registered entity by ID.
   * @param {string} id
   * @returns {Object|undefined}
   */
  get(id) {
    return this._entities.get(id);
  }

  /**
   * Returns all registered entities.
   * @returns {Array<Object>}
   */
  getAll() {
    return Array.from(this._entities.values());
  }

  /**
   * Sets the active tile map for tile collision queries.
   * @param {Array<Array<{blocked?:boolean}>>} tileMap
   */
  setTileMap(tileMap) {
    this.tileMap = tileMap;
  }

  // ── Queries ────────────────────────────────────────────────

  /**
   * Returns all entities whose bounds overlap a point.
   * @param {number} x
   * @param {number} y
   * @returns {Array<Object>}
   */
  queryPoint(x, y) {
    const candidates = this._spatial.queryPoint(x, y);
    return candidates.filter(e => isPointInEntity(x, y, e));
  }

  /**
   * Returns all entities overlapping an AABB.
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @returns {Array<Object>}
   */
  queryAABB(x, y, w, h) {
    const candidates = this._spatial.queryAABB(x, y, w, h);
    return candidates.filter(e => {
      const b = getEntityBounds(e);
      return aabbIntersects({ x, y, w, h }, b);
    });
  }

  /**
   * Returns all entities within radius of a point.
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @returns {Array<Object>}
   */
  queryRadius(x, y, radius) {
    return getEntitiesInRadius(x, y, radius, this.getAll(), this._spatial);
  }

  /**
   * Raycast in the world.
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @returns {{hit: boolean, x: number, y: number, entity: Object|null, tx: number|null, ty: number|null}}
   */
  queryRay(x1, y1, x2, y2) {
    return raycast(x1, y1, x2, y2, {
      entities: this.getAll(),
      tileBlocked: this.tileMap
        ? (tx, ty) => {
            const row = this.tileMap[ty];
            return row && row[tx] && row[tx].blocked !== false;
          }
        : null,
    });
  }

  // ── Collision Tests ───────────────────────────────────────

  /**
   * @param {Object} a
   * @param {Object} b
   * @returns {boolean}
   */
  testEntityEntity(a, b) {
    return checkEntityEntity(a, b);
  }

  /**
   * @param {Object} entity
   * @param {Object} tile
   * @returns {boolean}
   */
  testEntityTile(entity, tile) {
    return checkEntityTile(entity, tile);
  }

  /**
   * @param {Object} entity
   * @param {Object} furniture
   * @returns {boolean}
   */
  testEntityFurniture(entity, furniture) {
    return checkEntityFurniture(entity, furniture);
  }

  /**
   * @param {Object} entity
   * @param {Object} wall
   * @returns {boolean}
   */
  testEntityWall(entity, wall) {
    return checkEntityWall(entity, wall);
  }

  // ── Resolution ────────────────────────────────────────────

  /**
   * Resolves collision between two registered entities.
   * @param {string} idA
   * @param {string} idB
   * @returns {{nx:number,ny:number,penetration:number}|null}
   */
  resolve(idA, idB) {
    const a = this._entities.get(idA);
    const b = this._entities.get(idB);
    if (!a || !b) return null;
    return resolveCollision(a, b);
  }

  /**
   * Resolves all registered entity-vs-entity collisions.
   * @param {number} [passes=3]
   * @returns {number}
   */
  resolveAll(passes = 3) {
    return resolveAllCollisions(this.getAll(), passes);
  }

  /**
   * Resolves an entity against the tile map.
   * @param {string} id
   * @returns {number}
   */
  resolveEntityTiles(id) {
    const entity = this._entities.get(id);
    if (!entity || !this.tileMap) return 0;
    return resolveTileCollisions(entity, this.tileMap);
  }

  // ── Event Listener ────────────────────────────────────────

  /**
   * Subscribe to collision events: (type, a, b, mtv) => void
   * @param {Function} callback
   * @returns {Function} Unsubscribe
   */
  onCollision(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  /** @private */
  _emit(type, a, b, mtv) {
    for (const cb of this._listeners) {
      try { cb(type, a, b, mtv); } catch (e) { /* ignore */ }
    }
  }

  // ── Debug ─────────────────────────────────────────────────

  /**
   * Draws all collision bounds for registered entities.
   * @param {CanvasRenderingContext2D} ctx
   */
  drawDebug(ctx) {
    if (!this.debug) return;
    const all = this.getAll();
    drawEntityBounds(ctx, all, '#00FF00', true);
    if (this.tileMap) {
      drawTileBounds(ctx, this.tileMap, 0, 0, '#FF0000');
    }
  }

  /**
   * Draws collision bounds for a single entity.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} entity
   * @param {string} [color='#00FFFF']
   */
  drawDebugEntity(ctx, entity, color = '#00FFFF') {
    drawEntityBounds(ctx, [entity], color, true);
  }

  // ── Stats ─────────────────────────────────────────────────

  /**
   * Returns statistics about the collision system.
   * @returns {{entityCount: number, spatialCells: number, avgPerCell: number}}
   */
  getStats() {
    return {
      entityCount: this._entities.size,
      spatialCells: this._spatial.cells.size,
      avgPerCell: this._spatial.cells.size > 0
        ? this._spatial.entityCount / this._spatial.cells.size
        : 0,
    };
  }
}

// ============================================================
// STATIC EXPORTS (also available as module-level functions)
// ============================================================

export {
  checkEntityEntity,
  checkEntityTile,
  checkEntityFurniture,
  checkEntityWall,
  resolveCollision,
  getEntityBounds,
  isPointInEntity,
  raycast,
  getEntitiesInRadius,
  getCollidingEntities,
  aabbIntersects,
  aabbMTV,
  pointInRect,
  makeEntityHitBox,
  makeTileHitBox,
  getEntityTileCollisions,
  resolveTileCollisions,
  resolveAllCollisions,
  drawEntityBounds,
  drawTileBounds,
};

export default CollisionSystem;
