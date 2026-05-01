/**
 * Starlight Inn v7.0 - AchievementSystem.js
 * Comprehensive achievement engine with 30+ achievements, tiered rewards,
 * progress tracking, and social motivation hooks.
 *
 * @module profile/AchievementSystem
 * @version 7.0.0
 * @author Starlight Inn Team
 */

'use strict';

/**
 * Achievement tier enum — Bronze → Silver → Gold → Platinum.
 * Each tier unlocks progressively greater rewards and prestige.
 * @readonly
 * @enum {string}
 */
export const AchievementTier = Object.freeze({
  BRONZE:   'Bronze',
  SILVER:   'Silver',
  GOLD:     'Gold',
  PLATINUM: 'Platinum',
});

/**
 * Reward type enum — determines how a reward is granted.
 * @readonly
 * @enum {string}
 */
export const RewardType = Object.freeze({
  COINS:    'coins',
  XP:       'xp',
  ITEM:     'item',
  BADGE:    'badge',
  TITLE:    'title',
  ROOM:     'room',
  PREMIUM:  'premium',
});

/**
 * Deep-freeze helper to make achievement definitions immutable at runtime.
 * @param {Object} obj
 * @returns {Object}
 */
function deepFreeze(obj) {
  Object.keys(obj).forEach((key) => {
    if (obj[key] && typeof obj[key] === 'object') {
      deepFreeze(obj[key]);
    }
  });
  return Object.freeze(obj);
}

/* --------------------------------------------------------------------------
 *  Achievement Registry — 30+ achievements with full metadata
 * -------------------------------------------------------------------------- */

/**
 * The master achievement catalog.  Each entry defines:
 *   id, name, description, iconKey, requirement, reward, tier,
 *   category, isSecret, and optional prerequisiteId.
 */
