/**
 * @file IsoDepthSorter.js
 * @description Topological depth sort for isometric layering.
 *
 * In isometric projection, rendering order is critical for correct visual overlap.
 * The fundamental rule: objects with smaller (x + y) are drawn first (behind).
 * Within the same tile position, Z-layer determines order.
 *
 * Sort key formula: (tileX + tileY) * MAX_Z + zLayer
 *
 * Special cases handled:
 *   - Walls always render behind objects on the same tile
 *   - Entities are sorted dynamically each frame
 *   - Props with height offsets (on tables, shelves)
 *   - Multi-tile objects (doors, large furniture)
 *   - Stable sort preserves input order for same-depth items
 */

import { getSortKey, getSortKeyFloat, SORT_KEY_MULTIPLIER } from "./IsoMath.js";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Z-layer depth ranges for different object types */
export const Z_LAYER = Object.freeze({
  FLOOR: 0,      // Floor tiles
  FLOOR_DECAL: 10, // Floor decorations, rugs
  WALL_BASE: 20,   // Bottom of walls
  WALL_MID: 30,    // Mid wall section
  WALL_TOP: 40,    // Top of walls
  PROP_LOW: 50,    // Low props (floor lamps, plants)
  PROP_MID: 60,    // Mid props (chairs, tables)
  PROP_HIGH: 70,   // High props (on top of tables)
  ENTITY: 80,      // Players/NPCs
  EFFECT: 90,      // Particles, effects
  UI_OVERLAY: 100, // Debug/UI overlays
});

/** Object type categories for layering rules */
export const OBJECT_TYPE = Object.freeze({
  FLOOR: "floor",
  WALL: "wall",
  PROP: "prop",
  ENTITY: "entity",
  EFFECT: "effect",
});

/** Wall-facing direction for proper layering */
export const WALL_FACE = Object.freeze({
  NONE: 0,
  LEFT: 1,
  RIGHT: 2,
  BOTH: 3,
});

// =============================================================================
// PRIVATE HELPER FUNCTIONS
// =============================================================================

/**
 * Compute the sort key for a renderable object based on its type.
 *
 * @param {RenderObject} obj - Object to compute key for
 * @returns {number} Computed sort key
 * @private
 */
function _computeSortKey(obj) {
  const zLayer = _resolveZLayer(obj);

  // For entities with float positions, use the fine-grained sort key
  if (obj.type === OBJECT_TYPE.ENTITY && (typeof obj.x === "number") && !Number.isInteger(obj.x)) {
    return getSortKeyFloat(obj.x, obj.y, zLayer);
  }

  // Multi-tile objects: use the back-most (smallest x+y) tile for sorting
  if (obj.tiles && Array.isArray(obj.tiles) && obj.tiles.length > 1) {
    let minSum = Infinity;
    for (const tile of obj.tiles) {
      const sum = tile.x + tile.y;
      if (sum < minSum) minSum = sum;
    }
    return minSum * SORT_KEY_MULTIPLIER + zLayer;
  }

  return getSortKey(obj.x, obj.y, zLayer);
}

/**
 * Resolve the Z-layer for an object based on its type and properties.
 *
 * @param {RenderObject} obj - Object to resolve layer for
 * @returns {number} Z-layer value
 * @private
 */
function _resolveZLayer(obj) {
  // If the object already has an explicit zLayer, use it
  if (obj.zLayer !== undefined && obj.zLayer !== null) {
    return obj.zLayer;
  }

  switch (obj.type) {
    case OBJECT_TYPE.FLOOR:
      return obj.isDecal ? Z_LAYER.FLOOR_DECAL : Z_LAYER.FLOOR;

    case OBJECT_TYPE.WALL: {
      // Walls with face direction get adjusted layer
      if (obj.face === WALL_FACE.LEFT || obj.face === WALL_FACE.RIGHT) {
        return Z_LAYER.WALL_MID;
      }
      if (obj.face === WALL_FACE.BOTH) {
        return Z_LAYER.WALL_TOP;
      }
      return Z_LAYER.WALL_BASE;
    }

    case OBJECT_TYPE.PROP: {
      // Props on top of other props (e.g., items on tables)
      if (obj.heightOffset && obj.heightOffset > 0) {
        return Z_LAYER.PROP_HIGH + Math.min(obj.heightOffset, 9);
      }
      // Props with explicit height
      if (obj.height) {
        if (obj.height > 48) return Z_LAYER.PROP_HIGH;
        if (obj.height > 24) return Z_LAYER.PROP_MID;
        return Z_LAYER.PROP_LOW;
      }
      return Z_LAYER.PROP_MID;
    }

    case OBJECT_TYPE.ENTITY:
      return Z_LAYER.ENTITY;

    case OBJECT_TYPE.EFFECT:
      return Z_LAYER.EFFECT;

    default:
      return Z_LAYER.PROP_MID;
  }
}

