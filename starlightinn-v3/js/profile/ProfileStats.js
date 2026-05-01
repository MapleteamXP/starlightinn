/**
 * Starlight Inn v7.0 - ProfileStats.js
 * Comprehensive player stat tracking engine.  Monitors every action,
 * persists to localStorage, syncs to server, and formats stats for
 * beautiful profile UI display.
 *
 * @module profile/ProfileStats
 * @version 7.0.0
 * @author Starlight Inn Team
 */

'use strict';

/* --------------------------------------------------------------------------
 *  Stat definition registry
 * -------------------------------------------------------------------------- */

/**
 * All trackable stats with their default values and metadata.
 * @type {Object<string, {default: number, type: string, category: string}>}
 */
export const STAT_DEFINITIONS = Object.freeze({
  /* ── Social ── */
  total_kisses:               { default: 0,  type: 'counter', category: 'social',      label: 'Kisses Given' },
  total_dance_seconds:        { default: 0,  type: 'duration', category: 'expression',  label: 'Dance Time' },
  total_dance_sessions:       { default: 0,  type: 'counter', category: 'expression',  label: 'Dance Sessions' },
  total_trade_count:          { default: 0,  type: 'counter', category: 'economy',     label: 'Trades Completed' },
  total_items_traded:         { default: 0,  type: 'counter', category: 'economy',     label: 'Items Traded' },
  total_friends_made:         { default: 0,  type: 'counter', category: 'social',      label: 'Friends Made' },
  total_rooms_visited:        { default: 0,  type: 'counter', category: 'exploration', label: 'Rooms Visited' },
  unique_areas_visited:       { default: 0,  type: 'counter', category: 'exploration', label: 'Unique Areas' },
  total_tiles_walked:         { default: 0,  type: 'counter', category: 'exploration', label: 'Tiles Walked' },
  unique_chairs_sat:          { default: 0,  type: 'counter', category: 'exploration', label: 'Unique Chairs Sat' },
  unique_campfires_sat:         { default: 0,  type: 'counter', category: 'exploration', label: 'Campfires Sat' },

  /* ── Time & Loyalty ── */
  total_playtime_seconds:     { default: 0,  type: 'duration', category: 'loyalty',     label: 'Total Playtime' },
  total_login_days:           { default: 0,  type: 'counter', category: 'loyalty',     label: 'Total Login Days' },
  current_login_streak:       { default: 0,  type: 'counter', category: 'loyalty',     label: 'Current Streak' },
  best_login_streak:          { default: 0,  type: 'counter', category: 'loyalty',     label: 'Best Streak' },

  /* ── Communication ── */
  total_messages_sent:        { default: 0,  type: 'counter', category: 'social',      label: 'Messages Sent' },
  total_gifts_given:          { default: 0,  type: 'counter', category: 'social',      label: 'Gifts Given' },
  max_room_occupancy:         { default: 0,  type: 'counter', category: 'social',      label: 'Max Room Guests' },
  total_help_requests_answered: { default: 0, type: 'counter', category: 'social',      label: 'Help Requests' },

  /* ── Creation ── */
  total_furniture_placed:     { default: 0,  type: 'counter', category: 'creation',    label: 'Furniture Placed' },
  total_custom_rooms_created: { default: 0,  type: 'counter', category: 'creation',    label: 'Custom Rooms' },

  /* ── Games ── */
  total_minigames_won:        { default: 0,  type: 'counter', category: 'games',       label: 'Mini-games Won' },
  total_chests_opened:        { default: 0,  type: 'counter', category: 'games',       label: 'Chests Opened' },
  total_eggs_hatched:         { default: 0,  type: 'counter', category: 'games',       label: 'Eggs Hatched' },

  /* ── Progression ── */
  total_battle_pass_tiers:    { default: 0,  type: 'counter', category: 'progression', label: 'BP Tiers' },
  tutorial_completed:         { default: 0,  type: 'counter', category: 'progression', label: 'Tutorial Done' },

  /* ── Economy ── */
  total_money_spent:          { default: 0,  type: 'counter', category: 'economy',     label: 'Money Spent' },
  total_money_earned:         { default: 0,  type: 'counter', category: 'economy',     label: 'Money Earned' },
  max_coins_held:             { default: 0,  type: 'counter', category: 'economy',     label: 'Max Coins Held' },
  total_unique_items_owned:   { default: 0,  type: 'counter', category: 'economy',     label: 'Unique Items' },
  total_clothing_owned:       { default: 0,  type: 'counter', category: 'economy',     label: 'Clothing Owned' },

  /* ── Entertainment ── */
  total_theatre_videos_watched: { default: 0, type: 'counter', category: 'entertainment', label: 'Videos Watched' },
  total_videos_queued:        { default: 0,  type: 'counter', category: 'entertainment', label: 'Videos Queued' },
  total_theatre_seconds:      { default: 0,  type: 'duration', category: 'entertainment', label: 'Theatre Time' },

  /* ── Meta ── */
  first_login_date:           { default: null, type: 'date',    category: 'meta',        label: 'First Login' },
  last_login_date:            { default: null, type: 'date',    category: 'meta',        label: 'Last Login' },
  favourite_area:             { default: null, type: 'string',  category: 'meta',        label: 'Favourite Area' },
  most_used_emote:            { default: null, type: 'string',  category: 'meta',        label: 'Most Used Emote' },
  equipped_legendary:         { default: 0,  type: 'counter', category: 'meta',        label: 'Legendary Equipped' },
});

