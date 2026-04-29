/**
 * @fileoverview FartMechanic.js — The signature fart emote system for Starlight Inn v3.5.
 * Provides a comical (never gross) fart interaction with full game-feel treatment:
 * squash-and-stretch anticipation, cartoon green cloud particles, procedurally
 * synthesized toot sounds, screen shake, nearby player pushback, embarrassed
 * avatar expression, and floating "PFFFFT!" text.
 *
 * All visuals are cartoon-whimsical: green-yellow cloud puffs, NOT realistic.
 *
 * @module FartMechanic
 * @version 3.5.0
 * @author Starlight Inn Team
 */

/** @typedef {import('./engine/Game.js').Game} Game */

/**
 * @typedef {Object} FartCloudParticle
 * @property {number} x — Normalized world X (0..1).
 * @property {number} y — Normalized world Y (0..1).
 * @property {number} vx — Normalized horizontal velocity per ms.
 * @property {number} vy — Normalized vertical velocity per ms.
 * @property {number} life — Remaining life in seconds.
 * @property {number} maxLife — Total life in seconds.
 * @property {string} color — CSS color string.
 * @property {number} size — Base radius in pixels.
 * @property {boolean} grow — Whether the particle expands over its life.
 * @property {number} alpha — Current opacity (0..1).
 */

/**
 * @typedef {Object} ActiveFartCloud
 * @property {number} x — Center world X (normalized).
 * @property {number} y — Center world Y (normalized).
 * @property {number} born — Creation timestamp (ms).
 * @property {number} life — Total lifetime in ms.
 * @property {number} radius — Current cloud radius in pixels.
 * @property {number} maxRadius — Maximum expansion radius.
 */

/**
 * @typedef {Object} FartAnimState
 * @property {string} playerId — Player being animated.
 * @property {number} startTime — Animation start timestamp.
 * @property {string} phase — 'squash' | 'tremble' | 'release' | 'recover' | 'embarrassed'.
 * @property {number} embarrassedUntil — Timestamp when embarrassed expression ends.
 */

/**
 * Manages the comical fart emote mechanic with particles, sound synthesis,
 * avatar animation, screen shake, and social pushback.
 * @export
 */
export class FartMechanic {
  /**
   * Cooldown duration between farts per player, in milliseconds.
   * @type {number}
   * @constant
   */
  static COOLDOWN_MS = 5000;

  /**
   * Radius within which nearby players get pushed (normalized coords).
   * @type {number}
   * @constant
   */
  static PUSH_RADIUS = 0.15;

  /**
   * Push force magnitude (normalized coords).
   * @type {number}
   * @constant
   */
  static PUSH_FORCE = 0.05;

  /**
   * Number of particles spawned per fart.
   * @type {number}
   * @constant
   */
  static PARTICLE_COUNT = 25;

  /**
   * Creates a FartMechanic instance.
   * @param {Game} game — The main Game instance.
   */
  constructor(game) {
    /** @type {Game} */
    this.game = game;

    /** @type {Map<string, number>} — playerId → timestamp of last fart. */
    this.cooldowns = new Map();

    /** @type {FartCloudParticle[]} — Active cloud particles. */
    this.particles = [];

    /** @type {ActiveFartCloud[]} — Lingering cloud volumes that slowly expand and fade. */
    this.clouds = [];

    /** @type {FartAnimState[]} — Currently playing fart animations keyed by player. */
    this.animStates = [];

    /** @type {AudioContext|null} — Lazy-initialized Web Audio context for synthesis. */
    this._audioCtx = null;

    /** @type {string[]} — Cartoon-green color palette for the cloud. */
    this.colors = ['#8BC34A', '#689F38', '#AED581', '#558B2F', '#DCEDC8', '#9CCC65'];

    this._tick = this._tick.bind(this);
    this._ticking = false;
  }

  /* ================================================================ */
  /*  PUBLIC API                                                      */
  /* ================================================================ */

