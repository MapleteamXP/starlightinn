/**
 * IslandEditorUI.js
 * =================
 * HTML/CSS overlay interface for the Island Editor in Starlight Inn v3.5.
 *
 * Provides a complete visual editing toolkit:
 *   - Mode toolbar (Place / Paint / Move / Delete)
 *   - Category tab bar (Furniture / Wallpaper / Floor / Props / Effects)
 *   - Item palette grid of available / owned items
 *   - Interactive HSL colour wheel with recent-colour swatches
 *   - Property panel (rotation, scale, flip, layer controls)
 *   - Undo / Redo buttons with Ctrl+Z / Ctrl+Y shortcuts
 *   - Grid toggle and snap-to-grid toggle
 *   - Save confirmation dialog and dirty-state indicator
 *   - Mini-map preview canvas
 *   - Keyboard shortcut legend
 *
 * The UI is rendered as a fixed-position DOM overlay on top of the game canvas.
 * All styling is injected dynamically so the module remains self-contained.
 *
 * @module world/IslandEditorUI
 */

// ------------------------------------------------------------------
// Style injection
// ------------------------------------------------------------------

const EDITOR_CSS = `
/* === Island Editor UI === */
.island-editor-ui {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 1000;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  user-select: none;
}
.island-editor-ui * { pointer-events: auto; box-sizing: border-box; }

/* --- Toolbar --- */
.ie-toolbar {
  position: absolute;
  top: 12px; left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  background: rgba(20, 18, 35, 0.92);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  padding: 6px 10px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.ie-toolbar button {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: #ccc;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex; align-items: center; gap: 5px;
}
.ie-toolbar button:hover {
  background: rgba(255,255,255,0.12);
  color: #fff;
  transform: translateY(-1px);
}
.ie-toolbar button.active {
  background: rgba(78, 205, 196, 0.25);
  border-color: rgba(78, 205, 196, 0.5);
  color: #4ecdc4;
  box-shadow: 0 0 8px rgba(78, 205, 196, 0.2);
}
.ie-toolbar button.mode-delete.active {
  background: rgba(255, 107, 107, 0.25);
  border-color: rgba(255, 107, 107, 0.5);
  color: #ff6b6b;
  box-shadow: 0 0 8px rgba(255, 107, 107, 0.2);
}
.ie-toolbar button.mode-paint.active {
  background: rgba(255, 230, 109, 0.2);
  border-color: rgba(255, 230, 109, 0.5);
  color: #ffe66d;
}
.ie-toolbar button.mode-move.active {
  background: rgba(168, 230, 207, 0.2);
  border-color: rgba(168, 230, 207, 0.5);
  color: #a8e6cf;
}

/* --- Category Tabs --- */
.ie-categories {
  position: absolute;
  top: 64px; left: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(20, 18, 35, 0.88);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 6px;
  backdrop-filter: blur(6px);
}
.ie-categories button {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #999;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s ease;
  text-transform: capitalize;
  text-align: left;
}
.ie-categories button:hover { background: rgba(255,255,255,0.06); color: #ddd; }
.ie-categories button.active {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.2);
  color: #fff;
}

/* --- Item Palette --- */
.ie-palette {
  position: absolute;
  top: 64px; left: 110px;
  width: 240px;
  max-height: 320px;
  overflow-y: auto;
  background: rgba(20, 18, 35, 0.9);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  backdrop-filter: blur(6px);
}
.ie-palette::-webkit-scrollbar { width: 5px; }
.ie-palette::-webkit-scrollbar-track { background: transparent; }
.ie-palette::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
.ie-palette-item {
  aspect-ratio: 1;
  background: rgba(255,255,255,0.05);
  border: 2px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.12s ease;
  position: relative;
}
.ie-palette-item:hover {
  background: rgba(255,255,255,0.12);
  border-color: rgba(255,255,255,0.3);
  transform: scale(1.08);
}
.ie-palette-item.selected {
  background: rgba(78, 205, 196, 0.2);
  border-color: #4ecdc4;
  box-shadow: 0 0 10px rgba(78, 205, 196, 0.25);
}
.ie-palette-item .label {
  position: absolute;
  bottom: 1px; left: 50%;
  transform: translateX(-50%);
  font-size: 8px;
  color: rgba(255,255,255,0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 95%;
}

/* --- Color Panel --- */
.ie-color-panel {
  position: absolute;
  top: 64px; right: 12px;
  width: 220px;
  background: rgba(20, 18, 35, 0.92);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 14px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.ie-color-panel h3 {
  margin: 0 0 10px 0;
  font-size: 13px;
  font-weight: 700;
  color: #ffe66d;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.ie-color-wheel canvas {
  width: 100%;
  border-radius: 50%;
  cursor: crosshair;
  display: block;
}
.ie-color-values {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  justify-content: center;
}
.ie-color-values .val {
  font-size: 11px;
  font-family: monospace;
  color: #aaa;
  background: rgba(0,0,0,0.3);
  padding: 3px 8px;
  border-radius: 4px;
}
.ie-recent-colors {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
}
.ie-color-preview {
  width: 100%; height: 28px;
  border-radius: 6px;
  margin-top: 10px;
  border: 1px solid rgba(255,255,255,0.2);
  transition: background 0.1s;
}

/* --- Property Panel --- */
.ie-property-panel {
  position: absolute;
  top: 360px; right: 12px;
  width: 220px;
  background: rgba(20, 18, 35, 0.92);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 14px;
  backdrop-filter: blur(8px);
}
.ie-property-panel h3 {
  margin: 0 0 10px 0;
  font-size: 13px;
  font-weight: 700;
  color: #a8e6cf;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.ie-prop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.ie-prop-row label {
  font-size: 12px;
  color: #bbb;
}
.ie-prop-row button {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  color: #ddd;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.1s;
}
.ie-prop-row button:hover { background: rgba(255,255,255,0.16); color: #fff; }
.ie-prop-row .prop-value {
  font-size: 12px;
  color: #4ecdc4;
  font-family: monospace;
  min-width: 36px;
  text-align: center;
}

/* --- Bottom Bar --- */
.ie-bottom-bar {
  position: absolute;
  bottom: 12px; left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  align-items: center;
  background: rgba(20, 18, 35, 0.92);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 6px 14px;
  backdrop-filter: blur(8px);
}
.ie-bottom-bar button {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: #ccc;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.12s ease;
}
.ie-bottom-bar button:hover { background: rgba(255,255,255,0.14); color: #fff; }
.ie-bottom-bar button.primary {
  background: rgba(78, 205, 196, 0.2);
  border-color: rgba(78, 205, 196, 0.4);
  color: #4ecdc4;
}
.ie-bottom-bar button.primary:hover {
  background: rgba(78, 205, 196, 0.35);
}
.ie-bottom-bar button.danger {
  background: rgba(255, 107, 107, 0.15);
  border-color: rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
}
.ie-toggle {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px;
  color: #aaa;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.1s;
}
.ie-toggle:hover { background: rgba(255,255,255,0.06); }
.ie-toggle input[type="checkbox"] {
  accent-color: #4ecdc4;
  cursor: pointer;
}
.ie-undo-redo { display: flex; gap: 4px; }

/* --- Mini-map --- */
.ie-minimap {
  position: absolute;
  bottom: 64px; right: 12px;
  width: 140px; height: 140px;
  background: rgba(20, 18, 35, 0.88);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  overflow: hidden;
}
.ie-minimap canvas { width: 100%; height: 100%; display: block; }
.ie-minimap-label {
  position: absolute;
  bottom: 2px; left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: rgba(255,255,255,0.4);
  pointer-events: none;
}

/* --- Save Dialog --- */
.ie-dialog-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  z-index: 2000;
}
.ie-dialog {
  background: linear-gradient(145deg, #1e1b32, #2a2540);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 14px;
  padding: 24px 28px;
  max-width: 360px;
  text-align: center;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
}
.ie-dialog h3 {
  margin: 0 0 10px 0;
  color: #fff;
  font-size: 18px;
}
.ie-dialog p { color: #bbb; font-size: 14px; margin: 0 0 18px 0; }
.ie-dialog-buttons { display: flex; gap: 10px; justify-content: center; }
.ie-dialog button {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.15);
  transition: all 0.15s;
}
.ie-dialog .btn-save {
  background: rgba(78, 205, 196, 0.2);
  color: #4ecdc4;
  border-color: rgba(78, 205, 196, 0.4);
}
.ie-dialog .btn-save:hover { background: rgba(78, 205, 196, 0.35); }
.ie-dialog .btn-discard {
  background: rgba(255, 107, 107, 0.15);
  color: #ff6b6b;
  border-color: rgba(255, 107, 107, 0.3);
}
.ie-dialog .btn-discard:hover { background: rgba(255, 107, 107, 0.3); }
.ie-dialog .btn-cancel {
  background: rgba(255,255,255,0.06);
  color: #ccc;
}
.ie-dialog .btn-cancel:hover { background: rgba(255,255,255,0.12); color: #fff; }

/* --- Shortcuts Legend --- */
.ie-shortcuts {
  position: absolute;
  bottom: 64px; left: 12px;
  background: rgba(20, 18, 35, 0.85);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 11px;
  color: rgba(255,255,255,0.45);
  line-height: 1.6;
}
.ie-shortcuts kbd {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 3px;
  padding: 1px 5px;
  font-family: monospace;
  font-size: 10px;
}

/* --- Dirty Indicator --- */
.ie-dirty-indicator {
  position: absolute;
  top: 14px; right: 14px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #ff6b6b;
  box-shadow: 0 0 6px rgba(255, 107, 107, 0.5);
  animation: ie-pulse 1.5s ease-in-out infinite;
  display: none;
}
.ie-dirty-indicator.visible { display: block; }
@keyframes ie-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
`;