/**
 * Resolve tile-breaking ties between objects at the same position.
 * Ensures walls behind props behind entities.
 *
 * @param {RenderObject} a - First object
 * @param {RenderObject} b - Second object
 * @returns {number} Tie-breaker comparison result
 * @private
 */
function _tieBreaker(a, b) {
  // Walls always behind everything else on the same tile
  if (a.type === OBJECT_TYPE.WALL && b.type !== OBJECT_TYPE.WALL) return -1;
  if (b.type === OBJECT_TYPE.WALL && a.type !== OBJECT_TYPE.WALL) return 1;

  // Floor always behind everything
  if (a.type === OBJECT_TYPE.FLOOR && b.type !== OBJECT_TYPE.FLOOR) return -1;
  if (b.type === OBJECT_TYPE.FLOOR && a.type !== OBJECT_TYPE.FLOOR) return 1;

  // Effects always on top
  if (a.type === OBJECT_TYPE.EFFECT && b.type !== OBJECT_TYPE.EFFECT) return 1;
  if (b.type === OBJECT_TYPE.EFFECT && a.type !== OBJECT_TYPE.EFFECT) return -1;

  // Entities behind high props if the entity is "below" the prop
  if (a.type === OBJECT_TYPE.ENTITY && b.type === OBJECT_TYPE.PROP && b.heightOffset > 0) {
    // Entity is on the floor, prop on table: entity draws first if at same base tile
    return -1;
  }
  if (b.type === OBJECT_TYPE.ENTITY && a.type === OBJECT_TYPE.PROP && a.heightOffset > 0) {
    return 1;
  }

  // General type ordering: floor < wall < prop < entity < effect
  const typeOrder = {
    [OBJECT_TYPE.FLOOR]: 0,
    [OBJECT_TYPE.WALL]: 1,
    [OBJECT_TYPE.PROP]: 2,
    [OBJECT_TYPE.ENTITY]: 3,
    [OBJECT_TYPE.EFFECT]: 4,
  };
  const orderA = typeOrder[a.type] ?? 2;
  const orderB = typeOrder[b.type] ?? 2;

  return orderA - orderB;
}

/**
 * Determine if two objects share the same base tile.
 *
 * @param {RenderObject} a - First object
 * @param {RenderObject} b - Second object
 * @returns {boolean} True if they share a tile
 * @private
 */
function _sharesTile(a, b) {
  if (a.x === b.x && a.y === b.y) return true;
  // Multi-tile overlap check
  if (a.tiles && b.tiles) {
    for (const ta of a.tiles) {
      for (const tb of b.tiles) {
        if (ta.x === tb.x && ta.y === tb.y) return true;
      }
    }
  }
  if (a.tiles) {
    for (const ta of a.tiles) {
      if (ta.x === b.x && ta.y === b.y) return true;
    }
  }
  if (b.tiles) {
    for (const tb of b.tiles) {
      if (a.x === tb.x && a.y === tb.y) return true;
    }
  }
  return false;
}

// =============================================================================
// ISO DEPTH SORTER CLASS
// =============================================================================

/**
 * Manages topological depth sorting for isometric renderables.
 * Optimized to only re-sort when entities move or objects change.
 */
export default class IsoDepthSorter {
  /**
   * Create a new IsoDepthSorter.
   */
  constructor() {
    /** @type {Array<RenderObject>} Static objects (floors, walls, props) */
    this._staticObjects = [];

    /** @type {Array<RenderObject>} Dynamic entities (players, NPCs) */
    this._dynamicEntities = [];

    /** @type {Array<RenderObject>} Effects (particles, temporary) */
    this._effects = [];

    /** @type {boolean} Whether the sort order needs recalculation */
    this._dirty = true;

    /** @type {number} Frame counter for dirty checks */
    this._frameCount = 0;

    /** @type {number} How often to force re-sort (every N frames) */
    this._forceSortInterval = 4;

    /** @type {Array<RenderObject>} Cached sorted output */
    this._cachedSorted = [];

    /** @type {number} Number of static objects last sorted */
    this._lastStaticCount = 0;

    /** @type {number} Number of dynamic entities last sorted */
    this._lastDynamicCount = 0;
  }

  // ---------------------------------------------------------------------------
  // STATIC OBJECT MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Add a static object (floor, wall, prop) to the sort list.
   * Static objects are assumed to not move frequently.
   *
   * @param {RenderObject} obj - Object to add with {type, x, y, [z], [object]} shape
   */
  addStaticObject(obj) {
    if (!obj || obj.x === undefined || obj.y === undefined) {
      console.warn("IsoDepthSorter: Invalid static object", obj);
      return;
    }
    this._staticObjects.push(obj);
    this._dirty = true;
  }

