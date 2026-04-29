/**
 * @file CollisionSystem.js
 * @description Comprehensive collision detection system for Starlight Inn v3.5.
 * Provides entity-entity and entity-world collision with spatial hashing,
 * portal triggers, social zones, collision layers, and debug visualization.
 * @module world/CollisionSystem
 * @version 3.5.0
 */

// ============================================================
// CONSTANTS
// ============================================================

/** @constant {number} DEFAULT_CELL_SIZE - Spatial hash cell size in pixels */
const DEFAULT_CELL_SIZE = 128;

/** @constant {number} MAX_COLLISION_LAYERS - Maximum number of collision layers */
const MAX_COLLISION_LAYERS = 16;

/** @constant {number} STAIRS_TRANSITION_SPEED - Speed of z-index transition on stairs (units/sec) */
const STAIRS_TRANSITION_SPEED = 120.0;

/** @constant {number} BOUNCE_VELOCITY_RETENTION - Velocity fraction retained after bounce */
const BOUNCE_VELOCITY_RETENTION = 0.6;

/** @constant {number} SLIDE_CORRECTION_EPSILON - Tiny offset to prevent getting stuck during sliding */
const SLIDE_CORRECTION_EPSILON = 0.001;

// ============================================================
// COLLISION RESPONSE TYPES
// ============================================================

/** @constant {Object<string, string>} COLLISION_RESPONSE - Named response types */
export const COLLISION_RESPONSE = {
  /** Block movement and slide along the collision surface */
  BLOCK: 'block',
  /** No physical response, only trigger callback */
  TRIGGER: 'trigger',
  /** Reflect velocity vector */
  BOUNCE: 'bounce',
  /** Only collide when approaching from the allowed direction */
  ONE_WAY: 'one_way',
};

// ============================================================
// COLLISION LAYER UTILITIES
// ============================================================

/**
 * @description Generates a collision layer bitmask from an array of layer indices (0-15).
 * @param {Array<number>} layers - Layer indices to include
 * @returns {number} Bitmask integer
 */
export function makeLayerMask(...layers) {
  let mask = 0;
  for (const layer of layers) {
    if (layer >= 0 && layer < MAX_COLLISION_LAYERS) {
      mask |= (1 << layer);
    }
  }
  return mask;
}

/** @constant {number} LAYER_DEFAULT - Default collision layer */
export const LAYER_DEFAULT = 0;

/** @constant {number} LAYER_PLAYER - Player entity layer */
export const LAYER_PLAYER = 1;

/** @constant {number} LAYER_NPC - NPC entity layer */
export const LAYER_NPC = 2;

/** @constant {number} LAYER_WALL - Wall/structure layer */
export const LAYER_WALL = 3;

/** @constant {number} LAYER_DECOR - Decorative object layer (non-colliding) */
export const LAYER_DECOR = 4;

/** @constant {number} LAYER_INTERACTIVE - Interactive object layer */
export const LAYER_INTERACTIVE = 5;

/** @constant {number} LAYER_PORTAL - Portal trigger zone layer */
export const LAYER_PORTAL = 6;

/** @constant {number} LAYER_SOCIAL - Social zone layer */
export const LAYER_SOCIAL = 7;

/** @constant {number} LAYER_STAIRS - Stairs/ramp elevation layer */
export const LAYER_STAIRS = 8;

// ============================================================
// SPATIAL HASH
// ============================================================

/**
 * @class _SpatialHash
 * @description Uniform grid spatial hash for O(1) broad-phase entity lookup.
 * Divides the world into cells; each cell stores references to overlapping entities.
 * @private
 */
class _SpatialHash {
  /**
   * @description Creates a new SpatialHash.
   * @param {number} [cellSize=128] - Size of each spatial hash cell in pixels
   */
  constructor(cellSize = DEFAULT_CELL_SIZE) {
    /** @type {number} Cell size in pixels */
    this.cellSize = cellSize;

    /** @type {Map<string, Set<Object>>} Map of cell key "cx,cy" to Set of entities */
    this.cells = new Map();

    /** @type {Map<Object, Set<string>>} Reverse mapping: entity to its cell keys */
    this.entityCells = new Map();

    /** @type {number} Total entity count (approximate, for stats) */
    this.entityCount = 0;
  }

  /**
   * @description Converts world coordinates to spatial hash cell coordinates.
   * @param {number} x - World X in pixels
   * @param {number} y - World Y in pixels
   * @returns {{cx: number, cy: number}}
   */
  worldToCell(x, y) {
    // Use floor division for consistent cell indexing
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return { cx, cy };
  }

  /**
   * @description Computes the cell key string for given cell coordinates.
   * @param {number} cx - Cell X
   * @param {number} cy - Cell Y
   * @returns {string}
   */
  _key(cx, cy) {
    return `${cx},${cy}`;
  }

  /**
   * @description Returns all cell keys that an AABB overlaps.
   * @param {number} x - Left edge
   * @param {number} y - Top edge
   * @param {number} width - AABB width
   * @param {number} height - AABB height
   * @returns {Array<string>} Array of cell keys
   */
  _getOverlappingCellKeys(x, y, width, height) {
    const tl = this.worldToCell(x, y);
    const br = this.worldToCell(x + width - 1, y + height - 1);
    const keys = [];
    for (let cy = tl.cy; cy <= br.cy; cy++) {
      for (let cx = tl.cx; cx <= br.cx; cx++) {
        keys.push(this._key(cx, cy));
      }
    }
    return keys;
  }

