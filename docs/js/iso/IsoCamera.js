/**
 * @file IsoCamera.js
 * @description Isometric camera controller for 2:1 diamond-tile projection.
 *
 * The camera operates in screen pixel space and translates between
 * world (tile) coordinates and screen coordinates. It supports smooth
 * following, panning, zooming, screen shake, and viewport culling.
 */

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  HALF_TILE_WIDTH,
  HALF_TILE_HEIGHT,
  tileToScreen,
  screenToTile,
  tileToScreenf,
  projectIso,
  unprojectIso,
  clampZoom,
  getTileBounds,
} from "./IsoMath.js";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum zoom level (1x = pixel-perfect base) */
export const MIN_ZOOM = 1;

/** Maximum zoom level (3x = enlarged pixel art) */
export const MAX_ZOOM = 3;

/** Default zoom level */
export const DEFAULT_ZOOM = 1;

/** Smooth follow interpolation factor (0-1, higher = snappier) */
export const FOLLOW_LERP_FACTOR = 0.08;

/** Zoom transition interpolation factor */
export const ZOOM_LERP_FACTOR = 0.12;

/** Pan speed in pixels per frame (keyboard) */
export const PAN_SPEED = 8;

/** Pan speed multiplier when Shift is held */
export const PAN_SPEED_FAST = 2.0;

/** Screen shake decay factor */
export const SHAKE_DECAY = 0.9;

/** Minimum shake intensity before stopping */
export const SHAKE_THRESHOLD = 0.5;

// =============================================================================
// ISO CAMERA CLASS
// =============================================================================

/**
 * Isometric camera controller. Manages the view transform between
 * world tile coordinates and screen pixel coordinates.
 */
export default class IsoCamera {
  /**
   * Create a new IsoCamera.
   *
   * @param {Object} game - Game instance reference (for accessing canvas, etc.)
   */
  constructor(game) {
    /** @type {Object} Game instance reference */
    this._game = game;

    /** @type {HTMLCanvasElement|null} Canvas element (resolved from game) */
    this._canvas = game?.canvas || null;

    /** @type {number} Camera X offset in screen pixels */
    this.x = 0;

    /** @type {number} Camera Y offset in screen pixels */
    this.y = 0;

    /** @type {number} Current zoom level (1, 2, or 3) */
    this.zoom = DEFAULT_ZOOM;

    /** @type {number} Target zoom level (for smooth transitions) */
    this._targetZoom = DEFAULT_ZOOM;

    /** @type {Object|null} Entity to follow */
    this._target = null;

    /** @type {boolean} Whether the camera is currently following an entity */
    this._isFollowing = false;

    /** @type {number} Viewport width in screen pixels */
    this._viewportWidth = this._canvas?.width || 1024;

    /** @type {number} Viewport height in screen pixels */
    this._viewportHeight = this._canvas?.height || 768;

    /** @type {number} Half viewport width */
    this._halfViewportW = this._viewportWidth / 2;

    /** @type {number} Half viewport height */
    this._halfViewportH = this._viewportHeight / 2;

    /** @type {number} World width in tiles */
    this._worldWidth = 64;

    /** @type {number} World height in tiles */
    this._worldHeight = 64;

    /** @type {boolean} Whether camera is constrained to world bounds */
    this._constrained = true;

    // Screen shake state
    /** @type {number} Current shake offset X */
    this._shakeX = 0;

    /** @type {number} Current shake offset Y */
    this._shakeY = 0;

    /** @type {number} Shake intensity in pixels */
    this._shakeIntensity = 0;

    /** @type {number} Remaining shake duration in ms */
    this._shakeDuration = 0;

    /** @type {number} Accumulated delta time for shake */
    this._shakeAccum = 0;

    // Smooth pan state
    /** @type {number|null} Target X for smooth pan */
    this._panTargetX = null;

    /** @type {number|null} Target Y for smooth pan */
    this._panTargetY = null;

    /** @type {number} Pan lerp factor */
    this._panLerpFactor = 0.1;

    // Bounds cache
    /** @type {{minX: number, minY: number, maxX: number, maxY: number}} Cached visible tile range */
    this._visibleBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

    /** @type {boolean} Whether visible bounds need recalculation */
    this._boundsDirty = true;
  }

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------

