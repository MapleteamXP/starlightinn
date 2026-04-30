/**
 * IsoMovement.js -- v6.0
 * Habbo-style grid-locked tile-by-tile stepping.
 */

export class IsoMovement {
  constructor(isoMath, tilemap, entity) {
    this.isoMath = isoMath;
    this.tilemap = tilemap;
    this.entity = entity;
    this.path = [];
    this.stepProgress = 0;
    this.stepDuration = 300; // ms per tile
    this.isMoving = false;
    this.currentTile = { x: entity?.x || 0, y: entity?.y || 0 };
    this.nextTile = null;
    this.facing = 's';
    this._onStep = null;
    this._onArrive = null;
  }

  /**
   * Move entity to target tile using pathfinding.
   */
  moveTo(targetX, targetY) {
    const path = this.tilemap.findPath(this.currentTile.x, this.currentTile.y, targetX, targetY);
    if (path.length > 1) {
      this.path = path.slice(1); // skip current tile
      this.isMoving = true;
      this.stepProgress = 0;
      this._advanceStep();
    }
  }

  /**
   * Instant warp (no animation).
   */
  warpTo(x, y) {
    this.currentTile = { x, y };
    this.path = [];
    this.isMoving = false;
    this.stepProgress = 0;
    this.nextTile = null;
    if (this.entity) {
      this.entity.x = x;
      this.entity.y = y;
    }
  }

  /**
   * Update movement interpolation.
   */
  update(dt) {
    if (!this.isMoving || !this.nextTile) return;

    this.stepProgress += dt;
    const t = Math.min(this.stepProgress / this.stepDuration, 1);

    if (this.entity) {
      const from = this.isoMath.tileToScreen(this.currentTile.x, this.currentTile.y);
      const to = this.isoMath.tileToScreen(this.nextTile.x, this.nextTile.y);
      this.entity.renderX = from.x + (to.x - from.x) * t;
      this.entity.renderY = from.y + (to.y - from.y) * t;
    }

    if (t >= 1) {
      this._finishStep();
    }
  }

  _advanceStep() {
    if (this.path.length === 0) {
      this.isMoving = false;
      this.nextTile = null;
      if (this._onArrive) this._onArrive(this.currentTile);
      return;
    }
    this.nextTile = this.path.shift();
    this.stepProgress = 0;
    this._updateFacing(this.nextTile.x, this.nextTile.y);
    if (this._onStep) this._onStep(this.nextTile);
  }

  _finishStep() {
    this.currentTile = { x: this.nextTile.x, y: this.nextTile.y };
    if (this.entity) {
      this.entity.x = this.currentTile.x;
      this.entity.y = this.currentTile.y;
    }
    this._advanceStep();
  }

  _updateFacing(tx, ty) {
    const dx = tx - this.currentTile.x;
    const dy = ty - this.currentTile.y;
    if (dx > 0 && dy > 0) this.facing = 'se';
    else if (dx > 0 && dy < 0) this.facing = 'ne';
    else if (dx < 0 && dy > 0) this.facing = 'sw';
    else if (dx < 0 && dy < 0) this.facing = 'nw';
    else if (dx > 0) this.facing = 'e';
    else if (dx < 0) this.facing = 'w';
    else if (dy > 0) this.facing = 's';
    else if (dy < 0) this.facing = 'n';
    if (this.entity) this.entity.facing = this.facing;
  }

  onStep(fn) {
    this._onStep = fn;
  }

  onArrive(fn) {
    this._onArrive = fn;
  }

  stop() {
    this.isMoving = false;
    this.path = [];
    this.nextTile = null;
    this.stepProgress = 0;
  }

  getCurrentTile() {
    return { ...this.currentTile };
  }

  getFacing() {
    return this.facing;
  }
}

export default IsoMovement;
