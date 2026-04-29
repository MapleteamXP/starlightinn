/**
 * @fileoverview RhythmDance.js — Game 3: Arrow-key rhythm dance.
 * Arrows fall from the top toward four target zones at the bottom.
 * Hit the matching arrow key when the symbol crosses the target line.
 * Ratings: PERFECT (100 pts), GREAT (50 pts), OKAY (25 pts).
 * Streaks build a score multiplier.
 */

import { BaseMinigame } from './BaseMinigame.js';

/**
 * @typedef {Object} ArrowNote
 * @property {string} direction — 'left' | 'up' | 'down' | 'right'.
 * @property {number} y         — Current Y position in canvas space.
 * @property {number} speed       — Pixels per second.
 * @property {boolean} hit        — Already processed.
 * @property {number} spawnTime   — Timestamp when spawned.
 */

/**
 * @typedef {Object} RatingPopup
 * @property {string} text    — "PERFECT", "GREAT", "OKAY", "MISS".
 * @property {number} x       — Screen X.
 * @property {number} y       — Screen Y.
 * @property {number} life    — Seconds remaining.
 * @property {number} maxLife
 * @property {string} color
 * @property {number} alpha
 */

export class RhythmDance extends BaseMinigame {
  /**
   * @param {Object} game   — Main Game singleton.
   * @param {Object} config — Overrides (bpm, duration, etc.).
   */
  constructor(game, config = {}) {
    super(game, { duration: 60, ...config });

    /** @type {Array<ArrowNote>} Active falling arrows. */
    this.arrows = [];

    /** @type {number} Beats per minute. */
    this.bpm = config.bpm ?? 120;

    /** @type {number} Seconds between beats. */
    this.beatInterval = 60 / this.bpm;

    /** @type {number} Countdown until next arrow spawn. */
    this.nextBeat = 0;

    /** @type {number} Consecutive successful hits. */
    this.streak = 0;

    /** @type {number} Longest streak achieved. */
    this.maxStreak = 0;

    /** @type {number} Count of PERFECT hits. */
    this.perfects = 0;

    /** @type {number} Count of GREAT hits. */
    this.greats = 0;

    /** @type {number} Count of OKAY hits. */
    this.okays = 0;

    /** @type {number} Count of misses. */
    this.misses = 0;

    /** @type {Array<RatingPopup>} Floating rating labels. */
    this.ratings = [];

    /** @type {Object<string, boolean>} Target zone flash state. */
    this.targetFlashes = { left: 0, up: 0, down: 0, right: 0 };

    /** @type {Array<string>} Direction order left-to-right. */
    this.directions = ['left', 'up', 'down', 'right'];

    /** @type {Object<string, string>} Emoji for each direction. */
    this.dirEmojis = {
      left: '\u2B05\uFE0F',
      up: '\u2B06\uFE0F',
      down: '\u2B07\uFE0F',
      right: '\u27A1\uFE0F'
    };

    /** @type {Object<string, string>} Colors per lane. */
    this.laneColors = {
      left: '#ff6b6b',
      up: '#ffd93d',
      down: '#6bcb77',
      right: '#4d96ff'
    };

    /** @type {number} Time accumulator for beat spawning. */
    this._beatAccum = 0;
  }

