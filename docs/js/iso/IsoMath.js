/**
 * @file IsoMath.js
 * @description Pure math utility for 2:1 diamond-tile isometric projection.
 * No game dependencies. All functions are static and operate on pure data.
 *
 * Tile coordinates (tileX, tileY) are integer grid positions.
 * Screen coordinates (screenX, screenY) are canvas pixel positions.
 * World coordinates (worldX, worldY) are float positions in tile-space.
 * The projection uses a 2:1 ratio where tiles are 64x32 pixels.
 *
 * Projection formulas:
 *   screenX = (tileX - tileY) * TILE_WIDTH / 2
 *   screenY = (tileX + tileY) * TILE_HEIGHT / 2
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Width of a single tile in screen pixels at 1x zoom */
export const TILE_WIDTH = 64;

/** Height of a single tile in screen pixels at 1x zoom (2:1 ratio) */
export const TILE_HEIGHT = 32;

/** Height of a wall segment in screen pixels */
export const WALL_HEIGHT = 24;

/** Half tile width for computations */
export const HALF_TILE_WIDTH = TILE_WIDTH / 2;

/** Half tile height for computations */
export const HALF_TILE_HEIGHT = TILE_HEIGHT / 2;

/** Maximum Z-layer value for sort key computation */
export const MAX_Z_LAYER = 1000;

/** Number of depth buckets for the sort key */
export const SORT_KEY_MULTIPLIER = MAX_Z_LAYER;

/** Direction vectors for the 4 cardinal neighbors on the iso grid */
export const CARDINAL_DIRECTIONS = [
  { dx: 0, dy: -1 }, // North
  { dx: 1, dy: 0 },  // East
  { dx: 0, dy: 1 },  // South
  { dx: -1, dy: 0 }, // West
];

/** Direction vectors for all 8 neighbors on the iso grid */
export const DIRECTIONS_8 = [
  { dx: 0, dy: -1 },  // North
  { dx: 1, dy: -1 },  // North-East
  { dx: 1, dy: 0 },   // East
  { dx: 1, dy: 1 },   // South-East
  { dx: 0, dy: 1 },   // South
  { dx: -1, dy: 1 },  // South-West
  { dx: -1, dy: 0 },  // West
  { dx: -1, dy: -1 }, // North-West
];

// =============================================================================
// TILE <-> SCREEN CONVERSIONS
// =============================================================================

/**
 * Convert integer tile coordinates to screen coordinates.
 * This is the core isometric projection transform.
 *
 * @param {number} tileX - Horizontal tile coordinate
 * @param {number} tileY - Vertical tile coordinate
 * @param {number} [cameraX=0] - Camera X offset in screen pixels
 * @param {number} [cameraY=0] - Camera Y offset in screen pixels
 * @param {number} [zoom=1] - Zoom level (integer multiple)
 * @returns {{screenX: number, screenY: number}} Screen pixel coordinates
 */
export function tileToScreen(tileX, tileY, cameraX = 0, cameraY = 0, zoom = 1) {
  const screenX = ((tileX - tileY) * HALF_TILE_WIDTH) * zoom - cameraX;
  const screenY = ((tileX + tileY) * HALF_TILE_HEIGHT) * zoom - cameraY;
  return { screenX, screenY };
}

/**
 * Convert screen coordinates back to tile coordinates.
 * Inverse of tileToScreen.
 *
 * @param {number} screenX - Screen X pixel coordinate
 * @param {number} screenY - Screen Y pixel coordinate
 * @param {number} [cameraX=0] - Camera X offset in screen pixels
 * @param {number} [cameraY=0] - Camera Y offset in screen pixels
 * @param {number} [zoom=1] - Zoom level (integer multiple)
 * @returns {{tileX: number, tileY: number}} Integer tile coordinates (floored)
 */
export function screenToTile(screenX, screenY, cameraX = 0, cameraY = 0, zoom = 1) {
  const adjustedX = (screenX + cameraX) / zoom;
  const adjustedY = (screenY + cameraY) / zoom;
  const tileX = Math.floor((adjustedX / HALF_TILE_WIDTH + adjustedY / HALF_TILE_HEIGHT) / 2);
  const tileY = Math.floor((adjustedY / HALF_TILE_HEIGHT - adjustedX / HALF_TILE_WIDTH) / 2);
  return { tileX, tileY };
}

