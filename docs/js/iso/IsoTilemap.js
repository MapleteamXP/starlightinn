/**
 * @file IsoTilemap.js
 * @description Full isometric tilemap storage and management for Starlight Inn v6.0.
 * Manages a 2D grid of tile objects, provides A* pathfinding, hit testing,
 * serialization, and back-to-front isometric rendering of floor tiles.
 * Integrates with IsoMath for coordinate transforms and IsoAreaBackgrounds
 * for area data loading.
 *
 * Each tile stores: type, walkable flag, z height, furniture reference,
 * and portal destination. The tilemap is the single source of truth for
 * all grid-based game state.
 *
 * @module iso/IsoTilemap
 */

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  HALF_TILE_WIDTH,
  HALF_TILE_HEIGHT,
  tileToScreen,
  screenToTile,
  getTileCorners,
  isPointInTile,
  distanceTile,
  getSortKey,
} from './IsoMath.js';

import { TILE_COLORS } from './IsoAreaBackgrounds.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default map width in tiles. */
export const DEFAULT_MAP_WIDTH = 20;

/** Default map height in tiles. */
export const DEFAULT_MAP_HEIGHT = 20;

/** Default tile type for empty/uninitialized tiles. */
export const DEFAULT_TILE_TYPE = 'wood_light';

/** Default A* movement cost for cardinal directions. */
export const COST_CARDINAL = 10;

/** Default A* movement cost for diagonal directions. */
export const COST_DIAGONAL = 14;

/** Maximum A* search iterations before early abort. */
export const MAX_A_STAR_ITERATIONS = 2000;

/** Debug grid line color (faint white). */
export const DEBUG_GRID_COLOR = 'rgba(255, 255, 255, 0.15)';

/** Hover highlight color (semi-transparent cyan). */
export const HOVER_HIGHLIGHT_COLOR = 'rgba(80, 200, 255, 0.35)';

/** Click highlight color (semi-transparent yellow). */
export const CLICK_HIGHLIGHT_COLOR = 'rgba(255, 220, 80, 0.4)';

// =============================================================================
// TILE FACTORY
// =============================================================================

/**
 * Create a default tile object with all required properties.
 *
 * @param {string} [type='wood_light'] - Floor type ID.
 * @param {boolean} [walkable=true] - Whether the tile can be walked on.
 * @param {number} [z=0] - Vertical Z height offset.
 * @returns {Tile} A new tile object.
 */
export function createTile(type = DEFAULT_TILE_TYPE, walkable = true, z = 0) {
  return {
    type,
    walkable,
    z,
    furniture: null,
    portal: null,
    metadata: {},
  };
}

// =============================================================================
// IsoTilemap CLASS
// =============================================================================

/**
 * Isometric tilemap engine. Stores a 2D array of tile objects and provides
 * pathfinding, rendering, hit testing, and serialization.
 *
 * Tile coordinates: `tiles[y][x]` where y is the row (north-south axis)
 * and x is the column (east-west axis).
 */
