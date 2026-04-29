/**
 * Customizer.js — HSL colour picker + outfit editor for Starlight Inn v3.0
 *
 * Provides a DOM-based customisation panel with three HSL sliders,
 * preset manager, randomiser, accessory toggles, expression selector,
 * and a live canvas preview. All player state mutations route through
 * the game state object so the renderer stays in sync.
 *
 * @author Starlight Inn Team
 * @version 3.0.0
 */

/** @typedef {import('../engine/Game.js').Game} Game */

/** @typedef {Object} HSL
 * @property {number} h — hue   0-360
 * @property {number} s — saturation 0-100
 * @property {number} l — lightness  0-100
 */

/** @typedef {Object} OutfitPreset
 * @property {string} charId
 * @property {HSL} skinColor
 * @property {HSL} hairColor
 * @property {HSL} outfitColor
 * @property {string[]} accessories
 * @property {string} expression
 */

const CHARACTERS = [
  'catgirl', 'human', 'bunny', 'robot', 'fox', 'dragon',
  'fairy', 'ghost', 'mushroom', 'star', 'moon', 'cloud'
];

const EXPRESSIONS = ['happy', 'sad', 'cool', 'love', 'surprised', 'sleepy'];

const ACCESSORIES = [
  { id: 'sunglasses', label: 'Sunglasses', icon: '🕶️' },
  { id: 'headband',   label: 'Headband',   icon: '🎀' },
  { id: 'witch_hat',  label: 'Witch Hat',  icon: '🧙' },
  { id: 'staff',      label: 'Staff',      icon: '🪄' },
  { id: 'cape',       label: 'Cape',       icon: '🦸' },
  { id: 'pirate_hat', label: 'Pirate Hat', icon: '🏴‍☠️' },
  { id: 'eyepatch',   label: 'Eyepatch',   icon: '👁️' },
  { id: 'carrot',     label: 'Carrot',     icon: '🥕' }
];

export class Customizer {
  /**
   * @param {Game} game
   */
  constructor(game) {
    this.game = game;
    this.container = null;      // root DOM node
    this.previewCanvas = null;  // live preview <canvas>
    this.previewCtx = null;
    this._previewAnim = null;   // requestAnimationFrame id
  }

  /* ============================================================
     UI RENDERING
     ============================================================ */

