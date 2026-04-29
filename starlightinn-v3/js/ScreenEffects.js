/**
 * @fileoverview ScreenEffects.js — Full-screen visual feedback system for Starlight Inn v3.5.
 * Provides immediate, tactile game-feel effects that make every interaction satisfying:
 * color flashes, camera shake with decay, hitstop (dramatic freeze frames),
 * slow-motion, and floating combat-style text. All timing is delta-time based
 * for frame-rate independence.
 *
 * ScreenEffects is designed to be the centralized "juice" layer — any system
 * (farts, uppercuts, power-ups, UI) can call it for instant visual feedback.
 *
 * @module ScreenEffects
 * @version 3.5.0
 * @author Starlight Inn Team
 */

/** @typedef {import('./Game.js').Game} Game */

/**
 * @typedef {Object} FlashEffect
 * @property {'flash'} type — Discriminator.
 * @property {string} color — CSS color string.
 * @property {number} duration — Total duration in seconds.
 * @property {number} timer — Remaining time in seconds.
 */

/**
 * @typedef {Object} ShakeEffect
 * @property {'shake'} type — Discriminator.
 * @property {number} intensity — Max shake amplitude in pixels.
 * @property {number} duration — Total duration in seconds.
 * @property {number} timer — Remaining time in seconds.
 * @property {number} offsetX — Current X shake offset.
 * @property {number} offsetY — Current Y shake offset.
 * @property {number} seed — Randomization seed for stable per-frame noise.
 */

/**
 * @typedef {Object} FloatingTextEffect
 * @property {'floatingText'} type — Discriminator.
 * @property {string} text — Text to render.
 * @property {number} x — Normalized world X (0..1).
 * @property {number} y — Normalized world Y (0..1).
 * @property {string} color — CSS text color.
 * @property {number} duration — Total lifetime in seconds.
 * @property {number} timer — Remaining time in seconds.
 * @property {number} vy — Vertical drift speed (normalized/sec).
 * @property {number} scale — Current text scale.
 * @property {number} [outlineColor] — Optional text outline color.
 */

/**
 * @typedef {Object} RippleEffect
 * @property {'ripple'} type — Discriminator.
 * @property {number} x — Screen X center in pixels.
 * @property {number} y — Screen Y center in pixels.
 * @property {number} duration — Total duration in seconds.
 * @property {number} timer — Remaining time in seconds.
 * @property {number} maxRadius — Maximum ring radius in pixels.
 * @property {string} color — CSS ring color.
 * @property {number} lineWidth — Stroke width.
 */

/**
 * @typedef {FlashEffect|ShakeEffect|FloatingTextEffect|RippleEffect} ScreenEffect
 */

/**
 * Centralized full-screen visual feedback system.
 * Manages flash frames, camera shake, floating text, hitstop, slow-motion,
 * and ripple ring effects. All effects are time-based and frame-rate independent.
 * @export
 */
export class ScreenEffects {
  /**
   * Default hitstop duration in seconds (dramatic freeze on impact).
   * @type {number}
   * @constant
   */
  static DEFAULT_HITSTOP = 0.05;

  /**
   * Default slow-motion time scale factor.
   * @type {number}
   * @constant
   */
  static DEFAULT_SLOWMO_FACTOR = 0.3;

  /**
   * Creates a ScreenEffects instance.
   * @param {Game} game — The main Game instance.
   */
  constructor(game) {
    /** @type {Game} */
    this.game = game;

    /** @type {ScreenEffect[]} — Active effects being updated and rendered. */
    this.effects = [];

    /** @type {number} — Accumulated time for shake noise generation. */
    this._shakeSeed = 0;

    /** @type {boolean} — Whether hitstop is currently freezing the game. */
    this._hitstopActive = false;

    /** @type {number|null} — Timeout handle for hitstop release. */
    this._hitstopTimer = null;

    /** @type {number} — Previous timeScale before slowMo (for restoration). */
    this._prevTimeScale = 1.0;

    /** @type {number|null} — Timeout handle for slowMo restoration. */
   this._slowMoTimer = null;
  }

  /* ================================================================ */
  /*  PUBLIC API — EFFECT TRIGGERS                                     */
  /* ================================================================ */

