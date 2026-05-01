/**
 * @file IsoChunk.js
 * @description Chunk-based room loading for large worlds in Starlight Inn v6.0.
 * Divides the infinite or large world into fixed-size chunks (default 20x20 tiles).
 * Only loads chunks around the player, unloads distant ones to manage memory.
 * Each chunk is a self-contained IsoTilemap segment with its own tile data.
 * Supports lazy loading, per-chunk serialization, and automatic chunk coordinate mapping.
 *
 * Chunk coordinate system: chunk (cx, cy) covers tiles from
 *   tx = cx * CHUNK_SIZE  ..  cx * CHUNK_SIZE + CHUNK_SIZE - 1
 *   ty = cy * CHUNK_SIZE  ..  cy * CHUNK_SIZE + CHUNK_SIZE - 1
 *
 * @module iso/IsoChunk
 */

import IsoTilemap from './IsoTilemap.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default chunk width/height in tiles. */
export const DEFAULT_CHUNK_SIZE = 20;

/** Default number of chunks to keep loaded around the player (radius). */
export const DEFAULT_LOAD_RADIUS = 2;

/** Maximum number of chunks to keep in memory at once. */
export const MAX_LOADED_CHUNKS = 64;

/** Minimum number of chunks to keep loaded even when distant. */
export const MIN_LOADED_CHUNKS = 4;

// =============================================================================
// CHUNK DATA STRUCTURE
// =============================================================================

/**
 * Create a new chunk data container.
 *
 * @param {number} cx - Chunk X coordinate.
 * @param {number} cy - Chunk Y coordinate.
 * @param {number} chunkSize - Size of chunk in tiles.
 * @returns {Chunk} Chunk data object.
 */
export function createChunk(cx, cy, chunkSize = DEFAULT_CHUNK_SIZE) {
  const tilemap = new IsoTilemap(`chunk_${cx}_${cy}`, chunkSize, chunkSize);
  return {
    cx,
    cy,
    chunkSize,
    tilemap,
    loadedAt: Date.now(),
    lastAccessed: Date.now(),
    modified: false,
    generation: 0,
  };
}

// =============================================================================
// IsoChunk CLASS
// =============================================================================

/**
 * Chunk-based tilemap manager for large or infinite isometric worlds.
 * Stores chunks in a Map keyed by `${cx},${cy}`. Automatically loads/unloads
 * chunks based on player position.
 */
export default class IsoChunk {
  /**
   * @param {number} [chunkSize=20] - Width and height of each chunk in tiles.
   * @param {number} [loadRadius=2] - How many chunks around the player to load.
   */
  constructor(chunkSize = DEFAULT_CHUNK_SIZE, loadRadius = DEFAULT_LOAD_RADIUS) {
    /** @type {number} Chunk width/height in tiles. */
    this.chunkSize = Math.max(4, Math.floor(chunkSize));

    /** @type {number} Radius of chunks to keep loaded around player. */
    this.loadRadius = Math.max(1, Math.floor(loadRadius));

    /** @type {Map<string, Chunk>} Loaded chunks keyed by `${cx},${cy}`. */
    this.chunks = new Map();

    /** @type {Map<string, Object>} Chunk generators keyed by area pattern. */
    this._generators = new Map();

    /** @type {Function|null} Global chunk generator fallback. */
    this._defaultGenerator = null;

    /** @type {number} Total chunk load/unload operations counter. */
    this.statsLoads = 0;

    /** @type {number} Total chunk unload operations counter. */
    this.statsUnloads = 0;

    /** @type {number} Current player chunk X (set by update). */
    this._playerChunkX = 0;

    /** @type {number} Current player chunk Y (set by update). */
    this._playerChunkY = 0;

    /** @type {Set<string>} Chunks marked for persistence (don't unload). */
    this._persistentChunks = new Set();

    /** @type {Object|null} Area data for static room chunks. */
    this._areaData = null;
  }

  // =============================================================================
  // CHUNK COORDINATE MATH
  // =============================================================================

  /**
   * Convert tile coordinates to chunk coordinates.
   *
   * @param {number} tx - Tile X.
   * @param {number} ty - Tile Y.
   * @returns {{cx:number, cy:number}} Chunk coordinates.
   */
  getChunkForTile(tx, ty) {
    const cx = Math.floor(tx / this.chunkSize);
    const cy = Math.floor(ty / this.chunkSize);
    return { cx, cy };
  }

