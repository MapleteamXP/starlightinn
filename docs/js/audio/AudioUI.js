/**
 * AudioUI.js — v8.0 Mute Buttons + Volume Controls
 * HUD audio controls wired to SoundManager + MusicPlayer.
 */
export class AudioUI {
  constructor(game, soundManager, musicPlayer) {
    this.game = game;
    this.sfx = soundManager;
    this.music = musicPlayer;
    this.container = null;
    this._build();
  }

  _build() {
    // Inject into existing settings panel
    const settingsBody = document.querySelector('#settings-panel .settings-body');
    if (!settingsBody) return;

    // Find sound section or create one
    let section = settingsBody.querySelector('.settings-section[data-section="audio-v8"]');
    if (!section) {
      section = document.createElement('div');
      section.className = 'settings-section';
      section.setAttribute('data-section', 'audio-v8');
      section.innerHTML = '<h4>Audio Controls v8</h4>';
      settingsBody.insertBefore(section, settingsBody.firstChild);
    }

    section.innerHTML = `
      <h4>Audio Controls</h4>
      <div class="audio-row">
        <button id="btn-mute-sfx" class="btn btn-secondary" title="Toggle SFX">🔊 SFX</button>
        <button id="btn-mute-music" class="btn btn-secondary" title="Toggle Music">🎵 Music</button>
        <button id="btn-mute-all" class="btn btn-secondary" title="Mute All">🔇 All</button>
      </div>
      <label>Master
        <input type="range" id="vol-master-v8" min="0" max="100" value="80">
        <span id="val-master-v8">80%</span>
      </label>
      <label>Music
        <input type="range" id="vol-music-v8" min="0" max="100" value="50">
        <span id="val-music-v8">50%</span>
      </label>
      <label>SFX
        <input type="range" id="vol-sfx-v8" min="0" max="100" value="80">
        <span id="val-sfx-v8">80%</span>
      </label>
    `;

    this._bind('btn-mute-sfx', () => {
      const m = !this.sfx.isMuted();
      this.sfx.setMuted(m);
      document.getElementById('btn-mute-sfx').textContent = m ? '🔇 SFX' : '🔊 SFX';
      if (!m) this.sfx.play('click');
    });

    this._bind('btn-mute-music', () => {
      const m = !(this.music && this.music.muted);
      this.music?.setMuted(m);
      document.getElementById('btn-mute-music').textContent = m ? '🔇 Music' : '🎵 Music';
      if (!m) this.sfx?.play('click');
    });

    this._bind('btn-mute-all', () => {
      const m = !((this.sfx && this.sfx.isMuted()) || (this.music && this.music.muted));
      this.sfx?.setMuted(m);
      this.music?.setMuted(m);
      document.getElementById('btn-mute-all').textContent = m ? '🔇 All' : '🔊 All';
      document.getElementById('btn-mute-sfx').textContent = m ? '🔇 SFX' : '🔊 SFX';
      document.getElementById('btn-mute-music').textContent = m ? '🔇 Music' : '🎵 Music';
    });

    this._bindRange('vol-master-v8', v => {
      this.sfx?.setVolume(v);
      this.music?.setVolume(v);
    });
    this._bindRange('vol-music-v8', v => this.music?.setVolume(v));
    this._bindRange('vol-sfx-v8', v => this.sfx?.setVolume(v));
  }

  _bind(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  _bindRange(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const v = parseInt(el.value, 10) / 100;
      const label = document.getElementById(id.replace('vol-', 'val-'));
      if (label) label.textContent = el.value + '%';
      fn(v);
    });
  }
}
