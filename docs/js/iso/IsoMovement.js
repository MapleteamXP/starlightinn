/**
 * @file IsoMovement.js
 * @description Habbo-style grid-locked character movement for Starlight Inn v6.0.
 * Characters move tile-by-tile (not smooth pixel sliding). Each tile transition
 * takes ~400ms with a slight hop animation. The system supports pathfinding,
 * keyboard nudge controls, furniture interaction on arrival, and dynamic path
 * recalculation when tiles become blocked by other players.
 *
 * Movement states:
 *   IDLE     -> not moving
 *   STEPPING -> transitioning between tiles
 *   PAUSED   -> brief pause between steps (Habbo-style)
 *
 * @module iso/IsoMovement
 */

import {
  tileToScreen,
  screenToTile,
  distanceTile,
} from './IsoMath.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default tiles per second movement speed. */
export const DEFAULT_SPEED = 2.5;

/** Default milliseconds per tile step. */
export const DEFAULT_STEP_MS = 400;

/** Hop height in pixels during step animation. */
export const HOP_HEIGHT = 2;

/** Pause duration between steps in milliseconds. */
export const STEP_PAUSE_MS = 50;

/** Directions as named constants. */
export const DIRECTION = {
  NORTH: 'N',
  SOUTH: 'S',
  EAST: 'E',
  WEST: 'W',
  NORTH_EAST: 'NE',
  NORTH_WEST: 'NW',
  SOUTH_EAST: 'SE',
  SOUTH_WEST: 'SW',
  NONE: 'NONE',
};

/** Movement state enumeration. */
export const MOVE_STATE = {
  IDLE: 'idle',
  STEPPING: 'stepping',
  PAUSED: 'paused',
};

// =============================================================================
// DIRECTION HELPERS
// =============================================================================

/**
 * Get direction string from a delta movement.
 *
 * @param {number} dx - Delta X (-1, 0, 1).
 * @param {number} dy - Delta Y (-1, 0, 1).
 * @returns {string} Direction constant from DIRECTION.
 */
export function getDirectionFromDelta(dx, dy) {
  if (dx === 0 && dy === -1) return DIRECTION.NORTH;
  if (dx === 0 && dy === 1) return DIRECTION.SOUTH;
  if (dx === 1 && dy === 0) return DIRECTION.EAST;
  if (dx === -1 && dy === 0) return DIRECTION.WEST;
  if (dx === 1 && dy === -1) return DIRECTION.NORTH_EAST;
  if (dx === -1 && dy === -1) return DIRECTION.NORTH_WEST;
  if (dx === 1 && dy === 1) return DIRECTION.SOUTH_EAST;
  if (dx === -1 && dy === 1) return DIRECTION.SOUTH_WEST;
  return DIRECTION.NONE;
}

/**
 * Get the opposite direction.
 *
 * @param {string} dir - Direction string.
 * @returns {string} Opposite direction.
 */
export function getOppositeDirection(dir) {
  const opposites = {
    [DIRECTION.NORTH]: DIRECTION.SOUTH,
    [DIRECTION.SOUTH]: DIRECTION.NORTH,
    [DIRECTION.EAST]: DIRECTION.WEST,
    [DIRECTION.WEST]: DIRECTION.EAST,
    [DIRECTION.NORTH_EAST]: DIRECTION.SOUTH_WEST,
    [DIRECTION.SOUTH_WEST]: DIRECTION.NORTH_EAST,
    [DIRECTION.NORTH_WEST]: DIRECTION.SOUTH_EAST,
    [DIRECTION.SOUTH_EAST]: DIRECTION.NORTH_WEST,
  };
  return opposites[dir] || DIRECTION.NONE;
}

// =============================================================================
// IsoMovement CLASS
// =============================================================================

/**
 * Habbo-style grid-locked character movement controller.
 * Manages tile-by-tile stepping with hop animation, pathfinding,
 * direction facing, and interaction triggers.
 */