  /**
   * Update the camera state.
   * Handles smooth follow, zoom transitions, screen shake, and smooth panning.
   *
   * @param {number} deltaTime - Elapsed time since last frame in milliseconds
   */
  update(deltaTime) {
    const dt = Math.min(deltaTime, 50); // Cap delta to avoid huge jumps

    // Smooth zoom transition
    if (Math.abs(this.zoom - this._targetZoom) > 0.01) {
      this.zoom += (this._targetZoom - this.zoom) * ZOOM_LERP_FACTOR;
      // Snap to target when close enough
      if (Math.abs(this.zoom - this._targetZoom) < 0.005) {
        this.zoom = this._targetZoom;
      }
      this._boundsDirty = true;
    }

    // Smooth follow target entity
    if (this._isFollowing && this._target) {
      this._updateFollow(dt);
    }

    // Smooth pan to target
    if (this._panTargetX !== null && this._panTargetY !== null) {
      this.x += (this._panTargetX - this.x) * this._panLerpFactor;
      this.y += (this._panTargetY - this.y) * this._panLerpFactor;

      // Check if we've arrived
      if (Math.abs(this._panTargetX - this.x) < 0.5 && Math.abs(this._panTargetY - this.y) < 0.5) {
        this.x = this._panTargetX;
        this.y = this._panTargetY;
        this._panTargetX = null;
        this._panTargetY = null;
      }
      this._boundsDirty = true;
    }

    // Apply constraints
    if (this._constrained) {
      this._applyConstraints();
    }

    // Update screen shake
    this._updateShake(dt);

    // Recalculate visible bounds if needed
    if (this._boundsDirty) {
      this._recalculateVisibleBounds();
      this._boundsDirty = false;
    }
  }

  /**
   * Update smooth follow toward the target entity.
   *
   * @param {number} _dt - Delta time in ms (unused but reserved)
   * @private
   */
  _updateFollow(_dt) {
    const targetScreen = tileToScreenf(this._target.x, this._target.y);
    const targetX = targetScreen.screenX * this.zoom - this._halfViewportW;
    const targetY = targetScreen.screenY * this.zoom - this._halfViewportH;

    this.x += (targetX - this.x) * FOLLOW_LERP_FACTOR;
    this.y += (targetY - this.y) * FOLLOW_LERP_FACTOR;

    this._boundsDirty = true;
  }

  /**
   * Apply world boundary constraints to the camera position.
   * Ensures the camera doesn't show areas outside the world.
   *
   * @private
   */
  _applyConstraints() {
    // Compute the world bounds in screen pixels at current zoom
    const worldLeft = (0 - (this._worldHeight - 1)) * HALF_TILE_WIDTH * this.zoom;
    const worldTop = 0;
    const worldRight = (this._worldWidth - 1) * HALF_TILE_WIDTH * this.zoom;
    const worldBottom = ((this._worldWidth - 1) + (this._worldHeight - 1)) * HALF_TILE_HEIGHT * this.zoom;

    // Clamp camera so viewport stays within world
    const minX = worldLeft - this._halfViewportW;
    const maxX = worldRight + this._halfViewportW;
    const minY = worldTop - this._halfViewportH;
    const maxY = worldBottom - this._halfViewportH * 0.5;

    this.x = Math.max(minX, Math.min(maxX, this.x));
    this.y = Math.max(minY, Math.min(maxY, this.y));
  }

  // ---------------------------------------------------------------------------
  // PANNING
  // ---------------------------------------------------------------------------

  /**
   * Pan the camera by a delta amount.
   * Stops any active follow.
   *
   * @param {number} dx - Delta X in screen pixels
   * @param {number} dy - Delta Y in screen pixels
   */
  pan(dx, dy) {
    this.unfollow();
    this.x += dx;
    this.y += dy;
    this._panTargetX = null;
    this._panTargetY = null;
    this._boundsDirty = true;
  }

