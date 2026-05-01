/**
 * @fileoverview Starlight Inn v8.0 — AudioUI
 * Glass-morphism audio control panel that integrates with
 * SoundManager and MusicPlayer. Provides in-game speaker
 * icon, sliding panel, and per-channel mix controls.
 *
 * @author Starlight Inn Audio Team
 * @version 8.0.0
 * @license MIT
 */

/**
 * CSS string injected once on first AudioUI creation.
 * Glass-morphism theme matching the rest of the game.
 * @type {string}
 */
const AUDIO_UI_CSS = `
/* ── Audio Icon (top-right) ── */
#si-audio-icon {
  position: fixed;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  z-index: 9999;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.10);
  backdrop-filter: blur(12px) saturate(160%);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
#si-audio-icon:hover {
  background: rgba(255, 255, 255, 0.22);
  transform: scale(1.08);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
}
#si-audio-icon:active {
  transform: scale(0.96);
}
#si-audio-icon svg {
  width: 20px;
  height: 20px;
  fill: rgba(255, 255, 255, 0.92);
  pointer-events: none;
}
#si-audio-icon.muted svg {
  fill: rgba(255, 120, 120, 0.92);
}

/* ── Audio Panel ── */
#si-audio-panel {
  position: fixed;
  top: -600px;
  right: 12px;
  width: 300px;
  max-height: calc(100vh - 70px);
  overflow-y: auto;
  z-index: 9998;
  background: rgba(20, 20, 35, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.40);
  transition: top 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
  opacity: 0;
  color: rgba(255, 255, 255, 0.92);
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  font-size: 13px;
  user-select: none;
}
#si-audio-panel.open {
  top: 58px;
  opacity: 1;
}
#si-audio-panel::-webkit-scrollbar { width: 4px; }
#si-audio-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

/* ── Panel Header ── */
.si-audio-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.si-audio-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: rgba(255, 255, 255, 0.95);
}
.si-audio-close {
  width: 24px;
  height: 24px;
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: opacity 0.15s ease;
}
.si-audio-close:hover { opacity: 1; }
.si-audio-close svg { width: 14px; height: 14px; fill: #fff; }

/* ── Sections ── */
.si-audio-section {
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.si-audio-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}
.si-audio-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 10px;
}

/* ── Row Layout ── */
.si-audio-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.si-audio-row:last-child { margin-bottom: 0; }
.si-audio-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  min-width: 50px;
}

/* ── Sliders ── */
.si-audio-slider {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.12);
  outline: none;
  cursor: pointer;
}
.si-audio-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease, background 0.15s ease;
}
.si-audio-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  background: #aecbfa;
}
.si-audio-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  border: none;
  cursor: pointer;
}
.si-audio-slider::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.12);
}
.si-audio-value {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  min-width: 30px;
  text-align: right;
}

/* ── Buttons ── */
.si-audio-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  padding: 5px 12px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.si-audio-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.25);
}
.si-audio-btn:active {
  background: rgba(255, 255, 255, 0.22);
}
.si-audio-btn.active {
  background: rgba(100, 180, 255, 0.25);
  border-color: rgba(100, 180, 255, 0.45);
  color: #aecbfa;
}
.si-audio-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

/* ── Select / Dropdown ── */
.si-audio-select {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  padding: 5px 8px;
  cursor: pointer;
  outline: none;
  flex: 1;
}
.si-audio-select option {
  background: #1a1a2e;
  color: #fff;
}

/* ── Presets ── */
.si-audio-presets {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  margin-top: 4px;
}

/* ── Track info ── */
.si-audio-track-info {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
  text-align: center;
  margin-top: 6px;
}

/* ── Divider ── */
.si-audio-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 10px 0;
}
`;

/**
 * In-game audio control panel with glass-morphism styling.
 * Hooks into the exported {@link soundManager} and {@link musicPlayer} singletons.
 */
