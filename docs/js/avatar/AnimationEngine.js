/**
 * AnimationEngine.js — AAA Squash-and-Stretch Animation State Machine
 *
 * A full-featured keyframe animation system for Starlight Inn avatars.
 * Implements traditional animation principles: anticipation, follow-through,
 * overshoot, settling, and squash-and-stretch via Canvas scale transforms.
 *
 * Features:
 * - 8 animation states: idle, walk, run, emote, sit, sleep, knocked, dance
 * - 15 Robert Penner easing functions (linear through bounce)
 * - Keyframe interpolation with per-property easing
 * - Loop, ping-pong, and one-shot playback modes
 * - Automatic animation blending between state transitions
 * - Built-in particle trigger hooks at keyframe boundaries
 *
 * @author Starlight Inn Team
 * @version 3.5.0
 */

/** @typedef {import('../engine/Game.js').Game} Game */

/**
 * @typedef {Object} Keyframe
 * @property {number} time     — Normalised time 0..1 within the animation duration
 * @property {Object<string,number>} props  — Animated properties (scaleX, scaleY, y, rotation, etc.)
 * @property {string} [easing='easeInOutQuad'] — Easing function name for segment leading TO this keyframe
 * @property {string} [trigger] — Event to fire when this keyframe is reached
 */

/**
 * @typedef {Object} AnimationTrack
 * @property {string} id          — Unique animation identifier
 * @property {number} duration    — Duration in seconds
 * @property {boolean} loop       — Whether the animation loops indefinitely
 * @property {boolean} pingPong   — If true, alternates forward/reverse instead of restarting
 * @property {Keyframe[]} keyframes — Ordered array of keyframes (must start at time 0)
 * @property {string} [nextAnim]  — Animation to auto-play after this one-shot ends
 * @property {number} [blendTime=0.1] — Blend duration when transitioning to this track
 */

/**
 * @typedef {Object} AnimationState
 * @property {string} trackId       — Current track being played
 * @property {number} time          — Current playback time in seconds
 * @property {number} direction     — 1 = forward, -1 = reverse (for ping-pong)
 * @property {number} loopsDone     — How many complete cycles have passed
 * @property {boolean} finished     — True when a non-looping animation has ended
 * @property {Object} currentValues — Interpolated property values at current time
 * @property {Object|null} blendFrom — Previous animation state for blending
 * @property {number} blendTimer    — Current blend time remaining
 * @property {number} blendDuration — Total blend duration
 */

/**
 * @typedef {Object} Transform
 * @property {number} scaleX   — Horizontal scale (squash when < 1, stretch when > 1)
 * @property {number} scaleY   — Vertical scale (stretch when < 1, squash when > 1)
 * @property {number} rotation — Rotation in degrees
 * @property {number} y        — Vertical offset in pixels
 * @property {number} x        — Horizontal offset in pixels
 * @property {number} opacity  — Alpha multiplier 0..1
 * @property {number} skewX    — Horizontal skew in degrees
 */

/** @type {Transform} */
const DEFAULT_TRANSFORM = {
  scaleX: 1, scaleY: 1, rotation: 0, y: 0, x: 0, opacity: 1, skewX: 0
};

/**
 * The AnimationEngine class manages all avatar animations using a
 * state-machine-driven keyframe system with full easing support.
 */
export class AnimationEngine {
  constructor() {
    /** @type {Map<string, AnimationTrack>} */
    this.animations = new Map();
    /** @type {Map<string, AnimationState>} */
    this.states = new Map();
    /** @type {Set<Function>} */
    this.triggerListeners = new Set();

    this._registerAllEasings();
    this._registerBuiltInAnimations();
  }

  /* ================================================================
     EASING LIBRARY  (Robert Penner + extensions)
     ================================================================ */

  _registerAllEasings() {
    const PI = Math.PI;
    const PI2 = PI * 2;
    const E = Math.E;

    this.easings = {
      /** Linear — no easing, constant velocity. */
      linear: (t) => t,

      // --- Quadratic -------------------------------------------------
      easeInQuad:    (t) => t * t,
      easeOutQuad:   (t) => 1 - (1 - t) * (1 - t),
      easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,

      // --- Cubic -----------------------------------------------------
      easeInCubic:    (t) => t * t * t,
      easeOutCubic:   (t) => 1 - Math.pow(1 - t, 3),
      easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

      // --- Quartic ---------------------------------------------------
      easeInQuart:    (t) => t * t * t * t,
      easeOutQuart:   (t) => 1 - Math.pow(1 - t, 4),
      easeInOutQuart: (t) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,

      // --- Back (overshoot — perfect for squash-stretch) -------------
      easeInBack: (t) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return c3 * t * t * t - c1 * t * t;
      },
      easeOutBack: (t) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      },
      easeInOutBack: (t) => {
        const c1 = 1.70158;
        const c2 = c1 * 1.525;
        return t < 0.5
          ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
          : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
      },

