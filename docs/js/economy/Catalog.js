/**
 * Catalog.js
 * 12-category item catalog with search, filtering, purchase logic,
 * rarity tiers, and UI rendering helpers for Starlight Inn v3.0.
 *
 * @module economy/Catalog
 */

// ============================================================
//  Category definitions
// ============================================================

/**
 * All 12 item categories available in the Starlight Inn catalog.
 * @type {string[]}
 */
export const CATALOG_CATEGORIES = [
  'Hair', 'Eyes', 'Mouth', 'Outfits', 'Shoes', 'Accessories',
  'Furniture', 'Pets', 'Backgrounds', 'Effects', 'Badges', 'Bundles'
];

/**
 * Rarity tiers with associated display metadata.
 * @type {Record<string, {label: string, color: string, sortOrder: number}>}
 */
export const RARITY_META = {
  common:    { label: 'Common',    color: '#B0BEC5', sortOrder: 1 },
  uncommon:  { label: 'Uncommon',  color: '#66BB6A', sortOrder: 2 },
  rare:      { label: 'Rare',      color: '#42A5F5', sortOrder: 3 },
  epic:      { label: 'Epic',      color: '#AB47BC', sortOrder: 4 },
  legendary: { label: 'Legendary', color: '#FFCA28', sortOrder: 5 },
  special:   { label: 'Special',   color: '#FF7043', sortOrder: 6 }
};

// ============================================================
//  Catalog item database (~50 items across 12 categories)
// ============================================================

/**
 * Full catalog of purchasable / earnable items.
 * priceSilver = 0 and priceGold = 0 means un-purchasable (e.g. badges).
 * @type {Array<{id: string, name: string, category: string, priceSilver: number, priceGold: number, rarity: string, icon: string, description?: string, tags?: string[]}>}
 */
