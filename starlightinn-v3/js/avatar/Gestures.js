/**
 * Gestures.js — Social gesture system for Starlight Inn v3.0
 *
 * Manages timed avatar animations triggered by hotkeys or UI buttons.
 * Each gesture has a duration, looping flag, animation type, and optional
 * particle effect (music notes, Zzz, stars, tears). Gestures auto-expire
 * or can be cancelled by player movement.
 *
 * @author Starlight Inn Team
 * @version 3.0.0
 */

/** @typedef {import('../Game.js').Game} Game */

/**
 * @typedef {Object} GestureData
 * @property {number} duration   — seconds (-1 = indefinite)
 * @property {boolean} loop     — restart after duration?
 * @property {string} anim       — animation key
 * @property {string|null} particles — particle type key or null
 */

/**
 * @typedef {Object} ActiveGesture
 * @property {string} id
 * @property {number} elapsed    — seconds since trigger
 * @property {number} duration   — copied from GestureData
 * @property {boolean} loop
 * @property {string} anim
 * @property {string|null} particles
 * @property {number} phase     — 0..1 normalised animation phase
 */

/**
 * @typedef {Object} Particle
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} life      — remaining seconds
 * @property {number} maxLife
 * @property {string} type
 * @property {number} scale
 */

/** Gesture catalogue. */
const GESTURE_CATALOG = {
  wave:   { duration: 2.0, loop: false, anim: 'handWave',   particles: null },
  dance:  { duration: 4.0, loop: true,  anim: 'spin',       particles: 'music_notes' },
  sit:    { duration: -1,  loop: false, anim: 'sit',        particles: null },
  sleep:  { duration: -1,  loop: false, anim: 'sleep',      particles: 'zzz' },
  laugh:  { duration: 2.0, loop: false, anim: 'bounce',     particles: 'stars' },
  cry:    { duration: 3.0, loop: false, anim: 'shake',      particles: 'tears' }
};

/** Hotkey map: digits 1-6. */
const GESTURE_KEYS = ['wave', 'dance', 'sit', 'sleep', 'laugh', 'cry'];

export class Gestures {
  /**
   * @param {Game} game
   */
  constructor(game) {
    this.game = game;
    /** @type {Map<string, ActiveGesture>} */
    this.activeGestures = new Map();
    /** @type {Particle[]} */
    this.particles = [];
    this.keyListener = null;
    this._bindKeys();
  }

  /* ============================================================
     TRIGGERING
     ============================================================ */

  /**
   * Start a gesture for a player.
   * @param {string} gestureId — key from GESTURE_CATALOG
   * @param {string} [playerId='player']
   */
  trigger(gestureId, playerId = 'player') {
    const data = this.getGestureData(gestureId);
    if (!data) return;

    // Cancel any existing gesture for this player
    this.cancelGesture(playerId);

    /** @type {ActiveGesture} */
    const active = {
      id: gestureId,
      elapsed: 0,
      duration: data.duration,
      loop: data.loop,
      anim: data.anim,
      particles: data.particles,
      phase: 0
    };

    this.activeGestures.set(playerId, active);

    // Burst particles on start
    if (active.particles) {
      this._spawnBurst(active.particles, playerId, 6);
    }
  }

  /**
   * Look up static gesture config.
   * @param {string} gestureId
   * @returns {GestureData|undefined}
   */
  getGestureData(gestureId) {
    return GESTURE_CATALOG[gestureId];
  }

  /** @returns {string[]} */
  listGestureIds() {
    return Object.keys(GESTURE_CATALOG);
  }

  /* ============================================================
     UPDATE LOOP
     ============================================================ */

  /**
   * Call once per frame with delta time in seconds.
   * @param {number} dt
   */
  update(dt) {
    // ── Update active gestures ──────────────────────────────
    for (const [playerId, g] of this.activeGestures) {
      g.elapsed += dt;

      if (g.duration > 0) {
        g.phase = (g.elapsed % g.duration) / g.duration;
        if (g.elapsed >= g.duration && !g.loop) {
          this.activeGestures.delete(playerId);
          continue;
        }
      } else {
        // Indefinite gestures: phase oscillates 0..1 over 2 s
        g.phase = (g.elapsed % 2) / 2;
      }

      // Continuous particle emission for looping or long gestures
      if (g.particles && g.elapsed > 0) {
        if (Math.random() < 0.04) {
          this._spawnParticle(g.particles, playerId);
        }
      }
    }

    // ── Update particles ────────────────────────────────────
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /* ============================================================
     QUERY STATE
     ============================================================ */

  /**
   * Is this player currently performing a gesture?
   * @param {string} [playerId='player']
   * @returns {boolean}
   */
  isGesturing(playerId = 'player') {
    return this.activeGestures.has(playerId);
  }

  /**
   * Get the active gesture record, or null.
   * @param {string} [playerId='player']
   * @returns {ActiveGesture|null}
   */
  getActiveGesture(playerId = 'player') {
    return this.activeGestures.get(playerId) || null;
  }

  /**
   * Cancel a player's gesture immediately.
   * @param {string} [playerId='player']
   */
  cancelGesture(playerId = 'player') {
    this.activeGestures.delete(playerId);
  }

  /**
   * Cancel all indefinite gestures (sit, sleep) — called when
   * the player begins moving.
   * @param {string} [playerId='player']
   */
  cancelIndefinite(playerId = 'player') {
    const g = this.activeGestures.get(playerId);
    if (g && g.duration < 0) {
      this.activeGestures.delete(playerId);
    }
  }

  /* ============================================================
     ANIMATION HELPERS  (values consumed by renderer)
     ============================================================ */

  /**
   * Compute gesture-derived offsets for the renderer.
   * @param {string} [playerId='player']
   * @returns {{offsetY:number, rot:number, armOffset:number, scaleY:number}}
   */
  getAnimOffsets(playerId = 'player') {
    const g = this.activeGestures.get(playerId);
    if (!g) return { offsetY: 0, rot: 0, armOffset: 0, scaleY: 1 };

    const p = g.phase;
    switch (g.anim) {
      case 'handWave':
        return { offsetY: 0, rot: 0, armOffset: Math.sin(p * Math.PI * 4) * 8, scaleY: 1 };
      case 'spin':
        return { offsetY: Math.abs(Math.sin(p * Math.PI * 2)) * 4, rot: p * Math.PI * 4, armOffset: Math.sin(p * Math.PI * 8) * 6, scaleY: 1 };
      case 'sit':
        return { offsetY: 10, rot: 0, armOffset: 0, scaleY: 0.85 };
      case 'sleep':
        return { offsetY: 2, rot: 0, armOffset: 0, scaleY: 1 };
      case 'bounce':
        return { offsetY: -Math.abs(Math.sin(p * Math.PI * 6)) * 6, rot: 0, armOffset: 0, scaleY: 1 };
      case 'shake':
        return { offsetY: 0, rot: 0, armOffset: Math.sin(p * Math.PI * 12) * 3, scaleY: 1 };
      default:
        return { offsetY: 0, rot: 0, armOffset: 0, scaleY: 1 };
    }
  }

  /* ============================================================
     PARTICLE SYSTEM
     ============================================================ */

  /**
   * Draw all active particles in world / screen space.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Function} getPlayerPos — (playerId) => {x,y}
   */
  drawParticles(ctx, getPlayerPos) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.scale, p.scale);

