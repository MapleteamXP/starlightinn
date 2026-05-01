/**
 * Starlight Inn v7.0 - BadgeSystem.js
 * Wearable badge engine with 20+ collectible badges, unlock conditions tied
 * to achievements, profile display integration, and social status signalling.
 *
 * @module profile/BadgeSystem
 * @version 7.0.0
 * @author Starlight Inn Team
 */

'use strict';

/* --------------------------------------------------------------------------
 *  Rarity enum for badges
 * -------------------------------------------------------------------------- */

/**
 * Badge rarity levels — drive visual treatment and social weight.
 * @readonly
 * @enum {string}
 */
export const BadgeRarity = Object.freeze({
  COMMON:    'Common',
  UNCOMMON:  'Uncommon',
  RARE:      'Rare',
  EPIC:      'Epic',
  LEGENDARY: 'Legendary',
  EXCLUSIVE: 'Exclusive',
});

/* --------------------------------------------------------------------------
 *  Badge Registry — 20+ wearable badges
 * -------------------------------------------------------------------------- */

/**
 * Master badge catalog.  Each badge defines:
 *   id, name, description, iconKey, rarity, unlockCondition,
 *   and optional displayColor / glowEffect.
 */
export const BADGE_CATALOG = Object.freeze({

  new_star: {
    id:              'new_star',
    name:            'New Star',
    description:     'Welcome to Starlight Inn! You have completed the tutorial and are ready to shine.',
    iconKey:         'badge_new_star',
    rarity:          BadgeRarity.COMMON,
    unlockCondition: { achievementId: 'new_star' },
    displayColor:    '#87CEEB',
    glowEffect:      false,
  },

  friend_magnet: {
    id:              'friend_magnet',
    name:            'Friend Magnet',
    description:     'People flock to you. You have made 10 friends in the Inn!',
    iconKey:         'badge_friend_magnet',
    rarity:          BadgeRarity.COMMON,
    unlockCondition: { achievementId: 'social_butterfly' },
    displayColor:    '#FF69B4',
    glowEffect:      false,
  },

  chat_legend: {
    id:              'chat_legend',
    name:            'Chat Legend',
    description:     'You have sent 1,000 messages. The Inn chat would be silent without you.',
    iconKey:         'badge_chat_legend',
    rarity:          BadgeRarity.UNCOMMON,
    unlockCondition: { achievementId: 'chatty_cathy' },
    displayColor:    '#7CFC00',
    glowEffect:      false,
  },

  trade_master: {
    id:              'trade_master',
    name:            'Trade Master',
    description:     '50 trades completed. You are a cornerstone of the Inn economy.',
    iconKey:         'badge_trade_master',
    rarity:          BadgeRarity.UNCOMMON,
    unlockCondition: { achievementId: 'trader_elite' },
    displayColor:    '#DAA520',
    glowEffect:      false,
  },

  room_designer: {
    id:              'room_designer',
    name:            'Room Designer',
    description:     '200 furniture pieces placed. Your rooms are magazine-worthy.',
    iconKey:         'badge_room_designer',
    rarity:          BadgeRarity.UNCOMMON,
    unlockCondition: { achievementId: 'room_designer' },
    displayColor:    '#9370DB',
    glowEffect:      false,
  },

  game_winner: {
    id:              'game_winner',
    name:            'Game Winner',
    description:     '20 mini-game victories. Skill, luck, and competitive spirit!',
    iconKey:         'badge_game_winner',
    rarity:          BadgeRarity.RARE,
    unlockCondition: { achievementId: 'minigame_pro' },
    displayColor:    '#FF4500',
    glowEffect:      true,
  },

  egg_collector: {
    id:              'egg_collector',
    name:            'Egg Collector',
    description:     '10 eggs hatched. Your pet collection is growing!',
    iconKey:         'badge_egg_collector',
    rarity:          BadgeRarity.COMMON,
    unlockCondition: { achievementId: 'egg_hatcher' },
    displayColor:    '#FFD700',
    glowEffect:      false,
  },

  dance_king: {
    id:              'dance_king',
    name:            'Dance King',
    description:     '30 minutes of dancing. The dance floor is your kingdom.',
    iconKey:         'badge_dance_king',
    rarity:          BadgeRarity.RARE,
    unlockCondition: { achievementId: 'dance_master' },
    displayColor:    '#FF1493',
    glowEffect:      true,
  },

  fashion_icon: {
    id:              'fashion_icon',
    name:            'Fashion Icon',
    description:     '20 clothing items owned. A style icon in the making.',
    iconKey:         'badge_fashion_icon',
    rarity:          BadgeRarity.UNCOMMON,
    unlockCondition: { achievementId: 'fashionista' },
    displayColor:    '#FF69B4',
    glowEffect:      false,
  },

  rich_star: {
    id:              'rich_star',
    name:            'Rich Star',
    description:     'Held 10,000 coins. Wealth is just a number — and yours is impressive.',
    iconKey:         'badge_rich_star',
    rarity:          BadgeRarity.RARE,
    unlockCondition: { achievementId: 'rich_kid' },
    displayColor:    '#FFD700',
    glowEffect:      true,
  },

  explorer: {
    id:              'explorer',
    name:            'Explorer',
    description:     'Visited all 14 areas. There is no corner of the Inn you have not seen.',
    iconKey:         'badge_explorer',
    rarity:          BadgeRarity.RARE,
    unlockCondition: { achievementId: 'explorer' },
    displayColor:    '#20B2AA',
    glowEffect:      true,
  },

  loyal_player: {
    id:              'loyal_player',
    name:            'Loyal Player',
    description:     '30 total login days. You are part of the Starlight family.',
    iconKey:         'badge_loyal_player',
    rarity:          BadgeRarity.UNCOMMON,
    unlockCondition: { achievementId: 'loyal_player' },
    displayColor:    '#4169E1',
    glowEffect:      false,
  },

  helper: {
    id:              'helper',
    name:            'Helper',
    description:     'Answered 20 help requests. You lift others up.',
    iconKey:         'badge_helper',
    rarity:          BadgeRarity.UNCOMMON,
    unlockCondition: { achievementId: 'helper' },
    displayColor:    '#32CD32',
    glowEffect:      false,
  },

  dj: {
    id:              'dj',
    name:            'DJ',
    description:     'Added 10 videos to the theatre queue. You set the mood.',
    iconKey:         'badge_dj',
    rarity:          BadgeRarity.UNCOMMON,
    unlockCondition: { achievementId: 'dj' },
    displayColor:    '#9400D3',
    glowEffect:      false,
  },

  theatre_goer: {
    id:              'theatre_goer',
    name:            'Theatre Goer',
    description:     'Watched 5 videos in the theatre. A true cinema lover.',
    iconKey:         'badge_theatre_goer',
    rarity:          BadgeRarity.COMMON,
    unlockCondition: { achievementId: 'thespian' },
    displayColor:    '#FA8072',
    glowEffect:      false,
  },

  battle_pass_hero: {
    id:              'battle_pass_hero',
    name:            'Battle Pass Hero',
    description:     'Completed the free Battle Pass track. Dedication rewarded.',
    iconKey:         'badge_battle_pass_hero',
    rarity:          BadgeRarity.RARE,
    unlockCondition: { achievementId: 'battle_pass_complete' },
    displayColor:    '#DC143C',
    glowEffect:      true,
  },

  premium_member: {
    id:              'premium_member',
    name:            'Premium Member',
    description:     'Starlight Premium subscriber. Exclusive perks, exclusive you.',
    iconKey:         'badge_premium_member',
    rarity:          BadgeRarity.EPIC,
    unlockCondition: { achievementId: 'premium_owner' },
    displayColor:    '#FFD700',
    glowEffect:      true,
  },

  moderator: {
    id:              'moderator',
    name:            'Moderator',
    description:     'Trusted with the Moderator role. Keeping the Inn safe and welcoming.',
    iconKey:         'badge_moderator',
    rarity:          BadgeRarity.LEGENDARY,
    unlockCondition: { achievementId: 'moderator' },
    displayColor:    '#00FA9A',
    glowEffect:      true,
  },

  developer: {
    id:              'developer',
    name:            'Developer',
    description:     'Member of the Starlight Inn development team. Building the magic.',
    iconKey:         'badge_developer',
    rarity:          BadgeRarity.EXCLUSIVE,
    unlockCondition: { achievementId: 'developer' },
    displayColor:    '#00BFFF',
    glowEffect:      true,
  },

  legend: {
    id:              'legend',
    name:            'Legend',
    description:     'Unlocked every non-secret achievement. You are a Starlight Legend.',
    iconKey:         'badge_legend',
    rarity:          BadgeRarity.EXCLUSIVE,
    unlockCondition: { achievementId: 'legend' },
    displayColor:    '#FFD700',
    glowEffect:      true,
  },
});

