/**
 * IsoGrid.js -- v6.0
 * Tile highlighting, path visualization, and interaction overlay.
 */

export class IsoGrid {
  constructor(isoMath, tilemap, canvasId = 'game-canvas') {
    this.isoMath = isoMath;
    this.tilemap = tilemap;
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.highlighted = null;
    this.path = [];
    this.selection = null;
    this.hoverColor = 'rgba(0, 229, 255, 0.35)';
    this.pathColor = 'rgba(255, 235, 59, 0.25)';
    this.selectionColor = 'rgba(0, 230, 118, 0.45)';
    this._callbacks = [];
  }

  /**
   * Screen coords -> tile coords.
   */
  screenToTile(sx, sy, cameraOffset = { x: 0, y: 0 }) {
    const isoX = sx - cameraOffset.x;
    const isoY = sy - cameraOffset.y;
    return this.isoMath.screenToTile(isoX, isoY);
  }

  /**
   * Highlight a tile.
   */
  highlight(tileX, tileY) {
    this.highlighted = { x: tileX, y: tileY };
  }

  clearHighlight() {
    this.highlighted = null;
  }

  /**
   * Set the current path to visualize.
   */
  setPath(path) {
    this.path = path || [];
  }

  clearPath() {
    this.path = [];
  }

  /**
   * Select a tile.
   */
  select(tileX, tileY) {
    this.selection = { x: tileX, y: tileY };
  }

  clearSelection() {
    this.selection = null;
  }

  /**
   * Register a click callback: fn(tileX, tileY, tile).
   */
  onClick(fn) {
    this._callbacks.push(fn);
    if (this._callbacks.length === 1) {
      this._bindEvents();
    }
  }

  _bindEvents() {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      const tile = this.screenToTile(sx, sy);
      if (tile) {
        this.select(tile.x, tile.y);
        for (const fn of this._callbacks) {
          fn(tile.x, tile.y, this.tilemap.get(tile.x, tile.y));
        }
      }
    });
  }

  /**
   * Draw grid overlay (highlights, path, selection).
   */
  draw(cameraOffset = { x: 0, y: 0 }) {
    // Draw highlighted tile
    if (this.highlighted) {
      this._drawTileOverlay(this.highlighted.x, this.highlighted.y, this.hoverColor, cameraOffset);
    }

    // Draw path
    for (const p of this.path) {
      this._drawTileOverlay(p.x, p.y, this.pathColor, cameraOffset);
    }

    // Draw selection
    if (this.selection) {
      this._drawTileOverlay(this.selection.x, this.selection.y, this.selectionColor, cameraOffset);
    }
  }

  _drawTileOverlay(tx, ty, color, cameraOffset) {
    const screen = this.isoMath.tileToScreen(tx, ty);
    const x = screen.x + cameraOffset.x;
    const y = screen.y + cameraOffset.y;
    const hw = this.isoMath.tileW / 2;
    const hh = this.isoMath.tileH / 2;

    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - hh);
    this.ctx.lineTo(x + hw, y);
    this.ctx.lineTo(x, y + hh);
    this.ctx.lineTo(x - hw, y);
    this.ctx.closePath();
    this.ctx.fill();
  }
}

export default IsoGrid;