  /**
   * Per-frame update: spawn arrows on beat, move them, check misses.
   * @param {number} dt
   */
  update(dt) {
    if (this.state !== 'playing') return;

    // Spawn arrows on beat with slight variation.
    this._beatAccum += dt;
    const interval = this.beatInterval * (0.75 + Math.random() * 0.5);
    while (this._beatAccum >= interval) {
      this._beatAccum -= interval;
      this._spawnArrow();
    }

    const targetY = this._targetY();
    const missThreshold = targetY + 60;

    // Move arrows.
    for (const a of this.arrows) {
      a.y += a.speed * dt;
    }

    // Misses: arrows that passed the target zone uncaught.
    const before = this.arrows.length;
    this.arrows = this.arrows.filter(a => {
      if (a.y > missThreshold && !a.hit) {
        this.misses++;
        this.streak = 0;
        this._showRating('MISS', a.x, targetY - 20, '#ff4444');
        return false;
      }
      return true;
    });

    // Update rating popups.
    for (let i = this.ratings.length - 1; i >= 0; i--) {
      const r = this.ratings[i];
      r.life -= dt;
      r.y -= 30 * dt;
      r.alpha = Math.max(0, r.life / r.maxLife);
      if (r.life <= 0) this.ratings.splice(i, 1);
    }

    // Decay target flashes.
    for (const dir of this.directions) {
      if (this.targetFlashes[dir] > 0) {
        this.targetFlashes[dir] = Math.max(0, this.targetFlashes[dir] - dt);
      }
    }
  }

  /** Spawn a new arrow in a random lane. */
  _spawnArrow() {
    const dir = this.directions[Math.floor(Math.random() * this.directions.length)];
    const laneX = this._laneX(dir);
    this.arrows.push({
      direction: dir,
      x: laneX,
      y: -40,
      speed: 280 + Math.random() * 80,
      hit: false,
      spawnTime: performance.now()
    });
  }

  /**
   * Handle a directional key press from the player.
   * @param {string} direction — 'left' | 'up' | 'down' | 'right'.
   */
  onKey(direction) {
    if (this.state !== 'playing') return;

    const targetY = this._targetY();
    const tolerance = 45;

    // Find the closest un-hit arrow of this direction within tolerance.
    let best = null;
    let bestDist = Infinity;

    for (const a of this.arrows) {
      if (a.direction !== direction || a.hit) continue;
      const dist = Math.abs(a.y - targetY);
      if (dist < tolerance && dist < bestDist) {
        best = a;
        bestDist = dist;
      }
    }

    if (!best) {
      // Pressed with no arrow nearby = minor penalty (optional).
      return;
    }

    best.hit = true;
    let points = 0;
    let rating = '';
    let color = '';

    if (bestDist < 12) {
      points = 100; rating = 'PERFECT'; color = '#ffd700';
      this.perfects++;
    } else if (bestDist < 25) {
      points = 50; rating = 'GREAT'; color = '#90ee90';
      this.greats++;
    } else {
      points = 25; rating = 'OKAY'; color = '#a0d8ef';
      this.okays++;
    }

    this.streak++;
    if (this.streak > this.maxStreak) this.maxStreak = this.streak;

    const multiplier = 1 + Math.floor(this.streak / 10) * 0.5;
    const finalPoints = Math.floor(points * multiplier);
    this.addScore('player', finalPoints);

    this._showRating(`${rating} +${finalPoints}`, best.x, targetY - 30, color);
    this.spawnParticles(best.x, targetY, color, 10);

    // Flash target zone.
    this.targetFlashes[direction] = 0.25;

    // Remove hit arrow after a short delay so it visually reaches target.
    setTimeout(() => {
      const idx = this.arrows.indexOf(best);
      if (idx > -1) this.arrows.splice(idx, 1);
    }, 120);
  }

  /**
   * Create a floating rating label.
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {string} color
   */
  _showRating(text, x, y, color) {
    this.ratings.push({
      text, x, y,
      life: 1.0,
      maxLife: 1.0,
      color,
      alpha: 1.0
    });
  }

