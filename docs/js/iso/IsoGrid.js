/**
 * @file IsoGrid.js
 * @description Grid overlay and interaction system for Starlight Inn v6.0.
 * Draws faint diamond grid lines, highlights tiles on hover and click,
 * visualizes movement paths, shows occupied/walkable debug overlays,
 * and handles mouse interaction with the isometric tilemap.
 *
 * Works alongside IsoTilemap and IsoMovement to provide the player
 * with visual feedback about the grid state.
 *
 * @module iso/IsoGrid
 */

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  HALF_TILE_WIDTH,
  HALF_TILE_HEIGHT,
  tileToScreen,
  screenToTile,
  isPointInTile,
} from './IsoMath.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default opacity for grid lines. */
export const DEFAULT_GRID_ALPHA = 0.18;

/** Default grid line color. */
export const DEFAULT_GRID_COLOR = '255, 255, 255';

/** Default hover highlight color. */
export const DEFAULT_HOVER_COLOR = 'rgba(80, 200, 255, 0.35)';

/** Default path highlight color. */
export const DEFAULT_PATH_COLOR = 'rgba(100, 255, 100, 0.4)';

/** Color for occupied/furniture tiles. */
export const OCCUPIED_TINT = 'rgba(255, 60, 60, 0.25)';

/** Color for walkable tile debug overlay. */
export const WALKABLE_TINT = 'rgba(60, 255, 100, 0.15)';

/** Color for non-walkable tile debug overlay. */
export const UNWALKABLE_TINT = 'rgba(255, 60, 60, 0.2)';

/** Tile hop offset for movement animation (pixels). */
export const TILE_HOP_OFFSET = 2;

// =============================================================================
// IsoGrid CLASS
// =============================================================================

/**
 * Grid overlay and interaction system for isometric tilemaps.
 * Handles rendering of grid lines, tile highlights, path visualization,
 * and mouse-based tile selection.
 */
export default class IsoGrid {
  /**
   * @param {Object} game - The main Game instance (provides canvas, input).
   * @param {IsoTilemap} tilemap - The tilemap to overlay.
   */
  constructor(game, tilemap) {
    /** @type {Object} Game instance reference. */
    this.game = game;

    /** @type {IsoTilemap} The tilemap being overlaid. */
    this.tilemap = tilemap;

    /** @type {boolean} Whether to show coordinate labels on tiles. */
    this.showCoords = false;

    /** @type {boolean} Whether to show depth sort key on tiles. */
    this.showDepth = false;

    /** @type {boolean} Whether to show walkable/unwalkable overlay. */
    this.showWalkable = false;

    /** @type {boolean} Whether grid lines are visible. */
    this.showGridLines = true;

    /** @type {{tileX:number, tileY:number}|null} Currently hovered tile. */
    this._hoveredTile = null;

    /** @type {{tileX:number, tileY:number, color:string}|null} Active highlight. */
    this._highlightedTile = null;

    /** @type {Array<{x:number, y:number}>} Current path tiles. */
    this._pathTiles = [];

    /** @type {string} Current path color. */
    this._pathColor = DEFAULT_PATH_COLOR;

    /** @type {Array<Function>} Click callback registry. */
    this._clickCallbacks = [];

    /** @type {Array<Function>} Hover callback registry. */
    this._hoverCallbacks = [];

    /** @type {number} Grid line alpha (0..1). */
    this.gridAlpha = DEFAULT_GRID_ALPHA;

    /** @type {string} Grid RGB color string without alpha. */
    this.gridColor = DEFAULT_GRID_COLOR;

    /** @type {boolean} Whether to show occupied tiles in red. */
    this._showOccupied = false;

    /** @type {boolean} Whether to show walkable tiles in green. */
    this._showWalkableOverlay = false;

    /** @type {number} Canvas width (updated from game). */
    this._canvasWidth = 0;

    /** @type {number} Canvas height (updated from game). */
    this._canvasHeight = 0;
  }