export const ACHIEVEMENT_CATALOG = deepFreeze({

  /* ── Movement & Exploration ── */

  first_steps: {
    id:          'first_steps',
    name:        'First Steps',
    description: 'Walk 100 tiles across the Inn. Every journey starts with a single step.',
    iconKey:     'achv_boots',
    requirement: { stat: 'total_tiles_walked', target: 100 },
    reward:      { type: RewardType.COINS, amount: 50, xp: 25 },
    tier:        AchievementTier.BRONZE,
    category:    'exploration',
    isSecret:    false,
  },

  explorer: {
    id:          'explorer',
    name:        'Explorer',
    description: 'Visit all 14 distinct areas in Starlight Inn. The world is vast — see it all!',
    iconKey:     'achv_map',
    requirement: { stat: 'unique_areas_visited', target: 14 },
    reward:      { type: RewardType.ITEM, itemId: 'explorer_hat', xp: 500 },
    tier:        AchievementTier.GOLD,
    category:    'exploration',
    isSecret:    false,
  },

  night_owl: {
    id:          'night_owl',
    name:        'Night Owl',
    description: 'Play Starlight Inn at midnight (local time). The Inn glows differently at night.',
    iconKey:     'achv_moon',
    requirement: { customCheck: 'isMidnightPlay' },
    reward:      { type: RewardType.COINS, amount: 200, xp: 100 },
    tier:        AchievementTier.SILVER,
    category:    'exploration',
    isSecret:    true,
  },

  early_bird: {
    id:          'early_bird',
    name:        'Early Bird',
    description: 'Play Starlight Inn at 6:00 AM (local time). Rise and shine, star!',
    iconKey:     'achv_sun',
    requirement: { customCheck: 'isEarlyMorningPlay' },
    reward:      { type: RewardType.COINS, amount: 200, xp: 100 },
    tier:        AchievementTier.SILVER,
    category:    'exploration',
    isSecret:    true,
  },

  sitcom_star: {
    id:          'sitcom_star',
    name:        'Sitcom Star',
    description: 'Sit on 20 different chairs. Every chair tells a different story.',
    iconKey:     'achv_chair',
    requirement: { stat: 'unique_chairs_sat', target: 20 },
    reward:      { type: RewardType.TITLE, titleId: 'sitcom_star', xp: 150 },
    tier:        AchievementTier.SILVER,
    category:    'exploration',
    isSecret:    false,
  },

  campfire_tales: {
    id:          'campfire_tales',
    name:        'Campfire Tales',
    description: 'Sit by 10 different campfires. Warmth, stories, and friendship await.',
    iconKey:     'achv_campfire',
    requirement: { stat: 'unique_campfires_sat', target: 10 },
    reward:      { type: RewardType.COINS, amount: 300, xp: 200 },
    tier:        AchievementTier.SILVER,
    category:    'exploration',
    isSecret:    false,
  },

  /* ── Social & Friendship ── */

  social_butterfly: {
    id:          'social_butterfly',
    name:        'Social Butterfly',
    description: 'Make 10 friends. Connections are the true treasure of the Inn.',
    iconKey:     'achv_heart',
    requirement: { stat: 'total_friends_made', target: 10 },
    reward:      { type: RewardType.BADGE, badgeId: 'friend_magnet', xp: 100 },
    tier:        AchievementTier.SILVER,
    category:    'social',
    isSecret:    false,
  },

  kiss_champion: {
    id:          'kiss_champion',
    name:        'Kiss Champion',
    description: 'Send 20 kisses to other players. Spread the love!',
    iconKey:     'achv_lips',
    requirement: { stat: 'total_kisses', target: 20 },
    reward:      { type: RewardType.COINS, amount: 150, xp: 75 },
    tier:        AchievementTier.BRONZE,
    category:    'social',
    isSecret:    false,
  },

  chatty_cathy: {
    id:          'chatty_cathy',
    name:        'Chatty Cathy',
    description: 'Send 1,000 chat messages. You have a lot to say — and we love it!',
    iconKey:     'achv_chat',
    requirement: { stat: 'total_messages_sent', target: 1000 },
    reward:      { type: RewardType.BADGE, badgeId: 'chat_legend', xp: 300 },
    tier:        AchievementTier.GOLD,
    category:    'social',
    isSecret:    false,
  },

  party_host: {
    id:          'party_host',
    name:        'Party Host',
    description: 'Host a room with 5 or more people at once. The life of the party!',
    iconKey:     'achv_party',
    requirement: { stat: 'max_room_occupancy', target: 5 },
    reward:      { type: RewardType.ROOM, roomId: 'party_lounge', xp: 250 },
    tier:        AchievementTier.SILVER,
    category:    'social',
    isSecret:    false,
  },

  giver: {
    id:          'giver',
    name:        'Giver',
    description: 'Gift 10 items to other players. Generosity makes the Inn brighter.',
    iconKey:     'achv_gift',
    requirement: { stat: 'total_gifts_given', target: 10 },
    reward:      { type: RewardType.COINS, amount: 250, xp: 125 },
    tier:        AchievementTier.SILVER,
    category:    'social',
    isSecret:    false,
  },

  /* ── Dance & Expression ── */

  dance_master: {
    id:          'dance_master',
    name:        'Dance Master',
    description: 'Dance for a cumulative total of 30 minutes. Feel the rhythm!',
    iconKey:     'achv_dance',
    requirement: { stat: 'total_dance_seconds', target: 1800 },
    reward:      { type: RewardType.BADGE, badgeId: 'dance_king', xp: 200 },
    tier:        AchievementTier.GOLD,
    category:    'expression',
    isSecret:    false,
  },

  /* ── Trading & Economy ── */

  trader_elite: {
    id:          'trader_elite',
    name:        'Trader Elite',
    description: 'Complete 50 trades. A deal is a deal — and you make great ones!',
    iconKey:     'achv_trade',
    requirement: { stat: 'total_trade_count', target: 50 },
    reward:      { type: RewardType.BADGE, badgeId: 'trade_master', xp: 250 },
    tier:        AchievementTier.GOLD,
    category:    'economy',
    isSecret:    false,
  },

  collector: {
    id:          'collector',
    name:        'Collector',
    description: 'Own 100 unique items in your inventory. One of everything, please!',
    iconKey:     'achv_backpack',
    requirement: { stat: 'total_unique_items_owned', target: 100 },
    reward:      { type: RewardType.COINS, amount: 500, xp: 250 },
    tier:        AchievementTier.GOLD,
    category:    'economy',
    isSecret:    false,
  },

  rich_kid: {
    id:          'rich_kid',
    name:        'Rich Kid',
    description: 'Have 10,000 coins in your wallet at one time. Money talks!',
    iconKey:     'achv_coins',
    requirement: { stat: 'max_coins_held', target: 10000 },
    reward:      { type: RewardType.BADGE, badgeId: 'rich_star', xp: 300 },
    tier:        AchievementTier.PLATINUM,
    category:    'economy',
    isSecret:    false,
  },

  fashionista: {
    id:          'fashionista',
    name:        'Fashionista',
    description: 'Own 20 pieces of clothing. Dress to impress!',
    iconKey:     'achv_shirt',
    requirement: { stat: 'total_clothing_owned', target: 20 },
    reward:      { type: RewardType.BADGE, badgeId: 'fashion_icon', xp: 150 },
    tier:        AchievementTier.SILVER,
    category:    'economy',
    isSecret:    false,
  },

  trendsetter: {
    id:          'trendsetter',
    name:        'Trendsetter',
    description: 'Equip a Legendary rarity item. You set the trends around here.',
    iconKey:     'achv_crown',
    requirement: { customCheck: 'hasEquippedLegendary' },
    reward:      { type: RewardType.ITEM, itemId: 'trendsetter_cape', xp: 400 },
    tier:        AchievementTier.PLATINUM,
    category:    'economy',
    isSecret:    false,
  },

  /* ── Room Design & Creation ── */

  room_designer: {
    id:          'room_designer',
    name:        'Room Designer',
    description: 'Place 200 pieces of furniture in your rooms. Interior design pro!',
    iconKey:     'achv_sofa',
    requirement: { stat: 'total_furniture_placed', target: 200 },
    reward:      { type: RewardType.BADGE, badgeId: 'room_designer', xp: 200 },
    tier:        AchievementTier.GOLD,
    category:    'creation',
    isSecret:    false,
  },

  master_builder: {
    id:          'master_builder',
    name:        'Master Builder',
    description: 'Create your first custom room. Build your dream space!',
    iconKey:     'achv_hammer',
    requirement: { stat: 'total_custom_rooms_created', target: 1 },
    reward:      { type: RewardType.ROOM, roomId: 'builder_pack_1', xp: 300 },
    tier:        AchievementTier.SILVER,
    category:    'creation',
    isSecret:    false,
  },

  /* ── Mini-games ── */

  minigame_pro: {
    id:          'minigame_pro',
    name:        'Mini-game Pro',
    description: 'Win 20 mini-games. Skill, luck, and determination!',
    iconKey:     'achv_trophy',
    requirement: { stat: 'total_minigames_won', target: 20 },
    reward:      { type: RewardType.BADGE, badgeId: 'game_winner', xp: 200 },
    tier:        AchievementTier.GOLD,
    category:    'games',
    isSecret:    false,
  },

  treasure_hunter: {
    id:          'treasure_hunter',
    name:        'Treasure Hunter',
    description: 'Open 50 treasure chests. X marks the spot!',
    iconKey:     'achv_chest',
    requirement: { stat: 'total_chests_opened', target: 50 },
    reward:      { type: RewardType.COINS, amount: 350, xp: 175 },
    tier:        AchievementTier.SILVER,
    category:    'games',
    isSecret:    false,
  },

  egg_hatcher: {
    id:          'egg_hatcher',
    name:        'Egg Hatcher',
    description: 'Hatch 10 eggs. What will emerge? The surprise is half the fun!',
    iconKey:     'achv_egg',
    requirement: { stat: 'total_eggs_hatched', target: 10 },
    reward:      { type: RewardType.BADGE, badgeId: 'egg_collector', xp: 150 },
    tier:        AchievementTier.SILVER,
    category:    'games',
    isSecret:    false,
  },

  /* ── Battle Pass ── */

  battle_pass_complete: {
    id:          'battle_pass_complete',
    name:        'Battle Pass Complete',
    description: 'Finish the free track of the Battle Pass. Hard work pays off!',
    iconKey:     'achv_scroll',
    requirement: { stat: 'total_battle_pass_tiers', target: 30 },
    reward:      { type: RewardType.BADGE, badgeId: 'battle_pass_hero', xp: 500 },
    tier:        AchievementTier.GOLD,
    category:    'progression',
    isSecret:    false,
  },

  premium_owner: {
    id:          'premium_owner',
    name:        'Premium Owner',
    description: 'Purchase Starlight Premium. Welcome to the VIP life!',
    iconKey:     'achv_star',
    requirement: { customCheck: 'hasPremium' },
    reward:      { type: RewardType.BADGE, badgeId: 'premium_member', xp: 200 },
    tier:        AchievementTier.PLATINUM,
    category:    'progression',
    isSecret:    false,
  },

  /* ── Theatre & Entertainment ── */

  thespian: {
    id:          'thespian',
    name:        'Thespian',
    description: 'Watch 5 videos in the Starlight Theatre. Curtain call!',
    iconKey:     'achv_mask',
    requirement: { stat: 'total_theatre_videos_watched', target: 5 },
    reward:      { type: RewardType.TITLE, titleId: 'thespian', xp: 100 },
    tier:        AchievementTier.BRONZE,
    category:    'entertainment',
    isSecret:    false,
  },

  dj: {
    id:          'dj',
    name:        'DJ',
    description: 'Add 10 videos to the theatre queue. You control the vibe!',
    iconKey:     'achv_music',
    requirement: { stat: 'total_videos_queued', target: 10 },
    reward:      { type: RewardType.BADGE, badgeId: 'dj', xp: 125 },
    tier:        AchievementTier.SILVER,
    category:    'entertainment',
    isSecret:    false,
  },

  theatre_goer: {
    id:          'theatre_goer',
    name:        'Theatre Goer',
    description: 'Spend 1 hour total in the Starlight Theatre. Pass the popcorn!',
    iconKey:     'achv_popcorn',
    requirement: { stat: 'total_theatre_seconds', target: 3600 },
    reward:      { type: RewardType.COINS, amount: 150, xp: 75 },
    tier:        AchievementTier.BRONZE,
    category:    'entertainment',
    isSecret:    false,
  },

  /* ── Loyalty & Dedication ── */

  login_streak_7: {
    id:          'login_streak_7',
    name:        'Login Streak',
    description: 'Log in for 7 consecutive days. Consistency is key!',
    iconKey:     'achv_calendar',
    requirement: { stat: 'current_login_streak', target: 7 },
    reward:      { type: RewardType.COINS, amount: 300, xp: 150 },
    tier:        AchievementTier.SILVER,
    category:    'loyalty',
    isSecret:    false,
  },

  loyal_player: {
    id:          'loyal_player',
    name:        'Loyal Player',
    description: 'Log in for 30 total days. You are part of the family now.',
    iconKey:     'achv_shield',
    requirement: { stat: 'total_login_days', target: 30 },
    reward:      { type: RewardType.BADGE, badgeId: 'loyal_player', xp: 400 },
    tier:        AchievementTier.GOLD,
    category:    'loyalty',
    isSecret:    false,
  },

  dedicated_star: {
    id:          'dedicated_star',
    name:        'Dedicated Star',
    description: 'Play for a total of 24 hours. Time well spent!',
    iconKey:     'achv_clock',
    requirement: { stat: 'total_playtime_seconds', target: 86400 },
    reward:      { type: RewardType.ITEM, itemId: 'dedicated_pin', xp: 500 },
    tier:        AchievementTier.PLATINUM,
    category:    'loyalty',
    isSecret:    false,
  },

  /* ── Special / Meta ── */

  helper: {
    id:          'helper',
    name:        'Helper',
    description: 'Answer 20 help requests from new players. Be the guide you wish you had!',
    iconKey:     'achv_hand',
    requirement: { stat: 'total_help_requests_answered', target: 20 },
    reward:      { type: RewardType.BADGE, badgeId: 'helper', xp: 300 },
    tier:        AchievementTier.SILVER,
    category:    'meta',
    isSecret:    false,
  },

  moderator: {
    id:          'moderator',
    name:        'Moderator',
    description: 'Earn the Moderator role. Trusted, respected, and keeping the Inn safe.',
    iconKey:     'achv_badge',
    requirement: { customCheck: 'isModerator' },
    reward:      { type: RewardType.BADGE, badgeId: 'moderator', xp: 1000 },
    tier:        AchievementTier.PLATINUM,
    category:    'meta',
    isSecret:    false,
  },

  developer: {
    id:          'developer',
    name:        'Developer',
    description: 'You are part of the Starlight Inn development team. Thank you for building magic!',
    iconKey:     'achv_gear',
    requirement: { customCheck: 'isDeveloper' },
    reward:      { type: RewardType.BADGE, badgeId: 'developer', xp: 5000 },
    tier:        AchievementTier.PLATINUM,
    category:    'meta',
    isSecret:    true,
  },

  legend: {
    id:          'legend',
    name:        'Legend',
    description: 'Unlock every other non-secret achievement. You are a true Starlight Legend.',
    iconKey:     'achv_crown_gold',
    requirement: { customCheck: 'allAchievementsUnlocked' },
    reward:      { type: RewardType.BADGE, badgeId: 'legend', xp: 10000 },
    tier:        AchievementTier.PLATINUM,
    category:    'meta',
    isSecret:    true,
  },

  /* ── Milestone achievements (stretch goals) ── */

  first_steps_silver: {
    id:          'first_steps_silver',
    name:        'Seasoned Walker',
    description: 'Walk 1,000 tiles. You know these halls like the back of your hand.',
    iconKey:     'achv_boots_silver',
    requirement: { stat: 'total_tiles_walked', target: 1000 },
    reward:      { type: RewardType.COINS, amount: 200, xp: 100 },
    tier:        AchievementTier.SILVER,
    category:    'exploration',
    isSecret:    false,
  },

  first_steps_gold: {
    id:          'first_steps_gold',
    name:        'Marathon Runner',
    description: 'Walk 5,000 tiles. Marathon? More like a casual stroll for you.',
    iconKey:     'achv_boots_gold',
    requirement: { stat: 'total_tiles_walked', target: 5000 },
    reward:      { type: RewardType.COINS, amount: 1000, xp: 500 },
    tier:        AchievementTier.GOLD,
    category:    'exploration',
    isSecret:    false,
  },

  treasure_hunter_gold: {
    id:          'treasure_hunter_gold',
    name:        'Master Treasure Hunter',
    description: 'Open 200 treasure chests. The real treasure was the chests all along.',
    iconKey:     'achv_chest_gold',
    requirement: { stat: 'total_chests_opened', target: 200 },
    reward:      { type: RewardType.ITEM, itemId: 'master_key', xp: 600 },
    tier:        AchievementTier.GOLD,
    category:    'games',
    isSecret:    false,
  },

  social_butterfly_gold: {
    id:          'social_butterfly_gold',
    name:        'Socialite',
    description: 'Make 50 friends. You know everyone, and everyone knows you.',
    iconKey:     'achv_heart_gold',
    requirement: { stat: 'total_friends_made', target: 50 },
    reward:      { type: RewardType.TITLE, titleId: 'socialite', xp: 500 },
    tier:        AchievementTier.GOLD,
    category:    'social',
    isSecret:    false,
  },

  trader_elite_platinum: {
    id:          'trader_elite_platinum',
    name:        'Trade Tycoon',
    description: 'Complete 200 trades. The economy of the Inn revolves around you.',
    iconKey:     'achv_trade_platinum',
    requirement: { stat: 'total_trade_count', target: 200 },
    reward:      { type: RewardType.COINS, amount: 2000, xp: 1000 },
    tier:        AchievementTier.PLATINUM,
    category:    'economy',
    isSecret:    false,
  },

  rich_kid_platinum: {
    id:          'rich_kid_platinum',
    name:        'Millionaire',
    description: 'Have 100,000 coins at one time. Scrooge McDuck would be proud.',
    iconKey:     'achv_coins_platinum',
    requirement: { stat: 'max_coins_held', target: 100000 },
    reward:      { type: RewardType.ITEM, itemId: 'golden_top_hat', xp: 2000 },
    tier:        AchievementTier.PLATINUM,
    category:    'economy',
    isSecret:    false,
  },

  chatty_cathy_platinum: {
    id:          'chatty_cathy_platinum',
    name:        'Orator',
    description: 'Send 10,000 chat messages. Your voice echoes through every hall.',
    iconKey:     'achv_chat_platinum',
    requirement: { stat: 'total_messages_sent', target: 10000 },
    reward:      { type: RewardType.TITLE, titleId: 'orator', xp: 1000 },
    tier:        AchievementTier.PLATINUM,
    category:    'social',
    isSecret:    false,
  },

  login_streak_30: {
    id:          'login_streak_30',
    name:        'Unbreakable',
    description: 'Log in for 30 consecutive days. Nothing stops you from returning.',
    iconKey:     'achv_calendar_gold',
    requirement: { stat: 'current_login_streak', target: 30 },
    reward:      { type: RewardType.ITEM, itemId: 'unbreakable_shield', xp: 1500 },
    tier:        AchievementTier.PLATINUM,
    category:    'loyalty',
    isSecret:    false,
  },

  collector_platinum: {
    id:          'collector_platinum',
    name:        'Hoarder',
    description: 'Own 300 unique items. Do you even have space for all that?',
    iconKey:     'achv_backpack_platinum',
    requirement: { stat: 'total_unique_items_owned', target: 300 },
    reward:      { type: RewardType.BADGE, badgeId: 'hoarder', xp: 1000 },
    tier:        AchievementTier.PLATINUM,
    category:    'economy',
    isSecret:    false,
  },

  dedicated_star_platinum: {
    id:          'dedicated_star_platinum',
    name:        'Immortal Star',
    description: 'Play for a total of 100 hours. You are part of the Inn itself.',
    iconKey:     'achv_clock_platinum',
    requirement: { stat: 'total_playtime_seconds', target: 360000 },
    reward:      { type: RewardType.BADGE, badgeId: 'immortal_star', xp: 5000 },
    tier:        AchievementTier.PLATINUM,
    category:    'loyalty',
    isSecret:    true,
  },

  new_star: {
    id:          'new_star',
    name:        'New Star',
    description: 'Complete the tutorial and take your first steps in Starlight Inn. Welcome!',
    iconKey:     'achv_star_bronze',
    requirement: { stat: 'tutorial_completed', target: 1 },
    reward:      { type: RewardType.BADGE, badgeId: 'new_star', xp: 50 },
    tier:        AchievementTier.BRONZE,
    category:    'meta',
    isSecret:    false,
  },
});

