/**
 * @fileoverview StarCatcher.js — Game 1: Click falling stars.
 * Stars drift down a night-sky canvas. Click them to catch; build combos for
 * multipliers. 10% of stars are golden bonus stars worth 5× points.
 */

import { BaseMinigame } from './BaseMinigame.js';

/**
 * @typedef {Object} Star
 * @property {number} x
 * @property {number} y
 * @property {number} speed — Pixels per second downward.
 * @property {number} size — Radius in pixels.
 * @property {string} color — '#fff' or '#ffd700' for bonus.
 * @property {number} rotation — Current angle in radians.
 * @property {number} rotationSpeed — Radians per second.
 * @property {boolean} caught
 * @property {boolean} missed — Marked when it leaves the screen uncaught.
 */

export class StarCatcher extends BaseMinigame {
  /**
   * @param {Object} game   — Main Game singleton.
   * @param {Object} config — Overrides (duration, spawnRate, etc.).
   */
  constructor(game, config = {}) {
    super(game, { duration: 60, ...config });

    /** @type {Array<Star>} All active falling stars. */
    this.stars = [];

    /** @type {number} Stars per second spawn rate (ramps over time). */
    this.spawnRate = config.spawnRate ?? 1.0;

    /** @type {number} Current click combo. */
    this.combo = 0;

    /** @type {number} Highest combo achieved this round. */
    this.maxCombo = 0;

    /** @type {number} Stars that fell off-screen uncaught. */
    this.missed = 0;

    /** @type {number} Total successful catches. */
    this.caught = 0;

    /** @type {number} Total golden stars caught. */
    this.goldenCaught = 0;

    /** @type {number} Time accumulator for spawning. */
    this._spawnAccum = 0;

    /** @type {Array<Object>} Floating score pop-ups. */
    this.floaters = [];

    /** @type {number} Background star twinkle offset. */
    this._twinkleOffset = 0;

    /** @type {Array<Object>} Static background decoration stars. */
    this.bgStars = [];
    this._initBgStars();
  }

