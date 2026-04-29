/**
 * @file SeasonalContent.js
 * @description Seasonal limited-time content system for Starlight Inn v3.5.
 * Manages four rotating seasonal events (Christmas, Halloween, Easter, Tribal),
 * each with exclusive furniture sets, themed area decorations, limited emotes,
 * special currency bundles, seasonal achievements, and event calendar tracking.
 *
 * The system integrates with the game's dual-currency economy (Gold as premium
 * currency for seasonal items) and provides decoration configurations for the
 * WebGL ParticleSystemGPU renderer.
 *
 * @author Starlight Inn Team
 * @version 3.5.0
 * @since 2024-12-01
 */

// ============================================================
// CONSTANTS
// ============================================================

/** @constant {string} STORAGE_KEY - localStorage key for seasonal participation history */
const STORAGE_KEY = 'starlight_season_history';

/** @constant {string} ACHIEVEMENTS_KEY - localStorage key for seasonal achievement progress */
const ACHIEVEMENTS_KEY = 'starlight_season_achievements';

/** @constant {number} BASE_HOURLY_GOLD - Standard hourly Gold reward outside events */
const BASE_HOURLY_GOLD = 100;

/** @constant {number} EVENT_HOURLY_GOLD - Boosted hourly Gold reward during seasonal events */
const EVENT_HOURLY_GOLD = 150;

/** @constant {number} MS_PER_HOUR - Milliseconds in one hour */
const MS_PER_HOUR = 3600000;

/** @constant {number} MS_PER_DAY - Milliseconds in one day */
const MS_PER_DAY = 86400000;

/** @constant {number} PARTICLE_COUNT_DEFAULT - Default particle count for area decorations */
const PARTICLE_COUNT_DEFAULT = 200;

/** @constant {number} PARTICLE_COUNT_HIGH - High particle count for premium visual areas */
const PARTICLE_COUNT_HIGH = 400;

/** @constant {number} ACHIEVEMENT_GIFT_TARGET - Target gifts for "Christmas Spirit" achievement */
const ACHIEVEMENT_GIFT_TARGET = 10;

/** @constant {number} ACHIEVEMENT_UPPERCUT_TARGET - Target uppercuts for "Halloween Scare" */
const ACHIEVEMENT_UPPERCUT_TARGET = 50;

/** @constant {number} ACHIEVEMENT_EGG_TARGET - Target hidden eggs for "Egg Hunter" */
const ACHIEVEMENT_EGG_TARGET = 20;

/** @constant {number} ACHIEVEMENT_MINIGAME_TARGET - Target minigame wins for "Tribal Chief" */
const ACHIEVEMENT_MINIGAME_TARGET = 10;

/** @constant {number} ACHIEVEMENT_BONUS_GOLD - Gold awarded for completing any seasonal achievement */
const ACHIEVEMENT_BONUS_GOLD = 500;

/** @constant {string} SEASON_CHRISTMAS - Christmas season identifier */
const SEASON_CHRISTMAS = 'christmas';

/** @constant {string} SEASON_HALLOWEEN - Halloween season identifier */
const SEASON_HALLOWEEN = 'halloween';

/** @constant {string} SEASON_EASTER - Easter season identifier */
const SEASON_EASTER = 'easter';

/** @constant {string} SEASON_TRIBAL - Tribal season identifier */
const SEASON_TRIBAL = 'tribal';

// ============================================================
// SEASON DEFINITIONS
// ============================================================

/**
 * @constant {Object} SEASON_DEFINITIONS
 * @description Configuration for all four seasonal events.
 * Each season defines its date range, exclusive catalog items, emotes,
 * currency bundles, decoration config, and achievements.
 */