  /**
   * Remove a static object from the sort list.
   * Uses reference equality for matching.
   *
   * @param {RenderObject} obj - Object to remove
   */
  removeStaticObject(obj) {
    const idx = this._staticObjects.indexOf(obj);
    if (idx !== -1) {
      this._staticObjects.splice(idx, 1);
      this._dirty = true;
    }
  }

  /**
   * Remove all static objects of a given type.
   *
   * @param {string} type - Object type to clear (e.g., "floor", "wall")
   */
  clearStaticByType(type) {
    const before = this._staticObjects.length;
    this._staticObjects = this._staticObjects.filter(obj => obj.type !== type);
    if (this._staticObjects.length !== before) {
      this._dirty = true;
    }
  }

  /**
   * Remove all static objects.
   */
  clearStatic() {
    if (this._staticObjects.length > 0) {
      this._staticObjects = [];
      this._dirty = true;
    }
  }

  // ---------------------------------------------------------------------------
  // DYNAMIC ENTITY MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Add a dynamic entity (player, NPC) to the sort list.
   * Dynamic entities are re-sorted every frame by default.
   *
   * @param {RenderObject} entity - Entity to add with {type, x, y, [z], [object]} shape
   */
  addDynamicEntity(entity) {
    if (!entity || entity.x === undefined || entity.y === undefined) {
      console.warn("IsoDepthSorter: Invalid dynamic entity", entity);
      return;
    }
    this._dynamicEntities.push(entity);
    this._dirty = true;
  }

  /**
   * Remove a dynamic entity from the sort list.
   *
   * @param {RenderObject} entity - Entity to remove
   */
  removeDynamicEntity(entity) {
    const idx = this._dynamicEntities.indexOf(entity);
    if (idx !== -1) {
      this._dynamicEntities.splice(idx, 1);
      this._dirty = true;
    }
  }

  /**
   * Remove all dynamic entities.
   */
  clearDynamic() {
    if (this._dynamicEntities.length > 0) {
      this._dynamicEntities = [];
      this._dirty = true;
    }
  }

  // ---------------------------------------------------------------------------
  // EFFECTS
  // ---------------------------------------------------------------------------

  /**
   * Add a temporary effect to the sort list.
   *
   * @param {RenderObject} effect - Effect to add
   */
  addEffect(effect) {
    if (!effect) return;
    this._effects.push(effect);
    this._dirty = true;
  }

  /**
   * Remove a specific effect.
   *
   * @param {RenderObject} effect - Effect to remove
   */
  removeEffect(effect) {
    const idx = this._effects.indexOf(effect);
    if (idx !== -1) {
      this._effects.splice(idx, 1);
      this._dirty = true;
    }
  }

  /**
   * Clear all effects.
   */
  clearEffects() {
    if (this._effects.length > 0) {
      this._effects = [];
      this._dirty = true;
    }
  }

  // ---------------------------------------------------------------------------
  // DIRTY TRACKING
  // ---------------------------------------------------------------------------

  /**
   * Mark the sorter as dirty, forcing a re-sort on next sort() call.
   */
  markDirty() {
    this._dirty = true;
  }

  /**
   * Check if the sorter needs re-sorting.
   *
   * @returns {boolean} True if re-sort is needed
   */
  isDirty() {
    return this._dirty;
  }

  /**
   * Force re-sort on the next frame.
   * Alias for markDirty().
   */
  forceResort() {
    this._dirty = true;
  }

  // ---------------------------------------------------------------------------
  // CORE SORT
  // ---------------------------------------------------------------------------

  /**
   * Sort all renderable objects and return the ordered list.
   * Uses a stable sort to preserve input order for same-depth items.
   *
   * Optimization: only re-computes when dirty or when entity counts change.
   *
   * @returns {Array<RenderObject>} Sorted renderable objects
   */
  sort() {
    this._frameCount++;

    // Check if we can skip sorting
    const needsSort = this._dirty
      || this._staticObjects.length !== this._lastStaticCount
      || this._dynamicEntities.length !== this._lastDynamicCount
      || (this._frameCount % this._forceSortInterval) === 0;

    if (!needsSort && this._cachedSorted.length > 0) {
      return this._cachedSorted;
    }

    // Combine all renderables into a single working list
    /** @type {Array<RenderObject>} */
    const renderList = [];

    // Add static objects (pre-compute sort keys)
    for (let i = 0; i < this._staticObjects.length; i++) {
      const obj = this._staticObjects[i];
      const key = _computeSortKey(obj);
      renderList.push({ ...obj, sortKey: key, _index: i });
    }

    // Add dynamic entities (always recompute sort key)
    for (let i = 0; i < this._dynamicEntities.length; i++) {
      const ent = this._dynamicEntities[i];
      const key = _computeSortKey(ent);
      renderList.push({ ...ent, sortKey: key, _index: this._staticObjects.length + i });
    }

    // Add effects
    for (let i = 0; i < this._effects.length; i++) {
      const fx = this._effects[i];
      const key = _computeSortKey(fx);
      renderList.push({ ...fx, sortKey: key, _index: renderList.length + i });
    }

    // Stable sort by sort key using insertion sort for small lists, native for large
    if (renderList.length <= 1) {
      this._cachedSorted = renderList;
    } else if (renderList.length <= 32) {
      this._insertionSort(renderList);
      this._cachedSorted = renderList;
    } else {
      this._cachedSorted = this._stableNativeSort(renderList);
    }

    // Update tracking state
    this._dirty = false;
    this._lastStaticCount = this._staticObjects.length;
    this._lastDynamicCount = this._dynamicEntities.length;

    return this._cachedSorted;
  }