// ------------------------------------------------------------------
// IslandEditorUI
// ------------------------------------------------------------------

export class IslandEditorUI {
  /**
   * @param {import('./IslandEditor.js').IslandEditor} editor
   */
  constructor(editor) {
    this.editor = editor;
    this.container = null;
    this.styleEl = null;

    // Cached element references
    this._modeButtons = {};
    this._catButtons = {};
    this._paletteEl = null;
    this._colorPreview = null;
    this._colorValues = null;
    this._propPanel = null;
    this._minimapCanvas = null;
    this._dirtyIndicator = null;

    this._injectStyles();
  }

  // ================================================================
  // Show / Hide
  // ================================================================

  /** Build and display the editor UI overlay. */
  show() {
    if (this.container) return; // Already visible

    this.container = document.createElement('div');
    this.container.className = 'island-editor-ui';

    this._buildToolbar();
    this._buildCategoryTabs();
    this._buildItemPalette();
    this._buildColorPanel();
    this._buildPropertyPanel();
    this._buildBottomBar();
    this._buildMinimap();
    this._buildShortcutsLegend();
    this._buildDirtyIndicator();

    document.body.appendChild(this.container);
    this.refreshPalette();
    this.refreshProperties();
  }

  /** Hide and remove the editor UI overlay. */
  hide() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this._modeButtons = {};
    this._catButtons = {};
    this._paletteEl = null;
  }

  /** Fully destroy the UI, removing styles too. */
  destroy() {
    this.hide();
    if (this.styleEl) {
      this.styleEl.remove();
      this.styleEl = null;
    }
  }

  // ================================================================
  // Style injection
  // ================================================================

  /** @private */
  _injectStyles() {
    if (document.getElementById('island-editor-styles')) return;
    this.styleEl = document.createElement('style');
    this.styleEl.id = 'island-editor-styles';
    this.styleEl.textContent = EDITOR_CSS;
    document.head.appendChild(this.styleEl);
  }

  // ================================================================
  // Toolbar (mode selection)
  // ================================================================

  /** @private */
  _buildToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'ie-toolbar';

    const modes = [
      { key: 'place',   label: 'Place',   icon: '✏️', cls: '' },
      { key: 'paint',   label: 'Paint',   icon: '🎨', cls: 'mode-paint' },
      { key: 'move',    label: 'Move',    icon: '↔️', cls: 'mode-move' },
      { key: 'delete',  label: 'Delete',  icon: '🗑️', cls: 'mode-delete' }
    ];

    modes.forEach(({ key, label, icon, cls }) => {
      const btn = document.createElement('button');
      btn.className = cls;
      btn.innerHTML = `<span>${icon}</span> ${label}`;
      btn.addEventListener('click', () => {
        this.editor.setMode(key);
        this._updateModeButtons();
        this.refreshProperties();
      });
      this._modeButtons[key] = btn;
      toolbar.appendChild(btn);
    });

    this._updateModeButtons();
    this.container.appendChild(toolbar);
  }

  /** @private */
  _updateModeButtons() {
    for (const [key, btn] of Object.entries(this._modeButtons)) {
      btn.classList.toggle('active', this.editor.mode === key);
    }
  }

  // ================================================================
  // Category tabs
  // ================================================================

  /** @private */
  _buildCategoryTabs() {
    const tabs = document.createElement('div');
    tabs.className = 'ie-categories';

    const categories = ['furniture', 'wallpaper', 'floor', 'props', 'effects'];
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        this.editor.setCategory(cat);
        this._updateCategoryButtons();
        this.refreshPalette();
      });
      this._catButtons[cat] = btn;
      tabs.appendChild(btn);
    });

    this._updateCategoryButtons();
    this.container.appendChild(tabs);
  }

  /** @private */
  _updateCategoryButtons() {
    for (const [cat, btn] of Object.entries(this._catButtons)) {
      btn.classList.toggle('active', this.editor.selectedCategory === cat);
    }
  }

  // ================================================================
  // Item palette
  // ================================================================

  /** @private */
  _buildItemPalette() {
    this._paletteEl = document.createElement('div');
    this._paletteEl.className = 'ie-palette';
    this.container.appendChild(this._paletteEl);
  }

  /** Refresh the item palette grid for the current category. */
  refreshPalette() {
    if (!this._paletteEl) return;
    this._paletteEl.innerHTML = '';

    const items = this.editor.getItemsForCategory();
    items.forEach(itemId => {
      const info = this.editor.getItemInfo(itemId);
      const cell = document.createElement('div');
      cell.className = 'ie-palette-item';
      cell.innerHTML = `
        <span style="font-size:26px">${info.emoji || itemId}</span>
        <span class="label">${info.name || itemId}</span>
      `;

      if (this.editor.selectedItem === itemId) {
        cell.classList.add('selected');
      }

      cell.addEventListener('click', () => {
        this.editor.selectItem(itemId);
        // Refresh selection visuals
        Array.from(this._paletteEl.children).forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
      });

      this._paletteEl.appendChild(cell);
    });
  }

  // ================================================================
  // Color panel
  // ================================================================

  /** @private */
  _buildColorPanel() {
    const panel = document.createElement('div');
    panel.className = 'ie-color-panel';

    const heading = document.createElement('h3');
    heading.textContent = 'Color';
    panel.appendChild(heading);

    // Color preview bar
    this._colorPreview = document.createElement('div');
    this._colorPreview.className = 'ie-color-preview';
    panel.appendChild(this._colorPreview);

    // Color wheel container
    const wheelWrap = document.createElement('div');
    wheelWrap.className = 'ie-color-wheel';
    const wheelCanvas = document.createElement('canvas');
    wheelCanvas.width = 200;
    wheelCanvas.height = 200;
    wheelWrap.appendChild(wheelCanvas);
    panel.appendChild(wheelWrap);

    // HSL values display
    this._colorValues = document.createElement('div');
    this._colorValues.className = 'ie-color-values';
    panel.appendChild(this._colorValues);

    // Recent colors
    const recentWrap = document.createElement('div');
    recentWrap.className = 'ie-recent-colors';
    panel.appendChild(recentWrap);

    // Initialize color wheel
    this.editor.renderColorWheel(wheelCanvas, color => {
      this._updateColorDisplay(color);
      this.editor.renderRecentColors(recentWrap, c => {
        this._updateColorDisplay(c);
        this.editor.paintColor = { ...c };
      });
    });

    // Initial render of recent colors
    this.editor.renderRecentColors(recentWrap, c => {
      this._updateColorDisplay(c);
      this.editor.paintColor = { ...c };
    });

    this._updateColorDisplay(this.editor.paintColor);
    this.container.appendChild(panel);
  }

  /** @private */
  _updateColorDisplay(color) {
    if (this._colorPreview) {
      this._colorPreview.style.background = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
    }
    if (this._colorValues) {
      this._colorValues.innerHTML = `
        <span class="val">H:${color.h|0}</span>
        <span class="val">S:${color.s|0}</span>
        <span class="val">L:${color.l|0}</span>
      `;
    }
  }

  // ================================================================
  // Property panel
  // ================================================================

  /** @private */
  _buildPropertyPanel() {
    this._propPanel = document.createElement('div');
    this._propPanel.className = 'ie-property-panel';
    this.container.appendChild(this._propPanel);
  }

  /** Refresh the property panel based on the hovered item and mode. */
  refreshProperties() {
    if (!this._propPanel) return;
    this._propPanel.innerHTML = '';

    const heading = document.createElement('h3');
    heading.textContent = 'Properties';
    this._propPanel.appendChild(heading);

    const item = this.editor.hoveredPlacedItem;

    if (!item) {
      const msg = document.createElement('div');
      msg.style.cssText = 'font-size:12px; color:#777; text-align:center; padding:8px 0;';
      msg.textContent = this.editor.mode === 'move'
        ? 'Hover an item to edit'
        : 'Select items on the canvas';
      this._propPanel.appendChild(msg);
      return;
    }

    // Rotation
    this._addPropRow('Rotation', [
      { label: '⟲', action: () => this.editor.rotateItem(item.id, -90) },
      { label: `${item.rotation}°`, isValue: true },
      { label: '⟳', action: () => this.editor.rotateItem(item.id, 90) }
    ]);

    // Scale
    this._addPropRow('Scale', [
      { label: '-', action: () => this.editor.scaleItem(item.id, -0.1) },
      { label: `${item.scale.toFixed(1)}x`, isValue: true },
      { label: '+', action: () => this.editor.scaleItem(item.id, 0.1) }
    ]);

    // Flip
    this._addPropRow('Flip', [
      { label: item.flipped ? '↔️ On' : '↔️ Off', action: () => this.editor.flipItem(item.id) }
    ]);

    // Layer
    this._addPropRow('Layer', [
      { label: '▼', action: () => this.editor.changeLayer(item.id, -1) },
      { label: `${item.layer}`, isValue: true },
      { label: '▲', action: () => this.editor.changeLayer(item.id, 1) }
    ]);

    // Color readout
    const c = item.color;
    this._addPropRow('Tint', [
      { label: `HSL(${c.h|0},${c.s|0}%,${c.l|0}%)`, isValue: true }
    ]);

    // ID (small)
    const idRow = document.createElement('div');
    idRow.style.cssText = 'font-size:9px; color:#555; text-align:center; margin-top:6px;';
    idRow.textContent = item.id.slice(0, 20) + '...';
    this._propPanel.appendChild(idRow);
  }

  /**
   * @private
   * @param {string} label
   * @param {Array<{label:string,action?:Function,isValue?:boolean}>} controls
   */
  _addPropRow(label, controls) {
    const row = document.createElement('div');
    row.className = 'ie-prop-row';

    const lbl = document.createElement('label');
    lbl.textContent = label;
    row.appendChild(lbl);

    const ctrlWrap = document.createElement('div');
    ctrlWrap.style.display = 'flex';
    ctrlWrap.style.alignItems = 'center';
    ctrlWrap.style.gap = '4px';

    controls.forEach(ctrl => {
      if (ctrl.isValue) {
        const span = document.createElement('span');
        span.className = 'prop-value';
        span.textContent = ctrl.label;
        ctrlWrap.appendChild(span);
      } else {
        const btn = document.createElement('button');
        btn.textContent = ctrl.label;
        btn.addEventListener('click', ctrl.action);
        ctrlWrap.appendChild(btn);
      }
    });

    row.appendChild(ctrlWrap);
    this._propPanel.appendChild(row);
  }

  // ================================================================
  // Bottom bar
  // ================================================================

  /** @private */
  _buildBottomBar() {
    const bar = document.createElement('div');
    bar.className = 'ie-bottom-bar';

    // Grid toggle
    const gridToggle = document.createElement('label');
    gridToggle.className = 'ie-toggle';
    gridToggle.innerHTML = `<input type="checkbox" ${this.editor.showGrid ? 'checked' : ''}> Grid`;
    gridToggle.querySelector('input').addEventListener('change', e => {
      this.editor.showGrid = e.target.checked;
    });
    bar.appendChild(gridToggle);

    // Snap toggle
    const snapToggle = document.createElement('label');
    snapToggle.className = 'ie-toggle';
    snapToggle.innerHTML = `<input type="checkbox" ${this.editor.snapToGrid ? 'checked' : ''}> Snap`;
    snapToggle.querySelector('input').addEventListener('change', e => {
      this.editor.snapToGrid = e.target.checked;
    });
    bar.appendChild(snapToggle);

    // Undo / Redo
    const undoRedo = document.createElement('div');
    undoRedo.className = 'ie-undo-redo';

    const undoBtn = document.createElement('button');
    undoBtn.textContent = '↩️ Undo';
    undoBtn.title = 'Ctrl+Z';
    undoBtn.addEventListener('click', () => this.editor.undo());
    undoRedo.appendChild(undoBtn);

    const redoBtn = document.createElement('button');
    redoBtn.textContent = '↪️ Redo';
    redoBtn.title = 'Ctrl+Y';
    redoBtn.addEventListener('click', () => this.editor.redo());
    undoRedo.appendChild(redoBtn);

    bar.appendChild(undoRedo);

    // Separator
    const sep = document.createElement('span');
    sep.textContent = '|';
    sep.style.color = 'rgba(255,255,255,0.15)';
    bar.appendChild(sep);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'primary';
    saveBtn.textContent = '💾 Save';
    saveBtn.addEventListener('click', () => {
      this.editor.saveIsland();
      this._showToast('Island saved!');
    });
    bar.appendChild(saveBtn);

    // Exit button
    const exitBtn = document.createElement('button');
    exitBtn.className = 'danger';
    exitBtn.textContent = '✖ Exit';
    exitBtn.addEventListener('click', () => {
      if (this.editor.isDirty()) {
        this._showSaveDialog();
      } else {
        this.editor.exit();
      }
    });
    bar.appendChild(exitBtn);

    this.container.appendChild(bar);
  }

  // ================================================================
  // Mini-map
  // ================================================================

  /** @private */
  _buildMinimap() {
    const wrap = document.createElement('div');
    wrap.className = 'ie-minimap';

    this._minimapCanvas = document.createElement('canvas');
    this._minimapCanvas.width = 140;
    this._minimapCanvas.height = 140;
    wrap.appendChild(this._minimapCanvas);

    const label = document.createElement('span');
    label.className = 'ie-minimap-label';
    label.textContent = 'Mini-map';
    wrap.appendChild(label);

    this.container.appendChild(wrap);

    // Update minimap on animation frame
    this._scheduleMinimapUpdate();
  }

  /** @private */
  _scheduleMinimapUpdate() {
    const update = () => {
      if (!this.editor.active || !this._minimapCanvas) return;
      const ctx = this._minimapCanvas.getContext('2d');
      this.editor.renderMinimap(ctx, 140);
      requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  // ================================================================
  // Shortcuts legend
  // ================================================================

  /** @private */
  _buildShortcutsLegend() {
    const legend = document.createElement('div');
    legend.className = 'ie-shortcuts';
    legend.innerHTML = `
      <kbd>1</kbd>-<kbd>4</kbd> Modes &nbsp;
      <kbd>Ctrl</kbd>+<kbd>Z</kbd> Undo<br>
      <kbd>R</kbd> Rotate <kbd>F</kbd> Flip &nbsp;
      <kbd>+</kbd>/<kbd>-</kbd> Scale<br>
      <kbd>[</kbd>/<kbd>]</kbd> Layer &nbsp;
      <kbd>G</kbd> Grid <kbd>S</kbd> Snap<br>
      <kbd>Esc</kbd> Exit Editor
    `;
    this.container.appendChild(legend);
  }

  // ================================================================
  // Dirty indicator
  // ================================================================

  /** @private */
  _buildDirtyIndicator() {
    this._dirtyIndicator = document.createElement('div');
    this._dirtyIndicator.className = 'ie-dirty-indicator';
    this.container.appendChild(this._dirtyIndicator);
  }

  /** Show or hide the unsaved-changes dot. */
  updateDirtyState() {
    if (this._dirtyIndicator) {
      this._dirtyIndicator.classList.toggle('visible', this.editor.isDirty());
    }
  }

  // ================================================================
  // Dialogs
  // ================================================================

  /**
   * Show a save confirmation dialog before exiting with unsaved changes.
   * @private
   */
  _showSaveDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'ie-dialog-overlay';

    overlay.innerHTML = `
      <div class="ie-dialog">
        <h3>Save Changes?</h3>
        <p>You have unsaved changes to your island. Save before exiting?</p>
        <div class="ie-dialog-buttons">
          <button class="btn-save">Save & Exit</button>
          <button class="btn-discard">Discard</button>
          <button class="btn-cancel">Cancel</button>
        </div>
      </div>
    `;

    overlay.querySelector('.btn-save').addEventListener('click', () => {
      this.editor.saveIsland();
      overlay.remove();
      this.editor.exit();
    });
    overlay.querySelector('.btn-discard').addEventListener('click', () => {
      overlay.remove();
      this.editor.exit();
    });
    overlay.querySelector('.btn-cancel').addEventListener('click', () => {
      overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  /**
   * Show a temporary toast notification.
   * @param {string} message
   * @private
   */
  _showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(20, 18, 35, 0.95);
      color: #4ecdc4;
      padding: 14px 28px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      border: 1px solid rgba(78, 205, 196, 0.3);
      box-shadow: 0 8px 30px rgba(0,0,0,0.5);
      z-index: 3000;
      pointer-events: none;
      animation: ie-fade-in-out 1.5s ease forwards;
    `;
    toast.textContent = message;

    const anim = document.createElement('style');
    anim.textContent = `
      @keyframes ie-fade-in-out {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
      }
    `;
    document.head.appendChild(anim);
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
      anim.remove();
    }, 1500);
  }

  // ================================================================
  // Per-frame UI updates (call from game loop)
  // ================================================================

  /** Update UI elements that change every frame (dirty indicator, properties). */
  update() {
    this.updateDirtyState();
    // Property panel updates when hovered item changes
    const currentHover = this.editor.hoveredPlacedItem;
    if (currentHover !== this._lastHoveredItem) {
      this._lastHoveredItem = currentHover;
      this.refreshProperties();
    }
  }
}