  // =============================================================================
  // RENDERING
  // =============================================================================

  /**
   * Render the grid overlay.
   * Draws grid lines, highlights, paths, and debug overlays.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context.
   * @param {{x:number, y:number, zoom?:number}} camera - Camera with offset.
   */
  render(ctx, camera) {
    if (!this.tilemap) return;

    const camX = camera?.x ?? 0;
    const camY = camera?.y ?? 0;
    const zoom = camera?.zoom ?? 1;

    this._canvasWidth = ctx.canvas?.width || 0;
    this._canvasHeight = ctx.canvas?.height || 0;

    if (this.showGridLines) {
      this._renderGridLines(ctx, camX, camY, zoom);
    }

    if (this.showWalkable || this._showWalkableOverlay) {
      this._renderWalkableOverlay(ctx, camX, camY, zoom);
    }

    if (this._showOccupied) {
      this._renderOccupiedOverlay(ctx, camX, camY, zoom);
    }

    if (this._pathTiles.length > 0) {
      this._renderPath(ctx, camX, camY, zoom);
    }

    if (this._highlightedTile) {
      this._renderHighlight(ctx, this._highlightedTile.tileX, this._highlightedTile.tileY, this._highlightedTile.color, camX, camY, zoom);
    }

    if (this._hoveredTile) {
      this._renderHighlight(ctx, this._hoveredTile.tileX, this._hoveredTile.tileY, DEFAULT_HOVER_COLOR, camX, camY, zoom);
    }

    if (this.showCoords || this.showDepth) {
      this._renderDebugLabels(ctx, camX, camY, zoom);
    }
  }