class AudioUI {
  /**
   * @param {Object} deps
   * @param {import('./SoundManager').default} deps.soundManager
   * @param {import('./MusicPlayer').default} deps.musicPlayer
   */
  constructor({ soundManager, musicPlayer }) {
    /** @private @type {import('./SoundManager').default} */
    this._sm = soundManager;
    /** @private @type {import('./MusicPlayer').default} */
    this._mp = musicPlayer;

    /** @private @type {boolean} */
    this._open = false;

    /** @private @type {boolean} */
    this._cssInjected = false;

    /** @private @type {HTMLElement|null} */
    this._icon = null;

    /** @private @type {HTMLElement|null} */
    this._panel = null;

    /** @private @type {HTMLInputElement|null} */
    this._musicVolSlider = null;

    /** @private @type {HTMLInputElement|null} */
    this._sfxVolSlider = null;

    /** @private @type {HTMLInputElement|null} */
    this._masterVolSlider = null;

    /** @private @type {HTMLSelectElement|null} */
    this._trackSelect = null;

    /** @private @type {HTMLElement|null} */
    this._trackInfo = null;

    /** @private @type {HTMLButtonElement|null} */
    this._musicMuteBtn = null;

    /** @private @type {HTMLButtonElement|null} */
    this._sfxMuteBtn = null;

    /** @private @type {HTMLButtonElement|null} */
    this._masterMuteBtn = null;

    this._boundOnDocClick = this._onDocClick.bind(this);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Setup
  // ═══════════════════════════════════════════════════════════════════════

  /** Create DOM elements and attach to document. */
  mount() {
    if (this._icon) return; // already mounted
    this._injectCSS();
    this._buildIcon();
    this._buildPanel();
    document.body.appendChild(this._icon);
    document.body.appendChild(this._panel);
    this._syncFromState();
    document.addEventListener('click', this._boundOnDocClick);
  }

  /** Remove DOM and listeners. */
  unmount() {
    document.removeEventListener('click', this._boundOnDocClick);
    if (this._icon) { this._icon.remove(); this._icon = null; }
    if (this._panel) { this._panel.remove(); this._panel = null; }
    this._open = false;
  }

  /** @private */
  _injectCSS() {
    if (this._cssInjected) return;
    const style = document.createElement('style');
    style.id = 'si-audio-ui-styles';
    style.textContent = AUDIO_UI_CSS;
    document.head.appendChild(style);
    this._cssInjected = true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Icon
  // ═══════════════════════════════════════════════════════════════════════

  /** @private */
  _buildIcon() {
    const icon = document.createElement('div');
    icon.id = 'si-audio-icon';
    icon.innerHTML = this._svgSpeaker();
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePanel();
    });
    this._icon = icon;
  }