  /**
   * Main render: lanes, target zones, falling arrows, HUD.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    const W = this.game.W;
    const H = this.game.H;

    // --- Background ---
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0f0c1a');
    grad.addColorStop(1, '#1e1833');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const lanePositions = this._lanePositions();
    const targetY = this._targetY();

    // --- Lane dividers ---
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 2;
    for (const lx of lanePositions) {
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, H);
      ctx.stroke();
    }

    // --- Target zones at bottom ---
    for (const dir of this.directions) {
      const cx = this._laneX(dir);
      const flash = this.targetFlashes[dir];
      const r = 30;
      const color = this.laneColors[dir];

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, targetY, r, 0, Math.PI * 2);

      // Outer ring.
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 + flash * 8;
      ctx.globalAlpha = 0.6 + flash * 0.4;
      ctx.stroke();

      // Inner fill when flashing.
      if (flash > 0) {
        ctx.fillStyle = color;
        ctx.globalAlpha = flash * 0.3;
        ctx.fill();
      }

      // Direction emoji in center.
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.floor(r * 0.9)}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.dirEmojis[dir], cx, targetY);
      ctx.restore();
    }

    // --- Falling arrows ---
    for (const a of this.arrows) {
      if (a.hit) continue; // hide immediately on hit (particles take over)
      const color = this.laneColors[a.direction];
      const size = 28;

      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;

      // Draw arrow shape based on direction.
      ctx.beginPath();
      if (a.direction === 'left') {
        ctx.moveTo(size / 2, -size / 2);
        ctx.lineTo(-size / 2, 0);
        ctx.lineTo(size / 2, size / 2);
      } else if (a.direction === 'right') {
        ctx.moveTo(-size / 2, -size / 2);
        ctx.lineTo(size / 2, 0);
        ctx.lineTo(-size / 2, size / 2);
      } else if (a.direction === 'up') {
        ctx.moveTo(-size / 2, size / 2);
        ctx.lineTo(0, -size / 2);
        ctx.lineTo(size / 2, size / 2);
      } else {
        // down
        ctx.moveTo(-size / 2, -size / 2);
        ctx.lineTo(0, size / 2);
        ctx.lineTo(size / 2, -size / 2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // --- Rating popups ---
    for (const r of this.ratings) {
      ctx.save();
      ctx.globalAlpha = r.alpha;
      ctx.fillStyle = r.color;
      ctx.font = `bold ${Math.floor(Math.min(W, H) * 0.042)}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 10;
      ctx.fillText(r.text, r.x, r.y);
      ctx.restore();
    }

    // --- HUD ---
    this._drawHUD(ctx, W, H);
  }

  /**
   * Draw score, streak, accuracy stats, and timer.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W
   * @param {number} H
   */
  _drawHUD(ctx, W, H) {
    const fontSize = Math.floor(Math.min(W, H) * 0.032);

    // Top-left: score.
    const score = this.getScore('player');
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    this.drawRoundRect(ctx, 12, 12, 150, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Score: ${score}`, 22, 32);

    // Top-center: streak.
    if (this.streak > 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      this.drawRoundRect(ctx, W / 2 - 55, 12, 110, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.fillText(`Streak ${this.streak}`, W / 2, 32);
    }

    // Top-right: accuracy mini-stats.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    this.drawRoundRect(ctx, W - 170, 12, 158, 40, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `${Math.floor(fontSize * 0.75)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(
      `P:${this.perfects} G:${this.greats} O:${this.okays} M:${this.misses}`,
      W - 18, 32
    );

    // Bottom: timer bar.
    const barW = Math.min(320, W * 0.55);
    const barH = 8;
    const barX = (W - barW) / 2;
    const barY = H - 18;
    const progress = this.timer / this.duration;

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    this.drawRoundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();

    ctx.fillStyle = progress > 0.8 ? '#ff6b6b' : '#4d96ff';
    this.drawRoundRect(ctx, barX, barY, barW * (1 - progress), barH, barH / 2);
    ctx.fill();
  }

  // --- Layout helpers ---

  /** X coordinate for the center of a given lane. */
  _laneX(direction) {
    const positions = this._lanePositions();
    const idx = this.directions.indexOf(direction);
    return positions[idx];
  }

  /** Array of 4 lane center X coordinates, evenly distributed. */
  _lanePositions() {
    const W = this.game.W;
    const margin = W * 0.08;
    const usable = W - margin * 2;
    const step = usable / 3;
    return [0, 1, 2, 3].map(i => margin + i * step);
  }

  /** Y coordinate of the target hit zone (near bottom). */
  _targetY() {
    return this.game.H * 0.82;
  }
}
