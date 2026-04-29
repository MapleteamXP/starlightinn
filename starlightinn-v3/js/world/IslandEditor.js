/**
 * IslandEditor.js
 * ===============
 * Full room / island editor for Starlight Inn v3.5 (Virtual Horizon).
 *
 * Provides four edit modes:
 *   - **place**   : drop furniture, props, wallpaper, and floor items
 *   - **paint**   : HSL colour painting of placed items and floor surfaces
 *   - **move**    : drag, rotate, scale, flip, and layer-sort placed items
 *   - **delete**  : remove items with undo support
 *
 * Features
 * --------
 * - Undo / redo stack (50 deep) covering place, paint, move, delete, surface,
 *   rotate, scale, flip, and layer actions.
 * - Canvas-based interactive HSL colour wheel (hue ring + SL triangle).
 * - Optional snap-to-grid with configurable grid size.
 * - Click-drag surface painting for floor tiles.
 * - Full serialize / deserialize to localStorage + server sync hooks.
 * - Grid overlay rendering.
 * - Emoji-based item rendering with colour tint, rotation, scale, and flip.
 *
 * @module world/IslandEditor
 */

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

/** Maximum number of undo states before oldest is dropped. */
const MAX_UNDO = 50;

/** Default grid cell size in pixels. */
const DEFAULT_GRID = 32;

/** Minimum item scale factor. */
const MIN_SCALE = 0.5;

/** Maximum item scale factor. */
const MAX_SCALE = 2.0;

/** Degrees per rotation step. */
const ROTATION_STEP = 90;

/** Scale increment per step. */
const SCALE_STEP = 0.1;

/** Categories of items available in the editor. */
const CATEGORIES = ['furniture', 'wallpaper', 'floor', 'props', 'effects'];

/** Default emoji palette per category (shown when catalog unavailable). */
const DEFAULT_ITEMS = {
  furniture: ['🛋️', '🛏️', '🪑', '📚', '🕯️', '🪴', '🏮', '🪞', '🧸', '📖', '🍵', '🩴'],
  wallpaper: ['🧱', '🟦', '🟪', '🟩', '🟨', '⬜', '🌸', '🍂', '❄️', '🔥'],
  floor:     ['🟫', '⬜', '🟦', '🟩', '🪵', '🪨', '🧱', '🔲', '🌿', '🏖️'],
  props:     ['🎨', '🎭', '🎪', '🎈', '🌹', '🐚', '🍄', '🦋', '⭐', '🌙'],
  effects:   ['✨', '🔥', '💧', '🫧', '💨', '🌈', '⚡', '🎵', '💎', '🌀']
};

// ------------------------------------------------------------------
// HSL helpers
// ------------------------------------------------------------------

/**
 * Convert HSL values to a CSS hsl() string.
 * @param {{h:number,s:number,l:number}} c
 * @returns {string}
 */
function hslToCss(c) {
  return `hsl(${c.h | 0}, ${c.s | 0}%, ${c.l | 0}%)`;
}

/**
 * Convert HSL to an RGB hex string for canvas fills.
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @returns {string}
 */
