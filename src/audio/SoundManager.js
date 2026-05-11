// ============================================================
// Starlight Engine — Sound Manager (Web Audio API)
// ============================================================

export class SoundManager {
  constructor(enabled = false) {
    this.enabled = enabled;
    this.volume = 0.5;
    this.ctx = null;
  }

  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); }

  _ensureContext() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setEnabled(v) { this.enabled = v; this.stopAmbient(); }

  playAmbient(roomId) {
    this.stopAmbient();
    if (!this.enabled) return;
    this._ensureContext();
    if (!this.ctx) return;
    const ambientConfigs = {
      beach: { freq: 150, type: 'sine', vol: 0.015 },
      forest: { freq: 80, type: 'triangle', vol: 0.012 },
      club: { freq: 60, type: 'sawtooth', vol: 0.01 },
      spa: { freq: 200, type: 'sine', vol: 0.01 },
    };
    const config = ambientConfigs[roomId];
    if (!config) return;
    try {
      this.ambientOsc = this.ctx.createOscillator();
      this.ambientGain = this.ctx.createGain();
      this.ambientOsc.type = config.type;
      this.ambientOsc.frequency.setValueAtTime(config.freq, this.ctx.currentTime);
      this.ambientGain.gain.setValueAtTime(config.vol * this.volume, this.ctx.currentTime);
      this.ambientOsc.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);
      this.ambientOsc.start();
    } catch (e) {}
  }

  stopAmbient() {
    try {
      if (this.ambientOsc) { this.ambientOsc.stop(); this.ambientOsc.disconnect(); this.ambientOsc = null; }
      if (this.ambientGain) { this.ambientGain.disconnect(); this.ambientGain = null; }
    } catch (e) {}
  }

  play(type) {
    if (!this.enabled) return;
    this._ensureContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      switch (type) {
        case 'chat':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(800, now + 0.06);
          gain.gain.setValueAtTime(0.08 * this.volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.start(now); osc.stop(now + 0.1);
          break;
        case 'buy':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(500, now);
          osc.frequency.setValueAtTime(700, now + 0.08);
          osc.frequency.setValueAtTime(900, now + 0.16);
          gain.gain.setValueAtTime(0.1 * this.volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.start(now); osc.stop(now + 0.3);
          break;
        case 'place':
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(300, now);
          osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);
          gain.gain.setValueAtTime(0.1 * this.volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.start(now); osc.stop(now + 0.15);
          break;
        case 'error':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);
          gain.gain.setValueAtTime(0.06 * this.volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(now); osc.stop(now + 0.2);
          break;
        case 'step':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(200, now);
          gain.gain.setValueAtTime(0.04 * this.volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.start(now); osc.stop(now + 0.05);
          break;
        case 'punch':
          osc.type = 'square';
          osc.frequency.setValueAtTime(120, now);
          gain.gain.setValueAtTime(0.1 * this.volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.start(now); osc.stop(now + 0.08);
          break;
        case 'win':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523, now);
          osc.frequency.setValueAtTime(659, now + 0.1);
          osc.frequency.setValueAtTime(784, now + 0.2);
          osc.frequency.setValueAtTime(1047, now + 0.35);
          gain.gain.setValueAtTime(0.1 * this.volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          osc.start(now); osc.stop(now + 0.6);
          break;
        case 'click':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(900, now);
          gain.gain.setValueAtTime(0.05 * this.volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.start(now); osc.stop(now + 0.04);
          break;
        case 'treasure':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(400, now);
          osc.frequency.setValueAtTime(600, now + 0.1);
          osc.frequency.setValueAtTime(800, now + 0.2);
          osc.frequency.setValueAtTime(1000, now + 0.3);
          gain.gain.setValueAtTime(0.1 * this.volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now); osc.stop(now + 0.5);
          break;
        case 'levelup':
          osc.type = 'square';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(554, now + 0.1);
          osc.frequency.setValueAtTime(659, now + 0.2);
          osc.frequency.setValueAtTime(880, now + 0.3);
          osc.frequency.setValueAtTime(1100, now + 0.45);
          gain.gain.setValueAtTime(0.1 * this.volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
          osc.start(now); osc.stop(now + 0.7);
          break;
        case 'quest':
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(523, now);
          osc.frequency.setValueAtTime(659, now + 0.12);
          osc.frequency.setValueAtTime(784, now + 0.24);
          gain.gain.setValueAtTime(0.1 * this.volume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.start(now); osc.stop(now + 0.4);
          break;
      }
    } catch (e) {}
  }

  playTone(freq, duration = 0.15, type = 'sine') {
    if (!this.enabled) return;
    this._ensureContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.1 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  }
}