  /**
   * Convert chunk coordinates to the top-left tile in that chunk.
   *
   * @param {number} cx - Chunk X.
   * @param {number} cy - Chunk Y.
   * @returns {{tx:number, ty:number}} Top-left tile coordinates.
   */
  getTileForChunk(cx, cy) {
    return {
      tx: cx * this.chunkSize,
      ty: cy * this.chunkSize,
    };
  }

  /**
   * Convert a local chunk tile index to global tile coordinates.
   *
   * @param {number} cx - Chunk X.
   * @param {number} cy - Chunk Y.
   * @param {number} localX - Local tile X within chunk (0..chunkSize-1).
   * @param {number} localY - Local tile Y within chunk (0..chunkSize-1).
   * @returns {{tx:number, ty:number}} Global tile coordinates.
   */
  localToGlobalTile(cx, cy, localX, localY) {
    return {
      tx: cx * this.chunkSize + localX,
      ty: cy * this.chunkSize + localY,
    };
  }

  /**
   * Convert global tile coordinates to local chunk tile indices.
   *
   * @param {number} tx - Global tile X.
   * @param {number} ty - Global tile Y.
   * @returns {{cx:number, cy:number, localX:number, localY:number}} Chunk + local coords.
   */
  globalToLocalTile(tx, ty) {
    const cx = Math.floor(tx / this.chunkSize);
    const cy = Math.floor(ty / this.chunkSize);
    return {
      cx,
      cy,
      localX: tx - cx * this.chunkSize,
      localY: ty - cy * this.chunkSize,
    };
  }

  // =============================================================================
  // CHUNK KEY HELPERS
  // =============================================================================

  /**
   * Build a chunk map key from coordinates.
   *
   * @param {number} cx - Chunk X.
   * @param {number} cy - Chunk Y.
   * @returns {string} Key string `${cx},${cy}`.
   * @private
   */
  _chunkKey(cx, cy) {
    return `${cx},${cy}`;
  }

  /**
   * Parse a chunk key back into coordinates.
   *
   * @param {string} key - Chunk key string.
   * @returns {{cx:number, cy:number}} Parsed coordinates.
   * @private
   */
  _parseChunkKey(key) {
    const parts = key.split(',');
    return {
      cx: parseInt(parts[0], 10),
      cy: parseInt(parts[1], 10),
    };
  }

  // =============================================================================
  // CHUNK LOADING / UNLOADING
  // =============================================================================

  /**
   * Load (or generate) a chunk at chunk coordinates.
   * If the chunk is already loaded, returns the existing chunk.
   *
   * @param {number} cx - Chunk X.
   * @param {number} cy - Chunk Y.
   * @returns {Chunk} The loaded chunk.
   */
  loadChunk(cx, cy) {
    const key = this._chunkKey(cx, cy);

    if (this.chunks.has(key)) {
      const chunk = this.chunks.get(key);
      chunk.lastAccessed = Date.now();
      return chunk;
    }

    const chunk = createChunk(cx, cy, this.chunkSize);

    // Attempt to populate from generator
    this._generateChunk(chunk, cx, cy);

    this.chunks.set(key, chunk);
    this.statsLoads++;

    return chunk;
  }

  /**
   * Unload a chunk from memory.
   * If the chunk is marked persistent, it will not be unloaded.
   *
   * @param {number} cx - Chunk X.
   * @param {number} cy - Chunk Y.
   * @returns {boolean} True if the chunk was unloaded.
   */
  unloadChunk(cx, cy) {
    const key = this._chunkKey(cx, cy);

    if (!this.chunks.has(key)) return false;
    if (this._persistentChunks.has(key)) return false;

    this.chunks.delete(key);
    this.statsUnloads++;
    return true;
  }

  /**
   * Check if a chunk is currently loaded.
   *
   * @param {number} cx - Chunk X.
   * @param {number} cy - Chunk Y.
   * @returns {boolean} True if loaded in memory.
   */
  isChunkLoaded(cx, cy) {
    return this.chunks.has(this._chunkKey(cx, cy));
  }

  /**
   * Get an already-loaded chunk without triggering a load.
   *
   * @param {number} cx - Chunk X.
   * @param {number} cy - Chunk Y.
   * @returns {Chunk|null} Chunk or null if not loaded.
   */
  getLoadedChunk(cx, cy) {
    const key = this._chunkKey(cx, cy);
    const chunk = this.chunks.get(key);
    if (chunk) {
      chunk.lastAccessed = Date.now();
    }
    return chunk || null;
  }