  /**
   * Sort a batch render list (one-shot sort, doesn't affect internal state).
   * Used for ad-hoc sorting of a specific set of objects.
   *
   * @param {Array<RenderObject>} renderList - Array of objects with {type, x, y, z, object}
   * @returns {Array<RenderObject>} Sorted array
   */
  sortBatch(renderList) {
    if (!renderList || renderList.length <= 1) {
      return renderList || [];
    }

    // Compute sort keys
    const keyed = renderList.map((obj, index) => ({
      ...obj,
      sortKey: _computeSortKey(obj),
      _index: index,
    }));

    return this._stableNativeSort(keyed);
  }

  // ---------------------------------------------------------------------------
  // SORTING ALGORITHMS
  // ---------------------------------------------------------------------------

  /**
   * Stable insertion sort for small arrays (O(n^2) but stable and low overhead).
   *
   * @param {Array<RenderObject>} arr - Array to sort in-place
   * @private
   */
  _insertionSort(arr) {
    for (let i = 1; i < arr.length; i++) {
      const key = arr[i];
      let j = i - 1;
      while (j >= 0 && (arr[j].sortKey > key.sortKey || (arr[j].sortKey === key.sortKey && _tieBreaker(arr[j], key) > 0))) {
        arr[j + 1] = arr[j];
        j--;
      }
      arr[j + 1] = key;
    }
  }

  /**
   * Stable sort using native sort with index tie-breaker.
   * Uses Schwartzian transform pattern for stability.
   *
   * @param {Array<RenderObject>} arr - Array to sort
   * @returns {Array<RenderObject>} Sorted array
   * @private
   */
  _stableNativeSort(arr) {
    return arr.sort((a, b) => {
      // Primary: sort key (lower = drawn first = behind)
      if (a.sortKey !== b.sortKey) {
        return a.sortKey - b.sortKey;
      }

      // Secondary: same-tile tie breaker
      if (_sharesTile(a, b)) {
        const tie = _tieBreaker(a, b);
        if (tie !== 0) return tie;
      }

      // Tertiary: stable sort by original index
      return a._index - b._index;
    });
  }

  // ---------------------------------------------------------------------------
  // UTILITY
  // ---------------------------------------------------------------------------

  /**
   * Get the total number of tracked objects.
   *
   * @returns {number} Total object count
   */
  getCount() {
    return this._staticObjects.length + this._dynamicEntities.length + this._effects.length;
  }

  /**
   * Get counts by category.
   *
   * @returns {{static: number, dynamic: number, effects: number}} Counts
   */
  getCounts() {
    return {
      static: this._staticObjects.length,
      dynamic: this._dynamicEntities.length,
      effects: this._effects.length,
    };
  }

  /**
   * Clear all tracked objects.
   */
  clearAll() {
    this._staticObjects = [];
    this._dynamicEntities = [];
    this._effects = [];
    this._cachedSorted = [];
    this._dirty = true;
    this._lastStaticCount = 0;
    this._lastDynamicCount = 0;
  }

  /**
   * Set how often to force re-sort regardless of dirty state.
   * Lower values = more frequent re-sorts (safer but slower).
   *
   * @param {number} interval - Frame interval for forced re-sort
   */
  setForceSortInterval(interval) {
    this._forceSortInterval = Math.max(1, interval);
  }
}

// Re-export Z_LAYER and OBJECT_TYPE as static properties for convenience
export { Z_LAYER, OBJECT_TYPE };

// ── Adapter class for main.js compatibility ──
export class IsoDepthSorter {
  constructor(isoMath) {
    this.iso = isoMath;
  }
  sort(objects) {
    return objects.sort((a, b) => {
      const ay = (a.y || a.tileY || 0) * 1000 + (a.x || a.tileX || 0);
      const by = (b.y || b.tileY || 0) * 1000 + (b.x || b.tileX || 0);
      return ay - by;
    });
  }
  getLayer(type) { return Z_LAYER[type] || Z_LAYER.DEFAULT; }
}
