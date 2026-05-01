/**
 * @fileoverview Starlight Inn v8.0 — MusicPlayer
 * Procedural area music system using the Web Audio API.
 * Synthesises 16 unique looping tracks in real-time with
 * oscillators, noise sources, envelopes, and spatial mixing.
 * No external audio files — avoids CORS on GitHub Pages.
 *
 * @author Starlight Inn Audio Team
 * @version 8.0.0
 * @license MIT
 */

/**
 * Utility helpers shared with SoundManager.
 * @namespace
 */
const MusicUtils = {
  /**
   * @param {number} semitones
   * @returns {number}
   */
  semitoneRatio(semitones) {
    return 2 ** (semitones / 12);
  },

  /**
   * Convert a note name (e.g. "C4") to frequency.
   * @param {string} note
   * @returns {number}
   */
  noteToFreq(note) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = note.match(/^([A-G]#?)(\d)$/);
    if (!match) return 440;
    const semitone = notes.indexOf(match[1]);
    const octave = parseInt(match[2], 10);
    return 440 * 2 ** ((octave - 4) + (semitone - 9) / 12);
  },

  /**
   * Create a looping noise buffer.
   * @param {AudioContext} ctx
   * @param {number} seconds
   * @param {'white'|'pink'|'brown'} colour
   * @returns {AudioBuffer}
   */
  createNoiseBuffer(ctx, seconds, colour = 'white') {
    const sampleRate = ctx.sampleRate;
    const frames = Math.ceil(sampleRate * seconds);
    const buffer = ctx.createBuffer(1, frames, sampleRate);
    const data = buffer.getChannelData(0);
    if (colour === 'white') {
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    } else if (colour === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < frames; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else if (colour === 'brown') {
      let last = 0;
      for (let i = 0; i < frames; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    }
    return buffer;
  },
};

/** @type {Object<string,string[]>} */
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

/**
 * One-shot instrument voice for the sequencer.
 * @param {AudioContext} ctx
 * @param {Object} spec
 * @param {GainNode} destination
 */
function scheduleVoice(ctx, spec, destination) {
  const {
    time, freq, duration, type = 'sine',
    attack = 0.02, decay = 0.1, sustain = 0.3, release = 0.3,
    peak = 0.5, pan = 0, filterType, filterFreq, filterQ,
    detune = 0,
  } = spec;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  if (detune) osc.detune.value = detune;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peak, time + attack);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak * sustain, 0.001), time + attack + decay);
  gain.gain.setValueAtTime(Math.max(peak * sustain, 0.001), time + duration);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration + release);

  let tail = osc;
  if (filterType && filterFreq) {
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = filterFreq;
    if (filterQ) f.Q.value = filterQ;
    osc.connect(f);
    tail = f;
  }

  if (pan !== 0) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    tail.connect(p);
    p.connect(gain);
  } else {
    tail.connect(gain);
  }

  gain.connect(destination);
  osc.start(time);
  osc.stop(time + duration + release + 0.01);
}

/**
 * Schedule a noise hit.
 * @param {AudioContext} ctx
 * @param {Object} spec
 * @param {GainNode} destination
 */
function scheduleNoise(ctx, spec, destination) {
  const {
    time, duration, attack = 0.005, peak = 0.3,
    pan = 0, colour = 'white',
    filterType, filterFreq, filterQ,
  } = spec;

  const buffer = MusicUtils.createNoiseBuffer(ctx, duration + 0.1, colour);
  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peak, time + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, time + attack + duration);

  let tail = src;
  if (filterType && filterFreq) {
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = filterFreq;
    if (filterQ) f.Q.value = filterQ;
    src.connect(f);
    tail = f;
  }

  if (pan !== 0) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    tail.connect(p);
    p.connect(gain);
  } else {
    tail.connect(gain);
  }

  gain.connect(destination);
  src.start(time);
  src.stop(time + attack + duration + 0.02);
}

/**
 * Generates a procedural looping track.
 * Each track is a function that schedules ahead using the AudioContext clock.
 */
