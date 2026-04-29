/**
 * @fileoverview BaseMinigame.js — Abstract base class for all Starlight Inn mini-games.
 * Provides the common framework: state machine, scoring, countdown timer,
 * reward distribution, and Canvas lifecycle hooks. All concrete games extend this class.
 */

/**
 * Reward tiers for end-of-game scoring.
 * @type {Object<string, number>}
 */
const REWARD_TIERS = {
  1: 200,
  2: 100,
  3: 50,
  4: 25
};

/**
 * Abstract base class for every mini-game in the Starlight Inn.
 * Manages state transitions (waiting → countdown → playing → ended),
 * scoring, rankings, countdown animation, and reward distribution.
 * Subclasses must override `update(dt)`, `render(ctx)`, and optionally `init()`.
 */
export class BaseMinigame {
  /**
   * Create a new mini-game instance.
   * @param {Object} game     — The main Game singleton (provides W, H, minigameHub, etc.).
   * @param {Object} config   — Per-game configuration overrides.
   */
  constructor(game, config = {}) {
    /** @type {Object} */
    this.game = game;
    /** @type {Object} */
    this.config = config;

    /** @type {string} Current game state. */
    this.state = 'waiting'; // waiting | countdown | playing | ended

    /** @type {Map<string, number>} playerId → score. */
    this.scores = new Map();

    /** @type {number} Elapsed seconds while playing. */
    this.timer = 0;

    /** @type {number} Total game duration in seconds. */
    this.duration = config.duration ?? 60;

    /** @type {number} Countdown value at start (3, 2, 1, GO!). */
    this.countdown = 3;

    /** @type {number|null} Countdown interval handle. */
    this._countdownHandle = null;

    /** @type {number|null} Game tick interval handle. */
    this._tickHandle = null;

    /** @type {number} Accumulated time for countdown display. */
    this._countdownElapsed = 0;

    /** @type {string|null} Current countdown text ("3", "2", "1", "GO!"). */
    this.countdownText = null;

    /** @type {number} Opacity for countdown text fade-in. */
    this.countdownAlpha = 1.0;

    /** @type {boolean} Whether particles are active this frame. */
    this._hasParticles = false;

    /** @type {Array<Object>} Active particle effects. */
    this.particles = [];

    /** @type {number} Timestamp of last update (for dt calculation). */
    this._lastTime = 0;

    /** @type {boolean} True when the game loop is running. */
    this._running = false;

    /** @type {function} Bound animation frame callback. */
    this._boundLoop = this._loop.bind(this);

    /** @type {number} Current animation frame id. */
    this._frameId = 0;

    // Allow subclass init if it defines one.
    if (typeof this.init === 'function') {
      this.init();
    }
  }

  /**
   * Begin the mini-game lifecycle.
   * Kicks off the pre-game countdown, then transitions to `playing`.
   */
  start() {
    if (this.state !== 'waiting') return;
    this.state = 'countdown';
    this.countdown = 3;
    this._countdownElapsed = 0;
    this.countdownText = '3';
    this.countdownAlpha = 1.0;
    this._startCountdown();
  }

  /**
   * Internal: run the 3-2-1-GO countdown sequence.
   * Each number displays for ~0.8 s with a fade.
   */
  _startCountdown() {
    const stepDuration = 0.85; // seconds per number
    let step = 3;

    const tick = () => {
      if (step > 0) {
        this.countdownText = String(step);
        this.countdownAlpha = 1.0;
        step--;
        this._countdownHandle = setTimeout(tick, stepDuration * 1000);
      } else {
        this.countdownText = 'GO!';
        this.countdownAlpha = 1.0;
        this._countdownHandle = setTimeout(() => {
          this.state = 'playing';
          this.countdownText = null;
          this._lastTime = performance.now();
          this._running = true;
          this._frameId = requestAnimationFrame(this._boundLoop);
        }, stepDuration * 1000);
      }
    };

    tick();
  }

  /**
   * Internal: main game loop driven by requestAnimationFrame.
   * @param {number} now — High-resolution timestamp from the browser.
   */
  _loop(now) {
    if (!this._running) return;

    const dt = Math.min((now - this._lastTime) / 1000, 0.05); // cap dt at 50 ms
    this._lastTime = now;

    if (this.state === 'playing') {
      this.timer += dt;

      if (this.timer >= this.duration) {
        this.timer = this.duration;
        this._running = false;
        this.end();
        return;
      }
    }

    this.update(dt);
    this._renderWrapper();

    this._frameId = requestAnimationFrame(this._boundLoop);
  }