  /**
   * Pan the camera to center on a specific tile.
   * Stops any active follow.
   *
   * @param {number} tileX - Target tile X coordinate
   * @param {number} tileY - Target tile Y coordinate
   * @param {boolean} [smooth=true] - Whether to animate the pan
   */
  panTo(tileX, tileY, smooth = true) {
    const screen = tileToScreenf(tileX, tileY);
    const targetX = screen.screenX * this.zoom - this._halfViewportW;
    const targetY = screen.screenY * this.zoom - this._halfViewportH;

    if (smooth) {
      this._panTargetX = targetX;
      this._panTargetY = targetY;
      this._panLerpFactor = 0.08;
    } else {
      this.x = targetX;
      this.y = targetY;
      this._panTargetX = null;
      this._panTargetY = null;
    }

    this.unfollow();
    this._boundsDirty = true;
  }

  /**
   * Pan the camera to a specific screen position.
   *
   * @param {number} screenX - Target screen X
   * @param {number} screenY - Target screen Y
   * @param {boolean} [smooth=true] - Whether to animate
   */
  panToScreen(screenX, screenY, smooth = true) {
    const targetX = screenX * this.zoom - this._halfViewportW;
    const targetY = screenY * this.zoom - this._halfViewportH;

    if (smooth) {
      this._panTargetX = targetX;
      this._panTargetY = targetY;
      this._panLerpFactor = 0.08;
    } else {
      this.x = targetX;
      this.y = targetY;
      this._panTargetX = null;
      this._panTargetY = null;
    }

    this.unfollow();
    this._boundsDirty = true;
  }

  // ---------------------------------------------------------------------------
  // FOLLOW
  // ---------------------------------------------------------------------------

  /**
   * Set an entity for the camera to smoothly follow.
   *
   * @param {Object} entity - Entity with {x, y} tile coordinates
   */
  follow(entity) {
    if (!entity || entity.x === undefined || entity.y === undefined) {
      console.warn("IsoCamera: Cannot follow entity without x/y coordinates", entity);
      return;
    }
    this._target = entity;
    this._isFollowing = true;
    this._panTargetX = null;
    this._panTargetY = null;
  }

  /**
   * Stop following any entity.
   */
  unfollow() {
    this._target = null;
    this._isFollowing = false;
  }

  /**
   * Check if the camera is currently following an entity.
   *
   * @returns {boolean} True if following
   */
  isFollowing() {
    return this._isFollowing;
  }

  /**
   * Get the entity being followed, if any.
   *
   * @returns {Object|null} Followed entity or null
   */
  getFollowTarget() {
    return this._target;
  }

  // ---------------------------------------------------------------------------
  // ZOOM
  // ---------------------------------------------------------------------------

  /**
   * Set the zoom level with smooth transition.
   *
   * @param {number} level - Zoom level (1, 2, or 3)
   */
  setZoom(level) {
    this._targetZoom = clampZoom(level);
    this._boundsDirty = true;
  }

  /**
   * Set zoom immediately without transition.
   *
   * @param {number} level - Zoom level (1, 2, or 3)
   */
  setZoomImmediate(level) {
    this.zoom = clampZoom(level);
    this._targetZoom = this.zoom;
    this._boundsDirty = true;
  }

  /**
   * Increase zoom by one level.
   */
  zoomIn() {
    this._targetZoom = clampZoom(this._targetZoom + 1);
    this._boundsDirty = true;
  }

  /**
   * Decrease zoom by one level.
   */
  zoomOut() {
    this._targetZoom = clampZoom(this._targetZoom - 1);
    this._boundsDirty = true;
  }

  /**
   * Get the current zoom level.
   *
   * @returns {number} Current zoom
   */
  getZoom() {
    return this.zoom;
  }

  /**
   * Get the target zoom level (may differ during transition).
   *
   * @returns {number} Target zoom
   */
  getTargetZoom() {
    return this._targetZoom;
  }

  /**
   * Check if a zoom transition is in progress.
   *
   * @returns {boolean} True if zooming
   */
  isZooming() {
    return Math.abs(this.zoom - this._targetZoom) > 0.01;
  }