/**
 * Maximum number of badges a player may display on their profile at once.
 * @type {number}
 */
export const MAX_WORN_BADGES = 3;

/**
 * Rarity sort order for display precedence (higher index = more prestigious).
 * @type {Array<BadgeRarity>}
 */
export const RARITY_ORDER = Object.freeze([
  BadgeRarity.COMMON,
  BadgeRarity.UNCOMMON,
  BadgeRarity.RARE,
  BadgeRarity.EPIC,
  BadgeRarity.LEGENDARY,
  BadgeRarity.EXCLUSIVE,
]);

/**
 * Rarity point values for scoring.
 * @type {Object<string, number>}
 */
export const RARITY_POINTS = Object.freeze({
  [BadgeRarity.COMMON]:    5,
  [BadgeRarity.UNCOMMON]:  10,
  [BadgeRarity.RARE]:      25,
  [BadgeRarity.EPIC]:      50,
  [BadgeRarity.LEGENDARY]: 100,
  [BadgeRarity.EXCLUSIVE]: 250,
});

/* --------------------------------------------------------------------------
 *  BadgeSystem class
 * -------------------------------------------------------------------------- */

/**
 * Manages badge collection, unlock logic (driven by achievements),
 * profile display slots, and social status signalling.
 *
 * @example
 *   const badges = new BadgeSystem(playerId, achievementSystem);
 *   badges.initialize();
 *   badges.equipBadge('friend_magnet');
 */
