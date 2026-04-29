/**
 * @fileoverview MemoryMatch.js — Game 2: Card matching (4×4 grid, 8 pairs).
 * Flip cards to reveal cozy icons. Match pairs to clear the board.
 * Fewer moves and faster time yield higher scores.
 */

import { BaseMinigame } from './BaseMinigame.js';

/**
 * @typedef {Object} Card
 * @property {string} icon — Emoji displayed on the face.
 * @property {string} name — Internal identifier for matching.
 * @property {number} id   — Unique card instance id.
 * @property {boolean} flipped — Currently face-up.
 * @property {boolean} matched — Successfully paired.
 * @property {number} flipProgress — 0 = back, 1 = face (for animation).
 */

export class MemoryMatch extends BaseMinigame {
  /**
   * @param {Object} game   — Main Game singleton.
   * @param {Object} config — Overrides (duration, gridSize, etc.).
   */
  constructor(game, config = {}) {
    super(game, { duration: 120, ...config });

    /** @type {Array<Card>} 16 cards in row-major order (4×4). */
    this.grid = [];

    /** @type {Array<number>} Indices of currently flipped (non-matched) cards. */
    this.flipped = [];

    /** @type {number} How many pairs have been successfully matched. */
    this.matched = 0;

    /** @type {number} Total card flips (moves) attempted. */
    this.moves = 0;

    /** @type {number} Pairs in the deck. */
    this.totalPairs = 8;

    /** @type {boolean} Input is locked while animating a mismatch. */
    this._locked = false;

    /** @type {number|null} Timeout handle for mismatch flip-back. */
    this._lockHandle = null;

    /** @type {Array<Object>} The 8 cozy icon pairs. */
    this.pairs = [
      { icon: '\uD83C\uDF1F', name: 'star' },
      { icon: '\uD83C\uDF19', name: 'moon' },
      { icon: '\u2601\uFE0F', name: 'cloud' },
      { icon: '\u2B50',     name: 'sparkle' },
      { icon: '\uD83E\uDD89', name: 'owl' },
      { icon: '\uD83C\uDF38', name: 'flower' },
      { icon: '\uD83D\uDCDA', name: 'book' },
      { icon: '\uD83D\uDD6F\uFE0F', name: 'candle' }
    ];

    /** @type {number} Grid columns. */
    this.cols = 4;
    /** @type {number} Grid rows. */
    this.rows = 4;

    /** @type {Object} Cached grid layout metrics. */
    this._layout = { cellW: 0, cellH: 0, padX: 0, padY: 0, offsetX: 0, offsetY: 0 };

    this.init();
  }

  /** Build the shuffled 4×4 card grid. */
  init() {
    const cards = [];
    this.pairs.forEach((pair, i) => {
      cards.push({
        icon: pair.icon,
        name: pair.name,
        id: i * 2,
        flipped: false,
        matched: false,
        flipProgress: 0
      });
      cards.push({
        icon: pair.icon,
        name: pair.name,
        id: i * 2 + 1,
        flipped: false,
        matched: false,
        flipProgress: 0
      });
    });
    this.grid = this._shuffle(cards);
    this.flipped = [];
    this.matched = 0;
    this.moves = 0;
    this._locked = false;
  }

  /**
   * Per-frame update: animate flip progress and glow effects.
   * @param {number} dt
   */
  update(dt) {
    if (this.state !== 'playing') return;

    const flipSpeed = 6; // progress per second

    for (const card of this.grid) {
      const target = card.flipped || card.matched ? 1 : 0;
      if (card.flipProgress !== target) {
        const dir = target > card.flipProgress ? 1 : -1;
        card.flipProgress = this.clamp(
          card.flipProgress + dir * flipSpeed * dt,
          0, 1
        );
      }
    }

    // Win check: all 8 pairs matched.
    if (this.matched >= this.totalPairs) {
      // Bonus for remaining time.
      const timeBonus = Math.floor((this.duration - this.timer) * 5);
      const moveBonus = Math.max(0, (this.totalPairs * 2 - this.moves) * 10);
      this.addScore('player', timeBonus + moveBonus);
      this.end();
    }
  }

  /**
   * Handle a click on the canvas to flip a card.
   * @param {number} x
   * @param {number} y
   */
  onClick(x, y) {
    if (this.state !== 'playing' || this._locked) return;

    this._recomputeLayout();
    const { cellW, cellH, padX, padY, offsetX, offsetY } = this._layout;

    const col = Math.floor((x - offsetX + padX / 2) / (cellW + padX));
    const row = Math.floor((y - offsetY + padY / 2) / (cellH + padY));

    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;

    const idx = row * this.cols + col;
    const card = this.grid[idx];
    if (!card || card.flipped || card.matched) return;

    // Flip this card.
    card.flipped = true;
    this.flipped.push(idx);
    this.moves++;

    // If we have 2 flipped, evaluate match.
    if (this.flipped.length === 2) {
      this._checkMatch();
    }
  }