const SEASON_DEFINITIONS = {
  [SEASON_CHRISTMAS]: {
    id: SEASON_CHRISTMAS,
    name: 'Christmas',
    displayName: 'Winter Wonderland',
    startMonth: 12,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
    color: '#2E8B57',
    accentColor: '#FFD700',
    description: 'Celebrate the season with festive furniture and falling snow.',
    catalog: [
      { id: 'xm_tree_01', name: 'Evergreen Tree', type: 'furniture', price: 250, gold: true, seasonal: true, seasonId: SEASON_CHRISTMAS, availableUntil: null, category: 'decorative' },
      { id: 'xm_fireplace_01', name: 'Cozy Fireplace', type: 'furniture', price: 500, gold: true, seasonal: true, seasonId: SEASON_CHRISTMAS, availableUntil: null, category: 'interactive' },
      { id: 'xm_stockings_01', name: 'Holiday Stockings', type: 'furniture', price: 100, gold: true, seasonal: true, seasonId: SEASON_CHRISTMAS, availableUntil: null, category: 'wall' },
      { id: 'xm_table_01', name: 'Festive Feast Table', type: 'furniture', price: 350, gold: true, seasonal: true, seasonId: SEASON_CHRISTMAS, availableUntil: null, category: 'furniture' },
      { id: 'xm_lights_01', name: 'Twinkle Lights', type: 'furniture', price: 150, gold: true, seasonal: true, seasonId: SEASON_CHRISTMAS, availableUntil: null, category: 'lighting' },
      { id: 'xm_couch_01', name: 'Velvet Sofa (Red)', type: 'furniture', price: 400, gold: true, seasonal: true, seasonId: SEASON_CHRISTMAS, availableUntil: null, category: 'seating' },
      { id: 'xm_rug_01', name: 'Snowflake Rug', type: 'furniture', price: 175, gold: true, seasonal: true, seasonId: SEASON_CHRISTMAS, availableUntil: null, category: 'floor' },
    ],
    emotes: ['snowball', 'carol', 'gift', 'hotcocoa'],
    bundles: [
      { id: 'xm_bundle_small', name: 'Stocking Stuffer', gold: 300, priceUSD: 2.99, bonus: 0 },
      { id: 'xm_bundle_medium', name: 'Gift Box', gold: 750, priceUSD: 5.99, bonus: 50 },
      { id: 'xm_bundle_large', name: 'Santa Sack', gold: 2000, priceUSD: 14.99, bonus: 200 },
    ],
    decorations: {
      particleType: 'snow',
      particleCount: PARTICLE_COUNT_DEFAULT,
      particleColor: [1.0, 1.0, 1.0, 0.8],
      particleSize: [2, 5],
      fallSpeed: [0.5, 2.0],
      wind: [-0.3, 0.3],
      backgroundTint: [0.85, 0.92, 0.95, 0.15],
      ambientOverlay: '/assets/seasons/xm_overlay.png',
    },
    achievements: [
      { id: 'christmas_spirit', name: 'Christmas Spirit', description: `Gift ${ACHIEVEMENT_GIFT_TARGET} items to friends`, target: ACHIEVEMENT_GIFT_TARGET, statKey: 'giftsGiven', bonusGold: ACHIEVEMENT_BONUS_GOLD },
    ],
  },

  [SEASON_HALLOWEEN]: {
    id: SEASON_HALLOWEEN,
    name: 'Halloween',
    displayName: 'Spooky Nights',
    startMonth: 10,
    startDay: 15,
    endMonth: 11,
    endDay: 7,
    color: '#FF6600',
    accentColor: '#9932CC',
    description: 'Trick or treat with spooky decor and limited emotes.',
    catalog: [
      { id: 'hw_pumpkin_01', name: 'Jack-o-Lantern', type: 'furniture', price: 200, gold: true, seasonal: true, seasonId: SEASON_HALLOWEEN, availableUntil: null, category: 'decorative' },
      { id: 'hw_cauldron_01', name: 'Witch Cauldron', type: 'furniture', price: 450, gold: true, seasonal: true, seasonId: SEASON_HALLOWEEN, availableUntil: null, category: 'interactive' },
      { id: 'hw_throne_01', name: 'Vampire Throne', type: 'furniture', price: 600, gold: true, seasonal: true, seasonId: SEASON_HALLOWEEN, availableUntil: null, category: 'seating' },
      { id: 'hw_web_01', name: 'Cobweb Corners', type: 'furniture', price: 75, gold: true, seasonal: true, seasonId: SEASON_HALLOWEEN, availableUntil: null, category: 'wall' },
      { id: 'hw_lantern_01', name: 'Spooky Lanterns', type: 'furniture', price: 125, gold: true, seasonal: true, seasonId: SEASON_HALLOWEEN, availableUntil: null, category: 'lighting' },
      { id: 'hw_organ_01', name: 'Haunted Organ', type: 'furniture', price: 550, gold: true, seasonal: true, seasonId: SEASON_HALLOWEEN, availableUntil: null, category: 'interactive' },
      { id: 'hw_rug_01', name: 'Moonlit Path Rug', type: 'furniture', price: 180, gold: true, seasonal: true, seasonId: SEASON_HALLOWEEN, availableUntil: null, category: 'floor' },
    ],
    emotes: ['ghost', 'uppercut', 'cackle', 'spook'],
    bundles: [
      { id: 'hw_bundle_small', name: 'Treat Bag', gold: 300, priceUSD: 2.99, bonus: 0 },
      { id: 'hw_bundle_medium', name: 'Creepy Crate', gold: 750, priceUSD: 5.99, bonus: 50 },
      { id: 'hw_bundle_large', name: 'Haunted Hoard', gold: 2000, priceUSD: 14.99, bonus: 200 },
    ],
    decorations: {
      particleType: 'leaves',
      particleCount: PARTICLE_COUNT_DEFAULT,
      particleColor: [1.0, 0.4, 0.0, 0.7],
      particleSize: [3, 8],
      fallSpeed: [0.3, 1.5],
      wind: [-0.5, 0.5],
      backgroundTint: [0.1, 0.05, 0.15, 0.2],
      ambientOverlay: '/assets/seasons/hw_overlay.png',
    },
    achievements: [
      { id: 'halloween_scare', name: 'Halloween Scare', description: `Use the Uppercut emote ${ACHIEVEMENT_UPPERCUT_TARGET} times`, target: ACHIEVEMENT_UPPERCUT_TARGET, statKey: 'uppercutsUsed', bonusGold: ACHIEVEMENT_BONUS_GOLD },
    ],
  },

  [SEASON_EASTER]: {
    id: SEASON_EASTER,
    name: 'Easter',
    displayName: 'Spring Bloom',
    startMonth: 3,
    startDay: 20,
    endMonth: 4,
    endDay: 20,
    color: '#FFB6C1',
    accentColor: '#98FB98',
    description: 'Spring into action with cherry blossoms and hidden egg hunts.',
    catalog: [
      { id: 'ea_basket_01', name: 'Egg Basket', type: 'furniture', price: 150, gold: true, seasonal: true, seasonId: SEASON_EASTER, availableUntil: null, category: 'decorative' },
      { id: 'ea_fountain_01', name: 'Bunny Fountain', type: 'furniture', price: 500, gold: true, seasonal: true, seasonId: SEASON_EASTER, availableUntil: null, category: 'interactive' },
      { id: 'ea_swing_01', name: 'Garden Swing', type: 'furniture', price: 450, gold: true, seasonal: true, seasonId: SEASON_EASTER, availableUntil: null, category: 'seating' },
      { id: 'ea_garden_01', name: 'Tulip Planter', type: 'furniture', price: 125, gold: true, seasonal: true, seasonId: SEASON_EASTER, availableUntil: null, category: 'decorative' },
      { id: 'ea_lights_01', name: 'Butterfly Lights', type: 'furniture', price: 175, gold: true, seasonal: true, seasonId: SEASON_EASTER, availableUntil: null, category: 'lighting' },
      { id: 'ea_bed_01', name: 'Flower Canopy Bed', type: 'furniture', price: 600, gold: true, seasonal: true, seasonId: SEASON_EASTER, availableUntil: null, category: 'furniture' },
      { id: 'ea_path_01', name: 'Stepping Stones', type: 'furniture', price: 90, gold: true, seasonal: true, seasonId: SEASON_EASTER, availableUntil: null, category: 'floor' },
    ],
    emotes: ['bunnyhop', 'bloom', 'egghunt', 'butterfly'],
    bundles: [
      { id: 'ea_bundle_small', name: 'Egg Basket', gold: 300, priceUSD: 2.99, bonus: 0 },
      { id: 'ea_bundle_medium', name: 'Spring Crate', gold: 750, priceUSD: 5.99, bonus: 50 },
      { id: 'ea_bundle_large', name: 'Garden Hoard', gold: 2000, priceUSD: 14.99, bonus: 200 },
    ],
    decorations: {
      particleType: 'petals',
      particleCount: PARTICLE_COUNT_HIGH,
      particleColor: [1.0, 0.7, 0.8, 0.7],
      particleSize: [2, 6],
      fallSpeed: [0.2, 1.0],
      wind: [-0.2, 0.5],
      backgroundTint: [0.95, 0.85, 0.9, 0.1],
      ambientOverlay: '/assets/seasons/ea_overlay.png',
    },
    achievements: [
      { id: 'egg_hunter', name: 'Egg Hunter', description: `Find ${ACHIEVEMENT_EGG_TARGET} hidden eggs`, target: ACHIEVEMENT_EGG_TARGET, statKey: 'eggsFound', bonusGold: ACHIEVEMENT_BONUS_GOLD },
    ],
  },

  [SEASON_TRIBAL]: {
    id: SEASON_TRIBAL,
    name: 'Tribal',
    displayName: 'Tribal Council',
    startMonth: 6,
    startDay: 15,
    endMonth: 7,
    endDay: 15,
    color: '#D2691E',
    accentColor: '#F4A460',
    description: 'Join the tribe with tribal masks, totems, and minigame challenges.',
    catalog: [
      { id: 'tr_totem_01', name: 'Spirit Totem', type: 'furniture', price: 400, gold: true, seasonal: true, seasonId: SEASON_TRIBAL, availableUntil: null, category: 'decorative' },
      { id: 'tr_mask_01', name: 'Ceremonial Mask', type: 'furniture', price: 300, gold: true, seasonal: true, seasonId: SEASON_TRIBAL, availableUntil: null, category: 'wall' },
      { id: 'tr_thatch_01', name: 'Thatch Rug', type: 'furniture', price: 150, gold: true, seasonal: true, seasonId: SEASON_TRIBAL, availableUntil: null, category: 'floor' },
      { id: 'tr_torch_01', name: 'Tiki Torches', type: 'furniture', price: 175, gold: true, seasonal: true, seasonId: SEASON_TRIBAL, availableUntil: null, category: 'lighting' },
      { id: 'tr_drum_01', name: 'Ceremonial Drum', type: 'furniture', price: 350, gold: true, seasonal: true, seasonId: SEASON_TRIBAL, availableUntil: null, category: 'interactive' },
      { id: 'tr_canoe_01', name: 'Decorative Canoe', type: 'furniture', price: 500, gold: true, seasonal: true, seasonId: SEASON_TRIBAL, availableUntil: null, category: 'furniture' },
      { id: 'tr_chair_01', name: 'Woven Throne', type: 'furniture', price: 375, gold: true, seasonal: true, seasonId: SEASON_TRIBAL, availableUntil: null, category: 'seating' },
    ],
    emotes: ['tribaldance', 'chant', 'challenge', 'victorycry'],
    bundles: [
      { id: 'tr_bundle_small', name: 'Ritual Pouch', gold: 300, priceUSD: 2.99, bonus: 0 },
      { id: 'tr_bundle_medium', name: 'Tribe Crate', gold: 750, priceUSD: 5.99, bonus: 50 },
      { id: 'tr_bundle_large', name: 'Chief Hoard', gold: 2000, priceUSD: 14.99, bonus: 200 },
    ],
    decorations: {
      particleType: 'embers',
      particleCount: PARTICLE_COUNT_DEFAULT,
      particleColor: [1.0, 0.6, 0.1, 0.8],
      particleSize: [1, 4],
      fallSpeed: [0.8, 2.5],
      wind: [-0.1, 0.4],
      backgroundTint: [0.2, 0.1, 0.05, 0.12],
      ambientOverlay: '/assets/seasons/tr_overlay.png',
    },
    achievements: [
      { id: 'tribal_chief', name: 'Tribal Chief', description: `Win ${ACHIEVEMENT_MINIGAME_TARGET} minigames`, target: ACHIEVEMENT_MINIGAME_TARGET, statKey: 'minigamesWon', bonusGold: ACHIEVEMENT_BONUS_GOLD },
    ],
  },
};

