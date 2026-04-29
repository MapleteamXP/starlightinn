/**
 * @file Audio.js
 * @description Web Audio API wrapper with procedural sound synthesis.
 * Supports ambient drones, one-shot SFX, music loops, and volume mixing.
 */

/**
 * Web Audio API wrapper for procedural audio in the game.
 * @export {Audio}
 */
export class Audio {
  constructor() {
    /** @type {AudioContext|null} The Web Audio context. */
    this.ctx = null;
    /** @type {GainNode|null} Master gain. */
    this.masterGain = null;
    /** @type {GainNode|null} Music bus gain. */
    this.musicGain = null;
    /** @type {GainNode|null} SFX bus gain. */
    this.sfxGain = null;
    /** @type {GainNode|null} Ambient bus gain. */
    this.ambientGain = null;

    /** @type {boolean} Global audio enabled flag. */
    this.enabled = true;
    /** @type {boolean} Whether music is currently playing. */
    this.musicPlaying = false;

    // Active nodes for cleanup
    /** @type {Map<string, AudioNode[]>} */
    this.activeNodes = new Map();
    /** @type {OscillatorNode|null} Current ambient drone oscillator. */
    this.ambientOsc = null;
    /** @type {GainNode|null} Current ambient gain envelope. */
    this.ambientEnv = null;

    /** @type {number} Master volume 0..1. */
    this._masterVol = 0.8;
    /** @type {number} Music volume 0..1. */
    this._musicVol = 0.5;
    /** @type {number} SFX volume 0..1. */
    this._sfxVol = 0.7;
    /** @type {number} Ambient volume 0..1. */
    this._ambientVol = 0.4;

    /** @type {boolean} Whether the context was resumed after user interaction. */
    this._contextStarted = false;
  }