  /** Seed the static background starfield. */
  _initBgStars() {
    for (let i = 0; i < 80; i++) {
      this.bgStars.push({
        x: Math.random() * this.game.W,
        y: Math.random() * this.game.H,
        size: 0.5 + Math.random() * 1.5,
        twinkleSpeed: 0.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  /**
   * Per-frame update: spawn, move, and cull stars. Ramps difficulty.
   * @param {number} dt — Delta time in seconds.
   */
  update(dt) {
    if (this.state !== 'playing') return;

    // --- Spawn stars ---
    this._spawnAccum += dt;
    const currentRate = this._effectiveSpawnRate();
    const interval = 1 / currentRate;

    while (this._spawnAccum >= interval) {
      this._spawnAccum -= interval;
      this._spawnStar();
    }

    // --- Update stars ---
    for (const star of this.stars) {
      star.y += star.speed * dt;
      star.rotation += star.rotationSpeed * dt;
    }

    // --- Cull off-screen (missed) ---
    const prevLen = this.stars.length;
    this.stars = this.stars.filter(star => {
      if (star.y > this.game.H + 30 && !star.caught) {
        this.missed++;
        this.combo = 0; // combo broken
        return false;
      }
      return true;
    });

    // --- Update floating text ---
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.y -= 40 * dt;   // drift upward
      f.life -= dt;
      f.alpha = Math.max(0, f.life / f.maxLife);
      if (f.life <= 0) this.floaters.splice(i, 1);
    }

    // --- Twinkle background ---
    this._twinkleOffset += dt;
  }

  /**
   * Compute the current spawn rate, increasing as the round progresses.
   * Starts at ~1.0 stars/sec and climbs to ~3.0 by the end.
   * @returns {number}
   */
  _effectiveSpawnRate() {
    const progress = this.timer / this.duration; // 0..1
    return this.spawnRate + progress * 2.0;
  }

  /** Instantiate a new falling star at a random x position above the canvas. */
  _spawnStar() {
    const isGold = Math.random() < 0.10; // 10% golden bonus
    this.stars.push({
      x: 20 + Math.random() * (this.game.W - 40),
      y: -25,
      speed: 90 + Math.random() * 180,
      size: 14 + Math.random() * 18,
      color: isGold ? '#ffd700' : '#ffffff',
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 6,
      caught: false,
      missed: false
    });
  }

  /**
   * Handle a click or touch on the canvas.
   * @param {number} x — Canvas-space X.
   * @param {number} y — Canvas-space Y.
   */
  onClick(x, y) {
    if (this.state !== 'playing') return;

    // Check in reverse order (top-most first).
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const star = this.stars[i];
      if (star.caught) continue;

      const dist = Math.hypot(x - star.x, y - star.y);
      const hitRadius = star.size + 14; // generous hit box

      if (dist < hitRadius) {
        star.caught = true;
        this.caught++;
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        if (star.color === '#ffd700') this.goldenCaught++;

        const basePoints = star.color === '#ffd700' ? 50 : 10;
        const points = basePoints * this.combo;
        this.addScore('player', points);

        this.spawnParticles(star.x, star.y, star.color, 14);
        this._addFloater(star.x, star.y - 10, `+${points}`, star.color);

        // Remove caught star immediately so it doesn't render.
        this.stars.splice(i, 1);
        return;
      }
    }
  }

  /**
   * Add a floating score label.
   * @param {number} x
   * @param {number} y
   * @param {string} text
   * @param {string} color
   */
  _addFloater(x, y, text, color) {
    this.floaters.push({
      x, y, text, color,
      life: 1.0,
      maxLife: 1.0,
      alpha: 1.0
    });
  }

  /**
   * Render the night sky, stars, HUD, and floating text.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    const W = this.game.W;
    const H = this.game.H;

    // --- Background: deep night sky ---
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0d0b1e');
    grad.addColorStop(0.5, '#1a1535');
    grad.addColorStop(1, '#2a1f4a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // --- Static twinkling background stars ---
    for (const s of this.bgStars) {
      const twinkle = 0.4 + 0.6 * Math.sin(this._twinkleOffset * s.twinkleSpeed + s.phase);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // --- Falling stars ---
    for (const star of this.stars) {
      ctx.save();
      ctx.translate(star.x, star.y);
      ctx.rotate(star.rotation);

      // Outer glow for gold stars.
      if (star.color === '#ffd700') {
        ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
        ctx.shadowBlur = 20;
      }

      // Draw five-point star shape.
      this._drawStarShape(ctx, 0, 0, star.size, 5, star.size * 0.5);

      ctx.fillStyle = star.color;
      ctx.fill();
      ctx.restore();
    }

    // --- Floating score text ---
    for (const f of this.floaters) {
      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = f.color;
      ctx.font = `bold ${Math.floor(Math.min(W, H) * 0.035)}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 8;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    // --- HUD: score, combo, timer bar ---
    this._drawHUD(ctx, W, H);
  }

  /**
   * Draw the five-point star path centered at (cx, cy).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} outerR — Radius to outer points.
   * @param {number} points — Number of points (5 for star).
   * @param {number} innerR — Radius to inner valleys.
   */
  _drawStarShape(ctx, cx, cy, outerR, points, innerR) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI * i) / points - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /**
   * Draw the heads-up display: score, combo, catches/misses, timer bar.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W
   * @param {number} H
   */
  _drawHUD(ctx, W, H) {
    const score = this.getScore('player');
    const fontSize = Math.floor(Math.min(W, H) * 0.04);

    // Top-left: score.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    this.drawRoundRect(ctx, 12, 12, 160, 46, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Score: ${score}`, 26, 35);

    // Top-right: combo.
    if (this.combo > 1) {
      const comboW = 100;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      this.drawRoundRect(ctx, W - comboW - 12, 12, comboW, 46, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.fillText(`Combo x${this.combo}`, W - comboW / 2 - 12, 35);
    }

    // Bottom-left: caught / missed / max combo.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    this.drawRoundRect(ctx, 12, H - 42, 170, 32, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `${Math.floor(fontSize * 0.75)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`Caught ${this.caught}  Missed ${this.missed}`, 22, H - 22);

    // Bottom center: timer bar.
    const barW = Math.min(300, W * 0.5);
    const barH = 8;
    const barX = (W - barW) / 2;
    const barY = H - 24;
    const progress = this.timer / this.duration;

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    this.drawRoundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();

    const fillColor = progress > 0.8 ? '#ff6b6b' : progress > 0.5 ? '#ffd700' : '#90ee90';
    ctx.fillStyle = fillColor;
    this.drawRoundRect(ctx, barX, barY, barW * (1 - progress), barH, barH / 2);
    ctx.fill();

    // Timer text centered above bar.
    const remaining = Math.max(0, Math.ceil(this.duration - this.timer));
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(fontSize * 0.8)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${remaining}s`, W / 2, barY - 10);

    // Golden star indicator (if any caught).
    if (this.goldenCaught > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.font = `${Math.floor(fontSize * 0.75)}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`\u2B50 ${this.goldenCaught}`, W - 18, H - 22);
    }
  }
}