      switch (p.type) {
        case 'zzz':
          ctx.fillStyle = '#aabbee';
          ctx.font = 'bold 10px Nunito, sans-serif';
          ctx.fillText('Z', 0, 0);
          break;
        case 'music_notes':
          ctx.fillStyle = '#ff88cc';
          ctx.font = '10px Nunito, sans-serif';
          ctx.fillText('♪', 0, 0);
          break;
        case 'stars':
          ctx.fillStyle = '#ffdd44';
          this._drawMiniStar(ctx, 0, 0, 4);
          break;
        case 'tears':
          ctx.fillStyle = '#88ccff';
          ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
          break;
      }

      ctx.restore();
    }
    ctx.globalAlpha = 1.0;
  }

  /**
   * Spawn a burst of particles around a player.
   * @param {string} type
   * @param {string} playerId
   * @param {number} count
   */
  _spawnBurst(type, playerId, count) {
    for (let i = 0; i < count; i++) {
      this._spawnParticle(type, playerId);
    }
  }

  /**
   * Spawn a single particle.
   * @param {string} type
   * @param {string} playerId
   */
  _spawnParticle(type, playerId) {
    const pos = this._getPlayerPos(playerId);
    if (!pos) return;

    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 1.5;

    /** @type {Particle} */
    const p = {
      x: pos.x + (Math.random() - 0.5) * 20,
      y: pos.y - 40 - Math.random() * 10,
      vx: Math.cos(angle) * 10,
      vy: -speed * 20,
      life: 1.0 + Math.random() * 1.5,
      maxLife: 2.0,
      type,
      scale: 0.8 + Math.random() * 0.5
    };

    // Type-specific tweaks
    if (type === 'tears') {
      p.vx = (Math.random() - 0.5) * 8;
      p.vy = 15 + Math.random() * 10;
      p.life = 1.2;
      p.y = pos.y - 50;
    }
    if (type === 'zzz') {
      p.vx = 8 + Math.random() * 8;
      p.vy = -10 - Math.random() * 10;
      p.life = 2.0;
    }
    if (type === 'music_notes') {
      p.vx = (Math.random() - 0.5) * 20;
      p.vy = -25 - Math.random() * 15;
    }

    this.particles.push(p);
  }

  /* ============================================================
     KEYBOARD BINDING
     ============================================================ */

  /** Bind number keys 1-6 to gestures. */
  _bindKeys() {
    this.keyListener = (/** @type {KeyboardEvent} */ e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < GESTURE_KEYS.length) {
        this.trigger(GESTURE_KEYS[idx], 'player');
      }
    };
    window.addEventListener('keydown', this.keyListener);
  }

  /** Remove global key listener. */
  dispose() {
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }
  }

  /* ============================================================
     INTERNAL UTILITIES
     ============================================================ */

  /**
   * Resolve player world position.
   * @param {string} playerId
   * @returns {{x:number,y:number}|null}
   * @private
   */
  _getPlayerPos(playerId) {
    if (playerId === 'player' && this.game.state.player) {
      return { x: this.game.state.player.x || 0, y: this.game.state.player.y || 0 };
    }
    // Multiplayer support: lookup by id
    const other = this.game.state.others?.[playerId];
    if (other) return { x: other.x || 0, y: other.y || 0 };
    return null;
  }

  /** Draw a tiny 4-point star for particle effects. */
  _drawMiniStar(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      const inner = (Math.PI / 2) * i + Math.PI / 4 - Math.PI / 2;
      ctx.lineTo(cx + Math.cos(inner) * (r * 0.4), cy + Math.sin(inner) * (r * 0.4));
    }
    ctx.closePath();
    ctx.fill();
  }
}
