/**
 * @file Camera.js
 * @description 2D Camera system with smooth follow, zoom, shake, and bounds clamping.
 * Supports world-to-screen and screen-to-world coordinate transforms.
 */

/**
 * 2D Camera system for the game world.
 * @export {Camera}
 */
export class Camera {
  /**
   * @param {import('./Game.js').Game} game - The game instance.
   */
  constructor(game) {
    this.game = game;
    this.W = game.W;
    this.H = game.H;

    /** @type {number} Camera X in world coordinates (center point). */
    this.x = 0;
    /** @type {number} Camera Y in world coordinates (center point). */
    this.y = 0;

    /** @type {number} Current zoom level. */
    this.zoom = 1.0;
    /** @type {number} Target zoom level (for smooth interpolation). */
    this.targetZoom = 1.0;
    /** @type {number} Minimum allowed zoom. */
    this.minZoom = 0.4;
    /** @type {number} Maximum allowed zoom. */
    this.maxZoom = 2.5;

    /** @type {number} Smoothing factor for follow and zoom (0..1). */
    this.smoothSpeed = 0.08;

    /**
     * World bounds for clamping.
     * @type {{minX:number,maxX:number,minY:number,maxY:number}}
     */
    this.bounds = { minX: -2000, maxX: 2000, minY: -1200, maxY: 1200 };

    // Screen shake state
    /** @type {number} Current shake offset magnitude in pixels. */
    this.shakeIntensity = 0;
    /** @type {number} Shake decay factor per frame (multiplicative). */
    this.shakeDecay = 0.88;
    /** @type {number} Accumulated shake time for randomization seed. */
    this.shakeTime = 0;

    // Smooth follow state
    /** @type {number} Offset fraction: player sits at this fraction down the screen. */
    this.followOffsetY = 0.35; // Player at top-third vertically
    /** @type {number} Horizontal follow offset fraction. */
    this.followOffsetX = 0.5;  // Player centered horizontally

    /** @type {number|null} Zoom target for auto-zoom on area transitions. */
    this.autoZoomTarget = null;
    /** @type {number} Timer for auto-zoom cooldown. */
    this.autoZoomTimer = 0;

    /** @type {number} Sub-pixel accumulator for smooth movement. */
    this._velX = 0;
    /** @type {number} Sub-pixel accumulator for smooth movement. */
    this._velY = 0;
  }

  /**
   * Smoothly follow a world position, keeping the player in the bottom-third of the screen.
   * Call this every frame with the player's current world coordinates.
   * @param {number} targetX - World X to follow.
   * @param {number} targetY - World Y to follow.
   */
  follow(targetX, targetY) {
    // Target screen position for the player
    const targetScreenX = this.W * this.followOffsetX;
    const targetScreenY = this.H * this.followOffsetY;

    // Derive desired camera world position
    const desiredX = targetX - (targetScreenX - this.W / 2) / this.targetZoom;
    const desiredY = targetY - (targetScreenY - this.H / 2) / this.targetZoom;

    if (this.game.state.settings.cameraSmooth) {
      // Smooth interpolation with velocity-based easing (critically damped)
      const dx = desiredX - this.x;
      const dy = desiredY - this.y;
      this._velX += dx * this.smoothSpeed;
      this._velY += dy * this.smoothSpeed;
      this._velX *= 0.82;
      this._velY *= 0.82;
      this.x += this._velX;
      this.y += this._velY;
    } else {
      // Instant snap
      this.x = desiredX;
      this.y = desiredY;
    }

    // Clamp to world bounds
    this._clampToBounds();
  }

  /**
   * Update camera zoom interpolation and shake decay.
   * @param {number} dt - Delta time in seconds.
   */
  update(dt) {
    // Smooth zoom interpolation
    const zoomDiff = this.targetZoom - this.zoom;
    if (Math.abs(zoomDiff) > 0.001) {
      this.zoom += zoomDiff * 0.12;
    } else {
      this.zoom = this.targetZoom;
    }

    // Decay shake
    if (this.shakeIntensity > 0.1) {
      this.shakeIntensity *= this.shakeDecay;
      this.shakeTime += dt * 60;
    } else {
      this.shakeIntensity = 0;
      this.shakeTime = 0;
    }

    // Auto-zoom cooldown
    if (this.autoZoomTimer > 0) {
      this.autoZoomTimer -= dt;
      if (this.autoZoomTimer <= 0 && this.autoZoomTarget !== null) {
        this.setZoom(this.autoZoomTarget);
        this.autoZoomTarget = null;
      }
    }
  }

  /**
   * Clamp the camera position within configured world bounds.
   */
  _clampToBounds() {
    const halfVisibleW = (this.W / 2) / this.zoom;
    const halfVisibleH = (this.H / 2) / this.zoom;

    this.x = Math.max(this.bounds.minX + halfVisibleW,
      Math.min(this.bounds.maxX - halfVisibleW, this.x));
    this.y = Math.max(this.bounds.minY + halfVisibleH,
      Math.min(this.bounds.maxY - halfVisibleH, this.y));
  }

  /**
   * Set the target zoom level, clamped to [minZoom, maxZoom].
   * @param {number} zoom
   */
  setZoom(zoom) {
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
  }

  /**
   * Zoom in by a delta amount.
   * @param {number} [delta=0.15]
   */
  zoomIn(delta = 0.15) {
    this.setZoom(this.targetZoom + delta);
  }

  /**
   * Zoom out by a delta amount.
   * @param {number} [delta=0.15]
   */
  zoomOut(delta = 0.15) {
    this.setZoom(this.targetZoom - delta);
  }