      // --- Elastic (wobble — great for impact/recoil) ----------------
      easeInElastic: (t) => {
        if (t === 0) return 0;
        if (t === 1) return 1;
        const c4 = (2 * PI) / 3;
        return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
      },
      easeOutElastic: (t) => {
        if (t === 0) return 0;
        if (t === 1) return 1;
        const c4 = (2 * PI) / 3;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
      },
      easeInOutElastic: (t) => {
        if (t === 0) return 0;
        if (t === 1) return 1;
        const c5 = (2 * PI) / 4.5;
        return t < 0.5
          ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
          : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
      },

      // --- Bounce (gravity-like settling) ----------------------------
      easeInBounce: (t) => 1 - this.easings?.easeOutBounce?.(1 - t) ?? (1 - ((tt) => {
        const n1 = 7.5625, d1 = 2.75;
        if (tt < 1 / d1) return n1 * tt * tt;
        else if (tt < 2 / d1) return n1 * (tt -= 1.5 / d1) * tt + 0.75;
        else if (tt < 2.5 / d1) return n1 * (tt -= 2.25 / d1) * tt + 0.9375;
        return n1 * (tt -= 2.625 / d1) * tt + 0.984375;
      })(1 - t)),
      easeOutBounce: (t) => {
        const n1 = 7.5625, d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        else if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
      },
      easeInOutBounce: (t) => t < 0.5
        ? (1 - this.easings?.easeOutBounce?.(1 - 2 * t) ?? 0) / 2
        : (1 + this.easings?.easeOutBounce?.(2 * t - 1) ?? 1) / 2,

      // --- Specialised game easings ----------------------------------
      /** Perlin-like smooth step for organic motion. */
      smoothStep: (t) => t * t * (3 - 2 * t),
      /** Smoother step with continuous derivatives. */
      smootherStep: (t) => t * t * t * (t * (t * 6 - 15) + 10),
      /** Sine wave in — soft acceleration. */
      easeInSine: (t) => 1 - Math.cos(t * PI / 2),
      /** Sine wave out — soft deceleration. */
      easeOutSine: (t) => Math.sin(t * PI / 2),
      /** Sine in-out — smooth acceleration and deceleration. */
      easeInOutSine: (t) => -(Math.cos(PI * t) - 1) / 2,
      /** Exponential in — sudden acceleration. */
      easeInExpo: (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
      /** Exponential out — sudden deceleration. */
      easeOutExpo: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    };