export class BadgeSystem {
  /**
   * @param {string} playerId — unique player identifier
   * @param {AchievementSystem} achievementSystem — live achievement engine
   * @param {Object} [opts] — optional configuration
   */
  constructor(playerId, achievementSystem, opts = {}) {
    if (!playerId) throw new Error('BadgeSystem requires a playerId');
    if (!achievementSystem) throw new Error('BadgeSystem requires an AchievementSystem instance');

    this.playerId = playerId;
    this.achievementSystem = achievementSystem;
    this.opts = {
      storageKey: `si_badges_${playerId}`,
      maxWorn: MAX_WORN_BADGES,
      autoEquipFirst: true,
      serverSyncIntervalMs: 60000,
      enableToast: true,
      ...opts,
    };

    /** @private @type {Set<string>} — unlocked badge IDs */
    this._unlocked = new Set();

    /** @private @type {Array<string>} — currently worn badge IDs (ordered) */
    this._worn = [];

    /** @private @type {Map<string, number>} — times each badge was equipped (analytics) */
    this._equipCounts = new Map();

    /** @private @type {boolean} */
    this._initialized = false;

    /** @private @type {number|null} */
    this._syncTimer = null;

    /** @private @type {Object} */
    this._listeners = { unlock: [], equip: [], unequip: [], change: [] };
  }

  /* ── Lifecycle ── */

  /**
   * Bootstrap the badge system: load storage, bind achievement events.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;
    this._loadFromStorage();
    this._bindAchievementSystem();
    this._startSyncLoop();
    this._initialized = true;
    this._emit('systemReady', { playerId: this.playerId, unlocked: this._unlocked.size });
  }

  /**
   * Tear down.
   */
  destroy() {
    this._stopSyncLoop();
    this._unbindAchievementSystem();
    this._listeners = { unlock: [], equip: [], unequip: [], change: [] };
    this._initialized = false;
  }

  /* ── Persistence ── */

  /**
   * Serialize badge state to localStorage.
   * @private
   */
  _saveToStorage() {
    try {
      const payload = {
        version: 7,
        playerId: this.playerId,
        unlocked: Array.from(this._unlocked),
        worn: [...this._worn],
        equipCounts: Array.from(this._equipCounts.entries()),
        lastSaved: new Date().toISOString(),
      };
      localStorage.setItem(this.opts.storageKey, JSON.stringify(payload));
    } catch (err) {
      console.warn('[BadgeSystem] localStorage save failed:', err);
    }
  }