// ============================================================
// SEASONAL CONTENT CLASS
// ============================================================

/**
 * @class SeasonalContent
 * @classdesc Manages seasonal limited-time content for Starlight Inn.
 * Handles season detection, themed catalogs, area decorations, currency
 * bonuses, countdown timers, participation tracking, and seasonal achievements.
 *
 * @example
 * const seasons = new SeasonalContent(game);
 * const activeSeason = seasons.getCurrentSeason();
 * if (activeSeason) {
 *   const catalog = seasons.getSeasonalCatalog();
 *   const decorations = seasons.getAreaDecorations();
 * }
 */
class SeasonalContent {
  /**
   * @description Creates an instance of SeasonalContent.
   * @param {Object} game - The main game instance for accessing currency, player data, and event bus.
   * @param {Object} game.player - Player data object.
   * @param {Object} game.currency - Currency system with addGold() and balance properties.
   * @param {Object} game.eventBus - Event bus for publishing season change events.
   * @param {Function} game.now - Optional override for getting current time (for testing).
   */
  constructor(game) {
    /** @private @type {Object} */
    this._game = game;

    /** @private @type {Object} */
    this._seasonDefinitions = SEASON_DEFINITIONS;

    /** @private @type {?string} - Currently cached active season ID */
    this._cachedSeason = null;

    /** @private @type {number} - Timestamp of last cache update */
    this._cacheTimestamp = 0;

    /** @private @type {number} - Cache validity in ms */
    this._cacheDuration = 60000;

    /** @private @type {Object} - In-memory participation history map: seasonId -> yearSet */
    this._participationHistory = this._loadHistory();

    /** @private @type {Object} - Achievement progress: achievementId -> { current, completed, completedAt } */
    this._achievementProgress = this._loadAchievements();

    /** @private @type {Object} - Session stat counters for active season achievements */
    this._sessionStats = {};

    /** @private @type {number} - Timestamp when current season was first detected this session */
    this._sessionStartTime = 0;

    /** @private @type {Function} - Bound update handler for setInterval */
    this._boundUpdate = this._update.bind(this);

    /** @private @type {?number} - Interval ID for auto-update */
    this._updateInterval = null;

    /** @private @type {Array<Function>} - Event listeners for season changes */
    this._seasonChangeListeners = [];

    // Initialize session stats and start auto-update
    this._initializeStats();
    this._startAutoUpdate();

    // Record participation if a season is currently active
    this._recordCurrentParticipation();
  }

