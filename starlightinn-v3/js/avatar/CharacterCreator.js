/** @fileoverview CharacterCreator.js — Main character creation UI for Starlight Inn v8.0
 *  Orchestrates AvatarPreview, ColorWheel, and HairCatalog into a cohesive
 *  tabbed interface with real-time updates, pagination, and save/export.
 *  @author Starlight Inn UI Team
 *  @version 3.0.0
 */

/**
 * CharacterCreator is the top-level UI controller for the avatar editor.
 * @class
 */
class CharacterCreator {
  /**
   * @param {Object} game — Game reference for persistence integration.
   * @param {Object} config — DOM element IDs and options.
   * @param {string} config.containerId — Root container element ID.
   * @param {string} config.previewCanvasId — Avatar preview canvas ID.
   * @param {string} config.colorWheelCanvasId — Color wheel canvas ID.
   * @param {string} [config.defaultName='Guest'] — Default character name.
   */
  constructor(game, config) {
    /** @type {Object|null} */
    this.game = game || null;
    /** @type {Object} */
    this.config = config;
    /** @type {HTMLElement|null} */
    this.container = document.getElementById(config.containerId);
    if (!this.container) {
      throw new Error(`CharacterCreator: container #${config.containerId} not found`);
    }

    // Avatar preview instance
    /** @type {AvatarPreview|null} */
    this.preview = null;

    // Color wheels
    /** @type {ColorWheel|null} */
    this.colorWheel = null;
    /** @type {string} */
    this.activeColorPart = 'skin';

    // Hair grid state
    /** @type {string} */
    this.hairCategory = 'short';
    /** @type {number} */
    this.hairPage = 0;
    /** @type {number} */
    this.hairsPerPage = 12;
    /** @type {Array<Object>} */
    this.filteredHairs = [];

    // Outfit / Face state
    /** @type {string} */
    this.outfitTab = 'shirts';
    /** @type {string} */
    this.faceTab = 'expressions';

    // Tabs
    /** @type {string} */
    this.activeMainTab = 'colors';
    /** @type {Array<string>} */
    this.mainTabs = ['colors', 'hair', 'outfit', 'face'];

    // Character name
    /** @type {string} */
    this.characterName = config.defaultName || 'Guest';

    // Build UI and initialize
    this._buildDOM();
    this._initPreview();
    this._initColorWheel();
    this._bindEvents();
    this._updateHairGrid();
    this._switchMainTab('colors');
  }