  /**
   * Get all currently loaded chunk coordinates.
   *
   * @returns {Array<{cx:number, cy:number}>} Array of loaded chunk coords.
   */
  getLoadedChunks() {
    const result = [];
    for (const key of this.chunks.keys()) {
      result.push(this._parseChunkKey(key));
    }
    return result;
  }

  /**
   * Get the count of currently loaded chunks.
   *
   * @returns {number} Loaded chunk count.
   */
  getLoadedChunkCount() {
    return this.chunks.size;
  }

  // =============================================================================
  // GENERATION
  // =============================================================================

  /**
   * Register a generator function for a specific chunk key pattern.
   *
   * @param {string} pattern - Pattern string or key prefix.
   * @param {Function} generator - Function(chunk, cx, cy) that populates tilemap.
   */
  registerGenerator(pattern, generator) {
    if (typeof generator === 'function') {
      this._generators.set(pattern, generator);
    }
  }

  /**
   * Set the default fallback generator.
   *
   * @param {Function} generator - Function(chunk, cx, cy) that populates tilemap.
   */
  setDefaultGenerator(generator) {
    this._defaultGenerator = typeof generator === 'function' ? generator : null;
  }

  /**
   * Generate tile data for a chunk using registered generators.
   *
   * @param {Chunk} chunk - The chunk to populate.
   * @param {number} cx - Chunk X.
   * @param {number} cy - Chunk Y.
   * @private
   */
  _generateChunk(chunk, cx, cy) {
    const key = this._chunkKey(cx, cy);
    let generated = false;

    // Try pattern-based generators
    for (const [pattern, generator] of this._generators) {
      if (key.startsWith(pattern) || pattern === '*' || pattern === key) {
        try {
          generator(chunk, cx, cy);
          generated = true;
        } catch (e) {
          console.error(`Chunk generator error for ${key}:`, e);
        }
      }
    }

    // Fallback to default generator
    if (!generated && this._defaultGenerator) {
      try {
        this._defaultGenerator(chunk, cx, cy);
      } catch (e) {
        console.error(`Default chunk generator error for ${key}:`, e);
      }
    }

    // If still not generated, fill with default tiles
    if (!generated && !this._defaultGenerator) {
      this._fillDefaultChunk(chunk, cx, cy);
    }

    chunk.generation++;
    chunk.modified = false;
  }

  /**
   * Fill a chunk with procedurally varied default tiles.
   *
   * @param {Chunk} chunk - Chunk to fill.
   * @param {number} cx - Chunk X.
   * @param {number} cy - Chunk Y.
   * @private
   */
  _fillDefaultChunk(chunk, cx, cy) {
    const tm = chunk.tilemap;
    const seed = Math.abs(cx * 374761393 + cy * 668265263);
    const types = ['grass', 'stone_gray', 'wood_light', 'dirt', 'snow'];
    const baseType = types[seed % types.length];

    for (let y = 0; y < this.chunkSize; y++) {
      for (let x = 0; x < this.chunkSize; x++) {
        const localSeed = seed + x * 23 + y * 41;
        const type = (localSeed % 7 === 0)
          ? types[(seed + 1) % types.length]
          : baseType;
        tm.setTile(x, y, { type, walkable: true, z: 0 });
      }
    }
  }

  // =============================================================================
  // TILE ACCESS (auto-load chunks)
  // =============================================================================

  /**
   * Get a tile from the appropriate chunk. Auto-loads the chunk if needed.
   *
   * @param {number} tx - Global tile X.
   * @param {number} ty - Global tile Y.
   * @returns {Tile|null} Tile data or null.
   */
  getTile(tx, ty) {
    const { cx, cy, localX, localY } = this.globalToLocalTile(tx, ty);
    const chunk = this.loadChunk(cx, cy);
    return chunk.tilemap.getTile(localX, localY);
  }

  /**
   * Set a tile in the appropriate chunk. Auto-loads the chunk if needed.
   *
   * @param {number} tx - Global tile X.
   * @param {number} ty - Global tile Y.
   * @param {Partial<Tile>} data - Tile data to set.
   * @returns {boolean} True if set successfully.
   */
  setTile(tx, ty, data) {
    const { cx, cy, localX, localY } = this.globalToLocalTile(tx, ty);
    const chunk = this.loadChunk(cx, cy);
    const success = chunk.tilemap.setTile(localX, localY, data);
    if (success) {
      chunk.modified = true;
    }
    return success;
  }