  // ============================================================
  // PUBLIC API - Season Detection
  // ============================================================

  /**
   * @description Returns the currently active season definition or null.
   * Uses a 60-second cache to avoid repeated calculations.
   * @returns {?Object} The active season definition object, or null if no season is active.
   */
  getCurrentSeason() {
    const now = this._getNow();
    if (now - this._cacheTimestamp < this._cacheDuration && this._cachedSeason !== undefined) {
      return this._cachedSeason ? this._seasonDefinitions[this._cachedSeason] : null;
    }

    const seasonId = this._detectActiveSeason();
    this._cachedSeason = seasonId;
    this._cacheTimestamp = now;

    if (seasonId && this._sessionStartTime === 0) {
      this._sessionStartTime = now;
    }

    return seasonId ? this._seasonDefinitions[seasonId] : null;
  }

  /**
   * @description Returns the progress ratio (0.0 to 1.0) of the current season.
   * 0.0 = season just started, 1.0 = season just ended.
   * @returns {number} Progress ratio from 0 to 1. Returns 0 if no season is active.
   */
  getSeasonProgress() {
    const season = this.getCurrentSeason();
    if (!season) return 0;

    const now = this._getNow();
    const { startTs, endTs } = this._getSeasonTimestamps(season, now);

    if (now <= startTs) return 0;
    if (now >= endTs) return 1;

    const total = endTs - startTs;
    const elapsed = now - startTs;
    return Math.min(1, Math.max(0, elapsed / total));
  }