  /** @private — Construct the creator DOM layout. */
  _buildDOM() {
    const c = this.container;
    c.className = 'character-creator';
    c.innerHTML = `
      <div class="cc-layout">
        <div class="cc-left">
          <div class="cc-preview-wrap">
            <canvas id="${this.config.previewCanvasId}" class="cc-preview-canvas"></canvas>
            <div class="cc-dir-controls">
              <button class="cc-btn-dir" data-dir="-1" title="Rotate left">&#9664;</button>
              <span class="cc-dir-label">Direction</span>
              <button class="cc-btn-dir" data-dir="1" title="Rotate right">&#9654;</button>
            </div>
            <div class="cc-anim-controls">
              <button class="cc-btn-anim" data-anim="idle">Idle</button>
              <button class="cc-btn-anim" data-anim="walk">Walk</button>
              <button class="cc-btn-anim" data-anim="dance">Dance</button>
              <button class="cc-btn-export">Export PNG</button>
            </div>
          </div>
        </div>
        <div class="cc-right">
          <div class="cc-tabs">
            <button class="cc-tab" data-tab="colors">Colors</button>
            <button class="cc-tab" data-tab="hair">Hair</button>
            <button class="cc-tab" data-tab="outfit">Outfit</button>
            <button class="cc-tab" data-tab="face">Face</button>
          </div>
          <div class="cc-panel" id="cc-panel-colors">
            <div class="cc-color-tabs">
              <button class="cc-subtab active" data-part="skin">Skin</button>
              <button class="cc-subtab" data-part="hair">Hair</button>
              <button class="cc-subtab" data-part="shirt">Shirt</button>
              <button class="cc-subtab" data-part="pants">Pants</button>
            </div>
            <div class="cc-color-wheel-wrap">
              <canvas id="${this.config.colorWheelCanvasId}" class="cc-color-canvas"></canvas>
            </div>
            <div class="cc-color-info">
              <span class="cc-color-label">Click & drag the ring or square to choose a color.</span>
            </div>
          </div>
          <div class="cc-panel" id="cc-panel-hair" style="display:none">
            <div class="cc-hair-categories">
              <button class="cc-hair-cat active" data-cat="short">Short</button>
              <button class="cc-hair-cat" data-cat="medium">Medium</button>
              <button class="cc-hair-cat" data-cat="long">Long</button>
              <button class="cc-hair-cat" data-cat="updos">Updos</button>
              <button class="cc-hair-cat" data-cat="braids">Braids</button>
              <button class="cc-hair-cat" data-cat="special">Special</button>
            </div>
            <div class="cc-hair-grid" id="cc-hair-grid"></div>
            <div class="cc-hair-pagination">
              <button class="cc-page-btn" data-delta="-1">&#9664; Prev</button>
              <span class="cc-page-info" id="cc-page-info">Page 1 / 1</span>
              <button class="cc-page-btn" data-delta="1">Next &#9654;</button>
            </div>
          </div>
          <div class="cc-panel" id="cc-panel-outfit" style="display:none">
            <div class="cc-outfit-tabs">
              <button class="cc-subtab active" data-otab="shirts">Shirts</button>
              <button class="cc-subtab" data-otab="pants">Pants</button>
              <button class="cc-subtab" data-otab="shoes">Shoes</button>
            </div>
            <div class="cc-outfit-grid" id="cc-outfit-grid"></div>
          </div>
          <div class="cc-panel" id="cc-panel-face" style="display:none">
            <div class="cc-face-tabs">
              <button class="cc-subtab active" data-ftab="expressions">Expressions</button>
              <button class="cc-subtab" data-ftab="glasses">Glasses</button>
              <button class="cc-subtab" data-ftab="facialhair">Facial Hair</button>
            </div>
            <div class="cc-face-grid" id="cc-face-grid"></div>
          </div>
        </div>
      </div>
      <div class="cc-bottom-bar">
        <input type="text" class="cc-name-input" id="cc-name-input" maxlength="20" placeholder="Character name..." />
        <button class="cc-btn-random">Randomize</button>
        <button class="cc-btn-save">Save Character</button>
        <button class="cc-btn-back">Back</button>
      </div>
    `;
    this._injectStyles();
  }