/**
 * Tier ordering for comparison (lower index = lower tier).
 * @type {Array<AchievementTier>}
 */
export const TIER_ORDER = Object.freeze([
  AchievementTier.BRONZE,
  AchievementTier.SILVER,
  AchievementTier.GOLD,
  AchievementTier.PLATINUM,
]);

/**
 * Tier point values used for leaderboard scoring.
 * @type {Object<string, number>}
 */
export const TIER_POINTS = Object.freeze({
  [AchievementTier.BRONZE]:   10,
  [AchievementTier.SILVER]:   25,
  [AchievementTier.GOLD]:     50,
  [AchievementTier.PLATINUM]: 100,
});

/* --------------------------------------------------------------------------
 *  AchievementSystem class
 * -------------------------------------------------------------------------- */

/**
 * Central achievement engine for Starlight Inn.
 * Handles progress tracking, unlock detection, reward distribution,
 * and persistence (localStorage + server sync).
 *
 * @example
 *   const sys = new AchievementSystem(playerId, statTracker);
 *   sys.initialize();
 *   sys.incrementProgress('total_kisses', 1);
 */
export class AchievementSystem {
  /**
   * Create an AchievementSystem instance.
   * @param {string} playerId        — unique player identifier
   * @param {ProfileStats} statTracker — ProfileStats instance for live stats
   * @param {Object} [opts]          — optional configuration
   */
  constructor(playerId, statTracker, opts = {}) {
    if (!playerId) throw new Error('AchievementSystem requires a playerId');
    if (!statTracker) throw new Error('AchievementSystem requires a ProfileStats instance');

    this.playerId = playerId;
    this.statTracker = statTracker;
    this.opts = {
      storageKey: `si_ach_${playerId}`,
      serverSyncIntervalMs: 30000,
      rewardDelayMs: 800,
      enableToast: true,
      enableSound: true,
      ...opts,
    };

    /** @private @type {Set<string>} — unlocked achievement IDs */
    this._unlocked = new Set();

    /** @private @type {Map<string, number>} — current numeric progress per achievement */
    this._progress = new Map();

    /** @private @type {Array<Object>} — pending rewards queued for display */
    this._rewardQueue = [];

    /** @private @type {boolean} */
    this._initialized = false;

    /** @private @type {number|null} */
    this._syncTimer = null;

    /** @private @type {Array<Function>} — event listeners */
    this._listeners = { unlock: [], progress: [], reward: [] };

    /** @private @type {Date|null} — last sync timestamp */
    this._lastSync = null;

    /** @private @type {Object|null} — external player state snapshot */
    this._playerSnapshot = null;
  }