  /**
   * Internal: clears the canvas and calls the subclass render,
   * then overlays the countdown text if active.
   */
  _renderWrapper() {
    const ctx = this.game.ctx;
    const W = this.game.W;
    const H = this.game.H;

    // Clear full canvas.
    ctx.clearRect(0, 0, W, H);

    // Delegate to subclass drawing.
    this.render(ctx);

    // Draw countdown overlay.
    if (this.countdownText) {
      this.countdownAlpha = Math.max(0, this.countdownAlpha - 0.04);
      ctx.save();
      ctx.globalAlpha = this.countdownAlpha;
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.floor(Math.min(W, H) * 0.18)}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 20;
      ctx.fillText(this.countdownText, W / 2, H / 2);
      ctx.restore();
    }

    // Draw particles on top of everything.
    this._drawParticles(ctx);
  }

  /**
   * Per-frame update hook. Subclasses **must** override this.
   * @param {number} dt — Delta time in seconds.
   */
  update(dt) {
    throw new Error('BaseMinigame.update(dt) must be overridden by subclass');
  }

  /**
   * Per-frame render hook. Subclasses **must** override this.
   * @param {CanvasRenderingContext2D} ctx — The 2D canvas context.
   */
  render(ctx) {
    throw new Error('BaseMinigame.render(ctx) must be overridden by subclass');
  }

  /**
   * Award points to a specific player.
   * @param {string} playerId — Unique player identifier.
   * @param {number} points   — Points to add (can be negative for penalties).
   */
  addScore(playerId, points) {
    const current = this.scores.get(playerId) || 0;
    this.scores.set(playerId, current + points);
  }

  /**
   * Retrieve the current score for a player.
   * @param {string} playerId
   * @returns {number}
   */
  getScore(playerId) {
    return this.scores.get(playerId) || 0;
  }

  /**
   * Compute ranked results sorted descending by score.
   * @returns {Array<{playerId: string, score: number, rank: number}>}
   */
  getRankings() {
    return Array.from(this.scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map((entry, i) => ({ playerId: entry[0], score: entry[1], rank: i + 1 }));
  }

  /**
   * Gracefully end the game, stop the loop, compute rankings, and hand
   * control back to the MinigameHub for the results screen.
   */
  end() {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this._running = false;

    if (this._countdownHandle) {
      clearTimeout(this._countdownHandle);
      this._countdownHandle = null;
    }
    if (this._frameId) {
      cancelAnimationFrame(this._frameId);
      this._frameId = 0;
    }

    const rankings = this.getRankings();
    this.awardRewards(rankings);

    if (this.game.minigameHub) {
      this.game.minigameHub.endGame(rankings);
    }
  }

  /**
   * Distribute Silver and badge opportunities based on final rank.
   * 1st: 200 Silver + badge chance
   * 2nd: 100 Silver
   * 3rd: 50 Silver
   * 4th: 25 Silver
   * @param {Array<Object>} rankings — Output from getRankings().
   */
  awardRewards(rankings) {
    for (const entry of rankings) {
      const silver = REWARD_TIERS[entry.rank] ?? 10;

      // Award Silver via game economy if available.
      if (this.game.economy && typeof this.game.economy.addSilver === 'function') {
        this.game.economy.addSilver(entry.playerId, silver);
      }

      // 1st place gets a badge draw chance.
      if (entry.rank === 1 && this.game.badges && typeof this.game.badges.rollBadge === 'function') {
        this.game.badges.rollBadge(entry.playerId, 'minigame_winner');
      }
    }
  }

  /**
   * Spawn a burst of decorative particles at (x, y).
   * @param {number} x     — Origin X coordinate.
   * @param {number} y     — Origin Y coordinate.
   * @param {string} color — CSS color string for particle tint.
   * @param {number} [count=12] — Number of particles to spawn.
   */
  spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 80 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + Math.random() * 0.5,
        maxLife: 1.1,
        size: 2 + Math.random() * 4,
        color,
        alpha: 1.0
      });
    }
    this._hasParticles = true;
  }

  /**
   * Update and draw all active particles. Called automatically by _renderWrapper.
   * @param {CanvasRenderingContext2D} ctx
   */
  _drawParticles(ctx) {
    if (!this._hasParticles || this.particles.length === 0) return;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= 1 / 60; // approximate per-frame decay
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * (1 / 60);
      p.y += p.vy * (1 / 60);
      p.vy += 120 * (1 / 60); // light gravity
      p.alpha = p.life / p.maxLife;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (this.particles.length === 0) {
      this._hasParticles = false;
    }
  }

  /**
   * Utility: draw a rounded rectangle path.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} r — Corner radius.
   */
  drawRoundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Utility: linear interpolation between a and b.
   * @param {number} a
   * @param {number} b
   * @param {number} t — 0..1
   * @returns {number}
   */
  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Utility: clamp value between min and max.
   * @param {number} val
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /**
   * Clean up timers, particles, and animation state.
   * Call this before discarding a game instance.
   */
  dispose() {
    this._running = false;
    if (this._countdownHandle) clearTimeout(this._countdownHandle);
    if (this._frameId) cancelAnimationFrame(this._frameId);
    this.particles = [];
    this.scores.clear();
    this.state = 'waiting';
  }
}