  /**
   * Reset zoom to default.
   */
  resetZoom() {
    this.targetZoom = 1.0;
  }

  /**
   * Apply a screenshake impulse.
   * @param {number} intensity - Shake amplitude in world units.
   * @param {number} [decay=0.88] - Custom decay factor.
   */
  shake(intensity, decay = 0.88) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDecay = decay;
    this.shakeTime = 0;
  }

  /**
   * Apply a brief micro-shake for UI feedback.
   * @param {number} [intensity=2]
   */
  microShake(intensity = 2) {
    this.shake(intensity, 0.75);
  }

  /**
   * Get the current shake offset as {sx, sy} in screen pixels.
   * @returns {{sx:number, sy:number}}
   */
  getShakeOffset() {
    if (this.shakeIntensity <= 0) return { sx: 0, sy: 0 };
    // Deterministic random based on time for stable frames
    const rx = Math.sin(this.shakeTime * 7.3 + 1.0) * this.shakeIntensity;
    const ry = Math.cos(this.shakeTime * 5.9 + 2.0) * this.shakeIntensity;
    return { sx: rx, sy: ry };
  }

  /**
   * Transform world coordinates to screen coordinates.
   * Includes current zoom, camera position, and shake offset.
   * @param {number} wx - World X.
   * @param {number} wy - World Y.
   * @returns {{x:number, y:number}} Screen coordinates.
   */
  worldToScreen(wx, wy) {
    const shake = this.getShakeOffset();
    const sx = (wx - this.x) * this.zoom + this.W / 2 + shake.sx;
    const sy = (wy - this.y) * this.zoom + this.H / 2 + shake.sy;
    return { x: sx, y: sy };
  }

  /**
   * Transform screen coordinates to world coordinates.
   * @param {number} sx - Screen X.
   * @param {number} sy - Screen Y.
   * @returns {{x:number, y:number}} World coordinates.
   */
  screenToWorld(sx, sy) {
    const shake = this.getShakeOffset();
    const wx = (sx - this.W / 2 - shake.sx) / this.zoom + this.x;
    const wy = (sy - this.H / 2 - shake.sy) / this.zoom + this.y;
    return { x: wx, y: wy };
  }

  /**
   * Check if a world position is within (or near) the current viewport.
   * @param {number} wx - World X.
   * @param {number} wy - World Y.
   * @param {number} [padding=50] - Extra margin in screen pixels.
   * @returns {boolean}
   */
  isInView(wx, wy, padding = 50) {
    const pos = this.worldToScreen(wx, wy);
    return (
      pos.x > -padding &&
      pos.x < this.W + padding &&
      pos.y > -padding &&
      pos.y < this.H + padding
    );
  }

  /**
   * Check if a rectangular world region overlaps the viewport.
   * @param {number} wx - Center X.
   * @param {number} wy - Center Y.
   * @param {number} halfW - Half width.
   * @param {number} halfH - Half height.
   * @returns {boolean}
   */
  isRectInView(wx, wy, halfW, halfH) {
    const tl = this.worldToScreen(wx - halfW, wy - halfH);
    const br = this.worldToScreen(wx + halfW, wy + halfH);
    return !(br.x < 0 || tl.x > this.W || br.y < 0 || tl.y > this.H);
  }

  /**
   * Set hard world bounds.
   * @param {number} minX
   * @param {number} maxX
   * @param {number} minY
   * @param {number} maxY
   */
  setBounds(minX, maxX, minY, maxY) {
    this.bounds = { minX, maxX, minY, maxY };
    this._clampToBounds();
  }

  /**
   * Animate zoom to a target over time.
   * @param {number} targetZoom
   * @param {number} [delaySeconds=0] - Delay before starting.
   */
  animateZoomTo(targetZoom, delaySeconds = 0) {
    this.autoZoomTarget = targetZoom;
    this.autoZoomTimer = delaySeconds;
  }

  /**
   * Instantly move the camera to a world position without smoothing.
   * @param {number} wx
   * @param {number} wy
   */
  snapTo(wx, wy) {
    this.x = wx;
    this.y = wy;
    this._velX = 0;
    this._velY = 0;
    this._clampToBounds();
  }

  /**
   * Focus on an area by setting bounds and snapping to its center.
   * @param {number} centerX
   * @param {number} centerY
   * @param {number} halfWidth
   * @param {number} halfHeight
   */
  focusArea(centerX, centerY, halfWidth, halfHeight) {
    this.setBounds(centerX - halfWidth, centerX + halfWidth, centerY - halfHeight, centerY + halfHeight);
    this.snapTo(centerX, centerY);
    this.setZoom(1.0);
  }

  /**
   * Get the visible world rectangle.
   * @returns {{minX:number, maxX:number, minY:number, maxY:number}}
   */
  getVisibleWorldRect() {
    const halfW = (this.W / 2) / this.zoom;
    const halfH = (this.H / 2) / this.zoom;
    return {
      minX: this.x - halfW,
      maxX: this.x + halfW,
      minY: this.y - halfH,
      maxY: this.y + halfH
    };
  }

  /**
   * Serialize camera state for save/load.
   * @returns {Object}
   */
  serialize() {
    return {
      x: this.x,
      y: this.y,
      zoom: this.zoom,
      targetZoom: this.targetZoom
    };
  }

  /**
   * Restore camera state.
   * @param {Object} data
   */
  deserialize(data) {
    if (data.x !== undefined) this.x = data.x;
    if (data.y !== undefined) this.y = data.y;
    if (data.zoom !== undefined) this.zoom = data.zoom;
    if (data.targetZoom !== undefined) this.targetZoom = data.targetZoom;
    this._clampToBounds();
  }
}
