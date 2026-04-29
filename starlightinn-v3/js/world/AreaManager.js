/**
 * AreaManager.js
 * ==============
 * Handles area transitions, ambient rendering, particle systems,
 * background gradients, and per-area atmosphere.
 *
 * Transition flow:
 *   1. Fade to black   (0.5 s)
 *   2. Swap area data  (instant)
 *   3. Fade in         (0.5 s)
 *   4. Emit atmosphere particles
 *
 * @module world/AreaManager
 */

import { getArea, AREA_ORDER } from './AreaData.js';

/** Fade duration in milliseconds. */
const FADE_DURATION = 500;

/** Easing curve for fade: smoothstep. */
function ease(t) {
  return t * t * (3 - 2 * t);
}

/** Create a 2-stop Canvas linear gradient. */
function makeBgGradient(ctx, W, H, colors) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, colors[0]);
  if (colors[2]) {
    g.addColorStop(0.5, colors[1]);
    g.addColorStop(1, colors[2]);
  } else {
    g.addColorStop(1, colors[1]);
  }
  return g;
}

// ------------------------------------------------------------------
// AreaManager
// ------------------------------------------------------------------

export class AreaManager {
  /**
   * @param {Object} game — The main Game instance providing canvas size,
   *                        player reference, and event bus.
   */
  constructor(game) {
    this.game = game;
    this.currentAreaId = null;
    this.transitionAlpha = 0;   // 0 = fully visible, 1 = fully black
    this.transitioning = false;
    this.transitionDir = 0;     // 1 = fading out, -1 = fading in
    this.targetArea = null;
    this.fromArea = null;
    this.fromDirection = null;
    this.elapsedFade = 0;

    /** @type {Map<string, Particle[]>} */
    this.particles = new Map();

    /** Friends currently present per area. */
    this.friendsInArea = new Map();
  }

  // ================================================================
  // Transitions
  // ================================================================

  /**
   * Begin transition into a new area.
   * @param {string} areaId       Target area ID.
   * @param {string|null} fromDirection  Cardinal direction player arrived from
   *                                    ('left','right','up','down') or null.
   */
  enter(areaId, fromDirection = null) {
    if (this.transitioning) return;
    if (!getArea(areaId)) {
      console.warn(`AreaManager: unknown area "${areaId}"`);
      return;
    }

    this.fromArea = this.currentAreaId;
    this.fromDirection = fromDirection;
    this.targetArea = areaId;
    this.transitioning = true;
    this.transitionDir = 1;      // fade OUT first
    this.transitionAlpha = 0;
    this.elapsedFade = 0;

    // Notify game that departure is beginning (e.g. save local state).
    if (this.game.onAreaExit) {
      this.game.onAreaExit(this.currentAreaId);
    }
  }

  /**
   * Internal: called once fade-out reaches full opacity.
   */
  _swapArea() {
    this.currentAreaId = this.targetArea;
    const area = getArea(this.currentAreaId);

    // Position player at entry point.
    const spawn = this.getSpawnPoint(this.currentAreaId, this.fromArea, this.fromDirection);
    if (this.game.player) {
      this.game.player.x = spawn.x;
      this.game.player.y = spawn.y;
    }

    // Rebuild particle system for the new atmosphere.
    this.spawnParticles(this.currentAreaId);

    // Trigger area music switch.
    if (this.game.audio) {
      this.game.audio.playAreaMusic(area.music);
    }

    // Notify post-enter hooks.
    if (this.game.onAreaEnter) {
      this.game.onAreaEnter(this.currentAreaId);
    }

    // Start fade-IN.
    this.transitionDir = -1;
    this.elapsedFade = 0;
  }

  /**
   * Finish the transition once fade-in completes.
   */
  _finishTransition() {
    this.transitioning = false;
    this.transitionAlpha = 0;
    this.targetArea = null;
    this.fromArea = null;
    this.fromDirection = null;
  }

  // ================================================================
  // Update
  // ================================================================