  /**
   * Check if a global tile is walkable. Auto-loads chunk if needed.
   *
   * @param {number} tx - Global tile X.
   * @param {number} ty - Global tile Y.
   * @returns {boolean} True if walkable.
   */
  isWalkable(tx, ty) {
    const { cx, cy, localX, localY } = this.globalToLocalTile(tx, ty);
    const chunk = this.loadChunk(cx, cy);
    return chunk.tilemap.isWalkable(localX, localY);
  }

  /**
   * Set walkability for a global tile. Auto-loads chunk if needed.
   *
   * @param {number} tx - Global tile X.
   * @param {number} ty - Global tile Y.
   * @param {boolean} walkable - Walkable state.
   * @returns {boolean} True if set.
   */
  setWalkable(tx, ty, walkable) {
    return this.setTile(tx, ty, { walkable });
  }

  /**
   * Occupy a global tile (mark as blocked by another entity).
   *
   * @param {number} tx - Global tile X.
   * @param {number} ty - Global tile Y.
   */
  occupyTile(tx, ty) {
    const { cx, cy, localX, localY } = this.globalToLocalTile(tx, ty);
    const chunk = this.loadChunk(cx, cy);
    chunk.tilemap.occupyTile(localX, localY);
  }

  /**
   * Release a global tile occupancy.
   *
   * @param {number} tx - Global tile X.
   * @param {number} ty - Global tile Y.
   */
  releaseTile(tx, ty) {
    const { cx, cy, localX, localY } = this.globalToLocalTile(tx, ty);
    const chunk = this.loadChunk(cx, cy);
    chunk.tilemap.releaseTile(localX, localY);
  }

  // =============================================================================
  // PATHFINDING ACROSS CHUNKS
  // =============================================================================

  /**
   * Find a path between two global tile coordinates.
   * Loads all chunks along the path as needed.
   *
   * @param {number} startX - Start global tile X.
   * @param {number} startY - Start global tile Y.
   * @param {number} endX - End global tile X.
   * @param {number} endY - End global tile Y.
   * @param {boolean} [allowDiagonal=true] - Allow diagonal movement.
   * @returns {Array<{x:number, y:number}>|null} Path or null.
   */
  findPath(startX, startY, endX, endY, allowDiagonal = true) {
    // Load start and end chunks to ensure they exist
    this.loadChunkForTile(startX, startY);
    this.loadChunkForTile(endX, endY);

    // A* implementation across chunks
    const openSet = new Map();
    const closedSet = new Set();
    const startKey = this._pathKey(startX, startY);

    const startNode = {
      x: startX,
      y: startY,
      g: 0,
      h: this._heuristic(startX, startY, endX, endY),
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openSet.set(startKey, startNode);

    let iterations = 0;
    const maxIter = MAX_A_STAR_ITERATIONS_CHUNK;
    const directions = allowDiagonal
      ? [
          { dx: 0, dy: -1, cost: 10 },
          { dx: 1, dy: 0, cost: 10 },
          { dx: 0, dy: 1, cost: 10 },
          { dx: -1, dy: 0, cost: 10 },
          { dx: 1, dy: -1, cost: 14 },
          { dx: 1, dy: 1, cost: 14 },
          { dx: -1, dy: 1, cost: 14 },
          { dx: -1, dy: -1, cost: 14 },
        ]
      : [
          { dx: 0, dy: -1, cost: 10 },
          { dx: 1, dy: 0, cost: 10 },
          { dx: 0, dy: 1, cost: 10 },
          { dx: -1, dy: 0, cost: 10 },
        ];

    while (openSet.size > 0 && iterations < maxIter) {
      iterations++;

      let current = null;
      let currentKey = '';
      let lowestF = Infinity;
      for (const [key, node] of openSet) {
        if (node.f < lowestF) {
          lowestF = node.f;
          current = node;
          currentKey = key;
        }
      }

      if (!current) break;

      if (current.x === endX && current.y === endY) {
        return this._reconstructPath(current);
      }

      openSet.delete(currentKey);
      closedSet.add(currentKey);

      for (const d of directions) {
        const nx = current.x + d.dx;
        const ny = current.y + d.dy;
        const nKey = this._pathKey(nx, ny);

        if (closedSet.has(nKey)) continue;
        if (!this.isWalkable(nx, ny)) continue;

        if (d.cost === 14) {
          if (!this.isWalkable(current.x + d.dx, current.y)) continue;
          if (!this.isWalkable(current.x, current.y + d.dy)) continue;
        }

        const g = current.g + d.cost;
        const existing = openSet.get(nKey);

        if (!existing || g < existing.g) {
          const h = this._heuristic(nx, ny, endX, endY);
          openSet.set(nKey, {
            x: nx,
            y: ny,
            g,
            h,
            f: g + h,
            parent: current,
          });
        }
      }
    }

    return null;
  }

  /** Maximum A* iterations for cross-chunk pathfinding. */
  _heuristic(x1, y1, x2, y2) {
    return (Math.abs(x1 - x2) + Math.abs(y1 - y2)) * 10;
  }

  /**
   * Pack global tile coordinates into a path key.
   *
   * @param {number} x - Global tile X.
   * @param {number} y - Global tile Y.
   * @returns {string} Path key.
   * @private
   */
  _pathKey(x, y) {
    return `${x},${y}`;
  }

  /**
   * Reconstruct a path from an A* node chain.
   *
   * @param {Object} node - Target node.
   * @returns {Array<{x:number, y:number}>} Reconstructed path.
   * @private
   */
  _reconstructPath(node) {
    const path = [];
    let current = node;
    while (current) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }
    return path;
  }

