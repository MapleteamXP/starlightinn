/**
 * SpriteCache.js -- v6.0
 * LRU caching with localStorage persistence for generated sprites.
 */

export class SpriteCache {
  constructor(maxSize = 256) {
    this.maxSize = maxSize;
    this.cache = new Map(); // key -> { canvas, hits, timestamp }
    this._storageKey = 'starlight_sprite_cache_v6';
    this._loadFromStorage();
  }

  /**
   * Get a cached sprite by key.
   */
  get(key) {
    const entry = this.cache.get(key);
    if (entry) {
      entry.hits++;
      entry.timestamp = Date.now();
      this.cache.delete(key);
      this.cache.set(key, entry); // move to end (LRU)
      return entry.canvas;
    }
    return null;
  }

  /**
   * Store a canvas in the cache.
   */
  set(key, canvas) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (first in Map)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      canvas,
      hits: 1,
      timestamp: Date.now(),
    });
    this._saveToStorage();
  }

  /**
   * Check if a key is cached.
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Remove a single entry.
   */
  delete(key) {
    this.cache.delete(key);
    this._saveToStorage();
  }

  /**
   * Clear all cached entries.
   */
  clear() {
    this.cache.clear();
    this._saveToStorage();
  }

  /**
   * Current cache stats.
   */
  stats() {
    let totalHits = 0;
    for (const v of this.cache.values()) totalHits += v.hits;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalHits,
    };
  }

  /**
   * Build a deterministic cache key from descriptor.
   */
  static makeKey(type, id, palette, frame = 0) {
    const pal = Array.isArray(palette) ? palette.join(',') : String(palette);
    return `${type}:${id}:${pal}:${frame}`;
  }

  _saveToStorage() {
    try {
      const data = {};
      for (const [key, entry] of this.cache) {
        data[key] = { hits: entry.hits, timestamp: entry.timestamp };
      }
      localStorage.setItem(this._storageKey, JSON.stringify(data));
    } catch (e) {
      // Storage quota exceeded or private mode
    }
  }

  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        // Restore metadata only; canvases will be regenerated on demand
        for (const [key, meta] of Object.entries(data)) {
          this.cache.set(key, {
            canvas: null, // will be regenerated
            hits: meta.hits || 0,
            timestamp: meta.timestamp || Date.now(),
          });
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
}

export default SpriteCache;