/**
 * Convert float tile coordinates (world position) to screen coordinates.
 * Used for entity sub-tile positioning where smooth movement is needed.
 *
 * @param {number} tileX - Float tile X coordinate
 * @param {number} tileY - Float tile Y coordinate
 * @returns {{screenX: number, screenY: number}} Screen pixel coordinates at 1x zoom
 */
export function tileToScreenf(tileX, tileY) {
  const screenX = (tileX - tileY) * HALF_TILE_WIDTH;
  const screenY = (tileX + tileY) * HALF_TILE_HEIGHT;
  return { screenX, screenY };
}

// =============================================================================
// TILE GEOMETRY
// =============================================================================

/**
 * Get the 4 corner points of a tile diamond in screen coordinates.
 * Corners are returned in order: top, right, bottom, left.
 *
 * @param {number} tileX - Tile X coordinate
 * @param {number} tileY - Tile Y coordinate
 * @returns {Array<{x: number, y: number}>} Array of 4 corner points
 */
export function getTileCorners(tileX, tileY) {
  const cx = (tileX - tileY) * HALF_TILE_WIDTH;
  const cy = (tileX + tileY) * HALF_TILE_HEIGHT;
  return [
    { x: cx, y: cy - HALF_TILE_HEIGHT },          // Top
    { x: cx + HALF_TILE_WIDTH, y: cy },            // Right
    { x: cx, y: cy + HALF_TILE_HEIGHT },           // Bottom
    { x: cx - HALF_TILE_WIDTH, y: cy },            // Left
  ];
}

/**
 * Get the top-center point of a tile diamond.
 * This is where wall segments typically connect.
 *
 * @param {number} tileX - Tile X coordinate
 * @param {number} tileY - Tile Y coordinate
 * @returns {{x: number, y: number}} Top-center point in screen coords
 */
export function getTileTop(tileX, tileY) {
  const screenX = (tileX - tileY) * HALF_TILE_WIDTH;
  const screenY = (tileX + tileY) * HALF_TILE_HEIGHT - HALF_TILE_HEIGHT;
  return { x: screenX, y: screenY };
}

/**
 * Get the center point of a tile diamond.
 *
 * @param {number} tileX - Tile X coordinate
 * @param {number} tileY - Tile Y coordinate
 * @returns {{x: number, y: number}} Center point in screen coords
 */
export function getTileCenter(tileX, tileY) {
  const screenX = (tileX - tileY) * HALF_TILE_WIDTH;
  const screenY = (tileX + tileY) * HALF_TILE_HEIGHT;
  return { x: screenX, y: screenY };
}

// =============================================================================
// GRID UTILITIES
// =============================================================================

/**
 * Calculate Manhattan distance between two tiles on the iso grid.
 *
 * @param {{x: number, y: number}} a - First tile coordinate
 * @param {{x: number, y: number}} b - Second tile coordinate
 * @returns {number} Manhattan distance in tiles
 */
