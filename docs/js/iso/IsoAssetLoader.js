/**
 * IsoAssetLoader.js — Starlight Inn v5.0
 * Asset loading, caching, and offscreen rendering pipeline for
 * isometric furniture and tile sprites.
 *
 * Each sprite is rendered once to an offscreen canvas at 2x resolution,
 * then drawn scaled-down for crisp pixel-art output.  The loader supports
 * reference-counted lifecycle management so sprites are auto-unloaded
 * when no longer needed.
 *
 * @module IsoAssetLoader
 * @version 5.0.0
 * @author Starlight Inn Team
 */

// ============================================================
// Constants
// ============================================================

/** Upscale factor for crisp pixel-art rendering. @type {number} */
const UPSCALE = 2;

/** Default sprite canvas width (will be expanded if needed). @type {number} */
const DEFAULT_SPRITE_W = 128;

/** Default sprite canvas height. @type {number} */
const DEFAULT_SPRITE_H = 128;

/** Maximum cache size before LRU eviction triggers. @type {number} */
const MAX_CACHE_ENTRIES = 256;

// ============================================================
// SpriteRecord — internal cached sprite data
// ============================================================

/**
 * @typedef {Object} SpriteRecord
 * @property {string} id
 * @property {HTMLCanvasElement} canvas
 * @property {CanvasRenderingContext2D} ctx
 * @property {number} width   — logical width (unscaled)
 * @property {number} height  — logical height (unscaled)
 * @property {number} anchorX — draw offset X (pixels, unscaled)
 * @property {number} anchorY — draw offset Y (pixels, unscaled)
 * @property {number} refcount
 * @property {number} lastUsed — timestamp ms
 * @property {number} memoryBytes
 */

// ============================================================
// IsoAssetLoader
// ============================================================

/**
 * Asset loader and cache manager for procedural isometric sprites.
 *
 * Usage:
 * ```js
 * const loader = new IsoAssetLoader(game);
 * loader.preload(FURNITURE_CATALOG);
 * const sprite = loader.getSprite('sofa');
 * ctx.drawImage(sprite.canvas, x - sprite.anchorX, y - sprite.anchorY,
 *               sprite.width, sprite.height);
 * loader.release('sofa');
 * ```
 */
export class IsoAssetLoader {
  /**
   * @param {Object} [game] — optional game reference for event emission
   */
  constructor(game = null) {
    /** @private @type {Map<string, SpriteRecord>} */
    this._cache = new Map();

    /** @private @type {Map<string, function(CanvasRenderingContext2D,number,number):void>} */
    this._drawFns = new Map();

    /** @private @type {Object|null} */
    this._game = game;

    /** @private @type {number} */
    this._totalLoaded = 0;

    /** @private @type {number} */
    this._totalEvicted = 0;

    /** @private @type {boolean} */
    this._debug = false;
  }

  // ----------------------------------------------------------
  // Public API — Loading
  // ----------------------------------------------------------