  /**
   * Triggers a full-screen color flash. Great for impacts and transitions.
   *
   * @param {string} [color='#FFFFFF'] — CSS color string.
   * @param {number} [duration=0.1] — Duration in seconds.
   * @returns {void}
   */
  flash(color = '#FFFFFF', duration = 0.1) {
    /** @type {FlashEffect} */
    const effect = {
      type: 'flash',
      color,
      duration: Math.max(0.01, duration),
      timer: Math.max(0.01, duration)
    };
    this.effects.push(effect);
  }

  /**
   * Triggers a screen shake with intensity-based amplitude and smooth decay.
   * Multiple shakes combine (the strongest wins at any moment).
   *
   * @param {number} intensity — Max shake amplitude in pixels.
   * @param {number} [duration=0.3] — Duration in seconds.
   * @returns {void}
   */
  shake(intensity, duration = 0.3) {
    /** @type {ShakeEffect} */
    const effect = {
      type: 'shake',
      intensity: Math.max(0, intensity),
      duration: Math.max(0.01, duration),
      timer: Math.max(0.01, duration),
      offsetX: 0,
      offsetY: 0,
      seed: Math.random() * 1000
    };
    this.effects.push(effect);
  }

  /**
   * Triggers a brief hitstop — the game freezes for a split second on impact.
   * Creates a dramatic "punch" feeling. Safe to call overlapping; extends freeze.
   *
   * @param {number} [duration=0.05] — Freeze duration in seconds.
   * @returns {void}
   */
  hitstop(duration = ScreenEffects.DEFAULT_HITSTOP) {
    // Clear any existing hitstop to extend it
    if (this._hitstopTimer) {
      clearTimeout(this._hitstopTimer);
    }
    this._hitstopActive = true;
    if (this.game) {
      this.game.paused = true;
    }
    this._hitstopTimer = setTimeout(() => {
      this._hitstopActive = false;
      if (this.game) {
        this.game.paused = false;
      }
      this._hitstopTimer = null;
    }, duration * 1000);
  }

  /**
   * Triggers slow-motion. The game's timeScale is reduced for dramatic effect.
   *
   * @param {number} [factor=0.3] — Time multiplier (0.1 = 10% speed).
   * @param {number} [duration=1.0] — Duration in seconds.
   * @returns {void}
   */
  slowMo(factor = ScreenEffects.DEFAULT_SLOWMO_FACTOR, duration = 1.0) {
    // Store previous scale if not already in slow-mo
    if (!this._slowMoTimer) {
      this._prevTimeScale = this.game?.timeScale ?? 1.0;
    } else {
      clearTimeout(this._slowMoTimer);
    }

    if (this.game) {
      this.game.timeScale = Math.max(0.05, Math.min(1.0, factor));
    }

    this._slowMoTimer = setTimeout(() => {
      if (this.game) {
        this.game.timeScale = this._prevTimeScale;
      }
      this._slowMoTimer = null;
    }, duration * 1000);
  }

  /**
   * Spawns floating text that drifts upward and fades out.
   * Perfect for "POW!", "PFFFFT!", damage numbers, and emotes.
   *
   * @param {string} text — Text content.
   * @param {number} x — Normalized world X (0..1).
   * @param {number} y — Normalized world Y (0..1).
   * @param {string} [color='#FFFFFF'] — CSS text color.
   * @param {number} [duration=1.5] — Duration in seconds.
   * @param {string} [outlineColor='#000000'] — Text outline color.
   * @returns {void}
   */
  floatingText(text, x, y, color = '#FFFFFF', duration = 1.5, outlineColor = '#000000') {
    /** @type {FloatingTextEffect} */
    const effect = {
      type: 'floatingText',
      text,
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      color,
      duration: Math.max(0.1, duration),
      timer: Math.max(0.1, duration),
      vy: -0.03, // drift upward (normalized/sec)
      scale: 1.0,
      outlineColor
    };
    this.effects.push(effect);
  }