  /**
   * Deserialize badge state from localStorage.
   * @private
   */
  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.opts.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.unlocked) data.unlocked.forEach((id) => this._unlocked.add(id));
      if (data.worn) this._worn = data.worn.filter((id) => this._unlocked.has(id));
      if (data.equipCounts) data.equipCounts.forEach(([k, v]) => this._equipCounts.set(k, v));
    } catch (err) {
      console.warn('[BadgeSystem] localStorage load failed:', err);
    }
  }

  /**
   * Wipe badge storage.
   */
  clearStorage() {
    this._unlocked.clear();
    this._worn = [];
    this._equipCounts.clear();
    localStorage.removeItem(this.opts.storageKey);
    this._emit('storageCleared', { playerId: this.playerId });
  }

  /* ── Achievement Binding ── */

  /**
   * Listen to achievement unlocks so we can automatically unlock tied badges.
   * @private
   */
  _bindAchievementSystem() {
    this._onAchvUnlock = (event) => this._tryUnlockForAchievement(event.achievementId);
    this.achievementSystem.on('unlock', this._onAchvUnlock);
  }

  /**
   * @private
   */
  _unbindAchievementSystem() {
    if (this._onAchvUnlock) {
      this.achievementSystem.off('unlock', this._onAchvUnlock);
    }
  }

  /**
   * Check all badges whose unlock condition references a given achievement.
   * @private
   * @param {string} achievementId
   */
  _tryUnlockForAchievement(achievementId) {
    for (const def of Object.values(BADGE_CATALOG)) {
      if (this._unlocked.has(def.id)) continue;
      if (def.unlockCondition.achievementId === achievementId) {
        this.unlock(def.id);
      }
    }
  }

  /* ── Server Sync ── */

  /**
   * Start background sync.
   * @private
   */
  _startSyncLoop() {
    if (this._syncTimer) return;
    this._syncTimer = setInterval(() => this.syncToServer(), this.opts.serverSyncIntervalMs);
  }

  /**
   * Stop background sync.
   * @private
   */
  _stopSyncLoop() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  }

  /**
   * Push badge state to the server.
   * @returns {Promise<boolean>}
   */
  async syncToServer() {
    const payload = this.exportState();
    this._emit('serverSync', payload);
    return true;
  }

  /**
   * Merge server-side badge state. Server wins on unlocked; equipped set is
   * reconciled by ensuring all worn badges are unlocked.
   * @param {Object} serverState
   */
  mergeFromServer(serverState) {
    if (!serverState || !serverState.unlocked) return;
    let newUnlocks = 0;
    serverState.unlocked.forEach((id) => {
      if (!this._unlocked.has(id)) {
        this._unlocked.add(id);
        newUnlocks++;
      }
    });
    if (serverState.worn) {
      const validWorn = serverState.worn.filter((id) => this._unlocked.has(id));
      this._worn = validWorn.slice(0, this.opts.maxWorn);
    }
    if (newUnlocks > 0) {
      this._saveToStorage();
      this._emit('serverMerge', { newUnlocks, total: this._unlocked.size });
    }
  }

  /* ── Unlocking ── */

  /**
   * Unlock a badge. Awards nothing extra — the badge IS the reward.
   * @param {string} badgeId
   * @returns {boolean} — true if newly unlocked
   */
  unlock(badgeId) {
    if (this._unlocked.has(badgeId)) return false;
    const def = BADGE_CATALOG[badgeId];
    if (!def) {
      console.warn(`[BadgeSystem] Unknown badge: ${badgeId}`);
      return false;
    }

    this._unlocked.add(badgeId);

    if (this.opts.autoEquipFirst && this._worn.length < this.opts.maxWorn) {
      this._worn.push(badgeId);
    }

    this._saveToStorage();

    this._emit('unlock', {
      badgeId,
      name: def.name,
      description: def.description,
      rarity: def.rarity,
      iconKey: def.iconKey,
      displayColor: def.displayColor,
      glowEffect: def.glowEffect,
      timestamp: Date.now(),
    });

    return true;
  }

  /* ── Wearing / Equipping ── */

  /**
   * Equip a badge to one of the worn slots.
   * @param {string} badgeId
   * @param {number} [slotIndex] — optional target slot (0-based)
   * @returns {boolean}
   */
  equipBadge(badgeId, slotIndex) {
    if (!this._unlocked.has(badgeId)) return false;
    if (this._worn.includes(badgeId)) return false;

    const def = BADGE_CATALOG[badgeId];
    if (!def) return false;

    if (typeof slotIndex === 'number') {
      if (slotIndex < 0 || slotIndex >= this.opts.maxWorn) return false;
      if (this._worn[slotIndex]) {
        this._emit('unequip', { badgeId: this._worn[slotIndex], slotIndex });
      }
      this._worn[slotIndex] = badgeId;
    } else {
      if (this._worn.length >= this.opts.maxWorn) {
        this._emit('unequip', { badgeId: this._worn[0], slotIndex: 0 });
        this._worn.shift();
      }
      this._worn.push(badgeId);
    }

    this._equipCounts.set(badgeId, (this._equipCounts.get(badgeId) || 0) + 1);
    this._saveToStorage();

    this._emit('equip', { badgeId, slotIndex: this._worn.indexOf(badgeId), name: def.name });
    this._emitChange();
    return true;
  }

  /**
   * Unequip a badge by ID.
   * @param {string} badgeId
   * @returns {boolean}
   */
  unequipBadge(badgeId) {
    const idx = this._worn.indexOf(badgeId);
    if (idx === -1) return false;
    this._worn.splice(idx, 1);
    this._saveToStorage();
    this._emit('unequip', { badgeId, slotIndex: idx });
    this._emitChange();
    return true;
  }

  /**
   * Unequip the badge at a specific slot.
   * @param {number} slotIndex
   * @returns {boolean}
   */
  unequipSlot(slotIndex) {
    if (slotIndex < 0 || slotIndex >= this._worn.length) return false;
    const badgeId = this._worn[slotIndex];
    this._worn.splice(slotIndex, 1);
    this._saveToStorage();
    this._emit('unequip', { badgeId, slotIndex });
    this._emitChange();
    return true;
  }

  /**
   * Reorder worn badges by dragging indices.
   * @param {number} fromIndex
   * @param {number} toIndex
   * @returns {boolean}
   */
  reorderWorn(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this._worn.length) return false;
    if (toIndex < 0 || toIndex >= this.opts.maxWorn) return false;
    const [badge] = this._worn.splice(fromIndex, 1);
    this._worn.splice(toIndex, 0, badge);
    this._saveToStorage();
    this._emitChange();
    return true;
  }

  /**
   * Replace a currently equipped badge with another.
   * @param {string} oldBadgeId
   * @param {string} newBadgeId
   * @returns {boolean}
   */
  swapBadge(oldBadgeId, newBadgeId) {
    const idx = this._worn.indexOf(oldBadgeId);
    if (idx === -1) return false;
    if (!this._unlocked.has(newBadgeId)) return false;
    if (this._worn.includes(newBadgeId)) return false;

    this._worn[idx] = newBadgeId;
    this._equipCounts.set(newBadgeId, (this._equipCounts.get(newBadgeId) || 0) + 1);
    this._saveToStorage();
    this._emit('unequip', { badgeId: oldBadgeId, slotIndex: idx });
    this._emit('equip', { badgeId: newBadgeId, slotIndex: idx, name: BADGE_CATALOG[newBadgeId]?.name });
    this._emitChange();
    return true;
  }

  /* ── Queries ── */

  /**
   * Check if a badge is unlocked.
   * @param {string} badgeId
   * @returns {boolean}
   */
  isUnlocked(badgeId) {
    return this._unlocked.has(badgeId);
  }

  /**
   * Check if a badge is currently equipped.
   * @param {string} badgeId
   * @returns {boolean}
   */
  isEquipped(badgeId) {
    return this._worn.includes(badgeId);
  }

  /**
   * Get currently worn badge IDs.
   * @returns {Array<string>}
   */
  getWornBadgeIds() {
    return [...this._worn];
  }

  /**
   * Get full definitions for worn badges.
   * @returns {Array<Object>}
   */
  getWornBadges() {
    return this._worn.map((id) => BADGE_CATALOG[id]).filter(Boolean);
  }

  /**
   * Get all unlocked badge definitions.
   * @returns {Array<Object>}
   */
  getUnlockedBadges() {
    return Array.from(this._unlocked)
      .map((id) => BADGE_CATALOG[id])
      .filter(Boolean);
  }

  /**
   * Get all locked badge definitions.
   * @returns {Array<Object>}
   */
  getLockedBadges() {
    return Object.values(BADGE_CATALOG).filter((def) => !this._unlocked.has(def.id));
  }

  /**
   * Get the number of free slots remaining.
   * @returns {number}
   */
  getFreeSlots() {
    return Math.max(0, this.opts.maxWorn - this._worn.length);
  }

  /**
   * Get the total badge score (sum of rarity points).
   * @returns {number}
   */
  getBadgeScore() {
    let score = 0;
    for (const id of this._unlocked) {
      const def = BADGE_CATALOG[id];
      if (def) score += RARITY_POINTS[def.rarity] || 0;
    }
    return score;
  }

  /**
   * Get the equipped badge score (social status signal).
   * @returns {number}
   */
  getEquippedScore() {
    let score = 0;
    for (const id of this._worn) {
      const def = BADGE_CATALOG[id];
      if (def) score += RARITY_POINTS[def.rarity] || 0;
    }
    return score;
  }

  /**
   * Get completion percentage of the badge collection.
   * @returns {number}
   */
  getCollectionPercent() {
    const total = Object.keys(BADGE_CATALOG).length;
    return total === 0 ? 0 : Math.floor((this._unlocked.size / total) * 100);
  }

  /**
   * Get the most-prestigious (by rarity) unlocked badge.
   * @returns {Object|null}
   */
  getMostPrestigious() {
    const unlocked = this.getUnlockedBadges();
    if (unlocked.length === 0) return null;
    return unlocked.sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity))[0];
  }

  /**
   * Get the badge equipped most frequently (analytics).
   * @returns {Object|null}
   */
  getMostWornBadge() {
    let maxCount = -1;
    let maxId = null;
    for (const [id, count] of this._equipCounts) {
      if (count > maxCount) {
        maxCount = count;
        maxId = id;
      }
    }
    return maxId ? BADGE_CATALOG[maxId] : null;
  }

  /* ── Profile Display Helpers ── */

  /**
   * Build a serializable profile badge payload for other players to render.
   * @returns {Array<Object>} — array of { id, name, iconKey, rarity, color, glow }
   */
  buildProfilePayload() {
    return this.getWornBadges().map((def) => ({
      id: def.id,
      name: def.name,
      iconKey: def.iconKey,
      rarity: def.rarity,
      color: def.displayColor,
      glow: def.glowEffect,
    }));
  }

  /* ── Event System ── */

  /**
   * Subscribe to badge events.
   * @param {string} event — 'unlock' | 'equip' | 'unequip' | 'change' | 'serverSync' | 'serverMerge' | 'systemReady' | 'storageCleared'
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  /**
   * Unsubscribe.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter((cb) => cb !== callback);
  }

  /**
   * @private
   */
  _emit(event, data) {
    const listeners = this._listeners[event] || [];
    listeners.forEach((cb) => {
      try { cb(data); } catch (err) { console.error(`[BadgeSystem] Event error (${event}):`, err); }
    });
  }

  /**
   * Convenience: emit a generic 'change' event when worn set mutates.
   * @private
   */
  _emitChange() {
    this._emit('change', {
      worn: [...this._worn],
      wornBadges: this.getWornBadges(),
      freeSlots: this.getFreeSlots(),
    });
  }

  /* ── Import / Export ── */

  /**
   * Export badge state.
   * @returns {Object}
   */
  exportState() {
    return {
      playerId: this.playerId,
      version: 7,
      unlocked: Array.from(this._unlocked),
      worn: [...this._worn],
      equipCounts: Array.from(this._equipCounts.entries()),
      score: this.getBadgeScore(),
      collectionPercent: this.getCollectionPercent(),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import badge state.
   * @param {Object} state
   */
  importState(state) {
    if (!state || !state.unlocked) return;
    state.unlocked.forEach((id) => this._unlocked.add(id));
    if (state.worn) {
      this._worn = state.worn.filter((id) => this._unlocked.has(id)).slice(0, this.opts.maxWorn);
    }
    if (state.equipCounts) {
      state.equipCounts.forEach(([k, v]) => {
        const cur = this._equipCounts.get(k) || 0;
        if (v > cur) this._equipCounts.set(k, v);
      });
    }
    this._saveToStorage();
    this._emit('importComplete', { unlockedCount: this._unlocked.size });
  }

  /* ── Admin / Debug ── */

  /**
   * Force-unlock a badge (admin / debug).
   * @param {string} badgeId
   */
  adminUnlock(badgeId) {
    console.warn(`[BadgeSystem] Admin unlock forced: ${badgeId}`);
    this.unlock(badgeId);
  }

  /**
   * Reset a badge to locked.
   * @param {string} badgeId
   */
  adminReset(badgeId) {
    this._unlocked.delete(badgeId);
    const idx = this._worn.indexOf(badgeId);
    if (idx !== -1) this._worn.splice(idx, 1);
    this._equipCounts.delete(badgeId);
    this._saveToStorage();
    this._emit('adminReset', { badgeId });
    this._emitChange();
  }

  /**
   * Reset all badges.
   */
  adminResetAll() {
    this._unlocked.clear();
    this._worn = [];
    this._equipCounts.clear();
    this._saveToStorage();
    this._emit('adminResetAll', { playerId: this.playerId });
  }
}

/* --------------------------------------------------------------------------
 *  UI Helpers — badge rendering & formatting
 * -------------------------------------------------------------------------- */

/**
 * Rarity-to-CSS-class mapping.
 * @param {BadgeRarity} rarity
 * @returns {string}
 */
export function rarityClass(rarity) {
  return `badge-rarity-${rarity.toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Rarity-to-human-readable label with sparkle indicator.
 * @param {BadgeRarity} rarity
 * @returns {string}
 */
export function rarityLabel(rarity) {
  return rarity;
}

/**
 * Format a badge tooltip string.
 * @param {Object} badgeDef — from BADGE_CATALOG
 * @param {boolean} [isUnlocked] — whether the viewer has unlocked it
 * @returns {string}
 */
export function formatBadgeTooltip(badgeDef, isUnlocked = true) {
  const status = isUnlocked ? '' : ' (Locked)';
  return `${badgeDef.name}${status}\n${badgeDef.description}\nRarity: ${badgeDef.rarity}`;
}

/**
 * Build a serializable profile card for rendering a player's badge strip.
 * @param {BadgeSystem} badgeSys
 * @returns {Object}
 */
export function buildProfileBadgeCard(badgeSys) {
  const worn = badgeSys.getWornBadges();
  return {
    worn: worn.map((def) => ({
      id: def.id,
      name: def.name,
      iconKey: def.iconKey,
      rarity: def.rarity,
      color: def.displayColor,
      glow: def.glowEffect,
    })),
    totalUnlocked: badgeSys.getUnlockedBadges().length,
    totalAvailable: Object.keys(BADGE_CATALOG).length,
    badgeScore: badgeSys.getBadgeScore(),
    equippedScore: badgeSys.getEquippedScore(),
    mostPrestigious: badgeSys.getMostPrestigious()?.id || null,
  };
}

/**
 * Generate a rarity distribution chart payload.
 * @param {BadgeSystem} badgeSys
 * @returns {Array<{rarity: string, count: number, percent: number}>}
 */
export function computeRarityDistribution(badgeSys) {
  const unlocked = badgeSys.getUnlockedBadges();
  const counts = {};
  for (const r of RARITY_ORDER) counts[r] = 0;
  for (const def of unlocked) {
    counts[def.rarity] = (counts[def.rarity] || 0) + 1;
  }
  const total = unlocked.length || 1;
  return Object.entries(counts).map(([rarity, count]) => ({
    rarity,
    count,
    percent: Math.floor((count / total) * 100),
  }));
}

/**
 * Suggest the "best" badge combination to maximize social status score.
 * @param {BadgeSystem} badgeSys
 * @returns {Array<string>} — badge IDs to equip
 */
export function suggestOptimalEquipped(badgeSys) {
  const unlocked = badgeSys.getUnlockedBadges();
  const sorted = unlocked.sort((a, b) =>
    RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)
  );
  return sorted.slice(0, MAX_WORN_BADGES).map((def) => def.id);
}

/**
 * Compare two players' badge collections for rivalry / bragging rights.
 * @param {Object} playerA — { unlocked: Set<string>, score: number, equippedScore: number }
 * @param {Object} playerB — { unlocked: Set<string>, score: number, equippedScore: number }
 * @returns {Object}
 */
export function compareBadgeCollections(playerA, playerB) {
  const aSet = new Set(playerA.unlocked);
  const bSet = new Set(playerB.unlocked);
  const shared = [];
  const onlyA = [];
  const onlyB = [];
  for (const id of aSet) {
    if (bSet.has(id)) shared.push(id);
    else onlyA.push(id);
  }
  for (const id of bSet) {
    if (!aSet.has(id)) onlyB.push(id);
  }
  const winner = playerA.score > playerB.score ? 'A' : playerB.score > playerA.score ? 'B' : 'tie';
  const equippedWinner = playerA.equippedScore > playerB.equippedScore ? 'A'
    : playerB.equippedScore > playerA.equippedScore ? 'B' : 'tie';
  return {
    winner,
    equippedWinner,
    diffScore: Math.abs(playerA.score - playerB.score),
    diffEquippedScore: Math.abs(playerA.equippedScore - playerB.equippedScore),
    sharedCount: shared.length,
    onlyACount: onlyA.length,
    onlyBCount: onlyB.length,
    shared,
    onlyA,
    onlyB,
  };
}

/**
 * Get a CSS gradient string for a badge's rarity.
 * @param {BadgeRarity} rarity
 * @returns {string}
 */
export function rarityGradient(rarity) {
  const gradients = {
    [BadgeRarity.COMMON]:    'linear-gradient(135deg, #cccccc, #eeeeee)',
    [BadgeRarity.UNCOMMON]:  'linear-gradient(135deg, #77dd77, #99ff99)',
    [BadgeRarity.RARE]:      'linear-gradient(135deg, #6bb5ff, #aaddff)',
    [BadgeRarity.EPIC]:      'linear-gradient(135deg, #b366ff, #dd99ff)',
    [BadgeRarity.LEGENDARY]: 'linear-gradient(135deg, #ffaa00, #ffdd44)',
    [BadgeRarity.EXCLUSIVE]: 'linear-gradient(135deg, #ff0040, #ff6688)',
  };
  return gradients[rarity] || gradients[BadgeRarity.COMMON];
}

/**
 * Get a glow box-shadow string for badge glow effects.
 * @param {BadgeRarity} rarity
 * @returns {string}
 */
export function rarityGlow(rarity) {
  const glows = {
    [BadgeRarity.COMMON]:    'none',
    [BadgeRarity.UNCOMMON]:  '0 0 4px rgba(119, 221, 119, 0.4)',
    [BadgeRarity.RARE]:      '0 0 8px rgba(107, 181, 255, 0.6)',
    [BadgeRarity.EPIC]:      '0 0 12px rgba(179, 102, 255, 0.7)',
    [BadgeRarity.LEGENDARY]: '0 0 16px rgba(255, 170, 0, 0.8)',
    [BadgeRarity.EXCLUSIVE]: '0 0 20px rgba(255, 0, 64, 0.9)',
  };
  return glows[rarity] || 'none';
}

/**
 * Get the unlock hint for a locked badge (what achievement is needed).
 * @param {string} badgeId
 * @returns {string|null}
 */
export function getUnlockHint(badgeId) {
  const def = BADGE_CATALOG[badgeId];
  if (!def || !def.unlockCondition.achievementId) return null;
  return `Unlock the "${def.unlockCondition.achievementId}" achievement to earn this badge.`;
}

/**
 * Build a full badge collection page payload for the profile UI.
 * @param {BadgeSystem} badgeSys
 * @returns {Object}
 */
export function buildCollectionPage(badgeSys) {
  const all = Object.values(BADGE_CATALOG);
  const unlockedIds = new Set(badgeSys.getUnlockedBadgeIds ? badgeSys._unlocked : badgeSys.getUnlockedBadges().map((d) => d.id));
  const items = all.map((def) => ({
    ...def,
    isUnlocked: unlockedIds.has(def.id),
    isEquipped: badgeSys.isEquipped(def.id),
    unlockHint: getUnlockHint(def.id),
  }));

  const byRarity = {};
  for (const r of RARITY_ORDER) byRarity[r] = [];
  for (const item of items) {
    byRarity[item.rarity].push(item);
  }

  return {
    items,
    byRarity,
    summary: {
      total: all.length,
      unlocked: badgeSys.getUnlockedBadges().length,
      equipped: badgeSys.getWornBadgeIds().length,
      score: badgeSys.getBadgeScore(),
      collectionPercent: badgeSys.getCollectionPercent(),
    },
  };
}

/* --------------------------------------------------------------------------
 *  Admin & analytics helpers
 * -------------------------------------------------------------------------- */

/**
 * Get aggregate stats about the badge catalog.
 * @returns {Object}
 */
export function getCatalogStats() {
  const total = Object.keys(BADGE_CATALOG).length;
  const byRarity = {};
  let totalPoints = 0;
  for (const def of Object.values(BADGE_CATALOG)) {
    byRarity[def.rarity] = (byRarity[def.rarity] || 0) + 1;
    totalPoints += RARITY_POINTS[def.rarity] || 0;
  }
  return { totalBadges: total, byRarity, totalPointsAvailable: totalPoints, maxWorn: MAX_WORN_BADGES };
}

/**
 * Compute which badges a player is closest to unlocking.
   * @param {BadgeSystem} badgeSys
   * @param {AchievementSystem} achvSys
   * @returns {Array<{badgeId: string, badgeName: string, achievementId: string, progressPercent: number}>}
   */
export function getNearestUnlocks(badgeSys, achvSys) {
  const locked = badgeSys.getLockedBadges();
  const result = [];
  for (const def of locked) {
    const achvId = def.unlockCondition.achievementId;
    if (!achvId) continue;
    const { percent } = achvSys.getProgress(achvId);
    if (percent > 0) {
      result.push({
        badgeId: def.id,
        badgeName: def.name,
        achievementId: achvId,
        progressPercent: percent,
      });
    }
  }
  return result.sort((a, b) => b.progressPercent - a.progressPercent);
}

/* --------------------------------------------------------------------------
 *  Default export
 * -------------------------------------------------------------------------- */
export default BadgeSystem;