  /** @private — Inject minimal CSS for the creator layout. */
  _injectStyles() {
    if (document.getElementById('cc-styles')) return;
    const style = document.createElement('style');
    style.id = 'cc-styles';
    style.textContent = `
      .character-creator { display:flex; flex-direction:column; width:100%; max-width:960px; margin:0 auto; font-family:sans-serif; background:#16213e; color:#e0e0e0; border-radius:8px; overflow:hidden; }
      .cc-layout { display:flex; flex-direction:row; gap:16px; padding:16px; }
      .cc-left { flex:0 0 280px; display:flex; flex-direction:column; align-items:center; }
      .cc-preview-wrap { background:#0f3460; border-radius:8px; padding:12px; display:flex; flex-direction:column; align-items:center; }
      .cc-preview-canvas { border-radius:4px; background:#1a1a2e; image-rendering:pixelated; width:96px; height:144px; }
      .cc-dir-controls { display:flex; align-items:center; gap:8px; margin-top:8px; }
      .cc-dir-label { font-size:11px; color:#aaa; }
      .cc-btn-dir, .cc-btn-anim, .cc-btn-export, .cc-page-btn, .cc-btn-random, .cc-btn-save, .cc-btn-back { background:#e94560; border:none; color:#fff; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:12px; transition:background .15s; }
      .cc-btn-dir:hover, .cc-btn-anim:hover, .cc-page-btn:hover { background:#ff6b81; }
      .cc-anim-controls { display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; justify-content:center; }
      .cc-right { flex:1 1 auto; min-width:0; }
      .cc-tabs { display:flex; gap:4px; margin-bottom:12px; }
      .cc-tab { flex:1; background:#0f3460; border:none; color:#ccc; padding:10px; cursor:pointer; border-radius:4px 4px 0 0; font-size:13px; transition:background .15s; }
      .cc-tab.active { background:#e94560; color:#fff; font-weight:bold; }
      .cc-tab:hover:not(.active) { background:#1a4a7a; }
      .cc-panel { background:#0f3460; border-radius:0 4px 4px 4px; padding:12px; min-height:340px; }
      .cc-color-tabs, .cc-hair-categories, .cc-outfit-tabs, .cc-face-tabs { display:flex; gap:4px; margin-bottom:10px; flex-wrap:wrap; }
      .cc-subtab, .cc-hair-cat { background:#1a4a7a; border:none; color:#ccc; padding:6px 10px; cursor:pointer; border-radius:4px; font-size:12px; }
      .cc-subtab.active, .cc-hair-cat.active { background:#e94560; color:#fff; }
      .cc-color-canvas { display:block; margin:0 auto; cursor:crosshair; border-radius:4px; background:#1a1a2e; }
      .cc-color-info { text-align:center; margin-top:6px; font-size:11px; color:#aaa; }
      .cc-hair-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
      .cc-hair-thumb { background:#1a1a2e; border:2px solid transparent; border-radius:4px; padding:4px; cursor:pointer; text-align:center; transition:border .15s; }
      .cc-hair-thumb:hover { border-color:#e94560; }
      .cc-hair-thumb.selected { border-color:#ff6b81; background:#2a1a3e; }
      .cc-hair-thumb canvas { display:block; margin:0 auto; width:48px; height:48px; image-rendering:pixelated; }
      .cc-hair-thumb span { display:block; margin-top:2px; font-size:10px; color:#ccc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .cc-hair-pagination { display:flex; justify-content:space-between; align-items:center; margin-top:10px; }
      .cc-page-info { font-size:12px; color:#aaa; }
      .cc-outfit-grid, .cc-face-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
      .cc-outfit-item, .cc-face-item { background:#1a1a2e; border:2px solid transparent; border-radius:4px; padding:8px; cursor:pointer; text-align:center; font-size:12px; color:#ccc; }
      .cc-outfit-item:hover, .cc-face-item:hover { border-color:#e94560; }
      .cc-outfit-item.selected, .cc-face-item.selected { border-color:#ff6b81; background:#2a1a3e; }
      .cc-bottom-bar { display:flex; gap:8px; padding:12px 16px; background:#0a1a2e; align-items:center; border-top:1px solid #1a4a7a; }
      .cc-name-input { flex:1; background:#1a1a2e; border:1px solid #1a4a7a; color:#fff; padding:8px 12px; border-radius:4px; font-size:14px; }
      .cc-btn-save { background:#28a745; }
      .cc-btn-save:hover { background:#34ce57; }
      .cc-btn-back { background:#6c757d; }
      .cc-btn-back:hover { background:#868e96; }
      .cc-btn-export { background:#17a2b8; }
      .cc-btn-export:hover { background:#1fc8e3; }
      .cc-btn-random { background:#ffc107; color:#222; }
      .cc-btn-random:hover { background:#ffdb58; }
    `;
    document.head.appendChild(style);
  }

  /** @private — Initialize the avatar preview. */
  _initPreview() {
    this.preview = new AvatarPreview(this.game, this.config.previewCanvasId, {
      scale: 3,
      width: 96,
      height: 144,
      skinColor: '#FFCC80',
      hairColor: '#5D4037',
      shirtColor: '#1976D2',
      pantsColor: '#424242',
      hairId: 'bob_short',
    });
  }

  /** @private — Initialize the color wheel for the active part. */
  _initColorWheel() {
    const initialColor = this.preview.colors[this.activeColorPart];
    this.colorWheel = new ColorWheel(this.config.colorWheelCanvasId, (color) => {
      this.preview.setColor(this.activeColorPart, color.hex);
    }, {
      size: 256,
      initialColor,
    });
  }