  /**
   * Step the manager: fades, particles, idle timers.
   * @param {number} dt — Delta time in seconds.
   */
  update(dt) {
    // --- Fade state machine ---
    if (this.transitioning) {
      this.elapsedFade += dt * 1000;
      const t = Math.min(this.elapsedFade / FADE_DURATION, 1);
      const eased = ease(t);

      if (this.transitionDir === 1) {
        // Fading OUT
        this.transitionAlpha = eased;
        if (t >= 1) {
          this._swapArea();
        }
      } else {
        // Fading IN
        this.transitionAlpha = 1 - eased;
        if (t >= 1) {
          this._finishTransition();
        }
      }
    }

    // --- Particles ---
    const list = this.particles.get(this.currentAreaId);
    if (list) {
      for (const p of list) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.phase += dt * p.freq;

        // Wrap / bounce / respawn
        if (p.life <= 0) {
          this._resetParticle(p);
        }
      }
    }
  }

  // ================================================================
  // Rendering
  // ================================================================

  /**
   * Render the current area background, floor, decorations, particles,
   * and transition overlay.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W — Canvas width.
   * @param {number} H — Canvas height.
   */
  render(ctx, W, H) {
    if (!this.currentAreaId) return;
    const area = getArea(this.currentAreaId);
    if (!area) return;

    // ---- Background gradient ----
    const bgGrad = makeBgGradient(ctx, W, H, area.bg);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ---- Floor with subtle perspective ----
    const floorY = Math.floor(H * area.floorY);
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, H);
    floorGrad.addColorStop(0, this._lighten(area.floorColor, 10));
    floorGrad.addColorStop(1, area.floorColor);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, W, H - floorY);

    // Floor horizon line
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(W, floorY);
    ctx.stroke();

    // ---- Ambient particles (behind decorations) ----
    this._renderParticles(ctx, W, H);

    // ---- Decorations (emoji) ----
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const d of area.decorations) {
      const dx = d.x * W;
      const dy = d.y * H;
      // Shadow for depth
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.font = `${Math.floor(H * 0.055)}px serif`;
      ctx.fillText(d.emoji, dx + 2, dy + 3);
      // Main
      ctx.fillStyle = '#fff';
      ctx.fillText(d.emoji, dx, dy);
    }

    // ---- Lighting overlay ----
    this._applyLightingOverlay(ctx, W, H, area.lighting);

    // ---- Transition overlay ----
    if (this.transitionAlpha > 0) {
      ctx.fillStyle = `rgba(10, 8, 20, ${this.transitionAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /**
   * Draw a lighting tint over the whole canvas based on the area theme.
   * @private
   */
  _applyLightingOverlay(ctx, W, H, lighting) {
    const overlays = {
      candlelit:    'rgba(255, 160, 60, 0.04)',
      moonlit:      'rgba(120, 180, 255, 0.05)',
      bioluminescent:'rgba(100, 255, 150, 0.04)',
      lanternlight: 'rgba(255, 200, 80, 0.05)',
      sunny:        'rgba(255, 255, 200, 0.06)',
      crystalline:  'rgba(180, 100, 255, 0.05)',
      aurora:       'rgba(100, 255, 200, 0.04)',
      warm_spotlight:'rgba(255, 140, 60, 0.04)',
      amber_glow:   'rgba(255, 180, 60, 0.05)',
      spotlit:      'rgba(255, 220, 120, 0.04)',
      twilight_glow:'rgba(200, 100, 200, 0.04)',
      neon_pulse:   'rgba(200, 60, 255, 0.03)',
      soft_glow:    'rgba(255, 200, 220, 0.04)',
      lantern_festival:'rgba(255, 180, 80, 0.05)'
    };
    const tint = overlays[lighting] || 'rgba(0,0,0,0)';
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
  }

  // ================================================================
  // Particles
  // ================================================================

  /**
   * Spawn ambient particles matching the area's theme.
   * @param {string} areaId
   */
  spawnParticles(areaId) {
    const area = getArea(areaId);
    if (!area) return;

    const { particleType, density } = area.ambient;
    const list = [];
    for (let i = 0; i < density; i++) {
      list.push(this._createParticle(particleType));
    }
    this.particles.set(areaId, list);
  }

  /**
   * @private
   * @param {string} type — 'firefly'|'sparkle'|'dust'|'steam'|'petal'
   */
  _createParticle(type) {
    const p = {
      x: Math.random(),
      y: Math.random(),
      vx: 0,
      vy: 0,
      life: 2 + Math.random() * 4,
      maxLife: 0,
      size: 2,
      phase: Math.random() * Math.PI * 2,
      freq: 1 + Math.random(),
      type,
      alpha: 0.6 + Math.random() * 0.4
    };
    this._resetParticle(p);
    return p;
  }

  /** @private */
  _resetParticle(p) {
    p.x = Math.random();
    p.y = Math.random();
    p.life = p.maxLife = 2 + Math.random() * 5;
    p.phase = Math.random() * Math.PI * 2;

    switch (p.type) {
      case 'firefly':
        p.vx = (Math.random() - 0.5) * 0.03;
        p.vy = (Math.random() - 0.5) * 0.02;
        p.size = 2 + Math.random() * 2;
        p.color = `rgba(255,220,100,${p.alpha})`;
        break;
      case 'sparkle':
        p.vx = (Math.random() - 0.5) * 0.01;
        p.vy = (Math.random() - 0.5) * 0.01 - 0.005;
        p.size = 1.5 + Math.random() * 2;
        p.color = `rgba(200,240,255,${p.alpha})`;
        break;
      case 'dust':
        p.vx = (Math.random() - 0.5) * 0.01;
        p.vy = 0.005 + Math.random() * 0.01;
        p.size = 1 + Math.random();
        p.color = `rgba(210,180,140,${p.alpha * 0.5})`;
        break;
      case 'steam':
        p.x = 0.3 + Math.random() * 0.4;
        p.y = 0.5 + Math.random() * 0.2;
        p.vx = (Math.random() - 0.5) * 0.01;
        p.vy = -0.015 - Math.random() * 0.01;
        p.size = 4 + Math.random() * 6;
        p.color = `rgba(255,255,255,${p.alpha * 0.25})`;
        break;
      case 'petal':
        p.vx = 0.01 + Math.random() * 0.02;
        p.vy = 0.01 + Math.random() * 0.02;
        p.size = 2 + Math.random() * 2;
        p.color = `rgba(255,180,200,${p.alpha * 0.6})`;
        break;
      default:
        p.vx = (Math.random() - 0.5) * 0.02;
        p.vy = (Math.random() - 0.5) * 0.02;
        p.size = 2;
        p.color = `rgba(255,255,255,${p.alpha})`;
    }
  }

  /** @private */
  _renderParticles(ctx, W, H) {
    const list = this.particles.get(this.currentAreaId);
    if (!list) return;

    for (const p of list) {
      const px = p.x * W;
      const py = p.y * H;
      const flicker = 0.5 + 0.5 * Math.sin(p.phase);
      const alpha = (p.life / p.maxLife) * p.alpha * flicker;

      if (p.type === 'steam') {
        const r = p.size * (1 + (1 - p.life / p.maxLife));
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'sparkle') {
        ctx.fillStyle = `rgba(200,240,255,${alpha.toFixed(3)})`;
        ctx.beginPath();
        // Diamond sparkle shape
        const s = p.size;
        ctx.moveTo(px, py - s);
        ctx.lineTo(px + s * 0.4, py);
        ctx.lineTo(px, py + s);
        ctx.lineTo(px - s * 0.4, py);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${alpha.toFixed(3)})`);
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
        // Glow halo for fireflies
        if (p.type === 'firefly') {
          ctx.fillStyle = `rgba(255,220,100,${(alpha * 0.25).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ================================================================
  // Spawn points
  // ================================================================

  /**
   * Determine where a player should appear when entering an area.
   * @param {string} areaId        Target area.
   * @param {string|null} fromAreaId  Previous area (for symmetry).
   * @param {string|null} fromDirection Cardinal direction player came from.
   * @returns {{x:number, y:number}} Normalized coordinates [0..1].
   */
  getSpawnPoint(areaId, fromAreaId, fromDirection) {
    const area = getArea(areaId);
    if (!area) return { x: 0.5, y: 0.5 };

    // Direction-based entry (arriving from an edge)
    switch (fromDirection) {
      case 'left':  return { x: 0.08, y: area.floorY + 0.10 };
      case 'right': return { x: 0.92, y: area.floorY + 0.10 };
      case 'up':    return { x: 0.50, y: area.floorY + 0.05 };
      case 'down':  return { x: 0.50, y: 0.90 };
    }

    // If no direction, place near the center slightly forward
    return { x: 0.50, y: area.floorY + 0.12 };
  }

  // ================================================================
  // Friends indicator
  // ================================================================

  /**
   * Return a list of friend display names currently in an area.
   * @param {string} areaId
   * @returns {string[]}
   */
  getFriendsInArea(areaId) {
    return this.friendsInArea.get(areaId) || [];
  }

  /**
   * Set the roster of friends for an area (called by presence system).
   * @param {string} areaId
   * @param {string[]} names
   */
  setFriendsInArea(areaId, names) {
    this.friendsInArea.set(areaId, names);
  }

  /**
   * Count of friends in a given area (for UI badge "3 friends here").
   * @param {string} areaId
   * @returns {number}
   */
  getFriendCount(areaId) {
    return (this.friendsInArea.get(areaId) || []).length;
  }

  // ================================================================
  // Utility
  // ================================================================

  /**
   * @returns {boolean} True if a fade transition is in progress.
   */
  isTransitioning() {
    return this.transitioning;
  }

  /**
   * @returns {string|null} The currently loaded area ID.
   */
  getCurrentAreaId() {
    return this.currentAreaId;
  }

  /**
   * @returns {Object|null} The currently loaded area definition.
   */
  getCurrentArea() {
    return this.currentAreaId ? getArea(this.currentAreaId) : null;
  }

  /** @private Lighten a hex color by a percentage. */
  _lighten(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x00FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }
}
