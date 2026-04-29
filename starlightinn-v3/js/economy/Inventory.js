/**
 * Inventory.js
 * Grid-based inventory (40 slots) with drag-and-drop, rarity borders,
 * equip/unequip for wearable items, consumable use, sort/search, and
 * full localStorage persistence for Starlight Inn v3.0.
 *
 * @module economy/Inventory
 */

const STORAGE_KEY = 'starlight_inventory';

/**
 * Categories that support equipping/unequipping (wearables).
 * @type {string[]}
 */
const EQUIPABLE_CATEGORIES = ['Hair', 'Eyes', 'Mouth', 'Outfits', 'Shoes', 'Accessories', 'Effects', 'Backgrounds'];

/**
 * Slot category → equipment slot mapping.
 * @type {Record<string, string>}
 */
const SLOT_MAP = {
  'Hair': 'slot_hair',
  'Eyes': 'slot_eyes',
  'Mouth': 'slot_mouth',
  'Outfits': 'slot_outfit',
  'Shoes': 'slot_shoes',
  'Accessories': 'slot_accessory',
  'Effects': 'slot_effect',
  'Backgrounds': 'slot_background'
};

/**
 * Inventory manages a 40-slot grid of items with drag-drop,
 * equip/unequip logic, sorting, and search.
 */
export class Inventory {
  /**
   * @param {object} game - Main game reference; needs game.ui.toast()
   */
  constructor(game) {
    if (!game || typeof game !== 'object') {
      throw new TypeError('Inventory requires a valid game reference');
    }
    this.game = game;
    this.items = [];        // { uid, id, name, category, rarity, icon, acquired, equipped, slot }
    this.maxSlots = 40;
    this.storageKey = STORAGE_KEY;

    // Drag-drop state
    this.draggedItem = null;
    this.dragSourceSlot = null;

    // Equipped items map: slotName -> uid
    this.equipped = {};

    // Filters
    this.currentFilter = 'all';
    this.currentSort = 'date'; // name | rarity | category | date
  }

  /** Load from localStorage and rebuild equipped map. */
  init() {
    this.load();
    this._rebuildEquippedMap();
  }

  // ============================================================
  //  Core CRUD
  // ============================================================

  /**
   * Add an item to inventory.
   * @param {object} item - Catalog item descriptor
   * @returns {boolean} true if added, false if full
   */
  addItem(item) {
    if (!item || !item.id) {
      console.warn('[Inventory] addItem called with invalid item:', item);
      return false;
    }
    if (this.items.length >= this.maxSlots) {
      this._toast('Inventory full!', 'error');
      return false;
    }
    const enriched = {
      ...item,
      uid: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      acquired: Date.now(),
      equipped: false,
      slot: SLOT_MAP[item.category] || null
    };
    this.items.push(enriched);
    this.save();
    this._toast(`+1 ${item.name}`, 'success');
    return true;
  }

  /**
   * Remove an item by its unique inventory UID.
   * @param {string} uid
   */
  removeItem(uid) {
    const item = this.getItem(uid);
    if (item && item.equipped) {
      this.unequip(uid);
    }
    this.items = this.items.filter(i => i.uid !== uid);
    this.save();
  }

  /**
   * Remove a specific quantity of an item by catalog ID.
   * @param {string} id - Catalog item ID
   * @param {number} [qty=1]
   * @returns {number} Number actually removed
   */
  removeById(id, qty = 1) {
    let removed = 0;
    this.items = this.items.filter(i => {
      if (removed < qty && i.id === id) {
        if (i.equipped) this.unequip(i.uid);
        removed++;
        return false;
      }
      return true;
    });
    this.save();
    return removed;
  }

  /**
   * Get an item by its unique UID.
   * @param {string} uid
   * @returns {object | undefined}
   */
  getItem(uid) {
    return this.items.find(i => i.uid === uid);
  }

  /**
   * Check if inventory contains at least one of an item ID.
   * @param {string} id
   * @returns {boolean}
   */
  hasItem(id) {
    return this.items.some(i => i.id === id);
  }

  /**
   * Count how many of a given item ID are owned.
   * @param {string} id
   * @returns {number}
   */
  countItem(id) {
    return this.items.filter(i => i.id === id).length;
  }

  /**
   * Check if inventory has room.
   * @returns {boolean}
   */
  hasSpace() {
    return this.items.length < this.maxSlots;
  }

  /**
   * Get count of free slots.
   * @returns {number}
   */
  freeSlots() {
    return this.maxSlots - this.items.length;
  }

  // ============================================================
  //  Equip / Unequip (wearable items)
  // ============================================================

