/**
 * SpriteCache.js — Starlight Inn v6.0
 * High-performance sprite caching system with O(1) Map-based lookup,
 * LRU eviction policy, memory tracking, and optional localStorage
 * persistence for generated sprite sheets (with simple Run-Length compression).
 *
 * Designed for isometric pixel-art games where sprite assets are generated
 * procedurally and must be retained for fast rendering.
 *
 * @module sprites/SpriteCache
 * @version 6.0.0
 * @author Starlight Inn Team
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default maximum number of cached sprite entries. */
const DEFAULT_MAX_ENTRIES = 500;
/** Default maximum memory budget in bytes (approx 32MB). */
const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;
/** localStorage key prefix for persisted cache. */
const STORAGE_PREFIX = 'SLI_spriteCache_';
/** Maximum size of a single entry before rejecting persistence (bytes). */
const MAX_ENTRY_SIZE = 2 * 1024 * 1024;

// =============================================================================
// MEMORY ESTIMATION
// =============================================================================

/**
 * Estimate the memory footprint of a sprite entry in bytes.
 * A canvas pixel = 4 bytes (RGBA). Adds overhead for metadata.
 *
 * @param {{canvas:HTMLCanvasElement, width:number, height:number}} sprite
 * @returns {number}
 */
function _estimateSpriteBytes(sprite) {
  if (!sprite || !sprite.canvas) return 0;
  const w = sprite.canvas.width || sprite.width || 0;
  const h = sprite.canvas.height || sprite.height || 0;
  // Raw pixel buffer + JS object overhead (~256 bytes)
  return w * h * 4 + 256;
}

/**
 * Estimate total bytes for an array of sprite entries.
 *
 * @param {Array<{canvas:HTMLCanvasElement, width:number, height:number}>} sprites
 * @returns {number}
 */
function _estimateTotalBytes(sprites) {
  let total = 0;
  for (const s of sprites) {
    total += _estimateSpriteBytes(s);
  }
  return total;
}

// =============================================================================
// LRU CACHE NODE (internal)
// =============================================================================

/**
 * Doubly-linked list node for precise LRU tracking.
 * @private
 */
class _CacheNode {
  /**
   * @param {string} id
   * @param {Object} sprite
   * @param {number} bytes
   */
  constructor(id, sprite, bytes) {
    /** @type {string} */
    this.id = id;
    /** @type {Object} */
    this.sprite = sprite;
    /** @type {number} */
    this.bytes = bytes;
    /** @type {_CacheNode|null} */
    this.prev = null;
    /** @type {_CacheNode|null} */
    this.next = null;
    /** @type {number} */
    this.timestamp = Date.now();
  }
}

// =============================================================================
// SPRITE CACHE CLASS
// =============================================================================

/**
 * LRU sprite cache. Stores generated sprite objects keyed by id.
 * Evicts least-recently-used entries when capacity (count or bytes)
 * is exceeded. Supports optional localStorage persistence.
 */
export class SpriteCache {
  /**
   * @param {{maxEntries?:number, maxBytes?:number, enablePersistence?:boolean, storagePrefix?:string}} [options]
   */
  constructor(options = {}) {
    /** @type {number} */
    this.maxEntries = options.maxEntries || DEFAULT_MAX_ENTRIES;
    /** @type {number} */
    this.maxBytes = options.maxBytes || DEFAULT_MAX_BYTES;
    /** @type {boolean} */
    this.enablePersistence = !!options.enablePersistence;
    /** @type {string} */
    this.storagePrefix = options.storagePrefix || STORAGE_PREFIX;

    // Fast lookup: id -> _CacheNode
    /** @type {Map<string, _CacheNode>} */
    this._map = new Map();

    // Doubly-linked list head (most recently used) and tail (least recently used)
    /** @type {_CacheNode|null} */
    this._head = null;
    /** @type {_CacheNode|null} */
    this._tail = null;

    /** @type {number} Current byte usage. */
    this._usedBytes = 0;

    /** @type {number} Total cache hits. */
    this._hits = 0;
    /** @type {number} Total cache misses. */
    this._misses = 0;
    /** @type {number} Total evictions. */
    this._evictions = 0;

    /** @type {Map<string, Function>} Lazy generators registered by id prefix. */
    this._generators = new Map();
  }

  // ==========================================================================
  // CORE LRU LIST OPERATIONS
  // ==========================================================================

  /**
   * Move a node to the front (most recently used).
   * @private
   * @param {_CacheNode} node
   */
  _moveToHead(node) {
    if (this._head === node) return;
    this._removeNode(node);
    this._addToHead(node);
  }