  /**
   * Spawns a comic-style floating text with an exaggerated pop-in effect.
   * Scales from 2x down to 1x over the first 15% of life.
   *
   * @param {string} text — Text content.
   * @param {number} x — Normalized world X (0..1).
   * @param {number} y — Normalized world Y (0..1).
   * @param {string} [color='#FFD700'] — CSS text color.
   * @param {number} [duration=1.2] — Duration in seconds.
   * @returns {void}
   */
  comicText(text, x, y, color = '#FFD700', duration = 1.2) {
    /** @type {FloatingTextEffect} */
    const effect = {
      type: 'floatingText',
      text,
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      color,
      duration: Math.max(0.1, duration),
      timer: Math.max(0.1, duration),
      vy: -0.025,
      scale: 2.0, // starts big
      outlineColor: '#000000'
    };
    // Mark as comic-style via a private flag (handled in update)
    effect._comicStyle = true;
    this.effects.push(effect);
  }

  /**
   * Triggers an expanding ring ripple at a screen position.
   * Useful for marking impact points or ability uses.
   *
   * @param {number} screenX — Screen X in pixels.
   * @param {number} screenY — Screen Y in pixels.
   * @param {string} [color='#FFFFFF'] — Ring color.
   * @param {number} [duration=0.5] — Duration in seconds.
   * @param {number} [maxRadius=80] — Max ring radius in pixels.
   * @returns {void}
   */
  ripple(screenX, screenY, color = '#FFFFFF', duration = 0.5, maxRadius = 80) {
    /** @type {RippleEffect} */
    const effect = {
      type: 'ripple',
      x: screenX,
      y: screenY,
      duration: Math.max(0.01, duration),
      timer: Math.max(0.01, duration),
      maxRadius,
      color,
      lineWidth: 3
    };
    this.effects.push(effect);
  }

  /* ================================================================ */
  /*  UPDATE LOOP                                                     */
  /* ================================================================ */

