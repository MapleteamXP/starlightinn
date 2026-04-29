/**
 * @fileoverview Trivia.js — Game 4: World lore trivia.
 * 10 randomly-selected multiple-choice questions about Starlight Inn.
 * Correct answers earn 100 pts + a time bonus. Wrong answers score 0.
 * The round ends after all questions or when time expires.
 */

import { BaseMinigame } from './BaseMinigame.js';

/**
 * @typedef {Object} Question
 * @property {string} q — Question text.
 * @property {Array<string>} a — Four answer choices.
 * @property {number} correct — Zero-based index of the correct answer.
 */

/**
 * @typedef {Object} AnswerButton
 * @property {number} index — 0..3 answer index.
 * @property {number} x, y, w, h — Screen rectangle.
 * @property {boolean} hovered
 */

export class Trivia extends BaseMinigame {
  /**
   * @param {Object} game   — Main Game singleton.
   * @param {Object} config — Overrides (duration, questionCount, etc.).
   */
  constructor(game, config = {}) {
    super(game, { duration: 180, ...config });

    /** @type {Array<Question>} Full shuffled question deck. */
    this.questions = [];

    /** @type {number} Current question index. */
    this.currentQuestion = 0;

    /** @type {number|null} Index of the answer the player selected. */
    this.selectedAnswer = null;

    /** @type {number} Per-question countdown (seconds). */
    this.questionTimer = 15;

    /** @type {boolean} Whether the current question has been answered. */
    this.answered = false;

    /** @type {number} How many questions to ask. */
    this.questionCount = config.questionCount ?? 10;

    /** @type {number} Correct answers so far. */
    this.correctCount = 0;

    /** @type {number} Wrong answers so far. */
    this.wrongCount = 0;

    /** @type {Array<AnswerButton>} Cached layout for current answers. */
    this._answerRects = [];

    /** @type {number|null} Timeout handle for auto-advancing. */
    this._advanceHandle = null;

    /** @type {string|null} Feedback text to show briefly. */
    this.feedbackText = null;

    /** @type {number} Feedback alpha. */
    this.feedbackAlpha = 0;

    /** @type {string} Feedback color. */
    this.feedbackColor = '#fff';

    this.init();
  }

  /** Shuffle and slice the question bank. */
  init() {
    this.questions = this._shuffle(this.getQuestions()).slice(0, this.questionCount);
    this.currentQuestion = 0;
    this.selectedAnswer = null;
    this.questionTimer = 15;
    this.answered = false;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.feedbackText = null;
    this._answerRects = [];
  }

  /**
   * Per-frame update: countdown the question timer, fade feedback.
   * @param {number} dt
   */
  update(dt) {
    if (this.state !== 'playing') return;

    if (!this.answered) {
      this.questionTimer -= dt;
      if (this.questionTimer <= 0) {
        this.questionTimer = 0;
        // Time ran out — treat as wrong answer.
        this._processAnswer(-1);
      }
    }

    // Fade feedback.
    if (this.feedbackAlpha > 0) {
      this.feedbackAlpha = Math.max(0, this.feedbackAlpha - dt * 1.5);
    }
  }