  /**
   * Triggers the full fart sequence: animation, particles, sound, shake,
   * pushback, floating text, and chat message.
   *
   * Respects a per-player cooldown to prevent spam.
   *
   * @param {string} playerId — ID of the player performing the fart.
   * @returns {boolean} True if the fart was triggered; false if on cooldown.
   */
  trigger(playerId) {
    const player = this._resolvePlayer(playerId);
    if (!player) return false;

    // ── Cooldown check ────────────────────────────────────────────
    const last = this.cooldowns.get(playerId) || 0;
    const now = Date.now();
    const elapsed = now - last;
    if (elapsed < FartMechanic.COOLDOWN_MS) {
      const remaining = Math.ceil((FartMechanic.COOLDOWN_MS - elapsed) / 1000);
      this.game.ui.toast(`Fart on cooldown (${remaining}s)`, 'warning');
      return false;
    }
    this.cooldowns.set(playerId, now);

    // ── Execute the full sequence ─────────────────────────────────
    this._playAnimation(playerId);
    this._spawnCloud(player);
    this._playSound();
    this.game.camera.shake(3, 0.88);
    this._pushNearbyPlayers(player);
    this._spawnFloatingText(player);
    this._startCloudLifecycle(player);

    // Social chat log
    const name = player.name || 'Someone';
    this.game.chat.system(`${name} let one rip! 💨`);

    return true;
  }