class TrackEngine {
  /**
   * @param {AudioContext} ctx
   * @param {GainNode} destination
   * @param {Object} definition
   */
  constructor(ctx, destination, definition) {
    this.ctx = ctx;
    this.dest = destination;
    this.def = definition;
    this.bpm = definition.bpm || 120;
    this.beatDuration = 60 / this.bpm;
    this.loopBeats = definition.loopBeats || 8;
    this.loopDuration = this.loopBeats * this.beatDuration;
    this.baseFreq = MusicUtils.noteToFreq(definition.baseNote || 'C4');
    this.scale = SCALES[definition.scale || 'major'];
    this.running = false;
    this.nextBeatTime = 0;
    this.beatIndex = 0;
    this.lookahead = 0.5; // seconds
    this.timerId = null;
    this._scheduledNodes = new Set();
  }

  start() {
    this.running = true;
    this.nextBeatTime = this.ctx.currentTime + 0.05;
    this.beatIndex = 0;
    this._scheduler();
  }

  stop() {
    this.running = false;
    if (this.timerId) clearTimeout(this.timerId);
    this.timerId = null;
    this._scheduledNodes.forEach((n) => {
      try { n.stop(); } catch { /* noop */ }
    });
    this._scheduledNodes.clear();
  }

  /** @private */
  _scheduler() {
    if (!this.running) return;
    const ctx = this.ctx;
    while (this.nextBeatTime < ctx.currentTime + this.lookahead) {
      this._scheduleBeat(this.nextBeatTime, this.beatIndex);
      this.nextBeatTime += this.beatDuration;
      this.beatIndex = (this.beatIndex + 1) % this.loopBeats;
    }
    this.timerId = setTimeout(() => this._scheduler(), 100);
  }

  /** @private */
  _scheduleBeat(time, beat) {
    const d = this.def;
    // Drums
    if (d.drums) {
      d.drums.forEach((drum) => {
        if (drum.pattern[beat]) {
          scheduleNoise(this.ctx, {
            time,
            duration: drum.duration || 0.1,
            peak: drum.gain || 0.3,
            pan: drum.pan || 0,
            colour: drum.colour || 'white',
            filterType: drum.filterType,
            filterFreq: drum.filterFreq,
            filterQ: drum.filterQ,
          }, this.dest);
        }
      });
    }
    // Bass
    if (d.bass) {
      const bass = d.bass;
      if (bass.pattern[beat]) {
        const noteIdx = bass.pattern[beat] - 1;
        const freq = this.baseFreq * MusicUtils.semitoneRatio(this.scale[noteIdx % this.scale.length] - 12);
        scheduleVoice(this.ctx, {
          time,
          freq,
          duration: bass.noteDuration || this.beatDuration * 0.9,
          type: bass.type || 'triangle',
          attack: 0.02,
          decay: 0.1,
          sustain: 0.4,
          release: 0.2,
          peak: bass.gain || 0.25,
          pan: bass.pan || 0,
          filterType: 'lowpass',
          filterFreq: bass.filterFreq || 600,
        }, this.dest);
      }
    }
    // Chords / pads
    if (d.pads) {
      d.pads.forEach((pad) => {
        if (pad.pattern[beat]) {
          const chord = pad.pattern[beat];
          chord.forEach((degree) => {
            const noteIdx = degree - 1;
            const freq = this.baseFreq * MusicUtils.semitoneRatio(this.scale[noteIdx % this.scale.length] + (degree > 7 ? 12 : 0));
            scheduleVoice(this.ctx, {
              time,
              freq,
              duration: pad.noteDuration || this.beatDuration * 2,
              type: pad.type || 'sine',
              attack: pad.attack || 0.3,
              decay: 0.2,
              sustain: 0.6,
              release: pad.release || 0.5,
              peak: (pad.gain || 0.15) / chord.length,
              pan: pad.pan || 0,
              filterType: pad.filterType,
              filterFreq: pad.filterFreq,
              filterQ: pad.filterQ,
              detune: (Math.random() - 0.5) * 10,
            }, this.dest);
          });
        }
      });
    }
    // Arpeggio / melody
    if (d.melody) {
      const mel = d.melody;
      if (mel.pattern[beat]) {
        const degree = mel.pattern[beat];
        const noteIdx = degree - 1;
        const freq = this.baseFreq * MusicUtils.semitoneRatio(this.scale[noteIdx % this.scale.length] + (degree > 7 ? 12 : 0));
        scheduleVoice(this.ctx, {
          time,
          freq,
          duration: mel.noteDuration || this.beatDuration * 0.7,
          type: mel.type || 'sine',
          attack: mel.attack || 0.01,
          decay: 0.1,
          sustain: 0.2,
          release: mel.release || 0.2,
          peak: mel.gain || 0.2,
          pan: mel.pan || 0,
          filterType: mel.filterType,
          filterFreq: mel.filterFreq,
        }, this.dest);
      }
    }
  }
}