  // ---------------------------------------------------------------------------
  // COORDINATE CONVERSIONS
  // ---------------------------------------------------------------------------

  /**
   * Convert screen coordinates to tile coordinates.
   * Accounts for camera offset and zoom.
   *
   * @param {number} screenX - Screen X pixel coordinate
   * @param {number} screenY - Screen Y pixel coordinate
   * @returns {{tileX: number, tileY: number}} Tile coordinates
   */
  screenToWorld(screenX, screenY) {
    return screenToTile(screenX, screenY, this.x, this.y, this.zoom);
  }

  /**
   * Convert world (tile) coordinates to screen coordinates.
   * Accounts for camera offset and zoom.
   *
   * @param {number} worldX - World X tile coordinate
   * @param {number} worldY - World Y tile coordinate
   * @returns {{screenX: number, screenY: number}} Screen coordinates
   */
  worldToScreen(worldX, worldY) {
    return tileToScreen(worldX, worldY, this.x, this.y, this.zoom);
  }

  /**
   * Convert float world coordinates to screen coordinates.
   * For entity sub-tile positioning.
   *
   * @param {number} worldX - World X float coordinate
   * @param {number} worldY - World Y float coordinate
   * @returns {{screenX: number, screenY: number}} Screen coordinates
   */
  worldToScreenf(worldX, worldY) {
    const s = tileToScreenf(worldX, worldY);
    return {
      screenX: s.screenX * this.zoom - this.x,
      screenY: s.screenY * this.zoom - this.y,
    };
  }

  /**
   * Convert a screen position to a world position with Z-height awareness.
   *
   * @param {number} screenX - Screen X
   * @param {number} screenY - Screen Y
   * @param {number} [z=0] - Z height in pixels
   * @returns {{worldX: number, worldY: number}} World coordinates
   */
  screenToWorldWithZ(screenX, screenY, z = 0) {
    const adjustedY = screenY + this.y + z * this.zoom;
    const adjustedX = screenX + this.x;
    const worldX = (adjustedX / (HALF_TILE_WIDTH * this.zoom) + adjustedY / (HALF_TILE_HEIGHT * this.zoom)) / 2;
    const worldY = (adjustedY / (HALF_TILE_HEIGHT * this.zoom) - adjustedX / (HALF_TILE_WIDTH * this.zoom)) / 2;
    return { worldX, worldY };
  }

  /**
   * Project an isometric 3D position to screen coordinates.
   *
   * @param {number} x - World X
   * @param {number} y - World Y
   * @param {number} [z=0] - Z height
   * @returns {{screenX: number, screenY: number}} Screen coordinates
   */
  project(x, y, z = 0) {
    const s = projectIso(x, y, z);
    return {
      screenX: s.screenX * this.zoom - this.x,
      screenY: s.screenY * this.zoom - this.y,
    };
  }

  /**
   * Unproject screen coordinates to world coordinates.
   *
   * @param {number} screenX - Screen X
   * @param {number} screenY - Screen Y
   * @returns {{worldX: number, worldY: number}} World float coordinates
   */
  unproject(screenX, screenY) {
    return unprojectIso(
      (screenX + this.x) / this.zoom,
      (screenY + this.y) / this.zoom,
    );
  }

  // ---------------------------------------------------------------------------
  // VIEWPORT
  // ---------------------------------------------------------------------------

  /**
   * Get the visible tile range in the current viewport.
   * Returns an expanded range to account for partially visible tiles.
   *
   * @returns {{minX: number, minY: number, maxX: number, maxY: number}} Visible tile range
   */
  getViewportBounds() {
    if (this._boundsDirty) {
      this._recalculateVisibleBounds();
    }
    return { ...this._visibleBounds };
  }

  /**
   * Check if a tile is visible in the current viewport.
   *
   * @param {number} tileX - Tile X to check
   * @param {number} tileY - Tile Y to check
   * @param {number} [padding=2] - Extra tiles to consider visible
   * @returns {boolean} True if the tile is visible
   */
  isTileVisible(tileX, tileY, padding = 2) {
    const b = this._visibleBounds;
    return tileX >= b.minX - padding
      && tileX <= b.maxX + padding
      && tileY >= b.minY - padding
      && tileY <= b.maxY + padding;
  }