export function distanceTile(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Calculate Chebyshev (king's move) distance between two tiles.
 *
 * @param {{x: number, y: number}} a - First tile coordinate
 * @param {{x: number, y: number}} b - Second tile coordinate
 * @returns {number} Chebyshev distance in tiles
 */
export function distanceTileChebyshev(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Calculate Euclidean distance between two tiles.
 *
 * @param {{x: number, y: number}} a - First tile coordinate
 * @param {{x: number, y: number}} b - Second tile coordinate
 * @returns {number} Euclidean distance in tiles
 */
export function distanceTileEuclidean(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get the 4 cardinal neighboring tile coordinates.
 *
 * @param {number} tileX - Center tile X
 * @param {number} tileY - Center tile Y
 * @returns {Array<{x: number, y: number}>} Array of 4 neighbor coordinates
 */
export function getNeighbors(tileX, tileY) {
  return CARDINAL_DIRECTIONS.map(d => ({
    x: tileX + d.dx,
    y: tileY + d.dy,
  }));
}

/**
 * Get all 8 neighboring tile coordinates.
 *
 * @param {number} tileX - Center tile X
 * @param {number} tileY - Center tile Y
 * @returns {Array<{x: number, y: number}>} Array of 8 neighbor coordinates
 */
export function getNeighbors8(tileX, tileY) {
  return DIRECTIONS_8.map(d => ({
    x: tileX + d.dx,
    y: tileY + d.dy,
  }));
}

/**
 * Get the neighbor in a specific direction.
 * 0=North, 1=East, 2=South, 3=West
 *
 * @param {number} tileX - Starting tile X
 * @param {number} tileY - Starting tile Y
 * @param {number} direction - Direction index 0-3
 * @returns {{x: number, y: number}} Neighbor coordinate
 */
export function getNeighbor(tileX, tileY, direction) {
  const d = CARDINAL_DIRECTIONS[direction & 3];
  return { x: tileX + d.dx, y: tileY + d.dy };
}

// =============================================================================
// HIT TESTING
// =============================================================================

/**
 * Test if a screen point is inside a given tile's diamond shape.
 * Uses the diamond inequality: |dx|/w + |dy|/h <= 1
 *
 * @param {number} screenX - Screen X coordinate to test
 * @param {number} screenY - Screen Y coordinate to test
 * @param {number} tileX - Tile X coordinate
 * @param {number} tileY - Tile Y coordinate
 * @param {number} [cameraX=0] - Camera X offset
 * @param {number} [cameraY=0] - Camera Y offset
 * @param {number} [zoom=1] - Zoom level
 * @returns {boolean} True if the point is inside the tile
 */
export function isPointInTile(screenX, screenY, tileX, tileY, cameraX = 0, cameraY = 0, zoom = 1) {
  const ts = tileToScreen(tileX, tileY, cameraX, cameraY, zoom);
  const dx = Math.abs(screenX - ts.screenX);
  const dy = Math.abs(screenY - ts.screenY);
  return (dx / (HALF_TILE_WIDTH * zoom) + dy / (HALF_TILE_HEIGHT * zoom)) <= 1.0;
}

/**
 * Test if a screen point is inside a diamond of given center and size.
 *
 * @param {number} screenX - Screen X coordinate to test
 * @param {number} screenY - Screen Y coordinate to test
 * @param {number} centerX - Diamond center X
 * @param {number} centerY - Diamond center Y
 * @param {number} halfW - Half width of diamond
 * @param {number} halfH - Half height of diamond
 * @returns {boolean} True if the point is inside
 */
export function isPointInDiamond(screenX, screenY, centerX, centerY, halfW, halfH) {
  const dx = Math.abs(screenX - centerX);
  const dy = Math.abs(screenY - centerY);
  return (dx / halfW + dy / halfH) <= 1.0;
}

// =============================================================================
// SORTING / Z-LAYERING
// =============================================================================

/**
 * Compute a depth sort key for an object at a given tile and Z layer.
 * The sort key ensures proper back-to-front rendering in isometric projection.
 * Items with lower sort keys are drawn first (behind).
 *
 * Formula: (tileX + tileY) * MAX_Z + zLayer
 *
 * @param {number} tileX - Tile X coordinate
 * @param {number} tileY - Tile Y coordinate
 * @param {number} [zLayer=0] - Vertical Z layer offset (0 = floor)
 * @returns {number} Sort key for depth ordering
 */
export function getSortKey(tileX, tileY, zLayer = 0) {
  return (tileX + tileY) * SORT_KEY_MULTIPLIER + zLayer;
}

/**
 * Get a sort key that also incorporates sub-tile position for smooth sorting.
 * Used for entities between tiles.
 *
 * @param {number} tileX - Float tile X coordinate
 * @param {number} tileY - Float tile Y coordinate
 * @param {number} [zLayer=0] - Vertical Z layer offset
 * @returns {number} Fine-grained sort key
 */
export function getSortKeyFloat(tileX, tileY, zLayer = 0) {
  return (tileX + tileY) * SORT_KEY_MULTIPLIER + zLayer;
}

/**
 * Compare two objects by their sort keys for Array.sort().
 *
 * @param {{sortKey: number}} a - First object
 * @param {{sortKey: number}} b - Second object
 * @returns {number} Negative if a before b, positive if a after b
 */
export function compareSortKey(a, b) {
  return a.sortKey - b.sortKey;
}

// =============================================================================
// WORLD <-> SCREEN WITH Z-HEIGHT
// =============================================================================

/**
 * Convert world coordinates (float tile position + height) to screen coordinates.
 * Accounts for Z-height by offsetting screenY upward.
 *
 * @param {number} x - World X coordinate (float tile position)
 * @param {number} y - World Y coordinate (float tile position)
 * @param {number} [z=0] - Z height in pixels (vertical elevation)
 * @returns {{screenX: number, screenY: number}} Screen coordinates
 */
export function projectIso(x, y, z = 0) {
  const screenX = (x - y) * HALF_TILE_WIDTH;
  const screenY = (x + y) * HALF_TILE_HEIGHT - z;
  return { screenX, screenY };
}

/**
 * Convert screen coordinates back to world coordinates (without z).
 * This gives the floor position; inverse of projectIso at z=0.
 *
 * @param {number} screenX - Screen X coordinate
 * @param {number} screenY - Screen Y coordinate
 * @returns {{worldX: number, worldY: number}} World float coordinates
 */
export function unprojectIso(screenX, screenY) {
  const worldX = (screenX / HALF_TILE_WIDTH + screenY / HALF_TILE_HEIGHT) / 2;
  const worldY = (screenY / HALF_TILE_HEIGHT - screenX / HALF_TILE_WIDTH) / 2;
  return { worldX, worldY };
}

/**
 * Convert screen coordinates back to world coordinates accounting for z-height.
 * The screenY is offset upward by z pixels, so we add it back.
 *
 * @param {number} screenX - Screen X coordinate
 * @param {number} screenY - Screen Y coordinate
 * @param {number} [z=0] - Z height in pixels
 * @returns {{worldX: number, worldY: number}} World float coordinates
 */
export function unprojectIsoWithZ(screenX, screenY, z = 0) {
  const adjustedY = screenY + z;
  const worldX = (screenX / HALF_TILE_WIDTH + adjustedY / HALF_TILE_HEIGHT) / 2;
  const worldY = (adjustedY / HALF_TILE_HEIGHT - screenX / HALF_TILE_WIDTH) / 2;
  return { worldX, worldY };
}

// =============================================================================
// SNAPPING
// =============================================================================

/**
 * Snap world coordinates to the nearest tile center.
 *
 * @param {number} worldX - World X float coordinate
 * @param {number} worldY - World Y float coordinate
 * @returns {{tileX: number, tileY: number}} Nearest integer tile coordinates
 */
export function snapToGrid(worldX, worldY) {
  return {
    tileX: Math.round(worldX),
    tileY: Math.round(worldY),
  };
}

/**
 * Snap world coordinates to the nearest tile center and return screen position.
 *
 * @param {number} worldX - World X float coordinate
 * @param {number} worldY - World Y float coordinate
 * @returns {{screenX: number, screenY: number}} Screen position of snapped tile
 */
export function snapToGridScreen(worldX, worldY) {
  const tileX = Math.round(worldX);
  const tileY = Math.round(worldY);
  return tileToScreenf(tileX, tileY);
}

// =============================================================================
// BOUNDS / FRAMING
// =============================================================================

/**
 * Get the bounding box of a set of tiles in tile coordinates.
 * Useful for camera framing around a room or map section.
 *
 * @param {Array<{x: number, y: number}>} tiles - Array of tile coordinates
 * @returns {{minX: number, minY: number, maxX: number, maxY: number, width: number, height: number}} Bounds object
 */
export function getTileBounds(tiles) {
  if (!tiles || tiles.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const tile of tiles) {
    if (tile.x < minX) minX = tile.x;
    if (tile.y < minY) minY = tile.y;
    if (tile.x > maxX) maxX = tile.x;
    if (tile.y > maxY) maxY = tile.y;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Get the screen-space bounding rectangle of a set of tiles.
 * This is the axis-aligned bounding box of the tile diamonds.
 *
 * @param {Array<{x: number, y: number}>} tiles - Array of tile coordinates
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}} Screen bounds
 */
export function getTileScreenBounds(tiles) {
  if (!tiles || tiles.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const tile of tiles) {
    const corners = getTileCorners(tile.x, tile.y);
    for (const corner of corners) {
      if (corner.x < minX) minX = corner.x;
      if (corner.y < minY) minY = corner.y;
      if (corner.x > maxX) maxX = corner.x;
      if (corner.y > maxY) maxY = corner.y;
    }
  }

  return { minX, minY, maxX, maxY };
}

// =============================================================================
// COLOR UTILITIES
// =============================================================================

/**
 * Parse a hex color string to RGB components.
 *
 * @param {string} hex - Hex color string (e.g., "#RRGGBB" or "#RGB")
 * @returns {{r: number, g: number, b: number}} RGB components 0-255
 */
export function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean.length === 3
    ? clean.split("").map(c => c + c).join("")
    : clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/**
 * Convert RGB components to a hex color string.
 *
 * @param {number} r - Red 0-255
 * @param {number} g - Green 0-255
 * @param {number} b - Blue 0-255
 * @returns {string} Hex color string
 */
export function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Lighten a hex color by a given percentage.
 *
 * @param {string} hex - Base hex color
 * @param {number} percent - Percentage to lighten (0-100)
 * @returns {string} Lightened hex color
 */
export function lightenColor(hex, percent) {
  const rgb = hexToRgb(hex);
  const factor = percent / 100;
  return rgbToHex(
    Math.min(255, Math.round(rgb.r + (255 - rgb.r) * factor)),
    Math.min(255, Math.round(rgb.g + (255 - rgb.g) * factor)),
    Math.min(255, Math.round(rgb.b + (255 - rgb.b) * factor)),
  );
}

/**
 * Darken a hex color by a given percentage.
 *
 * @param {string} hex - Base hex color
 * @param {number} percent - Percentage to darken (0-100)
 * @returns {string} Darkened hex color
 */
export function darkenColor(hex, percent) {
  const rgb = hexToRgb(hex);
  const factor = 1 - percent / 100;
  return rgbToHex(
    Math.max(0, Math.round(rgb.r * factor)),
    Math.max(0, Math.round(rgb.g * factor)),
    Math.max(0, Math.round(rgb.b * factor)),
  );
}

// =============================================================================
// LINE / RASTERIZATION
// =============================================================================

/**
 * Get all tiles along a line between two tile coordinates.
 * Uses a modified Bresenham algorithm for isometric grids.
 *
 * @param {number} x0 - Start tile X
 * @param {number} y0 - Start tile Y
 * @param {number} x1 - End tile X
 * @param {number} y1 - End tile Y
 * @returns {Array<{x: number, y: number}>} Tiles along the line
 */
export function getLineTiles(x0, y0, x1, y1) {
  const tiles = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  while (true) {
    tiles.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return tiles;
}

/**
 * Get all tiles within a circular radius of a center tile.
 *
 * @param {number} centerX - Center tile X
 * @param {number} centerY - Center tile Y
 * @param {number} radius - Radius in tiles
 * @returns {Array<{x: number, y: number}>} Tiles within the radius
 */
export function getTilesInRadius(centerX, centerY, radius) {
  const tiles = [];
  const r2 = radius * radius;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (dx * dx + dy * dy <= r2) {
        tiles.push({ x: centerX + dx, y: centerY + dy });
      }
    }
  }
  return tiles;
}

// =============================================================================
// ZOOM UTILITIES
// =============================================================================

/**
 * Apply zoom to a screen coordinate.
 *
 * @param {number} value - Screen pixel value
 * @param {number} zoom - Zoom level
 * @returns {number} Zoomed value
 */
export function applyZoom(value, zoom) {
  return Math.round(value * zoom);
}

/**
 * Reverse zoom from a screen coordinate.
 *
 * @param {number} value - Zoomed pixel value
 * @param {number} zoom - Zoom level
 * @returns {number} Unzoomed value
 */
export function removeZoom(value, zoom) {
  return value / zoom;
}

/**
 * Clamp a zoom level to valid integer multiples.
 * Supports 1x, 2x, 3x for pixel-perfect rendering.
 *
 * @param {number} zoom - Requested zoom level
 * @returns {number} Clamped zoom (1, 2, or 3)
 */
export function clampZoom(zoom) {
  return Math.max(1, Math.min(3, Math.round(zoom)));
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

/**
 * Static class wrapper for all IsoMath functions.
 * Can be used as a namespace or instantiated for convenience.
 */
export default class IsoMath {
  static get TILE_WIDTH() { return TILE_WIDTH; }
  static get TILE_HEIGHT() { return TILE_HEIGHT; }
  static get WALL_HEIGHT() { return WALL_HEIGHT; }
  static get HALF_TILE_WIDTH() { return HALF_TILE_WIDTH; }
  static get HALF_TILE_HEIGHT() { return HALF_TILE_HEIGHT; }
  static get MAX_Z_LAYER() { return MAX_Z_LAYER; }

  static tileToScreen(tileX, tileY, cameraX, cameraY, zoom) {
    return tileToScreen(tileX, tileY, cameraX, cameraY, zoom);
  }

  static screenToTile(screenX, screenY, cameraX, cameraY, zoom) {
    return screenToTile(screenX, screenY, cameraX, cameraY, zoom);
  }

  static tileToScreenf(tileX, tileY) {
    return tileToScreenf(tileX, tileY);
  }

  static getTileCorners(tileX, tileY) {
    return getTileCorners(tileX, tileY);
  }

  static getTileTop(tileX, tileY) {
    return getTileTop(tileX, tileY);
  }

  static getTileCenter(tileX, tileY) {
    return getTileCenter(tileX, tileY);
  }

  static distanceTile(a, b) {
    return distanceTile(a, b);
  }

  static distanceTileChebyshev(a, b) {
    return distanceTileChebyshev(a, b);
  }

  static getNeighbors(tileX, tileY) {
    return getNeighbors(tileX, tileY);
  }

  static getNeighbors8(tileX, tileY) {
    return getNeighbors8(tileX, tileY);
  }

  static isPointInTile(screenX, screenY, tileX, tileY, cameraX, cameraY, zoom) {
    return isPointInTile(screenX, screenY, tileX, tileY, cameraX, cameraY, zoom);
  }

  static getSortKey(tileX, tileY, zLayer) {
    return getSortKey(tileX, tileY, zLayer);
  }

  static snapToGrid(worldX, worldY) {
    return snapToGrid(worldX, worldY);
  }

  static projectIso(x, y, z) {
    return projectIso(x, y, z);
  }

  static unprojectIso(screenX, screenY) {
    return unprojectIso(screenX, screenY);
  }

  static getTileBounds(tiles) {
    return getTileBounds(tiles);
  }

  static lightenColor(hex, percent) {
    return lightenColor(hex, percent);
  }

  static darkenColor(hex, percent) {
    return darkenColor(hex, percent);
  }
}

// ── Adapter class for main.js compatibility ──
export class IsoMath {
  constructor(opts = {}) {
    this.tileW = opts.tileW || TILE_WIDTH;
    this.tileH = opts.tileH || TILE_HEIGHT;
    this.tileD = opts.tileD || 16;
    this.halfW = this.tileW / 2;
    this.halfH = this.tileH / 2;
  }
  tileToScreen(tx, ty) { return tileToScreen(tx, ty, this.tileW, this.tileH); }
  screenToTile(sx, sy) { return screenToTile(sx, sy, this.tileW, this.tileH); }
  isoSort(a, b) { return isoSort(a, b); }
  getNeighborOffsets() { return getNeighborOffsets(); }
  manhattanDistance(a, b) { return manhattanDistance(a, b); }
}