  /**
   * Render faint diamond grid lines on all tiles.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} camX - Camera X offset.
   * @param {number} camY - Camera Y offset.
   * @param {number} zoom - Zoom level.
   * @private
   */
  _renderGridLines(ctx, camX, camY, zoom) {
    const hw = HALF_TILE_WIDTH * zoom;
    const hh = HALF_TILE_HEIGHT * zoom;
    const alpha = Math.max(0.05, Math.min(1, this.gridAlpha));

    ctx.strokeStyle = `rgba(${this.gridColor}, ${alpha})`;
    ctx.lineWidth = Math.max(0.5, 0.5 * zoom);

    const w = this.tilemap.width;
    const h = this.tilemap.height;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const { screenX, screenY } = tileToScreen(x, y, camX, camY, zoom);
        const tile = this.tilemap.getTile(x, y);
        const zOffset = (tile?.z || 0) * zoom;

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

  /**
   * Render a colored highlight on a specific tile.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} tileX - Tile X.
   * @param {number} tileY - Tile Y.
   * @param {string} color - CSS color string.
   * @param {number} camX - Camera X.
   * @param {number} camY - Camera Y.
   * @param {number} zoom - Zoom level.
   * @private
   */
  _renderHighlight(ctx, tileX, tileY, color, camX, camY, zoom) {
    if (tileX < 0 || tileY < 0 || tileX >= this.tilemap.width || tileY >= this.tilemap.height) {
      return;
    }

    const hw = HALF_TILE_WIDTH * zoom;
    const hh = HALF_TILE_HEIGHT * zoom;
    const { screenX, screenY } = tileToScreen(tileX, tileY, camX, camY, zoom);
    const tile = this.tilemap.getTile(tileX, tileY);
    const zOffset = (tile?.z || 0) * zoom;

    ctx.beginPath();
    ctx.moveTo(screenX, screenY - hh - zOffset);
    ctx.lineTo(screenX + hw, screenY - zOffset);
    ctx.lineTo(screenX, screenY + hh - zOffset);
    ctx.lineTo(screenX - hw, screenY - zOffset);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
  }

  /**
   * Render walkable/unwalkable debug overlay.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} camX - Camera X.
   * @param {number} camY - Camera Y.
   * @param {number} zoom - Zoom level.
   * @private
   */
  _renderWalkableOverlay(ctx, camX, camY, zoom) {
    for (let y = 0; y < this.tilemap.height; y++) {
      for (let x = 0; x < this.tilemap.width; x++) {
        const isWalkable = this.tilemap.isWalkable(x, y);
        const color = isWalkable ? WALKABLE_TINT : UNWALKABLE_TINT;
        this._renderHighlight(ctx, x, y, color, camX, camY, zoom);
      }
    }
  }

  /**
   * Render occupied tile overlay (furniture blockers).
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} camX - Camera X.
   * @param {number} camY - Camera Y.
   * @param {number} zoom - Zoom level.
   * @private
   */
  _renderOccupiedOverlay(ctx, camX, camY, zoom) {
    const furnished = this.tilemap.getFurnishedTiles();
    for (const entry of furnished) {
      if (entry.furniture && entry.furniture.blocksMovement) {
        this._renderHighlight(ctx, entry.x, entry.y, OCCUPIED_TINT, camX, camY, zoom);
      }
    }
  }

  /**
   * Render the movement path as connected diamond centers.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} camX - Camera X.
   * @param {number} camY - Camera Y.
   * @param {number} zoom - Zoom level.
   * @private
   */
  _renderPath(ctx, camX, camY, zoom) {
    if (this._pathTiles.length < 2) return;

    const hw = HALF_TILE_WIDTH * zoom;
    const hh = HALF_TILE_HEIGHT * zoom;

    // Draw path line connecting tile centers
    ctx.strokeStyle = this._pathColor;
    ctx.lineWidth = 2 * zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([4 * zoom, 4 * zoom]);

    ctx.beginPath();
    let first = true;
    for (const pt of this._pathTiles) {
      const { screenX, screenY } = tileToScreen(pt.x, pt.y, camX, camY, zoom);
      if (first) {
        ctx.moveTo(screenX, screenY);
        first = false;
      } else {
        ctx.lineTo(screenX, screenY);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw small diamond markers at each path tile
    for (const pt of this._pathTiles) {
      this._renderHighlight(ctx, pt.x, pt.y, this._pathColor, camX, camY, zoom);
    }

    // Draw destination marker (brighter)
    const dest = this._pathTiles[this._pathTiles.length - 1];
    const { screenX, screenY } = tileToScreen(dest.x, dest.y, camX, camY, zoom);

    ctx.beginPath();
    ctx.arc(screenX, screenY - hh * 0.5, 3 * zoom, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 100, 0.8)';
    ctx.fill();
  }

  /**
   * Render debug labels (coordinates and depth) on tiles.
   *
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} camX - Camera X.
   * @param {number} camY - Camera Y.
   * @param {number} zoom - Zoom level.
   * @private
   */
  _renderDebugLabels(ctx, camX, camY, zoom) {
    const fontSize = Math.max(6, Math.floor(8 * zoom));
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = 0; y < this.tilemap.height; y++) {
      for (let x = 0; x < this.tilemap.width; x++) {
        const { screenX, screenY } = tileToScreen(x, y, camX, camY, zoom);
        const tile = this.tilemap.getTile(x, y);
        const zOffset = (tile?.z || 0) * zoom;

        let label = '';
        if (this.showCoords && this.showDepth) {
          label = `${x},${y}|${x + y}`;
        } else if (this.showCoords) {
          label = `${x},${y}`;
        } else if (this.showDepth) {
          label = `${x + y}`;
        }

        if (label) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fillText(label, screenX, screenY - zOffset);
        }
      }
    }
  }

  // =============================================================================
  // HIGHLIGHT API
  // =============================================================================

  /**
   * Highlight a specific tile with a color.
   *
   * @param {number} tileX - Tile X.
   * @param {number} tileY - Tile Y.
   * @param {string} [color=DEFAULT_HOVER_COLOR] - CSS color string.
   */
  highlightTile(tileX, tileY, color = DEFAULT_HOVER_COLOR) {
    this._highlightedTile = { tileX, tileY, color };
  }

  /**
   * Clear the current highlight.
   */
  clearHighlight() {
    this._highlightedTile = null;
  }

  // =============================================================================
  // PATH API
  // =============================================================================

  /**
   * Show a movement path visualization.
   *
   * @param {Array<{x:number, y:number}>} path - Array of tile coordinates.
   * @param {string} [color=DEFAULT_PATH_COLOR] - Path color.
   */
  showPath(path, color = DEFAULT_PATH_COLOR) {
    this._pathTiles = path ? [...path] : [];
    this._pathColor = color;
  }

  /**
   * Clear the path visualization.
   */
  clearPath() {
    this._pathTiles = [];
  }

  // =============================================================================
  // DEBUG OVERLAYS
  // =============================================================================

  /**
   * Show occupied tiles (furniture that blocks movement) in red tint.
   */
  showOccupiedTiles() {
    this._showOccupied = true;
  }

  /**
   * Hide occupied tile overlay.
   */
  hideOccupiedTiles() {
    this._showOccupied = false;
  }

  /**
   * Show walkable tiles in green tint, unwalkable in red.
   */
  showWalkableTiles() {
    this._showWalkableOverlay = true;
  }

  /**
   * Hide walkable tile overlay.
   */
  hideWalkableTiles() {
    this._showWalkableOverlay = false;
  }

  /**
   * Toggle coordinate display.
   *
   * @param {boolean} [show] - Force state, or toggle if omitted.
   */
  toggleCoords(show) {
    this.showCoords = show !== undefined ? show : !this.showCoords;
  }

  /**
   * Toggle depth sort key display.
   *
   * @param {boolean} [show] - Force state, or toggle if omitted.
   */
  toggleDepth(show) {
    this.showDepth = show !== undefined ? show : !this.showDepth;
  }

  /**
   * Toggle walkable overlay.
   *
   * @param {boolean} [show] - Force state, or toggle if omitted.
   */
  toggleWalkable(show) {
    this.showWalkable = show !== undefined ? show : !this.showWalkable;
  }

  /**
   * Toggle grid lines.
   *
   * @param {boolean} [show] - Force state, or toggle if omitted.
   */
  toggleGrid(show) {
    this.showGridLines = show !== undefined ? show : !this.showGridLines;
  }

  // =============================================================================
  // INTERACTION HANDLERS
  // =============================================================================

  /**
   * Register a tile click callback.
   *
   * @param {Function} callback - Function(tileX, tileY, tile) called on click.
   */
  onTileClick(callback) {
    if (typeof callback === 'function') {
      this._clickCallbacks.push(callback);
    }
  }

  /**
   * Register a tile hover callback.
   *
   * @param {Function} callback - Function(tileX, tileY, tile) called on hover.
   */
  onTileHover(callback) {
    if (typeof callback === 'function') {
      this._hoverCallbacks.push(callback);
    }
  }

  /**
   * Remove a click callback.
   *
   * @param {Function} callback - Callback to remove.
   */
  offTileClick(callback) {
    this._clickCallbacks = this._clickCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Remove a hover callback.
   *
   * @param {Function} callback - Callback to remove.
   */
  offTileHover(callback) {
    this._hoverCallbacks = this._hoverCallbacks.filter(cb => cb !== callback);
  }

  // =============================================================================
  // MOUSE UPDATE
  // =============================================================================

  /**
   * Update the grid state based on current mouse position.
   * Should be called every frame or on mouse move.
   *
   * @param {number} mouseX - Mouse X in screen pixels.
   * @param {number} mouseY - Mouse Y in screen pixels.
   * @param {{x:number, y:number, zoom?:number}} camera - Camera.
   */
  update(mouseX, mouseY, camera) {
    if (!this.tilemap) return;

    const tilePos = this.tilemap.getTileAtScreenPrecise(mouseX, mouseY, camera);

    if (!tilePos) {
      if (this._hoveredTile) {
        this._hoveredTile = null;
      }
      return;
    }

    const { tileX, tileY } = tilePos;

    // Only fire callbacks when tile changes
    if (!this._hoveredTile || this._hoveredTile.tileX !== tileX || this._hoveredTile.tileY !== tileY) {
      this._hoveredTile = { tileX, tileY };
      const tile = this.tilemap.getTile(tileX, tileY);

      for (const cb of this._hoverCallbacks) {
        try {
          cb(tileX, tileY, tile);
        } catch (e) {
          console.error('Grid hover callback error:', e);
        }
      }
    }
  }

  /**
   * Handle a mouse click event.
   *
   * @param {number} mouseX - Mouse X.
   * @param {number} mouseY - Mouse Y.
   * @param {{x:number, y:number, zoom?:number}} camera - Camera.
   * @returns {{tileX:number, tileY:number, tile:Object}|null} Clicked tile.
   */
  handleClick(mouseX, mouseY, camera) {
    if (!this.tilemap) return null;

    const tilePos = this.tilemap.getTileAtScreenPrecise(mouseX, mouseY, camera);
    if (!tilePos) return null;

    const { tileX, tileY } = tilePos;
    const tile = this.tilemap.getTile(tileX, tileY);

    for (const cb of this._clickCallbacks) {
      try {
        cb(tileX, tileY, tile);
      } catch (e) {
        console.error('Grid click callback error:', e);
      }
    }

    return { tileX, tileY, tile };
  }

  // =============================================================================
  // SNAPPING
  // =============================================================================

  /**
   * Snap screen coordinates to the nearest tile center.
   *
   * @param {number} screenX - Screen X pixel.
   * @param {number} screenY - Screen Y pixel.
   * @param {{x:number, y:number, zoom?:number}} camera - Camera.
   * @returns {{tileX:number, tileY:number, screenX:number, screenY:number}|null} Snapped position.
   */
  snapToGrid(screenX, screenY, camera) {
    if (!this.tilemap) return null;

    const camX = camera?.x ?? 0;
    const camY = camera?.y ?? 0;
    const zoom = camera?.zoom ?? 1;

    const { tileX, tileY } = screenToTile(screenX, screenY, camX, camY, zoom);
    const clampedX = Math.max(0, Math.min(this.tilemap.width - 1, tileX));
    const clampedY = Math.max(0, Math.min(this.tilemap.height - 1, tileY));

    const center = tileToScreen(clampedX, clampedY, camX, camY, zoom);
    return {
      tileX: clampedX,
      tileY: clampedY,
      screenX: center.screenX,
      screenY: center.screenY,
    };
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
   * Check if a tile is currently hovered.
   *
   * @param {number} tileX - Tile X.
   * @param {number} tileY - Tile Y.
   * @returns {boolean} True if this tile is hovered.
   */
  isHovered(tileX, tileY) {
    return this._hoveredTile !== null
      && this._hoveredTile.tileX === tileX
      && this._hoveredTile.tileY === tileY;
  }

  // =============================================================================
  // GRID PROPERTIES
  // =============================================================================

  /**
   * Set the grid line alpha.
   *
   * @param {number} alpha - Alpha 0..1.
   */
  setGridAlpha(alpha) {
    this.gridAlpha = Math.max(0, Math.min(1, alpha));
  }

  /**
   * Set the grid line color.
   *
   * @param {string} rgb - RGB string like '255, 255, 255'.
   */
  setGridColor(rgb) {
    this.gridColor = rgb;
  }

  /**
   * Set the path visualization color.
   *
   * @param {string} color - CSS color string.
   */
  setPathColor(color) {
    this._pathColor = color;
  }

  // =============================================================================
  // DESTRUCTION
  // =============================================================================

  /**
   * Clean up all callbacks and references.
   */
  destroy() {
    this._clickCallbacks = [];
    this._hoverCallbacks = [];
    this._hoveredTile = null;
    this._highlightedTile = null;
    this._pathTiles = [];
    this.tilemap = null;
    this.game = null;
  }
}