    // Resolve self-referential easings (bounce references)
    const self = this.easings;
    self.easeInBounce = (t) => 1 - self.easeOutBounce(1 - t);
    self.easeInOutBounce = (t) => t < 0.5
      ? (1 - self.easeOutBounce(1 - 2 * t)) / 2
      : (1 + self.easeOutBounce(2 * t - 1)) / 2;
  }

  /* ================================================================
     BUILT-IN ANIMATION TRACKS
     ================================================================ */

  _registerBuiltInAnimations() {
    // ── IDLE: Subtle breathing, slow sine wave ──────────────────────
    this.register('idle', {
      duration: 2.4,
      loop: true,
      pingPong: false,
      blendTime: 0.3,
      keyframes: [
        { time: 0.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0, skewX: 0 }, easing: 'easeInOutSine' },
        { time: 0.25, props: { scaleX: 1.00, scaleY: 1.03, y: -1.5, rotation: 0.3, skewX: 0.5 }, easing: 'easeInOutSine' },
        { time: 0.5,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0, skewX: 0 }, easing: 'easeInOutSine' },
        { time: 0.75, props: { scaleX: 1.00, scaleY: 1.02, y: -0.8, rotation: -0.2, skewX: -0.3 }, easing: 'easeInOutSine' },
        { time: 1.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0, skewX: 0 }, easing: 'easeInOutSine' },
      ]
    });

    // ── WALK: Bob + squash-stretch per step ─────────────────────────
    this.register('walk', {
      duration: 0.55,
      loop: true,
      blendTime: 0.12,
      keyframes: [
        { time: 0.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0 }, easing: 'easeInQuad' },
        // Step down — compress (squash) as weight lands
        { time: 0.15, props: { scaleX: 0.94, scaleY: 1.06, y: -2.5, rotation: -2.5 }, easing: 'easeOutBack' },
        // Push off — stretch upward
        { time: 0.3,  props: { scaleX: 1.02, scaleY: 0.98, y: -1.0, rotation: 0 }, easing: 'easeInOutQuad' },
        // Second step — compress again
        { time: 0.45, props: { scaleX: 0.94, scaleY: 1.06, y: -2.5, rotation: 2.5 }, easing: 'easeOutBack' },
        { time: 1.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0 }, easing: 'easeInQuad' },
      ]
    });

    // ── RUN: Exaggerated walk with more stretch ─────────────────────
    this.register('run', {
      duration: 0.35,
      loop: true,
      blendTime: 0.1,
      keyframes: [
        { time: 0.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0 }, easing: 'easeInQuad' },
        // Hard landing — deep squash
        { time: 0.18, props: { scaleX: 0.88, scaleY: 1.14, y: -4, rotation: -5 }, easing: 'easeOutBack' },
        // Launch — extreme stretch
        { time: 0.5,  props: { scaleX: 1.08, scaleY: 0.92, y: -6, rotation: 0 }, easing: 'easeOutQuad' },
        { time: 0.68, props: { scaleX: 0.88, scaleY: 1.14, y: -4, rotation: 5 }, easing: 'easeOutBack' },
        { time: 1.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0 }, easing: 'easeInQuad' },
      ]
    });

    // ── SIT: Lower down with anticipation ───────────────────────────
    this.register('sit', {
      duration: 0.8,
      loop: false,
      nextAnim: 'sit_loop',
      blendTime: 0.15,
      keyframes: [
        // Brief anticipation — slight rise before lowering
        { time: 0.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0 }, easing: 'easeOutQuad' },
        { time: 0.15, props: { scaleX: 1.02, scaleY: 0.98, y: -1, rotation: 0 }, easing: 'easeInQuad' },
        // Lower down — squash as bottom touches seat
        { time: 0.4,  props: { scaleX: 1.06, scaleY: 0.88, y: 10, rotation: 0 }, easing: 'easeOutBounce' },
        // Settle
        { time: 0.65, props: { scaleX: 1.03, scaleY: 0.90, y: 10, rotation: 0 }, easing: 'easeOutQuad' },
        { time: 1.0,  props: { scaleX: 1.04, scaleY: 0.89, y: 10, rotation: 0 }, easing: 'easeInOutQuad' },
      ]
    });

    // ── SIT_LOOP: Subtle breathing while sitting ────────────────────
    this.register('sit_loop', {
      duration: 2.0,
      loop: true,
      blendTime: 0.2,
      keyframes: [
        { time: 0.0, props: { scaleX: 1.04, scaleY: 0.89, y: 10, rotation: 0 }, easing: 'easeInOutSine' },
        { time: 0.5, props: { scaleX: 1.04, scaleY: 0.91, y: 9.5, rotation: 0.2 }, easing: 'easeInOutSine' },
        { time: 1.0, props: { scaleX: 1.04, scaleY: 0.89, y: 10, rotation: 0 }, easing: 'easeInOutSine' },
      ]
    });

    // ── SLEEP: Gentle swaying with slow breathing ───────────────────
    this.register('sleep', {
      duration: 3.0,
      loop: true,
      blendTime: 0.25,
      keyframes: [
        { time: 0.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 2, rotation: 0, skewX: 0 }, easing: 'easeInOutSine' },
        { time: 0.25, props: { scaleX: 1.01, scaleY: 0.98, y: 2.5, rotation: 1, skewX: 1 }, easing: 'easeInOutSine' },
        { time: 0.5,  props: { scaleX: 1.00, scaleY: 1.00, y: 2, rotation: 0, skewX: 0 }, easing: 'easeInOutSine' },
        { time: 0.75, props: { scaleX: 1.01, scaleY: 0.98, y: 2.5, rotation: -1, skewX: -1 }, easing: 'easeInOutSine' },
        { time: 1.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 2, rotation: 0, skewX: 0 }, easing: 'easeInOutSine' },
      ]
    });

    // ── KNOCKED: Impact + tumble + settle on ground ─────────────────
    this.register('knocked', {
      duration: 1.5,
      loop: false,
      nextAnim: 'knocked_loop',
      blendTime: 0.05,
      keyframes: [
        // Impact frame — deep squash on hit
        { time: 0.0,  props: { scaleX: 0.75, scaleY: 1.25, y: 0, rotation: 0 }, easing: 'easeOutElastic', trigger: 'impact' },
        // Tumble backward — stretch and rotate
        { time: 0.15, props: { scaleX: 1.10, scaleY: 0.90, y: -8, rotation: -45 }, easing: 'easeOutQuad' },
        { time: 0.35, props: { scaleX: 0.95, scaleY: 1.05, y: -3, rotation: -90 }, easing: 'easeInOutQuad' },
        // Hit ground — bounce
        { time: 0.55, props: { scaleX: 1.15, scaleY: 0.75, y: 4, rotation: -95 }, easing: 'easeOutBounce' },
        { time: 0.75, props: { scaleX: 0.95, scaleY: 1.05, y: 2, rotation: -90 }, easing: 'easeOutQuad' },
        // Settle flat
        { time: 1.0,  props: { scaleX: 1.20, scaleY: 0.60, y: 5, rotation: -90 }, easing: 'easeOutQuad' },
        { time: 1.0,  props: { scaleX: 1.20, scaleY: 0.60, y: 5, rotation: -90 }, easing: 'easeInOutQuad' },
      ]
    });

    // ── KNOCKED_LOOP: Dazed wobble while down ───────────────────────
    this.register('knocked_loop', {
      duration: 1.2,
      loop: true,
      blendTime: 0.2,
      keyframes: [
        { time: 0.0, props: { scaleX: 1.20, scaleY: 0.60, y: 5, rotation: -90, skewX: 0 }, easing: 'easeInOutSine' },
        { time: 0.5, props: { scaleX: 1.18, scaleY: 0.62, y: 5, rotation: -88, skewX: 2 }, easing: 'easeInOutSine' },
        { time: 1.0, props: { scaleX: 1.20, scaleY: 0.60, y: 5, rotation: -92, skewX: -2 }, easing: 'easeInOutSine' },
      ]
    });

    // ── RECOVER: Get up from knocked state ──────────────────────────
    this.register('recover', {
      duration: 0.8,
      loop: false,
      nextAnim: 'idle',
      blendTime: 0.15,
      keyframes: [
        { time: 0.0, props: { scaleX: 1.20, scaleY: 0.60, y: 5, rotation: -90 }, easing: 'easeOutBack' },
        { time: 0.3, props: { scaleX: 0.85, scaleY: 1.15, y: -6, rotation: -30 }, easing: 'easeOutBack' },
        { time: 0.5, props: { scaleX: 1.05, scaleY: 0.95, y: -2, rotation: 0 }, easing: 'easeOutQuad' },
        { time: 0.7, props: { scaleX: 0.98, scaleY: 1.02, y: 0, rotation: 0 }, easing: 'easeOutQuad' },
        { time: 1.0, props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0 }, easing: 'easeInOutQuad' },
      ]
    });

    // ── DANCE: Spin with bounce, scaleX flips ───────────────────────
    this.register('dance', {
      duration: 1.6,
      loop: true,
      blendTime: 0.15,
      keyframes: [
        { time: 0.0,  props: { scaleX: 1.0, scaleY: 1.0, y: 0, rotation: 0 }, easing: 'easeOutQuad' },
        { time: 0.12, props: { scaleX: -1.0, scaleY: 1.0, y: 0, rotation: 0 }, easing: 'easeInOutQuad' },
        { time: 0.25, props: { scaleX: -1.0, scaleY: 1.08, y: -6, rotation: 0 }, easing: 'easeOutQuad' },
        { time: 0.37, props: { scaleX: 1.0, scaleY: 1.0, y: 0, rotation: 0 }, easing: 'easeInOutQuad' },
        { time: 0.5,  props: { scaleX: 1.0, scaleY: 1.08, y: -6, rotation: 0 }, easing: 'easeOutQuad' },
        { time: 0.62, props: { scaleX: -1.0, scaleY: 1.0, y: 0, rotation: 0 }, easing: 'easeInOutQuad' },
        { time: 0.75, props: { scaleX: -1.0, scaleY: 1.08, y: -6, rotation: 0 }, easing: 'easeOutQuad' },
        { time: 0.87, props: { scaleX: 1.0, scaleY: 1.0, y: 0, rotation: 0 }, easing: 'easeInOutQuad' },
        { time: 1.0,  props: { scaleX: 1.0, scaleY: 1.08, y: -6, rotation: 0 }, easing: 'easeOutQuad' },
        // Full spin
        { time: 0.7,  props: { scaleX: 1.0, scaleY: 0.92, y: -3, rotation: 180 }, easing: 'easeInOutQuad' },
        { time: 1.0,  props: { scaleX: 1.0, scaleY: 1.0, y: 0, rotation: 360 }, easing: 'easeOutQuad' },
      ]
    });

    // ── EMOTE_WAVE: Arm raises and waves 3 times ────────────────────
    this.register('emote_wave', {
      duration: 1.8,
      loop: false,
      nextAnim: 'idle',
      blendTime: 0.1,
      keyframes: [
        // Anticipation — slight crouch
        { time: 0.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0, skewX: 0 }, easing: 'easeOutQuad' },
        { time: 0.12, props: { scaleX: 1.03, scaleY: 0.96, y: 1, rotation: 0, skewX: 0 }, easing: 'easeInQuad' },
        // Wave 1 — body sway right
        { time: 0.25, props: { scaleX: 0.97, scaleY: 1.02, y: -2, rotation: 5, skewX: 3 }, easing: 'easeInOutQuad', trigger: 'wave' },
        // Wave 2 — body sway left
        { time: 0.45, props: { scaleX: 0.97, scaleY: 1.02, y: -2, rotation: -5, skewX: -3 }, easing: 'easeInOutQuad' },
        // Wave 3 — body sway right
        { time: 0.65, props: { scaleX: 0.97, scaleY: 1.02, y: -2, rotation: 5, skewX: 3 }, easing: 'easeInOutQuad' },
        // Settle
        { time: 0.82, props: { scaleX: 1.01, scaleY: 0.99, y: 0, rotation: 0, skewX: 0 }, easing: 'easeOutQuad' },
        { time: 1.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0, skewX: 0 }, easing: 'easeInOutQuad' },
      ]
    });

    // ── EMOTE_UPPERCUT: Wind up → launch → impact flash → recovery ──
    this.register('emote_uppercut', {
      duration: 1.0,
      loop: false,
      nextAnim: 'idle',
      blendTime: 0.05,
      keyframes: [
        // Wind up (anticipation) — 0.0 to 0.3
        { time: 0.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0 }, easing: 'easeInQuad' },
        { time: 0.15, props: { scaleX: 1.08, scaleY: 0.82, y: 4, rotation: -10 }, easing: 'easeInBack' },
        { time: 0.30, props: { scaleX: 1.10, scaleY: 0.78, y: 6, rotation: -15 }, easing: 'easeInQuad' },
        // Launch (stretch) — explosive extension 0.3 to 0.5
        { time: 0.35, props: { scaleX: 0.82, scaleY: 1.22, y: -14, rotation: 5 }, easing: 'easeOutExpo', trigger: 'uppercut_launch' },
        { time: 0.50, props: { scaleX: 0.88, scaleY: 1.12, y: -8, rotation: 10 }, easing: 'easeOutQuad' },
        // Impact (flash frame) — 0.5 to 0.6
        { time: 0.55, props: { scaleX: 1.15, scaleY: 0.72, y: -2, rotation: 0 }, easing: 'easeOutElastic', trigger: 'uppercut_impact' },
        // Recovery — 0.6 to 1.0
        { time: 0.70, props: { scaleX: 0.95, scaleY: 1.05, y: -1, rotation: 0 }, easing: 'easeOutQuad' },
        { time: 0.85, props: { scaleX: 1.02, scaleY: 0.98, y: 0, rotation: 0 }, easing: 'easeInOutQuad' },
        { time: 1.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0 }, easing: 'easeInOutQuad' },
      ]
    });

    // ── EMOTE_FART: Crouch → release → wobble → relief ─────────────
    this.register('emote_fart', {
      duration: 1.6,
      loop: false,
      nextAnim: 'idle',
      blendTime: 0.1,
      keyframes: [
        // Crouch (anticipation) — 0.0 to 0.4
        { time: 0.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0, skewX: 0 }, easing: 'easeInQuad' },
        { time: 0.15, props: { scaleX: 1.12, scaleY: 0.76, y: 5, rotation: 0, skewX: 0 }, easing: 'easeInBack' },
        { time: 0.30, props: { scaleX: 1.15, scaleY: 0.70, y: 7, rotation: 0, skewX: 0 }, easing: 'easeInQuad' },
        // Release (explosive stretch) — 0.4 to 0.7
        { time: 0.35, props: { scaleX: 0.78, scaleY: 1.28, y: -10, rotation: 0, skewX: 0 }, easing: 'easeOutExpo', trigger: 'fart_release' },
        { time: 0.50, props: { scaleX: 0.85, scaleY: 1.15, y: -5, rotation: 0, skewX: 0 }, easing: 'easeOutQuad' },
        // Wobble — 0.7 to 1.2
        { time: 0.58, props: { scaleX: 1.06, scaleY: 0.88, y: 1, rotation: 3, skewX: 2 }, easing: 'easeInOutQuad' },
        { time: 0.66, props: { scaleX: 0.94, scaleY: 1.04, y: -1, rotation: -4, skewX: -3 }, easing: 'easeInOutElastic' },
        { time: 0.75, props: { scaleX: 1.03, scaleY: 0.95, y: 0, rotation: 2, skewX: 1 }, easing: 'easeInOutQuad' },
        { time: 0.83, props: { scaleX: 0.98, scaleY: 1.02, y: 0, rotation: -1, skewX: -1 }, easing: 'easeInOutElastic' },
        // Relief smile settle — 1.2 to 1.6
        { time: 0.92, props: { scaleX: 1.01, scaleY: 0.99, y: 0, rotation: 0, skewX: 0 }, easing: 'easeOutQuad' },
        { time: 1.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0, skewX: 0 }, easing: 'easeInOutQuad' },
      ]
    });

    // ── EMOTE_LAUGH: Bouncy laughter with tears ─────────────────────
    this.register('emote_laugh', {
      duration: 1.2,
      loop: true,
      nextAnim: 'idle',
      blendTime: 0.1,
      keyframes: [
        { time: 0.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0 }, easing: 'easeOutQuad' },
        { time: 0.15, props: { scaleX: 0.95, scaleY: 1.05, y: -4, rotation: -3 }, easing: 'easeOutBack' },
        { time: 0.30, props: { scaleX: 1.02, scaleY: 0.98, y: 0, rotation: 0 }, easing: 'easeInQuad' },
        { time: 0.45, props: { scaleX: 0.95, scaleY: 1.05, y: -4, rotation: 3 }, easing: 'easeOutBack' },
        { time: 0.60, props: { scaleX: 1.02, scaleY: 0.98, y: 0, rotation: 0 }, easing: 'easeInQuad' },
        { time: 0.75, props: { scaleX: 0.95, scaleY: 1.05, y: -4, rotation: -3 }, easing: 'easeOutBack' },
        { time: 0.90, props: { scaleX: 1.02, scaleY: 0.98, y: 0, rotation: 0 }, easing: 'easeInQuad' },
        { time: 1.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0 }, easing: 'easeInOutQuad' },
      ]
    });

    // ── EMOTE_CRY: Shake with sobbing motion ────────────────────────
    this.register('emote_cry', {
      duration: 1.0,
      loop: true,
      nextAnim: 'idle',
      blendTime: 0.1,
      keyframes: [
        { time: 0.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0 }, easing: 'easeInOutQuad' },
        { time: 0.10, props: { scaleX: 1.02, scaleY: 0.95, y: 1, rotation: 2 }, easing: 'easeInOutQuad' },
        { time: 0.20, props: { scaleX: 0.98, scaleY: 1.02, y: 0, rotation: -2 }, easing: 'easeInOutQuad' },
        { time: 0.30, props: { scaleX: 1.02, scaleY: 0.95, y: 1, rotation: 3 }, easing: 'easeInOutQuad' },
        { time: 0.40, props: { scaleX: 0.98, scaleY: 1.02, y: 0, rotation: -1 }, easing: 'easeInOutQuad' },
        { time: 0.50, props: { scaleX: 1.01, scaleY: 0.97, y: 2, rotation: 0 }, easing: 'easeInOutSine' },
        { time: 0.70, props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0 }, easing: 'easeInOutSine' },
        { time: 1.0,  props: { scaleX: 1.00, scaleY: 1.00, y: 0, rotation: 0 }, easing: 'easeInOutQuad' },
      ]
    });

    // ── TRANSITION_IN: Portal entry ─────────────────────────────────
    this.register('transition_in', {
      duration: 0.6,
      loop: false,
      nextAnim: 'idle',
      blendTime: 0.0,
      keyframes: [
        { time: 0.0,  props: { scaleX: 0.01, scaleY: 1.5, y: -20, rotation: 0, opacity: 0 }, easing: 'easeOutQuad' },
        { time: 0.15, props: { scaleX: 0.5, scaleY: 1.2, y: -10, rotation: 0, opacity: 0.5 }, easing: 'easeOutQuad' },
        { time: 0.4,  props: { scaleX: 1.1, scaleY: 0.85, y: 2, rotation: 0, opacity: 1 }, easing: 'easeOutBack' },
        { time: 0.6,  props: { scaleX: 1.0, scaleY: 1.0, y: 0, rotation: 0, opacity: 1 }, easing: 'easeInOutQuad' },
      ]
    });

    // ── TRANSITION_OUT: Portal exit ─────────────────────────────────
    this.register('transition_out', {
      duration: 0.5,
      loop: false,
      blendTime: 0.0,
      keyframes: [
        { time: 0.0,  props: { scaleX: 1.0, scaleY: 1.0, y: 0, rotation: 0, opacity: 1 }, easing: 'easeInQuad' },
        { time: 0.15, props: { scaleX: 1.15, scaleY: 0.75, y: 3, rotation: 0, opacity: 1 }, easing: 'easeInQuad' },
        { time: 0.30, props: { scaleX: 0.3, scaleY: 1.4, y: -15, rotation: 0, opacity: 0.4 }, easing: 'easeInQuad' },
        { time: 0.5,  props: { scaleX: 0.01, scaleY: 2.0, y: -30, rotation: 0, opacity: 0 }, easing: 'easeInExpo', trigger: 'exit_complete' },
      ]
    });
  }

  /* ================================================================
     REGISTRATION API
     ================================================================ */

  /**
   * Register a new animation track.
   * @param {string} id
   * @param {AnimationTrack} track
   */
  register(id, track) {
    // Normalize keyframe times to 0..1
    const maxTime = track.keyframes[track.keyframes.length - 1]?.time ?? 1;
    const normalizedKeyframes = track.keyframes.map(kf => ({
      ...kf,
      time: maxTime > 0 ? kf.time / maxTime : 0
    }));

    this.animations.set(id, {
      id,
      duration: track.duration,
      loop: track.loop ?? false,
      pingPong: track.pingPong ?? false,
      blendTime: track.blendTime ?? 0.1,
      nextAnim: track.nextAnim || null,
      keyframes: normalizedKeyframes
    });
  }

  /**
   * Create a one-off animation from inline keyframes.
   * @param {string} id
   * @param {Keyframe[]} keyframes
   * @param {number} [duration=1.0]
   * @param {boolean} [loop=false]
   * @returns {AnimationTrack}
   */
  createAnimation(id, keyframes, duration = 1.0, loop = false) {
    const track = { id, duration, loop, keyframes, blendTime: 0.1 };
    this.register(id, track);
    return this.animations.get(id);
  }

  /* ================================================================
     PLAYBACK CONTROL
     ================================================================ */

  /**
   * Start playing an animation for an entity.
   * @param {string} entityId
   * @param {string} animId
   * @param {boolean} [reset=false] — If true, restart from time 0 even if same anim
   */
  play(entityId, animId, reset = false) {
    const track = this.animations.get(animId);
    if (!track) {
      console.warn(`AnimationEngine: unknown animation "${animId}"`);
      return;
    }

    const existing = this.states.get(entityId);
    const wasFinished = existing?.finished ?? true;

    // If same anim and not reset, do nothing
    if (existing && existing.trackId === animId && !reset && !wasFinished) {
      return;
    }

    // Capture previous values for blending
    const prevValues = existing && !existing.finished
      ? { ...existing.currentValues }
      : null;

    /** @type {AnimationState} */
    const state = {
      trackId: animId,
      time: 0,
      direction: 1,
      loopsDone: 0,
      finished: false,
      currentValues: { ...DEFAULT_TRANSFORM },
      blendFrom: prevValues,
      blendTimer: track.blendTime,
      blendDuration: track.blendTime,
    };

    this.states.set(entityId, state);
  }

  /**
   * Stop an entity's animation (returns to default pose).
   * @param {string} entityId
   */
  stop(entityId) {
    this.states.delete(entityId);
  }

  /**
   * Get the currently playing animation id for an entity.
   * @param {string} entityId
   * @returns {string|null}
   */
  getCurrentAnim(entityId) {
    return this.states.get(entityId)?.trackId ?? null;
  }

  /**
   * Check if an entity has a finished (non-looping) animation.
   * @param {string} entityId
   * @returns {boolean}
   */
  isFinished(entityId) {
    return this.states.get(entityId)?.finished ?? true;
  }

  /* ================================================================
     UPDATE LOOP  (call once per frame per entity)
     ================================================================ */

  /**
   * Advance all animation states by delta time.
   * Call this in the main game loop.
   * @param {number} dt — Delta time in seconds
   */
  update(dt) {
    for (const [entityId, state] of this.states) {
      if (state.finished) continue;

      const track = this.animations.get(state.trackId);
      if (!track) continue;

      // Advance time
      state.time += dt * state.direction;

      // Handle loop / ping-pong / finish
      if (state.time >= track.duration) {
        if (track.loop) {
          if (track.pingPong) {
            state.direction = -1;
            state.time = track.duration;
          } else {
            state.time = state.time % track.duration;
            state.loopsDone++;
          }
        } else {
          state.time = track.duration;
          state.finished = true;

          // Auto-transition to next animation
          if (track.nextAnim) {
            this.play(entityId, track.nextAnim);
            continue;
          }
        }
      } else if (state.time < 0 && track.pingPong) {
        state.direction = 1;
        state.time = 0;
        state.loopsDone++;
      }

      // Blend timer countdown
      if (state.blendTimer > 0) {
        state.blendTimer = Math.max(0, state.blendTimer - dt);
      }

      // Evaluate keyframes
      const tNorm = track.duration > 0 ? state.time / track.duration : 0;
      state.currentValues = this._evaluate(track, tNorm, state);

      // Fire triggers
      this._checkTriggers(track, tNorm, entityId);
    }
  }

  /**
   * Evaluate keyframe interpolation at normalized time.
   * @private
   */
  _evaluate(track, tNorm, state) {
    const kfs = track.keyframes;
    if (kfs.length === 0) return { ...DEFAULT_TRANSFORM };
    if (kfs.length === 1) return { ...DEFAULT_TRANSFORM, ...kfs[0].props };

    // Find surrounding keyframes
    let prev = kfs[0];
    let next = kfs[kfs.length - 1];

    for (let i = 0; i < kfs.length - 1; i++) {
      if (tNorm >= kfs[i].time && tNorm <= kfs[i + 1].time) {
        prev = kfs[i];
        next = kfs[i + 1];
        break;
      }
    }

    // Handle edge case: past last keyframe
    if (tNorm >= kfs[kfs.length - 1].time) {
      const result = { ...DEFAULT_TRANSFORM, ...kfs[kfs.length - 1].props };
      return this._applyBlend(result, state);
    }

    // Local interpolation factor between these two keyframes
    const segmentDuration = next.time - prev.time;
    const localT = segmentDuration > 0 ? (tNorm - prev.time) / segmentDuration : 0;

    // Get easing for this segment (from the NEXT keyframe's easing)
    const easingName = next.easing || 'linear';
    const easedT = this._ease(localT, easingName);

    // Interpolate all properties
    const result = { ...DEFAULT_TRANSFORM };
    const allProps = new Set([
      ...Object.keys(prev.props || {}),
      ...Object.keys(next.props || {})
    ]);

    for (const prop of allProps) {
      const a = prev.props?.[prop] ?? DEFAULT_TRANSFORM[prop] ?? 0;
      const b = next.props?.[prop] ?? DEFAULT_TRANSFORM[prop] ?? 0;
      result[prop] = this._lerp(a, b, easedT);
    }

    return this._applyBlend(result, state);
  }

  /**
   * Apply cross-animation blending.
   * @private
   */
  _applyBlend(values, state) {
    if (!state.blendFrom || state.blendTimer <= 0 || state.blendDuration <= 0) {
      return values;
    }

    const blendRatio = state.blendTimer / state.blendDuration;
    const result = { ...values };

    for (const key of Object.keys(values)) {
      const fromVal = state.blendFrom[key] ?? DEFAULT_TRANSFORM[key] ?? 0;
      result[key] = this._lerp(values[key], fromVal, blendRatio);
    }

    return result;
  }

  /**
   * Check and fire keyframe triggers.
   * @private
   */
  _checkTriggers(track, tNorm, entityId) {
    // Simple trigger: if we crossed a trigger keyframe this frame
    // (In production, track which triggers have been fired this cycle)
    for (const kf of track.keyframes) {
      if (kf.trigger && Math.abs(tNorm - kf.time) < 0.02) {
        for (const cb of this.triggerListeners) {
          cb({ entityId, trigger: kf.trigger, animId: track.id, time: tNorm });
        }
      }
    }
  }

  /* ================================================================
     QUERY
     ================================================================ */

  /**
   * Get the current interpolated transform values for an entity.
   * @param {string} entityId
   * @returns {Transform}
   */
  getTransform(entityId) {
    const state = this.states.get(entityId);
    if (!state) return { ...DEFAULT_TRANSFORM };
    return { ...DEFAULT_TRANSFORM, ...state.currentValues };
  }

  /**
   * Get the current vertical bob offset (convenience for renderer).
   * @param {string} entityId
   * @returns {number}
   */
  getOffsetY(entityId) {
    return this.getTransform(entityId).y || 0;
  }

  /**
   * Get the current rotation in degrees.
   * @param {string} entityId
   * @returns {number}
   */
  getRotation(entityId) {
    return this.getTransform(entityId).rotation || 0;
  }

  /**
   * Subscribe to animation trigger events.
   * @param {Function} callback — ({entityId, trigger, animId, time}) => void
   * @returns {Function} Unsubscribe function
   */
  onTrigger(callback) {
    this.triggerListeners.add(callback);
    return () => this.triggerListeners.delete(callback);
  }

  /* ================================================================
     LOW-LEVEL MATH
     ================================================================ */

  /**
   * Apply an easing function to a normalized value.
   * @param {number} t — 0..1
   * @param {string} easingName
   * @returns {number}
   */
  ease(t, easingName) {
    return this._ease(t, easingName);
  }

  /** @private */
  _ease(t, easingName) {
    const fn = this.easings[easingName];
    if (!fn) {
      console.warn(`AnimationEngine: unknown easing "${easingName}", using linear`);
      return t;
    }
    // Clamp input
    const clamped = Math.max(0, Math.min(1, t));
    return fn(clamped);
  }

  /**
   * Linear interpolation between two values.
   * @param {number} a
   * @param {number} b
   * @param {number} t — 0..1
   * @returns {number}
   */
  lerp(a, b, t) {
    return this._lerp(a, b, t);
  }

  /** @private */
  _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Smooth interpolation with optional easing.
   * @param {number} a
   * @param {number} b
   * @param {number} t — 0..1
   * @param {string} [easing='linear']
   * @returns {number}
   */
  interpolate(a, b, t, easing = 'linear') {
    const easedT = this._ease(t, easing);
    return this._lerp(a, b, easedT);
  }

  /* ================================================================
     SHORTCUTS  (convenience getters for built-in anims)
     ================================================================ */

  /** @returns {AnimationTrack} */
  getIdleAnimation() { return this.animations.get('idle'); }
  /** @returns {AnimationTrack} */
  getWalkAnimation() { return this.animations.get('walk'); }
  /** @returns {AnimationTrack} */
  getRunAnimation() { return this.animations.get('run'); }
  /** @returns {AnimationTrack} */
  getSitAnimation() { return this.animations.get('sit'); }
  /** @returns {AnimationTrack} */
  getSleepAnimation() { return this.animations.get('sleep'); }
  /** @returns {AnimationTrack} */
  getKnockedAnimation() { return this.animations.get('knocked'); }
  /** @returns {AnimationTrack} */
  getDanceAnimation() { return this.animations.get('dance'); }

  /**
   * Get an emote animation by name.
   * @param {string} emote — 'wave' | 'uppercut' | 'fart' | 'laugh' | 'cry'
   * @returns {AnimationTrack}
   */
  getEmoteAnimation(emote) {
    const map = {
      wave: 'emote_wave',
      uppercut: 'emote_uppercut',
      fart: 'emote_fart',
      laugh: 'emote_laugh',
      cry: 'emote_cry',
      dance: 'dance',
    };
    return this.animations.get(map[emote]) || this.getIdleAnimation();
  }

  /* ================================================================
     BATCH OPERATIONS
     ================================================================ */

  /** Remove all animation states (scene transition). */
  clearAll() {
    this.states.clear();
  }

  /**
   * Get a list of all registered animation IDs.
   * @returns {string[]}
   */
  listAnimations() {
    return Array.from(this.animations.keys());
  }

  /**
   * Check how many entities are currently animated.
   * @returns {number}
   */
  getActiveCount() {
    let count = 0;
    for (const s of this.states.values()) {
      if (!s.finished) count++;
    }
    return count;
  }
}
