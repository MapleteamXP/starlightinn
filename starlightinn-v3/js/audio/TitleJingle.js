/**
 * @fileoverview Starlight Inn — TitleJingle
 * A Harry Potter-inspired magical title jingle using ONLY the Web Audio API.
 * Celesta-like bells in D minor, shimmering arpeggios, dramatic chords,
 * and a sparkle cascade — all synthesized in real-time with oscillators.
 *
 * Key: D minor (mystical, magical)
 * Tempo: 80 BPM  (beat = 0.75 s)
 * Instrument: Celesta (sine + triangle, quick attack, exponential decay)
 *
 * Structure:
 *   1. Opening    — Single high D sustained with slow shimmer
 *   2. Hedwig     — Descending motif B-A-F#-E-D (the signature phrase)
 *   3. Arpeggio   — Dm broken chord weaving around the motif
 *   4. Chords     — Dm → Bb → F → C  (dramatic progression)
 *   5. Sparkle    — High notes cascading like magic dust
 *   6. Resolution — Final Dm chord, sustained with slow fade
 *
 * @author Starlight Inn Audio Team
 * @version 8.0.0
 * @license MIT
 */

/**
 * Complete note-name → frequency map (A4 = 440 Hz, equal temperament).
 * Covers the full range needed for the jingle, from warm bass to airy treble.
 * @type {Object<string, number>}
 */
const NOTE_FREQ = {
  // Octave 3 — warm bass for chord roots
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56,
  'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00,
  'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,

  // Octave 4 — melody & mid-range chords
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13,
  'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00,
  'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,

  // Octave 5 — primary melody & Hedwig motif
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25,
  'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99,
  'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,

  // Octave 6 — sparkle & opening shimmer
  'C6': 1046.50, 'C#6': 1108.73, 'D6': 1174.66, 'D#6': 1244.51,
  'E6': 1318.51, 'F6': 1396.91, 'F#6': 1479.98, 'G6': 1567.98,
  'G#6': 1661.22, 'A6': 1760.00, 'A#6': 1864.66, 'B6': 1975.53,

  // Octave 7 — air, glitter, highest sparkle overtones
  'C7': 2093.00, 'D7': 2349.32, 'E7': 2637.02, 'F7': 2793.83,
  'G7': 3135.96, 'A7': 3520.00, 'B7': 3951.07,
};

/**
 * Named chord voicings in the D-minor palette.
 * Each chord is voiced for smooth voice-leading and magical spread.
 * @type {Object<string, string[]>}
 */
const CHORDS = {
  dm:   ['D3', 'A3', 'D4', 'F4', 'A4'],        // D minor — root position, open 5th on top
  dm7:  ['D3', 'F3', 'A3', 'C4', 'D4'],        // Dm7 — add the minor-7th colour
  bb:   ['Bb2', 'F3', 'Bb3', 'D4', 'F4'],      // Bb major — warm, subdominant glow
  f:    ['F3', 'A3', 'C4', 'F4', 'A4'],        // F major — hopeful lift
  c:    ['C3', 'G3', 'C4', 'E4', 'G4'],        // C major — dramatic pre-dominant
  gm:   ['G3', 'Bb3', 'D4', 'G4'],             // G minor — dark pivot
  a7:   ['A3', 'E4', 'G4', 'C#5'],             // A7 (dominant) — tension before resolution
};

/**
 * Hedwig's Theme core motif — the instantly-recognisable descending
 * minor-third figure that screams "magic school".  In D minor:
 *   B4 → A4 → F#4 → E4 → D4
 * @type {string[]}
 */
const HEDWIG_MOTIF = ['B4', 'A4', 'F#4', 'E4', 'D4'];

/**
 * A rising D-minor broken-chord counter-figure that weaves beneath
 * the Hedwig descent, giving the melody a harp-like texture.
 * @type {string[]}
 */
const BROKEN_CHORD = ['D4', 'F4', 'A4', 'D5', 'A4', 'F4', 'D4'];

/**
 * Pool of notes for the sparkle cascade — weighted toward the
 * D-minor pentatonic subset so every glint sounds consonant.
 * @type {string[]}
 */
const SPARKLE_POOL = [
  'D5', 'F5', 'A5', 'B5', 'D6',
  'F6', 'A6', 'D6', 'B5', 'A5',
  'F5', 'D5', 'A5', 'D6', 'F6',
  'D7', 'A6', 'F6', 'D6', 'B5',
];