export default class IsoTilemap {
  /**
   * @param {string} areaId - Unique identifier for this map area.
   * @param {number} [width=20] - Map width in tiles.
   * @param {number} [height=20] - Map height in tiles.
   */
  constructor(areaId, width = DEFAULT_MAP_WIDTH, height = DEFAULT_MAP_HEIGHT) {
    /** @type {string} Unique area identifier. */
    this.areaId = areaId;

    /** @type {number} Map width in tiles. */
    this.width = Math.max(1, Math.floor(width));

    /** @type {number} Map height in tiles. */
    this.height = Math.max(1, Math.floor(height));

    /** @type {Array<Array<Tile>>} 2D tile array [y][x]. */
    this.tiles = this._createEmptyGrid(this.width, this.height);

    /** @type {Array<{x:number, y:number}>} Currently highlighted tiles. */
    this._highlightedTiles = [];

    /** @type {string} Current hover highlight color. */
    this._hoverColor = HOVER_HIGHLIGHT_COLOR;

    /** @type {Array<{x:number, y:number}>} Current path visualization tiles. */
    this._pathTiles = [];

    /** @type {string} Current path highlight color. */
    this._pathColor = 'rgba(100, 255, 100, 0.4)';

    /** @type {Set<string>} Set of occupied tile keys (for player avoidance). */
    this._occupiedTiles = new Set();

    /** @type {Array<Function>} Click callback registry. */
    this._clickCallbacks = [];

    /** @type {Array<Function>} Hover callback registry. */
    this._hoverCallbacks = [];

    /** @type {{tileX:number, tileY:number}|null} Currently hovered tile. */
    this._hoveredTile = null;

    /** @type {{tileX:number, tileY:number}|null} Last clicked tile. */
    this._clickedTile = null;

    /** @type {number} Zoom level for rendering (passed to camera). */
    this.zoom = 1;
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  /**
   * Create an empty 2D grid filled with default tiles.
   *
   * @param {number} w - Grid width.
   * @param {number} h - Grid height.
   * @returns {Array<Array<Tile>>} 2D tile array.
   * @private
   */
  _createEmptyGrid(w, h) {
    const grid = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        row.push(createTile(DEFAULT_TILE_TYPE, true, 0));
      }
      grid.push(row);
    }
    return grid;
  }

  /**
   * Check if coordinates are inside the map bounds.
   *
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   * @returns {boolean} True if in bounds.
   * @private
   */
  _inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Pack tile coordinates into a string key for Sets/Maps.
   *
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   * @returns {string} Key string `${x},${y}`.
   * @private
   */
  _key(x, y) {
    return `${x},${y}`;
  }

  /**
   * Get the fallback color for a tile type from the palette.
   *
   * @param {string} type - Tile type ID.
   * @returns {string} Hex color string.
   * @private
   */
  _getTileColor(type) {
    return TILE_COLORS[type] || TILE_COLORS[DEFAULT_TILE_TYPE] || '#888888';
  }

  /**
   * Compute a slightly varied color for a tile to give visual texture.
   *
   * @param {string} baseHex - Base hex color.
   * @param {number} x - Tile X (for deterministic variation).
   * @param {number} y - Tile Y (for deterministic variation).
   * @returns {string} Modified hex color.
   * @private
   */
  _varyColor(baseHex, x, y) {
    const seed = ((x * 374761393 + y * 668265263) & 0x7fffffff);
    const variance = ((seed % 21) - 10) / 100; // +/- 10%
    const clean = baseHex.replace('#', '');
    const bigint = parseInt(clean.length === 3
      ? clean.split('').map(c => c + c).join('')
      : clean, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;
    r = Math.max(0, Math.min(255, Math.round(r + r * variance)));
    g = Math.max(0, Math.min(255, Math.round(g + g * variance)));
    b = Math.max(0, Math.min(255, Math.round(b + b * variance)));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  // =============================================================================
  // TILE ACCESSORS
  // =============================================================================

  /**
   * Set tile properties at a specific coordinate.
   * Preserves existing properties not explicitly provided.
   *
   * @param {number} x - Tile X coordinate.
   * @param {number} y - Tile Y coordinate.
   * @param {Partial<Tile>} tileData - Partial tile data to merge.
   * @returns {boolean} True if the tile was set successfully.
   */
  setTile(x, y, tileData) {
    if (!this._inBounds(x, y)) return false;
    const tile = this.tiles[y][x];
    if (tileData.type !== undefined) tile.type = tileData.type;
    if (tileData.walkable !== undefined) tile.walkable = tileData.walkable;
    if (tileData.z !== undefined) tile.z = tileData.z;
    if (tileData.furniture !== undefined) tile.furniture = tileData.furniture;
    if (tileData.portal !== undefined) tile.portal = tileData.portal;
    if (tileData.metadata !== undefined) Object.assign(tile.metadata, tileData.metadata);
    return true;
  }

  /**
   * Get tile data at a specific coordinate.
   *
   * @param {number} x - Tile X coordinate.
   * @param {number} y - Tile Y coordinate.
   * @returns {Tile|null} Tile object, or null if out of bounds.
   */
  getTile(x, y) {
    if (!this._inBounds(x, y)) return null;
    return this.tiles[y][x];
  }

  /**
   * Check if a tile can be walked on.
   * Returns false for out-of-bounds tiles.
   *
   * @param {number} x - Tile X coordinate.
   * @param {number} y - Tile Y coordinate.
   * @returns {boolean} True if the tile is walkable.
   */
  isWalkable(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) return false;
    if (!tile.walkable) return false;
    if (tile.furniture && tile.furniture.blocksMovement) return false;
    if (this._occupiedTiles.has(this._key(x, y))) return false;
    return true;
  }

  /**
   * Force-set walkability without changing other tile properties.
   *
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   * @param {boolean} walkable - New walkability state.
   * @returns {boolean} True if successful.
   */
  setWalkable(x, y, walkable) {
    return this.setTile(x, y, { walkable });
  }

  /**
   * Place furniture on a tile.
   *
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   * @param {Object} furniture - Furniture object reference.
   * @returns {boolean} True if placed successfully.
   */
  placeFurniture(x, y, furniture) {
    return this.setTile(x, y, { furniture });
  }

  /**
   * Remove furniture from a tile.
   *
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   * @returns {boolean} True if removed successfully.
   */
  removeFurniture(x, y) {
    return this.setTile(x, y, { furniture: null });
  }

  /**
   * Place a portal on a tile.
   *
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   * @param {{destArea:string, destX:number, destY:number}} portal - Portal data.
   * @returns {boolean} True if placed successfully.
   */
  placePortal(x, y, portal) {
    return this.setTile(x, y, { portal });
  }

  // =============================================================================
  // COORDINATE CONVERSION
  // =============================================================================

  /**
   * Convert screen coordinates to tile coordinates using the camera.
   *
   * @param {number} screenX - Screen X pixel.
   * @param {number} screenY - Screen Y pixel.
   * @param {{x:number, y:number, zoom?:number}} camera - Camera object with x, y offsets.
   * @returns {{tileX:number, tileY:number}|null} Tile coordinates or null.
   */
  getTileAtScreen(screenX, screenY, camera) {
    const camX = camera?.x ?? 0;
    const camY = camera?.y ?? 0;
    const zoom = camera?.zoom ?? 1;
    const { tileX, tileY } = screenToTile(screenX, screenY, camX, camY, zoom);
    if (this._inBounds(tileX, tileY)) {
      return { tileX, tileY };
    }
    return null;
  }

  /**
   * Convert tile coordinates to screen coordinates using the camera.
   *
   * @param {number} tileX - Tile X.
   * @param {number} tileY - Tile Y.
   * @param {{x:number, y:number, zoom?:number}} camera - Camera object.
   * @returns {{screenX:number, screenY:number}} Screen coordinates.
   */
  getScreenAtTile(tileX, tileY, camera) {
    const camX = camera?.x ?? 0;
    const camY = camera?.y ?? 0;
    const zoom = camera?.zoom ?? 1;
    return tileToScreen(tileX, tileY, camX, camY, zoom);
  }

  /**
   * Precise hit test: find which tile's diamond contains the screen point.
   * Iterates visible tiles and uses diamond inequality for accuracy.
   *
   * @param {number} screenX - Screen X.
   * @param {number} screenY - Screen Y.
   * @param {{x:number, y:number, zoom?:number}} camera - Camera.
   * @returns {{tileX:number, tileY:number}|null} Tile under point, or null.
   */
  getTileAtScreenPrecise(screenX, screenY, camera) {
    const camX = camera?.x ?? 0;
    const camY = camera?.y ?? 0;
    const zoom = camera?.zoom ?? 1;

    // First get approximate tile from screenToTile
    const approx = screenToTile(screenX, screenY, camX, camY, zoom);

    // Search a small neighborhood for the exact containing diamond
    const candidates = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tx = approx.tileX + dx;
        const ty = approx.tileY + dy;
        if (this._inBounds(tx, ty)) {
          candidates.push({ tx, ty });
        }
      }
    }

    // Sort candidates by screen distance (closest center first)
    candidates.sort((a, b) => {
      const sa = tileToScreen(a.tx, a.ty, camX, camY, zoom);
      const sb = tileToScreen(b.tx, b.ty, camX, camY, zoom);
      const da = Math.abs(screenX - sa.screenX) + Math.abs(screenY - sa.screenY);
      const db = Math.abs(screenX - sb.screenX) + Math.abs(screenY - sb.screenY);
      return da - db;
    });

    for (const c of candidates) {
      if (isPointInTile(screenX, screenY, c.tx, c.ty, camX, camY, zoom)) {
        return { tileX: c.tx, tileY: c.ty };
      }
    }

    return null;
  }

  // =============================================================================
  // NEIGHBOR QUERIES
  // =============================================================================

  /**
   * Get the 4 cardinal neighboring tiles.
   *
   * @param {number} x - Center tile X.
   * @param {number} y - Center tile Y.
   * @param {boolean} [includeOutOfBounds=false] - Include nulls for OOB neighbors.
   * @returns {Array<{x:number, y:number, tile:Tile|null}>} Neighbor entries.
   */
  getNeighbors(x, y, includeOutOfBounds = false) {
    const dirs = [
      { dx: 0, dy: -1 }, // North
      { dx: 1, dy: 0 },  // East
      { dx: 0, dy: 1 },  // South
      { dx: -1, dy: 0 }, // West
    ];
    const result = [];
    for (const d of dirs) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      const tile = this.getTile(nx, ny);
      if (tile || includeOutOfBounds) {
        result.push({ x: nx, y: ny, tile });
      }
    }
    return result;
  }

  /**
   * Get all 8 neighboring tiles (including diagonals).
   *
   * @param {number} x - Center tile X.
   * @param {number} y - Center tile Y.
   * @param {boolean} [includeOutOfBounds=false] - Include nulls for OOB neighbors.
   * @returns {Array<{x:number, y:number, tile:Tile|null}>} Neighbor entries.
   */
  getNeighbors8(x, y, includeOutOfBounds = false) {
    const dirs = [
      { dx: 0, dy: -1 },  // N
      { dx: 1, dy: -1 },  // NE
      { dx: 1, dy: 0 },   // E
      { dx: 1, dy: 1 },   // SE
      { dx: 0, dy: 1 },   // S
      { dx: -1, dy: 1 },  // SW
      { dx: -1, dy: 0 },  // W
      { dx: -1, dy: -1 }, // NW
    ];
    const result = [];
    for (const d of dirs) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      const tile = this.getTile(nx, ny);
      if (tile || includeOutOfBounds) {
        result.push({ x: nx, y: ny, tile });
      }
    }
    return result;
  }

  /**
   * Get all tiles within an axis-aligned rectangle (inclusive).
   *
   * @param {number} x1 - Top-left tile X.
   * @param {number} y1 - Top-left tile Y.
   * @param {number} x2 - Bottom-right tile X.
   * @param {number} y2 - Bottom-right tile Y.
   * @returns {Array<{x:number, y:number, tile:Tile|null}>} Tiles in rectangle.
   */
  getTilesInRect(x1, y1, x2, y2) {
    const result = [];
    const minX = Math.max(0, Math.min(x1, x2));
    const minY = Math.max(0, Math.min(y1, y2));
    const maxX = Math.min(this.width - 1, Math.max(x1, x2));
    const maxY = Math.min(this.height - 1, Math.max(y1, y2));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        result.push({ x, y, tile: this.tiles[y][x] });
      }
    }
    return result;
  }

  /**
   * Get all tiles within a circular radius of a center tile.
   *
   * @param {number} x - Center tile X.
   * @param {number} y - Center tile Y.
   * @param {number} r - Radius in tiles.
   * @returns {Array<{x:number, y:number, tile:Tile|null}>} Tiles within radius.
   */
  getTilesInRadius(x, y, r) {
    const result = [];
    const r2 = r * r;
    const minX = Math.max(0, x - r);
    const minY = Math.max(0, y - r);
    const maxX = Math.min(this.width - 1, x + r);
    const maxY = Math.min(this.height - 1, y + r);

    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const dx = tx - x;
        const dy = ty - y;
        if (dx * dx + dy * dy <= r2) {
          result.push({ x: tx, y: ty, tile: this.tiles[ty][tx] });
        }
      }
    }
    return result;
  }

  // =============================================================================
  // A* PATHFINDING
  // =============================================================================

  /**
   * Find a path from start to end using the A* algorithm.
   * Supports 8-directional movement with appropriate costs.
   * Respects walkable tiles and furniture blockers.
   *
   * @param {number} startX - Start tile X.
   * @param {number} startY - Start tile Y.
   * @param {number} endX - Destination tile X.
   * @param {number} endY - Destination tile Y.
   * @param {boolean} [allowDiagonal=true] - Allow diagonal steps.
   * @returns {Array<{x:number, y:number}>|null} Path array including start and end, or null.
   */
  findPath(startX, startY, endX, endY, allowDiagonal = true) {
    if (!this._inBounds(startX, startY) || !this._inBounds(endX, endY)) {
      return null;
    }

    // If destination is the start, return single-node path
    if (startX === endX && startY === endY) {
      return [{ x: startX, y: startY }];
    }

    // If destination is not walkable, try to find nearest walkable neighbor
    let targetX = endX;
    let targetY = endY;
    if (!this.isWalkable(endX, endY)) {
      const neighbors = this.getNeighbors(endX, endY);
      let best = null;
      let bestDist = Infinity;
      for (const n of neighbors) {
        if (n.tile && this.isWalkable(n.x, n.y)) {
          const dist = distanceTile({ x: startX, y: startY }, { x: n.x, y: n.y });
          if (dist < bestDist) {
            bestDist = dist;
            best = n;
          }
        }
      }
      if (!best) return null;
      targetX = best.x;
      targetY = best.y;
    }

    const openSet = new Map(); // key -> node
    const closedSet = new Set();
    const startKey = this._key(startX, startY);

    const startNode = {
      x: startX,
      y: startY,
      g: 0,
      h: this._heuristic(startX, startY, targetX, targetY),
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openSet.set(startKey, startNode);

    let iterations = 0;
    const directions = allowDiagonal
      ? [
          { dx: 0, dy: -1, cost: COST_CARDINAL },
          { dx: 1, dy: 0, cost: COST_CARDINAL },
          { dx: 0, dy: 1, cost: COST_CARDINAL },
          { dx: -1, dy: 0, cost: COST_CARDINAL },
          { dx: 1, dy: -1, cost: COST_DIAGONAL },
          { dx: 1, dy: 1, cost: COST_DIAGONAL },
          { dx: -1, dy: 1, cost: COST_DIAGONAL },
          { dx: -1, dy: -1, cost: COST_DIAGONAL },
        ]
      : [
          { dx: 0, dy: -1, cost: COST_CARDINAL },
          { dx: 1, dy: 0, cost: COST_CARDINAL },
          { dx: 0, dy: 1, cost: COST_CARDINAL },
          { dx: -1, dy: 0, cost: COST_CARDINAL },
        ];

    while (openSet.size > 0 && iterations < MAX_A_STAR_ITERATIONS) {
      iterations++;

      // Find node with lowest f score
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

      // Reached target
      if (current.x === targetX && current.y === targetY) {
        return this._reconstructPath(current);
      }

      openSet.delete(currentKey);
      closedSet.add(currentKey);

      // Explore neighbors
      for (const d of directions) {
        const nx = current.x + d.dx;
        const ny = current.y + d.dy;
        const nKey = this._key(nx, ny);

        if (closedSet.has(nKey)) continue;
        if (!this._inBounds(nx, ny)) continue;
        if (!this.isWalkable(nx, ny)) continue;

        // For diagonal movement, check that we don't cut corners
        if (d.cost === COST_DIAGONAL) {
          if (!this.isWalkable(current.x + d.dx, current.y)) continue;
          if (!this.isWalkable(current.x, current.y + d.dy)) continue;
        }

        const g = current.g + d.cost;
        const existing = openSet.get(nKey);

        if (!existing || g < existing.g) {
          const h = this._heuristic(nx, ny, targetX, targetY);
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

    // Path not found
    return null;
  }

  /**
   * A* heuristic: Manhattan distance scaled by minimum step cost.
   *
   * @param {number} x1 - From X.
   * @param {number} y1 - From Y.
   * @param {number} x2 - To X.
   * @param {number} y2 - To Y.
   * @returns {number} Estimated cost.
   * @private
   */
  _heuristic(x1, y1, x2, y2) {
    return (Math.abs(x1 - x2) + Math.abs(y1 - y2)) * COST_CARDINAL;
  }

  /**
   * Reconstruct path from A* target node back to start.
   *
   * @param {Object} node - Target A* node with parent chain.
   * @returns {Array<{x:number, y:number}>} Path from start to target.
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
  // AREA LOADING
  // =============================================================================

  /**
   * Populate this tilemap from an IsoAreaBackgrounds area definition.
   * Sets floor types from floorPattern, places walls as unwalkable,
   * registers furniture and portal data on tiles.
   *
   * @param {AreaDef} areaData - Area definition from IsoAreaBackgrounds.
   * @returns {boolean} True if loaded successfully.
   */
  loadFromArea(areaData) {
    if (!areaData) return false;

    const w = areaData.width || this.width;
    const h = areaData.height || this.height;

    // Resize grid if needed
    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      this.tiles = this._createEmptyGrid(w, h);
    }

    // Load floor pattern
    if (areaData.floorPattern && Array.isArray(areaData.floorPattern)) {
      for (let y = 0; y < h && y < areaData.floorPattern.length; y++) {
        const row = areaData.floorPattern[y];
        if (!Array.isArray(row)) continue;
        for (let x = 0; x < w && x < row.length; x++) {
          const type = row[x] || areaData.floorType || DEFAULT_TILE_TYPE;
          this.tiles[y][x].type = type;
        }
      }
    } else if (areaData.floorType) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          this.tiles[y][x].type = areaData.floorType;
        }
      }
    }

    // Mark wall tiles as unwalkable
    if (areaData.walls && Array.isArray(areaData.walls)) {
      for (const wall of areaData.walls) {
        if (wall.x >= 0 && wall.x < w && wall.y >= 0 && wall.y < h) {
          this.tiles[wall.y][wall.x].walkable = false;
          this.tiles[wall.y][wall.x].metadata.isWall = true;
          this.tiles[wall.y][wall.x].metadata.wallType = wall.type || 'wall_stone';
        }
      }
    }

    // Place furniture props
    if (areaData.props && Array.isArray(areaData.props)) {
      for (const prop of areaData.props) {
        const px = prop.tileX;
        const py = prop.tileY;
        if (px >= 0 && px < w && py >= 0 && py < h) {
          this.tiles[py][px].furniture = {
            id: prop.furnitureId,
            rotation: prop.rotation || 0,
            blocksMovement: this._doesFurnitureBlock(prop.furnitureId),
            interactive: this._isFurnitureInteractive(prop.furnitureId),
            data: prop,
          };
          // If furniture blocks movement, mark tile unwalkable
          if (this._doesFurnitureBlock(prop.furnitureId)) {
            this.tiles[py][px].walkable = false;
          }
        }
      }
    }

    // Register portals
    if (areaData.portals && Array.isArray(areaData.portals)) {
      for (const portal of areaData.portals) {
        const px = portal.tileX;
        const py = portal.tileY;
        if (px >= 0 && px < w && py >= 0 && py < h) {
          this.tiles[py][px].portal = {
            destArea: portal.destArea,
            destX: portal.destX,
            destY: portal.destY,
          };
          this.tiles[py][px].walkable = true; // portals are walkable
        }
      }
    }

    // Store spawn point
    if (areaData.spawnPoint) {
      this.spawnPoint = { ...areaData.spawnPoint };
    }

    this.areaId = areaData.id || this.areaId;
    return true;
  }

  /**
   * Determine if a furniture type blocks player movement.
   *
   * @param {string} furnitureId - Furniture type ID.
   * @returns {boolean} True if it blocks movement.
   * @private
   */
  _doesFurnitureBlock(furnitureId) {
    const blockers = new Set([
      'tree_oak', 'tree_pine', 'rock', 'bookshelf', 'trophy_case',
      'wall_stone', 'wall_wood', 'wall_brick', 'wall_mossy',
      'wall_ice', 'wall_bamboo', 'wall_plaster',
      'fountain', 'bar_counter', 'reception_desk',
      'dining_table', 'chest_treasure', 'vendor_stall',
      'campfire', 'fireplace', 'sofa', 'armchair',
      'coffee_table', 'bench', 'bed', 'wardrobe',
    ]);
    return blockers.has(furnitureId);
  }

  /**
   * Determine if a furniture type is interactive (can be clicked/used).
   *
   * @param {string} furnitureId - Furniture type ID.
   * @returns {boolean} True if interactive.
   * @private
   */
  _isFurnitureInteractive(furnitureId) {
    const interactives = new Set([
      'fountain', 'bench', 'streetlamp', 'info_board', 'birdbath',
      'jukebox', 'chest_treasure', 'fireplace', 'dining_table',
      'bookshelf', 'trophy_case', 'portal_ring', 'sofa', 'armchair',
      'coffee_table', 'disco_ball', 'bar_counter', 'reception_desk',
      'vendor_stall', 'painting', 'clock_wall', 'mirror', 'portrait',
      'dining_chair', 'bar_stool', 'campfire',
    ]);
    return interactives.has(furnitureId);
  }

  // =============================================================================
  // SERIALIZATION
  // =============================================================================

  /**
   * Serialize the entire tilemap to a plain JSON-compatible object.
   *
   * @returns {Object} Serialized tilemap data.
   */
  serialize() {
    const flatTiles = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y][x];
        flatTiles.push({
          x,
          y,
          type: tile.type,
          walkable: tile.walkable,
          z: tile.z,
          furniture: tile.furniture
            ? {
                id: tile.furniture.id,
                rotation: tile.furniture.rotation,
                blocksMovement: tile.furniture.blocksMovement,
                interactive: tile.furniture.interactive,
              }
            : null,
          portal: tile.portal,
          metadata: tile.metadata,
        });
      }
    }

    return {
      version: 1,
      areaId: this.areaId,
      width: this.width,
      height: this.height,
      spawnPoint: this.spawnPoint,
      tiles: flatTiles,
    };
  }

  /**
   * Deserialize tilemap data and rebuild the grid.
   *
   * @param {Object} data - Serialized tilemap data.
   * @returns {boolean} True if deserialized successfully.
   */
  deserialize(data) {
    if (!data || typeof data !== 'object') return false;
    if (!data.tiles || !Array.isArray(data.tiles)) return false;

    this.areaId = data.areaId || 'unknown';
    this.width = data.width || DEFAULT_MAP_WIDTH;
    this.height = data.height || DEFAULT_MAP_HEIGHT;
    this.spawnPoint = data.spawnPoint || null;
    this.tiles = this._createEmptyGrid(this.width, this.height);

    for (const entry of data.tiles) {
      const x = entry.x;
      const y = entry.y;
      if (!this._inBounds(x, y)) continue;

      const tile = this.tiles[y][x];
      tile.type = entry.type || DEFAULT_TILE_TYPE;
      tile.walkable = entry.walkable !== undefined ? entry.walkable : true;
      tile.z = entry.z || 0;
      tile.furniture = entry.furniture || null;
      tile.portal = entry.portal || null;
      tile.metadata = entry.metadata || {};
    }

    return true;
  }

  /**
   * Export just the floor pattern as a 2D array of type strings.
   * Compatible with IsoAreaBackgrounds floorPattern format.
   *
   * @returns {Array<Array<string>>} 2D array of floor type IDs.
   */
  exportFloorPattern() {
    const pattern = [];
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        row.push(this.tiles[y][x].type);
      }
      pattern.push(row);
    }
    return pattern;
  }

  // =============================================================================
  // RENDERING
  // =============================================================================

  /**
   * Render all floor tiles to the canvas, sorted back-to-front
   * for correct isometric occlusion. Uses the painter's algorithm.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
   * @param {{x:number, y:number, zoom?:number}} camera - Camera with offset and zoom.
   */
  renderFloor(ctx, camera) {
    const camX = camera?.x ?? 0;
    const camY = camera?.y ?? 0;
    const zoom = camera?.zoom ?? 1;

    // Build render list with sort keys
    const renderList = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y][x];
        const screen = tileToScreen(x, y, camX, camY, zoom);
        const sortKey = getSortKey(x, y, tile.z);
        renderList.push({
          x, y, tile,
          screenX: screen.screenX,
          screenY: screen.screenY,
          sortKey,
        });
      }
    }

    // Sort back-to-front (lower sortKey drawn first = behind)
    renderList.sort((a, b) => a.sortKey - b.sortKey);

    // Draw each tile diamond
    for (const entry of renderList) {
      this._renderTileDiamond(ctx, entry.x, entry.y, entry.tile, entry.screenX, entry.screenY, zoom);
    }
  }

  /**
   * Render a single tile diamond with optional highlighting.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} tx - Tile X.
   * @param {number} ty - Tile Y.
   * @param {Tile} tile - Tile data.
   * @param {number} screenX - Screen X center.
   * @param {number} screenY - Screen Y center.
   * @param {number} zoom - Zoom level.
   * @private
   */
  _renderTileDiamond(ctx, tx, ty, tile, screenX, screenY, zoom) {
    const hw = HALF_TILE_WIDTH * zoom;
    const hh = HALF_TILE_HEIGHT * zoom;

    const corners = [
      { x: screenX, y: screenY - hh },      // Top
      { x: screenX + hw, y: screenY },       // Right
      { x: screenX, y: screenY + hh },       // Bottom
      { x: screenX - hw, y: screenY },       // Left
    ];

    // Determine base color
    let baseColor = this._getTileColor(tile.type);

    // Apply subtle color variation for texture
    baseColor = this._varyColor(baseColor, tx, ty);

    // Darken unwalkable tiles slightly
    if (!tile.walkable) {
      baseColor = this._darkenHex(baseColor, 20);
    }

    // Z-height offset moves tile upward visually
    const zOffset = tile.z * zoom;
    if (zOffset !== 0) {
      for (const c of corners) {
        c.y -= zOffset;
      }
    }

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath();

    ctx.fillStyle = baseColor;
    ctx.fill();

    // Highlight overlays
    const key = this._key(tx, ty);
    let isHighlighted = false;

    // Hover highlight
    if (this._hoveredTile && this._hoveredTile.tileX === tx && this._hoveredTile.tileY === ty) {
      ctx.fillStyle = this._hoverColor;
      ctx.fill();
      isHighlighted = true;
    }

    // Click highlight
    if (this._clickedTile && this._clickedTile.tileX === tx && this._clickedTile.tileY === ty) {
      ctx.fillStyle = CLICK_HIGHLIGHT_COLOR;
      ctx.fill();
      isHighlighted = true;
    }

    // Custom highlight list
    for (const ht of this._highlightedTiles) {
      if (ht.x === tx && ht.y === ty && ht.color) {
        ctx.fillStyle = ht.color;
        ctx.fill();
        isHighlighted = true;
      }
    }

    // Path highlight
    for (const pt of this._pathTiles) {
      if (pt.x === tx && pt.y === ty) {
        ctx.fillStyle = this._pathColor;
        ctx.fill();
        isHighlighted = true;
      }
    }

    // Subtle border for definition
    ctx.strokeStyle = this._darkenHex(baseColor, 15);
    ctx.lineWidth = 0.5 * zoom;
    ctx.stroke();
  }

  /**
   * Darken a hex color by a percentage.
   *
   * @param {string} hex - Hex color string.
   * @param {number} percent - Percentage to darken.
   * @returns {string} Darkened hex color.
   * @private
   */
  _darkenHex(hex, percent) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean.length === 3
      ? clean.split('').map(c => c + c).join('')
      : clean, 16);
    const factor = 1 - percent / 100;
    const r = Math.max(0, Math.round(((bigint >> 16) & 255) * factor));
    const g = Math.max(0, Math.round(((bigint >> 8) & 255) * factor));
    const b = Math.max(0, Math.round((bigint & 255) * factor));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  /**
   * Render a faint grid overlay on all tiles.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {{x:number, y:number, zoom?:number}} camera - Camera.
   */
  renderGrid(ctx, camera) {
    const camX = camera?.x ?? 0;
    const camY = camera?.y ?? 0;
    const zoom = camera?.zoom ?? 1;
    const hw = HALF_TILE_WIDTH * zoom;
    const hh = HALF_TILE_HEIGHT * zoom;

    ctx.strokeStyle = DEBUG_GRID_COLOR;
    ctx.lineWidth = 0.5 * zoom;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const { screenX, screenY } = tileToScreen(x, y, camX, camY, zoom);
        const tile = this.tiles[y][x];
        const zOffset = tile.z * zoom;

        ctx.beginPath();
        ctx.moveTo(screenX, screenY - hh - zOffset);
        ctx.lineTo(screenX + hw, screenY - zOffset);
        ctx.lineTo(screenX, screenY + hh - zOffset);
        ctx.lineTo(screenX - hw, screenY - zOffset);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  // =============================================================================
  // INTERACTION
  // =============================================================================

  /**
   * Register a callback for tile clicks.
   *
   * @param {Function} callback - Function(tileX, tileY, tile) called on click.
   */
  onTileClick(callback) {
    if (typeof callback === 'function') {
      this._clickCallbacks.push(callback);
    }
  }

  /**
   * Register a callback for tile hover.
   *
   * @param {Function} callback - Function(tileX, tileY, tile) called on hover.
   */
  onTileHover(callback) {
    if (typeof callback === 'function') {
      this._hoverCallbacks.push(callback);
    }
  }

  /**
   * Remove a previously registered click callback.
   *
   * @param {Function} callback - The callback to remove.
   */
  offTileClick(callback) {
    this._clickCallbacks = this._clickCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Remove a previously registered hover callback.
   *
   * @param {Function} callback - The callback to remove.
   */
  offTileHover(callback) {
    this._hoverCallbacks = this._hoverCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Process a mouse click at screen coordinates.
   *
   * @param {number} screenX - Screen X.
   * @param {number} screenY - Screen Y.
   * @param {{x:number, y:number, zoom?:number}} camera - Camera.
   * @returns {{tileX:number, tileY:number, tile:Tile}|null} Clicked tile info.
   */
  handleClick(screenX, screenY, camera) {
    const tilePos = this.getTileAtScreenPrecise(screenX, screenY, camera);
    if (!tilePos) return null;

    const { tileX, tileY } = tilePos;
    const tile = this.getTile(tileX, tileY);
    if (!tile) return null;

    this._clickedTile = { tileX, tileY };

    for (const cb of this._clickCallbacks) {
      try {
        cb(tileX, tileY, tile);
      } catch (e) {
        console.error('Tilemap click callback error:', e);
      }
    }

    return { tileX, tileY, tile };
  }

  /**
   * Process a mouse move at screen coordinates (hover tracking).
   *
   * @param {number} screenX - Screen X.
   * @param {number} screenY - Screen Y.
   * @param {{x:number, y:number, zoom?:number}} camera - Camera.
   * @returns {{tileX:number, tileY:number, tile:Tile}|null} Hovered tile info.
   */
  handleHover(screenX, screenY, camera) {
    const tilePos = this.getTileAtScreenPrecise(screenX, screenY, camera);
    if (!tilePos) {
      if (this._hoveredTile) {
        this._hoveredTile = null;
        return null;
      }
      return null;
    }

    const { tileX, tileY } = tilePos;
    const tile = this.getTile(tileX, tileY);

    // Only trigger if tile changed
    if (!this._hoveredTile || this._hoveredTile.tileX !== tileX || this._hoveredTile.tileY !== tileY) {
      this._hoveredTile = { tileX, tileY };

      for (const cb of this._hoverCallbacks) {
        try {
          cb(tileX, tileY, tile);
        } catch (e) {
          console.error('Tilemap hover callback error:', e);
        }
      }
    }

    return { tileX, tileY, tile };
  }

  /**
   * Get the currently hovered tile.
   *
   * @returns {{tileX:number, tileY:number}|null} Hovered tile coordinates.
   */
  getHoveredTile() {
    return this._hoveredTile;
  }

  /**
   * Set custom highlight tiles with a specific color.
   *
   * @param {Array<{x:number, y:number}>} tiles - Tiles to highlight.
   * @param {string} [color='rgba(255, 80, 80, 0.4)'] - Highlight color.
   */
  highlightTiles(tiles, color = 'rgba(255, 80, 80, 0.4)') {
    this._highlightedTiles = tiles.map(t => ({ x: t.x, y: t.y, color }));
  }

  /**
   * Clear all custom tile highlights.
   */
  clearHighlights() {
    this._highlightedTiles = [];
  }

  /**
   * Set path visualization tiles.
   *
   * @param {Array<{x:number, y:number}>} pathTiles - Tiles in the path.
   * @param {string} [color='rgba(100, 255, 100, 0.4)'] - Path color.
   */
  showPath(pathTiles, color = 'rgba(100, 255, 100, 0.4)') {
    this._pathTiles = pathTiles.map(t => ({ x: t.x, y: t.y }));
    this._pathColor = color;
  }

  /**
   * Clear path visualization.
   */
  clearPath() {
    this._pathTiles = [];
  }

  // =============================================================================
  // PLAYER OCCUPANCY (for collision avoidance)
  // =============================================================================

  /**
   * Mark a tile as occupied by another player/NPC.
   *
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   */
  occupyTile(x, y) {
    if (this._inBounds(x, y)) {
      this._occupiedTiles.add(this._key(x, y));
    }
  }

  /**
   * Mark a tile as no longer occupied.
   *
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   */
  releaseTile(x, y) {
    this._occupiedTiles.delete(this._key(x, y));
  }

  /**
   * Clear all occupancy markers.
   */
  clearOccupancy() {
    this._occupiedTiles.clear();
  }

  /**
   * Check if a tile is occupied by another entity.
   *
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   * @returns {boolean} True if occupied.
   */
  isOccupied(x, y) {
    return this._occupiedTiles.has(this._key(x, y));
  }

  // =============================================================================
  // UTILITY
  // =============================================================================

  /**
   * Get the total number of tiles.
   *
   * @returns {number} width * height.
   */
  getTileCount() {
    return this.width * this.height;
  }

  /**
   * Count walkable tiles.
   *
   * @returns {number} Number of walkable tiles.
   */
  countWalkable() {
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.isWalkable(x, y)) count++;
      }
    }
    return count;
  }

  /**
   * Get all tiles that have furniture.
   *
   * @returns {Array<{x:number, y:number, furniture:Object}>} Furnished tiles.
   */
  getFurnishedTiles() {
    const result = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y][x];
        if (tile.furniture) {
          result.push({ x, y, furniture: tile.furniture });
        }
      }
    }
    return result;
  }

  /**
   * Get all tiles that have portals.
   *
   * @returns {Array<{x:number, y:number, portal:Object}>} Portal tiles.
   */
  getPortalTiles() {
    const result = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y][x];
        if (tile.portal) {
          result.push({ x, y, portal: tile.portal });
        }
      }
    }
    return result;
  }

  /**
   * Resize the tilemap, preserving existing tile data where possible.
   *
   * @param {number} newWidth - New width in tiles.
   * @param {number} newHeight - New height in tiles.
   */
  resize(newWidth, newHeight) {
    const w = Math.max(1, Math.floor(newWidth));
    const h = Math.max(1, Math.floor(newHeight));
    const newGrid = this._createEmptyGrid(w, h);

    for (let y = 0; y < Math.min(this.height, h); y++) {
      for (let x = 0; x < Math.min(this.width, w); x++) {
        newGrid[y][x] = this.tiles[y][x];
      }
    }

    this.width = w;
    this.height = h;
    this.tiles = newGrid;
  }

  /**
   * Fill a rectangular region with a specific tile type.
   *
   * @param {number} x1 - Top-left X.
   * @param {number} y1 - Top-left Y.
   * @param {number} x2 - Bottom-right X.
   * @param {number} y2 - Bottom-right Y.
   * @param {string} type - Floor type ID.
   * @param {boolean} [walkable=true] - Walkability of the filled tiles.
   */
  fillRect(x1, y1, x2, y2, type, walkable = true) {
    const minX = Math.max(0, Math.min(x1, x2));
    const minY = Math.max(0, Math.min(y1, y2));
    const maxX = Math.min(this.width - 1, Math.max(x1, x2));
    const maxY = Math.min(this.height - 1, Math.max(y1, y2));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        this.tiles[y][x].type = type;
        this.tiles[y][x].walkable = walkable;
      }
    }
  }

  /**
   * Clear all custom data from the tilemap, resetting to defaults.
   */
  clear() {
    this.tiles = this._createEmptyGrid(this.width, this.height);
    this._highlightedTiles = [];
    this._pathTiles = [];
    this._occupiedTiles.clear();
    this._hoveredTile = null;
    this._clickedTile = null;
  }
}