  /**
   * @description Returns a countdown object showing time remaining until the current season ends.
   * Auto-updates each second via the internal tick system.
   * @returns {Object} Countdown object with days, hours, minutes, totalMs.
   * @returns {number} return.days - Full days remaining.
   * @returns {number} return.hours - Full hours remaining (0-23).
   * @returns {number} return.minutes - Full minutes remaining (0-59).
   * @returns {number} return.totalMs - Total milliseconds remaining.
   * @returns {Object} return.empty - True when countdown reaches zero.
   */
  getCountdown() {
    const season = this.getCurrentSeason();
    if (!season) {
      return { days: 0, hours: 0, minutes: 0, totalMs: 0, empty: true };
    }

    const now = this._getNow();
    const { endTs } = this._getSeasonTimestamps(season, now);
    const remaining = Math.max(0, endTs - now);

    const days = Math.floor(remaining / MS_PER_DAY);
    const hours = Math.floor((remaining % MS_PER_DAY) / MS_PER_HOUR);
    const minutes = Math.floor((remaining % MS_PER_HOUR) / 60000);

    return {
      days,
      hours,
      minutes,
      totalMs: remaining,
      empty: remaining <= 0,
    };
  }

  // ============================================================
  // PUBLIC API - Catalog
  // ============================================================

  /**
   * @description Returns the seasonal catalog for the currently active season.
   * Items are tagged with seasonal: true, seasonId, and availableUntil timestamp.
   * Prices are in Gold (premium currency).
   * @returns {Array<Object>} Array of catalog item objects. Empty array if no season active.
   */
  getSeasonalCatalog() {
    const season = this.getCurrentSeason();
    if (!season) return [];

    const now = this._getNow();
    const { endTs } = this._getSeasonTimestamps(season, now);

    return season.catalog.map(item => ({
      ...item,
      availableUntil: endTs,
      currency: 'gold',
    }));
  }

  /**
   * @description Returns the list of limited emotes available during the current season.
   * @returns {Array<string>} Array of emote identifier strings. Empty if no season active.
   */
  getSeasonalEmotes() {
    const season = this.getCurrentSeason();
    return season ? [...season.emotes] : [];
  }

  /**
   * @description Returns special currency bundles available for the current season.
   * @returns {Array<Object>} Array of bundle objects with id, name, gold amount, priceUSD, and bonus gold.
   */
  getCurrencyBundles() {
    const season = this.getCurrentSeason();
    return season ? season.bundles.map(b => ({ ...b })) : [];
  }

  /**
   * @description Returns the current hourly Gold reward rate.
   * Boosted to 150/hr during seasonal events, 100/hr normally.
   * @returns {number} Gold per hour reward amount.
   */
  getHourlyGoldRate() {
    return this.getCurrentSeason() ? EVENT_HOURLY_GOLD : BASE_HOURLY_GOLD;
  }

  /**
   * @description Checks if the current hourly Gold rate is boosted (event active).
   * Used by the UI to show special treatment during events.
   * @returns {boolean} True if the hourly Gold rate is boosted.
   */
  isGoldBoosted() {
    return this.getCurrentSeason() !== null;
  }

  // ============================================================
  // PUBLIC API - Area Decorations
  // ============================================================

  /**
   * @description Returns decoration configuration for the ParticleSystemGPU
   * for the currently active season's themed area overlays.
   *
   * Config includes particle type, count, colors, physics parameters,
   * and background tint suitable for WebGL rendering.
   *
   * @returns {Object|null} Decoration configuration object, or null if no season active.
   * @returns {string} return.particleType - Type of particle ('snow', 'leaves', 'petals', 'embers').
   * @returns {number} return.particleCount - Number of particles to spawn.
   * @returns {Float32Array} return.particleColors - RGBA color array.
   * @returns {Object} return.physics - Physics parameters (fallSpeed, wind, size).
   * @returns {Float32Array} return.backgroundTint - Screen tint color overlay.
   * @returns {string} return.ambientOverlay - Path to ambient texture overlay.
   */
  getAreaDecorations() {
    const season = this.getCurrentSeason();
    if (!season) return null;

    const d = season.decorations;
    return {
      particleType: d.particleType,
      particleCount: d.particleCount,
      particleColors: new Float32Array(d.particleColor),
      physics: {
        fallSpeedMin: d.fallSpeed[0],
        fallSpeedMax: d.fallSpeed[1],
        windMin: d.wind[0],
        windMax: d.wind[1],
        sizeMin: d.particleSize[0],
        sizeMax: d.particleSize[1],
      },
      backgroundTint: new Float32Array(d.backgroundTint),
      ambientOverlay: d.ambientOverlay,
      seasonId: season.id,
    };
  }

  // ============================================================
  // PUBLIC API - Participation History
  // ============================================================