  /**
   * Recalculate the visible tile bounds based on camera position and zoom.
   *
   * @private
   */
  _recalculateVisibleBounds() {
    // Get the 4 corners of the viewport in screen coords
    const tl = this.unproject(0, 0);
    const tr = this.unproject(this._viewportWidth, 0);
    const br = this.unproject(this._viewportWidth, this._viewportHeight);
    const bl = this.unproject(0, this._viewportHeight);

    // Expand bounds with a margin for partially visible tiles
    const margin = 2;
    this._visibleBounds = {
      minX: Math.floor(Math.min(tl.worldX, tr.worldX, br.worldX, bl.worldX)) - margin,
      minY: Math.floor(Math.min(tl.worldY, tr.worldY, br.worldY, bl.worldY)) - margin,
      maxX: Math.ceil(Math.max(tl.worldX, tr.worldX, br.worldX, bl.worldX)) + margin,
      maxY: Math.ceil(Math.max(tl.worldY, tr.worldY, br.worldY, bl.worldY)) + margin,
    };

    // Clamp to world bounds
    if (this._constrained) {
      this._visibleBounds.minX = Math.max(0, this._visibleBounds.minX);
      this._visibleBounds.minY = Math.max(0, this._visibleBounds.minY);
      this._visibleBounds.maxX = Math.min(this._worldWidth - 1, this._visibleBounds.maxX);
      this._visibleBounds.maxY = Math.min(this._worldHeight - 1, this._visibleBounds.maxY);
    }
  }

  // ---------------------------------------------------------------------------
  // WORLD BOUNDS
  // ---------------------------------------------------------------------------

  /**
   * Set world dimensions and enable boundary constraints.
   *
   * @param {number} width - World width in tiles
   * @param {number} height - World height in tiles
   */
  constrainToWorld(width, height) {
    this._worldWidth = Math.max(1, width);
    this._worldHeight = Math.max(1, height);
    this._constrained = true;
    this._boundsDirty = true;
  }

  /**
   * Disable world boundary constraints.
   */
  unconstrain() {
    this._constrained = false;
    this._boundsDirty = true;
  }

  /**
   * Set world dimensions without enabling constraints.
   *
   * @param {number} width - World width in tiles
   * @param {number} height - World height in tiles
   */
  setWorldSize(width, height) {
    this._worldWidth = Math.max(1, width);
    this._worldHeight = Math.max(1, height);
    this._boundsDirty = true;
  }

  /**
   * Get the current world size.
   *
   * @returns {{width: number, height: number}} World dimensions in tiles
   */
  getWorldSize() {
    return { width: this._worldWidth, height: this._worldHeight };
  }

  // ---------------------------------------------------------------------------
  // SCREEN SHAKE
  // ---------------------------------------------------------------------------

  /**
   * Apply a screen shake effect.
   *
   * @param {number} intensity - Shake intensity in pixels
   * @param {number} duration - Shake duration in milliseconds
   */
  shake(intensity, duration) {
    this._shakeIntensity = Math.max(this._shakeIntensity, intensity);
    this._shakeDuration = Math.max(this._shakeDuration, duration);
    this._shakeAccum = 0;
  }

  /**
   * Stop any active screen shake.
   */
  stopShake() {
    this._shakeIntensity = 0;
    this._shakeDuration = 0;
    this._shakeX = 0;
    this._shakeY = 0;
  }

  /**
   * Get the current shake offset to apply during rendering.
   *
   * @returns {{x: number, y: number}} Shake offset
   */
  getShakeOffset() {
    return { x: this._shakeX, y: this._shakeY };
  }

  /**
   * Check if a screen shake is currently active.
   *
   * @returns {boolean} True if shaking
   */
  isShaking() {
    return this._shakeIntensity > SHAKE_THRESHOLD;
  }