/* --------------------------------------------------------------------------
 *  ProfileStats class
 * -------------------------------------------------------------------------- */

/**
 * Central stat tracker for Starlight Inn.  Every player action that should be
 * remembered flows through here.  Stats persist to localStorage and sync to
 * the server on a configurable interval.
 *
 * @example
 *   const stats = new ProfileStats(playerId);
 *   await stats.initialize();
 *   stats.increment('total_kisses');
 *   stats.add('total_dance_seconds', 5);
 */
export class ProfileStats {
  /**
   * @param {string} playerId — unique player identifier
   * @param {Object} [opts] — optional configuration
   */
  constructor(playerId, opts = {}) {
    if (!playerId) throw new Error('ProfileStats requires a playerId');

    this.playerId = playerId;
    this.opts = {
      storageKey: `si_stats_${playerId}`,
      sessionKey: `si_session_${playerId}`,
      serverSyncIntervalMs: 30000,
      maxBatchSize: 50,
      enablePlaytimeTracking: true,
      playtimeTickMs: 1000,
      ...opts,
    };

    /** @private @type {Map<string, any>} — live stat values */
    this._stats = new Map();

    /** @private @type {Array<Object>} — pending changes queued for server sync */
    this._pendingChanges = [];

    /** @private @type {boolean} */
    this._initialized = false;

    /** @private @type {boolean} */
    this._destroyed = false;

    /** @private @type {number|null} */
    this._playtimeTimer = null;

    /** @private @type {number|null} */
    this._syncTimer = null;

    /** @private @type {number} */
    this._sessionStartTime = 0;

    /** @private @type {Object} — frequency tracker for "favourite" stats */
    this._frequency = {
      areas: new Map(),
      emotes: new Map(),
    };

    /** @private @type {Object} — event listeners */
    this._listeners = { change: [], batch: [], sync: [], playtime: [] };

    /** @private @type {Date|null} */
    this._lastSync = null;
  }

  /* ── Lifecycle ── */

  /**
   * Bootstrap: load persisted stats, start playtime & sync timers,
   * record login event.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;
    this._loadFromStorage();
    this._initializeDefaults();
    this._recordLogin();
    this._startPlaytimeTracking();
    this._startSyncLoop();
    this._initialized = true;
    this._emit('systemReady', { playerId: this.playerId });
  }

  /**
   * Tear down timers, flush pending data, and stop tracking.
   */
  destroy() {
    this._destroyed = true;
    this._stopPlaytimeTracking();
    this._stopSyncLoop();
    this._saveToStorage();
    this._listeners = { change: [], batch: [], sync: [], playtime: [] };
    this._initialized = false;
  }

  /* ── Persistence (localStorage) ── */

  /**
   * Save current stats snapshot to localStorage.
   * @private
   */
  _saveToStorage() {
    try {
      const payload = {
        version: 7,
        playerId: this.playerId,
        stats: Array.from(this._stats.entries()),
        frequency: {
          areas: Array.from(this._frequency.areas.entries()),
          emotes: Array.from(this._frequency.emotes.entries()),
        },
        lastSaved: new Date().toISOString(),
      };
      localStorage.setItem(this.opts.storageKey, JSON.stringify(payload));
    } catch (err) {
      console.warn('[ProfileStats] localStorage save failed:', err);
    }
  }