  /**
   * Equip an item into its designated slot.
   * Unequips any existing item in that slot first.
   * @param {string} uid
   * @returns {boolean}
   */
  equip(uid) {
    const item = this.getItem(uid);
    if (!item) {
      this._toast('Item not found.', 'error');
      return false;
    }
    if (!EQUIPABLE_CATEGORIES.includes(item.category)) {
      this._toast('This item cannot be equipped.', 'error');
      return false;
    }

    const slot = SLOT_MAP[item.category];
    if (!slot) return false;

    // Unequip whatever is currently in this slot
    const currentEquippedUid = this.equipped[slot];
    if (currentEquippedUid && currentEquippedUid !== uid) {
      this.unequip(currentEquippedUid);
    }

    item.equipped = true;
    this.equipped[slot] = uid;
    this.save();
    this._toast(`Equipped ${item.name}`, 'info');
    return true;
  }

  /**
   * Unequip an item from its slot.
   * @param {string} uid
   * @returns {boolean}
   */
  unequip(uid) {
    const item = this.getItem(uid);
    if (!item || !item.equipped) return false;

    item.equipped = false;
    const slot = SLOT_MAP[item.category];
    if (slot && this.equipped[slot] === uid) {
      delete this.equipped[slot];
    }
    this.save();
    this._toast(`Unequipped ${item.name}`, 'info');
    return true;
  }

  /**
   * Toggle equip state for an item.
   * @param {string} uid
   * @returns {boolean}
   */
  toggleEquip(uid) {
    const item = this.getItem(uid);
    if (!item) return false;
    return item.equipped ? this.unequip(uid) : this.equip(uid);
  }

  /**
   * Get all currently equipped items.
   * @returns {Array<object>}
   */
  getEquippedItems() {
    return Object.values(this.equipped)
      .map(uid => this.getItem(uid))
      .filter(Boolean);
  }

  /**
   * Get the item currently equipped in a slot.
   * @param {string} slot - e.g. 'slot_hair'
   * @returns {object | undefined}
   */
  getEquippedInSlot(slot) {
    const uid = this.equipped[slot];
    return uid ? this.getItem(uid) : undefined;
  }

  /** @private */
  _rebuildEquippedMap() {
    this.equipped = {};
    for (const item of this.items) {
      if (item.equipped && item.slot) {
        this.equipped[item.slot] = item.uid;
      }
    }
  }

  // ============================================================
  //  Consumables / Use
  // ============================================================

  /**
   * Use a consumable item. Applies effect and removes from inventory.
   * @param {string} uid
   * @returns {{success: boolean, effect?: string}}
   */
  use(uid) {
    const item = this.getItem(uid);
    if (!item) return { success: false };

    // Effects are consumable; other categories are not
    if (item.category !== 'Effects') {
      this._toast(`${item.name} cannot be consumed.`, 'error');
      return { success: false };
    }

    // Apply visual effect (delegated to game if available)
    if (this.game.applyEffect && typeof this.game.applyEffect === 'function') {
      this.game.applyEffect(item.id);
    }

    this.removeItem(uid);
    this._toast(`Used ${item.name}`, 'success');
    return { success: true, effect: item.id };
  }

  // ============================================================
  //  Sort & Search
  // ============================================================

  /**
   * Sort inventory items by a criteria.
   * @param {'name'|'rarity'|'category'|'date'} criteria
   * @param {'asc'|'desc'} [dir='asc']
   */
  sortBy(criteria = 'date', dir = 'asc') {
    const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, special: 6 };
    this.currentSort = criteria;