export const CATALOG_ITEMS = [
  // ---- Hair (6 items) ----
  { id: 'hair_twintails',    name: 'Twintails',       category: 'Hair',  priceSilver: 200,  priceGold: 0,   rarity: 'common',    icon: '🎀', description: 'Bouncy twin tails for a cheerful look.', tags: ['cute', 'feminine'] },
  { id: 'hair_bob',          name: 'Bob Cut',         category: 'Hair',  priceSilver: 150,  priceGold: 0,   rarity: 'common',    icon: '✂️', description: 'Short and sweet bob hairstyle.', tags: ['chic'] },
  { id: 'hair_long',         name: 'Long Flowing',    category: 'Hair',  priceSilver: 300,  priceGold: 0,   rarity: 'uncommon',  icon: '🌊', description: 'Flowing locks that catch the breeze.', tags: ['elegant'] },
  { id: 'hair_spiky',        name: 'Spiky',           category: 'Hair',  priceSilver: 250,  priceGold: 0,   rarity: 'uncommon',  icon: '⚡', description: 'Electrically charged spikes.', tags: ['edgy', 'bold'] },
  { id: 'hair_starry',       name: 'Starry Night',    category: 'Hair',  priceSilver: 0,    priceGold: 50,  rarity: 'rare',      icon: '✨', description: 'Hair woven from stardust strands.', tags: ['magical'] },
  { id: 'hair_flame',        name: 'Phoenix Flame',   category: 'Hair',  priceSilver: 0,    priceGold: 120, rarity: 'epic',      icon: '🔥', description: 'Hair that flickers like living flame.', tags: ['mythic'] },

  // ---- Eyes (5 items) ----
  { id: 'eyes_big',          name: 'Big Sparkle',     category: 'Eyes',  priceSilver: 100,  priceGold: 0,   rarity: 'common',    icon: '👀', description: 'Wide, sparkling eyes.', tags: ['cute'] },
  { id: 'eyes_sleepy',       name: 'Sleepy',          category: 'Eyes',  priceSilver: 100,  priceGold: 0,   rarity: 'common',    icon: '💤', description: 'Half-lidded, dreamy gaze.', tags: ['calm'] },
  { id: 'eyes_heart',        name: 'Heart Eyes',      category: 'Eyes',  priceSilver: 0,    priceGold: 25,  rarity: 'uncommon',  icon: '💖', description: 'Eyes filled with affection.', tags: ['romantic'] },
  { id: 'eyes_starry',       name: 'Cosmic Gaze',     category: 'Eyes',  priceSilver: 0,    priceGold: 60,  rarity: 'rare',      icon: '🌌', description: 'Galaxies swirl in your irises.', tags: ['magical'] },
  { id: 'eyes_crystal',      name: 'Crystal Vision',  category: 'Eyes',  priceSilver: 0,    priceGold: 150, rarity: 'epic',      icon: '💎', description: 'Prismatic eyes that see hidden truths.', tags: ['mythic'] },

  // ---- Mouth (3 items) ----
  { id: 'mouth_smile',       name: 'Warm Smile',      category: 'Mouth', priceSilver: 80,   priceGold: 0,   rarity: 'common',    icon: '😊', description: 'A friendly, welcoming smile.', tags: ['cheerful'] },
  { id: 'mouth_cat',         name: 'Cat Grin',        category: 'Mouth', priceSilver: 0,    priceGold: 20,  rarity: 'uncommon',  icon: '😺', description: 'A mischievous feline smile.', tags: ['playful'] },
  { id: 'mouth_whistle',     name: 'Whistling',       category: 'Mouth', priceSilver: 150,  priceGold: 0,   rarity: 'uncommon',  icon: '🎵', description: 'Always humming a little tune.', tags: ['musical'] },

  // ---- Outfits (6 items) ----
  { id: 'outfit_pajamas',    name: 'Cozy Pajamas',    category: 'Outfits', priceSilver: 400,  priceGold: 0,   rarity: 'common',    icon: '😴', description: 'The comfiest sleepwear in the realm.', tags: ['cozy'] },
  { id: 'outfit_dress',      name: 'Starlight Dress', category: 'Outfits', priceSilver: 600,  priceGold: 0,   rarity: 'uncommon',  icon: '👗', description: 'A gown that twinkles like the night sky.', tags: ['elegant'] },
  { id: 'outfit_suit',       name: 'Moon Suit',       category: 'Outfits', priceSilver: 0,    priceGold: 75,  rarity: 'rare',      icon: '🤵', description: 'Formal attire woven from moonbeams.', tags: ['formal'] },
  { id: 'outfit_witch',      name: 'Star Witch Robe', category: 'Outfits', priceSilver: 0,    priceGold: 100, rarity: 'rare',      icon: '🧙', description: 'A robe for star-touched spellcasters.', tags: ['magical'] },
  { id: 'outfit_knight',     name: 'Dawn Knight',     category: 'Outfits', priceSilver: 0,    priceGold: 180, rarity: 'epic',      icon: '⚔️', description: 'Armor forged at the break of dawn.', tags: ['mythic', 'bold'] },
  { id: 'outfit_royal',      name: 'Royal Gown',      category: 'Outfits', priceSilver: 0,    priceGold: 250, rarity: 'legendary', icon: '👑', description: 'Only true royalty may wear this.', tags: ['legendary'] },

  // ---- Shoes (4 items) ----
  { id: 'shoes_slippers',    name: 'Fluffy Slippers', category: 'Shoes', priceSilver: 120,  priceGold: 0,   rarity: 'common',    icon: '🥿', description: 'Like walking on clouds.', tags: ['cozy'] },
  { id: 'shoes_boots',       name: 'Star Boots',      category: 'Shoes', priceSilver: 300,  priceGold: 0,   rarity: 'uncommon',  icon: '👢', description: 'Boots that leave a glitter trail.', tags: ['stylish'] },
  { id: 'shoes_wings',       name: 'Winged Shoes',    category: 'Shoes', priceSilver: 0,    priceGold: 80,  rarity: 'rare',      icon: '🦋', description: 'Shoes with gossamer wings.', tags: ['magical'] },
  { id: 'shoes_crystal',     name: 'Crystal Heels',   category: 'Shoes', priceSilver: 0,    priceGold: 120, rarity: 'epic',      icon: '💠', description: 'Glass-like heels that never break.', tags: ['elegant'] },

  // ---- Accessories (5 items) ----
  { id: 'acc_glasses',       name: 'Round Glasses',   category: 'Accessories', priceSilver: 150,  priceGold: 0,   rarity: 'common',    icon: '🤓', description: 'Studious and adorable.', tags: ['smart'] },
  { id: 'acc_bowtie',        name: 'Star Bowtie',     category: 'Accessories', priceSilver: 200,  priceGold: 0,   rarity: 'uncommon',  icon: '🎀', description: 'A tiny constellation on your chest.', tags: ['formal'] },
  { id: 'acc_cape',          name: 'Night Cape',      category: 'Accessories', priceSilver: 0,    priceGold: 45,  rarity: 'uncommon',  icon: '🧛', description: 'A cape that billows without wind.', tags: ['dramatic'] },
  { id: 'acc_crown',         name: 'Tiny Crown',      category: 'Accessories', priceSilver: 0,    priceGold: 90,  rarity: 'rare',      icon: '👑', description: 'A crown for the ruler of cozy.', tags: ['regal'] },
  { id: 'acc_wand',          name: 'Star Wand',       category: 'Accessories', priceSilver: 0,    priceGold: 140, rarity: 'epic',      icon: '🪄', description: 'Casts spells of comfort and light.', tags: ['magical'] },

  // ---- Furniture (5 items) ----
  { id: 'furniture_couch',   name: 'Cloud Couch',     category: 'Furniture', priceSilver: 800,  priceGold: 0,   rarity: 'uncommon',  icon: '🛋️', description: 'Impossibly soft seating.', tags: ['cozy'] },
  { id: 'furniture_lamp',      name: 'Moon Lamp',       category: 'Furniture', priceSilver: 500,  priceGold: 0,   rarity: 'common',    icon: '🌙', description: 'A warm glow for late-night reading.', tags: ['warm'] },
  { id: 'furniture_bookshelf', name: 'Stardust Shelf',  category: 'Furniture', priceSilver: 1000, priceGold: 0,   rarity: 'uncommon',  icon: '📚', description: 'Holds an infinite number of stories.', tags: ['studious'] },
  { id: 'furniture_piano',     name: 'Mini Piano',      category: 'Furniture', priceSilver: 0,    priceGold: 150, rarity: 'rare',      icon: '🎹', description: 'A magical instrument, always in tune.', tags: ['musical'] },
  { id: 'furniture_fountain',name: 'Star Fountain',   category: 'Furniture', priceSilver: 0,    priceGold: 300, rarity: 'legendary', icon: '⛲', description: 'A wishing fountain made of light.', tags: ['legendary'] },

  // ---- Pets (4 items) ----
  { id: 'pet_cat',           name: 'Star Cat',        category: 'Pets',  priceSilver: 0,    priceGold: 100, rarity: 'rare',      icon: '🐱', description: 'A celestial feline companion.', tags: ['cute', 'magical'] },
  { id: 'pet_owl',           name: 'Night Owl',       category: 'Pets',  priceSilver: 0,    priceGold: 150, rarity: 'legendary', icon: '🦉', description: 'Wise guardian of the twilight hours.', tags: ['wise'] },
  { id: 'pet_bunny',         name: 'Luna Bunny',      category: 'Pets',  priceSilver: 0,    priceGold: 60,  rarity: 'uncommon',  icon: '🐰', description: 'A soft bunny that glows faintly.', tags: ['cute'] },
  { id: 'pet_dragon',        name: 'Tiny Dragon',     category: 'Pets',  priceSilver: 0,    priceGold: 400, rarity: 'legendary', icon: '🐉', description: 'A pocket-sized dragon with a warm heart.', tags: ['mythic', 'bold'] },

  // ---- Backgrounds (4 items) ----
  { id: 'bg_forest',         name: 'Moonlit Forest',  category: 'Backgrounds', priceSilver: 300,  priceGold: 0,   rarity: 'common',    icon: '🌲', description: 'A serene forest under the moon.', tags: ['calm'] },
  { id: 'bg_starry',         name: 'Starry Room',     category: 'Backgrounds', priceSilver: 600,  priceGold: 0,   rarity: 'uncommon',  icon: '🌠', description: 'A room where the ceiling is the cosmos.', tags: ['magical'] },
  { id: 'bg_library',        name: 'Grand Library',   category: 'Backgrounds', priceSilver: 0,    priceGold: 50,  rarity: 'uncommon',  icon: '📖', description: 'Infinite shelves of wonder.', tags: ['studious'] },
  { id: 'bg_throne',         name: 'Crystal Throne',  category: 'Backgrounds', priceSilver: 0,    priceGold: 200, rarity: 'legendary', icon: '🏰', description: 'A throne room made of living crystal.', tags: ['legendary'] },

  // ---- Effects (4 items) ----
  { id: 'effect_sparkle',    name: 'Sparkle Trail',   category: 'Effects', priceSilver: 0,    priceGold: 30,  rarity: 'uncommon',  icon: '✨', description: 'Leave a trail of sparkles behind you.', tags: ['magical'] },
  { id: 'effect_rainbow',    name: 'Rainbow Aura',    category: 'Effects', priceSilver: 0,    priceGold: 50,  rarity: 'rare',      icon: '🌈', description: 'A shimmering aura of color.', tags: ['magical'] },
  { id: 'effect_ghost',      name: 'Ghostly Mist',    category: 'Effects', priceSilver: 0,    priceGold: 80,  rarity: 'rare',      icon: '👻', description: 'Drift with an ethereal mist.', tags: ['spooky'] },
  { id: 'effect_phoenix',    name: 'Phoenix Wings',   category: 'Effects', priceSilver: 0,    priceGold: 180, rarity: 'epic',      icon: '🪶', description: 'Spectral wings of rebirth.', tags: ['mythic'] },

  // ---- Badges (4 items) ----
  { id: 'badge_newbie',      name: 'Newbie',          category: 'Badges',  priceSilver: 0, priceGold: 0, rarity: 'common',    icon: '🌱', description: 'Welcome to the Starlight Inn!', tags: ['starter'] },
  { id: 'badge_socialite',   name: 'Socialite',       category: 'Badges',  priceSilver: 0, priceGold: 0, rarity: 'uncommon',  icon: '💬', description: 'Talked to 10 other guests.', tags: ['social'] },
  { id: 'badge_collector',   name: 'Collector',       category: 'Badges',  priceSilver: 0, priceGold: 0, rarity: 'rare',      icon: '🏆', description: 'Own 20 unique items.', tags: ['achievement'] },
  { id: 'badge_vip',         name: 'VIP Guest',       category: 'Badges',  priceSilver: 0, priceGold: 0, rarity: 'epic',      icon: '⭐', description: 'Spent 1000 Gold total.', tags: ['achievement'] },

  // ---- Bundles (2 items) ----
  { id: 'bundle_starter',    name: 'Starter Pack',    category: 'Bundles', priceSilver: 0,    priceGold: 200, rarity: 'special',   icon: '🎁', description: 'Everything a new guest needs to get started.', tags: ['starter'], contents: ['hair_bob', 'eyes_big', 'mouth_smile', 'outfit_pajamas', 'shoes_slippers', 'furniture_lamp', 'bg_forest'] },
  { id: 'bundle_royal',      name: 'Royal Collection', category: 'Bundles', priceSilver: 0,   priceGold: 500, rarity: 'special',   icon: '👑', description: 'A curated set of the finest items.', tags: ['premium'], contents: ['hair_flame', 'eyes_crystal', 'outfit_royal', 'shoes_crystal', 'acc_wand', 'furniture_fountain', 'pet_dragon', 'bg_throne'] }
];