  /**
   * Load stats from localStorage.
   * @private
   */
  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.opts.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.stats) data.stats.forEach(([k, v]) => this._stats.set(k, v));
      if (data.frequency) {
        if (data.frequency.areas) data.frequency.areas.forEach(([k, v]) => this._frequency.areas.set(k, v));
        if (data.frequency.emotes) data.frequency.emotes.forEach(([k, v]) => this._frequency.emotes.set(k, v));
      }
    } catch (err) {
      console.warn('[ProfileStats] localStorage load failed:', err);
    }
  }

  /**
   * Ensure every defined stat has a value.
   * @private
   */
  _initializeDefaults() {
    for (const [key, meta] of Object.entries(STAT_DEFINITIONS)) {
      if (!this._stats.has(key)) {
        this._stats.set(key, meta.default);
      }
    }
  }

  /**
   * Wipe all stored stats.  Destructive.
   */
  clearStorage() {
    this._stats.clear();
    this._frequency.areas.clear();
    this._frequency.emotes.clear();
    this._pendingChanges = [];
    localStorage.removeItem(this.opts.storageKey);
    this._initializeDefaults();
    this._emit('storageCleared', { playerId: this.playerId });
  }

  /* ── Login / Session Tracking ── */

  /**
   * Record a login: update streaks, dates, and counters.
   * @private
   */
  _recordLogin() {
    const now = new Date();
    const today = now.toDateString();

    if (!this._stats.has('first_login_date')) {
      this._set('first_login_date', now.toISOString(), false);
    }

    const lastDate = this._stats.get('last_login_date');
    const last = lastDate ? new Date(lastDate) : null;

    if (last) {
      const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        this._increment('current_login_streak', 1, false);
      } else if (diffDays > 1) {
        this._set('current_login_streak', 1, false);
      }
      // diffDays === 0 => same day login, don't touch streak
    } else {
      this._set('current_login_streak', 1, false);
    }

    const currentStreak = this._stats.get('current_login_streak') || 0;
    const bestStreak = this._stats.get('best_login_streak') || 0;
    if (currentStreak > bestStreak) {
      this._set('best_login_streak', currentStreak, false);
    }

    this._set('last_login_date', now.toISOString(), false);
    this._increment('total_login_days', 1, false);
    this._sessionStartTime = Date.now();
    this._saveToStorage();
  }

  /* ── Playtime Tracking ── */

  /**
   * Start the playtime ticker.
   * @private
   */
  _startPlaytimeTracking() {
    if (!this.opts.enablePlaytimeTracking) return;
    this._playtimeTimer = setInterval(() => {
      this._add('total_playtime_seconds', 1, false);
      this._emit('playtime', {
        totalSeconds: this._stats.get('total_playtime_seconds') || 0,
        sessionSeconds: Math.floor((Date.now() - this._sessionStartTime) / 1000),
      });
    }, this.opts.playtimeTickMs);
  }

  /**
   * Stop the playtime ticker.
   * @private
   */
  _stopPlaytimeTracking() {
    if (this._playtimeTimer) {
      clearInterval(this._playtimeTimer);
      this._playtimeTimer = null;
    }
  }

  /* ── Server Sync ── */

  /**
   * Start periodic server sync.
   * @private
   */
  _startSyncLoop() {
    if (this._syncTimer) return;
    this._syncTimer = setInterval(() => this.syncToServer(), this.opts.serverSyncIntervalMs);
  }

  /**
   * Stop periodic server sync.
   * @private
   */
  _stopSyncLoop() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  }

  /**
   * Push pending stat changes to the server.
   * @returns {Promise<boolean>}
   */
  async syncToServer() {
    const batch = this._pendingChanges.splice(0, this.opts.maxBatchSize);
    if (batch.length === 0) return true;
    this._lastSync = new Date();
    this._emit('sync', { batch, count: batch.length, timestamp: this._lastSync.toISOString() });
    return true;
  }

  /**
   * Merge server-side stats. Server wins on numeric max; date fields are
   * replaced if server value is newer.
   * @param {Object} serverStats — { statName: value } map
   * @param {string} serverTimestamp — ISO timestamp of server data
   */
  mergeFromServer(serverStats = {}, serverTimestamp) {
    for (const [key, value] of Object.entries(serverStats)) {
      const def = STAT_DEFINITIONS[key];
      if (!def) continue;
      const local = this._stats.get(key);
      if (def.type === 'counter' || def.type === 'duration') {
        const max = Math.max(local || 0, value || 0);
        this._stats.set(key, max);
      } else if (def.type === 'date') {
        if (!local || (serverTimestamp && new Date(serverTimestamp) > new Date(local))) {
          this._stats.set(key, value);
        }
      } else {
        this._stats.set(key, value);
      }
    }
    this._saveToStorage();
    this._emit('serverMerge', { keys: Object.keys(serverStats) });
  }

  /* ── Core Stat API ── */

  /**
   * Get the current value of a stat.
   * @param {string} statName
   * @returns {any}
   */
  get(statName) {
    if (!STAT_DEFINITIONS[statName]) {
      console.warn(`[ProfileStats] Unknown stat: ${statName}`);
      return undefined;
    }
    return this._stats.get(statName);
  }

  /**
   * Set a stat to an exact value.
   * @param {string} statName
   * @param {any} value
   * @param {boolean} [queueForSync=true]
   */
  set(statName, value, queueForSync = true) {
    this._set(statName, value, queueForSync);
  }

  /**
   * @private
   */
  _set(statName, value, queueForSync) {
    const oldValue = this._stats.get(statName);
    this._stats.set(statName, value);
    this._emitChange(statName, value, oldValue, queueForSync);
  }

  /**
   * Increment a counter stat by a given amount (default 1).
   * @param {string} statName
   * @param {number} [amount=1]
   * @param {boolean} [queueForSync=true]
   */
  increment(statName, amount = 1, queueForSync = true) {
    this._increment(statName, amount, queueForSync);
  }

  /**
   * @private
   */
  _increment(statName, amount, queueForSync) {
    const def = STAT_DEFINITIONS[statName];
    if (!def) {
      console.warn(`[ProfileStats] Unknown stat: ${statName}`);
      return;
    }
    const oldValue = this._stats.get(statName) || 0;
    const newValue = oldValue + amount;
    this._stats.set(statName, newValue);
    this._emitChange(statName, newValue, oldValue, queueForSync);
  }

  /**
   * Add to a stat (alias for increment, reads better for durations).
   * @param {string} statName
   * @param {number} amount
   * @param {boolean} [queueForSync=true]
   */
  add(statName, amount, queueForSync = true) {
    this._increment(statName, amount, queueForSync);
  }

  /**
   * @private
   */
  _add(statName, amount, queueForSync) {
    this._increment(statName, amount, queueForSync);
  }

  /**
   * Update a "max" stat (e.g., max_coins_held) only if the new value is higher.
   * @param {string} statName
   * @param {number} candidate
   * @param {boolean} [queueForSync=true]
   */
  max(statName, candidate, queueForSync = true) {
    const current = this._stats.get(statName) || 0;
    if (candidate > current) {
      this._set(statName, candidate, queueForSync);
    }
  }

  /**
   * Record that the player visited an area (for favourite_area tracking).
   * @param {string} areaId
   */
  recordAreaVisit(areaId) {
    this._frequency.areas.set(areaId, (this._frequency.areas.get(areaId) || 0) + 1);
    this._updateFavouriteArea();
    this._saveToStorage();
  }

  /**
   * Record that the player used an emote (for most_used_emote tracking).
   * @param {string} emoteId
   */
  recordEmoteUse(emoteId) {
    this._frequency.emotes.set(emoteId, (this._frequency.emotes.get(emoteId) || 0) + 1);
    this._updateMostUsedEmote();
    this._saveToStorage();
  }

  /**
   * Recompute favourite_area from the frequency map.
   * @private
   */
  _updateFavouriteArea() {
    let bestArea = null;
    let bestCount = -1;
    for (const [area, count] of this._frequency.areas) {
      if (count > bestCount) {
        bestCount = count;
        bestArea = area;
      }
    }
    if (bestArea) {
      this._set('favourite_area', bestArea, false);
    }
  }

  /**
   * Recompute most_used_emote from the frequency map.
   * @private
   */
  _updateMostUsedEmote() {
    let bestEmote = null;
    let bestCount = -1;
    for (const [emote, count] of this._frequency.emotes) {
      if (count > bestCount) {
        bestCount = count;
        bestEmote = emote;
      }
    }
    if (bestEmote) {
      this._set('most_used_emote', bestEmote, false);
    }
  }

  /**
   * Emit a change event and optionally queue for server sync.
   * @private
   * @param {string} statName
   * @param {any} newValue
   * @param {any} oldValue
   * @param {boolean} queueForSync
   */
  _emitChange(statName, newValue, oldValue, queueForSync) {
    const event = { statName, newValue, oldValue, delta: newValue - oldValue };
    this._emit('change', event);
    if (queueForSync) {
      this._pendingChanges.push({ statName, newValue, oldValue, timestamp: Date.now() });
    }
  }

  /* ── Bulk Operations ── */

  /**
   * Apply multiple stat changes atomically.
   * @param {Object<string, number>} changes — { statName: delta }
   * @param {boolean} [queueForSync=true]
   */
  batch(changes, queueForSync = true) {
    const results = [];
    for (const [statName, delta] of Object.entries(changes)) {
      const def = STAT_DEFINITIONS[statName];
      if (!def) continue;
      const oldValue = this._stats.get(statName) || 0;
      const newValue = oldValue + delta;
      this._stats.set(statName, newValue);
      results.push({ statName, oldValue, newValue, delta });
      if (queueForSync) {
        this._pendingChanges.push({ statName, newValue, oldValue, timestamp: Date.now() });
      }
    }
    this._emit('batch', { changes: results });
    this._saveToStorage();
  }

  /**
   * Get all stats as a plain object.
   * @returns {Object<string, any>}
   */
  getAll() {
    const result = {};
    for (const [key, meta] of Object.entries(STAT_DEFINITIONS)) {
      result[key] = this._stats.get(key) ?? meta.default;
    }
    return result;
  }

  /**
   * Get stats filtered by category.
   * @param {string} category
   * @returns {Object<string, any>}
   */
  getByCategory(category) {
    const result = {};
    for (const [key, meta] of Object.entries(STAT_DEFINITIONS)) {
      if (meta.category === category) {
        result[key] = this._stats.get(key) ?? meta.default;
      }
    }
    return result;
  }

  /* ── Event System ── */

  /**
   * Subscribe to stat events.
   * @param {string} event — 'change' | 'batch' | 'sync' | 'playtime' | 'systemReady' | 'storageCleared' | 'serverMerge'
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
      try { cb(data); } catch (err) { console.error(`[ProfileStats] Event error (${event}):`, err); }
    });
  }

  /* ── Import / Export ── */

  /**
   * Export all stats as a serializable object.
   * @returns {Object}
   */
  exportState() {
    return {
      playerId: this.playerId,
      version: 7,
      stats: this.getAll(),
      frequency: {
        areas: Array.from(this._frequency.areas.entries()),
        emotes: Array.from(this._frequency.emotes.entries()),
      },
      pendingChanges: this._pendingChanges.length,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import stats from an external source. Local wins on numeric max for
   * counters; dates use newest.
   * @param {Object} state
   */
  importState(state) {
    if (!state || !state.stats) return;
    for (const [key, value] of Object.entries(state.stats)) {
      const def = STAT_DEFINITIONS[key];
      if (!def) continue;
      const local = this._stats.get(key);
      if (def.type === 'counter' || def.type === 'duration') {
        this._stats.set(key, Math.max(local || 0, value || 0));
      } else if (def.type === 'date') {
        if (!local || (value && new Date(value) > new Date(local))) {
          this._stats.set(key, value);
        }
      } else {
        this._stats.set(key, value);
      }
    }
    if (state.frequency) {
      if (state.frequency.areas) {
        state.frequency.areas.forEach(([k, v]) => {
          const cur = this._frequency.areas.get(k) || 0;
          this._frequency.areas.set(k, Math.max(cur, v));
        });
      }
      if (state.frequency.emotes) {
        state.frequency.emotes.forEach(([k, v]) => {
          const cur = this._frequency.emotes.get(k) || 0;
          this._frequency.emotes.set(k, Math.max(cur, v));
        });
      }
    }
    this._updateFavouriteArea();
    this._updateMostUsedEmote();
    this._saveToStorage();
    this._emit('importComplete', { playerId: this.playerId });
  }

  /**
   * Export profile data to a JSON blob for the player to download.
   * @returns {string} — JSON string
   */
  exportToJSON() {
    return JSON.stringify(this.exportState(), null, 2);
  }

  /**
   * Import profile data from a JSON blob.
   * @param {string} jsonString
   * @returns {boolean}
   */
  importFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      this.importState(data);
      return true;
    } catch (err) {
      console.error('[ProfileStats] Import failed:', err);
      return false;
    }
  }

  /* ── Admin / Debug ── */

  /**
   * Directly set a stat (admin override).
   * @param {string} statName
   * @param {any} value
   */
  adminSet(statName, value) {
    console.warn(`[ProfileStats] Admin set: ${statName} = ${value}`);
    this._stats.set(statName, value);
    this._saveToStorage();
  }

  /**
   * Reset a single stat to its default.
   * @param {string} statName
   */
  reset(statName) {
    const def = STAT_DEFINITIONS[statName];
    if (!def) return;
    this._stats.set(statName, def.default);
    this._saveToStorage();
  }

  /**
   * Reset ALL stats to defaults.
   */
  resetAll() {
    for (const [key, meta] of Object.entries(STAT_DEFINITIONS)) {
      this._stats.set(key, meta.default);
    }
    this._frequency.areas.clear();
    this._frequency.emotes.clear();
    this._pendingChanges = [];
    this._saveToStorage();
  }
}