  /**
   * Updates all active effects. Call once per frame.
   * Decrements timers, updates positions, and removes expired effects.
   *
   * @param {number} dt — Delta time in seconds.
   * @returns {void}
   */
  update(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.timer -= dt;

      if (e.timer <= 0) {
        this.effects.splice(i, 1);
        continue;
      }

      const lifeRatio = e.timer / e.duration;

      switch (e.type) {
        case 'shake': {
          // Shake with smooth decay using sine/cosine for stable frames
          this._shakeSeed += dt * 60;
          const decay = Math.pow(lifeRatio, 0.8);
          e.offsetX = Math.sin(this._shakeSeed * 7.3 + e.seed) * e.intensity * decay;
          e.offsetY = Math.cos(this._shakeSeed * 5.9 + e.seed * 1.5) * e.intensity * decay;
          break;
        }

        case 'floatingText': {
          // Drift upward
          e.y += e.vy * dt;
          // Comic text scales down from 2x in first 15%
          if (e._comicStyle) {
            const comicProgress = 1 - (e.timer / e.duration);
            if (comicProgress < 0.15) {
              e.scale = 2.0 - (comicProgress / 0.15) * 1.0; // 2.0 → 1.0
            } else {
              e.scale = 1.0;
            }
          }
          break;
        }

        case 'ripple': {
          // Rings expand outward
          // No per-update math needed; render computes from timer
          break;
        }

        case 'flash':
        default:
          // No per-update state needed
          break;
      }
    }
  }

  /* ================================================================ */
  /*  RENDERING                                                       */
  /* ================================================================ */

  /**
   * Renders all active screen effects. Should be called LAST in the render
   * pipeline so flashes and text appear on top of everything.
   *
   * @param {CanvasRenderingContext2D} ctx — Canvas 2D context.
   * @param {number} W — Canvas width in pixels.
   * @param {number} H — Canvas height in pixels.
   * @returns {void}
   */
  render(ctx, W, H) {
    // Apply shake offset to the entire canvas context
    const shake = this._getCurrentShake();
    if (shake.x !== 0 || shake.y !== 0) {
      ctx.save();
      ctx.translate(shake.x, shake.y);
    }

    for (const e of this.effects) {
      switch (e.type) {
        case 'flash':
          this._renderFlash(ctx, e, W, H);
          break;
        case 'floatingText':
          this._renderFloatingText(ctx, e, W, H);
          break;
        case 'ripple':
          this._renderRipple(ctx, e);
          break;
        case 'shake':
          // Shake is applied as global canvas offset above
          break;
      }
    }

    if (shake.x !== 0 || shake.y !== 0) {
      ctx.restore();
    }
  }

  /* ================================================================ */
  /*  QUERY                                                           */
  /* ================================================================ */

  /**
   * Returns the current combined shake offset from all active shake effects.
   * Use this to apply shake to the camera or canvas transform.
   *
   * @returns {{x:number, y:number}} Shake offset in pixels.
   */
  getShakeOffset() {
    return this._getCurrentShake();
  }

  /**
   * Checks whether a hitstop freeze is currently active.
   *
   * @returns {boolean}
   */
  isHitstopActive() {
    return this._hitstopActive;
  }

  /**
   * Returns the number of currently active effects.
   *
   * @returns {number}
   */
  getActiveCount() {
    return this.effects.length;
  }

  /**
   * Clears all active effects immediately.
   *
   * @returns {void}
   */
  clear() {
    this.effects = [];
    if (this._hitstopTimer) {
      clearTimeout(this._hitstopTimer);
      this._hitstopTimer = null;
    }
    if (this._slowMoTimer) {
      clearTimeout(this._slowMoTimer);
      this._slowMoTimer = null;
    }
    this._hitstopActive = false;
    if (this.game) {
      this.game.paused = false;
      this.game.timeScale = 1.0;
    }
  }

  /* ================================================================ */
  /*  RENDER HELPERS                                                  */
  /* ================================================================ */

  /**
   * Renders a full-screen flash effect.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {FlashEffect} e
   * @param {number} W
   * @param {number} H
   * @private
   */
  _renderFlash(ctx, e, W, H) {
    const alpha = Math.min(1, e.timer / (e.duration * 0.4));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = e.color;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.restore();
  }

  /**
   * Renders floating text with outline and fade.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {FloatingTextEffect} e
   * @param {number} W
   * @param {number} H
   * @private
   */
  _renderFloatingText(ctx, e, W, H) {
    const lifeRatio = e.timer / e.duration;

    // Fade in first 20%, fade out last 40%
    let alpha;
    if (lifeRatio > 0.8) {
      alpha = (1 - lifeRatio) / 0.2; // fade out
    } else if (lifeRatio > 0.8) {
      alpha = 1.0;
    } else {
      alpha = lifeRatio < 0.2 ? lifeRatio / 0.2 : 1.0;
    }
    // Correct logic: fade in first 20%, hold, fade out last 40%
    if (lifeRatio > 0.6) {
      alpha = (1 - lifeRatio) / 0.4;
    } else if (lifeRatio < 0.2) {
      alpha = lifeRatio / 0.2;
    } else {
      alpha = 1.0;
    }

    const tx = e.x * W;
    const ty = e.y * H;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(tx, ty);
    ctx.scale(e.scale, e.scale);

    // Bold comic-style font
    ctx.font = 'bold 24px Nunito, "Comic Sans MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Thick outline for readability against any background
    ctx.strokeStyle = e.outlineColor || '#000000';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeText(e.text, 0, 0);

    // Fill text
    ctx.fillStyle = e.color;
    ctx.fillText(e.text, 0, 0);

    // Optional comic-style emphasis (slight tilt)
    if (e._comicStyle) {
      ctx.rotate(-0.08);
    }

    ctx.restore();
  }

  /**
   * Renders an expanding ring ripple.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {RippleEffect} e
   * @private
   */
  _renderRipple(ctx, e) {
    const lifeRatio = e.timer / e.duration;
    const currentRadius = e.maxRadius * (1 - lifeRatio);
    const alpha = lifeRatio;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = e.lineWidth * lifeRatio;

    // Draw expanding ring
    ctx.beginPath();
    ctx.arc(e.x, e.y, currentRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner echo ring
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, currentRadius * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /* ================================================================ */
  /*  INTERNAL HELPERS                                                */
  /* ================================================================ */

  /**
   * Computes the combined shake offset from all active shake effects.
   *
   * @returns {{x:number, y:number}}
   * @private
   */
  _getCurrentShake() {
    let totalX = 0;
    let totalY = 0;
    let strongest = 0;

    for (const e of this.effects) {
      if (e.type === 'shake') {
        // Use the strongest shake rather than adding (prevents chaos)
        const strength = e.intensity * (e.timer / e.duration);
        if (strength > strongest) {
          strongest = strength;
          totalX = e.offsetX;
          totalY = e.offsetY;
        }
      }
    }
    return { x: totalX, y: totalY };
  }
}