  /**
   * Handle a click on an answer button.
   * @param {number} x
   * @param {number} y
   */
  onClick(x, y) {
    if (this.state !== 'playing' || this.answered) return;

    for (const rect of this._answerRects) {
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
        this._processAnswer(rect.index);
        return;
      }
    }
  }

  /**
   * Evaluate the player's answer, award points, show feedback, then queue next question.
   * @param {number} answerIndex — -1 means timed out.
   */
  _processAnswer(answerIndex) {
    if (this.answered) return;
    this.answered = true;
    this.selectedAnswer = answerIndex;

    const q = this.questions[this.currentQuestion];
    const isCorrect = answerIndex === q.correct;

    if (isCorrect) {
      this.correctCount++;
      const timeBonus = Math.floor(this.questionTimer * 10);
      const points = 100 + timeBonus;
      this.addScore('player', points);
      this.feedbackText = `Correct! +${points}`;
      this.feedbackColor = '#6bcb77';
      this.feedbackAlpha = 1.0;
    } else {
      this.wrongCount++;
      this.feedbackText = answerIndex === -1 ? 'Time\u2019s up!' : 'Wrong!';
      this.feedbackColor = '#ff6b6b';
      this.feedbackAlpha = 1.0;
    }

    if (this._advanceHandle) clearTimeout(this._advanceHandle);
    this._advanceHandle = setTimeout(() => this._nextQuestion(), 2200);
  }

  /** Advance to the next question or end the game. */
  _nextQuestion() {
    if (this._advanceHandle) {
      clearTimeout(this._advanceHandle);
      this._advanceHandle = null;
    }

    this.currentQuestion++;
    this.answered = false;
    this.selectedAnswer = null;
    this.questionTimer = 15;
    this.feedbackText = null;
    this._answerRects = [];

    if (this.currentQuestion >= this.questions.length) {
      // Completion bonus.
      const completionBonus = this.correctCount * 25;
      this.addScore('player', completionBonus);
      this.end();
    }
  }

  /**
   * Render question panel, answer buttons, timer, and progress.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    const W = this.game.W;
    const H = this.game.H;
    const q = this.questions[this.currentQuestion];

    if (!q) return;

    // --- Background ---
    const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H));
    grad.addColorStop(0, '#1e1a3a');
    grad.addColorStop(1, '#120b1e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // --- Title bar ---
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${Math.floor(Math.min(W, H) * 0.038)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.fillText('\u2753  Trivia Challenge', W / 2, 14);
    ctx.shadowBlur = 0;

    // --- Progress ---
    const progress = `${this.currentQuestion + 1} / ${this.questions.length}`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${Math.floor(Math.min(W, H) * 0.028)}px "Segoe UI", sans-serif`;
    ctx.fillText(progress, W / 2, 52);

    // --- Question panel ---
    const panelW = Math.min(560, W * 0.9);
    const panelH = Math.min(110, H * 0.18);
    const panelX = (W - panelW) / 2;
    const panelY = 90;

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    this.drawRoundRect(ctx, panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Question text (wrapped roughly).
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(Math.min(W, H) * 0.032)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this._drawWrappedText(ctx, q.q, W / 2, panelY + panelH / 2, panelW - 30,
      Math.floor(Math.min(W, H) * 0.032) * 1.35);

    // --- Timer circle ---
    const timerR = 22;
    const timerX = W - 38;
    const timerY = 38;
    const timerPct = this.questionTimer / 15;

    ctx.beginPath();
    ctx.arc(timerX, timerY, timerR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * timerPct);
    ctx.strokeStyle = timerPct < 0.3 ? '#ff6b6b' : '#90ee90';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(timerR * 0.65)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(this.questionTimer).toString(), timerX, timerY);

    // --- Answer buttons ---
    const btnW = Math.min(500, W * 0.82);
    const btnH = Math.min(52, H * 0.095);
    const btnX = (W - btnW) / 2;
    const startY = panelY + panelH + 28;
    const gap = 12;

    this._answerRects = [];

    for (let i = 0; i < q.a.length; i++) {
      const bx = btnX;
      const by = startY + i * (btnH + gap);
      const isCorrect = i === q.correct;
      const isSelected = this.selectedAnswer === i;

      // Determine button color.
      let bg = 'rgba(255,255,255,0.07)';
      let border = 'rgba(255,255,255,0.15)';
      let textColor = '#ffffff';

      if (this.answered) {
        if (isCorrect) {
          bg = 'rgba(107, 203, 119, 0.25)';
          border = 'rgba(107, 203, 119, 0.6)';
          textColor = '#c8ffd0';
        } else if (isSelected && !isCorrect) {
          bg = 'rgba(255, 107, 107, 0.25)';
          border = 'rgba(255, 107, 107, 0.6)';
          textColor = '#ffc8c8';
        } else {
          bg = 'rgba(255,255,255,0.04)';
          border = 'rgba(255,255,255,0.08)';
          textColor = 'rgba(255,255,255,0.5)';
        }
      }

      // Button background.
      ctx.fillStyle = bg;
      this.drawRoundRect(ctx, bx, by, btnW, btnH, 10);
      ctx.fill();

      // Border.
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Letter label (A, B, C, D).
      const letters = ['A', 'B', 'C', 'D'];
      ctx.fillStyle = textColor;
      ctx.font = `bold ${Math.floor(btnH * 0.45)}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${letters[i]}.`, bx + 16, by + btnH / 2);

      // Answer text.
      const textX = bx + 50;
      const maxTextW = btnW - 70;
      ctx.fillStyle = textColor;
      ctx.font = `${Math.floor(btnH * 0.4)}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'left';
      this._drawWrappedText(ctx, q.a[i], textX, by + btnH / 2, maxTextW, btnH * 0.5);

      this._answerRects.push({ index: i, x: bx, y: by, w: btnW, h: btnH });
    }

    // --- Feedback overlay ---
    if (this.feedbackText && this.feedbackAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.feedbackAlpha;
      ctx.fillStyle = this.feedbackColor;
      ctx.font = `bold ${Math.floor(Math.min(W, H) * 0.06)}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 16;
      ctx.fillText(this.feedbackText, W / 2, H * 0.55);
      ctx.restore();
    }

    // --- Bottom score ---
    const score = this.getScore('player');
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    this.drawRoundRect(ctx, 12, H - 42, 140, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.floor(Math.min(W, H) * 0.028)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Score: ${score}`, 22, H - 26);

    // Correct / wrong counters bottom-right.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    this.drawRoundRect(ctx, W - 150, H - 42, 138, 32, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'right';
    ctx.fillText(`\u2705 ${this.correctCount}  \u274C ${this.wrongCount}`, W - 18, H - 26);
  }

  /**
   * The full question bank. Each question has 4 choices and a correct index.
   * @returns {Array<Question>}
   */
  getQuestions() {
    return [
      { q: 'What is the main social area called?',
        a: ['Moon Beach', 'Starlight Hub', 'Crystal Island', 'Whisper Forest'], correct: 1 },
      { q: 'How often do rare chests spawn?',
        a: ['Every hour', 'Every 2 hours', 'Every 3 hours', 'Daily'], correct: 1 },
      { q: 'What currency is earned passively every hour?',
        a: ['Silver', 'Gold', 'Stars', 'Tokens'], correct: 0 },
      { q: 'Which gesture is triggered by pressing key 1?',
        a: ['Dance', 'Wave', 'Sit', 'Laugh'], correct: 1 },
      { q: 'What does the Uppercut power-up cost in the shop?',
        a: ['100 Gold', '250 Gold', '500 Gold', 'Free'], correct: 1 },
      { q: 'How many base explorable areas are there?',
        a: ['6', '8', '12', '14'], correct: 3 },
      { q: 'What aesthetic style is Starlight Inn known for?',
        a: ['Cozy-core', 'Kawaii', 'Retro', 'Neon'], correct: 0 },
      { q: 'What color are bonus stars in Star Catcher?',
        a: ['White', 'Blue', 'Gold', 'Pink'], correct: 2 },
      { q: 'How many cards are on the Memory Match board?',
        a: ['12', '16', '20', '24'], correct: 1 },
      { q: 'Which key set is used for Rhythm Dance?',
        a: ['WASD', 'Arrow Keys', 'Number Keys', 'Spacebar'], correct: 1 },
      { q: 'What happens when you build a 10-hit streak in Rhythm Dance?',
        a: ['Speed up', 'Score multiplier', 'Extra life', 'Nothing'], correct: 1 },
      { q: 'How many trivia questions are asked per round?',
        a: ['5', '8', '10', '15'], correct: 2 },
      { q: 'What is the maximum players in a Star Catcher lobby?',
        a: ['2', '3', '4', '6'], correct: 2 },
      { q: 'Which mini-game supports only 2 players maximum?',
        a: ['Star Catcher', 'Memory Match', 'Rhythm Dance', 'Trivia'], correct: 1 },
      { q: 'What do you earn for 1st place in any mini-game?',
        a: ['100 Silver', '150 Silver', '200 Silver', '500 Silver'], correct: 2 },
      { q: 'What does the cozy inn serve to guests?',
        a: ['Coffee', 'Hot Cocoa', 'Tea', 'Lemonade'], correct: 1 },
      { q: 'What time of day is the world permanently set in?',
        a: ['Noon', 'Sunset', 'Twilight', 'Midnight'], correct: 2 },
      { q: 'What animal companion roams the hub?',
        a: ['Fox', 'Owl', 'Cat', 'Rabbit'], correct: 1 },
      { q: 'What is the inn\u2019s signature flower?',
        a: ['Rose', 'Lily', 'Cherry Blossom', 'Starflower'], correct: 3 },
      { q: 'Which badge can 1st-place mini-game winners earn?',
        a: ['Star Walker', 'Mini Hero', 'Game Master', 'Lore Keeper'], correct: 2 }
    ];
  }

  /**
   * Utility: draw text with simple line wrapping at a max width.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {number} maxWidth
   * @param {number} lineHeight
   */
  _drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    const lines = [];

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line.trim());
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());

    const totalH = lines.length * lineHeight;
    const startY = y - totalH / 2 + lineHeight / 2;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, startY + i * lineHeight);
    }
  }

  /**
   * Fisher-Yates shuffle for the question deck.
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

  /** Clean up pending timers. */
  dispose() {
    if (this._advanceHandle) clearTimeout(this._advanceHandle);
    super.dispose();
  }
}