/* --------------------------------------------------------------------------
 *  Formatting Helpers — pretty stat display for the profile UI
 * -------------------------------------------------------------------------- */

/**
 * Format a duration in seconds to a human-readable string.
 * @param {number} totalSeconds
 * @returns {string} — e.g. "2h 34m" or "45m 12s" or "12s"
 */
export function formatDuration(totalSeconds) {
  if (totalSeconds === 0 || totalSeconds == null) return '0s';
  const seconds = totalSeconds % 60;
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor((totalSeconds / 3600) % 24);
  const days = Math.floor(totalSeconds / 86400);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && days === 0) parts.push(`${seconds}s`);

  return parts.join(' ') || '0s';
}

/**
 * Format a duration with a friendly sentence.
 * @param {number} totalSeconds
 * @param {string} activity — e.g. "danced", "played"
 * @returns {string} — e.g. "You danced for 2h 34m!"
 */
export function formatDurationSentence(totalSeconds, activity = 'played') {
  const duration = formatDuration(totalSeconds);
  return `You ${activity} for ${duration}!`;
}

/**
 * Format a large number with locale-aware separators.
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  if (num == null) return '0';
  return num.toLocaleString();
}

/**
 * Format a coin amount with the coin icon prefix.
 * @param {number} coins
 * @returns {string}
 */