  /**
   * @description Returns the player's participation history across all seasons.
   * Each entry includes season ID, year, and first-seen timestamp.
   * @returns {Array<Object>} Array of participation record objects.
   * @returns {string} return[].seasonId - The season identifier.
   * @returns {number} return[].year - The year of participation.
   * @returns {number} return[].firstSeenAt - Timestamp of first participation.
   */
  getParticipationHistory() {
    const history = [];
    for (const [seasonId, years] of Object.entries(this._participationHistory)) {
      for (const [year, data] of Object.entries(years)) {
        history.push({
          seasonId,
          year: parseInt(year, 10),
          firstSeenAt: data.firstSeenAt,
        });
      }
    }
    return history.sort((a, b) => b.firstSeenAt - a.firstSeenAt);
  }

  /**
   * @description Checks if the player has participated in a given season before.
   * @param {string} seasonId - The season identifier to check.
   * @returns {boolean} True if the player has participated in this season type before.
   */
  hasParticipatedIn(seasonId) {
    return !!this._participationHistory[seasonId];
  }

  // ============================================================
  // PUBLIC API - Seasonal Achievements
  // ============================================================

  /**
   * @description Returns all achievement data for the currently active season,
   * including current progress and completion status.
   * @returns {Array<Object>} Array of achievement objects with progress data.
   */
  getSeasonalAchievements() {
    const season = this.getCurrentSeason();
    if (!season) return [];

    return season.achievements.map(ach => {
      const progress = this._achievementProgress[ach.id] || { current: 0, completed: false, completedAt: null };
      return {
        ...ach,
        current: Math.min(progress.current, ach.target),
        completed: progress.completed,
        completedAt: progress.completedAt,
        progressRatio: Math.min(1, progress.current / ach.target),
      };
    });
  }

  /**
   * @description Increments a session stat counter for achievement tracking.
   * Called by game systems when relevant actions occur.
   * @param {string} statKey - The stat key to increment (e.g., 'giftsGiven', 'uppercutsUsed').
   * @param {number} [amount=1] - Amount to increment by.
   */
  incrementStat(statKey, amount = 1) {
    if (!statKey || typeof amount !== 'number') return;

    this._sessionStats[statKey] = (this._sessionStats[statKey] || 0) + amount;

    // Check for achievement completions
    this._checkAchievements();
  }

  /**
   * @description Returns the current value of a session stat.
   * @param {string} statKey - The stat key to retrieve.
   * @returns {number} Current stat value, or 0 if not tracked.
   */
  getStat(statKey) {
    return this._sessionStats[statKey] || 0;
  }

  // ============================================================
  // PUBLIC API - Event Calendar
  // ============================================================

  /**
   * @description Returns the next 3 upcoming seasonal events with their start dates.
   * Events are calculated for the current year and next year to ensure
   * we always find upcoming events even if all events this year have passed.
   * @returns {Array<Object>} Array of upcoming event objects.
   * @returns {string} return[].seasonId - Season identifier.
   * @returns {string} return[].name - Display name of the season.
   * @returns {number} return[].startTimestamp - Unix timestamp (ms) when the season starts.
   * @returns {number} return[].endTimestamp - Unix timestamp (ms) when the season ends.
   * @returns {number} return[].daysUntil - Number of days until the season starts.
   */
  getUpcomingEvents() {
    const now = this._getNow();
    const currentYear = new Date(now).getFullYear();
    const events = [];

    // Collect all events for current year and next year
    for (const season of Object.values(this._seasonDefinitions)) {
      for (const year of [currentYear, currentYear + 1]) {
        const { startTs, endTs } = this._getSeasonTimestamps(season, now, year);

        // Skip events that have already ended
        if (endTs <= now) continue;

        const daysUntil = Math.max(0, Math.ceil((startTs - now) / MS_PER_DAY));

        events.push({
          seasonId: season.id,
          name: season.displayName,
          startTimestamp: startTs,
          endTimestamp: endTs,
          daysUntil,
          isActive: startTs <= now && endTs > now,
        });
      }
    }

    // Sort by start date, return first 3
    return events
      .sort((a, b) => a.startTimestamp - b.startTimestamp)
      .slice(0, 3);
  }

  // ============================================================
  // PUBLIC API - Lifecycle & Events
  // ============================================================

  /**
   * @description Registers a callback to be invoked when the active season changes.
   * @param {Function} callback - Function to call with (newSeason, oldSeason).
   */
  onSeasonChange(callback) {
    if (typeof callback === 'function') {
      this._seasonChangeListeners.push(callback);
    }
  }

  /**
   * @description Removes a previously registered season change listener.
   * @param {Function} callback - The callback function to remove.
   */
  offSeasonChange(callback) {
    this._seasonChangeListeners = this._seasonChangeListeners.filter(cb => cb !== callback);
  }