  // =============================================================================
  // LAZY LOADING UPDATE
  // =============================================================================

  /**
   * Update chunk loading based on player position.
   * Loads chunks within radius, unloads distant ones.
   *
   * @param {number} playerX - Player global tile X.
   * @param {number} playerY - Player global tile Y.
   */
  update(playerX, playerY) {
    const { cx: pcx, cy: pcy } = this.getChunkForTile(playerX, playerY);
    this._playerChunkX = pcx;
    this._playerChunkY = pcy;

    // Determine which chunks should be loaded
    const desiredKeys = new Set();
    for (let dy = -this.loadRadius; dy <= this.loadRadius; dy++) {
      for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
        const cx = pcx + dx;
        const cy = pcy + dy;
        desiredKeys.add(this._chunkKey(cx, cy));
      }
    }

    // Load missing chunks
    for (const key of desiredKeys) {
      if (!this.chunks.has(key)) {
        const { cx, cy } = this._parseChunkKey(key);
        this.loadChunk(cx, cy);
      }
    }

    // Unload chunks outside radius if over limit
    const keysToUnload = [];
    for (const [key, chunk] of this.chunks) {
      if (!desiredKeys.has(key) && !this._persistentChunks.has(key)) {
        const dist = Math.abs(chunk.cx - pcx) + Math.abs(chunk.cy - pcy);
        keysToUnload.push({ key, dist, lastAccessed: chunk.lastAccessed });
      }
    }