export function formatCoins(coins) {
  return `${formatNumber(coins)} coins`;
}

/**
 * Format a date string to a friendly relative time.
 * @param {string} isoDate
 * @returns {string}
 */
export function formatRelativeDate(isoDate) {
  if (!isoDate) return 'Never';
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Format a date to a full display string.
 * @param {string} isoDate
 * @returns {string}
 */
export function formatFullDate(isoDate) {
  if (!isoDate) return 'Unknown';
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

/**
 * Format a stat value according to its type definition.
 * @param {string} statName
 * @param {any} value
 * @returns {string}
 */
export function formatStatValue(statName, value) {
  const def = STAT_DEFINITIONS[statName];
  if (!def) return String(value);

  if (def.type === 'duration') {
    return formatDuration(value || 0);
  }
  if (def.type === 'date') {
    return formatRelativeDate(value);
  }
  if (def.type === 'counter') {
    return formatNumber(value || 0);
  }
  return String(value ?? '-');
}

/**
 * Build a fully-formatted stat card for the profile UI.
 * @param {ProfileStats} stats
 * @param {string} statName
 * @returns {Object} — { name, value, rawValue, formatted, category, label, icon }
 */
export function buildStatCard(stats, statName) {
  const def = STAT_DEFINITIONS[statName];
  if (!def) return null;
  const rawValue = stats.get(statName);
  return {
    name: statName,
    label: def.label,
    value: formatStatValue(statName, rawValue),
    rawValue,
    category: def.category,
    type: def.type,
  };
}

/**
 * Build the complete profile stats payload for UI rendering.
 * @param {ProfileStats} stats
 * @returns {Object}
 */
export function buildProfileStatsPayload(stats) {
  const all = stats.getAll();
  const categories = {};
  const cards = {};

  for (const [key, meta] of Object.entries(STAT_DEFINITIONS)) {
    if (!categories[meta.category]) categories[meta.category] = [];
    categories[meta.category].push(key);
    cards[key] = buildStatCard(stats, key);
  }

  return {
    raw: all,
    cards,
    categories,
    summary: {
      totalPlaytime: formatDuration(all.total_playtime_seconds || 0),
      totalLoginDays: formatNumber(all.total_login_days || 0),
      currentStreak: formatNumber(all.current_login_streak || 0),
      bestStreak: formatNumber(all.best_login_streak || 0),
      totalKisses: formatNumber(all.total_kisses || 0),
      totalMessages: formatNumber(all.total_messages_sent || 0),
      totalFriends: formatNumber(all.total_friends_made || 0),
      totalTrades: formatNumber(all.total_trade_count || 0),
      totalGamesWon: formatNumber(all.total_minigames_won || 0),
      totalChests: formatNumber(all.total_chests_opened || 0),
      totalEggs: formatNumber(all.total_eggs_hatched || 0),
      favouriteArea: all.favourite_area || 'None yet',
      mostUsedEmote: all.most_used_emote || 'None yet',
      firstLogin: formatFullDate(all.first_login_date),
      lastLogin: formatRelativeDate(all.last_login_date),
      memberSince: formatFullDate(all.first_login_date),
    },
  };
}

/* --------------------------------------------------------------------------
 *  Profile UI sentence generators
 * -------------------------------------------------------------------------- */

/**
 * Generate a fun, player-facing sentence about their dance time.
 * @param {ProfileStats} stats
 * @returns {string}
 */
export function generateDanceSentence(stats) {
  const seconds = stats.get('total_dance_seconds') || 0;
  return formatDurationSentence(seconds, 'danced');
}

/**
 * Generate a fun sentence about their playtime.
 * @param {ProfileStats} stats
 * @returns {string}
 */
export function generatePlaytimeSentence(stats) {
  const seconds = stats.get('total_playtime_seconds') || 0;
  return formatDurationSentence(seconds, 'played');
}

/**
 * Generate a fun sentence about their theatre time.
 * @param {ProfileStats} stats
 * @returns {string}
 */
export function generateTheatreSentence(stats) {
  const seconds = stats.get('total_theatre_seconds') || 0;
  return formatDurationSentence(seconds, 'watched videos');
}

/**
 * Generate a social summary sentence.
 * @param {ProfileStats} stats
 * @returns {string}
 */
export function generateSocialSummary(stats) {
  const friends = stats.get('total_friends_made') || 0;
  const messages = stats.get('total_messages_sent') || 0;
  const kisses = stats.get('total_kisses') || 0;
  const gifts = stats.get('total_gifts_given') || 0;

  if (friends >= 50) return `A true socialite with ${formatNumber(friends)} friends, ${formatNumber(messages)} messages, ${formatNumber(kisses)} kisses, and ${formatNumber(gifts)} gifts!`;
  if (friends >= 10) return `Building connections: ${formatNumber(friends)} friends and ${formatNumber(messages)} messages sent!`;
  return `Just getting started socially — ${formatNumber(messages)} messages sent so far!`;
}

/**
 * Generate a trading summary sentence.
 * @param {ProfileStats} stats
 * @returns {string}
 */
export function generateTradingSummary(stats) {
  const trades = stats.get('total_trade_count') || 0;
  const items = stats.get('total_items_traded') || 0;
  if (trades === 0) return 'No trades yet — time to make a deal!';
  return `${formatNumber(trades)} trades completed, ${formatNumber(items)} items exchanged!`;
}

/**
 * Generate an exploration summary sentence.
 * @param {ProfileStats} stats
 * @returns {string}
 */
export function generateExplorationSummary(stats) {
  const areas = stats.get('unique_areas_visited') || 0;
  const tiles = stats.get('total_tiles_walked') || 0;
  if (areas >= 14) return `Every corner of the Inn explored — all 14 areas and ${formatNumber(tiles)} tiles walked!`;
  return `${formatNumber(areas)} of 14 areas discovered, ${formatNumber(tiles)} tiles walked!`;
}

/**
 * Generate a collection summary sentence.
 * @param {ProfileStats} stats
 * @returns {string}
 */
export function generateCollectionSummary(stats) {
  const items = stats.get('total_unique_items_owned') || 0;
  const clothing = stats.get('total_clothing_owned') || 0;
  const furniture = stats.get('total_furniture_placed') || 0;
  return `${formatNumber(items)} items owned, ${formatNumber(clothing)} clothing pieces, ${formatNumber(furniture)} furniture placed!`;
}

/**
 * Generate a loyalty summary sentence.
 * @param {ProfileStats} stats
 * @returns {string}
 */
export function generateLoyaltySummary(stats) {
  const days = stats.get('total_login_days') || 0;
  const streak = stats.get('current_login_streak') || 0;
  const best = stats.get('best_login_streak') || 0;
  if (days >= 30) return `A dedicated Starlight citizen — ${formatNumber(days)} total login days, best streak of ${formatNumber(best)}!`;
  return `${formatNumber(days)} days visited, current streak: ${formatNumber(streak)}!`;
}

/**
 * Generate the full "About Me" paragraph for a player profile.
 * @param {ProfileStats} stats
 * @returns {string}
 */
export function generateAboutMe(stats) {
  const parts = [
    generatePlaytimeSentence(stats),
    generateSocialSummary(stats),
    generateExplorationSummary(stats),
    generateCollectionSummary(stats),
    generateLoyaltySummary(stats),
  ];
  return parts.join(' ');
}

/* --------------------------------------------------------------------------
 *  Milestone detection
 * -------------------------------------------------------------------------- */

/**
 * Detect which stats just crossed a fun milestone.
 * @param {string} statName
 * @param {number} newValue
 * @param {number} oldValue
 * @returns {Array<string>} — milestone messages
 */
export function detectMilestones(statName, newValue, oldValue) {
  const milestones = {
    total_kisses:        [1, 10, 50, 100, 500, 1000],
    total_messages_sent: [1, 100, 500, 1000, 5000, 10000],
    total_friends_made:  [1, 5, 10, 25, 50, 100],
    total_trade_count:   [1, 10, 50, 100, 200, 500],
    total_chests_opened: [1, 10, 50, 100, 200, 500],
    total_eggs_hatched:  [1, 5, 10, 25, 50, 100],
    total_minigames_won: [1, 5, 10, 25, 50, 100],
  };

  const thresholds = milestones[statName];
  if (!thresholds) return [];

  const crossed = thresholds.filter((t) => oldValue < t && newValue >= t);
  return crossed.map((t) => `Milestone: ${STAT_DEFINITIONS[statName]?.label || statName} reached ${formatNumber(t)}!`);
}

/* --------------------------------------------------------------------------
 *  Leaderboard helpers
 * -------------------------------------------------------------------------- */

/**
 * Compute a composite "star score" for leaderboard ranking.
 * @param {ProfileStats} stats
 * @returns {number}
 */
export function computeStarScore(stats) {
  const all = stats.getAll();
  let score = 0;
  score += (all.total_playtime_seconds || 0) * 0.001;
  score += (all.total_login_days || 0) * 10;
  score += (all.total_friends_made || 0) * 5;
  score += (all.total_messages_sent || 0) * 0.1;
  score += (all.total_trade_count || 0) * 3;
  score += (all.total_minigames_won || 0) * 5;
  score += (all.total_chests_opened || 0) * 1;
  score += (all.total_eggs_hatched || 0) * 2;
  score += (all.current_login_streak || 0) * 15;
  return Math.floor(score);
}

/**
 * Build a leaderboard entry object.
 * @param {ProfileStats} stats
 * @param {string} playerName
 * @returns {Object}
 */
export function buildLeaderboardEntry(stats, playerName) {
  const all = stats.getAll();
  return {
    playerId: stats.playerId,
    playerName,
    starScore: computeStarScore(stats),
    totalPlaytimeSeconds: all.total_playtime_seconds || 0,
    totalLoginDays: all.total_login_days || 0,
    currentStreak: all.current_login_streak || 0,
    bestStreak: all.best_login_streak || 0,
    totalFriends: all.total_friends_made || 0,
    totalMessages: all.total_messages_sent || 0,
  };
}

/* --------------------------------------------------------------------------
 *  Comparison helpers
 * -------------------------------------------------------------------------- */

/**
 * Compare two players' stats and highlight differences.
 * @param {Object} statsA — plain stat object from player A
 * @param {Object} statsB — plain stat object from player B
 * @returns {Object} — keyed by stat with { a, b, winner, diff }
 */
export function compareStats(statsA, statsB) {
  const result = {};
  for (const key of Object.keys(STAT_DEFINITIONS)) {
    const a = statsA[key] || 0;
    const b = statsB[key] || 0;
    const def = STAT_DEFINITIONS[key];
    if (def.type === 'counter' || def.type === 'duration') {
      const winner = a > b ? 'A' : b > a ? 'B' : 'tie';
      result[key] = { a, b, winner, diff: Math.abs(a - b) };
    } else {
      result[key] = { a, b, winner: 'tie', diff: 0 };
    }
  }
  return result;
}

/* --------------------------------------------------------------------------
 *  Admin / analytics helpers
 * -------------------------------------------------------------------------- */

/**
 * Get aggregate catalog info about all defined stats.
 * @returns {Object}
 */
export function getStatCatalogInfo() {
  const byCategory = {};
  const byType = {};
  for (const [key, meta] of Object.entries(STAT_DEFINITIONS)) {
    byCategory[meta.category] = (byCategory[meta.category] || 0) + 1;
    byType[meta.type] = (byType[meta.type] || 0) + 1;
  }
  return {
    totalStats: Object.keys(STAT_DEFINITIONS).length,
    byCategory,
    byType,
    statNames: Object.keys(STAT_DEFINITIONS),
  };
}

/**
 * Generate a daily activity report for a player.
 * @param {ProfileStats} stats
 * @returns {Object}
 */
export function generateDailyReport(stats) {
  const all = stats.getAll();
  return {
    date: new Date().toISOString(),
    playtimeToday: 'Tracked in session', // Would need session-level tracking
    currentStreak: all.current_login_streak || 0,
    totalStatsTracked: Object.keys(STAT_DEFINITIONS).length,
    topCategories: [
      { category: 'social', label: 'Social' },
      { category: 'exploration', label: 'Exploration' },
      { category: 'economy', label: 'Economy' },
      { category: 'games', label: 'Games' },
      { category: 'loyalty', label: 'Loyalty' },
    ].map((c) => ({
      ...c,
      stats: Object.entries(STAT_DEFINITIONS).filter(([, m]) => m.category === c.category).map(([k]) => k),
    })),
  };
}

/* --------------------------------------------------------------------------
 *  Default export
 * -------------------------------------------------------------------------- */
export default ProfileStats;