// =============================================================================
// TYPE DEFINITIONS (JSDoc)
// =============================================================================

/**
 * @typedef {Object} Tile
 * @property {string} type - Floor type ID.
 * @property {boolean} walkable - Whether the tile can be walked on.
 * @property {number} z - Vertical Z height offset.
 * @property {Object|null} furniture - Furniture object reference.
 * @property {Object|null} portal - Portal destination data.
 * @property {Object} metadata - Arbitrary tile metadata.
 */

/**
 * @typedef {Object} AreaDef
 * @property {string} id - Area identifier.
 * @property {string} name - Display name.
 * @property {number} width - Width in tiles.
 * @property {number} height - Height in tiles.
 * @property {string} floorType - Default floor type.
 * @property {Array<Array<string>>} floorPattern - 2D floor type grid.
 * @property {Array<WallDef>} walls - Wall definitions.
 * @property {Array<PropDef>} props - Furniture props.
 * @property {Object} palette - Color palette.
 * @property {Object} ambient - Ambient settings.
 * @property {{tileX:number, tileY:number}} spawnPoint - Default spawn.
 * @property {Array<Object>} portals - Portal definitions.
 */

/**
 * @typedef {Object} WallDef
 * @property {number} x - Tile X.
 * @property {number} y - Tile Y.
 * @property {string} type - Wall type ID.
 * @property {Array<boolean>} faces - [top, left, right] face visibility.
 */

/**
 * @typedef {Object} PropDef
 * @property {string} furnitureId - Furniture type ID.
 * @property {number} tileX - Tile X.
 * @property {number} tileY - Tile Y.
 * @property {number} rotation - Rotation index.
 */

// ── Named class export for main.js compatibility ──
export { IsoTilemap };
