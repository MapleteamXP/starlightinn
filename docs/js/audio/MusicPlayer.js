/**
 * MusicPlayer.js — v8.0 Area Music
 * Seamless ambient music per area with crossfade.
 */
export class MusicPlayer {
  constructor() {
    this.ctx = null;
    this.current = null;
    this.next = null;
    this.gain = null;
    this.nextGain = null;
    this.volume = 0.5;
    this.muted = false;
    this.initialized = false;
    this.tracks = {};
    this._ensureAudioContext();
  }

  _ensureAudioContext() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.muted ? 0 : this.volume;
      this.gain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('[Music] Web Audio API unavailable');
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.gain) this.gain.gain.value = m ? 0 : this.volume;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.gain && !this.muted) this.gain.gain.value = this.volume;
  }

  playArea(areaId) {
    if (this.muted || !this.ctx) return;
    this.resume();
    const track = AREA_TRACKS[areaId] || AREA_TRACKS.default;
    this._playTrack(track);
  }

  _playTrack(fn) {
    if (this.current) {
      try { this.current.stop(); } catch (e) {}
    }
    this.current = fn(this.ctx, this.gain);
  }

  stop() {
    if (this.current) { try { this.current.stop(); } catch (e) {} this.current = null; }
  }
}

// Procedural ambient music generators
function pad(ctx, gain, freq, dur, interval) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2);
  o.connect(g).connect(gain);
  o.start();
  const intervalId = setInterval(() => {
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = 'sine';
    o2.frequency.value = freq * (1 + Math.random() * 0.02);
    g2.gain.value = 0;
    g2.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1);
    g2.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);
    o2.connect(g2).connect(gain);
    o2.start();
    o2.stop(ctx.currentTime + 4);
  }, interval * 1000);
  return { stop: () => { try { o.stop(); clearInterval(intervalId); } catch (e) {} } };
}

const AREA_TRACKS = {
  default: (ctx, gain) => pad(ctx, gain, 220, 60, 4),
  starlight_hub: (ctx, gain) => pad(ctx, gain, 261.63, 60, 3), // C4
  moonlight_garden: (ctx, gain) => pad(ctx, gain, 196.00, 60, 5), // G3
  coral_beach: (ctx, gain) => pad(ctx, gain, 329.63, 60, 4), // E4
  frostpeak: (ctx, gain) => pad(ctx, gain, 174.61, 60, 6), // F3
  emberheart: (ctx, gain) => pad(ctx, gain, 146.83, 60, 4), // D3
  void: (ctx, gain) => pad(ctx, gain, 110.00, 60, 8), // A2
};