  /**
   * Update the screen shake state.
   *
   * @param {number} dt - Delta time in ms
   * @private
   */
  _updateShake(dt) {
    if (this._shakeDuration <= 0 && this._shakeIntensity <= SHAKE_THRESHOLD) {
      this._shakeX = 0;
      this._shakeY = 0;
      this._shakeIntensity = 0;
      return;
    }

    this._shakeDuration -= dt;
    this._shakeAccum += dt;

    // Decay intensity
    this._shakeIntensity *= SHAKE_DECAY;

    if (this._shakeIntensity <= SHAKE_THRESHOLD) {
      this._shakeX = 0;
      this._shakeY = 0;
      this._shakeIntensity = 0;
      this._shakeDuration = 0;
      return;
    }

    // Random offset within intensity circle
    const angle = Math.random() * Math.PI * 2;
    const radius = this._shakeIntensity * (0.5 + Math.random() * 0.5);
    this._shakeX = Math.cos(angle) * radius;
    this._shakeY = Math.sin(angle) * radius;
  }

  // ---------------------------------------------------------------------------
  // RESIZE
  // ---------------------------------------------------------------------------

  /**
   * Update bounds when the canvas is resized.
   * Should be called whenever the window or canvas resizes.
   */
  updateBounds() {
    if (this._canvas) {
      const dpr = window.devicePixelRatio || 1;
      this._viewportWidth = this._canvas.width / dpr;
      this._viewportHeight = this._canvas.height / dpr;
    } else {
      this._viewportWidth = window.innerWidth;
      this._viewportHeight = window.innerHeight;
    }

    this._halfViewportW = this._viewportWidth / 2;
    this._halfViewportH = this._viewportHeight / 2;
    this._boundsDirty = true;

    // Re-apply constraints
    if (this._constrained) {
      this._applyConstraints();
    }
  }

  /**
   * Set the canvas reference explicitly.
   *
   * @param {HTMLCanvasElement} canvas - Canvas element
   */
  setCanvas(canvas) {
    this._canvas = canvas;
    this.updateBounds();
  }

  // ---------------------------------------------------------------------------
  // PROPERTIES
  // ---------------------------------------------------------------------------

  /**
   * Get the viewport center in screen coordinates.
   *
   * @returns {{x: number, y: number}} Center screen position
   */
  getViewportCenter() {
    return { x: this._halfViewportW, y: this._halfViewportH };
  }

  /**
   * Get the viewport dimensions.
   *
   * @returns {{width: number, height: number}} Viewport size in pixels
   */
  getViewportSize() {
    return { width: this._viewportWidth, height: this._viewportHeight };
  }

  /**
   * Get the camera position as the center tile being viewed.
   *
   * @returns {{tileX: number, tileY: number}} Center tile coordinate
   */
  getCenterTile() {
    return this.screenToWorld(this._halfViewportW, this._halfViewportH);
  }

  /**
   * Center the camera on a specific tile immediately (no animation).
   *
   * @param {number} tileX - Tile X
   * @param {number} tileY - Tile Y
   */
  centerOn(tileX, tileY) {
    const screen = tileToScreenf(tileX, tileY);
    this.x = screen.screenX * this.zoom - this._halfViewportW;
    this.y = screen.screenY * this.zoom - this._halfViewportH;
    this._panTargetX = null;
    this._panTargetY = null;
    this._boundsDirty = true;
  }

  /**
   * Get the total camera offset including shake.
   *
   * @returns {{x: number, y: number}} Total offset
   */
  getOffset() {
    return {
      x: this.x + this._shakeX,
      y: this.y + this._shakeY,
    };
  }

  /**
   * Reset the camera to default position and zoom.
   */
  reset() {
    this.x = 0;
    this.y = 0;
    this.zoom = DEFAULT_ZOOM;
    this._targetZoom = DEFAULT_ZOOM;
    this._target = null;
    this._isFollowing = false;
    this._shakeX = 0;
    this._shakeY = 0;
    this._shakeIntensity = 0;
    this._shakeDuration = 0;
    this._panTargetX = null;
    this._panTargetY = null;
    this._boundsDirty = true;
  }
}

export { TILE_WIDTH, TILE_HEIGHT };