  /* ── Lifecycle ── */

  /**
   * Bootstrap the system: load saved state, bind stat events, start sync loop.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;
    this._loadFromStorage();
    this._bindStatTracker();
    this._startSyncLoop();
    this._initialized = true;
    this._emit('systemReady', { playerId: this.playerId, unlockedCount: this._unlocked.size });
  }

  /**
   * Tear down timers, unbind events, and optionally flush pending sync.
   */
  destroy() {
    this._stopSyncLoop();
    this._unbindStatTracker();
    this._listeners = { unlock: [], progress: [], reward: [] };
    this._initialized = false;
  }

  /* ── Persistence (localStorage) ── */

  /**
   * Serialize current state to localStorage.
   * @private
   */
  _saveToStorage() {
    try {
      const payload = {
        version: 7,
        playerId: this.playerId,
        unlocked: Array.from(this._unlocked),
        progress: Array.from(this._progress.entries()),
        lastSaved: new Date().toISOString(),
      };
      localStorage.setItem(this.opts.storageKey, JSON.stringify(payload));
    } catch (err) {
      console.warn('[AchievementSystem] localStorage save failed:', err);
    }
  }

  /**
   * Deserialize state from localStorage.
   * @private
   */
  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.opts.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.unlocked) data.unlocked.forEach((id) => this._unlocked.add(id));
      if (data.progress) data.progress.forEach(([k, v]) => this._progress.set(k, v));
    } catch (err) {
      console.warn('[AchievementSystem] localStorage load failed:', err);
    }
  }

  /**
   * Wipe all local achievement data. Use with caution.
   */
  clearStorage() {
    this._unlocked.clear();
    this._progress.clear();
    localStorage.removeItem(this.opts.storageKey);
    this._emit('storageCleared', { playerId: this.playerId });
  }

  /* ── Server Sync ── */

  /**
   * Start periodic background sync to the game server.
   * @private
   */
  _startSyncLoop() {
    if (this._syncTimer) return;
    this._syncTimer = setInterval(() => this.syncToServer(), this.opts.serverSyncIntervalMs);
  }

  /**
   * Stop periodic background sync.
   * @private
   */
  _stopSyncLoop() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  }

  /**
   * Push achievement state to the server.
   * Implementers should override or hook into this.
   * @returns {Promise<boolean>}
   */
  async syncToServer() {
    const payload = this.exportState();
    this._lastSync = new Date();
    this._emit('serverSync', payload);
    // Actual fetch call is left for the networking layer to inject
    return true;
  }

  /**
   * Receive server-side achievement state (e.g., after login on a new device).
   * Server wins on conflict for unlocked achievements.
   * @param {Object} serverState — state payload from server
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
    if (serverState.progress) {
      serverState.progress.forEach(([k, v]) => {
        const current = this._progress.get(k) || 0;
        if (v > current) this._progress.set(k, v);
      });
    }
    if (newUnlocks > 0) {
      this._saveToStorage();
      this._emit('serverMerge', { newUnlocks, total: this._unlocked.size });
    }
  }

  /* ── Stat Tracker Binding ── */

  /**
   * Listen to ProfileStats change events to drive achievement evaluation.
   * @private
   */
  _bindStatTracker() {
    this._onStatChange = (event) => this._handleStatChange(event.statName, event.newValue, event.oldValue);
    this.statTracker.on('change', this._onStatChange);
  }

  /**
   * Unbind stat tracker listener.
   * @private
   */
  _unbindStatTracker() {
    if (this._onStatChange) {
      this.statTracker.off('change', this._onStatChange);
    }
  }

  /**
   * React to a stat change and evaluate all matching achievements.
   * @private
   * @param {string} statName
   * @param {number} newValue
   * @param {number} oldValue
   */
  _handleStatChange(statName, newValue, oldValue) {
    for (const def of Object.values(ACHIEVEMENT_CATALOG)) {
      if (this._unlocked.has(def.id)) continue;
      const req = def.requirement;
      if (req.stat && req.stat === statName) {
        this._evaluateNumeric(def, newValue);
      }
    }
  }

  /* ── Progress & Evaluation ── */

  /**
   * Evaluate a numeric-stat achievement against a current value.
   * @private
   * @param {Object} def
   * @param {number} currentValue
   */
  _evaluateNumeric(def, currentValue) {
    const target = def.requirement.target;
    const previous = this._progress.get(def.id) || 0;
    const clamped = Math.min(currentValue, target);
    this._progress.set(def.id, clamped);

    if (clamped > previous) {
      this._emit('progress', {
        achievementId: def.id,
        name: def.name,
        current: clamped,
        target,
        percent: Math.floor((clamped / target) * 100),
      });
    }

    if (clamped >= target) {
      this.unlock(def.id);
    }
  }

  /**
   * Evaluate all custom-check achievements using an external player snapshot.
   * Call this whenever the snapshot updates (equipment changes, role changes, etc.).
   * @param {Object} snapshot — player state object
   */
  evaluateCustomChecks(snapshot = {}) {
    this._playerSnapshot = snapshot;
    for (const def of Object.values(ACHIEVEMENT_CATALOG)) {
      if (this._unlocked.has(def.id)) continue;
      if (!def.requirement.customCheck) continue;
      const passed = this._runCustomCheck(def.requirement.customCheck, snapshot);
      if (passed) this.unlock(def.id);
    }
  }

  /**
   * Run a named custom check against the player snapshot.
   * @private
   * @param {string} checkName
   * @param {Object} snapshot
   * @returns {boolean}
   */
  _runCustomCheck(checkName, snapshot) {
    const checks = {
      isMidnightPlay:       () => new Date().getHours() === 0,
      isEarlyMorningPlay:   () => new Date().getHours() === 6,
      hasPremium:           (s) => !!s?.hasPremium,
      isModerator:          (s) => !!s?.roles?.includes('moderator'),
      isDeveloper:          (s) => !!s?.roles?.includes('developer'),
      hasEquippedLegendary: (s) => !!s?.equippedLegendary,
      allAchievementsUnlocked: () => {
        const total = Object.values(ACHIEVEMENT_CATALOG).filter((a) => !a.isSecret).length;
        return this._unlocked.size >= total;
      },
    };
    const fn = checks[checkName];
    return fn ? fn(snapshot) : false;
  }

  /**
   * Manually set progress for a stat-driven achievement (e.g., bulk import).
   * @param {string} achievementId
   * @param {number} value
   */
  setProgress(achievementId, value) {
    const def = ACHIEVEMENT_CATALOG[achievementId];
    if (!def) return;
    if (this._unlocked.has(achievementId)) return;
    if (def.requirement.stat) {
      this._evaluateNumeric(def, value);
    }
  }

  /* ── Unlocking ── */

  /**
   * Unlock an achievement by ID.  Awards rewards, fires events, persists state.
   * @param {string} achievementId
   * @returns {boolean} — true if newly unlocked
   */
  unlock(achievementId) {
    if (this._unlocked.has(achievementId)) return false;
    const def = ACHIEVEMENT_CATALOG[achievementId];
    if (!def) {
      console.warn(`[AchievementSystem] Unknown achievement: ${achievementId}`);
      return false;
    }

    this._unlocked.add(achievementId);
    this._progress.set(achievementId, def.requirement.target || 1);
    this._saveToStorage();

    const reward = this._buildReward(def.reward, def);
    this._queueReward(reward);

    this._emit('unlock', {
      achievementId,
      name: def.name,
      description: def.description,
      tier: def.tier,
      iconKey: def.iconKey,
      reward,
      timestamp: Date.now(),
    });

    this._evaluateMetaAchievements();
    return true;
  }

  /**
   * After any unlock, re-check meta achievements (e.g., the Legend achievement).
   * @private
   */
  _evaluateMetaAchievements() {
    this.evaluateCustomChecks(this._playerSnapshot);
  }

  /**
   * Build a normalized reward object from a definition.
   * @private
   * @param {Object} rewardDef
   * @param {Object} achievementDef
   * @returns {Object}
   */
  _buildReward(rewardDef, achievementDef) {
    return {
      type: rewardDef.type,
      amount: rewardDef.amount || 0,
      itemId: rewardDef.itemId || null,
      badgeId: rewardDef.badgeId || null,
      titleId: rewardDef.titleId || null,
      roomId: rewardDef.roomId || null,
      xp: rewardDef.xp || 0,
      achievementName: achievementDef.name,
      achievementTier: achievementDef.tier,
    };
  }

  /**
   * Queue a reward for display/handling.
   * @private
   * @param {Object} reward
   */
  _queueReward(reward) {
    this._rewardQueue.push(reward);
    this._emit('rewardQueued', reward);
    this._processRewardQueue();
  }

  /**
   * Process the reward queue with staggered timing so the player
   * doesn't get overwhelmed by multiple simultaneous toasts.
   * @private
   */
  _processRewardQueue() {
    if (this._rewardProcessing) return;
    this._rewardProcessing = true;

    const processNext = () => {
      const reward = this._rewardQueue.shift();
      if (!reward) {
        this._rewardProcessing = false;
        return;
      }
      this._emit('reward', reward);
      setTimeout(processNext, this.opts.rewardDelayMs);
    };

    processNext();
  }

  /* ── Queries ── */

  /**
   * Check if an achievement is unlocked.
   * @param {string} achievementId
   * @returns {boolean}
   */
  isUnlocked(achievementId) {
    return this._unlocked.has(achievementId);
  }

  /**
   * Get progress for a specific achievement (0 → target).
   * @param {string} achievementId
   * @returns {{current: number, target: number, percent: number}}
   */
  getProgress(achievementId) {
    const def = ACHIEVEMENT_CATALOG[achievementId];
    if (!def) return { current: 0, target: 0, percent: 0 };
    const target = def.requirement.target || 1;
    const current = this._progress.get(achievementId) || 0;
    return { current, target, percent: Math.floor((current / target) * 100) };
  }

  /**
   * Get raw unlocked set.
   * @returns {Set<string>}
   */
  getUnlockedSet() {
    return new Set(this._unlocked);
  }

  /**
   * Get an array of unlocked achievement definitions.
   * @returns {Array<Object>}
   */
  getUnlockedAchievements() {
    return Array.from(this._unlocked)
      .map((id) => ACHIEVEMENT_CATALOG[id])
      .filter(Boolean);
  }

  /**
   * Get all locked achievements.
   * @returns {Array<Object>}
   */
  getLockedAchievements() {
    return Object.values(ACHIEVEMENT_CATALOG).filter((def) => !this._unlocked.has(def.id));
  }

  /**
   * Get achievements filtered by category.
   * @param {string} category
   * @returns {Array<Object>}
   */
  getByCategory(category) {
    return Object.values(ACHIEVEMENT_CATALOG).filter((def) => def.category === category);
  }

  /**
   * Get achievements filtered by tier.
   * @param {AchievementTier} tier
   * @returns {Array<Object>}
   */
  getByTier(tier) {
    return Object.values(ACHIEVEMENT_CATALOG).filter((def) => def.tier === tier);
  }

  /**
   * Get completion percentage across all achievements.
   * @returns {number} — 0-100
   */
  getTotalCompletionPercent() {
    const total = Object.keys(ACHIEVEMENT_CATALOG).length;
    if (total === 0) return 0;
    return Math.floor((this._unlocked.size / total) * 100);
  }

  /**
   * Get the player's total achievement score (sum of tier points).
   * @returns {number}
   */
  getAchievementScore() {
    let score = 0;
    for (const id of this._unlocked) {
      const def = ACHIEVEMENT_CATALOG[id];
      if (def) score += TIER_POINTS[def.tier] || 0;
    }
    return score;
  }

  /**
   * Get the next recommended achievement to pursue (closest to unlock).
   * @returns {Object|null}
   */
  getNextRecommendation() {
    const locked = this.getLockedAchievements().filter((def) => !def.isSecret);
    let best = null;
    let bestPercent = -1;
    for (const def of locked) {
      const { percent } = this.getProgress(def.id);
      if (percent > bestPercent && percent < 100) {
        bestPercent = percent;
        best = def;
      }
    }
    return best;
  }

  /* ── Event System ── */

  /**
   * Subscribe to an event.
   * @param {string} event — 'unlock' | 'progress' | 'reward' | 'rewardQueued' | 'serverSync' | 'serverMerge' | 'systemReady' | 'storageCleared'
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter((cb) => cb !== callback);
  }

  /**
   * Emit an event to all subscribers.
   * @private
   * @param {string} event
   * @param {*} data
   */
  _emit(event, data) {
    const listeners = this._listeners[event] || [];
    listeners.forEach((cb) => {
      try { cb(data); } catch (err) { console.error(`[AchievementSystem] Event error (${event}):`, err); }
    });
  }

  /* ── Import / Export ── */

  /**
   * Export the entire achievement state as a plain object.
   * @returns {Object}
   */
  exportState() {
    return {
      playerId: this.playerId,
      version: 7,
      unlocked: Array.from(this._unlocked),
      progress: Array.from(this._progress.entries()),
      score: this.getAchievementScore(),
      completionPercent: this.getTotalCompletionPercent(),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import achievement state.  Server wins for unlocked; local wins for progress
   * if it is numerically higher.
   * @param {Object} state
   */
  importState(state) {
    if (!state || !state.unlocked) return;
    state.unlocked.forEach((id) => this._unlocked.add(id));
    if (state.progress) {
      state.progress.forEach(([k, v]) => {
        const cur = this._progress.get(k) || 0;
        if (v > cur) this._progress.set(k, v);
      });
    }
    this._saveToStorage();
    this._emit('importComplete', { unlockedCount: this._unlocked.size });
  }

  /* ── Debug / Admin ── */

  /**
   * Force-unlock an achievement (admin / debug only).
   * @param {string} achievementId
   */
  adminUnlock(achievementId) {
    console.warn(`[AchievementSystem] Admin unlock forced: ${achievementId}`);
    this.unlock(achievementId);
  }

  /**
   * Reset a specific achievement to locked state.
   * @param {string} achievementId
   */
  adminReset(achievementId) {
    this._unlocked.delete(achievementId);
    this._progress.delete(achievementId);
    this._saveToStorage();
    this._emit('adminReset', { achievementId });
  }

  /**
   * Reset ALL achievements.  Destructive operation.
   */
  adminResetAll() {
    this._unlocked.clear();
    this._progress.clear();
    this._saveToStorage();
    this._emit('adminResetAll', { playerId: this.playerId });
  }
}

/* --------------------------------------------------------------------------
 *  UI Helpers — achievement toast / card formatting
 * -------------------------------------------------------------------------- */

/**
 * Format an achievement for display in a toast notification.
 * @param {Object} unlockEvent — payload from the 'unlock' event
 * @returns {Object} — { title, body, icon, color, sound }
 */
export function formatAchievementToast(unlockEvent) {
  const tierColors = {
    [AchievementTier.BRONZE]:   '#CD7F32',
    [AchievementTier.SILVER]:   '#C0C0C0',
    [AchievementTier.GOLD]:     '#FFD700',
    [AchievementTier.PLATINUM]: '#E5E4E2',
  };

  const tierSounds = {
    [AchievementTier.BRONZE]:   'sfx_achv_bronze',
    [AchievementTier.SILVER]:   'sfx_achv_silver',
    [AchievementTier.GOLD]:     'sfx_achv_gold',
    [AchievementTier.PLATINUM]: 'sfx_achv_platinum',
  };

  return {
    title:   `Achievement Unlocked: ${unlockEvent.name}`,
    body:    unlockEvent.description,
    icon:    unlockEvent.iconKey,
    color:   tierColors[unlockEvent.tier] || '#FFFFFF',
    sound:   tierSounds[unlockEvent.tier] || 'sfx_achv_default',
    tier:    unlockEvent.tier,
    reward:  unlockEvent.reward,
  };
}

/**
 * Build a player-facing progress string.
 * @param {number} current
 * @param {number} target
 * @returns {string} — e.g. "47 / 100"
 */
export function formatProgress(current, target) {
  return `${Math.min(current, target).toLocaleString()} / ${target.toLocaleString()}`;
}

/**
 * Get a tier badge HTML/CSS class suffix.
 * @param {AchievementTier} tier
 * @returns {string}
 */
export function tierClassSuffix(tier) {
  return tier.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Get a human-readable rarity label with sparkle emoji equivalents.
 * @param {AchievementTier} tier
 * @returns {string}
 */
export function tierLabel(tier) {
  const labels = {
    [AchievementTier.BRONZE]:   'Bronze',
    [AchievementTier.SILVER]:   'Silver',
    [AchievementTier.GOLD]:     'Gold',
    [AchievementTier.PLATINUM]: 'Platinum',
  };
  return labels[tier] || tier;
}

/**
 * Compute a "completion curve" array for charting achievement progress
 * grouped by category.
 * @param {AchievementSystem} sys
 * @returns {Array<{category: string, unlocked: number, total: number}>}
 */
export function computeCategoryBreakdown(sys) {
  const categories = {};
  for (const def of Object.values(ACHIEVEMENT_CATALOG)) {
    const cat = def.category;
    if (!categories[cat]) categories[cat] = { unlocked: 0, total: 0 };
    categories[cat].total++;
    if (sys.isUnlocked(def.id)) categories[cat].unlocked++;
  }
  return Object.entries(categories).map(([category, data]) => ({
    category,
    ...data,
    percent: Math.floor((data.unlocked / data.total) * 100),
  }));
}

/**
 * Compute a tier distribution for visualizing unlocked achievements.
 * @param {AchievementSystem} sys
 * @returns {Array<{tier: string, count: number, points: number}>}
 */
export function computeTierDistribution(sys) {
  const dist = {};
  for (const tier of TIER_ORDER) {
    dist[tier] = { count: 0, points: TIER_POINTS[tier] };
  }
  for (const id of sys.getUnlockedSet()) {
    const def = ACHIEVEMENT_CATALOG[id];
    if (def && dist[def.tier]) dist[def.tier].count++;
  }
  return Object.entries(dist).map(([tier, data]) => ({ tier, ...data }));
}

/**
 * Derive a suggested next goal message based on the closest achievement.
   * @param {AchievementSystem} sys
   * @returns {string}
   */
export function generateNextGoalMessage(sys) {
  const rec = sys.getNextRecommendation();
  if (!rec) return 'All achievements complete — you are a true Starlight Legend!';
  const { current, target, percent } = sys.getProgress(rec.id);
  const remaining = target - current;
  return `Keep going! "${rec.name}" is ${percent}% complete — only ${remaining.toLocaleString()} more to go!`;
}

/**
 * Compare two players' achievement states for a friendly rivalry view.
 * @param {Object} playerA — { unlocked: Set<string>, score: number }
 * @param {Object} playerB — { unlocked: Set<string>, score: number }
 * @returns {Object} — { winner, diffScore, shared, onlyA, onlyB }
 */
export function comparePlayers(playerA, playerB) {
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
  return {
    winner,
    diffScore: Math.abs(playerA.score - playerB.score),
    sharedCount: shared.length,
    onlyACount: onlyA.length,
    onlyBCount: onlyB.length,
    shared,
    onlyA,
    onlyB,
  };
}

/* --------------------------------------------------------------------------
 *  Achievement statistics & analytics helpers
 * -------------------------------------------------------------------------- */

/**
 * Gather aggregate statistics about the achievement catalog.
 * Useful for admin dashboards.
 * @returns {Object}
 */
export function getCatalogStats() {
  const total = Object.keys(ACHIEVEMENT_CATALOG).length;
  let byTier = { Bronze: 0, Silver: 0, Gold: 0, Platinum: 0 };
  let byCategory = {};
  let secretCount = 0;
  let totalXp = 0;
  let totalCoins = 0;

  for (const def of Object.values(ACHIEVEMENT_CATALOG)) {
    byTier[def.tier] = (byTier[def.tier] || 0) + 1;
    byCategory[def.category] = (byCategory[def.category] || 0) + 1;
    if (def.isSecret) secretCount++;
    if (def.reward.xp) totalXp += def.reward.xp;
    if (def.reward.amount && def.reward.type === RewardType.COINS) totalCoins += def.reward.amount;
  }

  return {
    totalAchievements: total,
    byTier,
    byCategory,
    secretCount,
    totalXpAvailable: totalXp,
    totalCoinsAvailable: totalCoins,
    tierWeights: TIER_POINTS,
  };
}

/**
 * Generate a daily achievement digest for a player.
 * @param {AchievementSystem} sys
 * @returns {Object}
 */
export function generateDailyDigest(sys) {
  const unlockedToday = []; // In a real system, track timestamps per unlock
  const locked = sys.getLockedAchievements();
  const nearCompletion = locked
    .map((def) => ({ def, ...sys.getProgress(def.id) }))
    .filter((p) => p.percent > 50)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);

  return {
    completionPercent: sys.getTotalCompletionPercent(),
    score: sys.getAchievementScore(),
    unlockedTodayCount: unlockedToday.length,
    nearCompletion,
    recommendation: sys.getNextRecommendation(),
  };
}

/* --------------------------------------------------------------------------
 *  Default export — AchievementSystem class
 * -------------------------------------------------------------------------- */
export default AchievementSystem;