  /**
   * @description Disposes the seasonal content system, clearing intervals and saving state.
   * Call this when the game shuts down.
   */
  dispose() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
    this._saveHistory();
    this._saveAchievements();
    this._seasonChangeListeners = [];
  }

  // ============================================================
  // PUBLIC API - Force/Override (for debug/testing)
  // ============================================================

  /**
   * @description Forces a specific season to be treated as active (for debug/testing).
   * Pass null to clear the override.
   * @param {?string} seasonId - The season ID to force, or null to clear.
   */
  forceSeason(seasonId) {
    if (seasonId === null) {
      this._forcedSeason = null;
    } else if (this._seasonDefinitions[seasonId]) {
      this._forcedSeason = seasonId;
    }
    // Clear cache to force recalculation
    this._cacheTimestamp = 0;
    this._recordCurrentParticipation();
  }

  /**
   * @description Returns all season definitions for debug/inspection.
   * @returns {Object} All season definition objects keyed by season ID.
   */
  getAllSeasonDefinitions() {
    return JSON.parse(JSON.stringify(this._seasonDefinitions));
  }

  // ============================================================
  // PRIVATE METHODS - Detection & Timing
  // ============================================================

  /**
   * @private
   * @description Returns the current timestamp. Uses game override for testing if available.
   * @returns {number} Current timestamp in milliseconds.
   */
  _getNow() {
    if (this._game && typeof this._game.now === 'function') {
      return this._game.now();
    }
    return Date.now();
  }

  /**
   * @private
   * @description Detects which season is currently active based on today's date.
   * Checks all season definitions against the current month/day.
   * @returns {?string} The active season ID, or null if no season is active.
   */
  _detectActiveSeason() {
    // Respect debug override
    if (this._forcedSeason !== undefined && this._forcedSeason !== null) {
      return this._forcedSeason;
    }

    const now = this._getNow();
    const date = new Date(now);
    const month = date.getMonth() + 1; // 1-indexed
    const day = date.getDate();

    for (const [seasonId, def] of Object.entries(this._seasonDefinitions)) {
      if (this._isDateInRange(month, day, def.startMonth, def.startDay, def.endMonth, def.endDay)) {
        return seasonId;
      }
    }

    return null;
  }

  /**
   * @private
   * @description Checks if a given date falls within a season's date range.
   * Handles ranges that wrap around year boundaries (e.g., Dec-Jan).
   * @param {number} month - Current month (1-12).
   * @param {number} day - Current day (1-31).
   * @param {number} startMonth - Season start month (1-12).
   * @param {number} startDay - Season start day (1-31).
   * @param {number} endMonth - Season end month (1-12).
   * @param {number} endDay - Season end day (1-31).
   * @returns {boolean} True if the date is within the season range.
   */
  _isDateInRange(month, day, startMonth, startDay, endMonth, endDay) {
    const current = month * 100 + day;
    const start = startMonth * 100 + startDay;
    const end = endMonth * 100 + endDay;

    if (start <= end) {
      // Normal range within same year (e.g., Jun 15 - Jul 15)
      return current >= start && current <= end;
    }
    // Wrapping range (e.g., Dec 1 - Jan 15) - shouldn't happen with our definitions
    // but handled for robustness
    return current >= start || current <= end;
  }

  /**
   * @private
   * @description Calculates the absolute start and end timestamps for a season
   * in a given year context.
   * @param {Object} season - The season definition.
   * @param {number} referenceNow - Reference timestamp for year calculation.
   * @param {number} [year] - Optional explicit year. Defaults to current or previous year based on reference.
   * @returns {Object} Object with startTs and endTimestamps.
   */
  _getSeasonTimestamps(season, referenceNow, year) {
    const refDate = new Date(referenceNow);
    const currentYear = year || refDate.getFullYear();

    // For seasons that might have ended (like Christmas in January),
    // we need to determine the correct year
    let targetYear = currentYear;

    if (!year) {
      // If the season started last year and extends into this year,
      // check if we should use last year's occurrence
      const startMonthDay = season.startMonth * 100 + season.startDay;
      const endMonthDay = season.endMonth * 100 + season.endDay;
      const currentMonthDay = (refDate.getMonth() + 1) * 100 + refDate.getDate();

      if (endMonthDay < startMonthDay && currentMonthDay <= endMonthDay) {
        // Season wraps year boundary and we're in the tail end
        targetYear = currentYear - 1;
      }
    }

    const startTs = Date.UTC(targetYear, season.startMonth - 1, season.startDay, 0, 0, 0, 0);
    let endYear = targetYear;

    // If end month is before start month, the season wraps to next year
    if (season.endMonth < season.startMonth) {
      endYear = targetYear + 1;
    } else if (season.endMonth === season.startMonth && season.endDay < season.startDay) {
      endYear = targetYear + 1;
    }

    // End timestamp is inclusive of the full end day
    const endTs = Date.UTC(endYear, season.endMonth - 1, season.endDay, 23, 59, 59, 999);

    return { startTs, endTs };
  }

  // ============================================================
  // PRIVATE METHODS - Persistence
  // ============================================================

  /**
   * @private
   * @description Loads participation history from localStorage.
   * @returns {Object} Parsed history object, or empty object if none exists.
   */
  _loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[SeasonalContent] Failed to load history:', err);
    }
    return {};
  }

  /**
   * @private
   * @description Saves participation history to localStorage.
   */
  _saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._participationHistory));
    } catch (err) {
      console.warn('[SeasonalContent] Failed to save history:', err);
    }
  }

  /**
   * @private
   * @description Loads achievement progress from localStorage.
   * @returns {Object} Parsed achievement progress object.
   */
  _loadAchievements() {
    try {
      const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[SeasonalContent] Failed to load achievements:', err);
    }
    return {};
  }

  /**
   * @private
   * @description Saves achievement progress to localStorage.
   */
  _saveAchievements() {
    try {
      localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(this._achievementProgress));
    } catch (err) {
      console.warn('[SeasonalContent] Failed to save achievements:', err);
    }
  }

  // ============================================================
  // PRIVATE METHODS - Stats & Achievements
  // ============================================================

  /**
   * @private
   * @description Initializes all session stat counters to zero.
   */
  _initializeStats() {
    const allStatKeys = [
      'giftsGiven',
      'uppercutsUsed',
      'eggsFound',
      'minigamesWon',
    ];
    for (const key of allStatKeys) {
      this._sessionStats[key] = 0;
    }
  }

  /**
   * @private
   * @description Records participation in the currently active season.
   * Called during initialization and season changes.
   */
  _recordCurrentParticipation() {
    const season = this.getCurrentSeason();
    if (!season) return;

    const now = this._getNow();
    const year = new Date(now).getFullYear();

    if (!this._participationHistory[season.id]) {
      this._participationHistory[season.id] = {};
    }

    if (!this._participationHistory[season.id][year]) {
      this._participationHistory[season.id][year] = {
        firstSeenAt: now,
      };
      this._saveHistory();

      // Publish event
      this._publishEvent('season:firstParticipation', { seasonId: season.id, year });
    }
  }

  /**
   * @private
   * @description Checks all active season achievements against current stats.
   * Awards Gold and marks achievements complete when targets are reached.
   */
  _checkAchievements() {
    const season = this.getCurrentSeason();
    if (!season) return;

    for (const ach of season.achievements) {
      const progress = this._achievementProgress[ach.id] || { current: 0, completed: false, completedAt: null };

      if (progress.completed) continue;

      // Update progress from session stats
      const statValue = this._sessionStats[ach.statKey] || 0;
      progress.current = Math.max(progress.current, statValue);

      if (progress.current >= ach.target) {
        progress.completed = true;
        progress.completedAt = this._getNow();

        // Award bonus Gold
        this._awardGold(ach.bonusGold, `Achievement: ${ach.name}`);

        // Publish achievement event
        this._publishEvent('season:achievementComplete', { achievementId: ach.id, name: ach.name, bonusGold: ach.bonusGold });
      }

      this._achievementProgress[ach.id] = progress;
    }

    this._saveAchievements();
  }

  /**
   * @private
   * @description Awards Gold to the player via the game's currency system.
   * @param {number} amount - Amount of Gold to award.
   * @param {string} reason - Human-readable reason for the award.
   */
  _awardGold(amount, reason) {
    try {
      if (this._game && this._game.currency && typeof this._game.currency.addGold === 'function') {
        this._game.currency.addGold(amount, reason);
      } else {
        // Fallback: try to award through event bus
        this._publishEvent('currency:awardGold', { amount, reason });
      }
    } catch (err) {
      console.error('[SeasonalContent] Failed to award Gold:', err);
    }
  }

  /**
   * @private
   * @description Publishes an event to the game's event bus if available.
   * @param {string} eventName - The event name.
   * @param {Object} data - Event payload data.
   */
  _publishEvent(eventName, data) {
    try {
      if (this._game && this._game.eventBus) {
        this._game.eventBus.emit(eventName, data);
      }
    } catch (err) {
      // Silently fail if event bus is not available
    }
  }

  // ============================================================
  // PRIVATE METHODS - Auto-Update
  // ============================================================

  /**
   * @private
   * @description Starts the auto-update interval for countdown and season change detection.
   * Runs every 10 seconds to detect season boundaries.
   */
  _startAutoUpdate() {
    if (this._updateInterval) return;

    // Check every 10 seconds for season changes
    this._updateInterval = setInterval(this._boundUpdate, 10000);
  }

  /**
   * @private
   * @description Periodic update handler. Checks for season changes and updates state.
   */
  _update() {
    const previousSeason = this._cachedSeason;
    const now = this._getNow();

    // Force cache refresh
    this._cacheTimestamp = 0;
    const currentSeason = this._detectActiveSeason();
    this._cachedSeason = currentSeason;
    this._cacheTimestamp = now;

    // Detect season change
    if (currentSeason !== previousSeason) {
      const newSeasonData = currentSeason ? this._seasonDefinitions[currentSeason] : null;
      const oldSeasonData = previousSeason ? this._seasonDefinitions[previousSeason] : null;

      // Notify listeners
      for (const listener of this._seasonChangeListeners) {
        try {
          listener(newSeasonData, oldSeasonData);
        } catch (err) {
          console.warn('[SeasonalContent] Season change listener error:', err);
        }
      }

      // Publish event
      this._publishEvent('season:change', {
        newSeason: currentSeason,
        oldSeason: previousSeason,
      });

      // Record participation if entering a season
      if (currentSeason) {
        this._sessionStartTime = now;
        this._recordCurrentParticipation();
      }
    }
  }
}

// ============================================================
// EXPORT
// ============================================================

export default SeasonalContent;
