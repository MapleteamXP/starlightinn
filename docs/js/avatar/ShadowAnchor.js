/**
 * ShadowAnchor.js — Shadow as Core Interaction System
 *
 * In Starlight Inn, the shadow beneath each entity is not merely decorative.
 * It IS the interaction surface: hit detection, directional indicator,
 * depth cue, and UI trigger all flow through the shadow.
 *
 * Design principles:
 * - Shadow is drawn BEFORE the entity (bottom z-layer)
 * - Shadow size scales with Y position (fake depth / parallax)
 * - Shadow elongates in the direction of movement
 * - Shadow breathes when idle, stretches when moving
 * - Golden glow ring on hover indicates interactivity
 * - Right-click on shadow triggers radial context menu
 *
 * @author Starlight Inn Team
 * @version 3.5.0
 */

/** @typedef {import('../engine/Game.js').Game} Game */

/**
 * @typedef {Object} ShadowEntity
 * @property {number} x         — World X position (centre)
 * @property {number} y         — World Y position (feet/ground level)
 * @property {number} width     — Entity width in world units
 * @property {number} height    — Entity height in world units
 * @property {string} facing    — 'left' | 'right' | 'center'
 * @property {boolean} moving   — Is the entity currently moving?
 * @property {boolean} hovered  — Is the mouse over this shadow?
 * @property {boolean} selected — Is this entity selected?
 * @property {number} [opacity] — Shadow opacity override (0..1)
 * @property {number} [groundY] — The Y coordinate of the ground plane
 */

/**
 * @typedef {Object} ShadowConfig
 * @property {number} baseOpacity   — Default shadow opacity (0..1)
 * @property {number} widthRatio    — Shadow width as ratio of entity width
 * @property {number} heightRatio   — Shadow height as ratio of shadow width
 * @property {number} depthScale    — How much Y position affects shadow size
 * @property {number} breatheSpeed  — Idle breathing animation speed (rad/s)
 * @property {number} breatheAmount — Idle breathing scale amplitude
 * @property {number} stretchAmount — Movement stretch factor
 * @property {string} shadowColor   — Base shadow colour (RGBA string)
 * @property {string} glowColor     — Hover glow colour (RGBA string)
 */

/** Default shadow rendering configuration. */
const DEFAULT_CONFIG = {
  baseOpacity: 0.28,
  widthRatio: 0.85,
  heightRatio: 0.28,
  depthScale: 0.001,
  breatheSpeed: 2.2,
  breatheAmount: 0.06,
  stretchAmount: 0.18,
  shadowColor: '30,30,45',
  glowColor: '255,215,100',
};

/** Global time source for animated shadows. */
let _globalTime = 0;

/**
 * ShadowAnchor renders and manages shadows as the primary interaction
 * surface for all entities in the Starlight Inn world.
 */
export class ShadowAnchor {
  /**
   * @param {Game} game — The main game instance
   * @param {Partial<ShadowConfig>} [config] — Optional shadow config overrides
   */
  constructor(game, config = {}) {
    this.game = game;
    /** @type {ShadowConfig} */
    this.config = { ...DEFAULT_CONFIG, ...config };

    /** @type {Map<string, ShadowEntity>} */
    this.shadows = new Map();

    /** @type {Set<Function>} */
    this.hoverListeners = new Set();
    /** @type {Set<Function>} */
    this.clickListeners = new Set();
    /** @type {Set<Function>} */
    this.rightClickListeners = new Set();

    this._lastHoveredId = null;
  }

  /* ================================================================
     ENTITY REGISTRATION
     ================================================================ */

  /**
   * Register an entity's shadow.
   * @param {string} entityId
   * @param {ShadowEntity} entity
   */
  register(entityId, entity) {
    this.shadows.set(entityId, {
      groundY: entity.y,
      opacity: this.config.baseOpacity,
      hovered: false,
      selected: false,
      ...entity,
    });
  }

  /**
   * Update an existing shadow's properties.
   * @param {string} entityId
   * @param {Partial<ShadowEntity>} props
   */
  updateEntity(entityId, props) {
    const existing = this.shadows.get(entityId);
    if (existing) {
      Object.assign(existing, props);
    }
  }

  /**
   * Remove a shadow registration.
   * @param {string} entityId
   */
  unregister(entityId) {
    this.shadows.delete(entityId);
  }

  /**
   * Get a registered shadow entity.
   * @param {string} entityId
   * @returns {ShadowEntity|undefined}
   */
  get(entityId) {
    return this.shadows.get(entityId);
  }

  /* ================================================================
     SHADOW RENDERING
     ================================================================ */