    this.items.sort((a, b) => {
      let va, vb;
      switch (criteria) {
        case 'rarity':
          va = rarityOrder[a.rarity] || 99;
          vb = rarityOrder[b.rarity] || 99;
          break;
        case 'category':
          va = a.category;
          vb = b.category;
          break;
        case 'date':
          va = a.acquired ?? 0;
          vb = b.acquired ?? 0;
          break;
        case 'name':
        default:
          va = a.name.toLowerCase();
          vb = b.name.toLowerCase();
      }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    this.save();
  }

  /**
   * Search items by name.
   * @param {string} query
   * @returns {Array<object>}
   */
  search(query) {
    if (!query || query.trim().length === 0) return [...this.items];
    const q = query.toLowerCase().trim();
    return this.items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.category && i.category.toLowerCase().includes(q)) ||
      (i.rarity && i.rarity.toLowerCase().includes(q))
    );
  }

  /**
   * Filter by category.
   * @param {string} category - 'all' for everything
   * @returns {Array<object>}
   */
  filterByCategory(category) {
    if (category === 'all') return [...this.items];
    return this.items.filter(i => i.category === category);
  }

  // ============================================================
  //  Drag & Drop
  // ============================================================

  /**
   * Begin dragging an item.
   * @param {string} uid
   */
  dragItem(uid) {
    this.draggedItem = this.getItem(uid);
    this.dragSourceSlot = this.items.findIndex(i => i.uid === uid);
  }

  /**
   * Drop the dragged item onto a target inventory slot index.
   * Swaps items if target is occupied.
   * @param {number} targetSlotIndex
   * @returns {boolean}
   */
  dropItem(targetSlotIndex) {
    if (!this.draggedItem) return false;
    if (targetSlotIndex < 0 || targetSlotIndex >= this.maxSlots) return false;

    const sourceIdx = this.dragSourceSlot ?? this.items.findIndex(i => i.uid === this.draggedItem.uid);
    if (sourceIdx === -1) return false;

    // If dropping on itself, do nothing
    if (sourceIdx === targetSlotIndex) {
      this._clearDrag();
      return true;
    }

    // Swap
    const temp = this.items[sourceIdx];
    this.items[sourceIdx] = this.items[targetSlotIndex];
    this.items[targetSlotIndex] = temp;

    // Handle undefined from empty slots
    if (!this.items[sourceIdx]) {
      // Source was moved to target; compact to remove hole
      this.items.splice(sourceIdx, 1);
    }

    this._clearDrag();
    this.save();
    return true;
  }

  /**
   * Cancel current drag operation.
   */
  cancelDrag() {
    this._clearDrag();
  }

  /** @private */
  _clearDrag() {
    this.draggedItem = null;
    this.dragSourceSlot = null;
  }

  // ============================================================
  //  UI Rendering
  // ============================================================

  /**
   * Render the inventory grid into a DOM container.
   * @param {HTMLElement} container
   * @param {object} [opts] - {onClick, onRightClick, onDragStart, onDrop, filter, searchQuery}
   */
  renderGrid(container, opts = {}) {
    if (!container) return;
    container.innerHTML = '';

    const rarityColors = {
      common: '#B0BEC5', uncommon: '#66BB6A', rare: '#42A5F5',
      epic: '#AB47BC', legendary: '#FFCA28', special: '#FF7043'
    };

    // Filter
    let displayItems = opts.searchQuery
      ? this.search(opts.searchQuery)
      : (opts.filter && opts.filter !== 'all'
        ? this.filterByCategory(opts.filter)
        : [...this.items]);

    const grid = document.createElement('div');
    grid.className = 'inventory-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(8, 1fr)';
    grid.style.gap = '8px';

    for (let i = 0; i < this.maxSlots; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'inventory-slot';
      slotEl.dataset.slotIndex = i;
      slotEl.style.aspectRatio = '1';
      slotEl.style.border = '2px dashed #CFD8DC';
      slotEl.style.borderRadius = '10px';
      slotEl.style.display = 'flex';
      slotEl.style.alignItems = 'center';
      slotEl.style.justifyContent = 'center';
      slotEl.style.position = 'relative';
      slotEl.style.background = '#FAFAFA';
      slotEl.style.transition = 'border-color 0.15s, background 0.15s';

      const item = i < displayItems.length ? displayItems[i] : null;

      if (item) {
        slotEl.style.borderStyle = 'solid';
        slotEl.style.borderColor = rarityColors[item.rarity] || '#CFD8DC';
        slotEl.style.background = '#fff';
        slotEl.dataset.itemUid = item.uid;

        // Icon
        const icon = document.createElement('span');
        icon.textContent = item.icon;
        icon.style.fontSize = '24px';
        icon.style.userSelect = 'none';
        slotEl.appendChild(icon);

        // Equipped indicator
        if (item.equipped) {
          const badge = document.createElement('div');
          badge.textContent = '★';
          badge.style.position = 'absolute';
          badge.style.top = '2px';
          badge.style.left = '2px';
          badge.style.color = '#FFB300';
          badge.style.fontSize = '12px';
          badge.style.textShadow = '0 0 2px rgba(0,0,0,0.3)';
          slotEl.appendChild(badge);
        }

        // Rarity dot
        const dot = document.createElement('div');
        dot.style.position = 'absolute';
        dot.style.bottom = '3px';
        dot.style.right = '3px';
        dot.style.width = '8px';
        dot.style.height = '8px';
        dot.style.borderRadius = '50%';
        dot.style.background = rarityColors[item.rarity] || '#CFD8DC';
        slotEl.appendChild(dot);

        // Tooltip (name)
        slotEl.title = `${item.name} (${item.rarity})${item.equipped ? ' — Equipped' : ''}`;

        // Events
        slotEl.addEventListener('click', (e) => {
          if (typeof opts.onClick === 'function') opts.onClick(item, e);
        });
        slotEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (typeof opts.onRightClick === 'function') opts.onRightClick(item, e);
        });
        slotEl.draggable = true;
        slotEl.addEventListener('dragstart', (e) => {
          this.dragItem(item.uid);
          if (typeof opts.onDragStart === 'function') opts.onDragStart(item, e);
          e.dataTransfer?.setData('text/plain', item.uid);
        });
        slotEl.addEventListener('dragover', (e) => {
          e.preventDefault();
          slotEl.style.background = '#E3F2FD';
        });
        slotEl.addEventListener('dragleave', () => {
          slotEl.style.background = '#fff';
        });
        slotEl.addEventListener('drop', (e) => {
          e.preventDefault();
          slotEl.style.background = '#fff';
          const srcUid = e.dataTransfer?.getData('text/plain');
          if (srcUid) {
            this.dropItem(i);
            if (typeof opts.onDrop === 'function') opts.onDrop(item, i, e);
          }
          // Re-render after drop
          this.renderGrid(container, opts);
        });
      } else {
        // Empty slot drop target
        slotEl.addEventListener('dragover', (e) => {
          e.preventDefault();
          slotEl.style.borderColor = '#42A5F5';
          slotEl.style.background = '#E3F2FD';
        });
        slotEl.addEventListener('dragleave', () => {
          slotEl.style.borderColor = '#CFD8DC';
          slotEl.style.background = '#FAFAFA';
        });
        slotEl.addEventListener('drop', (e) => {
          e.preventDefault();
          slotEl.style.borderColor = '#CFD8DC';
          slotEl.style.background = '#FAFAFA';
          const srcUid = e.dataTransfer?.getData('text/plain');
          if (srcUid) {
            this.dropItem(i);
            if (typeof opts.onDrop === 'function') opts.onDrop(null, i, e);
          }
          this.renderGrid(container, opts);
        });
      }

      grid.appendChild(slotEl);
    }

    container.appendChild(grid);
  }

  /**
   * Render a compact "equipment panel" showing currently equipped items per slot.
   * @param {HTMLElement} container
   */
  renderEquippedPanel(container) {
    if (!container) return;
    container.innerHTML = '';

    const slots = Object.values(SLOT_MAP);
    const panel = document.createElement('div');
    panel.style.display = 'flex';
    panel.style.gap = '8px';
    panel.style.flexWrap = 'wrap';

    for (const slotKey of slots) {
      const slotLabel = slotKey.replace('slot_', '').replace(/_/g, ' ');
      const equipped = this.getEquippedInSlot(slotKey);

      const box = document.createElement('div');
      box.style.border = '2px solid #E0E0E0';
      box.style.borderRadius = '8px';
      box.style.padding = '6px';
      box.style.minWidth = '60px';
      box.style.textAlign = 'center';
      box.style.background = equipped ? '#FFF8E1' : '#F5F5F5';

      const label = document.createElement('div');
      label.textContent = slotLabel;
      label.style.fontSize = '10px';
      label.style.textTransform = 'capitalize';
      label.style.color = '#757575';
      label.style.marginBottom = '4px';
      box.appendChild(label);

      if (equipped) {
        const icon = document.createElement('div');
        icon.textContent = equipped.icon;
        icon.style.fontSize = '22px';
        box.appendChild(icon);
        const name = document.createElement('div');
        name.textContent = equipped.name;
        name.style.fontSize = '10px';
        name.style.whiteSpace = 'nowrap';
        name.style.overflow = 'hidden';
        name.style.textOverflow = 'ellipsis';
        box.appendChild(name);
      } else {
        const empty = document.createElement('div');
        empty.textContent = '—';
        empty.style.color = '#BDBDBD';
        empty.style.fontSize = '18px';
        box.appendChild(empty);
      }

      panel.appendChild(box);
    }

    container.appendChild(panel);
  }

  // ============================================================
  //  Persistence
  // ============================================================

  /** Save inventory to localStorage. */
  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    } catch (e) {
      console.error('[Inventory] save failed:', e);
    }
  }

  /** Load inventory from localStorage. */
  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        this.items = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.items = parsed;
      } else {
        this.items = [];
      }
    } catch (e) {
      console.warn('[Inventory] load failed, resetting:', e);
      this.items = [];
    }
  }

  /** Clear inventory and equipped state. */
  reset() {
    this.items = [];
    this.equipped = {};
    this.save();
  }

  // ============================================================
  //  Stats & Diagnostics
  // ============================================================

  /**
   * Get inventory statistics.
   * @returns {object}
   */
  getStats() {
    const byCategory = {};
    const byRarity = {};
    for (const item of this.items) {
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      byRarity[item.rarity] = (byRarity[item.rarity] || 0) + 1;
    }
    return {
      totalItems: this.items.length,
      maxSlots: this.maxSlots,
      freeSlots: this.maxSlots - this.items.length,
      equippedCount: Object.keys(this.equipped).length,
      byCategory,
      byRarity
    };
  }

  /** @private */
  _toast(msg, type = 'info') {
    if (this.game.ui && typeof this.game.ui.toast === 'function') {
      this.game.ui.toast(msg, type);
    }
  }
}