  /**
   * Register a sprite draw function.  The first time `getSprite` is called
   * for this ID, the draw function is executed on an offscreen canvas and
   * the result is cached.
   *
   * @param {string} id — unique sprite identifier
   * @param {function(CanvasRenderingContext2D,number,number):void} drawFn —
   *   function(ctx, width, height) that draws the sprite centred on the canvas
   * @param {{width?:number,height?:number,anchorX?:number,anchorY?:number}} [meta]
   */
  loadSprite(id, drawFn, meta = {}) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('Sprite ID must be a non-empty string');
    }
    if (typeof drawFn !== 'function') {
      throw new TypeError('Draw function must be a function');
    }

    this._drawFns.set(id, drawFn);

    // Pre-allocate the record with metadata so stats are accurate
    if (!this._cache.has(id)) {
      const logicalW = meta.width || DEFAULT_SPRITE_W;
      const logicalH = meta.height || DEFAULT_SPRITE_H;
      const anchorX = meta.anchorX ?? Math.floor(logicalW / 2);
      const anchorY = meta.anchorY ?? Math.floor(logicalH);

      /** @type {SpriteRecord} */
      const record = {
        id,
        canvas: null,
        ctx: null,
        width: logicalW,
        height: logicalH,
        anchorX,
        anchorY,
        refcount: 0,
        lastUsed: 0,
        memoryBytes: 0
      };
      this._cache.set(id, record);
    }

    if (this._debug) {
      console.log(`[IsoAssetLoader] Registered sprite "${id}"`);
    }
  }

  /**
   * Batch-load an array of furniture definitions (or any object with
   * `.id` and `.draw()`).  Each item's draw function is registered and
   * immediately baked into an offscreen canvas.
   *
   * @param {Array<{id:string, draw:Function, width?:number, height?:number}>} catalog
   * @returns {number} number of sprites processed
   */
  preload(catalog) {
    if (!Array.isArray(catalog)) {
      throw new TypeError('preload() expects an array');
    }

    let count = 0;
    for (const item of catalog) {
      if (!item || !item.id || typeof item.draw !== 'function') {
        if (this._debug) {
          console.warn('[IsoAssetLoader] Skipping invalid catalog entry', item);
        }
        continue;
      }

      const drawFn = (ctx, w, h) => {
        // Centre the item on the offscreen canvas
        item.draw(ctx, Math.floor(w / 2), h);
      };

      this.loadSprite(item.id, drawFn, {
        width: item.width ? item.width * 32 : DEFAULT_SPRITE_W,
        height: item.height ? item.height * 24 + 48 : DEFAULT_SPRITE_H,
        anchorX: Math.floor((item.width ? item.width * 32 : 64) / 2),
        anchorY: item.height ? item.height * 24 : 32
      });

      // Force immediate bake
      this._bake(item.id);
      count++;
    }

    this._emit('preload', { count, total: this._cache.size });
    return count;
  }

  /**
   * Register a raw draw function for a floor tile type.
   * The drawFn signature: (ctx, w, h) => void
   *
   * @param {string} type — floor type ID, e.g. 'wood_light'
   * @param {function(CanvasRenderingContext2D,number,number):void} drawFn
   */
  loadFloorSprite(type, drawFn) {
    this.loadSprite(`floor_${type}`, drawFn, {
      width: 64,
      height: 32,
      anchorX: 32,
      anchorY: 0
    });
  }

  /**
   * Register a raw draw function for a wall type.
   *
   * @param {string} type — wall type ID, e.g. 'wall_brick'
   * @param {function(CanvasRenderingContext2D,number,number):void} drawFn
   * @param {number} [wallHeight=24] — wall height in pixels
   */
  loadWallSprite(type, drawFn, wallHeight = 24) {
    this.loadSprite(`wall_${type}`, drawFn, {
      width: 64,
      height: 32 + wallHeight,
      anchorX: 32,
      anchorY: wallHeight
    });
  }

  // ----------------------------------------------------------
  // Public API — Retrieval
  // ----------------------------------------------------------

  /**
   * Retrieve a cached sprite.  If the sprite has not been baked yet,
   * it is rendered to an offscreen canvas on demand.
   *
   * The returned object contains the canvas and metadata needed to
   * draw it at the correct position:
   *
   * ```js
   * const s = loader.getSprite('sofa');
   * ctx.drawImage(s.canvas, screenX - s.anchorX, screenY - s.anchorY);
   * ```
   *
   * @param {string} id
   * @returns {SpriteRecord|null}
   */
  getSprite(id) {
    const record = this._cache.get(id);
    if (!record) {
      if (this._debug) {
        console.warn(`[IsoAssetLoader] Sprite "${id}" not found`);
      }
      return null;
    }

    // Lazy bake on first access
    if (!record.canvas) {
      this._bake(id);
    }

    record.lastUsed = performance.now();
    return record;
  }

  /**
   * Draw a cached sprite directly onto a destination context.
   * This is the most common call path — it handles positioning
   * and scaling automatically.
   *
   * @param {CanvasRenderingContext2D} dstCtx — destination 2D context
   * @param {string} id — sprite ID
   * @param {number} screenX — target screen X (anchor point)
   * @param {number} screenY — target screen Y (anchor point)
   * @param {number} [scale=1] — additional scale factor
   * @returns {boolean} true if drawn
   */
  drawSprite(dstCtx, id, screenX, screenY, scale = 1) {
    const sprite = this.getSprite(id);
    if (!sprite || !sprite.canvas) return false;

    const dw = sprite.width * scale;
    const dh = sprite.height * scale;
    const dx = screenX - sprite.anchorX * scale;
    const dy = screenY - sprite.anchorY * scale;

    dstCtx.drawImage(sprite.canvas, dx, dy, dw, dh);
    return true;
  }

  // ----------------------------------------------------------
  // Public API — Reference Counting
  // ----------------------------------------------------------

  /**
   * Increment the reference count for a sprite, preventing it from
   * being evicted by the LRU cache.
   *
   * @param {string} id
   */
  retain(id) {
    const record = this._cache.get(id);
    if (record) {
      record.refcount++;
      if (this._debug) {
        console.log(`[IsoAssetLoader] Retain "${id}" → refcount ${record.refcount}`);
      }
    }
  }

  /**
   * Decrement the reference count.  When the count reaches zero the
   * sprite is eligible for LRU eviction (though it is not immediately
   * removed — call `unload()` to force removal).
   *
   * @param {string} id
   */
  release(id) {
    const record = this._cache.get(id);
    if (record) {
      record.refcount = Math.max(0, record.refcount - 1);
      if (this._debug) {
        console.log(`[IsoAssetLoader] Release "${id}" → refcount ${record.refcount}`);
      }
      if (record.refcount === 0) {
        this._emit('evictable', { id });
      }
    }
  }

  // ----------------------------------------------------------
  // Public API — Cache Management
  // ----------------------------------------------------------

  /**
   * Remove a single sprite from the cache, freeing its canvas memory.
   *
   * @param {string} id
   * @returns {boolean} true if the sprite was cached and removed
   */
  unload(id) {
    const record = this._cache.get(id);
    if (!record) return false;

    if (record.refcount > 0) {
      if (this._debug) {
        console.warn(`[IsoAssetLoader] Unload "${id}" skipped: refcount=${record.refcount}`);
      }
      return false;
    }

    this._freeRecord(record);
    this._cache.delete(id);
    this._totalEvicted++;

    this._emit('unload', { id });
    return true;
  }

  /**
   * Remove all sprites with refcount === 0.  Retained sprites are preserved.
   */
  unloadUnused() {
    let freed = 0;
    for (const [id, record] of this._cache) {
      if (record.refcount === 0) {
        this._freeRecord(record);
        this._cache.delete(id);
        freed++;
      }
    }
    this._totalEvicted += freed;
    this._emit('unloadUnused', { freed });
    if (this._debug && freed > 0) {
      console.log(`[IsoAssetLoader] Unloaded ${freed} unused sprites`);
    }
  }

  /**
   * Clear the entire cache, including retained sprites.
   * Use with caution — this invalidates all existing SpriteRecords.
   */
  clearCache() {
    let freed = 0;
    for (const [, record] of this._cache) {
      this._freeRecord(record);
      freed++;
    }
    this._cache.clear();
    this._totalEvicted += freed;
    this._emit('clear', { freed });
    if (this._debug) {
      console.log(`[IsoAssetLoader] Cache cleared (${freed} sprites freed)`);
    }
  }

  /**
   * Run LRU eviction until the cache is under the max size.
   * Only entries with refcount === 0 are considered.
   *
   * @param {number} [maxSize=MAX_CACHE_ENTRIES]
   */
  evictLRU(maxSize = MAX_CACHE_ENTRIES) {
    while (this._cache.size > maxSize) {
      let oldest = null;
      let oldestTime = Infinity;

      for (const [id, record] of this._cache) {
        if (record.refcount === 0 && record.lastUsed < oldestTime) {
          oldestTime = record.lastUsed;
          oldest = id;
        }
      }

      if (oldest === null) break; // All retained, cannot evict
      this.unload(oldest);
    }
  }

  // ----------------------------------------------------------
  // Public API — Introspection
  // ----------------------------------------------------------

  /**
   * Get cache statistics.
   *
   * @returns {{loaded:number, total:number, memoryMB:number, retained:number}}
   */
  getCacheStats() {
    let memoryBytes = 0;
    let retained = 0;
    for (const [, record] of this._cache) {
      memoryBytes += record.memoryBytes;
      if (record.refcount > 0) retained++;
    }
    return {
      loaded: this._cache.size,
      total: this._drawFns.size,
      memoryMB: Math.round((memoryBytes / (1024 * 1024)) * 100) / 100,
      retained
    };
  }

  /**
   * Check whether a sprite ID is registered (not necessarily baked).
   *
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return this._cache.has(id) || this._drawFns.has(id);
  }

  /**
   * Check whether a sprite is already baked to an offscreen canvas.
   *
   * @param {string} id
   * @returns {boolean}
   */
  isBaked(id) {
    const record = this._cache.get(id);
    return !!(record && record.canvas);
  }

  /**
   * List all registered sprite IDs.
   * @returns {string[]}
   */
  ids() {
    return [...this._cache.keys()];
  }

  /**
   * Enable or disable debug logging.
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this._debug = !!enabled;
  }

  // ----------------------------------------------------------
  // Private — Baking
  // ----------------------------------------------------------

  /**
   * Render a registered draw function to an offscreen canvas at 2x scale.
   *
   * @private
   * @param {string} id
   */
  _bake(id) {
    const record = this._cache.get(id);
    const drawFn = this._drawFns.get(id);
    if (!record || !drawFn) return;

    const pixelW = record.width * UPSCALE;
    const pixelH = record.height * UPSCALE;

    // Reuse or create offscreen canvas
    if (!record.canvas) {
      record.canvas = document.createElement('canvas');
      record.ctx = record.canvas.getContext('2d');
    }

    record.canvas.width = pixelW;
    record.canvas.height = pixelH;

    const ctx = record.ctx;
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, pixelW, pixelH);

    // Scale for crisp pixel art
    ctx.save();
    ctx.scale(UPSCALE, UPSCALE);

    // Execute the procedural draw
    drawFn(ctx, record.width, record.height);

    ctx.restore();

    // Disable anti-aliasing when the canvas is drawn scaled-down
    // (This is set on the destination context, not the source)
    record.lastUsed = performance.now();
    record.memoryBytes = pixelW * pixelH * 4; // RGBA = 4 bytes per pixel
    this._totalLoaded++;

    if (this._debug) {
      console.log(
        `[IsoAssetLoader] Baked "${id}" (${record.width}x${record.height} → ${pixelW}x${pixelH})`
      );
    }

    this._emit('bake', { id, width: record.width, height: record.height });
  }

  // ----------------------------------------------------------
  // Private — Memory Management
  // ----------------------------------------------------------

  /**
   * Release canvas memory for a record.
   *
   * @private
   * @param {SpriteRecord} record
   */
  _freeRecord(record) {
    if (record.canvas) {
      record.canvas.width = 0;
      record.canvas.height = 0;
      record.canvas = null;
      record.ctx = null;
      record.memoryBytes = 0;
    }
  }

  // ----------------------------------------------------------
  // Private — Events
  // ----------------------------------------------------------

  /**
   * Emit an event on the game object if it has an event bus.
   *
   * @private
   * @param {string} event
   * @param {Object} data
   */
  _emit(event, data) {
    if (this._game && typeof this._game.emit === 'function') {
      this._game.emit(`asset:${event}`, data);
    }
  }
}

