/**
 * @fileoverview Starlight Inn v8.0 — SoundManager
 * Procedural sound effect system using the Web Audio API.
 * Synthesizes 50+ sounds in real-time using OscillatorNode, GainNode,
 * BiquadFilterNode, and custom DSP routines. Zero external audio files.
 *
 * @author Starlight Inn Audio Team
 * @version 8.0.0
 * @license MIT
 */

/**
 * Sound categories used for mixing and organisation.
 * @readonly
 * @enum {string}
 */
const SOUND_CATEGORY = {
  UI: 'ui',
  MOVEMENT: 'movement',
  INTERACTION: 'interaction',
  SOCIAL: 'social',
  EMOTE: 'emote',
  MUSIC: 'music',
};

/**
 * Utility helpers for DSP and scheduling.
 * @namespace
 */
const AudioUtils = {
  /**
   * Convert a semitone offset to a frequency ratio.
   * @param {number} semitones
   * @returns {number}
   */
  semitoneRatio(semitones) {
    return 2 ** (semitones / 12);
  },

  /**
   * Create a noise buffer of a given length and colour.
   * @param {AudioContext} ctx
   * @param {number} durationSeconds
   * @param {'white'|'pink'|'brown'} colour
   * @returns {AudioBuffer}
   */
  createNoiseBuffer(ctx, durationSeconds, colour = 'white') {
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.ceil(sampleRate * durationSeconds);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    if (colour === 'white') {
      for (let i = 0; i < frameCount; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (colour === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < frameCount; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else if (colour === 'brown') {
      let lastOut = 0;
      for (let i = 0; i < frameCount; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      }
    }

    return buffer;
  },

  /**
   * Exponential frequency ramp on an AudioParam.
   * @param {AudioParam} param
   * @param {number} fromFreq
   * @param {number} toFreq
   * @param {number} startTime
   * @param {number} duration
   */
  rampFreq(param, fromFreq, toFreq, startTime, duration) {
    param.setValueAtTime(fromFreq, startTime);
    param.exponentialRampToValueAtTime(Math.max(toFreq, 0.01), startTime + duration);
  },

  /**
   * Apply an ADSR envelope to a gain param.
   * @param {AudioParam} param
   * @param {number} startTime
   * @param {number} attack
   * @param {number} decay
   * @param {number} sustain
   * @param {number} release
   * @param {number} peak
   */
  adsr(param, startTime, attack, decay, sustain, release, peak = 1) {
    param.setValueAtTime(0, startTime);
    param.linearRampToValueAtTime(peak, startTime + attack);
    param.exponentialRampToValueAtTime(sustain * peak, startTime + attack + decay);
    param.setValueAtTime(sustain * peak, startTime + attack + decay + release);
    param.exponentialRampToValueAtTime(0.001, startTime + attack + decay + release + release);
  },
};

/**
 * Manages all real-time synthesized sound effects for Starlight Inn.
 * Each sound is a pure Web-Audio-API function — no external samples.
 */
class SoundManager {
  /** Maximum concurrent voices to avoid audio glitching. */
  static MAX_VOICES = 32;

  /** Default master volume (0–1). */
  static DEFAULT_MASTER = 0.75;

  /** Category gain defaults. */
  static DEFAULT_GAINS = {
    [SOUND_CATEGORY.UI]: 0.9,
    [SOUND_CATEGORY.MOVEMENT]: 0.7,
    [SOUND_CATEGORY.INTERACTION]: 0.8,
    [SOUND_CATEGORY.SOCIAL]: 0.8,
    [SOUND_CATEGORY.EMOTE]: 0.8,
    [SOUND_CATEGORY.MUSIC]: 0.6,
  };

  /**
   * @param {Object} [options]
   * @param {number} [options.masterVolume] 0–1
   * @param {Object<string,number>} [options.categoryVolumes] Map of category → 0–1
   */
  constructor(options = {}) {
    /** @private @type {AudioContext|null} */
    this._ctx = null;

    /** @private @type {boolean} */
    this._masterMuted = false;

    /** @private @type {number} */
    this._masterVolume = options.masterVolume ?? SoundManager.DEFAULT_MASTER;

    /** @private @type {Map<string,GainNode>} */
    this._categoryGains = new Map();

    /** @private @type {GainNode|null} */
    this._masterGain = null;

    /** @private @type {Set<AudioScheduledSourceNode>} */
    this._activeVoices = new Set();

    /** @private @type {number} */
    this._voiceCount = 0;

    /** @private @type {boolean} */
    this._initialised = false;

    /** @private @type {Object<string,number>} */
    this._categoryVolumes = { ...SoundManager.DEFAULT_GAINS };
    if (options.categoryVolumes) {
      Object.assign(this._categoryVolumes, options.categoryVolumes);
    }

    // Pre-bind methods for event listeners
    this._resumeOnInteraction = this._resumeOnInteraction.bind(this);

    this._buildSoundRegistry();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Lifecycle
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Initialise (or re-initialise) the AudioContext.
   * Must be called after a user gesture.
   * @returns {Promise<AudioContext>}
   */
  async init() {
    if (this._initialised && this._ctx && this._ctx.state !== 'closed') {
      if (this._ctx.state === 'suspended') await this._ctx.resume();
      return this._ctx;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this._ctx = new AudioContextClass({
      latencyHint: 'interactive',
      sampleRate: 48000,
    });

    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._masterMuted ? 0 : this._masterVolume;
    this._masterGain.connect(this._ctx.destination);

    // Per-category gain nodes for mixing
    Object.values(SOUND_CATEGORY).forEach((cat) => {
      const g = this._ctx.createGain();
      g.gain.value = this._categoryVolumes[cat] ?? 1;
      g.connect(this._masterGain);
      this._categoryGains.set(cat, g);
    });

    this._initialised = true;

    // Auto-resume if the browser suspends us
    document.addEventListener('click', this._resumeOnInteraction, { once: true });
    document.addEventListener('keydown', this._resumeOnInteraction, { once: true });
    document.addEventListener('touchstart', this._resumeOnInteraction, { once: true });

    return this._ctx;
  }

  /** @private */
  async _resumeOnInteraction() {
    if (this._ctx && this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }
  }

  /** Gracefully shut down the audio context. */
  dispose() {
    this.stopAll();
    document.removeEventListener('click', this._resumeOnInteraction);
    document.removeEventListener('keydown', this._resumeOnInteraction);
    document.removeEventListener('touchstart', this._resumeOnInteraction);
    if (this._ctx && this._ctx.state !== 'closed') {
      this._ctx.close();
    }
    this._ctx = null;
    this._initialised = false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Playback primitives
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Ensure the audio context is running before scheduling.
   * @private
   * @returns {AudioContext}
   */
  _ensureContext() {
    if (!this._ctx) throw new Error('SoundManager not initialised. Call init() first.');
    return this._ctx;
  }

  /**
   * Schedule an oscillator with envelope and optional filter.
   * @private
   * @param {Object} spec
   * @param {SOUND_CATEGORY} spec.category
   * @param {string} spec.type          Oscillator type
   * @param {number} spec.freq          Start frequency (Hz)
   * @param {number} [spec.freqEnd]     End frequency for sweeps
   * @param {number} spec.duration      Total duration (seconds)
   * @param {number} [spec.attack=0.01] Attack time
   * @param {number} [spec.decay]       Decay time
   * @param {number} [spec.sustain]     Sustain level (0–1)
   * @param {number} [spec.release]     Release time
   * @param {number} [spec.peak=1]      Peak gain
   * @param {number} [spec.pan=0]       Stereo pan (-1 to 1)
   * @param {number} [spec.detune=0]    Detune (cents)
   * @param {string} [spec.filterType]  Biquad filter type
   * @param {number} [spec.filterFreq]  Filter frequency
   * @param {number} [spec.filterQ]   Filter Q
   * @param {number} [spec.delay=0]     Schedule delay (seconds)
   * @returns {OscillatorNode}
   */
  _playTone(spec) {
    const ctx = this._ensureContext();
    if (this._voiceCount >= SoundManager.MAX_VOICES) return null;

    const {
      category, type, freq, freqEnd,
      duration, attack = 0.01, decay = 0,
      sustain = 0, release = 0.05,
      peak = 1, pan = 0, detune = 0,
      filterType, filterFreq, filterQ,
      delay = 0,
    } = spec;

    const now = ctx.currentTime + delay;
    const endTime = now + attack + decay + duration + release;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 0.01), endTime - release);
    }
    if (detune) osc.detune.value = detune;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + attack);
    if (decay > 0) {
      gain.gain.exponentialRampToValueAtTime(Math.max(sustain * peak, 0.001), now + attack + decay);
      if (release > 0) {
        gain.gain.setValueAtTime(Math.max(sustain * peak, 0.001), endTime - release);
        gain.gain.exponentialRampToValueAtTime(0.001, endTime);
      }
    } else {
      gain.gain.exponentialRampToValueAtTime(0.001, endTime);
    }

    let chainTail = osc;

    if (filterType && filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = filterFreq;
      if (filterQ) filter.Q.value = filterQ;
      osc.connect(filter);
      chainTail = filter;
    }

    if (pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      chainTail.connect(panner);
      panner.connect(gain);
    } else {
      chainTail.connect(gain);
    }

    const catGain = this._categoryGains.get(category) || this._masterGain;
    gain.connect(catGain);

    osc.start(now);
    osc.stop(endTime);
    this._trackVoice(osc);

    return osc;
  }

  /**
   * Play a noise burst with envelope and optional filter.
   * @private
   * @param {Object} spec
   * @param {SOUND_CATEGORY} spec.category
   * @param {number} spec.duration
   * @param {number} [spec.attack=0.01]
   * @param {number} [spec.peak=1]
   * @param {number} [spec.pan=0]
   * @param {string} [spec.colour='white']
   * @param {string} [spec.filterType]
   * @param {number} [spec.filterFreq]
   * @param {number} [spec.filterQ]
   * @param {number} [spec.filterFreqEnd]
   * @param {number} [spec.delay=0]
   * @returns {AudioBufferSourceNode}
   */
  _playNoise(spec) {
    const ctx = this._ensureContext();
    if (this._voiceCount >= SoundManager.MAX_VOICES) return null;

    const {
      category, duration, attack = 0.01, peak = 1,
      pan = 0, colour = 'white',
      filterType, filterFreq, filterQ, filterFreqEnd,
      delay = 0,
    } = spec;

    const now = ctx.currentTime + delay;
    const buffer = AudioUtils.createNoiseBuffer(ctx, duration + attack + 0.1, colour);
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + attack + duration);

    let chainTail = src;

    if (filterType && filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, now);
      if (filterFreqEnd) {
        filter.frequency.exponentialRampToValueAtTime(filterFreqEnd, now + attack + duration);
      }
      if (filterQ) filter.Q.value = filterQ;
      src.connect(filter);
      chainTail = filter;
    }

    if (pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      chainTail.connect(panner);
      panner.connect(gain);
    } else {
      chainTail.connect(gain);
    }

    const catGain = this._categoryGains.get(category) || this._masterGain;
    gain.connect(catGain);

    src.start(now);
    src.stop(now + attack + duration + 0.05);
    this._trackVoice(src);

    return src;
  }

  /** @private */
  _trackVoice(node) {
    this._activeVoices.add(node);
    this._voiceCount++;
    node.addEventListener('ended', () => {
      this._activeVoices.delete(node);
      this._voiceCount--;
    });
  }

  /** Stop every currently playing voice immediately. */
  stopAll() {
    const now = this._ctx?.currentTime ?? 0;
    this._activeVoices.forEach((node) => {
      try { node.stop(now); } catch { /* already stopped */ }
    });
    this._activeVoices.clear();
    this._voiceCount = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Volume / mute API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Set the master volume.
   * @param {number} vol 0–1
   */
  setVolume(vol) {
    this._masterVolume = Math.max(0, Math.min(1, vol));
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(
        this._masterMuted ? 0 : this._masterVolume,
        this._ctx.currentTime,
        0.02
      );
    }
  }

  /** @returns {number} Current master volume 0–1. */
  getVolume() {
    return this._masterVolume;
  }

  /** Mute all output. */
  mute() {
    this._masterMuted = true;
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(0, this._ctx.currentTime, 0.02);
    }
  }

  /** Un-mute all output. */
  unmute() {
    this._masterMuted = false;
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(this._masterVolume, this._ctx.currentTime, 0.02);
    }
  }

  /** Toggle master mute state. */
  toggleMute() {
    this._masterMuted ? this.unmute() : this.mute();
  }

  /** @returns {boolean} */
  isMuted() {
    return this._masterMuted;
  }

  /**
   * Set per-category volume.
   * @param {SOUND_CATEGORY} category
   * @param {number} vol 0–1
   */
  setCategoryVolume(category, vol) {
    this._categoryVolumes[category] = Math.max(0, Math.min(1, vol));
    const node = this._categoryGains.get(category);
    if (node) {
      node.gain.setTargetAtTime(this._categoryVolumes[category], this._ctx.currentTime, 0.05);
    }
  }

  /** @returns {number} */
  getCategoryVolume(category) {
    return this._categoryVolumes[category] ?? 1;
  }

  /**
   * Mute a specific category.
   * @param {SOUND_CATEGORY} category
   */
  muteCategory(category) {
    const node = this._categoryGains.get(category);
    if (node) node.gain.setTargetAtTime(0, this._ctx.currentTime, 0.05);
  }

  /**
   * Un-mute a specific category.
   * @param {SOUND_CATEGORY} category
   */
  unmuteCategory(category) {
    const node = this._categoryGains.get(category);
    if (node) {
      node.gain.setTargetAtTime(this._categoryVolumes[category] ?? 1, this._ctx.currentTime, 0.05);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Sound Registry
  // ═══════════════════════════════════════════════════════════════════════

  /** @private */
  _buildSoundRegistry() {
    /** @private @type {Map<string,Function>} */
    this._sounds = new Map();

    // ── UI Sounds ──
    this._sounds.set('click_soft', this._clickSoft.bind(this));
    this._sounds.set('click_hard', this._clickHard.bind(this));
    this._sounds.set('panel_open', this._panelOpen.bind(this));
    this._sounds.set('panel_close', this._panelClose.bind(this));
    this._sounds.set('hover', this._hover.bind(this));
    this._sounds.set('error', this._error.bind(this));
    this._sounds.set('success', this._success.bind(this));
    this._sounds.set('coin_get', this._coinGet.bind(this));
    this._sounds.set('level_up', this._levelUp.bind(this));
    this._sounds.set('notification', this._notification.bind(this));

    // ── Movement Sounds ──
    this._sounds.set('step_wood', this._stepWood.bind(this));
    this._sounds.set('step_stone', this._stepStone.bind(this));
    this._sounds.set('step_grass', this._stepGrass.bind(this));
    this._sounds.set('step_carpet', this._stepCarpet.bind(this));
    this._sounds.set('step_water', this._stepWater.bind(this));
    this._sounds.set('jump', this._jump.bind(this));
    this._sounds.set('land', this._land.bind(this));

    // ── Interaction Sounds ──
    this._sounds.set('sit', this._sit.bind(this));
    this._sounds.set('stand', this._stand.bind(this));
    this._sounds.set('door_open', this._doorOpen.bind(this));
    this._sounds.set('chest_open', this._chestOpen.bind(this));
    this._sounds.set('item_pickup', this._itemPickup.bind(this));
    this._sounds.set('item_place', this._itemPlace.bind(this));
    this._sounds.set('trade_start', this._tradeStart.bind(this));
    this._sounds.set('trade_complete', this._tradeComplete.bind(this));

    // ── Social Sounds ──
    this._sounds.set('chat_send', this._chatSend.bind(this));
    this._sounds.set('chat_receive', this._chatReceive.bind(this));
    this._sounds.set('whisper', this._whisper.bind(this));
    this._sounds.set('friend_add', this._friendAdd.bind(this));
    this._sounds.set('achievement_unlock', this._achievementUnlock.bind(this));
    this._sounds.set('badge_equip', this._badgeEquip.bind(this));

    // ── Emote Sounds ──
    this._sounds.set('wave', this._wave.bind(this));
    this._sounds.set('dance', this._dance.bind(this));
    this._sounds.set('laugh', this._laugh.bind(this));
    this._sounds.set('kiss', this._kiss.bind(this));
    this._sounds.set('sleep', this._sleep.bind(this));
    this._sounds.set('fart', this._fart.bind(this));

    // ── Extra utility sounds ──
    this._sounds.set('ping', this._ping.bind(this));
    this._sounds.set('alert', this._alert.bind(this));
    this._sounds.set('teleport', this._teleport.bind(this));
    this._sounds.set('collect', this._collect.bind(this));
    this._sounds.set('equip', this._equip.bind(this));
    this._sounds.set('unequip', this._unequip.bind(this));
    this._sounds.set('craft', this._craft.bind(this));
    this._sounds.set('brew', this._brew.bind(this));
    this._sounds.set('open_book', this._openBook.bind(this));
    this._sounds.set('close_book', this._closeBook.bind(this));
    this._sounds.set('scroll', this._scroll.bind(this));
    this._sounds.set('stamp', this._stamp.bind(this));
    this._sounds.set('typewriter', this._typewriter.bind(this));
    this._sounds.set('magic_cast', this._magicCast.bind(this));
    this._sounds.set('magic_poof', this._magicPoof.bind(this));
    this._sounds.set('clock_tick', this._clockTick.bind(this));
    this._sounds.set('page_flip', this._pageFlip.bind(this));
    this._sounds.set('snap', this._snap.bind(this));
    this._sounds.set('whoosh', this._whoosh.bind(this));
    this._sounds.set('thud', this._thud.bind(this));
    this._sounds.set('glass_clink', this._glassClink.bind(this));
    this._sounds.set('bell_ring', this._bellRing.bind(this));
    this._sounds.set('knock', this._knock.bind(this));
    this._sounds.set('saw', this._saw.bind(this));
    this._sounds.set('hammer', this._hammer.bind(this));
    this._sounds.set('sew', this._sew.bind(this));
    this._sounds.set('cook_sizzle', this._cookSizzle.bind(this));
    this._sounds.set('pour_liquid', this._pourLiquid.bind(this));
    this._sounds.set('sharpen', this._sharpen.bind(this));
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Public play API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Play a registered sound by name.
   * @param {string} name
   * @param {Object} [options]
   * @param {number} [options.pan=0] Stereo pan (-1 left … 1 right)
   * @param {number} [options.pitch=0] Semitone offset
   * @param {number} [options.volume=1] Local multiplier 0–1
   * @returns {boolean} Whether the sound was triggered
   */
  play(name, options = {}) {
    if (!this._initialised) return false;
    const fn = this._sounds.get(name);
    if (!fn) {
      console.warn(`SoundManager: unknown sound "${name}"`);
      return false;
    }
    try {
      fn(options);
      return true;
    } catch (err) {
      console.error(`SoundManager: error playing "${name}":`, err);
      return false;
    }
  }

  /** @returns {string[]} All registered sound names. */
  getSoundNames() {
    return Array.from(this._sounds.keys());
  }

  /** @returns {boolean} */
  hasSound(name) {
    return this._sounds.has(name);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  UI Sounds (10)
  // ═══════════════════════════════════════════════════════════════════════

  /** Gentle button click — sine wave, 800Hz, 50ms */
  _clickSoft({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.UI,
      type: 'sine',
      freq: 800,
      freqEnd: 600,
      duration: 0.05,
      attack: 0.005,
      release: 0.04,
      peak: 0.25 * volume,
      pan,
    });
  }

  /** Firm button click — square wave, 600Hz, 80ms */
  _clickHard({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.UI,
      type: 'square',
      freq: 600,
      freqEnd: 400,
      duration: 0.08,
      attack: 0.005,
      release: 0.03,
      peak: 0.2 * volume,
      pan,
      filterType: 'lowpass',
      filterFreq: 3000,
    });
  }

  /** Panel slide open — white noise sweep, 150ms */
  _panelOpen({ pan = 0, volume = 1 } = {}) {
    const ctx = this._ensureContext();
    const now = ctx.currentTime;
    const noise = AudioUtils.createNoiseBuffer(ctx, 0.2, 'white');
    const src = ctx.createBufferSource();
    src.buffer = noise;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(3000, now + 0.15);
    filter.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12 * volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    if (pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      src.connect(filter);
      filter.connect(panner);
      panner.connect(gain);
    } else {
      src.connect(filter);
      filter.connect(gain);
    }

    const catGain = this._categoryGains.get(SOUND_CATEGORY.UI);
    gain.connect(catGain);

    src.start(now);
    src.stop(now + 0.18);
    this._trackVoice(src);
  }

  /** Panel slide close — reverse sweep, 150ms */
  _panelClose({ pan = 0, volume = 1 } = {}) {
    const ctx = this._ensureContext();
    const now = ctx.currentTime;
    const noise = AudioUtils.createNoiseBuffer(ctx, 0.2, 'white');
    const src = ctx.createBufferSource();
    src.buffer = noise;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    filter.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12 * volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    if (pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      src.connect(filter);
      filter.connect(panner);
      panner.connect(gain);
    } else {
      src.connect(filter);
      filter.connect(gain);
    }

    const catGain = this._categoryGains.get(SOUND_CATEGORY.UI);
    gain.connect(catGain);

    src.start(now);
    src.stop(now + 0.18);
    this._trackVoice(src);
  }

  /** Hover tick — sine, 1200Hz, 30ms, very quiet */
  _hover({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.UI,
      type: 'sine',
      freq: 1200,
      freqEnd: 1400,
      duration: 0.03,
      attack: 0.002,
      release: 0.02,
      peak: 0.08 * volume,
      pan,
    });
  }

  /** Error buzz — sawtooth, 200Hz, 200ms */
  _error({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.UI,
      type: 'sawtooth',
      freq: 200,
      freqEnd: 180,
      duration: 0.2,
      attack: 0.02,
      release: 0.08,
      peak: 0.2 * volume,
      pan,
      filterType: 'lowpass',
      filterFreq: 600,
    });
  }

  /** Success chime — C-E-G, 400ms */
  _success({ pan = 0, volume = 1 } = {}) {
    const base = 523.25; // C5
    [0, 4, 7].forEach((semitone, i) => {
      this._playTone({
        category: SOUND_CATEGORY.UI,
        type: 'sine',
        freq: base * AudioUtils.semitoneRatio(semitone),
        duration: 0.3,
        attack: 0.01,
        release: 0.25,
        peak: 0.2 * volume,
        pan,
        delay: i * 0.05,
      });
    });
  }

  /** Coin sound — two high pings, 100ms apart */
  _coinGet({ pan = 0, volume = 1 } = {}) {
    [0, 1].forEach((i) => {
      this._playTone({
        category: SOUND_CATEGORY.UI,
        type: 'sine',
        freq: i === 0 ? 1500 : 1800,
        freqEnd: i === 0 ? 1200 : 1500,
        duration: 0.08,
        attack: 0.005,
        release: 0.06,
        peak: 0.22 * volume,
        pan: i === 0 ? pan - 0.1 : pan + 0.1,
        delay: i * 0.1,
      });
    });
  }

  /** Level-up fanfare — ascending arpeggio, 800ms */
  _levelUp({ pan = 0, volume = 1 } = {}) {
    const base = 440; // A4
    const steps = [0, 4, 7, 12, 16, 19, 24];
    steps.forEach((semitone, i) => {
      this._playTone({
        category: SOUND_CATEGORY.UI,
        type: i < 3 ? 'sine' : 'triangle',
        freq: base * AudioUtils.semitoneRatio(semitone),
        duration: 0.15,
        attack: 0.01,
        release: 0.2,
        peak: (0.18 - i * 0.01) * volume,
        pan,
        delay: i * 0.08,
      });
    });
    // Final chord
    [0, 4, 7, 12].forEach((semitone) => {
      this._playTone({
        category: SOUND_CATEGORY.UI,
        type: 'sine',
        freq: base * AudioUtils.semitoneRatio(semitone + 12),
        duration: 0.4,
        attack: 0.02,
        release: 0.4,
        peak: 0.12 * volume,
        pan,
        delay: steps.length * 0.08,
      });
    });
  }

  /** Notification ding — sine sweep 800→1200Hz, 150ms */
  _notification({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.UI,
      type: 'sine',
      freq: 800,
      freqEnd: 1200,
      duration: 0.15,
      attack: 0.01,
      release: 0.1,
      peak: 0.2 * volume,
      pan,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Movement Sounds (7)
  // ═══════════════════════════════════════════════════════════════════════

  /** Wood creak — filtered noise, 80ms */
  _stepWood({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.MOVEMENT,
      duration: 0.08,
      attack: 0.005,
      peak: 0.2 * volume,
      pan,
      colour: 'brown',
      filterType: 'bandpass',
      filterFreq: 400,
      filterQ: 2,
    });
  }

  /** Stone tap — high click, 60ms */
  _stepStone({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.MOVEMENT,
      type: 'square',
      freq: 2500,
      freqEnd: 1800,
      duration: 0.02,
      attack: 0.001,
      release: 0.04,
      peak: 0.15 * volume,
      pan,
      filterType: 'highpass',
      filterFreq: 1500,
    });
    this._playNoise({
      category: SOUND_CATEGORY.MOVEMENT,
      duration: 0.04,
      attack: 0.001,
      peak: 0.08 * volume,
      pan,
      colour: 'white',
      filterType: 'highpass',
      filterFreq: 3000,
    });
  }

  /** Grass rustle — filtered noise, 100ms */
  _stepGrass({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.MOVEMENT,
      duration: 0.1,
      attack: 0.01,
      peak: 0.12 * volume,
      pan,
      colour: 'pink',
      filterType: 'bandpass',
      filterFreq: 1500,
      filterQ: 1.5,
    });
  }

  /** Carpet thud — low freq, 80ms */
  _stepCarpet({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.MOVEMENT,
      type: 'sine',
      freq: 120,
      freqEnd: 90,
      duration: 0.08,
      attack: 0.005,
      release: 0.05,
      peak: 0.22 * volume,
      pan,
    });
  }

  /** Water splash — noise burst + filter, 120ms */
  _stepWater({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.MOVEMENT,
      duration: 0.12,
      attack: 0.005,
      peak: 0.18 * volume,
      pan,
      colour: 'white',
      filterType: 'bandpass',
      filterFreq: 2000,
      filterQ: 1,
    });
  }

  /** Jump — spring, sine rise, 150ms */
  _jump({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.MOVEMENT,
      type: 'sine',
      freq: 200,
      freqEnd: 600,
      duration: 0.15,
      attack: 0.01,
      release: 0.05,
      peak: 0.18 * volume,
      pan,
    });
  }

  /** Land — soft thud, low decay, 100ms */
  _land({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.MOVEMENT,
      type: 'sine',
      freq: 160,
      freqEnd: 100,
      duration: 0.1,
      attack: 0.005,
      release: 0.08,
      peak: 0.2 * volume,
      pan,
    });
    this._playNoise({
      category: SOUND_CATEGORY.MOVEMENT,
      duration: 0.08,
      attack: 0.005,
      peak: 0.08 * volume,
      pan,
      colour: 'brown',
      filterType: 'lowpass',
      filterFreq: 300,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Interaction Sounds (8)
  // ═══════════════════════════════════════════════════════════════════════

  /** Sit — cushion squash, filtered noise, 100ms */
  _sit({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.INTERACTION,
      duration: 0.1,
      attack: 0.005,
      peak: 0.14 * volume,
      pan,
      colour: 'brown',
      filterType: 'lowpass',
      filterFreq: 400,
    });
  }

  /** Stand — light spring, quick rising tone, 80ms */
  _stand({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'sine',
      freq: 250,
      freqEnd: 400,
      duration: 0.08,
      attack: 0.005,
      release: 0.03,
      peak: 0.15 * volume,
      pan,
    });
  }

  /** Door creak — sweeping filter, 300ms */
  _doorOpen({ pan = 0, volume = 1 } = {}) {
    const ctx = this._ensureContext();
    const now = ctx.currentTime;
    const noise = AudioUtils.createNoiseBuffer(ctx, 0.4, 'pink');
    const src = ctx.createBufferSource();
    src.buffer = noise;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(2500, now + 0.15);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.3);
    filter.Q.value = 3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18 * volume, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    if (pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      src.connect(filter);
      filter.connect(panner);
      panner.connect(gain);
    } else {
      src.connect(filter);
      filter.connect(gain);
    }

    const catGain = this._categoryGains.get(SOUND_CATEGORY.INTERACTION);
    gain.connect(catGain);

    src.start(now);
    src.stop(now + 0.35);
    this._trackVoice(src);
  }

  /** Chest open — metallic click + wood creak, 400ms */
  _chestOpen({ pan = 0, volume = 1 } = {}) {
    // Metallic click
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'square',
      freq: 3500,
      freqEnd: 2000,
      duration: 0.03,
      attack: 0.001,
      release: 0.04,
      peak: 0.15 * volume,
      pan,
      filterType: 'bandpass',
      filterFreq: 3000,
    });
    // Wood creak
    const ctx = this._ensureContext();
    const now = ctx.currentTime + 0.08;
    const noise = AudioUtils.createNoiseBuffer(ctx, 0.35, 'pink');
    const src = ctx.createBufferSource();
    src.buffer = noise;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.14 * volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    if (pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      src.connect(filter);
      filter.connect(panner);
      panner.connect(gain);
    } else {
      src.connect(filter);
      filter.connect(gain);
    }

    const catGain = this._categoryGains.get(SOUND_CATEGORY.INTERACTION);
    gain.connect(catGain);

    src.start(now);
    src.stop(now + 0.35);
    this._trackVoice(src);
  }

  /** Item pickup — pop, sine rise, 60ms */
  _itemPickup({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'sine',
      freq: 600,
      freqEnd: 900,
      duration: 0.06,
      attack: 0.005,
      release: 0.04,
      peak: 0.18 * volume,
      pan,
    });
  }

  /** Item place — soft thud, low freq, 80ms */
  _itemPlace({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'sine',
      freq: 200,
      freqEnd: 150,
      duration: 0.08,
      attack: 0.005,
      release: 0.05,
      peak: 0.2 * volume,
      pan,
    });
  }

  /** Trade start — coin jingle, two pings, 200ms */
  _tradeStart({ pan = 0, volume = 1 } = {}) {
    [0, 1].forEach((i) => {
      this._playTone({
        category: SOUND_CATEGORY.INTERACTION,
        type: 'sine',
        freq: i === 0 ? 1200 : 1600,
        duration: 0.06,
        attack: 0.005,
        release: 0.05,
        peak: 0.18 * volume,
        pan: i === 0 ? pan - 0.15 : pan + 0.15,
        delay: i * 0.08,
      });
    });
    // Small chime
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'triangle',
      freq: 800,
      duration: 0.15,
      attack: 0.01,
      release: 0.12,
      peak: 0.12 * volume,
      pan,
      delay: 0.16,
    });
  }

  /** Trade complete — success flourish, arpeggio, 600ms */
  _tradeComplete({ pan = 0, volume = 1 } = {}) {
    const base = 523.25; // C5
    [0, 4, 7, 12, 16].forEach((semitone, i) => {
      this._playTone({
        category: SOUND_CATEGORY.INTERACTION,
        type: i < 2 ? 'sine' : 'triangle',
        freq: base * AudioUtils.semitoneRatio(semitone),
        duration: 0.2,
        attack: 0.01,
        release: 0.2,
        peak: (0.18 - i * 0.015) * volume,
        pan,
        delay: i * 0.06,
      });
    });
    // Coin shimmer
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'sine',
      freq: 2000,
      duration: 0.1,
      attack: 0.005,
      release: 0.08,
      peak: 0.1 * volume,
      pan,
      delay: 0.35,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Social Sounds (6)
  // ═══════════════════════════════════════════════════════════════════════

  /** Chat send — bubble pop, soft pluck, 80ms */
  _chatSend({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.SOCIAL,
      type: 'sine',
      freq: 700,
      freqEnd: 900,
      duration: 0.04,
      attack: 0.005,
      release: 0.05,
      peak: 0.16 * volume,
      pan,
    });
  }

  /** Chat receive — gentle ding, higher pluck, 80ms */
  _chatReceive({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.SOCIAL,
      type: 'sine',
      freq: 900,
      freqEnd: 1100,
      duration: 0.04,
      attack: 0.005,
      release: 0.05,
      peak: 0.14 * volume,
      pan,
    });
  }

  /** Whisper — soft rustle, filtered noise, 150ms */
  _whisper({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.SOCIAL,
      duration: 0.15,
      attack: 0.02,
      peak: 0.08 * volume,
      pan,
      colour: 'pink',
      filterType: 'bandpass',
      filterFreq: 2500,
      filterQ: 2,
    });
  }

  /** Friend add — warm major chord, C-E-G-C, 500ms */
  _friendAdd({ pan = 0, volume = 1 } = {}) {
    const base = 261.63; // C4
    [0, 4, 7, 12].forEach((semitone, i) => {
      this._playTone({
        category: SOUND_CATEGORY.SOCIAL,
        type: 'sine',
        freq: base * AudioUtils.semitoneRatio(semitone),
        duration: 0.35,
        attack: 0.02,
        release: 0.3,
        peak: (0.16 - i * 0.02) * volume,
        pan: (i % 2 === 0 ? -0.3 : 0.3) * (i / 3),
        delay: i * 0.04,
      });
    });
  }

  /** Achievement unlock — trophy / brass-like, 1s */
  _achievementUnlock({ pan = 0, volume = 1 } = {}) {
    const base = 392; // G4
    // Brass-like swell
    this._playTone({
      category: SOUND_CATEGORY.SOCIAL,
      type: 'sawtooth',
      freq: base,
      duration: 0.8,
      attack: 0.15,
      release: 0.35,
      peak: 0.16 * volume,
      pan,
      filterType: 'lowpass',
      filterFreq: 1200,
    });
    // Harmonised swell
    [4, 7, 12].forEach((semitone, i) => {
      this._playTone({
        category: SOUND_CATEGORY.SOCIAL,
        type: 'triangle',
        freq: base * AudioUtils.semitoneRatio(semitone),
        duration: 0.7,
        attack: 0.12 + i * 0.03,
        release: 0.3,
        peak: (0.12 - i * 0.02) * volume,
        pan: i === 1 ? 0 : (i === 0 ? -0.4 : 0.4),
        delay: i * 0.05,
      });
    });
    // High sparkle
    this._playTone({
      category: SOUND_CATEGORY.SOCIAL,
      type: 'sine',
      freq: 2000,
      duration: 0.3,
      attack: 0.05,
      release: 0.4,
      peak: 0.1 * volume,
      pan,
      delay: 0.5,
    });
  }

  /** Badge equip — sparkle shimmer, 300ms */
  _badgeEquip({ pan = 0, volume = 1 } = {}) {
    const base = 880; // A5
    [0, 4, 7, 12, 16, 19].forEach((semitone, i) => {
      this._playTone({
        category: SOUND_CATEGORY.SOCIAL,
        type: 'sine',
        freq: base * AudioUtils.semitoneRatio(semitone),
        duration: 0.08,
        attack: 0.005,
        release: 0.15,
        peak: (0.12 - i * 0.015) * volume,
        pan: Math.sin(i * 1.5) * 0.6,
        delay: i * 0.025,
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Emote Sounds (6)
  // ═══════════════════════════════════════════════════════════════════════

  /** Wave — swoosh, filtered noise, 200ms */
  _wave({ pan = 0, volume = 1 } = {}) {
    const ctx = this._ensureContext();
    const now = ctx.currentTime;
    const noise = AudioUtils.createNoiseBuffer(ctx, 0.25, 'pink');
    const src = ctx.createBufferSource();
    src.buffer = noise;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(600, now + 0.2);
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.14 * volume, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    if (pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      src.connect(filter);
      filter.connect(panner);
      panner.connect(gain);
    } else {
      src.connect(filter);
      filter.connect(gain);
    }

    const catGain = this._categoryGains.get(SOUND_CATEGORY.EMOTE);
    gain.connect(catGain);

    src.start(now);
    src.stop(now + 0.23);
    this._trackVoice(src);
  }

  /** Dance — kick + hi-hat pattern, ~400ms */
  _dance({ pan = 0, volume = 1 } = {}) {
    const ctx = this._ensureContext();
    const now = ctx.currentTime;

    // Kick drum
    [0, 0.2, 0.4].forEach((t) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now + t);
      osc.frequency.exponentialRampToValueAtTime(50, now + t + 0.12);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25 * volume, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.12);

      osc.connect(gain);
      const catGain = this._categoryGains.get(SOUND_CATEGORY.EMOTE);
      gain.connect(catGain);

      osc.start(now + t);
      osc.stop(now + t + 0.13);
      this._trackVoice(osc);
    });

    // Hi-hat ticks
    [0.1, 0.3].forEach((t) => {
      const noise = AudioUtils.createNoiseBuffer(ctx, 0.1, 'white');
      const src = ctx.createBufferSource();
      src.buffer = noise;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 8000;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1 * volume, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.06);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this._categoryGains.get(SOUND_CATEGORY.EMOTE));

      src.start(now + t);
      src.stop(now + t + 0.07);
      this._trackVoice(src);
    });
  }

  /** Laugh — giggles, rapid high notes, 400ms */
  _laugh({ pan = 0, volume = 1 } = {}) {
    const ctx = this._ensureContext();
    const now = ctx.currentTime;
    const pitches = [700, 900, 650, 850, 600];
    pitches.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      osc.frequency.exponentialRampToValueAtTime(freq + 100, now + i * 0.07 + 0.05);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now + i * 0.07);
      gain.gain.linearRampToValueAtTime(0.12 * volume, now + i * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.06);

      if (pan !== 0) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan + (Math.random() - 0.5) * 0.3;
        osc.connect(panner);
        panner.connect(gain);
      } else {
        osc.connect(gain);
      }

      gain.connect(this._categoryGains.get(SOUND_CATEGORY.EMOTE));
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.07);
      this._trackVoice(osc);
    });
  }

  /** Kiss — smooch, filtered pop, 200ms */
  _kiss({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.EMOTE,
      duration: 0.08,
      attack: 0.005,
      peak: 0.18 * volume,
      pan,
      colour: 'pink',
      filterType: 'bandpass',
      filterFreq: 1500,
      filterQ: 3,
    });
    this._playTone({
      category: SOUND_CATEGORY.EMOTE,
      type: 'sine',
      freq: 500,
      freqEnd: 700,
      duration: 0.12,
      attack: 0.01,
      release: 0.08,
      peak: 0.1 * volume,
      pan,
      delay: 0.06,
    });
  }

  /** Sleep — snore, oscillating low freq, looping */
  _sleep({ pan = 0, volume = 1, loop = false } = {}) {
    const ctx = this._ensureContext();
    const now = ctx.currentTime;

    // Low-frequency snore oscillation
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.5; // 2-second snore cycle

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 30;

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = 120;
    lfo.connect(lfoGain);
    lfoGain.connect(carrier.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15 * volume, now + 0.5);
    gain.gain.linearRampToValueAtTime(0.001, now + 1.0);

    if (loop) {
      // For looping snore, we'd need a custom loop node;
      // here we just do a single snore cycle.
      carrier.connect(gain);
      gain.connect(this._categoryGains.get(SOUND_CATEGORY.EMOTE));
      lfo.start(now);
      carrier.start(now);
      lfo.stop(now + 1.2);
      carrier.stop(now + 1.2);
      this._trackVoice(carrier);
    } else {
      carrier.connect(gain);
      gain.connect(this._categoryGains.get(SOUND_CATEGORY.EMOTE));
      lfo.start(now);
      carrier.start(now);
      lfo.stop(now + 1.2);
      carrier.stop(now + 1.2);
      this._trackVoice(carrier);
    }
  }

  /** Fart — procedural whoopee, descending freq, 400ms */
  _fart({ pan = 0, volume = 1 } = {}) {
    const ctx = this._ensureContext();
    const now = ctx.currentTime;

    // Main descending tone
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + 0.35);
    filter.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18 * volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    // Brown noise rumble
    const noise = AudioUtils.createNoiseBuffer(ctx, 0.45, 'brown');
    const src = ctx.createBufferSource();
    src.buffer = noise;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(400, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(80, now + 0.35);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12 * volume, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    if (pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      osc.connect(filter);
      filter.connect(panner);
      panner.connect(gain);
      src.connect(noiseFilter);
      noiseFilter.connect(panner);
    } else {
      osc.connect(filter);
      filter.connect(gain);
      src.connect(noiseFilter);
    }

    const catGain = this._categoryGains.get(SOUND_CATEGORY.EMOTE);
    gain.connect(catGain);
    noiseFilter.connect(catGain);

    osc.start(now);
    osc.stop(now + 0.42);
    src.start(now);
    src.stop(now + 0.42);
    this._trackVoice(osc);
    this._trackVoice(src);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Extra Utility Sounds (25+)
  // ═══════════════════════════════════════════════════════════════════════

  /** Simple ping — 880Hz sine, 100ms */
  _ping({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.UI,
      type: 'sine',
      freq: 880,
      duration: 0.1,
      attack: 0.01,
      release: 0.08,
      peak: 0.15 * volume,
      pan,
    });
  }

  /** Alert — urgent tri-tone, 300ms */
  _alert({ pan = 0, volume = 1 } = {}) {
    [0, 0.1, 0.2].forEach((delay, i) => {
      this._playTone({
        category: SOUND_CATEGORY.UI,
        type: 'square',
        freq: 1200 - i * 200,
        duration: 0.06,
        attack: 0.002,
        release: 0.04,
        peak: 0.16 * volume,
        pan,
        delay,
        filterType: 'lowpass',
        filterFreq: 3000,
      });
    });
  }

  /** Teleport — sci-fi shimmer, 600ms */
  _teleport({ pan = 0, volume = 1 } = {}) {
    const base = 600;
    [0, 3, 6, 9, 12, 15, 18, 21].forEach((semitone, i) => {
      this._playTone({
        category: SOUND_CATEGORY.INTERACTION,
        type: 'sine',
        freq: base * AudioUtils.semitoneRatio(semitone),
        duration: 0.4,
        attack: 0.05,
        release: 0.3,
        peak: (0.12 - i * 0.01) * volume,
        pan: Math.sin(i) * 0.7,
        delay: i * 0.03,
      });
    });
  }

  /** Collect — pleasant chime, 200ms */
  _collect({ pan = 0, volume = 1 } = {}) {
    [0, 7, 12].forEach((semitone, i) => {
      this._playTone({
        category: SOUND_CATEGORY.INTERACTION,
        type: 'sine',
        freq: 523.25 * AudioUtils.semitoneRatio(semitone),
        duration: 0.15,
        attack: 0.005,
        release: 0.12,
        peak: (0.14 - i * 0.02) * volume,
        pan,
        delay: i * 0.04,
      });
    });
  }

  /** Equip — satisfying click + hum, 150ms */
  _equip({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'square',
      freq: 2200,
      duration: 0.02,
      attack: 0.001,
      release: 0.03,
      peak: 0.12 * volume,
      pan,
      filterType: 'lowpass',
      filterFreq: 4000,
    });
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'sine',
      freq: 440,
      duration: 0.12,
      attack: 0.01,
      release: 0.1,
      peak: 0.1 * volume,
      pan,
      delay: 0.03,
    });
  }

  /** Unequip — reverse click, 120ms */
  _unequip({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'sine',
      freq: 600,
      freqEnd: 300,
      duration: 0.1,
      attack: 0.01,
      release: 0.06,
      peak: 0.12 * volume,
      pan,
    });
  }

  /** Craft — anvil-like strike + ring, 300ms */
  _craft({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'square',
      freq: 800,
      freqEnd: 300,
      duration: 0.04,
      attack: 0.001,
      release: 0.04,
      peak: 0.18 * volume,
      pan,
      filterType: 'lowpass',
      filterFreq: 2000,
    });
    // Ring
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'sine',
      freq: 1200,
      duration: 0.25,
      attack: 0.005,
      release: 0.2,
      peak: 0.1 * volume,
      pan,
      delay: 0.04,
    });
  }

  /** Brew — bubbling liquid, 250ms */
  _brew({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.INTERACTION,
      duration: 0.25,
      attack: 0.02,
      peak: 0.1 * volume,
      pan,
      colour: 'pink',
      filterType: 'bandpass',
      filterFreq: 2000,
      filterQ: 2,
    });
    // Pop
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'sine',
      freq: 400,
      freqEnd: 600,
      duration: 0.05,
      attack: 0.002,
      release: 0.03,
      peak: 0.12 * volume,
      pan,
      delay: 0.08,
    });
  }

  /** Open book — paper rustle + soft thump, 150ms */
  _openBook({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.UI,
      duration: 0.15,
      attack: 0.01,
      peak: 0.08 * volume,
      pan,
      colour: 'pink',
      filterType: 'bandpass',
      filterFreq: 800,
      filterQ: 1,
    });
  }

  /** Close book — heavier thump, 100ms */
  _closeBook({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.UI,
      type: 'sine',
      freq: 250,
      duration: 0.08,
      attack: 0.005,
      release: 0.05,
      peak: 0.14 * volume,
      pan,
    });
  }

  /** Scroll — quick paper slide, 80ms */
  _scroll({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.UI,
      duration: 0.08,
      attack: 0.005,
      peak: 0.06 * volume,
      pan,
      colour: 'pink',
      filterType: 'highpass',
      filterFreq: 1200,
    });
  }

  /** Stamp — thud, 80ms */
  _stamp({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.UI,
      type: 'sine',
      freq: 200,
      duration: 0.05,
      attack: 0.001,
      release: 0.05,
      peak: 0.18 * volume,
      pan,
    });
  }

  /** Typewriter — mechanical click, 60ms */
  _typewriter({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.UI,
      type: 'square',
      freq: 1500,
      duration: 0.02,
      attack: 0.001,
      release: 0.02,
      peak: 0.1 * volume,
      pan,
      filterType: 'bandpass',
      filterFreq: 2000,
    });
  }

  /** Magic cast — ethereal shimmer, 400ms */
  _magicCast({ pan = 0, volume = 1 } = {}) {
    [0, 5, 10, 15, 20, 24].forEach((semitone, i) => {
      this._playTone({
        category: SOUND_CATEGORY.INTERACTION,
        type: 'sine',
        freq: 440 * AudioUtils.semitoneRatio(semitone),
        duration: 0.3,
        attack: 0.05,
        release: 0.25,
        peak: (0.1 - i * 0.012) * volume,
        pan: Math.sin(i * 1.2) * 0.7,
        delay: i * 0.025,
      });
    });
  }

  /** Magic poof — descending cloud, 300ms */
  _magicPoof({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.INTERACTION,
      duration: 0.3,
      attack: 0.02,
      peak: 0.12 * volume,
      pan,
      colour: 'white',
      filterType: 'lowpass',
      filterFreq: 3000,
      filterFreqEnd: 200,
    });
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'triangle',
      freq: 800,
      freqEnd: 200,
      duration: 0.25,
      attack: 0.02,
      release: 0.15,
      peak: 0.1 * volume,
      pan,
    });
  }

  /** Clock tick — metronome-like tick, 50ms */
  _clockTick({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.UI,
      type: 'sine',
      freq: 1000,
      duration: 0.02,
      attack: 0.001,
      release: 0.03,
      peak: 0.12 * volume,
      pan,
    });
  }

  /** Page flip — quick paper rustle, 100ms */
  _pageFlip({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.UI,
      duration: 0.1,
      attack: 0.005,
      peak: 0.07 * volume,
      pan,
      colour: 'pink',
      filterType: 'bandpass',
      filterFreq: 1500,
      filterQ: 1.5,
    });
  }

  /** Snap — finger snap, 40ms */
  _snap({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.EMOTE,
      duration: 0.02,
      attack: 0.001,
      peak: 0.2 * volume,
      pan,
      colour: 'white',
      filterType: 'highpass',
      filterFreq: 4000,
    });
  }

  /** Whoosh — fast air, 150ms */
  _whoosh({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.EMOTE,
      duration: 0.15,
      attack: 0.01,
      peak: 0.12 * volume,
      pan,
      colour: 'white',
      filterType: 'bandpass',
      filterFreq: 2500,
      filterFreqEnd: 500,
      filterQ: 1,
    });
  }

  /** Thud — heavy impact, 120ms */
  _thud({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'sine',
      freq: 120,
      duration: 0.1,
      attack: 0.002,
      release: 0.08,
      peak: 0.22 * volume,
      pan,
    });
    this._playNoise({
      category: SOUND_CATEGORY.INTERACTION,
      duration: 0.08,
      attack: 0.002,
      peak: 0.1 * volume,
      pan,
      colour: 'brown',
      filterType: 'lowpass',
      filterFreq: 200,
    });
  }

  /** Glass clink — two glasses meeting, 100ms */
  _glassClink({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'sine',
      freq: 3500,
      duration: 0.05,
      attack: 0.001,
      release: 0.06,
      peak: 0.12 * volume,
      pan,
    });
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'sine',
      freq: 2800,
      duration: 0.05,
      attack: 0.001,
      release: 0.06,
      peak: 0.1 * volume,
      pan: -pan,
      delay: 0.01,
    });
  }

  /** Bell ring — resonant ding, 300ms */
  _bellRing({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.SOCIAL,
      type: 'sine',
      freq: 1500,
      duration: 0.25,
      attack: 0.005,
      release: 0.25,
      peak: 0.16 * volume,
      pan,
    });
    this._playTone({
      category: SOUND_CATEGORY.SOCIAL,
      type: 'triangle',
      freq: 1500,
      duration: 0.25,
      attack: 0.005,
      release: 0.2,
      peak: 0.08 * volume,
      pan,
    });
  }

  /** Knock — door knock, 80ms */
  _knock({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'sine',
      freq: 300,
      duration: 0.02,
      attack: 0.001,
      release: 0.04,
      peak: 0.2 * volume,
      pan,
    });
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'sine',
      freq: 280,
      duration: 0.02,
      attack: 0.001,
      release: 0.04,
      peak: 0.16 * volume,
      pan,
      delay: 0.08,
    });
  }

  /** Saw — wood sawing noise, 200ms */
  _saw({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.INTERACTION,
      duration: 0.2,
      attack: 0.01,
      peak: 0.12 * volume,
      pan,
      colour: 'pink',
      filterType: 'bandpass',
      filterFreq: 1200,
      filterFreqEnd: 800,
    });
  }

  /** Hammer — metal strike, 100ms */
  _hammer({ pan = 0, volume = 1 } = {}) {
    this._playTone({
      category: SOUND_CATEGORY.INTERACTION,
      type: 'square',
      freq: 600,
      duration: 0.03,
      attack: 0.001,
      release: 0.04,
      peak: 0.18 * volume,
      pan,
      filterType: 'lowpass',
      filterFreq: 2500,
    });
    this._playNoise({
      category: SOUND_CATEGORY.INTERACTION,
      duration: 0.05,
      attack: 0.001,
      peak: 0.1 * volume,
      pan,
      colour: 'brown',
      filterType: 'lowpass',
      filterFreq: 400,
    });
  }

  /** Sew — thread pull, 150ms */
  _sew({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.INTERACTION,
      duration: 0.15,
      attack: 0.01,
      peak: 0.06 * volume,
      pan,
      colour: 'pink',
      filterType: 'highpass',
      filterFreq: 3000,
    });
  }

  /** Cook sizzle — frying pan, 200ms */
  _cookSizzle({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.INTERACTION,
      duration: 0.2,
      attack: 0.02,
      peak: 0.1 * volume,
      pan,
      colour: 'white',
      filterType: 'bandpass',
      filterFreq: 4000,
      filterQ: 2,
    });
  }

  /** Pour liquid — pouring sound, 250ms */
  _pourLiquid({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.INTERACTION,
      duration: 0.25,
      attack: 0.02,
      peak: 0.08 * volume,
      pan,
      colour: 'pink',
      filterType: 'bandpass',
      filterFreq: 2500,
      filterQ: 1,
    });
  }

  /** Sharpen — blade on stone, 180ms */
  _sharpen({ pan = 0, volume = 1 } = {}) {
    this._playNoise({
      category: SOUND_CATEGORY.INTERACTION,
      duration: 0.18,
      attack: 0.005,
      peak: 0.1 * volume,
      pan,
      colour: 'white',
      filterType: 'highpass',
      filterFreq: 5000,
    });
  }
}

// Singleton export for the game
export const soundManager = new SoundManager();
export { SoundManager, SOUND_CATEGORY, AudioUtils };
export default SoundManager;