/** @type {Object<string,Object>} */
const TRACK_DEFS = {
  // ── Title ── ambient, dreamy, slow tempo (60 BPM)
  title: {
    bpm: 60,
    loopBeats: 16,
    baseNote: 'C4',
    scale: 'major',
    pads: [
      {
        pattern: { 0: [1, 3, 5], 8: [4, 6, 8] },
        type: 'sine',
        gain: 0.18,
        noteDuration: 6,
        attack: 0.8,
        release: 1.0,
        filterFreq: 800,
      },
    ],
    melody: {
      pattern: { 4: 1, 6: 3, 10: 5, 12: 8, 14: 5 },
      type: 'triangle',
      gain: 0.12,
      noteDuration: 1.5,
      release: 0.6,
      filterFreq: 2000,
    },
  },

  // ── Plaza ── upbeat, friendly, strings + piano feel
  plaza: {
    bpm: 110,
    loopBeats: 8,
    baseNote: 'G4',
    scale: 'major',
    drums: [
      { pattern: { 0: 1, 4: 1 }, duration: 0.15, gain: 0.2, colour: 'brown', filterType: 'lowpass', filterFreq: 120 },
      { pattern: { 2: 1, 6: 1 }, duration: 0.08, gain: 0.12, colour: 'white', filterType: 'highpass', filterFreq: 6000 },
    ],
    bass: {
      pattern: { 0: 1, 3: 5, 5: 4, 7: 5 },
      type: 'triangle',
      gain: 0.22,
      filterFreq: 400,
    },
    pads: [
      {
        pattern: { 0: [1, 3, 5], 4: [5, 7, 2] },
        type: 'sine',
        gain: 0.12,
        noteDuration: 2.5,
        attack: 0.2,
        release: 0.4,
      },
    ],
    melody: {
      pattern: { 1: 3, 3: 5, 4: 4, 6: 8, 7: 5 },
      type: 'triangle',
      gain: 0.14,
      noteDuration: 0.5,
      release: 0.15,
    },
  },

  // ── Garden ── peaceful, nature sounds + gentle melody
  garden: {
    bpm: 80,
    loopBeats: 12,
    baseNote: 'F4',
    scale: 'major',
    drums: [
      { pattern: { 0: 1, 6: 1 }, duration: 0.08, gain: 0.06, colour: 'pink', filterType: 'highpass', filterFreq: 8000, pan: -0.3 },
    ],
    pads: [
      {
        pattern: { 0: [1, 3, 5], 6: [4, 6, 8] },
        type: 'sine',
        gain: 0.14,
        noteDuration: 4,
        attack: 0.6,
        release: 0.8,
      },
    ],
    melody: {
      pattern: { 2: 5, 4: 8, 8: 3, 10: 5 },
      type: 'sine',
      gain: 0.1,
      noteDuration: 1.0,
      release: 0.4,
    },
  },

  // ── Beach ── tropical, ukulele + waves
  beach: {
    bpm: 95,
    loopBeats: 8,
    baseNote: 'C4',
    scale: 'pentatonic',
    drums: [
      { pattern: { 0: 1, 3: 1, 5: 1 }, duration: 0.12, gain: 0.12, colour: 'brown', filterType: 'lowpass', filterFreq: 200 },
      { pattern: { 2: 1, 6: 1 }, duration: 0.06, gain: 0.08, colour: 'white', filterType: 'highpass', filterFreq: 7000 },
    ],
    bass: {
      pattern: { 0: 1, 4: 4 },
      type: 'triangle',
      gain: 0.18,
      filterFreq: 350,
    },
    melody: {
      pattern: { 1: 3, 2: 5, 4: 4, 5: 2, 7: 5 },
      type: 'triangle',
      gain: 0.13,
      noteDuration: 0.4,
      release: 0.12,
    },
  },

  // ── Tavern ── warm, cozy, acoustic guitar feel
  tavern: {
    bpm: 90,
    loopBeats: 8,
    baseNote: 'D4',
    scale: 'mixolydian',
    drums: [
      { pattern: { 0: 1, 4: 1 }, duration: 0.1, gain: 0.15, colour: 'brown', filterType: 'lowpass', filterFreq: 180 },
    ],
    bass: {
      pattern: { 0: 1, 2: 3, 4: 5, 6: 4 },
      type: 'triangle',
      gain: 0.2,
      filterFreq: 450,
    },
    pads: [
      {
        pattern: { 0: [1, 3, 5], 4: [5, 7, 2] },
        type: 'sine',
        gain: 0.1,
        noteDuration: 3,
        attack: 0.3,
        release: 0.5,
      },
    ],
    melody: {
      pattern: { 1: 3, 3: 5, 5: 4, 7: 5 },
      type: 'triangle',
      gain: 0.12,
      noteDuration: 0.5,
      release: 0.2,
    },
  },

  // ── Caverns ── mysterious, synth pads + crystal sounds
  caverns: {
    bpm: 70,
    loopBeats: 16,
    baseNote: 'A3',
    scale: 'minor',
    drums: [
      { pattern: { 0: 1, 8: 1 }, duration: 0.3, gain: 0.06, colour: 'pink', filterType: 'bandpass', filterFreq: 400, pan: 0.4 },
    ],
    pads: [
      {
        pattern: { 0: [1, 4, 6], 8: [3, 5, 7] },
        type: 'sine',
        gain: 0.16,
        noteDuration: 6,
        attack: 1.0,
        release: 1.2,
        filterFreq: 600,
      },
    ],
    melody: {
      pattern: { 4: 1, 6: 4, 10: 3, 12: 6, 14: 4 },
      type: 'sine',
      gain: 0.08,
      noteDuration: 1.5,
      release: 0.8,
      filterFreq: 1200,
    },
  },

  // ── Lounge ── chill, electronic, soft beats
  lounge: {
    bpm: 100,
    loopBeats: 8,
    baseNote: 'E4',
    scale: 'dorian',
    drums: [
      { pattern: { 0: 1, 4: 1 }, duration: 0.2, gain: 0.18, colour: 'brown', filterType: 'lowpass', filterFreq: 150 },
      { pattern: { 2: 1, 6: 1 }, duration: 0.08, gain: 0.1, colour: 'white', filterType: 'highpass', filterFreq: 8000 },
      { pattern: { 1: 1, 3: 1, 5: 1, 7: 1 }, duration: 0.06, gain: 0.07, colour: 'pink', filterType: 'bandpass', filterFreq: 3000 },
    ],
    bass: {
      pattern: { 0: 1, 3: 4, 5: 3, 7: 5 },
      type: 'sine',
      gain: 0.2,
      filterFreq: 500,
    },
    pads: [
      {
        pattern: { 0: [1, 4, 6], 4: [3, 5, 7] },
        type: 'triangle',
        gain: 0.1,
        noteDuration: 2.5,
        attack: 0.4,
        release: 0.6,
        filterFreq: 1500,
      },
    ],
    melody: {
      pattern: { 1: 4, 2: 6, 4: 3, 6: 5, 7: 7 },
      type: 'sine',
      gain: 0.1,
      noteDuration: 0.6,
      release: 0.3,
    },
  },

  // ── Forest ── magical, woodwind + chimes
  forest: {
    bpm: 75,
    loopBeats: 12,
    baseNote: 'G4',
    scale: 'major',
    drums: [
      { pattern: { 0: 1, 6: 1 }, duration: 0.08, gain: 0.05, colour: 'pink', filterType: 'highpass', filterFreq: 9000, pan: -0.5 },
      { pattern: { 3: 1, 9: 1 }, duration: 0.08, gain: 0.05, colour: 'pink', filterType: 'highpass', filterFreq: 9000, pan: 0.5 },
    ],
    pads: [
      {
        pattern: { 0: [1, 3, 5], 6: [4, 6, 8] },
        type: 'triangle',
        gain: 0.12,
        noteDuration: 4,
        attack: 0.5,
        release: 0.7,
        filterFreq: 1200,
      },
    ],
    melody: {
      pattern: { 2: 5, 4: 8, 8: 3, 10: 5 },
      type: 'sine',
      gain: 0.1,
      noteDuration: 1.0,
      release: 0.5,
    },
  },

  // ── Peaks ── cold, sparse, wind + piano feel
  peaks: {
    bpm: 65,
    loopBeats: 16,
    baseNote: 'E4',
    scale: 'minor',
    drums: [
      { pattern: { 0: 1, 8: 1 }, duration: 0.4, gain: 0.08, colour: 'pink', filterType: 'bandpass', filterFreq: 300, pan: 0.3 },
    ],
    pads: [
      {
        pattern: { 0: [1, 4, 6], 8: [3, 5, 1] },
        type: 'sine',
        gain: 0.14,
        noteDuration: 6,
        attack: 1.2,
        release: 1.5,
        filterFreq: 500,
      },
    ],
    melody: {
      pattern: { 4: 1, 7: 4, 10: 3, 13: 5, 15: 4 },
      type: 'triangle',
      gain: 0.1,
      noteDuration: 1.2,
      release: 0.8,
      filterFreq: 2000,
    },
  },

  // ── Inn ── welcoming, warm, jazzy chords
  inn: {
    bpm: 85,
    loopBeats: 8,
    baseNote: 'C4',
    scale: 'major',
    drums: [
      { pattern: { 0: 1, 3: 1, 4: 1, 7: 1 }, duration: 0.08, gain: 0.12, colour: 'brown', filterType: 'lowpass', filterFreq: 200 },
      { pattern: { 2: 1, 6: 1 }, duration: 0.06, gain: 0.08, colour: 'white', filterType: 'highpass', filterFreq: 7000 },
    ],
    bass: {
      pattern: { 0: 1, 2: 3, 4: 5, 6: 4 },
      type: 'triangle',
      gain: 0.2,
      filterFreq: 400,
    },
    pads: [
      {
        pattern: { 0: [1, 3, 5], 4: [4, 6, 8] },
        type: 'sine',
        gain: 0.12,
        noteDuration: 3,
        attack: 0.3,
        release: 0.5,
      },
    ],
    melody: {
      pattern: { 1: 3, 3: 5, 5: 4, 7: 3 },
      type: 'triangle',
      gain: 0.1,
      noteDuration: 0.5,
      release: 0.2,
    },
  },

  // ── Bazaar ── energetic, exotic, percussion-heavy
  bazaar: {
    bpm: 120,
    loopBeats: 8,
    baseNote: 'D4',
    scale: 'pentatonic',
    drums: [
      { pattern: { 0: 1, 2: 1, 4: 1, 6: 1 }, duration: 0.06, gain: 0.18, colour: 'brown', filterType: 'lowpass', filterFreq: 250 },
      { pattern: { 1: 1, 3: 1, 5: 1, 7: 1 }, duration: 0.04, gain: 0.1, colour: 'white', filterType: 'highpass', filterFreq: 8000 },
      { pattern: { 0: 1, 4: 1 }, duration: 0.15, gain: 0.14, colour: 'pink', filterType: 'bandpass', filterFreq: 600, filterQ: 2 },
    ],
    bass: {
      pattern: { 0: 1, 2: 4, 4: 1, 6: 5 },
      type: 'triangle',
      gain: 0.2,
      filterFreq: 500,
    },
    melody: {
      pattern: { 1: 3, 2: 5, 3: 2, 5: 4, 6: 5, 7: 3 },
      type: 'triangle',
      gain: 0.12,
      noteDuration: 0.35,
      release: 0.1,
    },
  },

  // ── Sunset ── golden, relaxed, guitar feel
  sunset: {
    bpm: 80,
    loopBeats: 8,
    baseNote: 'A3',
    scale: 'major',
    drums: [
      { pattern: { 0: 1, 4: 1 }, duration: 0.12, gain: 0.12, colour: 'brown', filterType: 'lowpass', filterFreq: 180 },
      { pattern: { 2: 1, 6: 1 }, duration: 0.06, gain: 0.07, colour: 'white', filterType: 'highpass', filterFreq: 8000 },
    ],
    bass: {
      pattern: { 0: 1, 3: 4, 5: 5, 7: 4 },
      type: 'triangle',
      gain: 0.18,
      filterFreq: 400,
    },
    pads: [
      {
        pattern: { 0: [1, 3, 5], 4: [4, 6, 8] },
        type: 'sine',
        gain: 0.1,
        noteDuration: 3,
        attack: 0.4,
        release: 0.5,
      },
    ],
    melody: {
      pattern: { 1: 3, 2: 5, 4: 4, 5: 3, 7: 5 },
      type: 'triangle',
      gain: 0.12,
      noteDuration: 0.6,
      release: 0.25,
    },
  },

  // ── Manor ── spooky, dark, minor key
  manor: {
    bpm: 70,
    loopBeats: 16,
    baseNote: 'C4',
    scale: 'minor',
    drums: [
      { pattern: { 0: 1, 8: 1 }, duration: 0.25, gain: 0.1, colour: 'brown', filterType: 'lowpass', filterFreq: 120 },
      { pattern: { 4: 1, 12: 1 }, duration: 0.15, gain: 0.06, colour: 'pink', filterType: 'bandpass', filterFreq: 300, pan: -0.4 },
    ],
    pads: [
      {
        pattern: { 0: [1, 4, 6], 8: [3, 5, 7] },
        type: 'triangle',
        gain: 0.12,
        noteDuration: 6,
        attack: 0.8,
        release: 1.0,
        filterFreq: 800,
      },
    ],
    melody: {
      pattern: { 4: 1, 6: 4, 10: 3, 12: 6, 14: 4 },
      type: 'sine',
      gain: 0.08,
      noteDuration: 1.2,
      release: 0.6,
      filterFreq: 1500,
    },
  },

  // ── Winter ── festive, bells + strings
  winter: {
    bpm: 100,
    loopBeats: 8,
    baseNote: 'G4',
    scale: 'major',
    drums: [
      { pattern: { 0: 1, 4: 1 }, duration: 0.1, gain: 0.1, colour: 'pink', filterType: 'highpass', filterFreq: 6000 },
      { pattern: { 2: 1, 6: 1 }, duration: 0.08, gain: 0.08, colour: 'pink', filterType: 'highpass', filterFreq: 5000, pan: 0.3 },
    ],
    bass: {
      pattern: { 0: 1, 2: 3, 4: 5, 6: 4 },
      type: 'triangle',
      gain: 0.18,
      filterFreq: 450,
    },
    pads: [
      {
        pattern: { 0: [1, 3, 5], 4: [5, 7, 2] },
        type: 'sine',
        gain: 0.12,
        noteDuration: 3,
        attack: 0.3,
        release: 0.5,
      },
    ],
    melody: {
      pattern: { 0: 5, 1: 3, 3: 5, 4: 8, 6: 5, 7: 3 },
      type: 'sine',
      gain: 0.1,
      noteDuration: 0.4,
      release: 0.2,
      filterFreq: 2500,
    },
  },

  // ── Tribal ── rhythmic, drums + chanting feel
  tribal: {
    bpm: 110,
    loopBeats: 8,
    baseNote: 'D3',
    scale: 'pentatonic',
    drums: [
      { pattern: { 0: 1, 2: 1, 4: 1, 6: 1 }, duration: 0.12, gain: 0.2, colour: 'brown', filterType: 'lowpass', filterFreq: 200 },
      { pattern: { 1: 1, 3: 1, 5: 1, 7: 1 }, duration: 0.06, gain: 0.1, colour: 'white', filterType: 'highpass', filterFreq: 7000 },
      { pattern: { 0: 1, 4: 1 }, duration: 0.2, gain: 0.15, colour: 'pink', filterType: 'bandpass', filterFreq: 500, filterQ: 3 },
    ],
    bass: {
      pattern: { 0: 1, 3: 4, 5: 1, 7: 5 },
      type: 'triangle',
      gain: 0.2,
      filterFreq: 400,
    },
    melody: {
      pattern: { 1: 3, 2: 5, 4: 4, 5: 2, 7: 5 },
      type: 'triangle',
      gain: 0.1,
      noteDuration: 0.4,
      release: 0.15,
    },
  },

  // ── Theatre ── dramatic, orchestral, cinematic
  theatre: {
    bpm: 90,
    loopBeats: 16,
    baseNote: 'C4',
    scale: 'minor',
    drums: [
      { pattern: { 0: 1, 4: 1, 8: 1, 12: 1 }, duration: 0.1, gain: 0.14, colour: 'brown', filterType: 'lowpass', filterFreq: 200 },
      { pattern: { 2: 1, 6: 1, 10: 1, 14: 1 }, duration: 0.06, gain: 0.08, colour: 'white', filterType: 'highpass', filterFreq: 7000 },
      { pattern: { 0: 1, 8: 1 }, duration: 0.3, gain: 0.1, colour: 'pink', filterType: 'bandpass', filterFreq: 300, filterQ: 2 },
    ],
    bass: {
      pattern: { 0: 1, 4: 4, 8: 1, 12: 5 },
      type: 'triangle',
      gain: 0.22,
      filterFreq: 400,
    },
    pads: [
      {
        pattern: { 0: [1, 4, 6], 8: [3, 5, 7] },
        type: 'sawtooth',
        gain: 0.1,
        noteDuration: 6,
        attack: 0.5,
        release: 0.8,
        filterType: 'lowpass',
        filterFreq: 1200,
      },
    ],
    melody: {
      pattern: { 2: 4, 4: 6, 6: 3, 8: 5, 10: 4, 12: 1, 14: 3 },
      type: 'triangle',
      gain: 0.12,
      noteDuration: 0.6,
      release: 0.3,
      filterFreq: 2000,
    },
  },
};