class TitleJingle {
  constructor() {
    /** @private @type {AudioContext|null} */
    this._ctx = null;

    /** @private @type {GainNode|null} */
    this._masterGain = null;

    /** @private @type {boolean} */
    this._muted = false;

    /** @private @type {number} */
    this._masterVolume = 0.28;

    /** @private @type {number|null} */
    this._loopTimer = null;

    /** @private @type {boolean} */
    this._isPlaying = false;

    /** @private @type {number} */
    this._beat = 0.75; // 80 BPM

    /** @private @type {number} */
    this._activeVoices = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Lifecycle
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Initialise the AudioContext.  Safe to call multiple times.
   * Must be triggered by a user gesture on first load.
   * @returns {AudioContext}
   */
  init() {
    if (this._ctx && this._ctx.state !== 'closed') {
      if (this._ctx.state === 'suspended') this._ctx.resume();
      return this._ctx;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this._ctx = new AudioContextClass({
      latencyHint: 'interactive',
      sampleRate: 48000,
    });

    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._muted ? 0 : this._masterVolume;
    this._masterGain.connect(this._ctx.destination);

    // Global accessors for external mute wiring
    window.jingleCtx = this._ctx;
    window.jingleGain = this._masterGain;

    // Auto-resume on first interaction
    this._resumeOnInteraction = () => {
      if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume();
    };
    document.addEventListener('click', this._resumeOnInteraction, { once: true });
    document.addEventListener('keydown', this._resumeOnInteraction, { once: true });
    document.addEventListener('touchstart', this._resumeOnInteraction, { once: true });

    return this._ctx;
  }

  /** Tear down the jingle system. */
  dispose() {
    this.stopLoop();
    document.removeEventListener('click', this._resumeOnInteraction);
    document.removeEventListener('keydown', this._resumeOnInteraction);
    document.removeEventListener('touchstart', this._resumeOnInteraction);
    if (this._ctx && this._ctx.state !== 'closed') this._ctx.close();
    this._ctx = null;
    this._masterGain = null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Playback Core
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Play the complete magical title sequence.
   * If the context is not ready it will be initialised lazily.
   */
  play() {
    if (this._muted) return;
    if (!this._ctx) this.init();
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().then(() => this._scheduleSequence());
      return;
    }
    this._scheduleSequence();
  }

  /** @private */
  _scheduleSequence() {
    if (this._isPlaying) return;
    this._isPlaying = true;

    const now = this._ctx.currentTime;
    const b = this._beat;

    // ── 1. OPENING — high D6 with slow shimmer ─────────────────────────
    this._playBell('D6', now, b * 3, 0.35, {
      shimmer: true,
      shimmerDepth: 2.5,
      shimmerRate: 5.5,
      pan: 0,
      overtoneMix: 0.12,
    });

    // Subtle harmonic support — an octave below
    this._playBell('D5', now + b * 0.25, b * 2.5, 0.12, {
      shimmer: false,
      pan: 0,
      overtoneMix: 0.05,
    });

    // ── 2. HEDWIG MOTIF — descending B-A-F#-E-D ───────────────────────
    const motifStart = now + b * 2.5;
    HEDWIG_MOTIF.forEach((note, i) => {
      const time = motifStart + i * (b * 0.55);
      const dur = b * (i === 0 ? 1.2 : 0.9);
      const vol = i === 0 ? 0.32 : 0.28 - i * 0.02;
      const pan = (i / (HEDWIG_MOTIF.length - 1)) * 0.5 - 0.25; // gentle L→R sweep
      this._playBell(note, time, dur, vol, {
        shimmer: i === 0,
        shimmerDepth: 1.8,
        shimmerRate: 4.0,
        pan,
        overtoneMix: 0.08,
      });
    });

    // ── 3. BROKEN CHORD — harp-like arpeggio weaving underneath ────────
    const arpStart = motifStart + b * 0.3;
    BROKEN_CHORD.forEach((note, i) => {
      const time = arpStart + i * (b * 0.35);
      const vol = 0.12 - i * 0.008;
      const pan = Math.sin(i * 0.8) * 0.35;
      this._playBell(note, time, b * 0.7, vol, {
        shimmer: false,
        pan,
        overtoneMix: 0.04,
        attack: 0.02,
      });
    });

    // ── 4. CHORD PROGRESSION — Dm → Bb → F → C ────────────────────────
    const chordStart = motifStart + b * 3.2;
    const progression = [
      { chord: 'dm',  duration: b * 2.0, volume: 0.18 },
      { chord: 'bb',  duration: b * 1.8, volume: 0.16 },
      { chord: 'f',   duration: b * 1.8, volume: 0.17 },
      { chord: 'c',   duration: b * 2.2, volume: 0.15 },
    ];

    let chordTime = chordStart;
    progression.forEach((prog) => {
      const notes = CHORDS[prog.chord];
      notes.forEach((note, voiceIndex) => {
        const voiceVol = prog.volume * (1 - voiceIndex * 0.12);
        const voicePan = (voiceIndex / (notes.length - 1)) * 0.6 - 0.3;
        this._playBell(note, chordTime, prog.duration, voiceVol, {
          shimmer: voiceIndex < 2,
          shimmerDepth: 1.5,
          shimmerRate: 3.0 + voiceIndex,
          pan: voicePan,
          overtoneMix: 0.06,
          attack: 0.04,
        });
      });
      chordTime += prog.duration * 0.85; // slight overlap for legato
    });

    // ── 5. SPARKLE CASCADE — magic dust falling ───────────────────────
    const sparkleStart = chordStart + b * 1.5;
    const sparkleCount = 14;
    for (let i = 0; i < sparkleCount; i++) {
      const note = SPARKLE_POOL[Math.floor(Math.random() * SPARKLE_POOL.length)];
      const time = sparkleStart + i * (b * 0.18) + Math.random() * 0.06;
      const dur = b * (0.25 + Math.random() * 0.35);
      const vol = 0.08 + Math.random() * 0.08;
      const pan = Math.random() * 1.4 - 0.7;
      this._playBell(note, time, dur, vol, {
        shimmer: false,
        pan,
        overtoneMix: 0.03,
        attack: 0.008,
      });
      // Occasionally add a tiny echo sparkle an octave lower
      if (Math.random() < 0.35) {
        const echoNote = this._dropOctave(note);
        this._playBell(echoNote, time + b * 0.12, dur * 0.6, vol * 0.4, {
          shimmer: false,
          pan: -pan,
          overtoneMix: 0.0,
          attack: 0.015,
        });
      }
    }

    // ── 6. RESOLUTION — final Dm chord, sustained with slow fade ──────
    const resolveStart = chordTime + b * 0.6;
    const resolveNotes = CHORDS.dm;
    resolveNotes.forEach((note, i) => {
      const vol = 0.20 - i * 0.025;
      const pan = (i / (resolveNotes.length - 1)) * 0.5 - 0.25;
      this._playBell(note, resolveStart, b * 4.5, vol, {
        shimmer: i < 3,
        shimmerDepth: 2.0,
        shimmerRate: 2.5 + i * 0.5,
        pan,
        overtoneMix: i === 0 ? 0.10 : 0.05,
        attack: 0.06,
        release: b * 3.5,
      });
    });

    // Add a soft high harmonic on the resolution for "celestial" glow
    this._playBell('D6', resolveStart + b * 0.5, b * 3.5, 0.06, {
      shimmer: true,
      shimmerDepth: 3.0,
      shimmerRate: 6.0,
      pan: 0,
      overtoneMix: 0.0,
      attack: 0.08,
      release: b * 3.0,
    });

    // Release the playing lock after the sequence ends
    const totalDuration = (resolveStart - now) + b * 5;
    setTimeout(() => { this._isPlaying = false; }, totalDuration * 1000 + 200);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Bell Synthesis (Celesta)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Synthesise a single magical bell note.
   *
   * Architecture:
   *   - Primary oscillator: sine wave (pure bell body)
   *   - Overtone oscillator: triangle wave 1 octave up (bell brightness)
   *   - Optional shimmer: slow vibrato on frequency for magical waver
   *   - Envelope: very fast attack → exponential decay (bell decay)
   *   - Stereo panning per note for spatial spread
   *
   * @private
   * @param {string} noteName     e.g. "D5"
   * @param {number} startTime    AudioContext time
   * @param {number} duration     Sustain length (seconds)
   * @param {number} volume       Peak gain (0–1)
   * @param {Object} [opts]
   * @param {boolean} [opts.shimmer=false]   Enable vibrato shimmer
   * @param {number} [opts.shimmerDepth=2]   Vibrato depth in Hz
   * @param {number} [opts.shimmerRate=4]   Vibrato rate in Hz
   * @param {number} [opts.pan=0]           Stereo pan (-1 … 1)
   * @param {number} [opts.overtoneMix=0.1] Triangle-wave blend (0–1)
   * @param {number} [opts.attack=0.03]      Attack time (seconds)
   * @param {number} [opts.release]          Override release time
   */
  _playBell(noteName, startTime, duration, volume, opts = {}) {
    if (!this._ctx || !this._masterGain) return;

    const {
      shimmer = false,
      shimmerDepth = 2,
      shimmerRate = 4,
      pan = 0,
      overtoneMix = 0.1,
      attack = 0.03,
      release = duration * 0.6,
    } = opts;

    const freq = NOTE_FREQ[noteName] || 440;
    const endTime = startTime + attack + duration + release + 0.05;

    // ── Main sine oscillator (bell body) ──
    const oscSine = this._ctx.createOscillator();
    oscSine.type = 'sine';
    oscSine.frequency.setValueAtTime(freq, startTime);

    if (shimmer) {
      // Slow vibrato = magical shimmer (like a celesta in a vast hall)
      const lfo = this._ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = shimmerRate;
      const lfoGain = this._ctx.createGain();
      lfoGain.gain.value = shimmerDepth;
      lfo.connect(lfoGain);
      lfoGain.connect(oscSine.frequency);
      lfo.start(startTime);
      lfo.stop(endTime);
    }

    // ── Triangle overtone (bell brightness, 1 octave up) ──
    let oscTri = null;
    if (overtoneMix > 0) {
      oscTri = this._ctx.createOscillator();
      oscTri.type = 'triangle';
      oscTri.frequency.setValueAtTime(freq * 2, startTime);
      if (shimmer) {
        const lfo2 = this._ctx.createOscillator();
        lfo2.type = 'sine';
        lfo2.frequency.value = shimmerRate * 1.3; // slightly offset rate for beating
        const lfoGain2 = this._ctx.createGain();
        lfoGain2.gain.value = shimmerDepth * 0.7;
        lfo2.connect(lfoGain2);
        lfoGain2.connect(oscTri.frequency);
        lfo2.start(startTime);
        lfo2.stop(endTime);
      }
    }

    // ── Per-note gain envelope (bell ADSR) ──
    const noteGain = this._ctx.createGain();
    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(volume, startTime + attack);
    noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + attack + duration + release);

    // ── Panning ──
    const panner = this._ctx.createStereoPanner();
    panner.pan.value = pan;

    // ── Chain & start ──
    oscSine.connect(noteGain);
    if (oscTri) {
      const overtoneGain = this._ctx.createGain();
      overtoneGain.gain.value = overtoneMix;
      oscTri.connect(overtoneGain);
      overtoneGain.connect(noteGain);
    }

    noteGain.connect(panner);
    panner.connect(this._masterGain);

    oscSine.start(startTime);
    oscSine.stop(endTime);
    if (oscTri) {
      oscTri.start(startTime);
      oscTri.stop(endTime);
    }

    this._activeVoices++;
    oscSine.addEventListener('ended', () => {
      this._activeVoices--;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Utility
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Drop a note name by one octave (e.g. "D6" → "D5").
   * @private
   * @param {string} note
   * @returns {string}
   */
  _dropOctave(note) {
    const match = note.match(/^([A-G]#?)(\d)$/);
    if (!match) return note;
    const name = match[1];
    const oct = parseInt(match[2], 10);
    return oct > 3 ? `${name}${oct - 1}` : note;
  }

  /**
   * Look up a frequency from a note name.
   * @param {string} noteName  e.g. "D5"
   * @returns {number} Frequency in Hz
   */
  noteToFreq(noteName) {
    return NOTE_FREQ[noteName] || 440;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Looping
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Start auto-looping the jingle.
   * @param {number} [delaySeconds=35] Seconds between plays
   */
  loop(delaySeconds = 35) {
    this.stopLoop();
    this.play();
    this._loopTimer = setInterval(() => {
      if (!this._muted) this.play();
    }, delaySeconds * 1000);
  }

  /** Stop the auto-loop timer. */
  stopLoop() {
    if (this._loopTimer) {
      clearInterval(this._loopTimer);
      this._loopTimer = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Volume / Mute
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Set the master jingle volume.
   * @param {number} vol 0–1
   */
  setVolume(vol) {
    this._masterVolume = Math.max(0, Math.min(1, vol));
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(
        this._muted ? 0 : this._masterVolume,
        this._ctx?.currentTime ?? 0,
        0.03
      );
    }
  }

  /** @returns {number} */
  getVolume() {
    return this._masterVolume;
  }

  /** Mute the jingle immediately. */
  mute() {
    this._muted = true;
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(0, this._ctx?.currentTime ?? 0, 0.03);
    }
  }

  /** Un-mute the jingle. */
  unmute() {
    this._muted = false;
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(this._masterVolume, this._ctx?.currentTime ?? 0, 0.03);
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

  // ═══════════════════════════════════════════════════════════════════════
  //  Debug / Introspection
  // ═══════════════════════════════════════════════════════════════════════

  /** @returns {number} Currently active oscillator voices. */
  getActiveVoices() {
    return this._activeVoices;
  }

  /** @returns {boolean} Whether the jingle sequence is currently playing. */
  isPlaying() {
    return this._isPlaying;
  }

  /** @returns {AudioContextState|null} */
  getContextState() {
    return this._ctx?.state ?? null;
  }
}

export { TitleJingle };
export default TitleJingle;