  /**
   * Renders all active fart particles and lingering clouds onto the canvas.
   * Call every frame after the world is rendered.
   *
   * @param {CanvasRenderingContext2D} ctx — Canvas 2D context.
   * @param {number} W — Canvas width in pixels.
   * @param {number} H — Canvas height in pixels.
   * @returns {void}
   */
  render(ctx, W, H) {
    const now = Date.now();

    // ── Render individual cloud particles ─────────────────────────
    for (const p of this.particles) {
      const lifeRatio = 1 - (p.life / p.maxLife);
      const px = p.x * W;
      const py = p.y * H;

      // Expanding size
      const currentSize = p.grow
        ? p.size * (1 + lifeRatio * 2.5)
        : p.size;

      ctx.save();
      ctx.globalAlpha = p.alpha * (1 - lifeRatio);

      // Draw soft cloud puff (radial gradient for cartoon softness)
      const grad = ctx.createRadialGradient(
        px, py, 0,
        px, py, currentSize
      );
      grad.addColorStop(0, p.color);
      grad.addColorStop(0.6, p.color + '88'); // 53% opacity
      grad.addColorStop(1, p.color + '00');   // transparent

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, currentSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Render lingering cloud volumes ────────────────────────────
    for (const cloud of this.clouds) {
      const age = now - cloud.born;
      const lifeRatio = age / cloud.life;
      if (lifeRatio >= 1) continue;

      const cx = cloud.x * W;
      const cy = cloud.y * H;
      const currentRadius = cloud.radius + (cloud.maxRadius - cloud.radius) * lifeRatio;

      ctx.save();
      ctx.globalAlpha = 0.25 * (1 - lifeRatio);

      // Soft green-brown cartoon cloud base
      const grad = ctx.createRadialGradient(
        cx, cy - 10, 0,
        cx, cy - 10, currentRadius
      );
      grad.addColorStop(0, 'rgba(139, 195, 74, 0.6)');
      grad.addColorStop(0.4, 'rgba(104, 159, 56, 0.3)');
      grad.addColorStop(0.7, 'rgba(139, 195, 74, 0.1)');
      grad.addColorStop(1, 'rgba(139, 195, 74, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy - 10, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      // Subtle brown center tint (comic style)
      ctx.globalAlpha = 0.1 * (1 - lifeRatio);
      const brownGrad = ctx.createRadialGradient(
        cx, cy, 0,
        cx, cy, currentRadius * 0.4
      );
      brownGrad.addColorStop(0, 'rgba(121, 85, 72, 0.5)');
      brownGrad.addColorStop(1, 'rgba(121, 85, 72, 0)');
      ctx.fillStyle = brownGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Updates all active fart particles and clouds. Call once per frame.
   *
   * @param {number} dt — Delta time in seconds.
   * @returns {void}
   */
  update(dt) {
    // Update individual particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 0.0001 * dt; // Slight buoyancy (gas rises)
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Expire old clouds
    const now = Date.now();
    this.clouds = this.clouds.filter(c => (now - c.born) < c.life);
  }

  /**
   * Checks whether a given player is currently in the embarrassed expression state.
   *
   * @param {string} playerId — Player to query.
   * @returns {boolean} True if the player looks embarrassed.
   */
  isEmbarrassed(playerId) {
    const state = this.animStates.find(a => a.playerId === playerId);
    if (!state) return false;
    return state.embarrassedUntil > Date.now();
  }

  /**
   * Returns the current avatar squash/stretch scale factors for a player's fart animation.
   *
   * @param {string} playerId — Player to query.
   * @returns {{scaleX:number, scaleY:number, offsetY:number}} Animation deform values.
   */
  getAnimScale(playerId) {
    const state = this.animStates.find(a => a.playerId === playerId);
    if (!state) return { scaleX: 1, scaleY: 1, offsetY: 0 };

    const elapsed = Date.now() - state.startTime;

    switch (state.phase) {
      case 'squash': {
        // Crouch down: squashed vertically, widened horizontally
        const t = Math.min(1, elapsed / 200);
        const ease = this._easeOutQuad(t);
        return { scaleX: 1 + 0.3 * ease, scaleY: 1 - 0.4 * ease, offsetY: 5 * ease };
      }
      case 'tremble': {
        // Rapid tiny wobble
        const tremble = Math.sin(elapsed * 0.08) * 0.03;
        return { scaleX: 1.3 + tremble, scaleY: 0.6 - tremble, offsetY: 5 };
      }
      case 'release': {
        // Spring back up: overshoot then settle
        const t = Math.min(1, elapsed / 250);
        const ease = this._easeOutElastic(t);
        return { scaleX: 1.3 - 0.3 * ease, scaleY: 0.6 + 0.6 * ease, offsetY: 5 * (1 - t) };
      }
      case 'recover': {
        // Settle to normal
        const t = Math.min(1, elapsed / 200);
        const ease = this._easeInOutQuad(t);
        return { scaleX: 1, scaleY: 1.2 - 0.2 * ease, offsetY: 0 };
      }
      case 'embarrassed':
      default:
        return { scaleX: 1, scaleY: 1, offsetY: 0 };
    }
  }

  /**
   * Cleans up all active particles, clouds, and animation states.
   * Call on scene transition or game shutdown.
   *
   * @returns {void}
   */
  clear() {
    this.particles = [];
    this.clouds = [];
    this.animStates = [];
    this.cooldowns.clear();
    if (this._audioCtx) {
      this._audioCtx.close();
      this._audioCtx = null;
    }
  }

  /* ================================================================ */
  /*  ANIMATION                                                       */
  /* ================================================================ */

  /**
   * Plays the squash-and-stretch avatar animation: crouch, tremble, spring back,
   * then embarrassed expression.
   *
   * @param {string} playerId — Player to animate.
   * @private
   */
  _playAnimation(playerId) {
    const now = Date.now();

    // Remove any existing anim state for this player
    this.animStates = this.animStates.filter(a => a.playerId !== playerId);

    const animState = {
      playerId,
      startTime: now,
      phase: 'squash',
      embarrassedUntil: now + 3500
    };
    this.animStates.push(animState);

    // Phase sequence using timeouts
    setTimeout(() => { animState.phase = 'tremble'; animState.startTime = Date.now(); }, 200);
    setTimeout(() => { animState.phase = 'release'; animState.startTime = Date.now(); }, 500);
    setTimeout(() => { animState.phase = 'recover'; animState.startTime = Date.now(); }, 750);
    setTimeout(() => { animState.phase = 'embarrassed'; }, 950);

    // Clear embarrassed after it expires
    setTimeout(() => {
      this.animStates = this.animStates.filter(a => a.playerId !== playerId);
    }, 3500);
  }

  /* ================================================================ */
  /*  PARTICLE CLOUD                                                  */
  /* ================================================================ */

  /**
   * Spawns the explosive cloud of cartoon-green particles at the player's position.
   * Particles expand in a cone shape behind the player (opposite facing direction).
   *
   * @param {Object} player — Player object with x, y, and facing properties.
   * @private
   */
  _spawnCloud(player) {
    const facing = player.facing || 1; // 1 = right, -1 = left
    const colors = this.colors;

    for (let i = 0; i < FartMechanic.PARTICLE_COUNT; i++) {
      const angle = (Math.random() * Math.PI * 0.6) - (Math.PI * 0.3); // Cone spread
      const speed = 0.05 + Math.random() * 0.15;
      const direction = -facing; // Emit behind the player

      /** @type {FartCloudParticle} */
      const p = {
        x: player.x || 0.5,
        y: (player.y || 0.5) - 0.02,
        vx: (Math.cos(angle) * speed + direction * 0.08) * 0.001,
        vy: (-0.02 - Math.random() * 0.06) * 0.001,
        life: 2.0 + Math.random() * 2.0,
        maxLife: 4.0,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 8 + Math.random() * 16,
        grow: true,
        alpha: 0.7 + Math.random() * 0.3
      };
      this.particles.push(p);
    }
  }

  /**
   * Creates a lingering cloud volume that slowly expands and fades over 3 seconds.
   *
   * @param {Object} player — Player object with x, y.
   * @private
   */
  _startCloudLifecycle(player) {
    /** @type {ActiveFartCloud} */
    const cloud = {
      x: player.x || 0.5,
      y: (player.y || 0.5) - 0.01,
      born: Date.now(),
      life: 3000,
      radius: 15,
      maxRadius: 60 + Math.random() * 20
    };
    this.clouds.push(cloud);
  }

  /* ================================================================ */
  /*  SOUND SYNTHESIS                                                 */
  /* ================================================================ */

  /**
   * Plays a procedurally synthesized comical fart sound using the Web Audio API.
   * Each trigger produces a slightly different pitch and duration for variety.
   *
   * The synthesis combines:
   * - A noise buffer for the "texture"
   * - An oscillator with descending frequency for the "tone"
   * - A bandpass filter for body and character
   *
   * @private
   */
  _playSound() {
    try {
      const ctx = this._getAudioContext();
      const duration = 0.3 + Math.random() * 0.5; // 0.3–0.8s
      const now = ctx.currentTime;

      // ── Noise buffer for texture ────────────────────────────────
      const sampleRate = ctx.sampleRate;
      const bufferSize = Math.floor(sampleRate * duration);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
      const data = noiseBuffer.getChannelData(0);

      // Brown-ish noise (deeper than white noise)
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // gain boost
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      // ── Bandpass filter for body ─────────────────────────────────
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(400 + Math.random() * 200, now);
      bandpass.frequency.exponentialRampToValueAtTime(100, now + duration);
      bandpass.Q.setValueAtTime(2 + Math.random() * 3, now);

      // ── Low-frequency oscillator for the "tone" ─────────────────
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(250 + Math.random() * 100, now);
      osc.frequency.exponentialRampToValueAtTime(60 + Math.random() * 40, now + duration);

      // ── Gain envelope ────────────────────────────────────────────
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.4 + Math.random() * 0.3, now + 0.05);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(0.3, now + 0.03);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      // ── Connect graph ────────────────────────────────────────────
      noise.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      // ── Start / stop ─────────────────────────────────────────────
      noise.start(now);
      noise.stop(now + duration);
      osc.start(now);
      osc.stop(now + duration);

    } catch (e) {
      // Audio context may be blocked or unavailable — silently fail
    }
  }

  /* ================================================================ */
  /*  PLAYER PUSHBACK                                                 */
  /* ================================================================ */

  /**
   * Slightly pushes nearby players away from the center of the fart.
   * Creates a gentle social ripple — comical, not aggressive.
   *
   * @param {Object} centerPlayer — The player who farted.
   * @private
   */
  _pushNearbyPlayers(centerPlayer) {
    const onlinePlayers = this.game.state.onlinePlayers;
    if (!onlinePlayers || !Array.isArray(onlinePlayers)) return;

    const cx = centerPlayer.x || 0.5;
    const cy = centerPlayer.y || 0.5;
    const radius = FartMechanic.PUSH_RADIUS;

    for (const p of onlinePlayers) {
      if (p.id === centerPlayer.id) continue;

      const dx = (p.x || 0.5) - cx;
      const dy = (p.y || 0.5) - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius && dist > 0.001) {
        // Push away with falloff
        const force = FartMechanic.PUSH_FORCE * (1 - dist / radius);
        p.x += (dx / dist) * force;
        p.y += (dy / dist) * force;

        // Tiny micro-bounce animation on affected players
        if (p.animState !== 'fart_pushed') {
          p._prevAnimState = p.animState;
          p.animState = 'fart_pushed';
          setTimeout(() => {
            p.animState = p._prevAnimState || 'idle';
            delete p._prevAnimState;
          }, 300);
        }
      }
    }
  }

  /* ================================================================ */
  /*  FLOATING TEXT                                                   */
  /* ================================================================ */

  /**
   * Spawns the classic "PFFFFT!" floating text above the player.
   *
   * @param {Object} player — Player object with x, y, name.
   * @private
   */
  _spawnFloatingText(player) {
    // Delegate to the game's floating text system or use the screen effects module
    const x = player.x || 0.5;
    const y = (player.y || 0.5) - 0.04;

    if (this.game.screenEffects) {
      this.game.screenEffects.floatingText('PFFFFT!', x, y, '#8BC34A', 2000);
    } else if (this.game.ui.floatingText) {
      this.game.ui.floatingText('PFFFFT!', x, y, '#8BC34A', 2000);
    }
  }

  /* ================================================================ */
  /*  INTERNAL HELPERS                                                */
  /* ================================================================ */

  /**
   * Resolves a player object from an ID string.
   *
   * @param {string} playerId — ID to resolve.
   * @returns {Object|null} The player object, or null if not found.
   * @private
   */
  _resolvePlayer(playerId) {
    if (this.game.state.player && this.game.state.player.id === playerId) {
      return this.game.state.player;
    }
    if (this.game.state.onlinePlayers) {
      return this.game.state.onlinePlayers.find(p => p.id === playerId) || null;
    }
    return null;
  }

  /**
   * Lazily creates and returns the shared AudioContext.
   *
   * @returns {AudioContext}
   * @private
   */
  _getAudioContext() {
    if (!this._audioCtx) {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._audioCtx.state === 'suspended') {
      this._audioCtx.resume();
    }
    return this._audioCtx;
  }

  /**
   * Easing: quadratic ease-out.
   *
   * @param {number} t — 0..1
   * @returns {number}
   * @private
   */
  _easeOutQuad(t) {
    return t * (2 - t);
  }

  /**
   * Easing: quadratic ease-in-out.
   *
   * @param {number} t — 0..1
   * @returns {number}
   * @private
   */
  _easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * Easing: elastic ease-out for spring-back feel.
   *
   * @param {number} t — 0..1
   * @returns {number}
   * @private
   */
  _easeOutElastic(t) {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const p = 0.3;
    const s = p / 4;
    return Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + 1;
  }

  /**
   * Animation frame loop for continuous updates (if needed by external systems).
   *
   * @private
   */
  _tick() {
    if (!this._ticking) return;
    requestAnimationFrame(this._tick);
  }
}