  /**
   * @description Inserts an entity into all spatial hash cells it overlaps.
   * @param {Object} entity - The entity to insert (must have x, y, width, height)
   */
  insert(entity) {
    // Remove from previous cells if already present
    this.remove(entity);

    const keys = this._getOverlappingCellKeys(entity.x, entity.y, entity.width, entity.height);
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
   * @description Removes an entity from the spatial hash.
   * @param {Object} entity - The entity to remove
   */
  remove(entity) {
    const keys = this.entityCells.get(entity);
    if (!keys) return;

    for (const key of keys) {
      const cell = this.cells.get(key);
      if (cell) {
        cell.delete(entity);
        if (cell.size === 0) {
          this.cells.delete(key);
        }
      }
    }

    this.entityCells.delete(entity);
    this.entityCount--;
  }

  /**
   * @description Updates an entity's position in the spatial hash.
   * Call this when the entity moves.
   * @param {Object} entity - The entity that moved
   */
  update(entity) {
    this.remove(entity);
    this.insert(entity);
  }

  /**
   * @description Returns all entities in cells overlapping the given AABB.
   * May include duplicates; the caller should filter them.
   * @param {number} x - Left edge
   * @param {number} y - Top edge
   * @param {number} width - AABB width
   * @param {number} height - AABB height
   * @returns {Array<Object>} Array of potentially overlapping entities
   */
  queryAABB(x, y, width, height) {
    const keys = this._getOverlappingCellKeys(x, y, width, height);
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
   * @description Returns all entities in cells overlapping the given circle.
   * @param {number} cx - Circle center X
   * @param {number} cy - Circle center Y
   * @param {number} radius - Circle radius
   * @returns {Array<Object>} Array of potentially overlapping entities
   */
  queryCircle(cx, cy, radius) {
    return this.queryAABB(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  /**
   * @description Returns all entities near a point (in the single containing cell).
   * @param {number} x - World X
   * @param {number} y - World Y
   * @returns {Array<Object>}
   */
  queryPoint(x, y) {
    const cell = this.worldToCell(x, y);
    const key = this._key(cell.cx, cell.cy);
    return Array.from(this.cells.get(key) || []);
  }

  /**
   * @description Clears all cells and entity mappings.
   */
  clear() {
    this.cells.clear();
    this.entityCells.clear();
    this.entityCount = 0;
  }

  /**
   * @description Returns statistics about the spatial hash.
   * @returns {{cellCount: number, entityCount: number, avgEntitiesPerCell: number}}
   */
  getStats() {
    let totalEntitiesInCells = 0;
    for (const cell of this.cells.values()) {
      totalEntitiesInCells += cell.size;
    }
    const cellCount = this.cells.size;
    return {
      cellCount,
      entityCount: this.entityCount,
      avgEntitiesPerCell: cellCount > 0 ? totalEntitiesInCells / cellCount : 0,
    };
  }
}

// ============================================================
// SHAPE DEFINITIONS
// ============================================================

/**
 * @typedef {Object} CollisionShape
 * @property {string} type - Shape type: 'circle' | 'aabb'
 * @property {number} [radius] - Circle radius (for circle type)
 * @property {number} [width] - AABB width (for aabb type)
 * @property {number} [height] - AABB height (for aabb type)
 * @property {number} offsetX - X offset from entity position
 * @property {number} offsetY - Y offset from entity position
 */

/**
 * @description Creates a circle collision shape.
 * @param {number} radius - Circle radius in pixels
 * @param {number} [offsetX=0] - X offset from entity position
 * @param {number} [offsetY=0] - Y offset from entity position
 * @returns {CollisionShape}
 */
export function makeCircleShape(radius, offsetX = 0, offsetY = 0) {
  return { type: 'circle', radius, offsetX, offsetY };
}

/**
 * @description Creates an AABB collision shape.
 * @param {number} width - AABB width in pixels
 * @param {number} height - AABB height in pixels
 * @param {number} [offsetX=0] - X offset from entity position
 * @param {number} [offsetY=0] - Y offset from entity position
 * @returns {CollisionShape}
 */
export function makeAABBShape(width, height, offsetX = 0, offsetY = 0) {
  return { type: 'aabb', width, height, offsetX, offsetY };
}

// ============================================================
// MAIN CLASS
// ============================================================

/**
 * @class CollisionSystem
 * @description Comprehensive collision detection and response system.
 * Features spatial hashing for broad-phase, precise narrow-phase collision,
 * portal triggers, social zones, collision layers, and stair/ramp handling.
 * Call update() each frame from the game loop.
 */
export default class CollisionSystem {
  /**
   * @description Creates a new CollisionSystem.
   * @param {Object} game - The main Game instance
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.cellSize=128] - Spatial hash cell size in pixels
   * @param {boolean} [options.debug=false] - Enable debug visualization
   * @param {HTMLCanvasElement} [options.debugCanvas=null] - Optional dedicated debug canvas
   */
  constructor(game, options = {}) {
    /** @type {Object} Reference to the main Game instance */
    this.game = game;

    /** @type {number} Spatial hash cell size in pixels */
    this.cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;

    /** @type {boolean} Whether debug visualization is enabled */
    this.debug = options.debug ?? false;

    /** @type {HTMLCanvasElement|null} Dedicated debug canvas overlay */
    this.debugCanvas = options.debugCanvas ?? null;

    /** @type {CanvasRenderingContext2D|null} Debug canvas 2D context */
    this._debugCtx = this.debugCanvas?.getContext('2d') ?? null;

    /** @type {_SpatialHash} Broad-phase spatial hash for entity lookup */
    this._spatialHash = new _SpatialHash(this.cellSize);

    /** @type {Map<string, Object>} All registered collision entities by ID */
    this._entities = new Map();

    /** @type {Map<string, Object>} Portal zone definitions by portalId */
    this._portals = new Map();

    /** @type {Map<string, Object>} Social zone definitions by zoneId */
    this._socialZones = new Map();

    /** @type {Map<string, Set<string>>} Which entities are in which social zone */
    this._entitySocialZones = new Map();

    /** @type {Map<string, string>} Which portal each entity last triggered (cooldown) */
    this._portalCooldowns = new Map();

    /** @type {number} Portal re-trigger cooldown in milliseconds */
    this._portalCooldownMs = 2000;

    /** @type {Set<string>} Collision entity IDs registered for stair transitions */
    this._stairEntities = new Set();

    /** @type {Function|null} Callback for portal entry: (portalId, targetArea, targetX, targetY, entity) => void */
    this.onPortalEnter = null;

    /** @type {Function|null} Callback for social zone entry: (zoneId, zoneType, entity) => void */
    this.onZoneEnter = null;

    /** @type {Function|null} Callback for social zone exit: (zoneId, entity) => void */
    this.onZoneExit = null;

    /** @type {Function|null} Callback for collision events: (entityA, entityB, response) => void */
    this.onCollision = null;

    /** @type {number} Frame counter for periodic cleanup */
    this._frameCount = 0;
  }

  // ============================================================
  // ENTITY REGISTRATION
  // ============================================================

  /**
   * @description Registers a collision-enabled entity.
   * @param {string} id - Unique entity identifier
   * @param {Object} entity - The entity object (must have x, y properties)
   * @param {Object} [options={}] - Collision configuration
   * @param {CollisionShape} [options.shape] - Collision shape (circle or aabb)
   * @param {number} [options.layerMask=0xFFFF] - Bitmask of layers this entity belongs to
   * @param {number} [options.collideMask=0xFFFF] - Bitmask of layers this entity collides with
   * @param {string} [options.response='block'] - Collision response type
   * @param {string} [options.oneWayDir='up'] - For ONE_WAY: allowed approach direction (up|down|left|right)
   * @param {boolean} [options.isTrigger=false] - If true, this entity only triggers (no physical response)
   * @param {boolean} [options.trackSocialZones=true] - Whether to track social zone entry/exit for this entity
   * @returns {Object} The collision registration handle
   */
  registerEntity(id, entity, options = {}) {
    if (!id || !entity) {
      throw new Error('CollisionSystem.registerEntity: id and entity are required');
    }

    // Auto-detect shape from entity dimensions if not provided
    let shape = options.shape;
    if (!shape) {
      if (entity.radius) {
        shape = makeCircleShape(entity.radius);
      } else if (entity.width && entity.height) {
        shape = makeAABBShape(entity.width, entity.height);
      } else {
        // Default to small circle
        shape = makeCircleShape(8);
      }
    }

    /** @type {Object} Collision body definition */
    const body = {
      id,
      entity,
      shape,
      layerMask: options.layerMask ?? makeLayerMask(LAYER_DEFAULT),
      collideMask: options.collideMask ?? 0xFFFF,
      response: options.response ?? COLLISION_RESPONSE.BLOCK,
      oneWayDir: options.oneWayDir ?? 'up',
      isTrigger: options.isTrigger ?? false,
      trackSocialZones: options.trackSocialZones ?? true,
      prevX: entity.x,
      prevY: entity.y,
      velocityX: entity.velocityX ?? 0,
      velocityY: entity.velocityY ?? 0,
    };

    this._entities.set(id, body);
    this._spatialHash.insert(entity);

    // Initialize social zone tracking
    if (body.trackSocialZones) {
      this._entitySocialZones.set(id, new Set());
    }

    return body;
  }

  /**
   * @description Unregisters an entity from collision detection.
   * @param {string} id - Entity identifier
   */
  unregisterEntity(id) {
    const body = this._entities.get(id);
    if (!body) return;

    this._spatialHash.remove(body.entity);
    this._entities.delete(id);
    this._entitySocialZones.delete(id);
    this._portalCooldowns.delete(id);
    this._stairEntities.delete(id);
  }

  /**
   * @description Updates an entity's collision properties after registration.
   * @param {string} id - Entity identifier
   * @param {Object} updates - Partial body updates
   */
  updateEntity(id, updates) {
    const body = this._entities.get(id);
    if (!body) return;

    Object.assign(body, updates);

    // Re-insert into spatial hash if needed (shape may have changed)
    if (updates.shape || updates.entity) {
      this._spatialHash.update(body.entity);
    }
  }

  /**
   * @description Returns a registered collision body by ID.
   * @param {string} id - Entity identifier
   * @returns {Object|undefined}
   */
  getBody(id) {
    return this._entities.get(id);
  }

  // ============================================================
  // PORTAL ZONES
  // ============================================================

  /**
   * @description Defines a portal zone that teleports entities to another area.
   * @param {string} portalId - Unique portal identifier
   * @param {Object} def - Portal definition
   * @param {number} def.x - Portal zone left edge in world pixels
   * @param {number} def.y - Portal zone top edge in world pixels
   * @param {number} def.width - Portal zone width
   * @param {number} def.height - Portal zone height
   * @param {string} def.targetArea - Destination area ID
   * @param {number} def.targetX - Destination X in world pixels
   * @param {number} def.targetY - Destination Y in world pixels
   * @param {boolean} [def.oneWay=false] - If true, only triggers when entering from outside
   */
  definePortal(portalId, def) {
    this._portals.set(portalId, {
      portalId,
      x: def.x,
      y: def.y,
      width: def.width,
      height: def.height,
      targetArea: def.targetArea,
      targetX: def.targetX,
      targetY: def.targetY,
      oneWay: def.oneWay ?? false,
    });
  }

  /**
   * @description Removes a portal definition.
   * @param {string} portalId
   */
  removePortal(portalId) {
    this._portals.delete(portalId);
    // Clear cooldowns referencing this portal
    for (const [entityId, pid] of this._portalCooldowns) {
      if (pid === portalId) this._portalCooldowns.delete(entityId);
    }
  }

  /**
   * @description Clears all portal definitions.
   */
  clearPortals() {
    this._portals.clear();
    this._portalCooldowns.clear();
  }

  // ============================================================
  // SOCIAL ZONES
  // ============================================================

  /**
   * @description Defines a social zone (dance floor, seating area, photo spot, etc.).
   * @param {string} zoneId - Unique zone identifier
   * @param {Object} def - Zone definition
   * @param {number} def.x - Zone left edge in world pixels
   * @param {number} def.y - Zone top edge in world pixels
   * @param {number} def.width - Zone width
   * @param {number} def.height - Zone height
   * @param {string} def.zoneType - Human-readable zone type (e.g., 'dance_floor', 'seating', 'photo_spot')
   * @param {Object} [def.metadata={}] - Arbitrary zone metadata
   */
  defineSocialZone(zoneId, def) {
    this._socialZones.set(zoneId, {
      zoneId,
      x: def.x,
      y: def.y,
      width: def.width,
      height: def.height,
      zoneType: def.zoneType,
      metadata: def.metadata ?? {},
    });
  }

  /**
   * @description Removes a social zone definition.
   * @param {string} zoneId
   */
  removeSocialZone(zoneId) {
    // Trigger exit for all entities currently in this zone
    for (const [entityId, zones] of this._entitySocialZones) {
      if (zones.has(zoneId)) {
        zones.delete(zoneId);
        const body = this._entities.get(entityId);
        if (body && this.onZoneExit) {
          try {
            this.onZoneExit(zoneId, body.entity);
          } catch (err) {
            console.error('CollisionSystem onZoneExit error:', err);
          }
        }
      }
    }
    this._socialZones.delete(zoneId);
  }

  /**
   * @description Clears all social zone definitions.
   */
  clearSocialZones() {
    // Trigger exit callbacks for all entities in all zones
    if (this.onZoneExit) {
      for (const [entityId, zones] of this._entitySocialZones) {
        const body = this._entities.get(entityId);
        if (!body) continue;
        for (const zoneId of zones) {
          try {
            this.onZoneExit(zoneId, body.entity);
          } catch (err) {
            console.error('CollisionSystem onZoneExit error:', err);
          }
        }
      }
    }
    this._socialZones.clear();
    for (const zones of this._entitySocialZones.values()) {
      zones.clear();
    }
  }

  // ============================================================
  // COLLISION LAYER TESTS
  // ============================================================

  /**
   * @description Checks if two collision bodies can collide based on layer masks.
   * Body A's collideMask must include one of Body B's layers, and vice versa.
   * @param {Object} bodyA
   * @param {Object} bodyB
   * @returns {boolean}
   * @private
   */
  _layersCanCollide(bodyA, bodyB) {
    return (bodyA.collideMask & bodyB.layerMask) !== 0 && (bodyB.collideMask & bodyA.layerMask) !== 0;
  }

  // ============================================================
  // NARROW-PHASE COLLISION TESTS
  // ============================================================

  /**
   * @description Tests collision between two circle shapes.
   * @param {Object} bodyA
   * @param {Object} bodyB
   * @param {CollisionShape} shapeA
   * @param {CollisionShape} shapeB
   * @returns {{collided: boolean, nx: number, ny: number, penetration: number}|null}
   * @private
   */
  _testCircleCircle(bodyA, bodyB, shapeA, shapeB) {
    const ax = bodyA.entity.x + shapeA.offsetX;
    const ay = bodyA.entity.y + shapeA.offsetY;
    const bx = bodyB.entity.x + shapeB.offsetX;
    const by = bodyB.entity.y + shapeB.offsetY;

    const dx = bx - ax;
    const dy = by - ay;
    const distSq = dx * dx + dy * dy;
    const radiusSum = shapeA.radius + shapeB.radius;

    if (distSq >= radiusSum * radiusSum || distSq === 0) return null;

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const penetration = radiusSum - dist;

    return { collided: true, nx, ny, penetration };
  }

  /**
   * @description Tests collision between two AABB shapes.
   * @param {Object} bodyA
   * @param {Object} bodyB
   * @param {CollisionShape} shapeA
   * @param {CollisionShape} shapeB
   * @returns {{collided: boolean, nx: number, ny: number, penetration: number}|null}
   * @private
   */
  _testAABBAABB(bodyA, bodyB, shapeA, shapeB) {
    const ax = bodyA.entity.x + shapeA.offsetX;
    const ay = bodyA.entity.y + shapeA.offsetY;
    const bx = bodyB.entity.x + shapeB.offsetX;
    const by = bodyB.entity.y + shapeB.offsetY;

    const aHalfW = shapeA.width * 0.5;
    const aHalfH = shapeA.height * 0.5;
    const bHalfW = shapeB.width * 0.5;
    const bHalfH = shapeB.height * 0.5;

    const dx = (bx + bHalfW) - (ax + aHalfW);
    const dy = (by + bHalfH) - (ay + aHalfH);
    const overlapX = aHalfW + bHalfW - Math.abs(dx);
    const overlapY = aHalfH + bHalfH - Math.abs(dy);

    if (overlapX <= 0 || overlapY <= 0) return null;

    // Resolve along the axis of least penetration
    if (overlapX < overlapY) {
      return {
        collided: true,
        nx: dx > 0 ? 1 : -1,
        ny: 0,
        penetration: overlapX,
      };
    } else {
      return {
        collided: true,
        nx: 0,
        ny: dy > 0 ? 1 : -1,
        penetration: overlapY,
      };
    }
  }

  /**
   * @description Tests collision between a circle and an AABB.
   * @param {Object} bodyCircle
   * @param {Object} bodyAABB
   * @param {CollisionShape} shapeCircle
   * @param {CollisionShape} shapeAABB
   * @returns {{collided: boolean, nx: number, ny: number, penetration: number}|null}
   * @private
   */
  _testCircleAABB(bodyCircle, bodyAABB, shapeCircle, shapeAABB) {
    const cx = bodyCircle.entity.x + shapeCircle.offsetX;
    const cy = bodyCircle.entity.y + shapeCircle.offsetY;
    const ax = bodyAABB.entity.x + shapeAABB.offsetX;
    const ay = bodyAABB.entity.y + shapeAABB.offsetY;
    const aHalfW = shapeAABB.width * 0.5;
    const aHalfH = shapeAABB.height * 0.5;

    // Find closest point on AABB to circle center
    const closestX = Math.max(ax, Math.min(cx, ax + shapeAABB.width));
    const closestY = Math.max(ay, Math.min(cy, ay + shapeAABB.height));

    const dx = cx - closestX;
    const dy = cy - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq >= shapeCircle.radius * shapeCircle.radius) return null;

    // If circle center is inside AABB, push out along closest edge
    if (distSq === 0) {
      const leftDist = cx - ax;
      const rightDist = ax + shapeAABB.width - cx;
      const topDist = cy - ay;
      const bottomDist = ay + shapeAABB.height - cy;
      const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);

      if (minDist === leftDist) return { collided: true, nx: -1, ny: 0, penetration: minDist + shapeCircle.radius };
      if (minDist === rightDist) return { collided: true, nx: 1, ny: 0, penetration: minDist + shapeCircle.radius };
      if (minDist === topDist) return { collided: true, nx: 0, ny: -1, penetration: minDist + shapeCircle.radius };
      return { collided: true, nx: 0, ny: 1, penetration: minDist + shapeCircle.radius };
    }

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const penetration = shapeCircle.radius - dist;

    return { collided: true, nx, ny, penetration };
  }

  /**
   * @description Dispatches to the appropriate narrow-phase test based on shape types.
   * @param {Object} bodyA
   * @param {Object} bodyB
   * @returns {{collided: boolean, nx: number, ny: number, penetration: number}|null}
   * @private
   */
  _narrowPhase(bodyA, bodyB) {
    const shapeA = bodyA.shape;
    const shapeB = bodyB.shape;

    if (shapeA.type === 'circle' && shapeB.type === 'circle') {
      return this._testCircleCircle(bodyA, bodyB, shapeA, shapeB);
    }
    if (shapeA.type === 'aabb' && shapeB.type === 'aabb') {
      return this._testAABBAABB(bodyA, bodyB, shapeA, shapeB);
    }
    if (shapeA.type === 'circle' && shapeB.type === 'aabb') {
      return this._testCircleAABB(bodyA, bodyB, shapeA, shapeB);
    }
    if (shapeA.type === 'aabb' && shapeB.type === 'circle') {
      // Swap order, circle must be first
      const result = this._testCircleAABB(bodyB, bodyA, shapeB, shapeA);
      if (result) {
        result.nx = -result.nx;
        result.ny = -result.ny;
      }
      return result;
    }
    return null;
  }

  // ============================================================
  // COLLISION RESPONSE HANDLERS
  // ============================================================

  /**
   * @description Applies BLOCK response: slide the entity along the collision surface.
   * Uses the normal to separate and slides along the tangent axis.
   * @param {Object} body - The moving entity body
   * @param {{nx: number, ny: number, penetration: number}} manifold - Collision data
   * @private
   */
  _respondBlock(body, manifold) {
    const entity = body.entity;

    // Separate by penetration depth along normal
    entity.x -= manifold.nx * (manifold.penetration + SLIDE_CORRECTION_EPSILON);
    entity.y -= manifold.ny * (manifold.penetration + SLIDE_CORRECTION_EPSILON);

    // For sliding: if entity has velocity, project it onto the tangent plane
    if (entity.velocityX !== undefined && entity.velocityY !== undefined) {
      const dot = entity.velocityX * manifold.nx + entity.velocityY * manifold.ny;
      // Remove normal component from velocity
      if (dot < 0) {
        entity.velocityX -= dot * manifold.nx;
        entity.velocityY -= dot * manifold.ny;
      }
    }
  }

  /**
   * @description Applies BOUNCE response: reflect velocity and apply restitution.
   * @param {Object} body - The entity body
   * @param {{nx: number, ny: number, penetration: number}} manifold - Collision data
   * @private
   */
  _respondBounce(body, manifold) {
    const entity = body.entity;

    // Separate
    entity.x -= manifold.nx * (manifold.penetration + SLIDE_CORRECTION_EPSILON);
    entity.y -= manifold.ny * (manifold.penetration + SLIDE_CORRECTION_EPSILON);

    // Reflect velocity
    if (entity.velocityX !== undefined && entity.velocityY !== undefined) {
      const dot = entity.velocityX * manifold.nx + entity.velocityY * manifold.ny;
      if (dot < 0) {
        entity.velocityX = (entity.velocityX - 2 * dot * manifold.nx) * BOUNCE_VELOCITY_RETENTION;
        entity.velocityY = (entity.velocityY - 2 * dot * manifold.ny) * BOUNCE_VELOCITY_RETENTION;
      }
    }
  }

  /**
   * @description Applies ONE_WAY response: only block if approaching from the allowed direction.
   * @param {Object} body - The moving entity body
   * @param {Object} otherBody - The one-way body
   * @param {{nx: number, ny: number, penetration: number}} manifold - Collision data
   * @returns {boolean} True if the collision was actually applied
   * @private
   */
  _respondOneWay(body, otherBody, manifold) {
    const dir = otherBody.oneWayDir;
    let approachNx = 0;
    let approachNy = 0;

    switch (dir) {
      case 'up': approachNy = 1; break;
      case 'down': approachNy = -1; break;
      case 'left': approachNx = 1; break;
      case 'right': approachNx = -1; break;
      default: approachNy = 1;
    }

    // Check if the collision normal aligns with the allowed approach direction
    const dot = manifold.nx * approachNx + manifold.ny * approachNy;
    if (dot > 0.1) {
      this._respondBlock(body, manifold);
      return true;
    }
    return false;
  }

  // ============================================================
  // STAIRS / RAMPS
  // ============================================================

  /**
   * @description Registers a stair/ramp zone that adjusts entity z-index.
   * @param {string} stairId - Unique stair identifier
   * @param {Object} def - Stair definition
   * @param {number} def.x - Stair zone left edge
   * @param {number} def.y - Stair zone top edge
   * @param {number} def.width - Stair zone width
   * @param {number} def.height - Stair zone height
   * @param {number} def.targetZ - Target z-index value at the top of the stairs
   * @param {string} [def.direction='up'] - Stair direction: 'up' or 'down'
   */
  defineStair(stairId, def) {
    this._socialZones.set(`__stair_${stairId}`, {
      zoneId: `__stair_${stairId}`,
      x: def.x,
      y: def.y,
      width: def.width,
      height: def.height,
      zoneType: 'stairs',
      isStair: true,
      targetZ: def.targetZ,
      direction: def.direction ?? 'up',
      metadata: { stairId },
    });
  }

  /**
   * @description Updates z-index for entities on stairs.
   * Call from the main update loop after collision resolution.
   * @param {number} deltaTime - Time since last frame in seconds
   * @private
   */
  _updateStairs(deltaTime) {
    for (const [entityId, body] of this._entities) {
      const entity = body.entity;
      const entityZones = this._entitySocialZones.get(entityId);
      if (!entityZones) continue;

      let onStair = false;
      for (const zoneId of entityZones) {
        const zone = this._socialZones.get(zoneId);
        if (!zone || !zone.isStair) continue;

        onStair = true;
        const stairProgress = this._computeStairProgress(entity, zone);
        const targetZ = zone.targetZ;
        const currentZ = entity.zIndex ?? entity.y ?? 0;

        // Smoothly interpolate z-index based on stair progress
        const desiredZ = currentZ + (targetZ - currentZ) * stairProgress * deltaTime * STAIRS_TRANSITION_SPEED * 0.01;
        if (entity.zIndex !== undefined) {
          entity.zIndex = desiredZ;
        }

        // Slightly adjust Y position for visual ramp effect
        const yOffset = stairProgress * 4; // 4px max visual ramp
        if (zone.direction === 'up') {
          entity.y -= yOffset * deltaTime * STAIRS_TRANSITION_SPEED * 0.01;
        } else {
          entity.y += yOffset * deltaTime * STAIRS_TRANSITION_SPEED * 0.01;
        }
      }

      if (onStair) {
        this._stairEntities.add(entityId);
      } else {
        this._stairEntities.delete(entityId);
      }
    }
  }

  /**
   * @description Computes how far along a stair zone the entity is (0 to 1).
   * @param {Object} entity
   * @param {Object} zone
   * @returns {number}
   * @private
   */
  _computeStairProgress(entity, zone) {
    const centerX = entity.x + (entity.width ?? 0) * 0.5;
    const centerY = entity.y + (entity.height ?? 0) * 0.5;

    // Progress based on position within the stair zone
    const progressX = Math.max(0, Math.min(1, (centerX - zone.x) / zone.width));
    const progressY = Math.max(0, Math.min(1, (centerY - zone.y) / zone.height));

    // Use average of both axes for diagonal stairs
    return (progressX + progressY) * 0.5;
  }

  // ============================================================
  // PORTAL DETECTION
  // ============================================================

  /**
   * @description Checks if any entities have entered portal zones.
   * @private
   */
  _checkPortals() {
    if (!this.onPortalEnter || this._portals.size === 0) return;

    for (const body of this._entities.values()) {
      if (!body.trackSocialZones) continue;
      const entity = body.entity;

      for (const portal of this._portals.values()) {
        // Check cooldown
        const cooldownKey = `${body.id}:${portal.portalId}`;
        const lastTrigger = this._portalCooldowns.get(cooldownKey);
        if (lastTrigger && (Date.now() - lastTrigger) < this._portalCooldownMs) continue;

        // Check intersection
        const ex = entity.x + (entity.width ?? 0) * 0.5;
        const ey = entity.y + (entity.height ?? 0) * 0.5;
        const inside =
          ex >= portal.x &&
          ex <= portal.x + portal.width &&
          ey >= portal.y &&
          ey <= portal.y + portal.height;

        if (inside) {
          // For one-way portals, check if entity came from outside
          if (portal.oneWay) {
            const prevEx = body.prevX + (entity.width ?? 0) * 0.5;
            const prevEy = body.prevY + (entity.height ?? 0) * 0.5;
            const wasInside =
              prevEx >= portal.x &&
              prevEx <= portal.x + portal.width &&
              prevEy >= portal.y &&
              prevEy <= portal.y + portal.height;
            if (wasInside) continue;
          }

          // Trigger portal
          this._portalCooldowns.set(cooldownKey, Date.now());
          try {
            this.onPortalEnter(portal.portalId, portal.targetArea, portal.targetX, portal.targetY, entity);
          } catch (err) {
            console.error('CollisionSystem onPortalEnter error:', err);
          }
        }
      }
    }
  }

  // ============================================================
  // SOCIAL ZONE DETECTION
  // ============================================================

  /**
   * @description Checks entity entry/exit for all social zones and triggers callbacks.
   * @private
   */
  _checkSocialZones() {
    for (const [entityId, body] of this._entities) {
      if (!body.trackSocialZones) continue;

      const entity = body.entity;
      const currentZones = this._entitySocialZones.get(entityId);
      if (!currentZones) continue;

      const previousZones = new Set(currentZones);
      currentZones.clear();

      // Test against all social zones
      for (const zone of this._socialZones.values()) {
        const ex = entity.x + (entity.width ?? 0) * 0.5;
        const ey = entity.y + (entity.height ?? 0) * 0.5;
        const inside =
          ex >= zone.x &&
          ex <= zone.x + zone.width &&
          ey >= zone.y &&
          ey <= zone.y + zone.height;

        if (inside) {
          currentZones.add(zone.zoneId);

          // Enter event: was not in this zone before
          if (!previousZones.has(zone.zoneId)) {
            if (this.onZoneEnter && !zone.isStair) {
              try {
                this.onZoneEnter(zone.zoneId, zone.zoneType, entity);
              } catch (err) {
                console.error('CollisionSystem onZoneEnter error:', err);
              }
            }
          }
        }
      }

      // Exit event: was in a zone but no longer
      for (const zoneId of previousZones) {
        if (!currentZones.has(zoneId)) {
          const zone = this._socialZones.get(zoneId);
          if (this.onZoneExit && zone && !zone.isStair) {
            try {
              this.onZoneExit(zoneId, entity);
            } catch (err) {
              console.error('CollisionSystem onZoneExit error:', err);
            }
          }
        }
      }
    }
  }

  // ============================================================
  // MAIN UPDATE LOOP
  // ============================================================

  /**
   * @description Main update function. Call every frame from the game loop.
   * Processes all collision detection and response.
   * @param {number} deltaTime - Time elapsed since last frame in seconds
   */
  update(deltaTime) {
    this._frameCount++;

    // 1. Update spatial hash for moved entities
    this._updateSpatialHash();

    // 2. Broad-phase + narrow-phase entity collision
    this._processEntityCollisions();

    // 3. Portal detection
    this._checkPortals();

    // 4. Social zone detection
    this._checkSocialZones();

    // 5. Stair/ramp z-index updates
    this._updateStairs(deltaTime);

    // 6. Periodic cleanup (every 300 frames ~ 5 seconds at 60fps)
    if (this._frameCount % 300 === 0) {
      this._cleanupCooldowns();
    }
  }

  /**
   * @description Updates spatial hash positions for entities that have moved.
   * @private
   */
  _updateSpatialHash() {
    for (const body of this._entities.values()) {
      const entity = body.entity;
      const dx = entity.x - body.prevX;
      const dy = entity.y - body.prevY;

      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        this._spatialHash.update(entity);
        body.prevX = entity.x;
        body.prevY = entity.y;
        body.velocityX = dx;
        body.velocityY = dy;
      }
    }
  }

  /**
   * @description Processes all pairwise entity collisions using broad-phase then narrow-phase.
   * @private
   */
  _processEntityCollisions() {
    const processedPairs = new Set();

    for (const bodyA of this._entities.values()) {
      const entityA = bodyA.entity;

      // Compute query bounds based on shape
      let queryX, queryY, queryW, queryH;
      if (bodyA.shape.type === 'circle') {
        queryX = entityA.x + bodyA.shape.offsetX - bodyA.shape.radius;
        queryY = entityA.y + bodyA.shape.offsetY - bodyA.shape.radius;
        queryW = bodyA.shape.radius * 2;
        queryH = bodyA.shape.radius * 2;
      } else {
        queryX = entityA.x + bodyA.shape.offsetX;
        queryY = entityA.y + bodyA.shape.offsetY;
        queryW = bodyA.shape.width;
        queryH = bodyA.shape.height;
      }

      // Broad-phase: query spatial hash for nearby entities
      const candidates = this._spatialHash.queryAABB(queryX, queryY, queryW, queryH);

      for (const candidateEntity of candidates) {
        // Find the body for this candidate entity
        let bodyB = null;
        for (const b of this._entities.values()) {
          if (b.entity === candidateEntity) {
            bodyB = b;
            break;
          }
        }
        if (!bodyB || bodyA.id === bodyB.id) continue;

        // Skip duplicate pairs (A,B) == (B,A)
        const pairKey = bodyA.id < bodyB.id ? `${bodyA.id}:${bodyB.id}` : `${bodyB.id}:${bodyA.id}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        // Layer mask check
        if (!this._layersCanCollide(bodyA, bodyB)) continue;

        // Narrow-phase: precise shape test
        const manifold = this._narrowPhase(bodyA, bodyB);
        if (!manifold) continue;

        // Determine which entity should respond (the one that's not a static trigger)
        const aResponds = !bodyA.isTrigger && bodyA.response !== COLLISION_RESPONSE.TRIGGER;
        const bResponds = !bodyB.isTrigger && bodyB.response !== COLLISION_RESPONSE.TRIGGER;

        // Apply response
        if (aResponds) {
          this._applyResponse(bodyA, bodyB, manifold);
        }
        if (bResponds) {
          // Reverse normal for bodyB
          const reversedManifold = {
            nx: -manifold.nx,
            ny: -manifold.ny,
            penetration: manifold.penetration,
          };
          this._applyResponse(bodyB, bodyA, reversedManifold);
        }

        // Trigger collision callback
        if (this.onCollision) {
          try {
            this.onCollision(bodyA.entity, bodyB.entity, bodyA.response);
          } catch (err) {
            console.error('CollisionSystem onCollision error:', err);
          }
        }
      }
    }
  }

  /**
   * @description Applies the appropriate collision response based on body configuration.
   * @param {Object} movingBody - The body to apply response to
   * @param {Object} otherBody - The body it collided with
   * @param {Object} manifold - Collision manifold
   * @private
   */
  _applyResponse(movingBody, otherBody, manifold) {
    const response = movingBody.response;

    switch (response) {
      case COLLISION_RESPONSE.BLOCK:
        this._respondBlock(movingBody, manifold);
        break;
      case COLLISION_RESPONSE.BOUNCE:
        this._respondBounce(movingBody, manifold);
        break;
      case COLLISION_RESPONSE.ONE_WAY:
        this._respondOneWay(movingBody, otherBody, manifold);
        break;
      case COLLISION_RESPONSE.TRIGGER:
        // No physical response
        break;
      default:
        this._respondBlock(movingBody, manifold);
    }
  }

  /**
   * @description Removes expired portal cooldown entries.
   * @private
   */
  _cleanupCooldowns() {
    const now = Date.now();
    for (const [key, timestamp] of this._portalCooldowns) {
      if ((now - timestamp) > this._portalCooldownMs * 2) {
        this._portalCooldowns.delete(key);
      }
    }
  }

  // ============================================================
  // WORLD COLLISION (GRID-BASED WALL/FLOOR)
  // ============================================================

  /**
   * @description Resolves collision between an entity and the world grid.
   * Uses smooth sliding to prevent getting stuck on corners.
   * @param {Object} entity - Entity with x, y, width, height (and optionally velocityX/Y)
   * @param {Function} isWalkable - Function (gx, gy) => boolean for grid walkability
   * @param {number} [tileSize=32] - Grid tile size in pixels
   * @returns {{collided: boolean, slideX: number, slideY: number}}
   */
  resolveWorldCollision(entity, isWalkable, tileSize = 32) {
    if (!isWalkable) return { collided: false, slideX: 0, slideY: 0 };

    const ex = entity.x;
    const ey = entity.y;
    const ew = entity.width ?? tileSize;
    const eh = entity.height ?? tileSize;

    // Determine which grid cells the entity overlaps
    const leftGx = Math.floor(ex / tileSize);
    const rightGx = Math.floor((ex + ew - 1) / tileSize);
    const topGy = Math.floor(ey / tileSize);
    const bottomGy = Math.floor((ey + eh - 1) / tileSize);

    let collided = false;
    let slideX = 0;
    let slideY = 0;

    // Check each overlapping grid cell
    for (let gy = topGy; gy <= bottomGy; gy++) {
      for (let gx = leftGx; gx <= rightGx; gx++) {
        if (!isWalkable(gx, gy)) {
          collided = true;

          // Compute the overlap to determine slide direction
          const tileLeft = gx * tileSize;
          const tileRight = tileLeft + tileSize;
          const tileTop = gy * tileSize;
          const tileBottom = tileTop + tileSize;

          const overlapLeft = (ex + ew) - tileLeft;
          const overlapRight = tileRight - ex;
          const overlapTop = (ey + eh) - tileTop;
          const overlapBottom = tileBottom - ey;

          const minOverlapX = Math.min(overlapLeft, overlapRight);
          const minOverlapY = Math.min(overlapTop, overlapBottom);

          // Resolve along the axis of least penetration (sliding)
          if (minOverlapX < minOverlapY) {
            slideX += overlapLeft < overlapRight ? -minOverlapX : minOverlapX;
          } else {
            slideY += overlapTop < overlapBottom ? -minOverlapY : minOverlapY;
          }
        }
      }
    }

    // Apply slide with epsilon to prevent re-collision
    if (collided) {
      // Prefer the dominant slide axis
      if (Math.abs(slideX) > Math.abs(slideY)) {
        entity.x += slideX + (slideX > 0 ? SLIDE_CORRECTION_EPSILON : -SLIDE_CORRECTION_EPSILON);
      } else if (Math.abs(slideY) > Math.abs(slideX)) {
        entity.y += slideY + (slideY > 0 ? SLIDE_CORRECTION_EPSILON : -SLIDE_CORRECTION_EPSILON);
      } else {
        // Equal penetration on both axes: apply both (corner case)
        entity.x += slideX + (slideX > 0 ? SLIDE_CORRECTION_EPSILON : -SLIDE_CORRECTION_EPSILON);
        entity.y += slideY + (slideY > 0 ? SLIDE_CORRECTION_EPSILON : -SLIDE_CORRECTION_EPSILON);
      }
    }

    return { collided, slideX, slideY };
  }

  // ============================================================
  // UTILITY QUERIES
  // ============================================================

  /**
   * @description Returns all entities within a circular area.
   * @param {number} x - Center X in world pixels
   * @param {number} y - Center Y in world pixels
   * @param {number} radius - Query radius in pixels
   * @returns {Array<Object>} Array of entity objects (not collision bodies)
   */
  queryRadius(x, y, radius) {
    const candidates = this._spatialHash.queryCircle(x, y, radius);
    const results = [];
    const seen = new Set();

    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);

      // Distance check for precision
      const dx = (candidate.x + (candidate.width ?? 0) * 0.5) - x;
      const dy = (candidate.y + (candidate.height ?? 0) * 0.5) - y;
      if (dx * dx + dy * dy <= radius * radius) {
        results.push(candidate);
      }
    }

    return results;
  }

  /**
   * @description Returns all entities whose AABB intersects the query AABB.
   * @param {number} x - Left edge
   * @param {number} y - Top edge
   * @param {number} width - AABB width
   * @param {number} height - AABB height
   * @returns {Array<Object>} Array of entity objects
   */
  queryAABB(x, y, width, height) {
    return this._spatialHash.queryAABB(x, y, width, height);
  }

  /**
   * @description Returns all entities at a point.
   * @param {number} x - World X
   * @param {number} y - World Y
   * @returns {Array<Object>} Array of entity objects
   */
  queryPoint(x, y) {
    return this._spatialHash.queryPoint(x, y);
  }

  /**
   * @description Checks if a world position is inside any portal zone.
   * @param {number} x - World X
   * @param {number} y - World Y
   * @returns {{portalId: string, portal: Object}|null}
   */
  getPortalAt(x, y) {
    for (const portal of this._portals.values()) {
      if (x >= portal.x && x <= portal.x + portal.width && y >= portal.y && y <= portal.y + portal.height) {
        return { portalId: portal.portalId, portal };
      }
    }
    return null;
  }

  /**
   * @description Checks if a world position is inside any social zone.
   * @param {number} x - World X
   * @param {number} y - World Y
   * @returns {Array<{zoneId: string, zone: Object}>}
   */
  getSocialZonesAt(x, y) {
    const results = [];
    for (const zone of this._socialZones.values()) {
      if (x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height) {
        results.push({ zoneId: zone.zoneId, zone });
      }
    }
    return results;
  }

  /**
   * @description Returns which social zones an entity is currently in.
   * @param {string} entityId
   * @returns {Array<string>} Array of zone IDs
   */
  getEntityZones(entityId) {
    const zones = this._entitySocialZones.get(entityId);
    return zones ? Array.from(zones) : [];
  }

  // ============================================================
  // DEBUG VISUALIZATION
  // ============================================================

  /**
   * @description Toggles debug visualization on/off.
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * @description Renders debug visualization of collision shapes, spatial hash, portals, and zones.
   * @param {CanvasRenderingContext2D} [ctx] - Optional context to draw on
   */
  drawDebug(ctx) {
    if (!this.debug) return;

    const context = ctx || this._debugCtx || this.game.canvas?.getContext('2d');
    if (!context) return;

    context.save();

    // Apply camera transform if available
    if (this.game.camera) {
      const cam = this.game.camera;
      context.scale(cam.zoom, cam.zoom);
      context.translate(-cam.x, -cam.y);
    }

    try {
      // Draw spatial hash grid
      this._drawDebugSpatialHash(context);

      // Draw entity collision shapes
      this._drawDebugEntityShapes(context);

      // Draw portal zones
      this._drawDebugPortals(context);

      // Draw social zones
      this._drawDebugSocialZones(context);
    } catch (err) {
      console.error('CollisionSystem.drawDebug error:', err);
    }

    context.restore();
  }

  /**
   * @description Draws the spatial hash grid overlay.
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawDebugSpatialHash(ctx) {
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.2)';
    ctx.lineWidth = 1;

    // Draw visible cells based on camera
    let startX = 0;
    let startY = 0;
    let endX = this.game.width * 2;
    let endY = this.game.height * 2;

    if (this.game.camera) {
      startX = this.game.camera.x;
      startY = this.game.camera.y;
      endX = startX + this.game.width / this.game.camera.zoom;
      endY = startY + this.game.height / this.game.camera.zoom;
    }

    const cellStartX = Math.floor(startX / this.cellSize) * this.cellSize;
    const cellStartY = Math.floor(startY / this.cellSize) * this.cellSize;

    for (let x = cellStartX; x < endX; x += this.cellSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    for (let y = cellStartY; y < endY; y += this.cellSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }

    // Highlight populated cells
    ctx.fillStyle = 'rgba(255, 255, 0, 0.08)';
    for (const [key, cell] of this._spatialHash.cells) {
      if (cell.size === 0) continue;
      const [cx, cy] = key.split(',').map(Number);
      const px = cx * this.cellSize;
      const py = cy * this.cellSize;
      ctx.fillRect(px, py, this.cellSize, this.cellSize);

      // Entity count in cell
      ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
      ctx.font = '10px monospace';
      ctx.fillText(`${cell.size}`, px + 2, py + 12);
      ctx.fillStyle = 'rgba(255, 255, 0, 0.08)';
    }
  }

  /**
   * @description Draws collision shapes for all registered entities.
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawDebugEntityShapes(ctx) {
    for (const body of this._entities.values()) {
      const entity = body.entity;
      const shape = body.shape;

      // Color by response type
      switch (body.response) {
        case COLLISION_RESPONSE.BLOCK:
          ctx.strokeStyle = body.isTrigger ? 'rgba(0, 255, 255, 0.5)' : 'rgba(0, 255, 100, 0.7)';
          break;
        case COLLISION_RESPONSE.BOUNCE:
          ctx.strokeStyle = 'rgba(255, 165, 0, 0.7)';
          break;
        case COLLISION_RESPONSE.TRIGGER:
          ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
          break;
        case COLLISION_RESPONSE.ONE_WAY:
          ctx.strokeStyle = 'rgba(200, 100, 255, 0.7)';
          break;
        default:
          ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
      }

      ctx.lineWidth = 2;

      if (shape.type === 'circle') {
        const cx = entity.x + shape.offsetX;
        const cy = entity.y + shape.offsetY;
        ctx.beginPath();
        ctx.arc(cx, cy, shape.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Fill with low opacity
        ctx.fillStyle = ctx.strokeStyle.replace(/[\d.]+\)$/, '0.1)');
        ctx.fill();

        // Draw radius line
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + shape.radius, cy);
        ctx.stroke();
      } else if (shape.type === 'aabb') {
        const ax = entity.x + shape.offsetX;
        const ay = entity.y + shape.offsetY;
        ctx.strokeRect(ax, ay, shape.width, shape.height);

        // Fill with low opacity
        ctx.fillStyle = ctx.strokeStyle.replace(/[\d.]+\)$/, '0.1)');
        ctx.fillRect(ax, ay, shape.width, shape.height);
      }

      // Draw entity ID label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '9px monospace';
      ctx.fillText(body.id, entity.x, entity.y - 4);
    }
  }

  /**
   * @description Draws portal zone overlays.
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawDebugPortals(ctx) {
    for (const portal of this._portals.values()) {
      // Portal zone rectangle
      ctx.fillStyle = 'rgba(150, 50, 255, 0.15)';
      ctx.fillRect(portal.x, portal.y, portal.width, portal.height);
      ctx.strokeStyle = 'rgba(180, 100, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(portal.x, portal.y, portal.width, portal.height);
      ctx.setLineDash([]);

      // Portal label
      ctx.fillStyle = 'rgba(220, 180, 255, 0.9)';
      ctx.font = 'bold 11px sans-serif';
      const label = `PORTAL: ${portal.portalId}`;
      ctx.fillText(label, portal.x + 4, portal.y + 14);

      // Destination info
      ctx.fillStyle = 'rgba(200, 160, 255, 0.7)';
      ctx.font = '9px monospace';
      ctx.fillText(
        `to: ${portal.targetArea} (${Math.round(portal.targetX)}, ${Math.round(portal.targetY)})`,
        portal.x + 4,
        portal.y + 26
      );

      if (portal.oneWay) {
        ctx.fillStyle = 'rgba(255, 200, 100, 0.8)';
        ctx.fillText('[ONE-WAY]', portal.x + 4, portal.y + 38);
      }
    }
  }

  /**
   * @description Draws social zone overlays.
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawDebugSocialZones(ctx) {
    for (const zone of this._socialZones.values()) {
      let fillColor, strokeColor;

      if (zone.isStair) {
        fillColor = 'rgba(100, 100, 100, 0.12)';
        strokeColor = 'rgba(150, 150, 150, 0.5)';
      } else {
        // Different color per zone type
        switch (zone.zoneType) {
          case 'dance_floor':
            fillColor = 'rgba(255, 50, 150, 0.12)';
            strokeColor = 'rgba(255, 80, 180, 0.5)';
            break;
          case 'seating':
            fillColor = 'rgba(50, 150, 255, 0.12)';
            strokeColor = 'rgba(80, 180, 255, 0.5)';
            break;
          case 'photo_spot':
            fillColor = 'rgba(255, 200, 50, 0.12)';
            strokeColor = 'rgba(255, 220, 80, 0.5)';
            break;
          default:
            fillColor = 'rgba(100, 255, 100, 0.1)';
            strokeColor = 'rgba(100, 255, 100, 0.4)';
        }
      }

      ctx.fillStyle = fillColor;
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
      ctx.setLineDash([]);

      // Zone label
      const label = zone.isStair ? `STAIRS: ${zone.metadata?.stairId ?? ''}` : `${zone.zoneType}: ${zone.zoneId}`;
      ctx.fillStyle = strokeColor.replace(/[\d.]+\)$/, '0.9)');
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(label, zone.x + 4, zone.y + 14);

      // Occupant count
      let occupantCount = 0;
      for (const zones of this._entitySocialZones.values()) {
        if (zones.has(zone.zoneId)) occupantCount++;
      }
      if (occupantCount > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '9px monospace';
        ctx.fillText(`occupants: ${occupantCount}`, zone.x + 4, zone.y + 26);
      }
    }
  }

  // ============================================================
  // STATISTICS & CLEANUP
  // ============================================================

  /**
   * @description Returns statistics about the collision system state.
   * @returns {{
   *   entityCount: number,
   *   spatialHashCells: number,
   *   portalCount: number,
   *   socialZoneCount: number,
   *   stairEntityCount: number,
   *   avgEntitiesPerCell: number
   * }}
   */
  getStats() {
    const spatialStats = this._spatialHash.getStats();
    return {
      entityCount: this._entities.size,
      spatialHashCells: spatialStats.cellCount,
      portalCount: this._portals.size,
      socialZoneCount: this._socialZones.size,
      stairEntityCount: this._stairEntities.size,
      avgEntitiesPerCell: spatialStats.avgEntitiesPerCell,
    };
  }

  /**
   * @description Clears all registered entities, portals, and zones.
   */
  clearAll() {
    this._entities.clear();
    this._spatialHash.clear();
    this._portals.clear();
    this._socialZones.clear();
    this._entitySocialZones.clear();
    this._portalCooldowns.clear();
    this._stairEntities.clear();
    this._frameCount = 0;
  }

  /**
   * @description Destroys the collision system and cleans up all resources.
   */
  destroy() {
    this.clearAll();
    this._debugCtx = null;
    this.debugCanvas = null;
    this.game = null;
    this.onPortalEnter = null;
    this.onZoneEnter = null;
    this.onZoneExit = null;
    this.onCollision = null;
  }
}