function hslToHex(h, s, l) {
  const H = h / 360;
  const S = s / 100;
  const L = l / 100;
  const a = S * Math.min(L, 1 - L);
  const f = n => {
    const k = (n + H * 12) % 12;
    const color = L - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ------------------------------------------------------------------
// IslandEditor
// ------------------------------------------------------------------

export class IslandEditor {
  /**
   * Create a new IslandEditor.
   * @param {Object} game — The main Game instance with canvas, state,
   *                        audio, catalog, and network references.
   */
  constructor(game) {
    this.game = game;

    // ---- Editor state ----
    this.active = false;
    /** @type {'place'|'paint'|'move'|'delete'} */
    this.mode = 'place';
    /** @type {string|null} */
    this.selectedItem = null;
    /** @type {string} */
    this.selectedCategory = 'furniture';

    // ---- Grid settings ----
    this.gridSize = DEFAULT_GRID;
    this.showGrid = true;
    this.snapToGrid = true;

    // ---- Undo / Redo ----
    /** @type {Object[]} */
    this.undoStack = [];
    /** @type {Object[]} */
    this.redoStack = [];
    this.maxUndo = MAX_UNDO;

    // ---- Placed items ----
    /** @type {Object[]} */
    this.placedItems = [];

    // ---- Surface painting ----
    /** @type {Map<string, {h:number,s:number,l:number}>} */
    this.paintedSurfaces = new Map();

    // ---- Paint state ----
    this.paintColor = { h: 200, s: 50, l: 50 };
    /** @type {Object|null} */
    this.hoveredPlacedItem = null;
    this.hoveredCell = null;

    // ---- Drag state ----
    this.isDragging = false;
    /** @type {string|null} */
    this.dragItemId = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // ---- Surface paint drag ----
    this.isSurfacePainting = false;

    // ---- UI reference ----
    /** @type {import('./IslandEditorUI.js').IslandEditorUI|null} */
    this.ui = null;

    // ---- Recent colours (shared across session) ----
    /** @type {{h:number,s:number,l:number}[]} */
    this.recentColors = [
      { h: 200, s: 50, l: 50 },
      { h: 0, s: 70, l: 50 },
      { h: 120, s: 60, l: 45 },
      { h: 60, s: 80, l: 55 },
      { h: 280, s: 55, l: 50 }
    ];

    // ---- Dirty flag for save prompting ----
    this.dirty = false;

    // ---- Event binding ----
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onWheel = this._onWheel.bind(this);

    // ---- Catalog cache ----
    this._catalogItems = null;
  }

  // ================================================================
  // Lifecycle
  // ================================================================

  /**
   * Activate the editor, loading the player's saved island.
   * Switches the game state to 'editor' and shows the editor UI.
   */
  enter() {
    this.active = true;
    this.dirty = false;
    this.mode = 'place';
    this.selectedItem = null;
    this.game.state.screen = 'editor';

    this.loadIsland();
    this._attachInput();

    // Create and show UI if available
    if (typeof window !== 'undefined') {
      import('./IslandEditorUI.js').then(({ IslandEditorUI }) => {
        if (!this.ui) {
          this.ui = new IslandEditorUI(this);
        }
        this.ui.show();
      }).catch(() => {
        // UI module not available — editor still works via keyboard
        console.log('[IslandEditor] UI module not found; keyboard controls active.');
      });
    }

    // Play enter sound
    if (this.game.audio) {
      this.game.audio.playSFX('editor_open');
    }

    console.log('[IslandEditor] Entered editor mode');
  }

  /**
   * Deactivate the editor, saving the island and restoring game state.
   */
  exit() {
    if (this.dirty) {
      this.saveIsland();
      this._syncToServer();
    }

    this.active = false;
    this._detachInput();

    if (this.ui) {
      this.ui.hide();
    }

    this.game.state.screen = 'game';

    if (this.game.audio) {
      this.game.audio.playSFX('editor_close');
    }

    console.log('[IslandEditor] Exited editor mode');
  }

  /**
   * Check if there are unsaved changes.
   * @returns {boolean}
   */
  isDirty() {
    return this.dirty;
  }

  // ================================================================
  // Input handling
  // ================================================================

  /** Attach all pointer and keyboard listeners to the game canvas. @private */
  _attachInput() {
    const canvas = this.game.canvas;
    if (!canvas) return;
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('keydown', this._onKeyDown);
  }

  /** Remove all input listeners. @private */
  _detachInput() {
    const canvas = this.game.canvas;
    if (!canvas) return;
    canvas.removeEventListener('pointerdown', this._onPointerDown);
    canvas.removeEventListener('pointermove', this._onPointerMove);
    canvas.removeEventListener('pointerup', this._onPointerUp);
    canvas.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('keydown', this._onKeyDown);
  }

  // ---- Pointer events ----

  /** @private */
  _onPointerDown(e) {
    if (!this.active) return;
    const rect = this.game.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    switch (this.mode) {
      case 'place':
        this._handlePlaceDown(x, y);
        break;
      case 'paint':
        this._handlePaintDown(x, y);
        break;
      case 'move':
        this._handleMoveDown(x, y);
        break;
      case 'delete':
        this._handleDeleteClick(x, y);
        break;
    }
  }

  /** @private */
  _onPointerMove(e) {
    if (!this.active) return;
    const rect = this.game.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update hovered cell
    this.hoveredCell = {
      x: this.snapToGrid ? Math.round(x / this.gridSize) * this.gridSize : x,
      y: this.snapToGrid ? Math.round(y / this.gridSize) * this.gridSize : y
    };

    // Update hovered item
    this.hoveredPlacedItem = this._itemAt(x, y);

    if (this.mode === 'move' && this.isDragging && this.dragItemId) {
      this.moveItem(this.dragItemId, x - this.dragOffsetX, y - this.dragOffsetY);
    }

    if (this.mode === 'paint' && this.isSurfacePainting) {
      const gx = Math.floor(x / this.gridSize);
      const gy = Math.floor(y / this.gridSize);
      this.paintSurface(gx, gy, { ...this.paintColor });
    }
  }

  /** @private */
  _onPointerUp(e) {
    this.isDragging = false;
    this.dragItemId = null;
    this.isSurfacePainting = false;
  }

  /** @private */
  _onWheel(e) {
    if (!this.active) return;
    e.preventDefault();

    if (this.mode === 'move' && this.hoveredPlacedItem) {
      const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
      this.scaleItem(this.hoveredPlacedItem.id, delta);
    }
  }

  // ---- Mode-specific handlers ----

  /** @private */
  _handlePlaceDown(x, y) {
    if (!this.selectedItem) return;
    this.placeItem(this.selectedItem, x, y);
  }

  /** @private */
  _handlePaintDown(x, y) {
    const item = this._itemAt(x, y);
    if (item) {
      // Paint an existing placed item
      this.paintItem(item.id, this.paintColor.h, this.paintColor.s, this.paintColor.l);
    } else {
      // Paint the floor surface
      const gx = Math.floor(x / this.gridSize);
      const gy = Math.floor(y / this.gridSize);
      this.isSurfacePainting = true;
      this.paintSurface(gx, gy, { ...this.paintColor });
    }
  }

  /** @private */
  _handleMoveDown(x, y) {
    const item = this._itemAt(x, y);
    if (item) {
      this.isDragging = true;
      this.dragItemId = item.id;
      this.dragOffsetX = x - item.x;
      this.dragOffsetY = y - item.y;
      this.dragStartX = item.x;
      this.dragStartY = item.y;

      // Push undo on release (captures the whole drag as one action)
      const originalX = item.x;
      const originalY = item.y;

      const onUp = () => {
        if (item.x !== originalX || item.y !== originalY) {
          this.pushUndo({ type: 'move', id: item.id, oldX: originalX, oldY: originalY });
        }
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointerup', onUp, { once: true });
    }
  }

  /** @private */
  _handleDeleteClick(x, y) {
    const item = this._itemAt(x, y);
    if (item) {
      this.deleteItem(item.id);
    }
  }

  // ---- Keyboard shortcuts ----

  /** @private */
  _onKeyDown(e) {
    if (!this.active) return;

    // Ctrl+Z / Cmd+Z = undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
      return;
    }

    // Ctrl+Y / Cmd+Shift+Z = redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      this.redo();
      return;
    }

    // Mode switching (number keys)
    if (e.key === '1') { this.setMode('place'); return; }
    if (e.key === '2') { this.setMode('paint'); return; }
    if (e.key === '3') { this.setMode('move'); return; }
    if (e.key === '4') { this.setMode('delete'); return; }

    // G = toggle grid
    if (e.key === 'g' || e.key === 'G') {
      this.showGrid = !this.showGrid;
      return;
    }

    // S = toggle snap
    if (e.key === 's' || e.key === 'S') {
      this.snapToGrid = !this.snapToGrid;
      return;
    }

    // R = rotate hovered item (move mode)
    if ((e.key === 'r' || e.key === 'R') && this.mode === 'move' && this.hoveredPlacedItem) {
      this.rotateItem(this.hoveredPlacedItem.id, ROTATION_STEP);
      return;
    }

    // F = flip hovered item (move mode)
    if ((e.key === 'f' || e.key === 'F') && this.mode === 'move' && this.hoveredPlacedItem) {
      this.flipItem(this.hoveredPlacedItem.id);
      return;
    }

    // +/- = scale hovered item (move mode)
    if ((e.key === '+' || e.key === '=') && this.mode === 'move' && this.hoveredPlacedItem) {
      this.scaleItem(this.hoveredPlacedItem.id, SCALE_STEP);
      return;
    }
    if ((e.key === '-' || e.key === '_') && this.mode === 'move' && this.hoveredPlacedItem) {
      this.scaleItem(this.hoveredPlacedItem.id, -SCALE_STEP);
      return;
    }

    // [ / ] = change layer
    if (e.key === ']' && this.mode === 'move' && this.hoveredPlacedItem) {
      this.changeLayer(this.hoveredPlacedItem.id, 1);
      return;
    }
    if (e.key === '[' && this.mode === 'move' && this.hoveredPlacedItem) {
      this.changeLayer(this.hoveredPlacedItem.id, -1);
      return;
    }

    // Escape = exit editor
    if (e.key === 'Escape') {
      this.exit();
    }
  }

  // ================================================================
  // Mode management
  // ================================================================

  /**
   * Switch the current editor mode.
   * @param {'place'|'paint'|'move'|'delete'} mode
   */
  setMode(mode) {
    if (!['place', 'paint', 'move', 'delete'].includes(mode)) return;
    this.mode = mode;
    this.isDragging = false;
    this.dragItemId = null;
    this.isSurfacePainting = false;
    if (this.game.audio) this.game.audio.playSFX('mode_switch');
  }

  /**
   * Switch the item category for placement.
   * @param {string} category — one of furniture, wallpaper, floor, props, effects
   */
  setCategory(category) {
    if (!CATEGORIES.includes(category)) return;
    this.selectedCategory = category;
    this.selectedItem = null;
  }

  /**
   * Select an item for placement.
   * @param {string} itemId — emoji or catalog item identifier
   */
  selectItem(itemId) {
    this.selectedItem = itemId;
    if (this.mode !== 'place') this.setMode('place');
  }

  // ================================================================
  // Item catalog
  // ================================================================

  /**
   * Get available items for the current category.
   * @returns {string[]} List of item identifiers (emojis or catalog IDs).
   */
  getItemsForCategory() {
    if (this.game.catalog && typeof this.game.catalog.getItemsByCategory === 'function') {
      return this.game.catalog.getItemsByCategory(this.selectedCategory);
    }
    return DEFAULT_ITEMS[this.selectedCategory] || [];
  }

  /**
   * Get display info for an item.
   * @param {string} itemId
   * @returns {{emoji:string, name:string, category:string}}
   */
  getItemInfo(itemId) {
    if (this.game.catalog && typeof this.game.catalog.getItem === 'function') {
      const item = this.game.catalog.getItem(itemId);
      if (item) return item;
    }
    return {
      emoji: itemId,
      name: itemId,
      category: this.selectedCategory
    };
  }

  // ================================================================
  // Hit testing
  // ================================================================

  /**
   * Find the top-most placed item under the given canvas coordinates.
   * @param {number} x — canvas X
   * @param {number} y — canvas Y
   * @returns {Object|null}
   * @private
   */
  _itemAt(x, y) {
    // Check in reverse draw order (top-most first)
    const sorted = [...this.placedItems].sort((a, b) => b.layer - a.layer);
    const hitRadius = this.gridSize * 0.8;

    for (const item of sorted) {
      const dx = x - (item.x + this.gridSize / 2);
      const dy = y - (item.y + this.gridSize / 2);
      if (Math.sqrt(dx * dx + dy * dy) < hitRadius * item.scale) {
        return item;
      }
    }
    return null;
  }

  // ================================================================
  // Placement
  // ================================================================

  /**
   * Place a new item onto the island canvas.
   * @param {string} itemId — emoji or catalog item identifier
   * @param {number} x — canvas X coordinate
   * @param {number} y — canvas Y coordinate
   */
  placeItem(itemId, x, y) {
    const info = this.getItemInfo(itemId);
    if (!info) return;

    const placement = {
      id: `placed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      itemId,
      x: this.snapToGrid ? Math.round(x / this.gridSize) * this.gridSize : x,
      y: this.snapToGrid ? Math.round(y / this.gridSize) * this.gridSize : y,
      rotation: 0,
      scale: 1,
      color: { h: 0, s: 0, l: 50 },
      layer: this._nextLayer(),
      flipped: false
    };

    this.pushUndo({ type: 'place', item: placement });
    this.placedItems.push(placement);
    this.dirty = true;

    if (this.game.audio) this.game.audio.playSFX('place');
  }

  /**
   * Get the next available layer index for a new item.
   * @returns {number}
   * @private
   */
  _nextLayer() {
    if (this.placedItems.length === 0) return 0;
    return Math.max(...this.placedItems.map(i => i.layer)) + 1;
  }

  // ================================================================
  // Painting
  // ================================================================

  /**
   * Apply an HSL colour to a placed item.
   * @param {string} placedId
   * @param {number} hue   — 0-360
   * @param {number} sat   — 0-100
   * @param {number} light — 0-100
   */
  paintItem(placedId, hue, sat, light) {
    const item = this.placedItems.find(p => p.id === placedId);
    if (!item) return;

    this.pushUndo({ type: 'paint', id: placedId, oldColor: { ...item.color } });
    item.color = { h: hue, s: sat, l: light };
    this.dirty = true;

    this._addRecentColor({ h: hue, s: sat, l: light });

    if (this.game.audio) this.game.audio.playSFX('paint');
  }

  /**
   * Paint a floor surface cell with the current HSL colour.
   * @param {number} gridX — grid column index
   * @param {number} gridY — grid row index
   * @param {{h:number,s:number,l:number}} color
   */
  paintSurface(gridX, gridY, color) {
    const key = `${gridX},${gridY}`;
    const oldColor = this.paintedSurfaces.get(key);
    if (oldColor && oldColor.h === color.h && oldColor.s === color.s && oldColor.l === color.l) {
      return; // No change
    }

    this.pushUndo({ type: 'surface', key, oldColor: oldColor ? { ...oldColor } : null });
    this.paintedSurfaces.set(key, { ...color });
    this.dirty = true;
  }

  /**
   * Clear all surface painting.
   */
  clearAllSurfaces() {
    if (this.paintedSurfaces.size === 0) return;
    const entries = Array.from(this.paintedSurfaces.entries());
    this.pushUndo({ type: 'clear_surfaces', entries });
    this.paintedSurfaces.clear();
    this.dirty = true;
  }

  // ================================================================
  // Movement & transformation
  // ================================================================

  /**
   * Move a placed item to new canvas coordinates.
   * @param {string} placedId
   * @param {number} newX
   * @param {number} newY
   */
  moveItem(placedId, newX, newY) {
    const item = this.placedItems.find(p => p.id === placedId);
    if (!item) return;

    item.x = this.snapToGrid ? Math.round(newX / this.gridSize) * this.gridSize : newX;
    item.y = this.snapToGrid ? Math.round(newY / this.gridSize) * this.gridSize : newY;
    this.dirty = true;
  }

  /**
   * Rotate a placed item.
   * @param {string} placedId
   * @param {number} delta — degrees to add (default 90)
   */
  rotateItem(placedId, delta = ROTATION_STEP) {
    const item = this.placedItems.find(p => p.id === placedId);
    if (!item) return;

    this.pushUndo({ type: 'rotate', id: placedId, oldRotation: item.rotation });
    item.rotation = (item.rotation + delta) % 360;
    this.dirty = true;
  }

  /**
   * Scale a placed item.
   * @param {string} placedId
   * @param {number} delta — amount to add/subtract (default 0.1)
   */
  scaleItem(placedId, delta = SCALE_STEP) {
    const item = this.placedItems.find(p => p.id === placedId);
    if (!item) return;

    this.pushUndo({ type: 'scale', id: placedId, oldScale: item.scale });
    item.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, item.scale + delta));
    this.dirty = true;
  }

  /**
   * Flip a placed item horizontally.
   * @param {string} placedId
   */
  flipItem(placedId) {
    const item = this.placedItems.find(p => p.id === placedId);
    if (!item) return;

    this.pushUndo({ type: 'flip', id: placedId, oldFlipped: item.flipped });
    item.flipped = !item.flipped;
    this.dirty = true;
  }

  /**
   * Change the render layer of a placed item.
   * @param {string} placedId
   * @param {number} delta — +1 to move up, -1 to move down
   */
  changeLayer(placedId, delta) {
    const item = this.placedItems.find(p => p.id === placedId);
    if (!item) return;

    this.pushUndo({ type: 'layer', id: placedId, oldLayer: item.layer });
    item.layer = Math.max(0, item.layer + delta);
    this.dirty = true;
  }

  // ================================================================
  // Deletion
  // ================================================================

  /**
   * Delete a placed item.
   * @param {string} placedId
   */
  deleteItem(placedId) {
    const idx = this.placedItems.findIndex(p => p.id === placedId);
    if (idx < 0) return;

    const item = this.placedItems[idx];
    this.pushUndo({ type: 'delete', item: { ...item }, index: idx });
    this.placedItems.splice(idx, 1);
    this.dirty = true;

    if (this.game.audio) this.game.audio.playSFX('delete');
  }

  /**
   * Delete all placed items (with undo).
   */
  clearAllItems() {
    if (this.placedItems.length === 0) return;
    const allItems = [...this.placedItems];
    this.pushUndo({ type: 'clear_all', items: allItems });
    this.placedItems.length = 0;
    this.dirty = true;
  }

  // ================================================================
  // Undo / Redo
  // ================================================================

  /**
   * Push an action onto the undo stack, clearing redo.
   * @param {Object} action
   */
  pushUndo(action) {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
    this.redoStack = [];
  }

  /** Perform one undo step. */
  undo() {
    const action = this.undoStack.pop();
    if (!action) {
      if (this.game.audio) this.game.audio.playSFX('error');
      return;
    }

    switch (action.type) {
      case 'place':
        this.placedItems = this.placedItems.filter(p => p.id !== action.item.id);
        break;
      case 'paint': {
        const pItem = this.placedItems.find(p => p.id === action.id);
        if (pItem) pItem.color = action.oldColor;
        break;
      }
      case 'move': {
        const mItem = this.placedItems.find(p => p.id === action.id);
        if (mItem) { mItem.x = action.oldX; mItem.y = action.oldY; }
        break;
      }
      case 'rotate': {
        const rItem = this.placedItems.find(p => p.id === action.id);
        if (rItem) rItem.rotation = action.oldRotation;
        break;
      }
      case 'scale': {
        const sItem = this.placedItems.find(p => p.id === action.id);
        if (sItem) sItem.scale = action.oldScale;
        break;
      }
      case 'flip': {
        const fItem = this.placedItems.find(p => p.id === action.id);
        if (fItem) fItem.flipped = action.oldFlipped;
        break;
      }
      case 'layer': {
        const lItem = this.placedItems.find(p => p.id === action.id);
        if (lItem) lItem.layer = action.oldLayer;
        break;
      }
      case 'delete':
        this.placedItems.splice(action.index, 0, action.item);
        break;
      case 'surface': {
        if (action.oldColor) {
          this.paintedSurfaces.set(action.key, action.oldColor);
        } else {
          this.paintedSurfaces.delete(action.key);
        }
        break;
      }
      case 'clear_surfaces':
        for (const [key, color] of action.entries) {
          this.paintedSurfaces.set(key, color);
        }
        break;
      case 'clear_all':
        this.placedItems.push(...action.items);
        break;
    }

    this.redoStack.push(action);
    this.dirty = true;
  }

  /** Perform one redo step. */
  redo() {
    const action = this.redoStack.pop();
    if (!action) {
      if (this.game.audio) this.game.audio.playSFX('error');
      return;
    }

    switch (action.type) {
      case 'place':
        this.placedItems.push(action.item);
        break;
      case 'paint': {
        const pItem = this.placedItems.find(p => p.id === action.id);
        if (pItem) pItem.color = action.newColor || { ...this.paintColor };
        break;
      }
      case 'move': {
        // Redo move: the move itself is already tracked via drag
        // We store the *new* position in the undo action for proper redo
        break;
      }
      case 'rotate': {
        const rItem = this.placedItems.find(p => p.id === action.id);
        if (rItem) rItem.rotation = (action.oldRotation + ROTATION_STEP) % 360;
        break;
      }
      case 'scale': {
        const sItem = this.placedItems.find(p => p.id === action.id);
        if (sItem) {
          const delta = action.newScale ? action.newScale - action.oldScale : SCALE_STEP;
          sItem.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, sItem.scale + delta));
        }
        break;
      }
      case 'flip': {
        const fItem = this.placedItems.find(p => p.id === action.id);
        if (fItem) fItem.flipped = !action.oldFlipped;
        break;
      }
      case 'layer': {
        const lItem = this.placedItems.find(p => p.id === action.id);
        if (lItem) lItem.layer = action.newLayer || action.oldLayer + 1;
        break;
      }
      case 'delete':
        this.placedItems = this.placedItems.filter(p => p.id !== action.item.id);
        break;
      case 'surface': {
        const [gx, gy] = action.key.split(',').map(Number);
        const color = action.newColor || { ...this.paintColor };
        this.paintedSurfaces.set(action.key, color);
        break;
      }
      case 'clear_surfaces':
        this.paintedSurfaces.clear();
        break;
      case 'clear_all':
        this.placedItems.length = 0;
        break;
    }

    this.undoStack.push(action);
    this.dirty = true;
  }

  /** @returns {boolean} Whether undo is available. */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /** @returns {boolean} Whether redo is available. */
  canRedo() {
    return this.redoStack.length > 0;
  }

  // ================================================================
  // HSL Color wheel
  // ================================================================

  /**
   * Render an interactive HSL colour wheel into a canvas element.
   * @param {HTMLCanvasElement} canvas
   * @param {Function} onChange — callback(color) where color = {h,s,l}
   */
  renderColorWheel(canvas, onChange) {
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.42;
    const innerR = size * 0.28;

    let hue = this.paintColor.h;
    let sat = this.paintColor.s;
    let light = this.paintColor.l;
    let draggingHue = false;
    let draggingSL = false;

    /**
     * Redraw the entire colour wheel.
     */
    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // ---- Hue ring ----
      for (let angle = 0; angle < 360; angle += 2) {
        const rad0 = (angle - 1) * Math.PI / 180;
        const rad1 = (angle + 1) * Math.PI / 180;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, rad0, rad1);
        ctx.strokeStyle = `hsl(${angle}, 100%, 50%)`;
        ctx.lineWidth = outerR - innerR;
        ctx.stroke();
      }

      // ---- SL triangle ----
      const triRadius = innerR - 4;
      const p0 = { x: cx, y: cy - triRadius };
      const p1 = { x: cx - triRadius * 0.866, y: cy + triRadius * 0.5 };
      const p2 = { x: cx + triRadius * 0.866, y: cy + triRadius * 0.5 };

      // Triangle gradient fill (approximated with conical steps)
      const steps = 60;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const lx = p1.x + (p2.x - p1.x) * t;
        const ly = p1.y + (p2.y - p1.y) * t;
        const grad = ctx.createLinearGradient(p0.x, p0.y, lx, ly);
        grad.addColorStop(0, `hsl(${hue}, 100%, 50%)`);
        grad.addColorStop(0.5, `hsl(${hue}, 100%, 75%)`);
        grad.addColorStop(1, '#ffffff');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x + (p2.x - p1.x) * t, p1.y + (p2.y - p1.y) * t);
        ctx.lineTo(p1.x + (p2.x - p1.x) * Math.min(t + 1 / steps, 1),
          p1.y + (p2.y - p1.y) * Math.min(t + 1 / steps, 1));
        ctx.closePath();
        ctx.fill();
      }

      // ---- Hue selector marker ----
      const hueRad = (hue - 90) * Math.PI / 180;
      const hueX = cx + (outerR - (outerR - innerR) / 2) * Math.cos(hueRad);
      const hueY = cy + (outerR - (outerR - innerR) / 2) * Math.sin(hueRad);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hueX, hueY, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fill();

      // ---- SL selector marker ----
      const slx = cx + (sat / 100 - 0.5) * triRadius * 1.5;
      const sly = cy + ((50 - light) / 50) * triRadius * 0.8;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(slx, sly, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = hslToCss({ h: hue, s: sat, l: light });
      ctx.fill();
    };

    // ---- Pointer interaction ----
    const getPointerPos = e => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    canvas.addEventListener('pointerdown', e => {
      const pos = getPointerPos(e);
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= innerR && dist <= outerR + 10) {
        draggingHue = true;
        canvas.setPointerCapture(e.pointerId);
      } else if (dist < innerR) {
        draggingSL = true;
        canvas.setPointerCapture(e.pointerId);
      }

      updateFromPointer(pos);
    });

    canvas.addEventListener('pointermove', e => {
      if (!draggingHue && !draggingSL) return;
      updateFromPointer(getPointerPos(e));
    });

    canvas.addEventListener('pointerup', e => {
      draggingHue = false;
      draggingSL = false;
    });

    const updateFromPointer = pos => {
      const dx = pos.x - cx;
      const dy = pos.y - cy;

      if (draggingHue) {
        hue = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
      }

      if (draggingSL) {
        sat = Math.max(0, Math.min(100, 50 + (dx / (size * 0.25)) * 50));
        light = Math.max(0, Math.min(100, 50 - (dy / (size * 0.25)) * 50));
      }

      this.paintColor = { h: hue, s: sat, l: light };
      draw();
      if (onChange) onChange({ h: hue, s: sat, l: light });
    };

    draw();
  }

  /**
   * Render recent colour swatches into a container element.
   * @param {HTMLElement} container
   * @param {Function} onPick — callback(color)
   */
  renderRecentColors(container, onPick) {
    container.innerHTML = '';
    this.recentColors.forEach(color => {
      const swatch = document.createElement('div');
      swatch.className = 'editor-color-swatch';
      swatch.style.cssText = `
        width: 24px; height: 24px; border-radius: 4px;
        background: ${hslToCss(color)};
        border: 2px solid rgba(255,255,255,0.3);
        cursor: pointer; display: inline-block; margin: 2px;
        transition: transform 0.1s, border-color 0.1s;
      `;
      swatch.addEventListener('mouseenter', () => {
        swatch.style.transform = 'scale(1.15)';
        swatch.style.borderColor = '#fff';
      });
      swatch.addEventListener('mouseleave', () => {
        swatch.style.transform = 'scale(1)';
        swatch.style.borderColor = 'rgba(255,255,255,0.3)';
      });
      swatch.addEventListener('click', () => {
        this.paintColor = { ...color };
        if (onPick) onPick({ ...color });
      });
      container.appendChild(swatch);
    });
  }

  /** @private */
  _addRecentColor(color) {
    // Remove duplicate
    this.recentColors = this.recentColors.filter(
      c => c.h !== color.h || c.s !== color.s || c.l !== color.l
    );
    this.recentColors.unshift(color);
    if (this.recentColors.length > 10) this.recentColors.pop();
  }

  // ================================================================
  // Serialization
  // ================================================================

  /**
   * Serialize the entire island to a JSON string.
   * @returns {string}
   */
  serialize() {
    return JSON.stringify({
      version: 1,
      items: this.placedItems,
      surfaces: Array.from(this.paintedSurfaces.entries()),
      savedAt: Date.now(),
      gridSize: this.gridSize,
      showGrid: this.showGrid,
      snapToGrid: this.snapToGrid
    });
  }

  /**
   * Deserialize an island from a JSON string.
   * @param {string} data
   */
  deserialize(data) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.version !== 1) {
        console.warn('[IslandEditor] Unknown save version:', parsed.version);
        return;
      }
      this.placedItems = parsed.items || [];
      this.paintedSurfaces = new Map(parsed.surfaces || []);
      if (parsed.gridSize) this.gridSize = parsed.gridSize;
      if (typeof parsed.showGrid === 'boolean') this.showGrid = parsed.showGrid;
      if (typeof parsed.snapToGrid === 'boolean') this.snapToGrid = parsed.snapToGrid;
      this.undoStack = [];
      this.redoStack = [];
    } catch (err) {
      console.error('[IslandEditor] Deserialize failed:', err);
    }
  }

  /**
   * Save the island to localStorage.
   */
  saveIsland() {
    const playerId = this.game.state?.player?.id || 'guest';
    const key = `starlight_island_${playerId}`;
    try {
      localStorage.setItem(key, this.serialize());
      this.dirty = false;
      console.log('[IslandEditor] Saved to localStorage');
    } catch (err) {
      console.error('[IslandEditor] localStorage save failed:', err);
    }
  }

  /**
   * Load the island from localStorage.
   */
  loadIsland() {
    const playerId = this.game.state?.player?.id || 'guest';
    const key = `starlight_island_${playerId}`;
    try {
      const data = localStorage.getItem(key);
      if (data) {
        this.deserialize(data);
        console.log('[IslandEditor] Loaded from localStorage');
      }
    } catch (err) {
      console.error('[IslandEditor] localStorage load failed:', err);
    }
  }

  /**
   * Sync the island to the server.
   * @private
   */
  _syncToServer() {
    if (this.game.network && typeof this.game.network.saveIsland === 'function') {
      const playerId = this.game.state?.player?.id;
      if (!playerId) return;
      this.game.network.saveIsland(playerId, this.serialize())
        .then(() => console.log('[IslandEditor] Synced to server'))
        .catch(err => console.error('[IslandEditor] Server sync failed:', err));
    }
  }

  /**
   * Export the island as a JSON blob for download.
   * @returns {Blob}
   */
  exportIsland() {
    return new Blob([this.serialize()], { type: 'application/json' });
  }

  /**
   * Import an island from a JSON file.
   * @param {File} file
   * @returns {Promise<void>}
   */
  importIsland(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          this.pushUndo({ type: 'clear_all', items: [...this.placedItems] });
          this.deserialize(e.target.result);
          this.dirty = true;
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  // ================================================================
  // Rendering
  // ================================================================

  /**
   * Render the island editor view.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W — canvas width
   * @param {number} H — canvas height
   */
  render(ctx, W, H) {
    if (!this.active) return;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // Painted surfaces
    this._renderSurfaces(ctx);

    // Grid overlay
    this.renderGrid(ctx, W, H);

    // Placed items
    this._renderPlacedItems(ctx);

    // Hovered cell highlight
    if (this.hoveredCell && this.showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        this.hoveredCell.x, this.hoveredCell.y,
        this.gridSize, this.gridSize
      );
    }

    // Mode indicator
    this._renderModeIndicator(ctx, W, H);
  }

  /**
   * Render the grid overlay.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W
   * @param {number} H
   */
  renderGrid(ctx, W, H) {
    if (!this.showGrid) return;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    for (let x = 0; x < W; x += this.gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    for (let y = 0; y < H; y += this.gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  /** @private */
  _renderSurfaces(ctx) {
    for (const [key, color] of this.paintedSurfaces) {
      const [gx, gy] = key.split(',').map(Number);
      ctx.fillStyle = hslToCss(color);
      ctx.globalAlpha = 0.6;
      ctx.fillRect(gx * this.gridSize, gy * this.gridSize, this.gridSize, this.gridSize);
      ctx.globalAlpha = 1;
    }
  }

  /** @private */
  _renderPlacedItems(ctx) {
    const sorted = [...this.placedItems].sort((a, b) => a.layer - b.layer);

    for (const item of sorted) {
      const info = this.getItemInfo(item.itemId);
      const emoji = info.emoji || info.name || info.itemId || '❓';
      const size = this.gridSize * item.scale;

      ctx.save();
      ctx.translate(item.x + this.gridSize / 2, item.y + this.gridSize / 2);
      ctx.rotate((item.rotation * Math.PI) / 180);
      if (item.flipped) ctx.scale(-1, 1);

      // Selection glow
      if (this.mode === 'move' && this.hoveredPlacedItem?.id === item.id) {
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 12;
      }

      // Colour tint (subtle overlay)
      if (item.color.s > 0) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = hslToCss(item.color);
        ctx.fillRect(-size / 2 - 2, -size / 2 - 2, size + 4, size + 4);
        ctx.globalAlpha = 1;
      }

      // Emoji rendering
      ctx.font = `${size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 0, 2);

      // Delete mode: show X overlay
      if (this.mode === 'delete' && this.hoveredPlacedItem?.id === item.id) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${size * 0.5}px sans-serif`;
        ctx.fillText('X', 0, 0);
      }

      ctx.restore();
    }
  }

  /** @private */
  _renderModeIndicator(ctx, W, H) {
    const modeLabels = {
      place: 'Place',
      paint: 'Paint',
      move: 'Move',
      delete: 'Delete'
    };
    const modeColors = {
      place: '#4ecdc4',
      paint: '#ffe66d',
      move: '#a8e6cf',
      delete: '#ff6b6b'
    };

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(W - 120, 10, 110, 28);
    ctx.fillStyle = modeColors[this.mode];
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Mode: ${modeLabels[this.mode]}`, W - 65, 24);

    // Stats
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(W - 120, 42, 110, 22);
    ctx.fillStyle = '#aaa';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${this.placedItems.length} items | ${this.paintedSurfaces.size} tiles`, W - 65, 54);
  }

  // ================================================================
  // Mini-map
  // ================================================================

  /**
   * Render a mini-map preview of the island into a canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} size — mini-map width/height in pixels
   */
  renderMinimap(ctx, size) {
    const scale = size / (this.gridSize * 20); // Show ~20x20 grid

    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, size, size);

    // Surfaces
    for (const [key, color] of this.paintedSurfaces) {
      const [gx, gy] = key.split(',').map(Number);
      ctx.fillStyle = hslToCss(color);
      ctx.fillRect(gx * this.gridSize * scale, gy * this.gridSize * scale,
        this.gridSize * scale, this.gridSize * scale);
    }

    // Items
    for (const item of this.placedItems) {
      ctx.fillStyle = hslToCss(item.color);
      ctx.fillRect(
        item.x * scale, item.y * scale,
        this.gridSize * scale * item.scale,
        this.gridSize * scale * item.scale
      );
    }
  }

  // ================================================================
  // Cleanup
  // ================================================================

  /**
   * Destroy the editor, cleaning up all resources and listeners.
   */
  destroy() {
    this.exit();
    this.placedItems = [];
    this.paintedSurfaces.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.recentColors = [];
    if (this.ui) {
      this.ui.destroy();
      this.ui = null;
    }
  }
}