  /**
   * Build and mount the full customiser panel into a host element.
   * @param {HTMLElement} parent — e.g. a modal or sidebar div
   */
  mount(parent) {
    if (this.container) this.unmount();

    const wrap = document.createElement('div');
    wrap.className = 'si-customizer';
    wrap.innerHTML = `
      <style>
        .si-customizer { font-family: 'Nunito', sans-serif; color: #3a2e2e; background: #fff5f0; border-radius: 16px; padding: 18px; width: 320px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .si-customizer h2 { margin: 0 0 12px; font-size: 1.15rem; color: #8b5e3c; text-align: center; }
        .si-section { margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px dashed #e0d0c8; }
        .si-section-title { font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.05em; color: #a08070; margin-bottom: 6px; }
        .si-slider-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
        .si-slider-row label { width: 22px; font-size: 0.75rem; font-weight: 700; color: #8b5e3c; }
        .si-slider-row input[type=range] { flex: 1; }
        .si-slider-val { width: 32px; font-size: 0.72rem; text-align: right; color: #6a5040; }
        .si-preview-wrap { text-align: center; margin-bottom: 14px; }
        .si-preview-wrap canvas { border-radius: 12px; background: #f0e6df; }
        .si-chip-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
        .si-chip { padding: 6px 4px; border-radius: 8px; border: 2px solid transparent; background: #fff; text-align: center; cursor: pointer; font-size: 0.7rem; transition: all 0.15s; user-select: none; }
        .si-chip:hover { transform: translateY(-2px); box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
        .si-chip.active { border-color: #ff99aa; background: #ffeef2; }
        .si-chip .icon { font-size: 1.1rem; display: block; margin-bottom: 2px; }
        .si-btn { border: none; border-radius: 10px; padding: 8px 12px; font-size: 0.78rem; cursor: pointer; background: #ffccdd; color: #5a2a3a; font-weight: 700; transition: background 0.15s; }
        .si-btn:hover { background: #ffbbcc; }
        .si-btn-row { display: flex; gap: 8px; justify-content: center; margin-top: 10px; }
        .si-preset-list { max-height: 110px; overflow-y: auto; margin-top: 6px; }
        .si-preset-item { display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; }
        .si-preset-item:hover { background: #ffeef2; }
        .si-preset-item .del { color: #cc5555; font-weight: 700; padding: 0 4px; }
        .si-preset-item .del:hover { color: #ff0000; }
      </style>
    `;

    // ── Preview ──────────────────────────────────────────────
    const previewWrap = document.createElement('div');
    previewWrap.className = 'si-preview-wrap';
    this.previewCanvas = document.createElement('canvas');
    this.previewCanvas.width = 160;
    this.previewCanvas.height = 160;
    this.previewCtx = this.previewCanvas.getContext('2d');
    previewWrap.appendChild(this.previewCanvas);
    wrap.appendChild(previewWrap);

    // ── Character selector ──────────────────────────────────
    this._buildSection(wrap, 'Character', 'si-char-grid', () => {
      const grid = wrap.querySelector('.si-char-grid');
      CHARACTERS.forEach(char => {
        const chip = document.createElement('div');
        chip.className = 'si-chip' + (this.getCharId() === char ? ' active' : '');
        chip.innerHTML = `<span class="icon">${this._charIcon(char)}</span>${char}`;
        chip.addEventListener('click', () => {
          this.setCharId(char);
          grid.querySelectorAll('.si-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        });
        grid.appendChild(chip);
      });
    });

    // ── Skin colour ─────────────────────────────────────────
    this._buildColorSection(wrap, 'Skin', this.getSkinColor(), (hsl) => this.setSkinColor(hsl.h, hsl.s, hsl.l));

    // ── Hair colour ──────────────────────────────────────────
    this._buildColorSection(wrap, 'Hair', this.getHairColor(), (hsl) => this.setHairColor(hsl.h, hsl.s, hsl.l));

    // ── Outfit colour ────────────────────────────────────────
    this._buildColorSection(wrap, 'Outfit', this.getOutfitColor(), (hsl) => this.setOutfitColor(hsl.h, hsl.s, hsl.l));

    // ── Expression ───────────────────────────────────────────
    this._buildSection(wrap, 'Expression', 'si-expr-grid', () => {
      const grid = wrap.querySelector('.si-expr-grid');
      EXPRESSIONS.forEach(expr => {
        const chip = document.createElement('div');
        chip.className = 'si-chip' + (this.getExpression() === expr ? ' active' : '');
        chip.innerHTML = `<span class="icon">${this._exprIcon(expr)}</span>${expr}`;
        chip.addEventListener('click', () => {
          this.setExpression(expr);
          grid.querySelectorAll('.si-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        });
        grid.appendChild(chip);
      });
    });

    // ── Accessories ──────────────────────────────────────────
    this._buildSection(wrap, 'Accessories', 'si-acc-grid', () => {
      const grid = wrap.querySelector('.si-acc-grid');
      ACCESSORIES.forEach(acc => {
        const chip = document.createElement('div');
        chip.className = 'si-chip' + (this.hasAccessory(acc.id) ? ' active' : '');
        chip.innerHTML = `<span class="icon">${acc.icon}</span>${acc.label}`;
        chip.addEventListener('click', () => {
          this.toggleAccessory(acc.id);
          chip.classList.toggle('active', this.hasAccessory(acc.id));
        });
        grid.appendChild(chip);
      });
    });

    // ── Presets ─────────────────────────────────────────────
    this._buildSection(wrap, 'Presets', 'si-presets', () => {
      this._renderPresetList(wrap.querySelector('.si-presets'));
    });

    // ── Actions ──────────────────────────────────────────────
    const btnRow = document.createElement('div');
    btnRow.className = 'si-btn-row';
    btnRow.innerHTML = `
      <button class="si-btn" id="si-random">🎲 Random</button>
      <button class="si-btn" id="si-save">💾 Save</button>
    `;
    wrap.appendChild(btnRow);

    wrap.querySelector('#si-random').addEventListener('click', () => this.randomize());
    wrap.querySelector('#si-save').addEventListener('click', () => {
      const name = prompt('Preset name:');
      if (name) this.savePreset(name);
    });

    this.container = wrap;
    parent.appendChild(wrap);

    this._startPreviewLoop();
  }

  /**
   * Remove the customiser panel from the DOM and stop preview loop.
   */
  unmount() {
    if (this._previewAnim) cancelAnimationFrame(this._previewAnim);
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.previewCanvas = null;
    this.previewCtx = null;
  }

  /* ============================================================
     DOM BUILDER HELPERS
     ============================================================ */

  /**
   * Build a generic section with a chip grid.
   * @param {HTMLElement} parent
   * @param {string} title
   * @param {string} gridClass
   * @param {Function} populate
   */
  _buildSection(parent, title, gridClass, populate) {
    const sec = document.createElement('div');
    sec.className = 'si-section';
    sec.innerHTML = `<div class="si-section-title">${title}</div><div class="si-chip-grid ${gridClass}"></div>`;
    parent.appendChild(sec);
    populate();
  }

  /**
   * Build a colour picker section with 3 HSL sliders.
   * @param {HTMLElement} parent
   * @param {string} label
   * @param {HSL} current
   * @param {Function} onChange — receives updated HSL object
   */
  _buildColorSection(parent, label, current, onChange) {
    const sec = document.createElement('div');
    sec.className = 'si-section';
    sec.innerHTML = `<div class="si-section-title">${label} Colour</div>`;

    const hsl = { ...current };
    const mkSlider = (key, min, max, gradient) => {
      const row = document.createElement('div');
      row.className = 'si-slider-row';
      row.innerHTML = `
        <label>${key.toUpperCase()}</label>
        <input type="range" min="${min}" max="${max}" value="${hsl[key]}" style="background: ${gradient}">
        <span class="si-slider-val">${hsl[key]}</span>
      `;
      const input = row.querySelector('input');
      const val = row.querySelector('.si-slider-val');
      input.addEventListener('input', () => {
        hsl[key] = parseInt(input.value, 10);
        val.textContent = hsl[key];
        onChange({ ...hsl });
      });
      return row;
    };

    sec.appendChild(mkSlider('h', 0, 360, `linear-gradient(to right, #f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)`));
    sec.appendChild(mkSlider('s', 0, 100, `linear-gradient(to right, #808080, ${this._hslStr(hsl.h, 100, hsl.l)})`));
    sec.appendChild(mkSlider('l', 0, 100, `linear-gradient(to right, #000, ${this._hslStr(hsl.h, hsl.s, 50)}, #fff)`));

    parent.appendChild(sec);
  }

  /**
   * Render the preset list UI.
   * @param {HTMLElement} container
   */
  _renderPresetList(container) {
    container.innerHTML = '';
    const presets = this.loadPresets();
    if (Object.keys(presets).length === 0) {
      container.innerHTML = '<div style="font-size:0.7rem;color:#999;text-align:center;padding:8px;">No saved presets yet</div>';
      return;
    }
    Object.entries(presets).forEach(([name, preset]) => {
      const row = document.createElement('div');
      row.className = 'si-preset-item';
      row.innerHTML = `<span>${name}</span><span class="del" title="Delete">×</span>`;
      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('del')) {
          this.deletePreset(name);
          this._renderPresetList(container);
        } else {
          this.applyPreset(preset);
          // Refresh UI to reflect preset
          if (this.container) {
            this.unmount();
            this.mount(this.game.ui.customizerHost || document.body);
          }
        }
      });
      container.appendChild(row);
    });
  }

  /* ============================================================
     LIVE PREVIEW LOOP
     ============================================================ */

  /** Start the canvas preview animation loop. */
  _startPreviewLoop() {
    const loop = () => {
      if (!this.previewCtx) return;
      this._drawPreview();
      this._previewAnim = requestAnimationFrame(loop);
    };
    this._previewAnim = requestAnimationFrame(loop);
  }

  /** Draw the avatar preview into the customiser canvas. */
  _drawPreview() {
    const ctx = this.previewCtx;
    const w = this.previewCanvas.width;
    const h = this.previewCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const avatar = this.game.avatar;
    if (!avatar) return;

    const p = this.game.state.player;
    avatar.draw(ctx, w / 2, h - 24, 1.2, {
      charId: p.charId,
      skinHue: p.skinColor?.h ?? 30,
      hairHue: p.hairColor?.h ?? 0,
      outfitHue: p.outfitColor?.h ?? 200,
      expression: p.expression || 'happy',
      accessories: p.accessories || [],
      facing: 1,
      bobOffset: avatar.getBobOffset(this.game.frameCount || 0, false),
      gestureProgress: 0
    });
  }

  /* ============================================================
     STATE MUTATORS
     ============================================================ */

  setSkinColor(h, s, l)  { this.game.state.player.skinColor  = { h, s, l }; }
  setHairColor(h, s, l)  { this.game.state.player.hairColor  = { h, s, l }; }
  setOutfitColor(h, s, l){ this.game.state.player.outfitColor= { h, s, l }; }

  setCharId(id)   { this.game.state.player.charId = id; }
  getCharId()     { return this.game.state.player.charId || 'human'; }

  setExpression(expr) { this.game.state.player.expression = expr; }
  getExpression()     { return this.game.state.player.expression || 'happy'; }

  /** Toggle an accessory on/off. */
  toggleAccessory(accId) {
    const acc = this.game.state.player.accessories || (this.game.state.player.accessories = []);
    const i = acc.indexOf(accId);
    if (i >= 0) acc.splice(i, 1);
    else acc.push(accId);
  }

  /** @param {string} accId */
  hasAccessory(accId) {
    return (this.game.state.player.accessories || []).includes(accId);
  }

  /* ============================================================
     PRESETS
     ============================================================ */

  /**
   * Save the current player look as a named preset in localStorage.
   * @param {string} name
   */
  savePreset(name) {
    const presets = this.loadPresets();
    presets[name] = this._exportPlayer();
    localStorage.setItem('starlight_presets', JSON.stringify(presets));
    // Refresh list if visible
    if (this.container) {
      const list = this.container.querySelector('.si-presets');
      if (list) this._renderPresetList(list);
    }
  }

  /** Load all presets from localStorage. @returns {Object<string, OutfitPreset>} */
  loadPresets() {
    try {
      return JSON.parse(localStorage.getItem('starlight_presets') || '{}');
    } catch { return {}; }
  }

  /**
   * Apply a preset object to the player.
   * @param {OutfitPreset} preset
   */
  applyPreset(preset) {
    const p = this.game.state.player;
    if (preset.charId)      p.charId      = preset.charId;
    if (preset.skinColor)   p.skinColor   = { ...preset.skinColor };
    if (preset.hairColor)   p.hairColor   = { ...preset.hairColor };
    if (preset.outfitColor) p.outfitColor = { ...preset.outfitColor };
    if (preset.accessories) p.accessories = [...preset.accessories];
    if (preset.expression)  p.expression  = preset.expression;
  }

  /**
   * Delete a named preset.
   * @param {string} name
   */
  deletePreset(name) {
    const presets = this.loadPresets();
    delete presets[name];
    localStorage.setItem('starlight_presets', JSON.stringify(presets));
  }

  /* ============================================================
     RANDOMISER
     ============================================================ */

  /** Randomise all visual attributes. */
  randomize() {
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    this.setCharId(CHARACTERS[rand(0, CHARACTERS.length - 1)]);
    this.setSkinColor(rand(0, 360), rand(30, 70), rand(55, 80));
    this.setHairColor(rand(0, 360), rand(40, 90), rand(25, 60));
    this.setOutfitColor(rand(0, 360), rand(40, 90), rand(35, 65));
    this.setExpression(EXPRESSIONS[rand(0, EXPRESSIONS.length - 1)]);
    // Random accessories (0–3)
    const accCount = rand(0, 3);
    const shuffled = [...ACCESSORIES].sort(() => Math.random() - 0.5);
    this.game.state.player.accessories = shuffled.slice(0, accCount).map(a => a.id);

    // Refresh UI to reflect new state
    if (this.container) {
      this.unmount();
      this.mount(this.game.ui?.customizerHost || document.body);
    }
  }

  /* ============================================================
     UTILITIES
     ============================================================ */

  /** @returns {HSL} */
  getSkinColor()   { return this.game.state.player.skinColor   || { h: 30, s: 35, l: 70 }; }
  /** @returns {HSL} */
  getHairColor()   { return this.game.state.player.hairColor   || { h: 25, s: 60, l: 35 }; }
  /** @returns {HSL} */
  getOutfitColor() { return this.game.state.player.outfitColor || { h: 210, s: 55, l: 55 }; }

  /** Build HSL() string for CSS gradients. */
  _hslStr(h, s, l) { return `hsl(${h},${s}%,${l}%)`; }

  /** Export current player look as a plain preset object. */
  _exportPlayer() {
    const p = this.game.state.player;
    return {
      charId: p.charId || 'human',
      skinColor: { ...(p.skinColor || { h: 30, s: 35, l: 70 }) },
      hairColor: { ...(p.hairColor || { h: 25, s: 60, l: 35 }) },
      outfitColor: { ...(p.outfitColor || { h: 210, s: 55, l: 55 }) },
      accessories: [...(p.accessories || [])],
      expression: p.expression || 'happy'
    };
  }

  /** Emoji icon per character. */
  _charIcon(char) {
    const map = {
      catgirl: '🐱', human: '👤', bunny: '🐰', robot: '🤖',
      fox: '🦊', dragon: '🐉', fairy: '🧚', ghost: '👻',
      mushroom: '🍄', star: '⭐', moon: '🌙', cloud: '☁️'
    };
    return map[char] || '✨';
  }

  /** Emoji icon per expression. */
  _exprIcon(expr) {
    const map = {
      happy: '😊', sad: '😢', cool: '😎', love: '😍',
      surprised: '😲', sleepy: '😴'
    };
    return map[expr] || '🙂';
  }
}