export default class IsoMovement {
  /**
   * @param {Object} entity - The player or NPC entity object.
   *   Expected properties: tileX, tileY, screenX, screenY, direction.
   * @param {IsoTilemap|IsoChunk} tilemap - Tilemap or chunk manager for path queries.
   */
  constructor(entity, tilemap) {
    /** @type {Object} The entity being moved. */
    this.entity = entity;

    /** @type {IsoTilemap|IsoChunk} Tilemap for walkability and pathfinding. */
    this.tilemap = tilemap;

    /** @type {string} Current movement state (idle, stepping, paused). */
    this.state = MOVE_STATE.IDLE;

    /** @type {Array<{x:number, y:number}>} Current path array. */
    this._path = [];

    /** @type {number} Current index in the path. */
    this._pathIndex = 0;

    /** @type {number} Current step progress (0..1). */
    this._stepProgress = 0;

    /** @type {number} Milliseconds per tile step. */
    this._stepDuration = DEFAULT_STEP_MS;

    /** @type {number} Milliseconds to pause between steps. */
    this._pauseDuration = STEP_PAUSE_MS;

    /** @type {number} Accumulated pause time. */
    this._pauseTimer = 0;

    /** @type {number} Tiles per second (recalculates stepDuration). */
    this._speed = DEFAULT_SPEED;

    /** @type {{x:number, y:number}|null} Starting tile of current step. */
    this._stepFrom = null;

    /** @type {{x:number, y:number}|null} Target tile of current step. */
    this._stepTo = null;

    /** @type {string} Current facing direction. */
    this._direction = DIRECTION.SOUTH;

    /** @type {Function|null} Callback when destination reached. */
    this._onArrive = null;

    /** @type {Function|null} Callback when each tile step completes. */
    this._onStep = null;

    /** @type {Function|null} Callback when path is blocked. */
    this._onBlocked = null;

    /** @type {Function|null} Callback when furniture interaction triggered. */
    this._onFurnitureInteract = null;

    /** @type {boolean} Whether to automatically recalculate path on block. */
    this.autoRepath = true;

    /** @type {number} Max repath attempts before giving up. */
    this._repathAttempts = 0;

    /** @type {number} Maximum allowed repath attempts. */
    this._maxRepathAttempts = 3;

    /** @type {{x:number, y:number}|null} Original destination before repathing. */
    this._originalDestination = null;

    /** @type {boolean} Whether movement is currently blocked and waiting. */
    this._isBlocked = false;

    /** @type {number} Blocked wait timer. */
    this._blockedTimer = 0;

    /** @type {number} Max time to wait for a blocked tile before giving up. */
    this._blockedWaitMs = 3000;

    /** @type {Set<string>} Occupied tiles from other players (keys `${x},${y}`). */
    this._occupiedTiles = new Set();

    /** @type {boolean} Whether to use 8-direction movement. */
    this._allowDiagonal = true;

    /** @type {number} Current hop offset for animation. */
    this._hopOffset = 0;

    // Initialize entity position from tile coordinates if available
    this._syncEntityPosition();
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  /**
   * Sync entity screen position to its tile center.
   *
   * @private
   */
  _syncEntityPosition() {
    if (!this.entity) return;
    const tx = this.entity.tileX ?? 0;
    const ty = this.entity.tileY ?? 0;
    const pos = tileToScreen(tx, ty);
    this.entity.screenX = pos.screenX;
    this.entity.screenY = pos.screenY;
    this.entity.tileX = tx;
    this.entity.tileY = ty;
  }

  /**
   * Build a tile key string.
   *
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   * @returns {string} Key string.
   * @private
   */
  _key(x, y) {
    return `${x},${y}`;
  }

  /**
   * Check if a tile is walkable, considering tilemap and occupied set.
   *
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   * @returns {boolean} True if walkable.
   * @private
   */
  _isWalkable(x, y) {
    if (this._occupiedTiles.has(this._key(x, y))) return false;
    return this.tilemap.isWalkable(x, y);
  }

  /**
   * Calculate the hop offset based on step progress.
   * Uses a parabola: hop peaks at progress=0.5.
   *
   * @param {number} progress - Step progress 0..1.
   * @returns {number} Pixel hop offset (negative = up).
   * @private
   */
  _calculateHop(progress) {
    // Parabolic hop: 4 * H * (p - p^2), peaks at p=0.5
    return -4 * HOP_HEIGHT * (progress - progress * progress);
  }

  /**
   * Interpolate between two screen positions.
   *
   * @param {{screenX:number, screenY:number}} from - Start position.
   * @param {{screenX:number, screenY:number}} to - End position.
   * @param {number} t - Interpolation factor 0..1.
   * @returns {{screenX:number, screenY:number}} Interpolated position.
   * @private
   */
  _lerpScreen(from, to, t) {
    return {
      screenX: from.screenX + (to.screenX - from.screenX) * t,
      screenY: from.screenY + (to.screenY - from.screenY) * t,
    };
  }

  // =============================================================================
  // PUBLIC MOVEMENT API
  // =============================================================================

  /**
   * Move the entity to a target tile using pathfinding.
   * If already moving, the old path is replaced.
   *
   * @param {number} tileX - Destination tile X.
   * @param {number} tileY - Destination tile Y.
   * @returns {boolean} True if a path was found and movement started.
   */
  moveTo(tileX, tileY) {
    if (!this.entity || !this.tilemap) return false;

    const startX = this.entity.tileX ?? 0;
    const startY = this.entity.tileY ?? 0;

    // Same tile: no movement needed
    if (startX === tileX && startY === tileY) {
      this._triggerArrive(tileX, tileY);
      return true;
    }

    // Try to find a path
    const path = this.tilemap.findPath(startX, startY, tileX, tileY, this._allowDiagonal);

    if (!path || path.length < 2) {
      this._triggerBlocked(startX, startY, tileX, tileY, 'no_path');
      return false;
    }

    this._path = path;
    this._pathIndex = 1; // Start at first step after current position
    this._originalDestination = { x: tileX, y: tileY };
    this._repathAttempts = 0;
    this._isBlocked = false;
    this._blockedTimer = 0;

    this.state = MOVE_STATE.STEPPING;
    this._stepProgress = 0;
    this._stepFrom = { x: startX, y: startY };
    this._stepTo = { x: path[1].x, y: path[1].y };
    this._updateDirection(path[1].x - startX, path[1].y - startY);

    // Mark destination tile as our target to prevent others from pathing there
    this._clearOwnOccupancy();
    this._reservePath(path);

    return true;
  }

  /**
   * Move one tile in a direction using keyboard input.
   * If the target tile is walkable, starts a single-step movement.
   *
   * @param {number} dx - Delta X (-1, 0, 1).
   * @param {number} dy - Delta Y (-1, 0, 1).
   * @returns {boolean} True if movement started.
   */
  moveBy(dx, dy) {
    if (!this.entity || !this.tilemap) return false;
    if (this.state !== MOVE_STATE.IDLE) return false;

    const clampedDx = Math.max(-1, Math.min(1, dx));
    const clampedDy = Math.max(-1, Math.min(1, dy));
    if (clampedDx === 0 && clampedDy === 0) return false;

    const fromX = this.entity.tileX ?? 0;
    const fromY = this.entity.tileY ?? 0;
    const toX = fromX + clampedDx;
    const toY = fromY + clampedDy;

    if (!this._isWalkable(toX, toY)) return false;

    this._path = [{ x: fromX, y: fromY }, { x: toX, y: toY }];
    this._pathIndex = 1;
    this._originalDestination = { x: toX, y: toY };
    this._repathAttempts = 0;
    this._isBlocked = false;
    this._blockedTimer = 0;

    this.state = MOVE_STATE.STEPPING;
    this._stepProgress = 0;
    this._stepFrom = { x: fromX, y: fromY };
    this._stepTo = { x: toX, y: toY };
    this._updateDirection(clampedDx, clampedDy);

    return true;
  }

  /**
   * Stop movement immediately.
   * Entity remains at its current tile position.
   */
  stop() {
    this.state = MOVE_STATE.IDLE;
    this._path = [];
    this._pathIndex = 0;
    this._stepProgress = 0;
    this._stepFrom = null;
    this._stepTo = null;
    this._isBlocked = false;
    this._blockedTimer = 0;
    this._clearOwnOccupancy();
    this._syncEntityPosition();
  }

  /**
   * Check if the entity is currently moving.
   *
   * @returns {boolean} True if stepping or paused between steps.
   */
  isMoving() {
    return this.state === MOVE_STATE.STEPPING || this.state === MOVE_STATE.PAUSED;
  }

  /**
   * Get the current path array.
   *
   * @returns {Array<{x:number, y:number}>} Current path (may be empty).
   */
  getPath() {
    return this._path ? [...this._path] : [];
  }

  /**
   * Get the current destination.
   *
   * @returns {{x:number, y:number}|null} Destination or null.
   */
  getDestination() {
    if (!this._path || this._path.length === 0) return null;
    const dest = this._path[this._path.length - 1];
    return { x: dest.x, y: dest.y };
  }

  /**
   * Get the remaining path from current position to destination.
   *
   * @returns {Array<{x:number, y:number}>} Remaining path nodes.
   */
  getRemainingPath() {
    if (!this._path || this._pathIndex >= this._path.length) return [];
    return this._path.slice(this._pathIndex - 1);
  }

  // =============================================================================
  // SPEED / CONFIGURATION
  // =============================================================================

  /**
   * Set the movement speed in tiles per second.
   *
   * @param {number} tilesPerSecond - Speed value.
   */
  setSpeed(tilesPerSecond) {
    this._speed = Math.max(0.1, Math.min(10, tilesPerSecond));
    this._stepDuration = 1000 / this._speed;
  }

  /**
   * Get the current speed.
   *
   * @returns {number} Tiles per second.
   */
  getSpeed() {
    return this._speed;
  }

  /**
   * Set the step pause duration.
   *
   * @param {number} ms - Milliseconds to pause between steps.
   */
  setStepPause(ms) {
    this._pauseDuration = Math.max(0, ms);
  }

  /**
   * Enable or disable diagonal movement.
   *
   * @param {boolean} allow - True to allow diagonal steps.
   */
  setAllowDiagonal(allow) {
    this._allowDiagonal = !!allow;
  }

  // =============================================================================
  // UPDATE LOOP
  // =============================================================================

  /**
   * Update the movement state. Call every frame with deltaTime.
   *
   * @param {number} deltaTime - Milliseconds since last frame.
   */
  update(deltaTime) {
    if (!this.entity || !this.tilemap) return;
    if (this.state === MOVE_STATE.IDLE) return;

    // Clamp delta to avoid huge jumps
    const dt = Math.min(deltaTime, 100);

    if (this.state === MOVE_STATE.PAUSED) {
      this._pauseTimer -= dt;
      if (this._pauseTimer <= 0) {
        this._advanceToNextStep();
      }
      return;
    }

    if (this.state === MOVE_STATE.STEPPING) {
      this._updateStepping(dt);
    }
  }

  /**
   * Process the current stepping state.
   *
   * @param {number} dt - Delta time in ms.
   * @private
   */
  _updateStepping(dt) {
    // Check if the target tile became unwalkable mid-step
    if (this._stepTo && !this._isWalkable(this._stepTo.x, this._stepTo.y)) {
      // If we're close enough, snap to the tile and stop/repath
      if (this._stepProgress > 0.8) {
        this._completeStep();
      } else {
        // Blocked mid-step: snap back to from tile and try repath
        this._snapToTile(this._stepFrom.x, this._stepFrom.y);
        this._tryRepath();
      }
      return;
    }

    this._stepProgress += dt / this._stepDuration;

    if (this._stepProgress >= 1) {
      this._stepProgress = 1;
      this._completeStep();
      return;
    }

    // Interpolate screen position
    if (this._stepFrom && this._stepTo) {
      const fromPos = tileToScreen(this._stepFrom.x, this._stepFrom.y);
      const toPos = tileToScreen(this._stepTo.x, this._stepTo.y);
      const pos = this._lerpScreen(fromPos, toPos, this._stepProgress);

      // Apply hop offset
      this._hopOffset = this._calculateHop(this._stepProgress);

      this.entity.screenX = pos.screenX;
      this.entity.screenY = pos.screenY + this._hopOffset;
    }
  }

  /**
   * Complete the current step, snap to tile center, and decide next action.
   *
   * @private
   */
  _completeStep() {
    if (!this._stepTo) return;

    // Snap to target tile
    this._snapToTile(this._stepTo.x, this._stepTo.y);
    this._hopOffset = 0;

    // Fire step callback
    this._triggerStep(this._stepTo.x, this._stepTo.y);

    // Check if we reached the destination
    if (this._pathIndex >= this._path.length - 1) {
      const dest = this._path[this._path.length - 1];
      this._triggerArrive(dest.x, dest.y);
      this._checkFurnitureInteraction(dest.x, dest.y);
      this.stop();
      return;
    }

    // Pause briefly, then continue
    this.state = MOVE_STATE.PAUSED;
    this._pauseTimer = this._pauseDuration;
  }

  /**
   * Advance to the next step in the path after a pause.
   *
   * @private
   */
  _advanceToNextStep() {
    this._pathIndex++;

    if (this._pathIndex >= this._path.length) {
      this.stop();
      return;
    }

    const from = this._path[this._pathIndex - 1];
    const to = this._path[this._pathIndex];

    // Check walkability
    if (!this._isWalkable(to.x, to.y)) {
      this._tryRepath();
      return;
    }

    this.state = MOVE_STATE.STEPPING;
    this._stepProgress = 0;
    this._stepFrom = { x: from.x, y: from.y };
    this._stepTo = { x: to.x, y: to.y };
    this._updateDirection(to.x - from.x, to.y - from.y);
  }

  /**
   * Snap the entity to a tile's center screen position.
   *
   * @param {number} tx - Tile X.
   * @param {number} ty - Tile Y.
   * @private
   */
  _snapToTile(tx, ty) {
    this.entity.tileX = tx;
    this.entity.tileY = ty;
    const pos = tileToScreen(tx, ty);
    this.entity.screenX = pos.screenX;
    this.entity.screenY = pos.screenY;
  }

  /**
   * Attempt to find an alternative path when blocked.
   *
   * @private
   */
  _tryRepath() {
    if (!this.autoRepath || !this._originalDestination) {
      this._triggerBlocked(this.entity.tileX, this.entity.tileY, this._originalDestination?.x, this._originalDestination?.y, 'blocked');
      this.stop();
      return;
    }

    this._repathAttempts++;
    if (this._repathAttempts > this._maxRepathAttempts) {
      this._triggerBlocked(this.entity.tileX, this.entity.tileY, this._originalDestination.x, this._originalDestination.y, 'max_repath');
      this.stop();
      return;
    }

    // Recalculate path from current position
    const currentX = this.entity.tileX;
    const currentY = this.entity.tileY;
    const destX = this._originalDestination.x;
    const destY = this._originalDestination.y;

    const newPath = this.tilemap.findPath(currentX, currentY, destX, destY, this._allowDiagonal);

    if (!newPath || newPath.length < 2) {
      this._triggerBlocked(currentX, currentY, destX, destY, 'repath_failed');
      this.stop();
      return;
    }

    this._path = newPath;
    this._pathIndex = 1;
    this._isBlocked = false;
    this._blockedTimer = 0;

    this.state = MOVE_STATE.STEPPING;
    this._stepProgress = 0;
    this._stepFrom = { x: currentX, y: currentY };
    this._stepTo = { x: newPath[1].x, y: newPath[1].y };
    this._updateDirection(newPath[1].x - currentX, newPath[1].y - currentY);
  }

  // =============================================================================
  // DIRECTION
  // =============================================================================

  /**
   * Update the entity's facing direction based on movement delta.
   *
   * @param {number} dx - Delta X.
   * @param {number} dy - Delta Y.
   * @private
   */
  _updateDirection(dx, dy) {
    const dir = getDirectionFromDelta(dx, dy);
    if (dir !== DIRECTION.NONE) {
      this._direction = dir;
      if (this.entity) {
        this.entity.direction = dir;
      }
    }
  }

  /**
   * Get the current facing direction.
   *
   * @returns {string} Direction constant.
   */
  getDirection() {
    return this._direction;
  }

  /**
   * Set the facing direction manually.
   *
   * @param {string} dir - Direction constant.
   */
  setDirection(dir) {
    this._direction = dir;
    if (this.entity) {
      this.entity.direction = dir;
    }
  }

  // =============================================================================
  // OCCUPANCY / PLAYER AVOIDANCE
  // =============================================================================

  /**
   * Mark tiles as occupied by other players.
   *
   * @param {Array<{x:number, y:number}>} tiles - Occupied tile coordinates.
   */
  setOccupiedTiles(tiles) {
    this._occupiedTiles.clear();
    for (const t of tiles) {
      this._occupiedTiles.add(this._key(t.x, t.y));
    }
  }

  /**
   * Add a single occupied tile.
   *
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   */
  addOccupiedTile(x, y) {
    this._occupiedTiles.add(this._key(x, y));
  }

  /**
   * Remove a single occupied tile.
   *
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   */
  removeOccupiedTile(x, y) {
    this._occupiedTiles.delete(this._key(x, y));
  }

  /**
   * Clear all occupied tile markers.
   */
  clearOccupiedTiles() {
    this._occupiedTiles.clear();
  }

  /**
   * Reserve tiles along the current path so other pathfinders avoid them.
   *
   * @param {Array<{x:number, y:number}>} path - Path tiles.
   * @private
   */
  _reservePath(path) {
    // This entity's own path tiles could be reserved in a global system.
    // For now, we just ensure the destination is tracked.
    if (path.length > 0) {
      const dest = path[path.length - 1];
      this._occupiedTiles.add(this._key(dest.x, dest.y));
    }
  }

  /**
   * Clear occupancy reservations made by this mover.
   *
   * @private
   */
  _clearOwnOccupancy() {
    if (!this._path || this._path.length === 0) return;
    for (const p of this._path) {
      this._occupiedTiles.delete(this._key(p.x, p.y));
    }
  }

  // =============================================================================
  // CALLBACKS
  // =============================================================================

  /**
   * Register a callback for when the entity arrives at destination.
   *
   * @param {Function} callback - Function(tileX, tileY) called on arrival.
   */
  onArrive(callback) {
    if (typeof callback === 'function') {
      this._onArrive = callback;
    }
  }

  /**
   * Register a callback for when each tile step completes.
   *
   * @param {Function} callback - Function(tileX, tileY, stepIndex, totalSteps).
   */
  onStep(callback) {
    if (typeof callback === 'function') {
      this._onStep = callback;
    }
  }

  /**
   * Register a callback for when the path is blocked.
   *
   * @param {Function} callback - Function(currentX, currentY, destX, destY, reason).
   */
  onBlocked(callback) {
    if (typeof callback === 'function') {
      this._onBlocked = callback;
    }
  }

  /**
   * Register a callback for furniture interaction on arrival.
   *
   * @param {Function} callback - Function(tileX, tileY, furniture) called.
   */
  onFurnitureInteract(callback) {
    if (typeof callback === 'function') {
      this._onFurnitureInteract = callback;
    }
  }

  /**
   * Remove all registered callbacks.
   */
  clearCallbacks() {
    this._onArrive = null;
    this._onStep = null;
    this._onBlocked = null;
    this._onFurnitureInteract = null;
  }

  /**
   * Fire the arrive callback.
   *
   * @param {number} x - Arrival tile X.
   * @param {number} y - Arrival tile Y.
   * @private
   */
  _triggerArrive(x, y) {
    if (this._onArrive) {
      try {
        this._onArrive(x, y);
      } catch (e) {
        console.error('Movement onArrive callback error:', e);
      }
    }
  }

  /**
   * Fire the step callback.
   *
   * @param {number} x - Current tile X.
   * @param {number} y - Current tile Y.
   * @private
   */
  _triggerStep(x, y) {
    if (this._onStep) {
      try {
        const stepIndex = this._pathIndex;
        const totalSteps = this._path.length - 1;
        this._onStep(x, y, stepIndex, totalSteps);
      } catch (e) {
        console.error('Movement onStep callback error:', e);
      }
    }
  }

  /**
   * Fire the blocked callback.
   *
   * @param {number} currentX - Current tile X.
   * @param {number} currentY - Current tile Y.
   * @param {number} destX - Destination X (may be undefined).
   * @param {number} destY - Destination Y (may be undefined).
   * @param {string} reason - Block reason string.
   * @private
   */
  _triggerBlocked(currentX, currentY, destX, destY, reason) {
    if (this._onBlocked) {
      try {
        this._onBlocked(currentX, currentY, destX, destY, reason);
      } catch (e) {
        console.error('Movement onBlocked callback error:', e);
      }
    }
  }

  // =============================================================================
  // FURNITURE INTERACTION
  // =============================================================================

  /**
   * Check if the destination tile has interactive furniture and trigger.
   *
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   * @private
   */
  _checkFurnitureInteraction(x, y) {
    const tile = this.tilemap.getTile(x, y);
    if (!tile || !tile.furniture) return;

    if (tile.furniture.interactive) {
      if (this._onFurnitureInteract) {
        try {
          this._onFurnitureInteract(x, y, tile.furniture);
        } catch (e) {
          console.error('Furniture interaction callback error:', e);
        }
      }
    }
  }

  // =============================================================================
  // PORTAL HANDLING
  // =============================================================================

  /**
   * Check if the entity is standing on a portal and return portal data.
   *
   * @returns {{destArea:string, destX:number, destY:number}|null} Portal data or null.
   */
  checkPortal() {
    if (!this.entity || !this.tilemap) return null;
    const tile = this.tilemap.getTile(this.entity.tileX, this.entity.tileY);
    if (tile && tile.portal) {
      return tile.portal;
    }
    return null;
  }

  // =============================================================================
  // STATE QUERIES
  // =============================================================================

  /**
   * Get the current movement state.
   *
   * @returns {string} State string from MOVE_STATE.
   */
  getState() {
    return this.state;
  }

  /**
   * Get current step progress (0..1).
   *
   * @returns {number} Progress value.
   */
  getStepProgress() {
    return this._stepProgress;
  }

  /**
   * Get the current hop offset for rendering.
   *
   * @returns {number} Pixel offset.
   */
  getHopOffset() {
    return this._hopOffset;
  }

  /**
   * Get current interpolated screen position.
   *
   * @returns {{screenX:number, screenY:number}} Screen position.
   */
  getInterpolatedPosition() {
    return {
      screenX: this.entity?.screenX ?? 0,
      screenY: this.entity?.screenY ?? 0,
    };
  }

  /**
   * Get the next tile in the path (if any).
   *
   * @returns {{x:number, y:number}|null} Next tile or null.
   */
  getNextTile() {
    if (!this._path || this._pathIndex >= this._path.length) return null;
    return { ...this._path[this._pathIndex] };
  }

  /**
   * Get the previous tile in the path (if any).
   *
   * @returns {{x:number, y:number}|null} Previous tile or null.
   */
  getPreviousTile() {
    if (!this._path || this._pathIndex <= 0) return null;
    return { ...this._path[this._pathIndex - 1] };
  }

  // =============================================================================
  // WARP / TELEPORT
  // =============================================================================

  /**
   * Instantly teleport the entity to a tile without animation.
   *
   * @param {number} tileX - Target tile X.
   * @param {number} tileY - Target tile Y.
   */
  warp(tileX, tileY) {
    this.stop();
    this._snapToTile(tileX, tileY);
    if (this.entity) {
      this.entity.tileX = tileX;
      this.entity.tileY = tileY;
    }
  }

  // =============================================================================
  // NUDGE / BUMP ANIMATION
  // =============================================================================

  /**
   * Play a short "bump" animation when walking into a blocked tile.
   * The entity moves slightly toward the blocked tile then returns.
   *
   * @param {number} dx - Direction delta X.
   * @param {number} dy - Direction delta Y.
   */
  nudge(dx, dy) {
    if (!this.entity) return;
    if (this.state !== MOVE_STATE.IDLE) return;

    const fromX = this.entity.tileX ?? 0;
    const fromY = this.entity.tileY ?? 0;
    const toX = fromX + Math.max(-1, Math.min(1, dx));
    const toY = fromY + Math.max(-1, Math.min(1, dy));

    const fromPos = tileToScreen(fromX, fromY);
    const toPos = tileToScreen(toX, toY);

    // Move 20% toward blocked tile
    this.entity.screenX = fromPos.screenX + (toPos.screenX - fromPos.screenX) * 0.2;
    this.entity.screenY = fromPos.screenY + (toPos.screenY - fromPos.screenY) * 0.2;

    // Snap back after 150ms
    setTimeout(() => {
      if (this.entity && this.entity.tileX === fromX && this.entity.tileY === fromY) {
        this._syncEntityPosition();
      }
    }, 150);
  }

  // =============================================================================
  // DESTRUCTION
  // =============================================================================

  /**
   * Clean up all state and references.
   */
  destroy() {
    this.stop();
    this.clearCallbacks();
    this._occupiedTiles.clear();
    this.entity = null;
    this.tilemap = null;
  }
}