/** @type {Map<string, object>} */
const ITEM_MAP = new Map(CATALOG_ITEMS.map(i => [i.id, i]));

// ============================================================
//  Catalog class
// ============================================================

/**
 * Catalog manages item browsing, searching, and purchasing.
 * All items reference the immutable CATALOG_ITEMS array.
 */
export class Catalog {
  /**
   * @param {object} game - Main game reference
   */
  constructor(game) {
    if (!game || typeof game !== 'object') {
      throw new TypeError('Catalog requires a valid game reference');
    }
    this.game = game;
  }

  // ---- Retrieval ----

  /**
   * Get all items in a category.
   * @param {string} category
   * @returns {Array<object>}
   */
  getItemsByCategory(category) {
    return CATALOG_ITEMS.filter(i => i.category === category);
  }

  /**
   * Get a single item by its unique ID.
   * @param {string} id
   * @returns {object | undefined}
   */
  getItem(id) {
    return ITEM_MAP.get(id);
  }

  /**
   * Get items by rarity tier.
   * @param {string} rarity
   * @returns {Array<object>}
   */
  getItemsByRarity(rarity) {
    return CATALOG_ITEMS.filter(i => i.rarity === rarity);
  }

  /**
   * Search items by name, description, or tags.
   * @param {string} query
   * @returns {Array<object>}
   */
  search(query) {
    if (!query || query.trim().length === 0) return [...CATALOG_ITEMS];
    const q = query.toLowerCase().trim();
    return CATALOG_ITEMS.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.description && i.description.toLowerCase().includes(q)) ||
      (i.tags && i.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  /**
   * Advanced filter with multiple criteria.
   * @param {{category?: string, rarity?: string, minSilver?: number, maxSilver?: number, minGold?: number, maxGold?: number, tags?: string[], query?: string}} filters
   * @returns {Array<object>}
   */
  filter(filters = {}) {
    let results = [...CATALOG_ITEMS];
    if (filters.category)   results = results.filter(i => i.category === filters.category);
    if (filters.rarity)     results = results.filter(i => i.rarity === filters.rarity);
    if (Number.isFinite(filters.minSilver)) results = results.filter(i => i.priceSilver >= filters.minSilver);
    if (Number.isFinite(filters.maxSilver)) results = results.filter(i => i.priceSilver <= filters.maxSilver);
    if (Number.isFinite(filters.minGold))   results = results.filter(i => i.priceGold >= filters.minGold);
    if (Number.isFinite(filters.maxGold))   results = results.filter(i => i.priceGold <= filters.maxGold);
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(i => i.tags && filters.tags.some(t => i.tags.includes(t)));
    }
    if (filters.query) {
      const q = filters.query.toLowerCase();
      results = results.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.description && i.description.toLowerCase().includes(q))
      );
    }
    return results;
  }

  // ---- Purchasing ----

  /**
   * Check if player can afford an item.
   * @param {string} itemId
   * @returns {boolean}
   */
  canAfford(itemId) {
    const item = this.getItem(itemId);
    if (!item) return false;
    const silverOK = (this.game.state.silver ?? 0) >= item.priceSilver;
    const goldOK   = (this.game.state.gold ?? 0) >= item.priceGold;
    return silverOK && goldOK;
  }

  /**
   * Attempt to purchase an item.
   * @param {string} itemId
   * @returns {{success: boolean, message: string, item?: object}}
   */
  purchase(itemId) {
    const item = this.getItem(itemId);
    if (!item) {
      return { success: false, message: 'Item not found.' };
    }
    if (!this.canAfford(itemId)) {
      return { success: false, message: 'Not enough currency.' };
    }
    if (this.game.inventory && this.game.inventory.hasItem(itemId) && !item.category === 'Bundles') {
      // Non-consumable duplicates disallowed (except consumables/bundles)
      const nonConsumable = ['Hair', 'Eyes', 'Mouth', 'Outfits', 'Shoes', 'Accessories',
                             'Furniture', 'Pets', 'Backgrounds', 'Effects'];
      if (nonConsumable.includes(item.category)) {
        return { success: false, message: 'You already own this item.' };
      }
    }

    // Spend both currencies atomically via Currency module
    const spent = this.game.currency.spendBoth(item.priceSilver, item.priceGold, `purchase_${itemId}`);
    if (!spent) {
      return { success: false, message: 'Transaction failed.' };
    }

    // Add to inventory (or unpack bundle)
    let added = false;
    if (item.category === 'Bundles' && item.contents && this.game.inventory) {
      for (const subId of item.contents) {
        const subItem = this.getItem(subId);
        if (subItem) this.game.inventory.addItem(subItem);
      }
      added = true;
    } else if (this.game.inventory) {
      added = this.game.inventory.addItem(item);
    }

    if (added && this.game.ui && typeof this.game.ui.toast === 'function') {
      this.game.ui.toast(`Purchased ${item.name}!`, 'success');
    }

    return { success: true, message: `Purchased ${item.name}`, item };
  }

  /**
   * Purchase a bundle and unpack its contents.
   * @param {string} bundleId
   * @returns {{success: boolean, message: string, unpacked?: string[]}}
   */
  purchaseBundle(bundleId) {
    const bundle = this.getItem(bundleId);
    if (!bundle || bundle.category !== 'Bundles') {
      return { success: false, message: 'Not a valid bundle.' };
    }
    const result = this.purchase(bundleId);
    if (!result.success) return result;
    return { success: true, message: `Unpacked ${bundle.name}`, unpacked: bundle.contents || [] };
  }

  // ---- Utility ----

  /**
   * Get all available categories that have items.
   * @returns {string[]}
   */
  getCategories() {
    const set = new Set(CATALOG_ITEMS.map(i => i.category));
    return [...set];
  }

  /**
   * Get rarity distribution statistics.
   * @returns {Record<string, number>}
   */
  getRarityStats() {
    const stats = {};
    for (const item of CATALOG_ITEMS) {
      stats[item.rarity] = (stats[item.rarity] || 0) + 1;
    }
    return stats;
  }

  /**
   * Get total catalog value in Silver + Gold equivalent.
   * @returns {{totalSilver: number, totalGold: number}}
   */
  getCatalogValue() {
    const totalSilver = CATALOG_ITEMS.reduce((s, i) => s + i.priceSilver, 0);
    const totalGold = CATALOG_ITEMS.reduce((s, i) => s + i.priceGold, 0);
    return { totalSilver, totalGold };
  }

  /**
   * Sort items by a given criteria.
   * @param {Array<object>} items
   * @param {'name'|'priceSilver'|'priceGold'|'rarity'|'category'} criteria
   * @param {'asc'|'desc'} [dir='asc']
   * @returns {Array<object>}
   */
  static sort(items, criteria = 'name', dir = 'asc') {
    const sorted = [...items];
    sorted.sort((a, b) => {
      let va, vb;
      if (criteria === 'rarity') {
        va = RARITY_META[a.rarity]?.sortOrder ?? 99;
        vb = RARITY_META[b.rarity]?.sortOrder ?? 99;
      } else if (criteria === 'priceSilver') {
        va = a.priceSilver;
        vb = b.priceSilver;
      } else if (criteria === 'priceGold') {
        va = a.priceGold;
        vb = b.priceGold;
      } else if (criteria === 'category') {
        va = a.category;
        vb = b.category;
      } else {
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
      }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  // ---- UI Rendering ----

  /**
   * Render a category grid into a DOM container.
   * @param {HTMLElement} container
   * @param {string} category
   * @param {object} [opts] - {onClick, onDoubleClick, showOwned}
   */
  renderCatalogUI(container, category, opts = {}) {
    if (!container) return;
    container.innerHTML = '';

    const items = this.getItemsByCategory(category);
    const grid = document.createElement('div');
    grid.className = 'catalog-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
    grid.style.gap = '12px';

    for (const item of items) {
      const card = document.createElement('div');
      const rarityMeta = RARITY_META[item.rarity] || RARITY_META.common;
      const owned = this.game.inventory ? this.game.inventory.hasItem(item.id) : false;
      const affordable = this.canAfford(item.id);

      card.className = `catalog-card rarity-${item.rarity}`;
      card.style.border = `2px solid ${rarityMeta.color}`;
      card.style.borderRadius = '12px';
      card.style.padding = '10px';
      card.style.textAlign = 'center';
      card.style.cursor = 'pointer';
      card.style.transition = 'transform 0.15s, box-shadow 0.15s';
      card.style.opacity = affordable ? '1' : '0.55';
      card.style.position = 'relative';
      card.dataset.itemId = item.id;

      // Icon
      const icon = document.createElement('div');
      icon.textContent = item.icon;
      icon.style.fontSize = '32px';
      icon.style.marginBottom = '4px';
      card.appendChild(icon);

      // Name
      const name = document.createElement('div');
      name.textContent = item.name;
      name.style.fontWeight = '600';
      name.style.fontSize = '13px';
      name.style.marginBottom = '4px';
      card.appendChild(name);

      // Price row
      const priceRow = document.createElement('div');
      priceRow.style.display = 'flex';
      priceRow.style.justifyContent = 'center';
      priceRow.style.gap = '6px';
      priceRow.style.fontSize = '12px';

      if (item.priceSilver > 0) {
        const silver = document.createElement('span');
        silver.textContent = `🪙 ${item.priceSilver}`;
        silver.style.color = '#90A4AE';
        priceRow.appendChild(silver);
      }
      if (item.priceGold > 0) {
        const gold = document.createElement('span');
        gold.textContent = `⭐ ${item.priceGold}`;
        gold.style.color = '#FFB300';
        priceRow.appendChild(gold);
      }
      if (item.priceSilver === 0 && item.priceGold === 0) {
        const free = document.createElement('span');
        free.textContent = 'Free';
        free.style.color = '#66BB6A';
        priceRow.appendChild(free);
      }
      card.appendChild(priceRow);

      // Rarity label
      const rarityLabel = document.createElement('div');
      rarityLabel.textContent = rarityMeta.label;
      rarityLabel.style.fontSize = '10px';
      rarityLabel.style.color = rarityMeta.color;
      rarityLabel.style.textTransform = 'uppercase';
      rarityLabel.style.letterSpacing = '0.5px';
      rarityLabel.style.marginTop = '4px';
      card.appendChild(rarityLabel);

      // Owned badge
      if (opts.showOwned && owned) {
        const ownedBadge = document.createElement('div');
        ownedBadge.textContent = 'Owned';
        ownedBadge.style.position = 'absolute';
        ownedBadge.style.top = '4px';
        ownedBadge.style.right = '4px';
        ownedBadge.style.background = '#4CAF50';
        ownedBadge.style.color = '#fff';
        ownedBadge.style.fontSize = '9px';
        ownedBadge.style.padding = '2px 6px';
        ownedBadge.style.borderRadius = '8px';
        card.appendChild(ownedBadge);
      }

      // Hover effects
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = `0 4px 12px ${rarityMeta.color}44`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'none';
        card.style.boxShadow = 'none';
      });

      // Click / Double-click
      card.addEventListener('click', () => {
        if (typeof opts.onClick === 'function') opts.onClick(item);
      });
      card.addEventListener('dblclick', () => {
        if (typeof opts.onDoubleClick === 'function') opts.onDoubleClick(item);
      });

      grid.appendChild(card);
    }

    container.appendChild(grid);
  }

  /**
   * Render a compact price label for an item.
   * @param {string} itemId
   * @returns {string} HTML string
   */
  renderPriceLabel(itemId) {
    const item = this.getItem(itemId);
    if (!item) return '';
    const parts = [];
    if (item.priceSilver > 0) parts.push(`<span style="color:#90A4AE">🪙${item.priceSilver}</span>`);
    if (item.priceGold > 0)   parts.push(`<span style="color:#FFB300">⭐${item.priceGold}</span>`);
    if (parts.length === 0)   parts.push('<span style="color:#66BB6A">Free</span>');
    return parts.join(' ');
  }
}