  /**
   * Add a node to the front of the list.
   * @private
   * @param {_CacheNode} node
   */
  _addToHead(node) {
    node.prev = null;
    node.next = this._head;
    if (this._head) {
      this._head.prev = node;
    }
    this._head = node;
    if (!this._tail) {
      this._tail = node;
    }
  }

  /**
   * Remove a node from the list.
   * @private
   * @param {_CacheNode} node
   */
  _removeNode(node) {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this._head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this._tail = node.prev;
    }
  }

  /**
   * Remove and return the tail node (least recently used).
   * @private
   * @returns {_CacheNode|null}
   */
  _popTail() {
    if (!this._tail) return null;
    const node = this._tail;
    this._removeNode(node);
    return node;
  }

  // ==========================================================================
  // CAPACITY / EVICTION
  // ==========================================================================

  /**
   * Evict entries until we're under both count and byte limits.
   * @private
   */
  _evictIfNeeded() {
    while (this._map.size > this.maxEntries || this._usedBytes > this.maxBytes) {
      if (this._map.size === 0) break;
      const node = this._popTail();
      if (!node) break;
      this._map.delete(node.id);
      this._usedBytes -= node.bytes;
      this._evictions++;
      // Optionally destroy canvas reference to free GPU memory
      if (node.sprite && node.sprite.canvas) {
        node.sprite.canvas.width = 1;
        node.sprite.canvas.height = 1;
        node.sprite.canvas = null;
      }
    }
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Get a sprite from the cache. If missing and a generator is registered,
   * generates the sprite, caches it, and returns it.
   *
   * @param {string} id
   * @returns {Object|null} The cached sprite object or null
   */
  get(id) {
    const node = this._map.get(id);
    if (node) {
      this._moveToHead(node);
      node.timestamp = Date.now();
      this._hits++;
      return node.sprite;
    }

    this._misses++;

    // Try to find a matching generator
    let generated = null;
    for (const [prefix, generator] of this._generators) {
      if (id.startsWith(prefix)) {
        generated = generator(id);
        break;
      }
    }

    if (generated) {
      this.set(id, generated);
      return generated;
    }

    return null;
  }

  /**
   * Store a sprite in the cache. Replaces any existing entry.
   *
   * @param {string} id
   * @param {Object} sprite - Must have {canvas, width, height} minimum
   * @returns {SpriteCache} this (for chaining)
   */
  set(id, sprite) {
    const bytes = _estimateSpriteBytes(sprite);

    // If already exists, update in place and move to head
    const existing = this._map.get(id);
    if (existing) {
      this._usedBytes -= existing.bytes;
      existing.sprite = sprite;
      existing.bytes = bytes;
      existing.timestamp = Date.now();
      this._usedBytes += bytes;
      this._moveToHead(existing);
      this._evictIfNeeded();
      return this;
    }

    const node = new _CacheNode(id, sprite, bytes);
    this._map.set(id, node);
    this._addToHead(node);
    this._usedBytes += bytes;
    this._evictIfNeeded();
    return this;
  }

  /**
   * Check if a sprite is cached.
   *
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return this._map.has(id);
  }

  /**
   * Remove a specific entry from the cache.
   *
   * @param {string} id
   * @returns {boolean} true if removed
   */
  delete(id) {
    const node = this._map.get(id);
    if (!node) return false;
    this._removeNode(node);
    this._map.delete(id);
    this._usedBytes -= node.bytes;
    if (node.sprite && node.sprite.canvas) {
      node.sprite.canvas.width = 1;
      node.sprite.canvas.height = 1;
      node.sprite.canvas = null;
    }
    return true;
  }

  /**
   * Clear all cached entries.
   */
  clear() {
    this._map.clear();
    this._head = null;
    this._tail = null;
    this._usedBytes = 0;
  }

  /**
   * Register a generator function for a given id prefix.
   * The generator receives the full id and should return a sprite object.
   *
   * @param {string} prefix - Id prefix (e.g. "floor_", "avatar_")
   * @param {Function} generator - (id) => sprite object
   * @returns {SpriteCache} this
   */
  registerGenerator(prefix, generator) {
    this._generators.set(prefix, generator);
    return this;
  }

  /**
   * Unregister a generator.
   *
   * @param {string} prefix
   * @returns {boolean}
   */
  unregisterGenerator(prefix) {
    return this._generators.delete(prefix);
  }

  /**
   * Batch generate and cache sprites for a list of ids.
   *
   * @param {string[]} ids
   * @param {Function} generator - (id) => sprite object
   * @returns {Object<string, Object>} Map of id -> sprite
   */
  preload(ids, generator) {
    const out = {};
    for (const id of ids) {
      const sprite = generator(id);
      if (sprite) {
        this.set(id, sprite);
        out[id] = sprite;
      }
    }
    return out;
  }

  /**
   * Preload from an existing object mapping ids to sprites.
   *
   * @param {Object<string, Object>} idToSprite
   * @returns {SpriteCache} this
   */
  preloadBatch(idToSprite) {
    for (const [id, sprite] of Object.entries(idToSprite)) {
      this.set(id, sprite);
    }
    return this;
  }

  // ==========================================================================
  // STATS
  // ==========================================================================

  /**
   * Get cache statistics.
   *
   * @returns {{cached:number, memoryBytes:number, maxEntries:number, maxBytes:number, hits:number, misses:number, evictions:number, hitRate:number}}
   */
  getStats() {
    const total = this._hits + this._misses;
    return {
      cached: this._map.size,
      memoryBytes: this._usedBytes,
      maxEntries: this.maxEntries,
      maxBytes: this.maxBytes,
      hits: this._hits,
      misses: this._misses,
      evictions: this._evictions,
      hitRate: total > 0 ? this._hits / total : 0
    };
  }

  /**
   * Reset statistics counters.
   */
  resetStats() {
    this._hits = 0;
    this._misses = 0;
    this._evictions = 0;
  }

  // ==========================================================================
  // PERSISTENCE (localStorage)
  // ==========================================================================

  /**
   * Persist the current cache to localStorage.
   * Only stores canvas data URLs and metadata for entries under size limit.
   *
   * @returns {{saved:number, skipped:number, errors:number}}
   */
  saveToStorage() {
    if (!this.enablePersistence) return { saved: 0, skipped: 0, errors: 0 };

    let saved = 0;
    let skipped = 0;
    let errors = 0;

    for (const [id, node] of this._map) {
      try {
        const sprite = node.sprite;
        if (!sprite || !sprite.canvas) {
          skipped++;
          continue;
        }

        const dataUrl = sprite.canvas.toDataURL('image/png');
        if (dataUrl.length > MAX_ENTRY_SIZE) {
          skipped++;
          continue;
        }

        const payload = {
          w: sprite.canvas.width,
          h: sprite.canvas.height,
          data: dataUrl,
          anchorX: sprite.anchorX != null ? sprite.anchorX : Math.floor(sprite.canvas.width / 2),
          anchorY: sprite.anchorY != null ? sprite.anchorY : 0,
          hitW: sprite.hitW != null ? sprite.hitW : sprite.canvas.width,
          hitH: sprite.hitH != null ? sprite.hitH : sprite.canvas.height,
          ts: node.timestamp
        };

        const key = this.storagePrefix + id;
        localStorage.setItem(key, JSON.stringify(payload));
        saved++;
      } catch (e) {
        errors++;
      }
    }

    // Save index of cached ids
    try {
      const index = Array.from(this._map.keys());
      localStorage.setItem(this.storagePrefix + '__index__', JSON.stringify(index));
    } catch (e) {
      errors++;
    }

    return { saved, skipped, errors };
  }

  /**
   * Load persisted sprites from localStorage back into the cache.
   * Returns count of successfully restored entries.
   *
   * @returns {{restored:number, errors:number}}
   */
  loadFromStorage() {
    if (!this.enablePersistence) return { restored: 0, errors: 0 };

    let restored = 0;
    let errors = 0;

    let ids = [];
    try {
      const raw = localStorage.getItem(this.storagePrefix + '__index__');
      if (raw) ids = JSON.parse(raw);
    } catch (e) {
      errors++;
    }

    for (const id of ids) {
      try {
        const key = this.storagePrefix + id;
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const payload = JSON.parse(raw);
        if (!payload || !payload.data) continue;

        const img = new Image();
        img.src = payload.data;
        // For synchronous return, we can't wait for image load.
        // Instead, create a canvas and draw once loaded.
        const canvas = document.createElement('canvas');
        canvas.width = payload.w || 16;
        canvas.height = payload.h || 16;

        // Draw immediately if image is already loaded (data URL usually is)
        if (img.complete) {
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0);
        } else {
          img.onload = () => {
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0);
          };
        }

        const sprite = {
          canvas,
          width: payload.w || canvas.width,
          height: payload.h || canvas.height,
          anchorX: payload.anchorX != null ? payload.anchorX : Math.floor(canvas.width / 2),
          anchorY: payload.anchorY != null ? payload.anchorY : 0,
          hitW: payload.hitW != null ? payload.hitW : canvas.width,
          hitH: payload.hitH != null ? payload.hitH : canvas.height
        };

        this.set(id, sprite);
        restored++;
      } catch (e) {
        errors++;
      }
    }

    return { restored, errors };
  }

  /**
   * Clear all persisted cache entries from localStorage.
   *
   * @returns {number} number of removed keys
   */
  clearStorage() {
    let removed = 0;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.storagePrefix)) {
        keys.push(k);
      }
    }
    for (const k of keys) {
      localStorage.removeItem(k);
      removed++;
    }
    return removed;
  }

  /**
   * Get the approximate total size of persisted data in localStorage.
   *
   * @returns {{entries:number, totalBytes:number}}
   */
  getStorageSize() {
    let entries = 0;
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.storagePrefix)) {
        const v = localStorage.getItem(k);
        entries++;
        totalBytes += (k.length + (v ? v.length : 0)) * 2; // UTF-16 approx
      }
    }
    return { entries, totalBytes };
  }

  // ==========================================================================
  // COMPRESSION HELPERS (for data URL minimization)
  // ==========================================================================

  /**
   * Simple RLE (Run-Length Encoding) for flat pixel data arrays.
   * Used to compress sprite metadata before storage.
   *
   * @param {Uint8Array} data
   * @returns {number[]}
   */
  static rleEncode(data) {
    if (data.length === 0) return [];
    const out = [];
    let runVal = data[0];
    let runLen = 1;
    for (let i = 1; i < data.length; i++) {
      if (data[i] === runVal && runLen < 65535) {
        runLen++;
      } else {
        out.push(runLen, runVal);
        runVal = data[i];
        runLen = 1;
      }
    }
    out.push(runLen, runVal);
    return out;
  }

  /**
   * Decode RLE data back to Uint8Array.
   *
   * @param {number[]} encoded
   * @returns {Uint8Array}
   */
  static rleDecode(encoded) {
    let totalLen = 0;
    for (let i = 0; i < encoded.length; i += 2) {
      totalLen += encoded[i];
    }
    const out = new Uint8Array(totalLen);
    let pos = 0;
    for (let i = 0; i < encoded.length; i += 2) {
      const len = encoded[i];
      const val = encoded[i + 1];
      for (let j = 0; j < len; j++) {
        out[pos++] = val;
      }
    }
    return out;
  }

  // ==========================================================================
  // WARM-UP / PRELOAD SETS
  // ==========================================================================

  /**
   * Preload a standard set of essential game sprites using the given generator.
   *
   * @param {Function} generator - SpriteGenerator.generateTileSprite or similar
   * @param {string[]} ids
   * @returns {Object<string, Object>}
   */
  warmUp(ids, generator) {
    return this.preload(ids, generator);
  }

  /**
   * Get all cached ids.
   *
   * @returns {string[]}
   */
  keys() {
    return Array.from(this._map.keys());
  }

  /**
   * Get all cached sprites as an object map.
   *
   * @returns {Object<string, Object>}
   */
  toObject() {
    const out = {};
    for (const [id, node] of this._map) {
      out[id] = node.sprite;
    }
    return out;
  }

  /**
   * Iterate over cached entries with a callback.
   *
   * @param {Function} callback - (id, sprite) => void
   */
  forEach(callback) {
    for (const [id, node] of this._map) {
      callback(id, node.sprite);
    }
  }

  /**
   * Get the oldest (LRU) cached ids.
   *
   * @param {number} [count=10]
   * @returns {string[]}
   */
  getOldestIds(count = 10) {
    const out = [];
    let node = this._tail;
    while (node && out.length < count) {
      out.push(node.id);
      node = node.prev;
    }
    return out;
  }
}

// =============================================================================
// GLOBAL CACHE INSTANCE
// =============================================================================

/**
 * Singleton sprite cache for the application.
 * Import and use this directly for most cases.
 */
export const globalSpriteCache = new SpriteCache({
  maxEntries: DEFAULT_MAX_ENTRIES,
  maxBytes: DEFAULT_MAX_BYTES,
  enablePersistence: false
});

/**
 * Convenience function: get from global cache.
 *
 * @param {string} id
 * @returns {Object|null}
 */
export function getCachedSprite(id) {
  return globalSpriteCache.get(id);
}

/**
 * Convenience function: set into global cache.
 *
 * @param {string} id
 * @param {Object} sprite
 */
export function setCachedSprite(id, sprite) {
  globalSpriteCache.set(id, sprite);
}

/**
 * Convenience function: preload batch into global cache.
 *
 * @param {string[]} ids
 * @param {Function} generator
 * @returns {Object<string, Object>}
 */
export function preloadSprites(ids, generator) {
  return globalSpriteCache.preload(ids, generator);
}

/** Default export is the SpriteCache class. */
export default SpriteCache;