    // If we're over the max loaded limit, unload the most distant/least recently used
    const maxUnload = Math.max(0, this.chunks.size - MAX_LOADED_CHUNKS);
    if (maxUnload > 0 || keysToUnload.length > 0) {
      // Sort by distance (desc), then by lastAccessed (asc = oldest first)
      keysToUnload.sort((a, b) => {
        if (b.dist !== a.dist) return b.dist - a.dist;
        return a.lastAccessed - b.lastAccessed;
      });

      const toUnload = Math.min(keysToUnload.length, Math.max(maxUnload, keysToUnload.length));
      for (let i = 0; i < toUnload; i++) {
        const { cx, cy } = this._parseChunkKey(keysToUnload[i].key);
        this.unloadChunk(cx, cy);
      }
    }
  }

  /**
   * Force-load all chunks within a radius without waiting for update().
   *
   * @param {number} centerX - Center global tile X.
   * @param {number} centerY - Center global tile Y.
   * @param {number} [radius] - Radius in chunks (defaults to loadRadius).
   */
  preload(centerX, centerY, radius) {
    const r = radius ?? this.loadRadius;
    const { cx: pcx, cy: pcy } = this.getChunkForTile(centerX, centerY);

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        this.loadChunk(pcx + dx, pcy + dy);
      }
    }
  }

  /**
   * Load the chunk containing a specific tile.
   *
   * @param {number} tx - Global tile X.
   * @param {number} ty - Global tile Y.
   * @returns {Chunk} Loaded chunk.
   */
  loadChunkForTile(tx, ty) {
    const { cx, cy } = this.getChunkForTile(tx, ty);
    return this.loadChunk(cx, cy);
  }

  // =============================================================================
  // PERSISTENCE
  // =============================================================================

  /**
   * Mark a chunk as persistent (never auto-unload).
   *
   * @param {number} cx - Chunk X.
   * @param {number} cy - Chunk Y.
   * @param {boolean} [persistent=true] - Persistence state.
   */
  setChunkPersistent(cx, cy, persistent = true) {
    const key = this._chunkKey(cx, cy);
    if (persistent) {
      this._persistentChunks.add(key);
    } else {
      this._persistentChunks.delete(key);
    }
  }

  /**
   * Check if a chunk is marked persistent.
   *
   * @param {number} cx - Chunk X.
   * @param {number} cy - Chunk Y.
   * @returns {boolean} True if persistent.
   */
  isChunkPersistent(cx, cy) {
    return this._persistentChunks.has(this._chunkKey(cx, cy));
  }

  // =============================================================================
  // SERIALIZATION
  // =============================================================================

  /**
   * Serialize all loaded chunks into a single save object.
   * Only modified chunks are fully serialized; others are stored by reference.
   *
   * @returns {Object} Serialized chunk world data.
   */
  serialize() {
    const chunkData = [];
    for (const [key, chunk] of this.chunks) {
      chunkData.push({
        key,
        cx: chunk.cx,
        cy: chunk.cy,
        modified: chunk.modified,
        generation: chunk.generation,
        tilemap: chunk.tilemap.serialize(),
      });
    }

    return {
      version: 1,
      chunkSize: this.chunkSize,
      loadRadius: this.loadRadius,
      chunks: chunkData,
      persistentChunks: Array.from(this._persistentChunks),
    };
  }

  /**
   * Deserialize chunk world data and restore all chunks.
   *
   * @param {Object} data - Serialized chunk world data.
   * @returns {boolean} True if deserialized successfully.
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.chunks || !Array.isArray(data.chunks)) return false;

    this.chunkSize = data.chunkSize || DEFAULT_CHUNK_SIZE;
    this.loadRadius = data.loadRadius || DEFAULT_LOAD_RADIUS;
    this.chunks.clear();
    this._persistentChunks.clear();

    for (const entry of data.chunks) {
      const chunk = createChunk(entry.cx, entry.cy, this.chunkSize);
      chunk.modified = entry.modified || false;
      chunk.generation = entry.generation || 0;

      if (entry.tilemap) {
        chunk.tilemap.deserialize(entry.tilemap);
      }

      const key = this._chunkKey(entry.cx, entry.cy);
      this.chunks.set(key, chunk);
    }

    if (data.persistentChunks && Array.isArray(data.persistentChunks)) {
      for (const key of data.persistentChunks) {
        this._persistentChunks.add(key);
      }
    }

    return true;
  }

  /**
   * Serialize only modified chunks (for incremental saves).
   *
   * @returns {Object} Incremental save data.
   */
  serializeModified() {
    const chunkData = [];
    for (const [key, chunk] of this.chunks) {
      if (chunk.modified) {
        chunkData.push({
          key,
          cx: chunk.cx,
          cy: chunk.cy,
          tilemap: chunk.tilemap.serialize(),
        });
      }
    }

    return {
      version: 1,
      chunkSize: this.chunkSize,
      chunks: chunkData,
    };
  }

  /**
   * Serialize a single chunk by coordinates.
   *
   * @param {number} cx - Chunk X.
   * @param {number} cy - Chunk Y.
   * @returns {Object|null} Serialized chunk or null.
   */
  serializeChunk(cx, cy) {
    const chunk = this.getLoadedChunk(cx, cy);
    if (!chunk) return null;
    return {
      cx,
      cy,
      chunkSize: this.chunkSize,
      tilemap: chunk.tilemap.serialize(),
    };
  }

  /**
   * Deserialize a single chunk and load it.
   *
   * @param {Object} data - Serialized chunk data.
   * @returns {boolean} True if loaded.
   */
  deserializeChunk(data) {
    if (!data || !data.tilemap) return false;
    const cx = data.cx;
    const cy = data.cy;
    const chunk = createChunk(cx, cy, data.chunkSize || this.chunkSize);
    chunk.tilemap.deserialize(data.tilemap);
    chunk.modified = true;
    this.chunks.set(this._chunkKey(cx, cy), chunk);
    return true;
  }

  // =============================================================================
  // RENDERING PROXY
  // =============================================================================

  /**
   * Render all loaded chunks' floor tiles.
   * Chunks are sorted by their origin so tiles render back-to-front correctly.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {{x:number, y:number, zoom?:number}} camera - Camera.
   */
  renderAll(ctx, camera) {
    // Collect all chunks sorted by origin for proper back-to-front order
    const chunkList = [];
    for (const chunk of this.chunks.values()) {
      const origin = this.getTileForChunk(chunk.cx, chunk.cy);
      chunkList.push({
        chunk,
        sortKey: origin.tx + origin.ty,
      });
    }

    chunkList.sort((a, b) => a.sortKey - b.sortKey);

    for (const entry of chunkList) {
      entry.chunk.tilemap.renderFloor(ctx, camera);
    }
  }

  /**
   * Render grid overlay for all loaded chunks.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {{x:number, y:number, zoom?:number}} camera - Camera.
   */
  renderAllGrids(ctx, camera) {
    for (const chunk of this.chunks.values()) {
      chunk.tilemap.renderGrid(ctx, camera);
    }
  }

  // =============================================================================
  // STATS / DEBUG
  // =============================================================================

  /**
   * Get chunk manager statistics.
   *
   * @returns {{loaded:number, loads:number, unloads:number, playerChunk:{cx:number, cy:number}}} Stats object.
   */
  getStats() {
    return {
      loaded: this.chunks.size,
      loads: this.statsLoads,
      unloads: this.statsUnloads,
      playerChunk: { cx: this._playerChunkX, cy: this._playerChunkY },
      persistent: this._persistentChunks.size,
    };
  }

  /**
   * Reset statistics counters.
   */
  resetStats() {
    this.statsLoads = 0;
    this.statsUnloads = 0;
  }

  /**
   * Unload all non-persistent chunks.
   */
  unloadAll() {
    const toKeep = [];
    for (const [key, chunk] of this.chunks) {
      if (this._persistentChunks.has(key)) {
        toKeep.push({ key, chunk });
      }
    }
    this.chunks.clear();
    for (const { key, chunk } of toKeep) {
      this.chunks.set(key, chunk);
    }
    this.statsUnloads += toKeep.length;
  }

  /**
   * Load from an area definition for static rooms.
   * Creates a single chunk at (0,0) containing the room data.
   *
   * @param {AreaDef} areaData - Area definition.
   * @returns {boolean} True if loaded.
   */
  loadFromArea(areaData) {
    if (!areaData) return false;
    this._areaData = areaData;

    // Create a single chunk large enough to hold the area
    const chunkW = Math.ceil((areaData.width || DEFAULT_CHUNK_SIZE) / this.chunkSize);
    const chunkH = Math.ceil((areaData.height || DEFAULT_CHUNK_SIZE) / this.chunkSize);

    for (let cy = 0; cy < chunkH; cy++) {
      for (let cx = 0; cx < chunkW; cx++) {
        const chunk = this.loadChunk(cx, cy);

        // Calculate overlap with area
        const baseTx = cx * this.chunkSize;
        const baseTy = cy * this.chunkSize;

        // If this is the primary chunk containing the origin, load area data
        if (cx === 0 && cy === 0) {
          chunk.tilemap.loadFromArea(areaData);
        } else {
          // Fill extension chunks with the area's default floor type
          const defaultType = areaData.floorType || 'wood_light';
          chunk.tilemap.fillRect(0, 0, this.chunkSize - 1, this.chunkSize - 1, defaultType, true);
        }

        chunk.modified = false;
      }
    }

    return true;
  }
}

/** Maximum A* iterations for cross-chunk pathfinding. */
export const MAX_A_STAR_ITERATIONS_CHUNK = 4000;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * @typedef {Object} Chunk
 * @property {number} cx - Chunk X coordinate.
 * @property {number} cy - Chunk Y coordinate.
 * @property {number} chunkSize - Chunk width/height in tiles.
 * @property {IsoTilemap} tilemap - The tilemap for this chunk.
 * @property {number} loadedAt - Timestamp when chunk was loaded.
 * @property {number} lastAccessed - Timestamp of last access.
 * @property {boolean} modified - Whether the chunk has been modified since load.
 * @property {number} generation - Generation counter for cache invalidation.
 */