/**
 * Area music player for Starlight Inn.
 * Manages procedural looping tracks, cross-fading, and volume control.
 */
class MusicPlayer {
  /** Fade duration in seconds. */
  static FADE_DURATION = 2.0;

  /** Default master music volume. */
  static DEFAULT_VOLUME = 0.5;

  constructor() {
    /** @private @type {AudioContext|null} */
    this._ctx = null;

    /** @private @type {GainNode|null} */
    this._masterGain = null;

    /** @private @type {boolean} */
    this._muted = false;

    /** @private @type {number} */
    this._volume = MusicPlayer.DEFAULT_VOLUME;

    /** @private @type {string|null} */
    this._currentTrack = null;

    /** @private @type {TrackEngine|null} */
    this._engine = null;

    /** @private @type {string|null} */
    this._pendingTrack = null;

    /** @private @type {boolean} */
    this._crossfading = false;

    /** @private @type {number|null} */
    this._fadeInterval = null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Lifecycle
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Initialise the music audio graph.
   * @returns {Promise<AudioContext>}
   */
  async init() {
    if (this._ctx && this._ctx.state !== 'closed') {
      if (this._ctx.state === 'suspended') await this._ctx.resume();
      return this._ctx;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this._ctx = new AudioContextClass({ latencyHint: 'playback', sampleRate: 48000 });

    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._muted ? 0 : this._volume;
    this._masterGain.connect(this._ctx.destination);

    return this._ctx;
  }

  /** Dispose and close audio context. */
  dispose() {
    this.stop();
    if (this._ctx && this._ctx.state !== 'closed') {
      this._ctx.close();
    }
    this._ctx = null;
    this._masterGain = null;
  }

  /** @private */
  _ensureContext() {
    if (!this._ctx) throw new Error('MusicPlayer not initialised. Call init() first.');
    return this._ctx;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Track playback
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Start playing a named track with a fade-in.
   * @param {string} trackName
   */
  playTrack(trackName) {
    if (this._currentTrack === trackName && this._engine) return;

    const ctx = this._ensureContext();

    // Crossfade if already playing
    if (this._engine && this._currentTrack) {
      this.crossfade(trackName);
      return;
    }

    const def = TRACK_DEFS[trackName];
    if (!def) {
      console.warn(`MusicPlayer: unknown track "${trackName}"`);
      return;
    }

    this.stop();
    this._currentTrack = trackName;

    // Fade in
    const now = ctx.currentTime;
    this._masterGain.gain.cancelScheduledValues(now);
    this._masterGain.gain.setValueAtTime(0, now);
    this._masterGain.gain.linearRampToValueAtTime(this._muted ? 0 : this._volume, now + MusicPlayer.FADE_DURATION);

    this._engine = new TrackEngine(ctx, this._masterGain, def);
    this._engine.start();
  }

  /**
   * Stop the current track with a fade-out.
   */
  stop() {
    if (!this._engine) return;

    const ctx = this._ensureContext();
    const now = ctx.currentTime;
    this._masterGain.gain.cancelScheduledValues(now);
    this._masterGain.gain.setValueAtTime(this._masterGain.gain.value, now);
    this._masterGain.gain.linearRampToValueAtTime(0, now + MusicPlayer.FADE_DURATION);

    const engine = this._engine;
    setTimeout(() => {
      engine.stop();
    }, MusicPlayer.FADE_DURATION * 1000 + 100);

    this._engine = null;
    this._currentTrack = null;
    this._crossfading = false;
  }

  /**
   * Crossfade from current track to a new one.
   * @param {string} toTrack
   */
  crossfade(toTrack) {
    if (this._crossfading) return;
    if (!this._engine) {
      this.playTrack(toTrack);
      return;
    }
    if (this._currentTrack === toTrack) return;

    const ctx = this._ensureContext();
    this._crossfading = true;
    this._pendingTrack = toTrack;

    // Fade out current
    const now = ctx.currentTime;
    this._masterGain.gain.cancelScheduledValues(now);
    this._masterGain.gain.setValueAtTime(this._masterGain.gain.value, now);
    this._masterGain.gain.linearRampToValueAtTime(0, now + MusicPlayer.FADE_DURATION);

    const oldEngine = this._engine;
    setTimeout(() => {
      oldEngine.stop();
      if (this._pendingTrack === toTrack) {
        this._engine = null;
        this._currentTrack = null;
        this.playTrack(toTrack);
        this._crossfading = false;
        this._pendingTrack = null;
      }
    }, MusicPlayer.FADE_DURATION * 1000);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Volume / mute API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Set master music volume.
   * @param {number} vol 0–1
   */
  setVolume(vol) {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(
        this._muted ? 0 : this._volume,
        this._ctx.currentTime,
        0.02
      );
    }
  }

  /** @returns {number} Current volume 0–1. */
  getVolume() {
    return this._volume;
  }

  /** Mute music. */
  mute() {
    this._muted = true;
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(0, this._ctx.currentTime, 0.02);
    }
  }

  /** Un-mute music. */
  unmute() {
    this._muted = false;
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(this._volume, this._ctx.currentTime, 0.02);
    }
  }

  /** Toggle mute state. */
  toggleMute() {
    this._muted ? this.unmute() : this.mute();
  }

  /** @returns {boolean} */
  isMuted() {
    return this._muted;
  }

  /** @returns {string|null} */
  getCurrentTrack() {
    return this._currentTrack;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Utilities
  // ═══════════════════════════════════════════════════════════════════════

  /** @returns {string[]} List of available track names. */
  getTrackNames() {
    return Object.keys(TRACK_DEFS);
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  hasTrack(name) {
    return name in TRACK_DEFS;
  }

  /**
   * Get friendly display name for a track.
   * @param {string} trackName
   * @returns {string}
   */
  getDisplayName(trackName) {
    const map = {
      title: 'Title Theme',
      plaza: 'Town Plaza',
      garden: 'Secret Garden',
      beach: 'Sandy Beach',
      tavern: 'Tavern',
      caverns: 'Crystal Caverns',
      lounge: 'Chill Lounge',
      forest: 'Enchanted Forest',
      peaks: 'Snowy Peaks',
      inn: 'Starlight Inn',
      bazaar: 'Night Bazaar',
      sunset: 'Sunset Ridge',
      manor: 'Manor',
      winter: 'Winter Village',
      tribal: 'Tribal Camp',
      theatre: 'Grand Theatre',
    };
    return map[trackName] || trackName;
  }
}

// Singleton export for the game
export const musicPlayer = new MusicPlayer();
export { MusicPlayer, TrackEngine, TRACK_DEFS, MusicUtils, SCALES };
export default MusicPlayer;