  /** Compare the two flipped cards and either lock them or flip back. */
  _checkMatch() {
    const [a, b] = this.flipped;
    const cardA = this.grid[a];
    const cardB = this.grid[b];

    if (cardA.name === cardB.name) {
      // Match!
      cardA.matched = true;
      cardB.matched = true;
      this.matched++;
      this.flipped = [];

      // Score: fewer moves = more points.
      const basePoints = 50;
      const moveFactor = Math.max(0.5, 1 - (this.moves / 40));
      const points = Math.floor(basePoints * moveFactor);
      this.addScore('player', points);

      // Particles at both card centers.
      this._recomputeLayout();
      const { cellW, cellH, padX, padY, offsetX, offsetY } = this._layout;
      const cxA = offsetX + (a % this.cols) * (cellW + padX) + cellW / 2;
      const cyA = offsetY + Math.floor(a / this.cols) * (cellH + padY) + cellH / 2;
      const cxB = offsetX + (b % this.cols) * (cellW + padX) + cellW / 2;
      const cyB = offsetY + Math.floor(b / this.cols) * (cellH + padY) + cellH / 2;
      this.spawnParticles(cxA, cyA, '#ffd700', 10);
      this.spawnParticles(cxB, cyB, '#ffd700', 10);
    } else {
      // Mismatch: lock input briefly, then flip back.
      this._locked = true;
      this._lockHandle = setTimeout(() => {
        cardA.flipped = false;
        cardB.flipped = false;
        this.flipped = [];
        this._locked = false;
        this._lockHandle = null;
      }, 900);
    }
  }

  /**
   * Render the cozy board, cards, and HUD.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    const W = this.game.W;
    const H = this.game.H;

    // --- Background ---
    const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H));
    grad.addColorStop(0, '#1e1a3a');
    grad.addColorStop(1, '#120b1e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    this._recomputeLayout();
    const { cellW, cellH, padX, padY, offsetX, offsetY } = this._layout;

    // --- Draw grid ---
    for (let i = 0; i < this.grid.length; i++) {
      const card = this.grid[i];
      const col = i % this.cols;
      const row = Math.floor(i / this.cols);
      const x = offsetX + col * (cellW + padX);
      const y = offsetY + row * (cellH + padY);

      this._drawCard(ctx, card, x, y, cellW, cellH);
    }

    // --- HUD ---
    this._drawHUD(ctx, W, H);
  }

  /**
   * Draw a single card with 3-D flip animation, glow, and cozy styling.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Card} card
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  _drawCard(ctx, card, x, y, w, h) {
    const cornerR = 10;
    const flip = card.flipProgress; // 0 = back, 1 = face
    const scaleX = Math.abs(Math.cos(flip * Math.PI)); // squash for flip illusion

    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(scaleX, 1);

    // Matched glow.
    if (card.matched) {
      ctx.shadowColor = 'rgba(255, 215, 0, 0.45)';
      ctx.shadowBlur = 24;
    }

    // Card background.
    this.drawRoundRect(ctx, -w / 2, -h / 2, w, h, cornerR);

    if (flip < 0.5) {
      // Back of card: cozy pattern.
      ctx.fillStyle = '#2d2652';
      ctx.fill();

      // Pattern dots.
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      const dotSpacing = 12;
      for (let py = -h / 2 + 8; py < h / 2; py += dotSpacing) {
        for (let px = -w / 2 + 8; px < w / 2; px += dotSpacing) {
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Small center emblem on back.
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.font = `${Math.floor(h * 0.28)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u2726', 0, 0);
    } else {
      // Face of card.
      ctx.fillStyle = card.matched ? '#3a3060' : '#252045';
      ctx.fill();

      // Subtle border.
      ctx.strokeStyle = card.matched ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Icon.
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.floor(h * 0.45)}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(card.icon, 0, 4);
    }

    ctx.restore();
  }

  /**
   * Compute grid cell sizes and offsets so the board is centered.
   */
  _recomputeLayout() {
    const W = this.game.W;
    const H = this.game.H;
    const marginX = 24;
    const marginY = 80; // leave room for title + HUD

    const availW = W - marginX * 2;
    const availH = H - marginY * 2;

    const padX = 10;
    const padY = 10;
    const cellW = (availW - (this.cols - 1) * padX) / this.cols;
    const cellH = (availH - (this.rows - 1) * padY) / this.rows;
    const size = Math.min(cellW, cellH);

    // Re-centre with square cells.
    const totalW = this.cols * size + (this.cols - 1) * padX;
    const totalH = this.rows * size + (this.rows - 1) * padY;

    this._layout = {
      cellW: size,
      cellH: size,
      padX,
      padY,
      offsetX: (W - totalW) / 2,
      offsetY: (H - totalH) / 2 + 10
    };
  }

  /**
   * Draw the top HUD: title, matched progress, moves, timer.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W
   * @param {number} H
   */
  _drawHUD(ctx, W, H) {
    const fontSize = Math.floor(Math.min(W, H) * 0.035);

    // Title.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${Math.floor(fontSize * 1.2)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText('Memory Match', W / 2, 14);
    ctx.shadowBlur = 0;

    // Score panel top-left.
    const score = this.getScore('player');
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    this.drawRoundRect(ctx, 12, 54, 130, 36, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Score: ${score}`, 22, 72);

    // Matched / total pairs top-right.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    this.drawRoundRect(ctx, W - 140, 54, 128, 36, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.matched}/${this.totalPairs} pairs`, W - 76, 72);

    // Moves bottom-center.
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${Math.floor(fontSize * 0.8)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`Moves: ${this.moves}`, W / 2, H - 22);

    // Timer bar at bottom.
    const barW = Math.min(260, W * 0.45);
    const barH = 6;
    const barX = (W - barW) / 2;
    const barY = H - 10;
    const progress = this.timer / this.duration;

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    this.drawRoundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();

    ctx.fillStyle = progress > 0.8 ? '#ff6b6b' : '#90ee90';
    this.drawRoundRect(ctx, barX, barY, barW * (1 - progress), barH, barH / 2);
    ctx.fill();
  }

  /**
   * Fisher-Yates shuffle.
   * @param {Array<*>} array
   * @returns {Array<*>}
   */
  _shuffle(array) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Clean up mismatch timer on dispose. */
  dispose() {
    if (this._lockHandle) clearTimeout(this._lockHandle);
    super.dispose();
  }
}