// ============================================================
// Convenience — Pre-baked Asset Loader
// ============================================================

/**
 * PrebakedAssetLoader extends IsoAssetLoader with synchronous
 * `getSprite` guarantees: all sprites are baked at construction
 * time (useful for small, fixed asset sets).
 */
export class PrebakedAssetLoader extends IsoAssetLoader {
  /**
   * @param {Array<{id:string, draw:Function}>} catalog
   * @param {Object} [game]
   */
  constructor(catalog, game = null) {
    super(game);
    if (catalog) {
      this.preload(catalog);
    }
  }
}

// ============================================================
// Singleton Accessor (optional shared instance)
// ============================================================

/** @type {IsoAssetLoader|null} */
let _shared = null;

/**
 * Get or create the shared asset loader instance.
 *
 * @param {Object} [game]
 * @returns {IsoAssetLoader}
 */
export function getSharedLoader(game = null) {
  if (!_shared) {
    _shared = new IsoAssetLoader(game);
  }
  return _shared;
}

/**
 * Reset the shared loader (destroys existing cache).
 */
export function resetSharedLoader() {
  if (_shared) {
    _shared.clearCache();
    _shared = null;
  }
}

// ============================================================
// JSDoc Type Exports (for IDE intellisense)
// ============================================================

/**
 * @typedef {SpriteRecord} CachedSprite
 */

/**
 * @typedef {Object} CacheStats
 * @property {number} loaded
 * @property {number} total
 * @property {number} memoryMB
 * @property {number} retained
 */

export default IsoAssetLoader;