  /** @private — Rebind color wheel to a new part. */
  _setColorPart(part) {
    if (!['skin', 'hair', 'shirt', 'pants'].includes(part)) return;
    this.activeColorPart = part;
    const color = this.preview.colors[part];
    if (this.colorWheel) {
      this.colorWheel.setColor(color);
    }
  }

  /** @private — Wire up all DOM event listeners. */
  _bindEvents() {
    // Main tabs
    this.container.querySelectorAll('.cc-tab').forEach((btn) => {
      btn.addEventListener('click', () => this._switchMainTab(btn.dataset.tab));
    });

    // Color sub-tabs
    this.container.querySelectorAll('.cc-subtab[data-part]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._setActiveSubtab(btn, '.cc-subtab[data-part]');
        this._setColorPart(btn.dataset.part);
      });
    });

    // Hair categories
    this.container.querySelectorAll('.cc-hair-cat').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._setActiveSubtab(btn, '.cc-hair-cat');
        this.hairCategory = btn.dataset.cat;
        this.hairPage = 0;
        this._updateHairGrid();
      });
    });

    // Hair pagination
    this.container.querySelectorAll('.cc-page-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const delta = parseInt(btn.dataset.delta, 10);
        const maxPage = Math.max(0, Math.ceil(this.filteredHairs.length / this.hairsPerPage) - 1);
        this.hairPage = Math.max(0, Math.min(maxPage, this.hairPage + delta));
        this._updateHairGrid();
      });
    });

    // Direction controls
    this.container.querySelectorAll('.cc-btn-dir').forEach((btn) => {
      btn.addEventListener('click', () => {
        const delta = parseInt(btn.dataset.dir, 10);
        this.preview.setDirection(this.preview.direction + delta);
      });
    });

    // Animation controls
    this.container.querySelectorAll('.cc-btn-anim').forEach((btn) => {
      btn.addEventListener('click', () => this.preview.playAnimation(btn.dataset.anim));
    });

    // Export
    this.container.querySelector('.cc-btn-export')?.addEventListener('click', () => {
      this.preview.downloadPNG(`starlight-${this.characterName || 'avatar'}.png`);
    });

    // Outfit sub-tabs
    this.container.querySelectorAll('.cc-subtab[data-otab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._setActiveSubtab(btn, '.cc-subtab[data-otab]');
        this.outfitTab = btn.dataset.otab;
        this._updateOutfitGrid();
      });
    });

    // Face sub-tabs
    this.container.querySelectorAll('.cc-subtab[data-ftab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._setActiveSubtab(btn, '.cc-subtab[data-ftab]');
        this.faceTab = btn.dataset.ftab;
        this._updateFaceGrid();
      });
    });

    // Bottom bar
    const nameInput = this.container.querySelector('.cc-name-input');
    if (nameInput) {
      nameInput.value = this.characterName;
      nameInput.addEventListener('input', (e) => {
        this.characterName = e.target.value.trim();
      });
    }

    this.container.querySelector('.cc-btn-random')?.addEventListener('click', () => {
      this.preview.randomize();
      this.characterName = this._generateRandomName();
      if (nameInput) nameInput.value = this.characterName;
      this._setColorPart(this.activeColorPart);
    });

    this.container.querySelector('.cc-btn-save')?.addEventListener('click', () => this._saveCharacter());
    this.container.querySelector('.cc-btn-back')?.addEventListener('click', () => this._goBack());
  }

  /** @private — Switch main tab visibility. */
  _switchMainTab(tab) {
    if (!this.mainTabs.includes(tab)) return;
    this.activeMainTab = tab;
    this.container.querySelectorAll('.cc-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    this.mainTabs.forEach((t) => {
      const panel = this.container.querySelector(`#cc-panel-${t}`);
      if (panel) panel.style.display = t === tab ? 'block' : 'none';
    });
    if (tab === 'hair') this._updateHairGrid();
    if (tab === 'outfit') this._updateOutfitGrid();
    if (tab === 'face') this._updateFaceGrid();
  }

  /** @private — Highlight an active sub-tab. */
  _setActiveSubtab(activeBtn, selector) {
    this.container.querySelectorAll(selector).forEach((btn) => btn.classList.remove('active'));
    activeBtn.classList.add('active');
  }

  /** @private — Refresh the hairstyle thumbnail grid. */
  _updateHairGrid() {
    const grid = this.container.querySelector('#cc-hair-grid');
    const pageInfo = this.container.querySelector('#cc-page-info');
    if (!grid) return;

    this.filteredHairs = typeof getHairstyles === 'function'
      ? getHairstyles(this.hairCategory)
      : [];

    const totalPages = Math.max(1, Math.ceil(this.filteredHairs.length / this.hairsPerPage));
    this.hairPage = Math.min(this.hairPage, totalPages - 1);
    if (pageInfo) pageInfo.textContent = `Page ${this.hairPage + 1} / ${totalPages}`;

    const start = this.hairPage * this.hairsPerPage;
    const pageHairs = this.filteredHairs.slice(start, start + this.hairsPerPage);

    grid.innerHTML = '';
    pageHairs.forEach((hair) => {
      const thumb = document.createElement('div');
      thumb.className = 'cc-hair-thumb';
      if (hair.id === this.preview.hairId) thumb.classList.add('selected');

      const cv = document.createElement('canvas');
      cv.width = 48;
      cv.height = 48;
      const tctx = cv.getContext('2d');
      this._drawHairThumbnail(tctx, hair, 48, 48);

      const label = document.createElement('span');
      label.textContent = hair.name;

      thumb.appendChild(cv);
      thumb.appendChild(label);
      thumb.addEventListener('click', () => {
        this.preview.setHair(hair.id);
        this._updateHairGrid();
      });
      grid.appendChild(thumb);
    });
  }

  /** @private — Render a single hairstyle thumbnail. */
  _drawHairThumbnail(ctx, hair, w, h) {
    ctx.clearRect(0, 0, w, h);
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
    // Simple head base
    const hx = w / 2;
    const hy = h / 2 - 2;
    const headW = 14;
    const headH = 14;
    ctx.fillStyle = '#FFCC80';
    ctx.fillRect(hx - headW / 2, hy, headW, headH);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hx - headW / 2 + 0.5, hy + 0.5, headW - 1, headH - 1);
    // Eyes
    ctx.fillStyle = '#3E2723';
    ctx.fillRect(hx - 4, hy + 5, 2, 2);
    ctx.fillRect(hx + 2, hy + 5, 2, 2);
    // Draw the hair
    ctx.save();
    hair.draw(ctx, hx, hy + 1, '#5D4037', 0);
    ctx.restore();
  }

  /** @private — Populate the outfit selection grid. */
  _updateOutfitGrid() {
    const grid = this.container.querySelector('#cc-outfit-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const presets = COLOR_PRESETS || [
      '#1976D2', '#D32F2F', '#388E3C', '#FBC02D',
      '#7B1FA2', '#00796B', '#E64A19', '#5D4037',
    ];

    if (this.outfitTab === 'shirts') {
      presets.forEach((hex) => {
        const el = this._makeColorSwatch(hex, 'shirt', hex === this.preview.colors.shirt);
        grid.appendChild(el);
      });
    } else if (this.outfitTab === 'pants') {
      presets.slice(4).concat(presets.slice(0, 4)).forEach((hex) => {
        const el = this._makeColorSwatch(hex, 'pants', hex === this.preview.colors.pants);
        grid.appendChild(el);
      });
    } else if (this.outfitTab === 'shoes') {
      ['#212121', '#5D4037', '#8D6E63', '#B0BEC5', '#455A64', '#263238', '#3E2723', '#000000'].forEach((hex) => {
        const el = this._makeColorSwatch(hex, 'shoes', hex === this.preview.colors.shoes);
        grid.appendChild(el);
      });
    }
  }

  /** @private — Create a color swatch element. */
  _makeColorSwatch(hex, part, isSelected) {
    const el = document.createElement('div');
    el.className = `cc-outfit-item${isSelected ? ' selected' : ''}`;
    el.style.background = hex;
    el.style.height = '40px';
    el.style.borderColor = isSelected ? '#ff6b81' : 'transparent';
    el.addEventListener('click', () => {
      this.preview.setColor(part, hex);
      this._updateOutfitGrid();
    });
    return el;
  }

  /** @private — Populate the face customization grid. */
  _updateFaceGrid() {
    const grid = this.container.querySelector('#cc-face-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (this.faceTab === 'expressions') {
      const expressions = [
        { id: 'neutral', label: 'Neutral' },
        { id: 'happy', label: 'Happy' },
        { id: 'sad', label: 'Sad' },
        { id: 'angry', label: 'Angry' },
        { id: 'surprised', label: 'Surprised' },
      ];
      expressions.forEach((expr) => {
        const el = document.createElement('div');
        el.className = `cc-face-item${this.preview.expression === expr.id ? ' selected' : ''}`;
        el.textContent = expr.label;
        el.addEventListener('click', () => {
          this.preview.setExpression(expr.id);
          this._updateFaceGrid();
        });
        grid.appendChild(el);
      });
    } else if (this.faceTab === 'glasses') {
      ['None', 'Glasses'].forEach((opt) => {
        const el = document.createElement('div');
        const on = opt === 'Glasses';
        el.className = `cc-face-item${this.preview.hasGlasses === on ? ' selected' : ''}`;
        el.textContent = opt;
        el.addEventListener('click', () => {
          this.preview.setGlasses(on);
          this._updateFaceGrid();
        });
        grid.appendChild(el);
      });
    } else if (this.faceTab === 'facialhair') {
      ['None', 'Beard'].forEach((opt) => {
        const el = document.createElement('div');
        const on = opt === 'Beard';
        el.className = `cc-face-item${this.preview.hasFacialHair === on ? ' selected' : ''}`;
        el.textContent = opt;
        el.addEventListener('click', () => {
          this.preview.setFacialHair(on);
          this._updateFaceGrid();
        });
        grid.appendChild(el);
      });
    }
  }

  /** @private — Save the current character configuration. */
  _saveCharacter() {
    const data = {
      name: this.characterName,
      ...this.preview.save(),
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem('starlight_avatar', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
    if (this.game && typeof this.game.saveCharacter === 'function') {
      this.game.saveCharacter(data);
    }
    this._flashMessage('Character saved!');
  }

  /** @private — Navigate back (hook for game integration). */
  _goBack() {
    if (this.game && typeof this.game.closeCharacterCreator === 'function') {
      this.game.closeCharacterCreator();
    } else {
      this.container.style.display = 'none';
    }
  }

  /** @private — Show a temporary status message. */
  _flashMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'cc-flash-msg';
    msg.textContent = text;
    msg.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#28a745; color:#fff; padding:10px 20px; border-radius:4px; font-size:14px; z-index:9999; animation:ccFade 2s forwards;';
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2000);
  }

  /** @private — Generate a random guest name. */
  _generateRandomName() {
    const prefixes = ['Star', 'Moon', 'Sun', 'Sky', 'Nova', 'Cosmic', 'Luna', 'Astro'];
    const suffixes = ['Walker', 'Dreamer', 'Seeker', 'Voyager', 'Light', 'Glow', 'Spark', 'Beam'];
    return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
  }

  /**
   * Load a saved avatar configuration into the creator.
   * @param {Object} data
   */
  load(data) {
    if (data.name) {
      this.characterName = data.name;
      const nameInput = this.container.querySelector('.cc-name-input');
      if (nameInput) nameInput.value = this.characterName;
    }
    if (this.preview && data.colors) {
      this.preview.load(data);
    }
    this._setColorPart(this.activeColorPart);
    this._updateHairGrid();
  }

  /** Destroy the creator and clean up resources. */
  destroy() {
    if (this.preview) this.preview.destroy();
    if (this.colorWheel) this.colorWheel.destroy();
    this.container.innerHTML = '';
  }
}

// Ensure CSS animation for flash messages
if (!document.getElementById('cc-anim-styles')) {
  const animStyle = document.createElement('style');
  animStyle.id = 'cc-anim-styles';
  animStyle.textContent = `
    @keyframes ccFade { 0% { opacity:1; } 70% { opacity:1; } 100% { opacity:0; } }
  `;
  document.head.appendChild(animStyle);
}

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CharacterCreator };
}