  /**
   * Draw a basic elliptical shadow at an entity's feet.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} entityX   — World X centre
   * @param {number} entityY   — World Y (feet position)
   * @param {number} entityWidth — Entity collision width
   * @param {number} [groundY]  — Ground plane Y (defaults to entityY)
   * @param {number} [opacity]  — Override opacity (0..1)
   */
  drawShadow(ctx, entityX, entityY, entityWidth, groundY, opacity) {
    const cfg = this.config;
    const effectiveGroundY = groundY ?? entityY;
    const heightAboveGround = Math.max(0, effectiveGroundY - entityY);

    // Depth-based scaling: higher Y = smaller shadow (fake depth)
    const depthScale = Math.max(0.4, 1.0 - heightAboveGround * cfg.depthScale);
    const shadowW = entityWidth * cfg.widthRatio * depthScale;
    const shadowH = shadowW * cfg.heightRatio;
    const alpha = (opacity ?? cfg.baseOpacity) * depthScale;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Soft radial gradient for realistic shadow falloff
    const grad = ctx.createRadialGradient(
      entityX, entityY, 0,
      entityX, entityY, shadowW
    );
    const [r, g, b] = cfg.shadowColor.split(',').map(Number);
    grad.addColorStop(0.0, `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(0.35, `rgba(${r},${g},${b},0.25)`);
    grad.addColorStop(0.75, `rgba(${r},${g},${b},0.08)`);
    grad.addColorStop(1.0, `rgba(${r},${g},${b},0.00)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(entityX, entityY, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw an animated shadow that breathes when idle and stretches
   * in the direction of movement.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {ShadowEntity} entity
   * @param {number} time — Current game time in seconds
   */
  drawAnimatedShadow(ctx, entity, time) {
    const cfg = this.config;
    _globalTime = time;

    const heightAboveGround = Math.max(0, (entity.groundY ?? entity.y) - entity.y);
    const depthScale = Math.max(0.4, 1.0 - heightAboveGround * cfg.depthScale);

    // Breathing animation when idle
    const breathe = entity.moving
      ? 1.0
      : 1.0 + Math.sin(time * cfg.breatheSpeed) * cfg.breatheAmount;

    // Directional stretch: shadow elongates behind movement direction
    let stretchX = 1.0;
    let stretchY = 1.0;
    let offsetX = 0;

    if (entity.moving) {
      if (entity.facing === 'left') {
        stretchX = 1.0 + cfg.stretchAmount;
        offsetX = -entity.width * cfg.stretchAmount * 0.3;
      } else if (entity.facing === 'right') {
        stretchX = 1.0 + cfg.stretchAmount;
        offsetX = entity.width * cfg.stretchAmount * 0.3;
      }
      stretchY = 1.0 - cfg.stretchAmount * 0.4;
    }

    const shadowW = entity.width * cfg.widthRatio * depthScale * breathe * stretchX;
    const shadowH = entity.width * cfg.widthRatio * depthScale * cfg.heightRatio * stretchY;
    const alpha = (entity.opacity ?? cfg.baseOpacity) * depthScale;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Directional gradient: darker in the stretch direction
    const grad = ctx.createRadialGradient(
      entity.x + offsetX * 0.5, entity.y, shadowW * 0.15,
      entity.x, entity.y, shadowW
    );
    const [sr, sg, sb] = cfg.shadowColor.split(',').map(Number);
    grad.addColorStop(0.0, `rgba(${sr},${sg},${sb},0.60)`);
    grad.addColorStop(0.4, `rgba(${sr},${sg},${sb},0.22)`);
    grad.addColorStop(1.0, `rgba(${sr},${sg},${sb},0.00)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(
      entity.x + offsetX,
      entity.y,
      shadowW,
      shadowH,
      0, 0, Math.PI * 2
    );
    ctx.fill();

    ctx.restore();

    // Hover glow
    if (entity.hovered) {
      this.drawHoverGlow(ctx, entity.x, entity.y, entity.width, 1.0, depthScale);
    }

    // Selection indicator
    if (entity.selected) {
      this.drawSelectionRing(ctx, entity.x, entity.y, entity.width, depthScale);
    }
  }

  /**
   * Draw all registered shadows in a single batch call.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} time
   */
  drawAll(ctx, time) {
    for (const [entityId, entity] of this.shadows) {
      this.drawAnimatedShadow(ctx, entity, time);
    }
  }

  /* ================================================================
     INTERACTION HIT DETECTION
     ================================================================ */

  /**
   * Test if a point (e.g., mouse cursor) is over an entity's shadow.
   * Uses elliptical hit testing for accurate detection.
   *
   * @param {number} px — Point X (screen/world space)
   * @param {number} py — Point Y (screen/world space)
   * @param {number} entityX — Entity centre X
   * @param {number} entityY — Entity feet Y
   * @param {number} entityWidth — Entity width
   * @returns {boolean}
   */
  isPointOverShadow(px, py, entityX, entityY, entityWidth) {
    const cfg = this.config;
    const shadowW = entityWidth * cfg.widthRatio;
    const shadowH = shadowW * cfg.heightRatio;

    // Elliptical hit test: (dx/a)^2 + (dy/b)^2 <= 1
    const dx = px - entityX;
    const dy = py - entityY;
    const normalized = (dx * dx) / (shadowW * shadowW) + (dy * dy) / (shadowH * shadowH);

    return normalized <= 1.0;
  }

  /**
   * Find which entity's shadow is under a given point.
   * Returns the top-most (closest to camera = highest on screen)
   * entity whose shadow contains the point.
   *
   * @param {number} px
   * @param {number} py
   * @returns {{entityId: string, entity: ShadowEntity}|null}
   */
  pickShadowAt(px, py) {
    let best = null;
    let bestY = Infinity;

    for (const [entityId, entity] of this.shadows) {
      if (this.isPointOverShadow(px, py, entity.x, entity.y, entity.width)) {
        // Lower Y on screen = closer to camera = on top
        if (entity.y < bestY) {
          bestY = entity.y;
          best = { entityId, entity };
        }
      }
    }

    return best;
  }

  /**
   * Update hover states based on cursor position. Fires hover events
   * when entering/leaving shadows.
   *
   * @param {number} cursorX
   * @param {number} cursorY
   */
  updateHover(cursorX, cursorY) {
    const picked = this.pickShadowAt(cursorX, cursorY);
    const newHoveredId = picked?.entityId ?? null;

    if (newHoveredId !== this._lastHoveredId) {
      // Mouse left previous shadow
      if (this._lastHoveredId) {
        const prev = this.shadows.get(this._lastHoveredId);
        if (prev) prev.hovered = false;
        this._fireHoverEvent(this._lastHoveredId, false, cursorX, cursorY);
      }

      // Mouse entered new shadow
      if (newHoveredId) {
        picked.entity.hovered = true;
        this._fireHoverEvent(newHoveredId, true, cursorX, cursorY);
      }

      this._lastHoveredId = newHoveredId;
    }
  }

  /* ================================================================
     VISUAL EFFECTS
     ================================================================ */

  /**
   * Draw a golden glow ring around a shadow on mouse hover.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} entityX
   * @param {number} entityY
   * @param {number} entityWidth
   * @param {number} intensity — 0..1 hover intensity
   * @param {number} [depthScale=1.0]
   */
  drawHoverGlow(ctx, entityX, entityY, entityWidth, intensity, depthScale = 1.0) {
    const cfg = this.config;
    const glowR = entityWidth * 1.3 * depthScale;
    const alpha = intensity * 0.35;

    ctx.save();

    // Outer soft glow
    const outerGrad = ctx.createRadialGradient(
      entityX, entityY, entityWidth * 0.4,
      entityX, entityY, glowR
    );
    const [gr, gg, gb] = cfg.glowColor.split(',').map(Number);
    outerGrad.addColorStop(0.0, `rgba(${gr},${gg},${gb},${alpha})`);
    outerGrad.addColorStop(0.5, `rgba(${gr},${gg},${gb},${alpha * 0.4})`);
    outerGrad.addColorStop(1.0, `rgba(${gr},${gg},${gb},0.00)`);

    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.ellipse(entityX, entityY, glowR, glowR * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright ring
    const ringAlpha = alpha * 0.6;
    ctx.strokeStyle = `rgba(${gr},${gg},${gb},${ringAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(entityX, entityY, entityWidth * 0.9, entityWidth * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw a selection indicator ring around a shadow.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} entityX
   * @param {number} entityY
   * @param {number} entityWidth
   * @param {number} [depthScale=1.0]
   */
  drawSelectionRing(ctx, entityX, entityY, entityWidth, depthScale = 1.0) {
    const ringW = entityWidth * 1.1 * depthScale;
    const ringH = ringW * 0.32;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,230,150,0.65)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 3]);
    ctx.lineDashOffset = -_globalTime * 12;

    ctx.beginPath();
    ctx.ellipse(entityX, entityY, ringW, ringH, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Draw a direction indicator arrow extending from the shadow
   * in the facing direction. Useful for showing movement intent.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {ShadowEntity} entity
   * @param {number} [arrowLength=20]
   */
  drawDirectionArrow(ctx, entity, arrowLength = 20) {
    if (entity.facing === 'center') return;

    const dir = entity.facing === 'left' ? -1 : 1;
    const startX = entity.x + dir * entity.width * 0.5;
    const endX = startX + dir * arrowLength;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(startX, entity.y);
    ctx.lineTo(endX, entity.y);
    ctx.stroke();

    // Arrow head
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(endX, entity.y);
    ctx.lineTo(endX - dir * 5, entity.y - 3);
    ctx.lineTo(endX - dir * 5, entity.y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ================================================================
     DEPTH CUE SYSTEM
     ================================================================ */

  /**
   * Calculate a depth multiplier based on Y position.
   * Lower on screen (higher Y) = further away = smaller.
   *
   * @param {number} entityY
   * @param {number} horizonY — Y coordinate of the horizon line
   * @param {number} groundY  — Y coordinate of the ground plane
   * @returns {number} Scale factor 0..1
   */
  getDepthScale(entityY, horizonY, groundY) {
    const range = groundY - horizonY;
    if (range <= 0) return 1.0;
    const t = Math.max(0, Math.min(1, (entityY - horizonY) / range));
    // Non-linear depth: objects shrink faster as they approach horizon
    return 0.3 + 0.7 * t * t;
  }

  /**
   * Draw a depth-gradient overlay that darkens entities further
   * from the camera, enhancing the pseudo-3D effect.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} entityX
   * @param {number} entityY
   * @param {number} entityWidth
   * @param {number} entityHeight
   * @param {number} depthScale
   */
  drawDepthCue(ctx, entityX, entityY, entityWidth, entityHeight, depthScale) {
    const darkness = 1.0 - depthScale;
    if (darkness < 0.05) return;

    ctx.save();
    ctx.globalAlpha = darkness * 0.35;
    ctx.fillStyle = '#0a0a1a';
    ctx.beginPath();
    ctx.ellipse(
      entityX, entityY - entityHeight * 0.3,
      entityWidth * 0.7, entityHeight * 0.6,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  /* ================================================================
     EVENT SYSTEM
     ================================================================ */

  /**
   * Subscribe to hover events.
   * @param {Function} callback — (entityId, isHovering, x, y) => void
   * @returns {Function} Unsubscribe
   */
  onHover(callback) {
    this.hoverListeners.add(callback);
    return () => this.hoverListeners.delete(callback);
  }

  /**
   * Subscribe to click events on shadows.
   * @param {Function} callback — (entityId, x, y) => void
   * @returns {Function} Unsubscribe
   */
  onClick(callback) {
    this.clickListeners.add(callback);
    return () => this.clickListeners.delete(callback);
  }

  /**
   * Subscribe to right-click events on shadows (radial menu trigger).
   * @param {Function} callback — (entityId, x, y) => void
   * @returns {Function} Unsubscribe
   */
  onRightClick(callback) {
    this.rightClickListeners.add(callback);
    return () => this.rightClickListeners.delete(callback);
  }

  /** @private */
  _fireHoverEvent(entityId, isHovering, x, y) {
    for (const cb of this.hoverListeners) {
      try { cb(entityId, isHovering, x, y); } catch (e) { /* ignore */ }
    }
  }

  /**
   * Handle a click at the given position. Returns the clicked entity
   * or null if no shadow was hit.
   *
   * @param {number} x
   * @param {number} y
   * @returns {string|null} The entityId that was clicked
   */
  handleClick(x, y) {
    const picked = this.pickShadowAt(x, y);
    if (picked) {
      for (const cb of this.clickListeners) {
        try { cb(picked.entityId, x, y); } catch (e) { /* ignore */ }
      }
      return picked.entityId;
    }
    return null;
  }

  /**
   * Handle a right-click at the given position.
   * @param {number} x
   * @param {number} y
   * @returns {string|null} The entityId that was right-clicked
   */
  handleRightClick(x, y) {
    const picked = this.pickShadowAt(x, y);
    if (picked) {
      for (const cb of this.rightClickListeners) {
        try { cb(picked.entityId, x, y); } catch (e) { /* ignore */ }
      }
      return picked.entityId;
    }
    return null;
  }

  /* ================================================================
     UTILITY
     ================================================================ */

  /** Remove all shadow registrations. */
  clear() {
    this.shadows.clear();
    this._lastHoveredId = null;
  }

  /**
   * Get count of registered shadows.
   * @returns {number}
   */
  getCount() {
    return this.shadows.size;
  }

  /**
   * Batch-update all shadow positions from a game state object.
   * Expected format: { [entityId]: { x, y, width, facing, moving } }
   *
   * @param {Object<string,Object>} stateMap
   */
  syncFromState(stateMap) {
    for (const [entityId, state] of Object.entries(stateMap)) {
      if (this.shadows.has(entityId)) {
        this.updateEntity(entityId, state);
      } else {
        this.register(entityId, {
          x: state.x,
          y: state.y,
          width: state.width || 40,
          height: state.height || 60,
          facing: state.facing || 'center',
          moving: state.moving || false,
          groundY: state.groundY ?? state.y,
        });
      }
    }
  }

  /**
   * Dispose all listeners and clear state.
   */
  dispose() {
    this.hoverListeners.clear();
    this.clickListeners.clear();
    this.rightClickListeners.clear();
    this.clear();
  }
}