  /**
   * Initialize the Web Audio graph.
   */
  init() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      console.warn('[Audio] Web Audio API not supported.');
      return;
    }

    this.ctx = new AudioContextCtor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._masterVol;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this._musicVol;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this._sfxVol;
    this.sfxGain.connect(this.masterGain);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = this._ambientVol;
    this.ambientGain.connect(this.masterGain);

    console.log('[Audio] Context initialized. Sample rate:', this.ctx.sampleRate);
  }

  /**
   * Ensure the audio context is running (required after user gesture).
   */
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this._contextStarted = true;
      });
    }
  }

  /**
   * Play or transition the ambient drone for an area type.
   * @param {string} areaType - Area identifier.
   */
  playAmbient(areaType) {
    if (!this.ctx || !this.enabled) return;
    this.resume();

    // Fade out existing ambient
    if (this.ambientEnv) {
      this.ambientEnv.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
      if (this.ambientOsc) {
        this.ambientOsc.stop(this.ctx.currentTime + 1.5);
      }
    }

    // Area-specific ambient parameters
    const presets = {
      hub:      { base: 110,  harmonics: [1, 1.5, 2],      gain: 0.15, type: 'sine' },
      garden:   { base: 196,  harmonics: [1, 1.25, 1.5],   gain: 0.12, type: 'triangle' },
      library:  { base: 146.83,harmonics: [1, 2, 3],        gain: 0.1,  type: 'sine' },
      kitchen:  { base: 261.63,harmonics: [1, 1.5],         gain: 0.13, type: 'sine' },
      rooftop:  { base: 82.41, harmonics: [1, 2, 2.5],      gain: 0.1,  type: 'sine' },
      basement: { base: 65.41, harmonics: [1, 1.5, 2.25],    gain: 0.08, type: 'triangle' }
    };
    const preset = presets[areaType] || presets.hub;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, this.ctx.currentTime);
    env.gain.setTargetAtTime(preset.gain, this.ctx.currentTime, 1.0);
    env.connect(this.ambientGain);
    this.ambientEnv = env;

    // Create a chord stack
    const nodes = [];
    for (const h of preset.harmonics) {
      const osc = this.ctx.createOscillator();
      osc.type = preset.type;
      osc.frequency.value = preset.base * h;

      // Slight detune for warmth
      osc.detune.value = (Math.random() - 0.5) * 8;

      const pan = this.ctx.createStereoPanner();
      pan.pan.value = (Math.random() - 0.5) * 0.6;

      osc.connect(pan);
      pan.connect(env);
      osc.start();
      nodes.push(osc, pan);
    }

    this.activeNodes.set('ambient', nodes);
  }

  /**
   * Stop the ambient drone.
   */
  stopAmbient() {
    if (this.ambientEnv) {
      this.ambientEnv.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    }
    const nodes = this.activeNodes.get('ambient');
    if (nodes) {
      nodes.forEach(n => { try { n.stop && n.stop(this.ctx.currentTime + 1); } catch (e) {} });
    }
  }

  /**
   * Play a one-shot sound effect by name.
   * @param {string} name - SFX name: click, chat, trade, coin, chest, uppercut, wave, dance, sit, sleep, laugh, cry.
   */
  playSFX(name) {
    if (!this.ctx || !this.enabled) return;
    this.resume();

    switch (name) {
      case 'coin':
        this.generateCoinSound();
        break;
      case 'chat':
        this.generateChatSound();
        break;
      case 'chest':
        this.generateChestSound();
        break;
      case 'uppercut':
        this.generateUppercutSound();
        break;
      case 'click':
        this.generateTone(880, 0.06, 'sine', 0.15);
        break;
      case 'trade':
        this.generateTone(523, 0.15, 'triangle', 0.2);
        setTimeout(() => this.generateTone(659, 0.15, 'triangle', 0.2), 120);
        break;
      case 'wave':
      case 'dance':
      case 'sit':
      case 'sleep':
      case 'laugh':
      case 'cry':
        this.generateTone(440, 0.08, 'sine', 0.12);
        break;
      default:
        this.generateTone(440, 0.1, 'sine', 0.1);
    }
  }

  /**
   * Play a simple procedural music phrase for an area.
   * @param {string} areaType
   */
  playMusic(areaType) {
    if (!this.ctx || !this.enabled || !this._musicVol) return;
    this.resume();

    // Simple pentatonic arpeggio loop
    const scales = {
      hub:      [261.63, 293.66, 329.63, 392.00, 440.00],
      garden:   [196.00, 220.00, 261.63, 293.66, 329.63],
      library:  [329.63, 392.00, 440.00, 523.25, 587.33],
      kitchen:  [293.66, 329.63, 392.00, 440.00, 523.25],
      rooftop:  [220.00, 261.63, 293.66, 329.63, 392.00],
      basement: [174.61, 196.00, 220.00, 261.63, 293.66]
    };
    const scale = scales[areaType] || scales.hub;

    const playNote = (idx, time) => {
      const freq = scale[idx % scale.length];
      const dur = 0.35;
      this.generateTone(freq, dur, 'sine', 0.08, time);
    };

    // Play a short ascending-descending phrase
    const now = this.ctx.currentTime;
    playNote(0, now);
    playNote(1, now + 0.4);
    playNote(2, now + 0.8);
    playNote(3, now + 1.2);
    playNote(4, now + 1.6);
    playNote(3, now + 2.0);
    playNote(2, now + 2.4);
    playNote(1, now + 2.8);
  }

  // ── Procedural Sound Generators ─────────────────────────────────────────

  /**
   * Generate a pure tone with an ADSR-ish envelope.
   * @param {number} freq - Frequency in Hz.
   * @param {number} duration - Duration in seconds.
   * @param {string} [type='sine'] - Oscillator type.
   * @param {number} [peakGain=0.2] - Peak gain (0..1).
   * @param {number} [when] - When to schedule (AudioContext time).
   */
  generateTone(freq, duration, type = 'sine', peakGain = 0.2, when) {
    if (!this.ctx) return;
    const t = when !== undefined ? when : this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const pan = this.ctx.createStereoPanner();

    osc.type = type;
    osc.frequency.value = freq;
    pan.pan.value = (Math.random() - 0.5) * 0.4;

    // ADSR-ish envelope
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(peakGain * 0.3, t + duration * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(pan);
    pan.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + duration + 0.05);

    // Track for cleanup
    const list = this.activeNodes.get('sfx') || [];
    list.push(osc, gain, pan);
    this.activeNodes.set('sfx', list);

    // Auto-cleanup
    setTimeout(() => {
      try { osc.disconnect(); gain.disconnect(); pan.disconnect(); } catch (e) {}
    }, (t + duration - this.ctx.currentTime) * 1000 + 200);
  }

  /**
   * Generate a high-pitched coin chime.
   */
  generateCoinSound() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.generateTone(1567.98, 0.12, 'sine', 0.18, now);
    this.generateTone(1975.53, 0.12, 'sine', 0.14, now + 0.06);
    this.generateTone(2349.32, 0.18, 'sine', 0.1, now + 0.12);
  }

  /**
   * Generate a soft chat notification blip.
   */
  generateChatSound() {
    if (!this.ctx) return;
    this.generateTone(880, 0.05, 'sine', 0.08);
  }

  /**
   * Generate a sparkle arpeggio for chest opening.
   */
  generateChestSound() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
      this.generateTone(freq, 0.3, 'sine', 0.1 - i * 0.015, now + i * 0.08);
    });
  }

  /**
   * Generate a comical "boing" uppercut sound.
   */
  generateUppercutSound() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.35);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  // ── Volume Control ──────────────────────────────────────────────────────

  /**
   * Set master volume.
   * @param {number} v - 0..1
   */
  setMasterVolume(v) {
    this._masterVol = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this._masterVol, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Set music bus volume.
   * @param {number} v - 0..1
   */
  setMusicVolume(v) {
    this._musicVol = Math.max(0, Math.min(1, v));
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this._musicVol, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Set SFX bus volume.
   * @param {number} v - 0..1
   */
  setSFXVolume(v) {
    this._sfxVol = Math.max(0, Math.min(1, v));
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(this._sfxVol, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Set ambient bus volume.
   * @param {number} v - 0..1
   */
  setAmbientVolume(v) {
    this._ambientVol = Math.max(0, Math.min(1, v));
    if (this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(this._ambientVol, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Mute all audio.
   * @param {boolean} muted
   */
  setMuted(muted) {
    this.enabled = !muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this._masterVol, this.ctx.currentTime, 0.2);
    }
  }

  /**
   * Toggle mute state.
   * @returns {boolean} New muted state.
   */
  toggleMute() {
    const muted = this.enabled;
    this.setMuted(muted);
    return muted;
  }

  // ── Utility ───────────────────────────────────────────────────────────

  /**
   * Get current context state.
   * @returns {string|null}
   */
  getState() {
    return this.ctx ? this.ctx.state : null;
  }

  /**
   * Stop and disconnect all active nodes.
   */
  stopAll() {
    this.activeNodes.forEach((nodes, key) => {
      nodes.forEach(n => {
        try {
          if (n.stop) n.stop();
          n.disconnect();
        } catch (e) {}
      });
    });
    this.activeNodes.clear();
    this.ambientOsc = null;
    this.ambientEnv = null;
  }

  /**
   * Clean shutdown of the audio context.
   */
  destroy() {
    this.stopAll();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.ambientGain = null;
  }
}