  /** @private */
  _svgSpeaker() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 9v6h4l5 5V4L7 9H3z"/>
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
      <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>`;
  }

  /** @private */
  _svgSpeakerMuted() {
    return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.9 8.9 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
    </svg>`;
  }

  /** @private */
  _updateIcon() {
    if (!this._icon) return;
    const muted = this._sm.isMuted() && this._mp.isMuted();
    this._icon.innerHTML = muted ? this._svgSpeakerMuted() : this._svgSpeaker();
    this._icon.classList.toggle('muted', muted);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Panel
  // ═══════════════════════════════════════════════════════════════════════

  /** @private */
  _buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'si-audio-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'si-audio-header';
    const title = document.createElement('h3');
    title.textContent = 'Audio Settings';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'si-audio-close';
    closeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.closePanel(); });
    header.append(title, closeBtn);
    panel.appendChild(header);

    // ── Music Section ──
    const musicSection = this._buildSection('Music', 'music_note');
    this._musicMuteBtn = this._buildMuteButton('music');
    this._musicMuteBtn.addEventListener('click', () => this._toggleMusicMute());
    musicSection.appendChild(this._wrapRow('Mute', this._musicMuteBtn));

    const { slider: mSlider, value: mValue } = this._buildSlider(0, 100, 50);
    this._musicVolSlider = mSlider;
    this._musicVolValue = mValue;
    mSlider.addEventListener('input', () => {
      const v = parseInt(mSlider.value, 10);
      mValue.textContent = `${v}%`;
      this._mp.setVolume(v / 100);
    });
    musicSection.appendChild(this._wrapRow('Volume', mSlider, mValue));

    this._trackSelect = document.createElement('select');
    this._trackSelect.className = 'si-audio-select';
    this._mp.getTrackNames().forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = this._mp.getDisplayName(name);
      this._trackSelect.appendChild(opt);
    });
    this._trackSelect.addEventListener('change', () => {
      this._mp.playTrack(this._trackSelect.value);
      this._updateTrackInfo();
    });
    musicSection.appendChild(this._wrapRow('Track', this._trackSelect));

    this._trackInfo = document.createElement('div');
    this._trackInfo.className = 'si-audio-track-info';
    this._trackInfo.textContent = 'No track playing';
    musicSection.appendChild(this._trackInfo);
    panel.appendChild(musicSection);

    // ── SFX Section ──
    const sfxSection = this._buildSection('Sound Effects', 'volume_up');
    this._sfxMuteBtn = this._buildMuteButton('sfx');
    this._sfxMuteBtn.addEventListener('click', () => this._toggleSfxMute());
    sfxSection.appendChild(this._wrapRow('Mute', this._sfxMuteBtn));

    const { slider: sSlider, value: sValue } = this._buildSlider(0, 100, 75);
    this._sfxVolSlider = sSlider;
    this._sfxVolValue = sValue;
    sSlider.addEventListener('input', () => {
      const v = parseInt(sSlider.value, 10);
      sValue.textContent = `${v}%`;
      this._sm.setVolume(v / 100);
    });
    sfxSection.appendChild(this._wrapRow('Volume', sSlider, sValue));

    const testBtn = document.createElement('button');
    testBtn.className = 'si-audio-btn';
    testBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Test`;
    testBtn.addEventListener('click', () => this._sm.play('click_soft'));
    sfxSection.appendChild(this._wrapRow('', testBtn));
    panel.appendChild(sfxSection);

    // ── Master Section ──
    const masterSection = this._buildSection('Master', 'tune');
    this._masterMuteBtn = this._buildMuteButton('all');
    this._masterMuteBtn.addEventListener('click', () => this._toggleMasterMute());
    masterSection.appendChild(this._wrapRow('Mute All', this._masterMuteBtn));

    const { slider: msSlider, value: msValue } = this._buildSlider(0, 100, 75);
    this._masterVolSlider = msSlider;
    this._masterVolValue = msValue;
    msSlider.addEventListener('input', () => {
      const v = parseInt(msSlider.value, 10);
      msValue.textContent = `${v}%`;
      this._sm.setVolume(v / 100);
      this._mp.setVolume(v / 100);
    });
    masterSection.appendChild(this._wrapRow('Master', msSlider, msValue));
    panel.appendChild(masterSection);

    // ── Presets ──
    const presetSection = this._buildSection('Presets', 'settings');
    const presetsWrap = document.createElement('div');
    presetsWrap.className = 'si-audio-presets';
    const presets = [
      { id: 'full', label: 'Full' },
      { id: 'music_only', label: 'Music Only' },
      { id: 'sfx_only', label: 'SFX Only' },
      { id: 'silent', label: 'Silent' },
    ];
    presets.forEach((p) => {
      const btn = document.createElement('button');
      btn.className = 'si-audio-btn';
      btn.dataset.preset = p.id;
      btn.textContent = p.label;
      btn.addEventListener('click', () => this._applyPreset(p.id, btn));
      presetsWrap.appendChild(btn);
    });
    presetSection.appendChild(presetsWrap);
    panel.appendChild(presetSection);

    this._panel = panel;
  }

  /** @private */
  _buildSection(titleText, iconName) {
    const section = document.createElement('div');
    section.className = 'si-audio-section';
    const title = document.createElement('div');
    title.className = 'si-audio-section-title';
    title.textContent = titleText;
    section.appendChild(title);
    return section;
  }

  /** @private */
  _buildMuteButton(kind) {
    const btn = document.createElement('button');
    btn.className = 'si-audio-btn';
    btn.dataset.kind = kind;
    const icon = kind === 'music'
      ? '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>'
      : kind === 'sfx'
        ? '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>';
    btn.innerHTML = `${icon} Mute`;
    return btn;
  }

  /** @private */
  _buildSlider(min, max, start) {
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'si-audio-slider';
    slider.min = String(min);
    slider.max = String(max);
    slider.value = String(start);
    const value = document.createElement('span');
    value.className = 'si-audio-value';
    value.textContent = `${start}%`;
    return { slider, value };
  }

  /** @private */
  _wrapRow(label, ...controls) {
    const row = document.createElement('div');
    row.className = 'si-audio-row';
    if (label) {
      const lbl = document.createElement('span');
      lbl.className = 'si-audio-label';
      lbl.textContent = label;
      row.appendChild(lbl);
    }
    controls.forEach((c) => row.appendChild(c));
    return row;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Panel state
  // ═══════════════════════════════════════════════════════════════════════

  /** Open the audio panel. */
  openPanel() {
    this._open = true;
    if (this._panel) this._panel.classList.add('open');
    this._updateTrackInfo();
  }

  /** Close the audio panel. */
  closePanel() {
    this._open = false;
    if (this._panel) this._panel.classList.remove('open');
  }

  /** Toggle panel open/closed. */
  togglePanel() {
    this._open ? this.closePanel() : this.openPanel();
  }

  /** @private */
  _onDocClick(e) {
    if (!this._open) return;
    const target = /** @type {Node} */ (e.target);
    if (this._panel && !this._panel.contains(target) && this._icon && !this._icon.contains(target)) {
      this.closePanel();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Mute toggles
  // ═══════════════════════════════════════════════════════════════════════

  /** @private */
  _toggleMusicMute() {
    this._mp.toggleMute();
    this._musicMuteBtn.classList.toggle('active', this._mp.isMuted());
    this._updateIcon();
  }

  /** @private */
  _toggleSfxMute() {
    this._sm.toggleMute();
    this._sfxMuteBtn.classList.toggle('active', this._sm.isMuted());
    this._updateIcon();
  }

  /** @private */
  _toggleMasterMute() {
    if (this._sm.isMuted() || this._mp.isMuted()) {
      this._sm.unmute();
      this._mp.unmute();
    } else {
      this._sm.mute();
      this._mp.mute();
    }
    this._masterMuteBtn.classList.toggle('active', this._sm.isMuted() && this._mp.isMuted());
    this._musicMuteBtn.classList.toggle('active', this._mp.isMuted());
    this._sfxMuteBtn.classList.toggle('active', this._sm.isMuted());
    this._updateIcon();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Presets
  // ═══════════════════════════════════════════════════════════════════════

  /** @private */
  _applyPreset(id, btn) {
    // Remove active from all preset buttons
    this._panel.querySelectorAll('.si-audio-presets .si-audio-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    switch (id) {
      case 'full':
        this._sm.unmute();
        this._mp.unmute();
        this._sm.setVolume(0.75);
        this._mp.setVolume(0.50);
        break;
      case 'music_only':
        this._sm.mute();
        this._mp.unmute();
        this._mp.setVolume(0.60);
        break;
      case 'sfx_only':
        this._sm.unmute();
        this._mp.mute();
        this._sm.setVolume(0.80);
        break;
      case 'silent':
        this._sm.mute();
        this._mp.mute();
        break;
    }
    this._syncFromState();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Sync UI from engine state
  // ═══════════════════════════════════════════════════════════════════════

  /** Refresh all UI controls to match current audio state. */
  _syncFromState() {
    // Music
    const mv = Math.round(this._mp.getVolume() * 100);
    if (this._musicVolSlider) {
      this._musicVolSlider.value = String(mv);
      this._musicVolValue.textContent = `${mv}%`;
    }
    if (this._musicMuteBtn) this._musicMuteBtn.classList.toggle('active', this._mp.isMuted());

    // SFX
    const sv = Math.round(this._sm.getVolume() * 100);
    if (this._sfxVolSlider) {
      this._sfxVolSlider.value = String(sv);
      this._sfxVolValue.textContent = `${sv}%`;
    }
    if (this._sfxMuteBtn) this._sfxMuteBtn.classList.toggle('active', this._sm.isMuted());

    // Master
    if (this._masterVolSlider) {
      const master = Math.round(Math.max(this._sm.getVolume(), this._mp.getVolume()) * 100);
      this._masterVolSlider.value = String(master);
      this._masterVolValue.textContent = `${master}%`;
    }
    if (this._masterMuteBtn) {
      this._masterMuteBtn.classList.toggle('active', this._sm.isMuted() && this._mp.isMuted());
    }

    // Track selector
    const cur = this._mp.getCurrentTrack();
    if (this._trackSelect && cur) this._trackSelect.value = cur;
    this._updateTrackInfo();
    this._updateIcon();
  }

  /** @private */
  _updateTrackInfo() {
    if (!this._trackInfo) return;
    const cur = this._mp.getCurrentTrack();
    if (cur) {
      this._trackInfo.textContent = `Now playing: ${this._mp.getDisplayName(cur)}`;
    } else {
      this._trackInfo.textContent = 'No track playing';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Public helpers
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Convenience one-liner to initialise audio + UI.
   * Call after a user gesture (e.g. first click).
   */
  async initAndMount() {
    await this._sm.init();
    await this._mp.init();
    this.mount();
  }

  /** @returns {boolean} Whether the panel is currently open. */
  isOpen() {
    return this._open;
  }

  /** Play a track by name and update the UI selector. */
  playTrack(name) {
    this._mp.playTrack(name);
    if (this._trackSelect) this._trackSelect.value = name;
    this._updateTrackInfo();
  }

  /** Stop music and update UI. */
  stopMusic() {
    this._mp.stop();
    this._updateTrackInfo();
  }
}

// Singleton export for the game — created lazily so the user can provide deps.
let _audioUIInstance = null;

/**
 * Get or create the singleton AudioUI instance.
 * @param {Object} [deps]
 * @param {import('./SoundManager').default} [deps.soundManager]
 * @param {import('./MusicPlayer').default} [deps.musicPlayer]
 * @returns {AudioUI}
 */
export function getAudioUI(deps) {
  if (!_audioUIInstance && deps) {
    _audioUIInstance = new AudioUI(deps);
  }
  return _audioUIInstance;
}

export { AudioUI };
export default AudioUI;
