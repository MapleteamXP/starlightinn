/**
 * ============================================================================
 * Starlight Inn v7.0 - Battle Pass System
 * ============================================================================
 * Production-grade monetization module implementing a dual-track battle pass
 * with free and premium reward tiers, seasonal rotation, quest integration,
 * and Stripe payment processing.
 *
 * @author Starlight Inn Monetization Team
 * @version 7.0.0
 * @license Proprietary
 * ============================================================================
 */

import { EventEmitter } from '../core/EventEmitter.js';
import { PlayerData } from '../player/PlayerData.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { NotificationManager } from '../ui/NotificationManager.js';
import { StripeCheckout } from '../payments/StripeCheckout.js';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const FREE_TIER_COUNT = 50;
const PREMIUM_TIER_COUNT = 50;
const TOTAL_TIERS = FREE_TIER_COUNT;
const XP_PER_MINUTE = 10;
const DAILY_QUEST_XP = 500;
const WEEKLY_CHALLENGE_XP = 5000;
const PREMIUM_PRICE_USD = 1.99;
const TIER_SKIP_COST_GOLD = 50;
const MAX_DAILY_QUESTS = 3;
const SEASON_DURATION_DAYS = 30;

// Tier XP thresholds — exponential curve that feels fair but drives engagement
const TIER_XP_THRESHOLDS = [
  0, 300, 650, 1050, 1500, 2000, 2550, 3150, 3800, 4500,
  5250, 6050, 6900, 7800, 8750, 9750, 10800, 11900, 13050, 14250,
  15500, 16800, 18150, 19550, 21000, 22500, 24050, 25650, 27300, 29000,
  30750, 32550, 34400, 36300, 38250, 40250, 42300, 44400, 46550, 48750,
  51000, 53300, 55650, 58050, 60500, 63000, 65550, 68150, 70800, 73500
];

// ============================================================================
// SEASON DEFINITIONS
// ============================================================================

const SEASONS = {
  1: {
    id: 1,
    name: 'Starlight Launch',
    theme: 'celestial',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    description: 'Celebrate the grand opening of Starlight Inn with celestial rewards!',
    color: '#7B68EE',
    accentColor: '#FFD700',
    premiumKeyItem: 'celestial_wings',
    freeKeyItem: 'starlight_badge',
  },
  2: {
    id: 2,
    name: 'Lunar Festival',
    theme: 'lunar',
    startDate: '2024-02-01',
    endDate: '2024-02-29',
    description: 'Dance under the moonlight with lunar-themed treasures.',
    color: '#C0C0C0',
    accentColor: '#4169E1',
    premiumKeyItem: 'moon_rabbit_mount',
    freeKeyItem: 'lantern_keeper_badge',
  },
  3: {
    id: 3,
    name: 'Crystal Depths',
    theme: 'crystal',
    startDate: '2024-03-01',
    endDate: '2024-03-31',
    description: 'Descend into crystalline caverns for rare gemstone rewards.',
    color: '#00CED1',
    accentColor: '#FF1493',
    premiumKeyItem: 'crystal_dragon_pet',
    freeKeyItem: 'gem_hunter_badge',
  },
  4: {
    id: 4,
    name: 'Verdant Bloom',
    theme: 'nature',
    startDate: '2024-04-01',
    endDate: '2024-04-30',
    description: 'Spring has arrived! Collect blossoming treasures.',
    color: '#228B22',
    accentColor: '#FF69B4',
    premiumKeyItem: 'butterfly_crown',
    freeKeyItem: 'gardener_badge',
  },
  5: {
    id: 5,
    name: 'Ember Trials',
    theme: 'fire',
    startDate: '2024-05-01',
    endDate: '2024-05-31',
    description: 'Test your mettle in the fiery crucible of rewards.',
    color: '#FF4500',
    accentColor: '#FFD700',
    premiumKeyItem: 'phoenix_mount',
    freeKeyItem: 'ember_badge',
  },
  6: {
    id: 6,
    name: 'Ocean Tides',
    theme: 'ocean',
    startDate: '2024-06-01',
    endDate: '2024-06-30',
    description: 'Dive deep for sunken treasures from the briny depths.',
    color: '#1E90FF',
    accentColor: '#00FA9A',
    premiumKeyItem: 'kraken_companion',
    freeKeyItem: 'tide_walker_badge',
  },
};

// ============================================================================
// REWARD TYPE ENUMS
// ============================================================================

const RewardType = Object.freeze({
  COINS: 'coins',
  SILVER: 'silver',
  GOLD: 'gold',
  DIAMONDS: 'diamonds',
  FURNITURE: 'furniture',
  CLOTHING: 'clothing',
  EGG: 'egg',
  BADGE: 'badge',
  XP_BOOST: 'xp_boost',
  EMOTE: 'emote',
  CHAT_COLOR: 'chat_color',
  NAME_COLOR: 'name_color',
  PROFILE_FRAME: 'profile_frame',
  TITLE: 'title',
  AREA_ACCESS: 'area_access',
  PERMANENT_BOOST: 'permanent_boost',
});

const Rarity = Object.freeze({
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
  MYTHIC: 'mythic',
});

// ============================================================================
// FREE TIER REWARD CATALOG (Tiers 1-50)
// ============================================================================

const FREE_TIER_REWARDS = [
  // Tier 1-5: Welcome gifts — hook the player immediately
  { tier: 1, type: RewardType.COINS, amount: 100, rarity: Rarity.COMMON, id: 'coins_100', name: '100 Star Coins', description: 'Basic currency for small purchases.', icon: 'coin_pile_small' },
  { tier: 2, type: RewardType.FURNITURE, id: 'wooden_stool', name: 'Wooden Stool', description: 'A simple stool for your room.', rarity: Rarity.COMMON, icon: 'stool_wood', animated: false, glowing: false },
  { tier: 3, type: RewardType.COINS, amount: 150, rarity: Rarity.COMMON, id: 'coins_150', name: '150 Star Coins', description: 'A modest coin bonus.', icon: 'coin_pile_small' },
  { tier: 4, type: RewardType.EMOTE, id: 'wave_emote', name: 'Wave Emote', description: 'Wave hello to your friends!', rarity: Rarity.COMMON, icon: 'emote_wave', animated: true },
  { tier: 5, type: RewardType.BADGE, id: 'beginner_badge', name: 'Beginner Badge', description: 'You\'re just getting started!', rarity: Rarity.COMMON, icon: 'badge_beginner', silver: true, gold: false },

  // Tier 6-10: Early progression rewards
  { tier: 6, type: RewardType.COINS, amount: 200, rarity: Rarity.COMMON, id: 'coins_200', name: '200 Star Coins', description: 'More coins for your journey.', icon: 'coin_pile_medium' },
  { tier: 7, type: RewardType.CLOTHING, id: 'cotton_shirt', name: 'Cotton Shirt', description: 'Comfortable everyday wear.', rarity: Rarity.COMMON, icon: 'shirt_cotton', animated: false, glowing: false },
  { tier: 8, type: RewardType.XP_BOOST, id: 'xp_boost_15min', name: '15m XP Boost', description: '+50% XP for 15 minutes.', rarity: Rarity.COMMON, duration: 900, multiplier: 1.5, icon: 'xp_boost_small' },
  { tier: 9, type: RewardType.COINS, amount: 250, rarity: Rarity.COMMON, id: 'coins_250', name: '250 Star Coins', description: 'Building your fortune.', icon: 'coin_pile_medium' },
  { tier: 10, type: RewardType.FURNITURE, id: 'lantern_basic', name: 'Basic Lantern', description: 'Light up your space.', rarity: Rarity.COMMON, icon: 'lantern_basic', animated: false, glowing: true },

  // Tier 11-15: Mid-early rewards — keep momentum
  { tier: 11, type: RewardType.COINS, amount: 300, rarity: Rarity.UNCOMMON, id: 'coins_300', name: '300 Star Coins', description: 'A solid coin reward.', icon: 'coin_pile_medium' },
  { tier: 12, type: RewardType.CHAT_COLOR, id: 'chat_silver', name: 'Silver Chat', description: 'Your chat messages appear silver.', rarity: Rarity.UNCOMMON, icon: 'chat_silver', color: '#C0C0C0' },
  { tier: 13, type: RewardType.CLOTHING, id: 'denim_jacket', name: 'Denim Jacket', description: 'Stylish casual outerwear.', rarity: Rarity.UNCOMMON, icon: 'jacket_denim', animated: false, glowing: false },
  { tier: 14, type: RewardType.EMOTE, id: 'sit_emote', name: 'Sit Emote', description: 'Take a seat anywhere.', rarity: Rarity.UNCOMMON, icon: 'emote_sit', animated: true },
  { tier: 15, type: RewardType.BADGE, id: 'explorer_badge', name: 'Explorer Badge', description: 'You\'ve explored the inn!', rarity: Rarity.UNCOMMON, icon: 'badge_explorer', silver: true, gold: false },

  // Tier 16-20: Building value perception
  { tier: 16, type: RewardType.COINS, amount: 350, rarity: Rarity.UNCOMMON, id: 'coins_350', name: '350 Star Coins', description: 'A generous coin gift.', icon: 'coin_pile_medium' },
  { tier: 17, type: RewardType.FURNITURE, id: 'bookshelf_small', name: 'Small Bookshelf', description: 'Store your favorite reads.', rarity: Rarity.UNCOMMON, icon: 'bookshelf_small', animated: false, glowing: false },
  { tier: 18, type: RewardType.XP_BOOST, id: 'xp_boost_30min', name: '30m XP Boost', description: '+50% XP for 30 minutes.', rarity: Rarity.UNCOMMON, duration: 1800, multiplier: 1.5, icon: 'xp_boost_medium' },
  { tier: 19, type: RewardType.COINS, amount: 400, rarity: Rarity.UNCOMMON, id: 'coins_400', name: '400 Star Coins', description: 'Your wealth grows!', icon: 'coin_pile_large' },
  { tier: 20, type: RewardType.CLOTHING, id: 'leather_boots', name: 'Leather Boots', description: 'Sturdy footwear for adventuring.', rarity: Rarity.UNCOMMON, icon: 'boots_leather', animated: false, glowing: false },

  // Tier 21-25: First rare items — excitement peak
  { tier: 21, type: RewardType.COINS, amount: 450, rarity: Rarity.RARE, id: 'coins_450', name: '450 Star Coins', description: 'A hefty coin reward.', icon: 'coin_pile_large' },
  { tier: 22, type: RewardType.EMOTE, id: 'dance_emote', name: 'Dance Emote', description: 'Show off your moves!', rarity: Rarity.RARE, icon: 'emote_dance', animated: true },
  { tier: 23, type: RewardType.FURNITURE, id: 'starlight_rug', name: 'Starlight Rug', description: 'A rug that shimmers faintly.', rarity: Rarity.RARE, icon: 'rug_starlight', animated: true, glowing: true },
  { tier: 24, type: RewardType.COINS, amount: 500, rarity: Rarity.RARE, id: 'coins_500', name: '500 Star Coins', description: 'Halfway to riches!', icon: 'coin_pile_large' },
  { tier: 25, type: RewardType.BADGE, id: 'dedicated_badge', name: 'Dedicated Badge', description: 'You\'re dedicated to the inn!', rarity: Rarity.RARE, icon: 'badge_dedicated', silver: true, gold: false },

  // Tier 26-30: Sustained engagement
  { tier: 26, type: RewardType.COINS, amount: 550, rarity: Rarity.RARE, id: 'coins_550', name: '550 Star Coins', description: 'Serious coinage.', icon: 'coin_pile_large' },
  { tier: 27, type: RewardType.CLOTHING, id: 'wanderer_cloak', name: 'Wanderer Cloak', description: 'A cloak for the wandering soul.', rarity: Rarity.RARE, icon: 'cloak_wanderer', animated: false, glowing: false },
  { tier: 28, type: RewardType.XP_BOOST, id: 'xp_boost_1hr', name: '1 Hour XP Boost', description: '+50% XP for one full hour.', rarity: Rarity.RARE, duration: 3600, multiplier: 1.5, icon: 'xp_boost_large' },
  { tier: 29, type: RewardType.COINS, amount: 600, rarity: Rarity.RARE, id: 'coins_600', name: '600 Star Coins', description: 'A princely sum!', icon: 'coin_pile_large' },
  { tier: 30, type: RewardType.FURNITURE, id: 'glowing_crystal', name: 'Glowing Crystal', description: 'A mysterious crystal that hums with energy.', rarity: Rarity.RARE, icon: 'crystal_glow', animated: true, glowing: true },

  // Tier 31-35: Late grind, valuable rewards
  { tier: 31, type: RewardType.COINS, amount: 650, rarity: Rarity.EPIC, id: 'coins_650', name: '650 Star Coins', description: 'Wealth beyond measure.', icon: 'coin_pile_huge' },
  { tier: 32, type: RewardType.EMOTE, id: 'laugh_emote', name: 'Laugh Emote', description: 'Share a hearty laugh with friends.', rarity: Rarity.EPIC, icon: 'emote_laugh', animated: true },
  { tier: 33, type: RewardType.CLOTHING, id: 'starlight_hat', name: 'Starlight Hat', description: 'A hat adorned with tiny stars.', rarity: Rarity.EPIC, icon: 'hat_starlight', animated: true, glowing: true },
  { tier: 34, type: RewardType.COINS, amount: 700, rarity: Rarity.EPIC, id: 'coins_700', name: '700 Star Coins', description: 'Fortune favors the persistent.', icon: 'coin_pile_huge' },
  { tier: 35, type: RewardType.BADGE, id: 'veteran_badge', name: 'Veteran Badge', description: 'A true veteran of Starlight Inn.', rarity: Rarity.EPIC, icon: 'badge_veteran', silver: true, gold: false },

  // Tier 36-40: Epic tier rewards
  { tier: 36, type: RewardType.COINS, amount: 750, rarity: Rarity.EPIC, id: 'coins_750', name: '750 Star Coins', description: 'The vault grows deeper.', icon: 'coin_pile_huge' },
  { tier: 37, type: RewardType.FURNITURE, id: 'grand_mirror', name: 'Grand Mirror', description: 'A mirror that shows your best self.', rarity: Rarity.EPIC, icon: 'mirror_grand', animated: true, glowing: true },
  { tier: 38, type: RewardType.XP_BOOST, id: 'xp_boost_2hr', name: '2 Hour XP Boost', description: '+100% XP for two hours!', rarity: Rarity.EPIC, duration: 7200, multiplier: 2.0, icon: 'xp_boost_huge' },
  { tier: 39, type: RewardType.COINS, amount: 800, rarity: Rarity.EPIC, id: 'coins_800', name: '800 Star Coins', description: 'A king\'s ransom in coins.', icon: 'coin_pile_huge' },
  { tier: 40, type: RewardType.CLOTHING, id: 'mystic_robes', name: 'Mystic Robes', description: 'Robes woven from starlight threads.', rarity: Rarity.EPIC, icon: 'robes_mystic', animated: true, glowing: true },

  // Tier 41-45: Near completion excitement
  { tier: 41, type: RewardType.COINS, amount: 850, rarity: Rarity.EPIC, id: 'coins_850', name: '850 Star Coins', description: 'Almost at the summit!', icon: 'coin_pile_huge' },
  { tier: 42, type: RewardType.CHAT_COLOR, id: 'chat_gold', name: 'Gold Chat', description: 'Your words shine like gold.', rarity: Rarity.EPIC, icon: 'chat_gold', color: '#FFD700' },
  { tier: 43, type: RewardType.EMOTE, id: 'celebrate_emote', name: 'Celebrate Emote', description: 'Celebrate your victories!', rarity: Rarity.EPIC, icon: 'emote_celebrate', animated: true },
  { tier: 44, type: RewardType.COINS, amount: 900, rarity: Rarity.LEGENDARY, id: 'coins_900', name: '900 Star Coins', description: 'A legendary haul!', icon: 'coin_pile_mountain' },
  { tier: 45, type: RewardType.FURNITURE, id: 'starlight_throne', name: 'Starlight Throne', description: 'A throne worthy of a starlight champion.', rarity: Rarity.LEGENDARY, icon: 'throne_starlight', animated: true, glowing: true },

  // Tier 46-50: Final push — legendary finale
  { tier: 46, type: RewardType.COINS, amount: 950, rarity: Rarity.LEGENDARY, id: 'coins_950', name: '950 Star Coins', description: 'The penultimate reward.', icon: 'coin_pile_mountain' },
  { tier: 47, type: RewardType.CLOTHING, id: 'champion_crown', name: 'Champion Crown', description: 'A crown for the true champion.', rarity: Rarity.LEGENDARY, icon: 'crown_champion', animated: true, glowing: true },
  { tier: 48, type: RewardType.XP_BOOST, id: 'xp_boost_4hr', name: '4 Hour XP Boost', description: '+100% XP for four glorious hours!', rarity: Rarity.LEGENDARY, duration: 14400, multiplier: 2.0, icon: 'xp_boost_legend' },
  { tier: 49, type: RewardType.COINS, amount: 1000, rarity: Rarity.LEGENDARY, id: 'coins_1000', name: '1000 Star Coins', description: 'A perfect thousand!', icon: 'coin_pile_mountain' },
  { tier: 50, type: RewardType.BADGE, id: 'legend_badge', name: 'Legend Badge', description: 'You are a true legend of Starlight Inn.', rarity: Rarity.LEGENDARY, icon: 'badge_legend', silver: true, gold: false },
];

// ============================================================================
// PREMIUM TIER REWARD CATALOG (Tiers 1-50)
// ============================================================================

const PREMIUM_TIER_REWARDS = [
  // Tier 1-5: Premium first impression — must feel valuable immediately
  { tier: 1, type: RewardType.GOLD, amount: 50, rarity: Rarity.EPIC, id: 'gold_50', name: '50 Gold', description: 'Premium currency to spend in the store.', icon: 'gold_bar_small' },
  { tier: 2, type: RewardType.FURNITURE, id: 'animated_fireplace', name: 'Animated Fireplace', description: 'A crackling fireplace with dancing flames.', rarity: Rarity.EPIC, icon: 'fireplace_animated', animated: true, glowing: true, exclusive: true },
  { tier: 3, type: RewardType.EMOTE, id: 'twirl_emote', name: 'Twirl Emote', description: 'An elegant twirl for special occasions.', rarity: Rarity.EPIC, icon: 'emote_twirl', animated: true, exclusive: true },
  { tier: 4, type: RewardType.DIAMONDS, amount: 5, rarity: Rarity.LEGENDARY, id: 'diamonds_5', name: '5 Diamonds', description: 'Ultra-rare currency from the Crystal Depths.', icon: 'diamond_cluster' },
  { tier: 5, type: RewardType.FURNITURE, id: 'glowing_chandelier', name: 'Glowing Chandelier', description: 'A chandelier that cycles through rainbow colors.', rarity: Rarity.EPIC, icon: 'chandelier_glow', animated: true, glowing: true, exclusive: true },

  // Tier 6-10: Sustained premium value
  { tier: 6, type: RewardType.GOLD, amount: 75, rarity: Rarity.EPIC, id: 'gold_75', name: '75 Gold', description: 'More gold for your premium stash.', icon: 'gold_bar_medium' },
  { tier: 7, type: RewardType.CLOTHING, id: 'starlight_gown', name: 'Starlight Gown', description: 'A gown woven from actual starlight threads.', rarity: Rarity.EPIC, icon: 'gown_starlight', animated: true, glowing: true, exclusive: true },
  { tier: 8, type: RewardType.PROFILE_FRAME, id: 'gold_frame', name: 'Golden Frame', description: 'A golden frame for your profile portrait.', rarity: Rarity.EPIC, icon: 'frame_gold', exclusive: true },
  { tier: 9, type: RewardType.DIAMONDS, amount: 10, rarity: Rarity.LEGENDARY, id: 'diamonds_10', name: '10 Diamonds', description: 'A sparkling diamond cluster.', icon: 'diamond_cluster' },
  { tier: 10, type: RewardType.BADGE, id: 'premium_badge', name: 'Premium Badge', description: 'You\'re a premium patron!', rarity: Rarity.EPIC, icon: 'badge_premium', silver: false, gold: true },

  // Tier 11-15: Premium escalating rewards
  { tier: 11, type: RewardType.GOLD, amount: 100, rarity: Rarity.EPIC, id: 'gold_100', name: '100 Gold', description: 'A century of gold pieces!', icon: 'gold_bar_medium' },
  { tier: 12, type: RewardType.FURNITURE, id: 'portal_mirror', name: 'Portal Mirror', description: 'A mirror that shows glimpses of other realms.', rarity: Rarity.LEGENDARY, icon: 'mirror_portal', animated: true, glowing: true, exclusive: true },
  { tier: 13, type: RewardType.EMOTE, id: 'levitate_emote', name: 'Levitate Emote', description: 'Float above the ground in style.', rarity: Rarity.LEGENDARY, icon: 'emote_levitate', animated: true, exclusive: true },
  { tier: 14, type: RewardType.EGG, id: 'rare_phoenix_egg', name: 'Rare Phoenix Egg', description: 'Hatch a baby phoenix companion!', rarity: Rarity.LEGENDARY, icon: 'egg_phoenix', animated: true, exclusive: true },
  { tier: 15, type: RewardType.NAME_COLOR, id: 'name_rainbow', name: 'Rainbow Name', description: 'Your name cycles through rainbow colors.', rarity: Rarity.LEGENDARY, icon: 'name_rainbow', color: 'rainbow', exclusive: true },

  // Tier 16-20: Mid-premium excitement
  { tier: 16, type: RewardType.GOLD, amount: 125, rarity: Rarity.LEGENDARY, id: 'gold_125', name: '125 Gold', description: 'A treasure trove of gold.', icon: 'gold_bar_large' },
  { tier: 17, type: RewardType.CLOTHING, id: 'dragon_armor', name: 'Dragon Scale Armor', description: 'Armor forged from ancient dragon scales.', rarity: Rarity.LEGENDARY, icon: 'armor_dragon', animated: true, glowing: true, exclusive: true },
  { tier: 18, type: RewardType.DIAMONDS, amount: 15, rarity: Rarity.LEGENDARY, id: 'diamonds_15', name: '15 Diamonds', description: 'A fistful of diamonds.', icon: 'diamond_cluster' },
  { tier: 19, type: RewardType.TITLE, id: 'title_starwalker', name: 'Title: Starwalker', description: 'The Starwalker title for your profile.', rarity: Rarity.LEGENDARY, icon: 'title_starwalker', display: 'Starwalker', exclusive: true },
  { tier: 20, type: RewardType.FURNITURE, id: 'floating_island_planter', name: 'Floating Island Planter', description: 'A mini floating island for your room.', rarity: Rarity.LEGENDARY, icon: 'planter_floating', animated: true, glowing: true, exclusive: true },

  // Tier 21-25: High-value mid-tier rewards
  { tier: 21, type: RewardType.GOLD, amount: 150, rarity: Rarity.LEGENDARY, id: 'gold_150', name: '150 Gold', description: 'A king\'s ransom!', icon: 'gold_bar_large' },
  { tier: 22, type: RewardType.EMOTE, id: 'meteor_emote', name: 'Meteor Emote', description: 'Call down a meteor shower around you.', rarity: Rarity.LEGENDARY, icon: 'emote_meteor', animated: true, exclusive: true },
  { tier: 23, type: RewardType.PROFILE_FRAME, id: 'crystal_frame', name: 'Crystal Frame', description: 'A frame made of living crystal.', rarity: Rarity.LEGENDARY, icon: 'frame_crystal', animated: true, exclusive: true },
  { tier: 24, type: RewardType.DIAMONDS, amount: 20, rarity: Rarity.LEGENDARY, id: 'diamonds_20', name: '20 Diamonds', description: 'A cascade of diamonds.', icon: 'diamond_cascade' },
  { tier: 25, type: RewardType.CLOTHING, id: 'celestial_wings', name: 'Celestial Wings', description: 'Wings that let you glide through the inn.', rarity: Rarity.MYTHIC, icon: 'wings_celestial', animated: true, glowing: true, exclusive: true },

  // Tier 26-30: Premium climax approaching
  { tier: 26, type: RewardType.GOLD, amount: 175, rarity: Rarity.LEGENDARY, id: 'gold_175', name: '175 Gold', description: 'Wealth of the ancients.', icon: 'gold_bar_huge' },
  { tier: 27, type: RewardType.EGG, id: 'legendary_dragon_egg', name: 'Legendary Dragon Egg', description: 'Hatch an ancient dragon companion!', rarity: Rarity.MYTHIC, icon: 'egg_dragon_ancient', animated: true, exclusive: true },
  { tier: 28, type: RewardType.EMOTE, id: 'transform_emote', name: 'Transform Emote', description: 'Momentarily transform into a constellation.', rarity: Rarity.MYTHIC, icon: 'emote_transform', animated: true, exclusive: true },
  { tier: 29, type: RewardType.FURNITURE, id: 'observatory_dome', name: 'Observatory Dome', description: 'A working mini-observatory for your room.', rarity: Rarity.LEGENDARY, icon: 'dome_observatory', animated: true, glowing: true, exclusive: true },
  { tier: 30, type: RewardType.NAME_COLOR, id: 'name_stardust', name: 'Stardust Name', description: 'Your name sparkles with stardust particles.', rarity: Rarity.MYTHIC, icon: 'name_stardust', color: '#FFD700', animated: true, exclusive: true },

  // Tier 31-35: Premium power rewards
  { tier: 31, type: RewardType.GOLD, amount: 200, rarity: Rarity.LEGENDARY, id: 'gold_200', name: '200 Gold', description: 'Two hundred pieces of premium gold.', icon: 'gold_bar_huge' },
  { tier: 32, type: RewardType.TITLE, id: 'title_moonlord', name: 'Title: Moonlord', description: 'The Moonlord title for your profile.', rarity: Rarity.MYTHIC, icon: 'title_moonlord', display: 'Moonlord', exclusive: true },
  { tier: 33, type: RewardType.EMOTE, id: 'eclipse_emote', name: 'Eclipse Emote', description: 'Create a solar eclipse around your character.', rarity: Rarity.MYTHIC, icon: 'emote_eclipse', animated: true, exclusive: true },
  { tier: 34, type: RewardType.DIAMONDS, amount: 25, rarity: Rarity.MYTHIC, id: 'diamonds_25', name: '25 Diamonds', description: 'A fortune in diamonds.', icon: 'diamond_cascade' },
  { tier: 35, type: RewardType.BADGE, id: 'premium_master_badge', name: 'Premium Master Badge', description: 'The master badge for premium patrons.', rarity: Rarity.MYTHIC, icon: 'badge_premium_master', silver: false, gold: true },

  // Tier 36-40: Ultra-rare territory
  { tier: 36, type: RewardType.GOLD, amount: 250, rarity: Rarity.MYTHIC, id: 'gold_250', name: '250 Gold', description: 'A quarter-thousand gold pieces!', icon: 'gold_bar_huge' },
  { tier: 37, type: RewardType.CLOTHING, id: 'void_walker_cape', name: 'Void Walker Cape', description: 'A cape that shows the void between stars.', rarity: Rarity.MYTHIC, icon: 'cape_void', animated: true, glowing: true, exclusive: true },
  { tier: 38, type: RewardType.PERMANENT_BOOST, id: 'boost_2x_xp', name: 'Permanent 2x XP', description: 'Double XP for all activities, forever!', rarity: Rarity.MYTHIC, icon: 'boost_permanent_2x', multiplier: 2.0, permanent: true },
  { tier: 39, type: RewardType.FURNITURE, id: 'dimensional_shelf', name: 'Dimensional Shelf', description: 'Items placed here float in their own dimension.', rarity: Rarity.MYTHIC, icon: 'shelf_dimensional', animated: true, glowing: true, exclusive: true },
  { tier: 40, type: RewardType.PROFILE_FRAME, id: 'mythic_frame', name: 'Mythic Frame', description: 'A frame that pulses with ancient power.', rarity: Rarity.MYTHIC, icon: 'frame_mythic', animated: true, exclusive: true },

  // Tier 41-45: Endgame premium
  { tier: 41, type: RewardType.GOLD, amount: 300, rarity: Rarity.MYTHIC, id: 'gold_300', name: '300 Gold', description: 'A hoard fit for a dragon.', icon: 'gold_bar_mountain' },
  { tier: 42, type: RewardType.EGG, id: 'mythic_griffin_egg', name: 'Mythic Griffin Egg', description: 'Hatch a royal griffin companion!', rarity: Rarity.MYTHIC, icon: 'egg_griffin', animated: true, exclusive: true },
  { tier: 43, type: RewardType.AREA_ACCESS, id: 'access_celestial_spa', name: 'Celestial Spa Access', description: 'Access the exclusive Celestial Spa area.', rarity: Rarity.MYTHIC, icon: 'area_celestial_spa', areaId: 'celestial_spa', exclusive: true },
  { tier: 44, type: RewardType.EMOTE, id: 'supernova_emote', name: 'Supernova Emote', description: 'Explode with the power of a supernova.', rarity: Rarity.MYTHIC, icon: 'emote_supernova', animated: true, exclusive: true },
  { tier: 45, type: RewardType.TITLE, id: 'title_voidwalker', name: 'Title: Voidwalker', description: 'The Voidwalker title — feared and respected.', rarity: Rarity.MYTHIC, icon: 'title_voidwalker', display: 'Voidwalker', exclusive: true },

  // Tier 46-50: Ultimate premium finale
  { tier: 46, type: RewardType.GOLD, amount: 400, rarity: Rarity.MYTHIC, id: 'gold_400', name: '400 Gold', description: 'An absolute fortune in gold.', icon: 'gold_bar_mountain' },
  { tier: 47, type: RewardType.FURNITURE, id: 'reality_anchor', name: 'Reality Anchor', description: 'An artifact that stabilizes your room\'s reality.', rarity: Rarity.MYTHIC, icon: 'anchor_reality', animated: true, glowing: true, exclusive: true },
  { tier: 48, type: RewardType.NAME_COLOR, id: 'name_voidfire', name: 'Voidfire Name', description: 'Your name burns with voidfire energy.', rarity: Rarity.MYTHIC, icon: 'name_voidfire', color: '#9400D3', animated: true, exclusive: true },
  { tier: 49, type: RewardType.DIAMONDS, amount: 50, rarity: Rarity.MYTHIC, id: 'diamonds_50', name: '50 Diamonds', description: 'The ultimate diamond reward.', icon: 'diamond_mountain' },
  { tier: 50, type: RewardType.BADGE, id: 'transcendent_badge', name: 'Transcendent Badge', description: 'You have transcended mortal limitations.', rarity: Rarity.MYTHIC, icon: 'badge_transcendent', silver: false, gold: true },
];

// ============================================================================
// DAILY QUEST DEFINITIONS
// ============================================================================

const DAILY_QUEST_POOL = [
  {
    id: 'visit_areas',
    name: 'World Traveler',
    description: 'Visit 3 different areas in the inn.',
    target: 3,
    xpReward: DAILY_QUEST_XP,
    category: 'exploration',
    icon: 'quest_map',
    checkProgress: (playerData) => playerData.stats?.areasVisitedToday?.length || 0,
  },
  {
    id: 'make_trade',
    name: 'Friendly Trader',
    description: 'Complete 1 trade with another player.',
    target: 1,
    xpReward: DAILY_QUEST_XP,
    category: 'social',
    icon: 'quest_trade',
    checkProgress: (playerData) => playerData.stats?.tradesCompletedToday || 0,
  },
  {
    id: 'dance_duration',
    name: 'Dance Floor Star',
    description: 'Dance for 5 minutes total.',
    target: 300,
    xpReward: DAILY_QUEST_XP,
    category: 'social',
    icon: 'quest_dance',
    checkProgress: (playerData) => playerData.stats?.danceSecondsToday || 0,
    unit: 'seconds',
  },
  {
    id: 'chat_messages',
    name: 'Social Butterfly',
    description: 'Send 10 chat messages.',
    target: 10,
    xpReward: DAILY_QUEST_XP,
    category: 'social',
    icon: 'quest_chat',
    checkProgress: (playerData) => playerData.stats?.chatMessagesToday || 0,
  },
  {
    id: 'collect_coins',
    name: 'Coin Collector',
    description: 'Collect 50 coins from the world.',
    target: 50,
    xpReward: DAILY_QUEST_XP,
    category: 'collection',
    icon: 'quest_coin',
    checkProgress: (playerData) => playerData.stats?.coinsCollectedToday || 0,
  },
  {
    id: 'play_minigame',
    name: 'Game Master',
    description: 'Play any minigame 3 times.',
    target: 3,
    xpReward: DAILY_QUEST_XP,
    category: 'gameplay',
    icon: 'quest_controller',
    checkProgress: (playerData) => playerData.stats?.minigamesPlayedToday || 0,
  },
  {
    id: 'decorate_room',
    name: 'Interior Designer',
    description: 'Place or move 5 furniture items.',
    target: 5,
    xpReward: DAILY_QUEST_XP,
    category: 'creative',
    icon: 'quest_paint',
    checkProgress: (playerData) => playerData.stats?.furniturePlacedToday || 0,
  },
  {
    id: 'help_newcomer',
    name: 'Mentor',
    description: 'Help a player who joined within the last 7 days.',
    target: 1,
    xpReward: DAILY_QUEST_XP,
    category: 'social',
    icon: 'quest_mentor',
    checkProgress: (playerData) => playerData.stats?.newcomersHelpedToday || 0,
  },
];

// ============================================================================
// WEEKLY CHALLENGE DEFINITIONS
// ============================================================================

const WEEKLY_CHALLENGE_POOL = [
  {
    id: 'xp_master',
    name: 'XP Master',
    description: 'Earn 10,000 XP in a single week.',
    target: 10000,
    xpReward: WEEKLY_CHALLENGE_XP,
    icon: 'challenge_xp',
    checkProgress: (playerData) => playerData.stats?.xpEarnedThisWeek || 0,
  },
  {
    id: 'socialite',
    name: 'Ultimate Socialite',
    description: 'Make 20 trades with different players.',
    target: 20,
    xpReward: WEEKLY_CHALLENGE_XP,
    icon: 'challenge_social',
    checkProgress: (playerData) => playerData.stats?.uniqueTradersThisWeek || 0,
  },
  {
    id: 'explorer',
    name: 'Master Explorer',
    description: 'Visit every area in the inn at least once.',
    target: 12,
    xpReward: WEEKLY_CHALLENGE_XP,
    icon: 'challenge_explore',
    checkProgress: (playerData) => playerData.stats?.uniqueAreasThisWeek || 0,
  },
  {
    id: 'collector',
    name: 'Rare Collector',
    description: 'Obtain 5 rare or better items.',
    target: 5,
    xpReward: WEEKLY_CHALLENGE_XP,
    icon: 'challenge_rare',
    checkProgress: (playerData) => playerData.stats?.rareItemsObtainedThisWeek || 0,
  },
  {
    id: 'minigame_champion',
    name: 'Minigame Champion',
    description: 'Win 10 minigame matches.',
    target: 10,
    xpReward: WEEKLY_CHALLENGE_XP,
    icon: 'challenge_trophy',
    checkProgress: (playerData) => playerData.stats?.minigameWinsThisWeek || 0,
  },
  {
    id: 'generous_soul',
    name: 'Generous Soul',
    description: 'Gift 3 items to other players.',
    target: 3,
    xpReward: WEEKLY_CHALLENGE_XP,
    icon: 'challenge_gift',
    checkProgress: (playerData) => playerData.stats?.itemsGiftedThisWeek || 0,
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the current season based on date.
 * @returns {Object} Season configuration object
 */
function getCurrentSeason() {
  const now = new Date();
  for (const [seasonId, season] of Object.entries(SEASONS)) {
    const start = new Date(season.startDate);
    const end = new Date(season.endDate);
    if (now >= start && now <= end) {
      return { ...season, id: parseInt(seasonId) };
    }
  }
  return { ...SEASONS[1], id: 1 };
}

/**
 * Calculate tier from total XP.
 * @param {number} totalXP
 * @returns {number} Current tier (1-50)
 */
function calculateTierFromXP(totalXP) {
  for (let i = TIER_XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= TIER_XP_THRESHOLDS[i]) {
      return Math.min(i + 1, TOTAL_TIERS);
    }
  }
  return 1;
}

/**
 * Get XP needed to reach next tier.
 * @param {number} currentTier
 * @param {number} currentXP
 * @returns {number} XP needed for next tier
 */
function getXPToNextTier(currentTier, currentXP) {
  if (currentTier >= TOTAL_TIERS) return 0;
  const nextThreshold = TIER_XP_THRESHOLDS[currentTier] || TIER_XP_THRESHOLDS[TIER_XP_THRESHOLDS.length - 1];
  return Math.max(0, nextThreshold - currentXP);
}

/**
 * Generate a deterministic daily quest set based on date seed.
 * @param {string} playerId
 * @param {Date} date
 * @returns {Array} Array of 3 daily quest objects
 */
function generateDailyQuests(playerId, date) {
  const seed = `${playerId}_${date.toISOString().split('T')[0]}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const shuffled = [...DAILY_QUEST_POOL].sort((a, b) => {
    const hashA = Math.abs(hash ^ a.id.length);
    const hashB = Math.abs(hash ^ b.id.length);
    return hashA - hashB;
  });
  return shuffled.slice(0, MAX_DAILY_QUESTS).map((quest, index) => ({
    ...quest,
    instanceId: `${quest.id}_${date.toISOString().split('T')[0]}_${index}`,
    progress: 0,
    completed: false,
    claimed: false,
    assignedAt: date.toISOString(),
  }));
}

/**
 * Generate a deterministic weekly challenge based on date seed.
 * @param {string} playerId
 * @param {Date} date
 * @returns {Object} Weekly challenge object
 */
function generateWeeklyChallenge(playerId, date) {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  const seed = `${playerId}_${weekStart.toISOString().split('T')[0]}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % WEEKLY_CHALLENGE_POOL.length;
  const challenge = WEEKLY_CHALLENGE_POOL[index];
  return {
    ...challenge,
    instanceId: `${challenge.id}_${weekStart.toISOString().split('T')[0]}`,
    progress: 0,
    completed: false,
    claimed: false,
    assignedAt: weekStart.toISOString(),
    expiresAt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

// ============================================================================
// MAIN BATTLE PASS CLASS
// ============================================================================

/**
 * BattlePass manages the seasonal progression system for Starlight Inn.
 * Handles XP tracking, tier progression, reward claiming, premium status,
 * quest completion, and Stripe payment integration.
 */
class BattlePass extends EventEmitter {
  /**
   * Create a BattlePass instance.
   * @param {Object} config - Configuration object
   * @param {string} config.playerId - Unique player identifier
   * @param {PlayerData} config.playerData - Player data manager instance
   * @param {InventoryManager} config.inventoryManager - Inventory manager instance
   * @param {NotificationManager} config.notificationManager - Notification manager instance
   * @param {StripeCheckout} config.stripeCheckout - Stripe checkout instance
   */
  constructor(config = {}) {
    super();
    this.playerId = config.playerId || 'guest';
    this.playerData = config.playerData || new PlayerData(this.playerId);
    this.inventoryManager = config.inventoryManager || new InventoryManager(this.playerId);
    this.notificationManager = config.notificationManager || new NotificationManager();
    this.stripeCheckout = config.stripeCheckout || new StripeCheckout();

    // Core state
    this._season = getCurrentSeason();
    this._xp = 0;
    this._premium = false;
    this._currentTier = 1;
    this._claimedRewards = new Set();
    this._claimedPremiumRewards = new Set();
    this._activeBoosts = [];
    this._permanentBoost = 1.0;
    this._dailyQuests = [];
    this._weeklyChallenge = null;
    this._lastQuestReset = null;
    this._lastWeeklyReset = null;
    this._tierPurchaseHistory = [];
    this._giftHistory = [];
    this._sessionXP = 0;
    this._playTimeSeconds = 0;
    this._lastTick = Date.now();

    // Stripe configuration
    this._stripeEnabled = config.stripeEnabled !== false;
    this._stripeMode = config.stripeMode || 'mock';
    this._stripeProductId = config.stripeProductId || 'bp_premium_default';

    // Initialize
    this._loadState();
    this._resetQuestsIfNeeded();
    this._startPlayTimeTracker();
  }

  // ==========================================================================
  // STATE PERSISTENCE
  // ==========================================================================

  /**
   * Load battle pass state from storage.
   * @private
   */
  _loadState() {
    const key = `bp_state_${this.playerId}`;
    const saved = this._getStorage(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this._xp = parsed.xp || 0;
        this._premium = parsed.premium || false;
        this._currentTier = parsed.currentTier || calculateTierFromXP(this._xp);
        this._claimedRewards = new Set(parsed.claimedRewards || []);
        this._claimedPremiumRewards = new Set(parsed.claimedPremiumRewards || []);
        this._permanentBoost = parsed.permanentBoost || 1.0;
        this._lastQuestReset = parsed.lastQuestReset ? new Date(parsed.lastQuestReset) : null;
        this._lastWeeklyReset = parsed.lastWeeklyReset ? new Date(parsed.lastWeeklyReset) : null;
        this._tierPurchaseHistory = parsed.tierPurchaseHistory || [];
        this._giftHistory = parsed.giftHistory || [];

        if (parsed.seasonId && parsed.seasonId !== this._season.id) {
          this._onSeasonChange(parsed.seasonId, this._season.id);
        }
      } catch (e) {
        this._log('error', 'Failed to load battle pass state:', e.message);
      }
    }
    this._currentTier = calculateTierFromXP(this._xp);
  }

  /**
   * Save battle pass state to storage.
   * @private
   */
  _saveState() {
    const key = `bp_state_${this.playerId}`;
    const data = {
      xp: this._xp,
      premium: this._premium,
      currentTier: this._currentTier,
      seasonId: this._season.id,
      claimedRewards: Array.from(this._claimedRewards),
      claimedPremiumRewards: Array.from(this._claimedPremiumRewards),
      permanentBoost: this._permanentBoost,
      lastQuestReset: this._lastQuestReset ? this._lastQuestReset.toISOString() : null,
      lastWeeklyReset: this._lastWeeklyReset ? this._lastWeeklyReset.toISOString() : null,
      tierPurchaseHistory: this._tierPurchaseHistory,
      giftHistory: this._giftHistory,
      savedAt: new Date().toISOString(),
    };
    this._setStorage(key, JSON.stringify(data));
  }

  /**
   * Handle season change — archive old season, reset progress.
   * @private
   * @param {number} oldSeasonId
   * @param {number} newSeasonId
   */
  _onSeasonChange(oldSeasonId, newSeasonId) {
    const archiveKey = `bp_archive_${this.playerId}_${oldSeasonId}`;
    const archiveData = {
      seasonId: oldSeasonId,
      finalTier: this._currentTier,
      finalXP: this._xp,
      premium: this._premium,
      claimedRewards: Array.from(this._claimedRewards),
      claimedPremiumRewards: Array.from(this._claimedPremiumRewards),
      tierPurchases: this._tierPurchaseHistory.length,
    };
    this._setStorage(archiveKey, JSON.stringify(archiveData));

    this._xp = 0;
    this._currentTier = 1;
    this._premium = false;
    this._claimedRewards.clear();
    this._claimedPremiumRewards.clear();
    this._permanentBoost = 1.0;
    this._tierPurchaseHistory = [];
    this._lastQuestReset = null;
    this._lastWeeklyReset = null;

    this.emit('seasonChange', { oldSeason: oldSeasonId, newSeason: newSeasonId });
    this.notificationManager.notify({
      type: 'season_start',
      title: `Season ${newSeasonId} Has Begun!`,
      message: `Welcome to ${this._season.name}! Your battle pass has been reset.`,
      icon: 'season_icon',
    });
  }

  // ==========================================================================
  // PLAY TIME & XP TRACKING
  // ==========================================================================

  /**
   * Start tracking play time for passive XP gain.
   * @private
   */
  _startPlayTimeTracker() {
    this._playTimeInterval = setInterval(() => {
      this._tickPlayTime();
    }, 60000); // Tick every minute
  }

  /**
   * Process play time tick — grant passive XP.
   * @private
   */
  _tickPlayTime() {
    const now = Date.now();
    const elapsed = Math.floor((now - this._lastTick) / 1000);
    this._lastTick = now;
    this._playTimeSeconds += elapsed;

    const minutesPlayed = Math.floor(elapsed / 60);
    if (minutesPlayed > 0) {
      const xpGain = minutesPlayed * XP_PER_MINUTE * this._permanentBoost;
      this._sessionXP += xpGain;
      this.addXP(xpGain, 'play_time');
    }
  }

  /**
   * Stop play time tracker (for cleanup).
   */
  stopPlayTimeTracker() {
    if (this._playTimeInterval) {
      clearInterval(this._playTimeInterval);
      this._playTimeInterval = null;
    }
  }

  // ==========================================================================
  // QUEST SYSTEM
  // ==========================================================================

  /**
   * Reset daily quests if a new day has started.
   * @private
   */
  _resetQuestsIfNeeded() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const lastReset = this._lastQuestReset ? this._lastQuestReset.toISOString().split('T')[0] : null;

    if (lastReset !== today) {
      this._dailyQuests = generateDailyQuests(this.playerId, now);
      this._lastQuestReset = now;
      this.emit('dailyQuestsReset', { quests: this._dailyQuests });
    }

    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    const lastWeekStart = this._lastWeeklyReset ? new Date(this._lastWeeklyReset) : null;
    if (!lastWeekStart || lastWeekStart < thisWeekStart) {
      this._weeklyChallenge = generateWeeklyChallenge(this.playerId, now);
      this._lastWeeklyReset = thisWeekStart;
      this.emit('weeklyChallengeReset', { challenge: this._weeklyChallenge });
    }
  }

  /**
   * Get the current set of daily quests.
   * @returns {Array} Array of daily quest objects with progress
   */
  getDailyQuests() {
    this._resetQuestsIfNeeded();
    return this._dailyQuests.map((quest) => ({
      ...quest,
      progress: this._getQuestProgress(quest),
      completed: quest.completed || this._getQuestProgress(quest) >= quest.target,
    }));
  }

  /**
   * Get the current weekly challenge.
   * @returns {Object|null} Weekly challenge object
   */
  getWeeklyChallenge() {
    this._resetQuestsIfNeeded();
    if (!this._weeklyChallenge) return null;
    const progress = this._getChallengeProgress(this._weeklyChallenge);
    return {
      ...this._weeklyChallenge,
      progress,
      completed: this._weeklyChallenge.completed || progress >= this._weeklyChallenge.target,
    };
  }

  /**
   * Get progress for a specific quest.
   * @private
   * @param {Object} quest
   * @returns {number}
   */
  _getQuestProgress(quest) {
    try {
      return quest.checkProgress(this.playerData) || 0;
    } catch {
      return quest.progress || 0;
    }
  }

  /**
   * Get progress for the weekly challenge.
   * @private
   * @param {Object} challenge
   * @returns {number}
   */
  _getChallengeProgress(challenge) {
    try {
      return challenge.checkProgress(this.playerData) || 0;
    } catch {
      return challenge.progress || 0;
    }
  }

  /**
   * Manually update quest progress (for server-synced quests).
   * @param {string} questId
   * @param {number} amount
   */
  updateQuestProgress(questId, amount) {
    this._resetQuestsIfNeeded();
    const quest = this._dailyQuests.find((q) => q.id === questId);
    if (!quest) return;
    quest.progress = Math.min(quest.target, (quest.progress || 0) + amount);
    if (quest.progress >= quest.target && !quest.completed) {
      quest.completed = true;
      this.addXP(quest.xpReward, 'quest_complete');
      this.emit('questComplete', { quest });
      this.notificationManager.notify({
        type: 'quest_complete',
        title: 'Quest Complete!',
        message: `${quest.name} — +${quest.xpReward} XP`,
        icon: quest.icon,
      });
    }
    this._saveState();
  }

  /**
   * Claim a completed quest's XP reward.
   * @param {string} questInstanceId
   * @returns {boolean} Whether claim was successful
   */
  claimQuestReward(questInstanceId) {
    this._resetQuestsIfNeeded();
    const quest = this._dailyQuests.find((q) => q.instanceId === questInstanceId);
    if (!quest || !quest.completed || quest.claimed) return false;
    quest.claimed = true;
    this.emit('questClaimed', { quest });
    this._saveState();
    return true;
  }

  /**
   * Claim the weekly challenge reward.
   * @returns {boolean} Whether claim was successful
   */
  claimWeeklyReward() {
    this._resetQuestsIfNeeded();
    if (!this._weeklyChallenge || !this._weeklyChallenge.completed || this._weeklyChallenge.claimed) {
      return false;
    }
    this._weeklyChallenge.claimed = true;
    this.addXP(this._weeklyChallenge.xpReward, 'weekly_challenge');
    this.emit('weeklyChallengeClaimed', { challenge: this._weeklyChallenge });
    this.notificationManager.notify({
      type: 'challenge_complete',
      title: 'Weekly Challenge Complete!',
      message: `${this._weeklyChallenge.name} — +${this._weeklyChallenge.xpReward} XP`,
      icon: this._weeklyChallenge.icon,
    });
    this._saveState();
    return true;
  }

  // ==========================================================================
  // CORE XP & TIER API
  // ==========================================================================

  /**
   * Get current total XP.
   * @returns {number} Total XP accumulated
   */
  getXP() {
    return this._xp;
  }

  /**
   * Get current tier.
   * @returns {number} Current tier (1-50)
   */
  getCurrentTier() {
    this._currentTier = calculateTierFromXP(this._xp);
    return this._currentTier;
  }

  /**
   * Get XP needed to reach the next tier.
   * @returns {number} XP required for next tier
   */
  getXPToNextTier() {
    return getXPToNextTier(this.getCurrentTier(), this._xp);
  }

  /**
   * Get progress percentage to next tier.
   * @returns {number} Percentage (0-100)
   */
  getTierProgressPercent() {
    const currentTier = this.getCurrentTier();
    if (currentTier >= TOTAL_TIERS) return 100;
    const currentThreshold = TIER_XP_THRESHOLDS[currentTier - 1] || 0;
    const nextThreshold = TIER_XP_THRESHOLDS[currentTier] || TIER_XP_THRESHOLDS[TIER_XP_THRESHOLDS.length - 1];
    const tierXP = this._xp - currentThreshold;
    const tierTotal = nextThreshold - currentThreshold;
    return Math.min(100, Math.round((tierXP / tierTotal) * 100));
  }

  /**
   * Add XP to the battle pass.
   * @param {number} amount - Amount of XP to add
   * @param {string} source - Source of XP (play_time, quest_complete, achievement, etc.)
   * @returns {Object} Result with tierUps array and new tier
   */
  addXP(amount, source = 'unknown') {
    if (!amount || amount <= 0) {
      return { added: 0, tierUps: [], newTier: this._currentTier };
    }

    const oldTier = this._currentTier;
    this._xp += Math.floor(amount);
    const newTier = calculateTierFromXP(this._xp);
    this._currentTier = newTier;

    const tierUps = [];
    for (let tier = oldTier + 1; tier <= newTier; tier++) {
      tierUps.push(tier);
      this._onTierUp(tier);
    }

    if (tierUps.length > 0) {
      this.emit('tierUp', { tiers: tierUps, from: oldTier, to: newTier, source });
    }
    this.emit('xpGained', { amount, source, totalXP: this._xp, newTier });

    this._saveState();
    return { added: amount, tierUps, newTier, oldTier };
  }

  /**
   * Handle tier up event — auto-claim rewards.
   * @private
   * @param {number} tier
   */
  _onTierUp(tier) {
    const freeReward = this.getFreeReward(tier);
    const premiumReward = this.getPremiumReward(tier);

    if (freeReward) {
      this._autoClaimReward(freeReward, 'free');
    }
    if (this._premium && premiumReward) {
      this._autoClaimReward(premiumReward, 'premium');
    }

    this.notificationManager.notify({
      type: 'tier_up',
      title: `Tier ${tier} Reached!`,
      message: `You unlocked ${freeReward ? freeReward.name : 'a reward'}!${this._premium && premiumReward ? ` + Premium: ${premiumReward.name}` : ''}`,
      icon: 'tier_up_icon',
    });
  }

  /**
   * Auto-claim a reward on tier up.
   * @private
   * @param {Object} reward
   * @param {string} track - 'free' or 'premium'
   */
  _autoClaimReward(reward, track) {
    const rewardKey = `${track}_${reward.tier}`;
    const claimedSet = track === 'free' ? this._claimedRewards : this._claimedPremiumRewards;
    if (claimedSet.has(rewardKey)) return;

    claimedSet.add(rewardKey);

    switch (reward.type) {
      case RewardType.COINS:
        this.playerData.addCurrency('coins', reward.amount);
        break;
      case RewardType.SILVER:
        this.playerData.addCurrency('silver', reward.amount);
        break;
      case RewardType.GOLD:
        this.playerData.addCurrency('gold', reward.amount);
        break;
      case RewardType.DIAMONDS:
        this.playerData.addCurrency('diamonds', reward.amount);
        break;
      case RewardType.XP_BOOST:
        this._activateBoost(reward);
        break;
      case RewardType.PERMANENT_BOOST:
        this._permanentBoost = reward.multiplier || 2.0;
        break;
      case RewardType.AREA_ACCESS:
        this.playerData.unlockArea(reward.areaId);
        break;
      case RewardType.TITLE:
        this.playerData.unlockTitle(reward.id, reward.display);
        break;
      case RewardType.CHAT_COLOR:
      case RewardType.NAME_COLOR:
        this.playerData.unlockCosmetic(reward.id, reward.type, reward.color);
        break;
      case RewardType.PROFILE_FRAME:
        this.playerData.unlockCosmetic(reward.id, 'profile_frame');
        break;
      case RewardType.FURNITURE:
      case RewardType.CLOTHING:
      case RewardType.EMOTE:
      case RewardType.BADGE:
      case RewardType.EGG:
        this.inventoryManager.addItem({
          id: reward.id,
          name: reward.name,
          type: reward.type,
          rarity: reward.rarity,
          icon: reward.icon,
          animated: reward.animated || false,
          glowing: reward.glowing || false,
          exclusive: reward.exclusive || false,
          source: 'battle_pass',
          season: this._season.id,
        });
        break;
    }

    this.emit('rewardClaimed', { reward, track, tier: reward.tier });
  }

  /**
   * Activate a temporary XP boost.
   * @private
   * @param {Object} boost
   */
  _activateBoost(boost) {
    const expiresAt = new Date(Date.now() + (boost.duration || 3600) * 1000);
    this._activeBoosts.push({
      multiplier: boost.multiplier || 1.5,
      expiresAt,
      source: boost.id,
    });
    this.emit('boostActivated', { boost, expiresAt });
  }

  // ==========================================================================
  // REWARD CATALOG API
  // ==========================================================================

  /**
   * Get the free reward for a specific tier.
   * @param {number} tier
   * @returns {Object|null} Reward object or null
   */
  getFreeReward(tier) {
    return FREE_TIER_REWARDS.find((r) => r.tier === tier) || null;
  }

  /**
   * Get the premium reward for a specific tier.
   * @param {number} tier
   * @returns {Object|null} Reward object or null
   */
  getPremiumReward(tier) {
    return PREMIUM_TIER_REWARDS.find((r) => r.tier === tier) || null;
  }

  /**
   * Get all free rewards.
   * @returns {Array} Array of all free tier rewards
   */
  getAllFreeRewards() {
    return FREE_TIER_REWARDS.map((r) => ({
      ...r,
      claimed: this._claimedRewards.has(`free_${r.tier}`),
      unlocked: r.tier <= this._currentTier,
    }));
  }

  /**
   * Get all premium rewards.
   * @returns {Array} Array of all premium tier rewards
   */
  getAllPremiumRewards() {
    return PREMIUM_TIER_REWARDS.map((r) => ({
      ...r,
      claimed: this._claimedPremiumRewards.has(`premium_${r.tier}`),
      unlocked: this._premium && r.tier <= this._currentTier,
      preview: !this._premium,
    }));
  }

  /**
   * Get full reward catalog with both tracks.
   * @returns {Object} Object with free and premium arrays
   */
  getRewardCatalog() {
    return {
      free: this.getAllFreeRewards(),
      premium: this.getAllPremiumRewards(),
      season: this._season,
      currentTier: this._currentTier,
      isPremium: this._premium,
      totalTiers: TOTAL_TIERS,
    };
  }

  /**
   * Get reward preview data for a specific tier.
   * @param {number} tier
   * @returns {Object} Object with freeReward and premiumReward
   */
  getTierPreview(tier) {
    return {
      tier,
      freeReward: this.getFreeReward(tier),
      premiumReward: this.getPremiumReward(tier),
      unlocked: tier <= this._currentTier,
      freeClaimed: this._claimedRewards.has(`free_${tier}`),
      premiumClaimed: this._claimedPremiumRewards.has(`premium_${tier}`),
      premiumEligible: this._premium && tier <= this._currentTier,
    };
  }

  /**
   * Manually claim a reward for a tier (if auto-claim failed or for re-claim).
   * @param {number} tier
   * @param {string} track - 'free' or 'premium'
   * @returns {boolean} Whether claim was successful
   */
  claimReward(tier, track = 'free') {
    if (tier < 1 || tier > TOTAL_TIERS) return false;
    if (tier > this._currentTier) return false;

    const reward = track === 'free' ? this.getFreeReward(tier) : this.getPremiumReward(tier);
    if (!reward) return false;

    const rewardKey = `${track}_${tier}`;
    const claimedSet = track === 'free' ? this._claimedRewards : this._claimedPremiumRewards;
    if (claimedSet.has(rewardKey)) return false;

    if (track === 'premium' && !this._premium) return false;

    this._autoClaimReward(reward, track);
    this._saveState();
    return true;
  }

  /**
   * Get preview data for an item (for UI display).
   * @param {string} itemId
   * @returns {Object|null} Item preview data
   */
  getItemPreview(itemId) {
    const freeItem = FREE_TIER_REWARDS.find((r) => r.id === itemId);
    const premiumItem = PREMIUM_TIER_REWARDS.find((r) => r.id === itemId);
    const item = freeItem || premiumItem;
    if (!item) return null;

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      type: item.type,
      rarity: item.rarity,
      icon: item.icon,
      animated: item.animated || false,
      glowing: item.glowing || false,
      exclusive: item.exclusive || false,
      amount: item.amount || null,
      color: item.color || null,
      duration: item.duration || null,
      source: freeItem ? 'free_track' : 'premium_track',
      tier: item.tier,
    };
  }

  // ==========================================================================
  // PREMIUM STATUS & PURCHASE
  // ==========================================================================

  /**
   * Check if player has premium battle pass.
   * @returns {boolean} Premium status
   */
  isPremium() {
    return this._premium;
  }

  /**
   * Purchase premium battle pass.
   * @returns {Promise<Object>} Purchase result
   */
  async purchasePremium() {
    if (this._premium) {
      return { success: false, error: 'ALREADY_PREMIUM', message: 'You already have the premium battle pass.' };
    }

    try {
      const result = await this._processStripePayment({
        amount: PREMIUM_PRICE_USD,
        currency: 'USD',
        description: `${this._season.name} Premium Battle Pass`,
        productId: this._stripeProductId,
        metadata: {
          playerId: this.playerId,
          seasonId: this._season.id,
          type: 'battle_pass_premium',
        },
      });

      if (result.success) {
        this._premium = true;
        this._saveState();

        // Retroactively claim premium rewards for already-unlocked tiers
        for (let tier = 1; tier <= this._currentTier; tier++) {
          const premiumReward = this.getPremiumReward(tier);
          if (premiumReward) {
            this._autoClaimReward(premiumReward, 'premium');
          }
        }

        this.emit('premiumPurchased', { seasonId: this._season.id, transactionId: result.transactionId });
        this.notificationManager.notify({
          type: 'premium_unlocked',
          title: 'Premium Unlocked!',
          message: `Welcome to the ${this._season.name} Premium track! ${this._currentTier} rewards claimed!`,
          icon: 'premium_unlock_icon',
        });

        return {
          success: true,
          transactionId: result.transactionId,
          seasonId: this._season.id,
          tiersClaimed: this._currentTier,
        };
      }

      return { success: false, error: result.error || 'PAYMENT_FAILED', message: result.message };
    } catch (error) {
      this._log('error', 'Premium purchase failed:', error.message);
      return { success: false, error: 'PAYMENT_ERROR', message: error.message };
    }
  }

  /**
   * Process Stripe payment.
   * @private
   * @param {Object} paymentDetails
   * @returns {Promise<Object>} Payment result
   */
  async _processStripePayment(paymentDetails) {
    if (this._stripeMode === 'mock') {
      // Mock mode for testing — simulate payment
      await this._mockPaymentDelay();
      const mockTransactionId = `mock_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      this._log('info', `Mock payment processed: ${mockTransactionId} for $${paymentDetails.amount}`);
      return {
        success: true,
        transactionId: mockTransactionId,
        mode: 'mock',
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
      };
    }

    return this.stripeCheckout.createCheckoutSession({
      line_items: [{
        price_data: {
          currency: paymentDetails.currency.toLowerCase(),
          product_data: { name: paymentDetails.description },
          unit_amount: Math.round(paymentDetails.amount * 100),
        },
        quantity: 1,
      }],
      metadata: paymentDetails.metadata,
      success_url: `${window.location.origin}/battle-pass/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${window.location.origin}/battle-pass/cancel`,
    });
  }

  /**
   * Simulate payment processing delay in mock mode.
   * @private
   * @returns {Promise<void>}
   */
  _mockPaymentDelay() {
    return new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));
  }

  // ==========================================================================
  // TIER SKIP / PURCHASE
  // ==========================================================================

  /**
   * Get the cost to skip to a specific tier.
   * @param {number} targetTier
   * @returns {Object} Cost breakdown
   */
  getTierSkipCost(targetTier) {
    if (targetTier <= this._currentTier || targetTier > TOTAL_TIERS) {
      return { valid: false, goldCost: 0, usdCost: 0 };
    }
    const tiersToSkip = targetTier - this._currentTier;
    const goldCost = tiersToSkip * TIER_SKIP_COST_GOLD;
    const usdCost = tiersToSkip * 0.99;
    return { valid: true, tiersToSkip, goldCost, usdCost };
  }

  /**
   * Skip tiers using gold currency.
   * @param {number} targetTier
   * @returns {Object} Purchase result
   */
  skipTiersWithGold(targetTier) {
    const cost = this.getTierSkipCost(targetTier);
    if (!cost.valid) {
      return { success: false, error: 'INVALID_TIER', message: 'Cannot skip to that tier.' };
    }

    const currentGold = this.playerData.getCurrency('gold') || 0;
    if (currentGold < cost.goldCost) {
      return { success: false, error: 'INSUFFICIENT_GOLD', message: `Need ${cost.goldCost} gold, have ${currentGold}.` };
    }

    this.playerData.deductCurrency('gold', cost.goldCost);
    const oldTier = this._currentTier;
    const oldXP = this._xp;
    this._xp = TIER_XP_THRESHOLDS[targetTier - 1] || 0;
    this._currentTier = targetTier;

    this._tierPurchaseHistory.push({
      fromTier: oldTier,
      toTier: targetTier,
      cost: cost.goldCost,
      currency: 'gold',
      timestamp: new Date().toISOString(),
    });

    for (let tier = oldTier + 1; tier <= targetTier; tier++) {
      this._onTierUp(tier);
    }

    this.emit('tiersSkipped', { from: oldTier, to: targetTier, cost: cost.goldCost });
    this._saveState();

    return {
      success: true,
      fromTier: oldTier,
      toTier: targetTier,
      cost: cost.goldCost,
      currency: 'gold',
    };
  }

  /**
   * Skip tiers using real money (Stripe).
   * @param {number} targetTier
   * @returns {Promise<Object>} Purchase result
   */
  async skipTiersWithMoney(targetTier) {
    const cost = this.getTierSkipCost(targetTier);
    if (!cost.valid) {
      return { success: false, error: 'INVALID_TIER', message: 'Cannot skip to that tier.' };
    }

    try {
      const result = await this._processStripePayment({
        amount: cost.usdCost,
        currency: 'USD',
        description: `Skip to Tier ${targetTier} — ${this._season.name} Battle Pass`,
        productId: `bp_tierskip_${targetTier}`,
        metadata: {
          playerId: this.playerId,
          seasonId: this._season.id,
          fromTier: this._currentTier,
          toTier: targetTier,
          type: 'battle_pass_tier_skip',
        },
      });

      if (result.success) {
        const oldTier = this._currentTier;
        this._xp = TIER_XP_THRESHOLDS[targetTier - 1] || 0;
        this._currentTier = targetTier;

        this._tierPurchaseHistory.push({
          fromTier: oldTier,
          toTier: targetTier,
          cost: cost.usdCost,
          currency: 'USD',
          transactionId: result.transactionId,
          timestamp: new Date().toISOString(),
        });

        for (let tier = oldTier + 1; tier <= targetTier; tier++) {
          this._onTierUp(tier);
        }

        this.emit('tiersSkipped', { from: oldTier, to: targetTier, cost: cost.usdCost, currency: 'USD' });
        this._saveState();

        return {
          success: true,
          fromTier: oldTier,
          toTier: targetTier,
          cost: cost.usdCost,
          currency: 'USD',
          transactionId: result.transactionId,
        };
      }

      return { success: false, error: result.error || 'PAYMENT_FAILED' };
    } catch (error) {
      return { success: false, error: 'PAYMENT_ERROR', message: error.message };
    }
  }

  // ==========================================================================
  // GIFT SYSTEM
  // ==========================================================================

  /**
   * Gift a premium battle pass to a friend.
   * @param {string} friendId
   * @returns {Promise<Object>} Gift result
   */
  async giftPremiumToFriend(friendId) {
    if (!friendId || typeof friendId !== 'string') {
      return { success: false, error: 'INVALID_FRIEND_ID', message: 'Invalid friend ID.' };
    }

    try {
      const result = await this._processStripePayment({
        amount: PREMIUM_PRICE_USD,
        currency: 'USD',
        description: `Gift: ${this._season.name} Premium Battle Pass`,
        productId: `${this._stripeProductId}_gift`,
        metadata: {
          senderId: this.playerId,
          recipientId: friendId,
          seasonId: this._season.id,
          type: 'battle_pass_gift',
        },
      });

      if (result.success) {
        this._giftHistory.push({
          recipientId: friendId,
          seasonId: this._season.id,
          transactionId: result.transactionId,
          timestamp: new Date().toISOString(),
        });

        this.emit('giftSent', { recipientId: friendId, seasonId: this._season.id });
        this.notificationManager.notify({
          type: 'gift_sent',
          title: 'Gift Sent!',
          message: `Premium Battle Pass sent to friend!`,
          icon: 'gift_icon',
        });

        this._saveState();
        return {
          success: true,
          recipientId: friendId,
          transactionId: result.transactionId,
          seasonId: this._season.id,
        };
      }

      return { success: false, error: result.error || 'GIFT_FAILED' };
    } catch (error) {
      return { success: false, error: 'GIFT_ERROR', message: error.message };
    }
  }

  /**
   * Accept a gifted premium battle pass.
   * @param {string} giftTransactionId
   * @returns {boolean} Whether acceptance was successful
   */
  acceptGiftedPremium(giftTransactionId) {
    if (this._premium) {
      return false;
    }
    this._premium = true;
    this._saveState();

    for (let tier = 1; tier <= this._currentTier; tier++) {
      const premiumReward = this.getPremiumReward(tier);
      if (premiumReward) {
        this._autoClaimReward(premiumReward, 'premium');
      }
    }

    this.emit('giftReceived', { transactionId: giftTransactionId, seasonId: this._season.id });
    this.notificationManager.notify({
      type: 'gift_received',
      title: 'Gift Received!',
      message: 'A friend gifted you the Premium Battle Pass!',
      icon: 'gift_icon',
    });
    return true;
  }

  /**
   * Get gift history.
   * @returns {Array} Array of gift records
   */
  getGiftHistory() {
    return [...this._giftHistory];
  }

  // ==========================================================================
  // PROGRESS BAR & UI DATA
  // ==========================================================================

  /**
   * Get data for rendering the progress bar UI.
   * @returns {Object} Progress bar data
   */
  getProgressBarData() {
    const currentTier = this.getCurrentTier();
    const xpToNext = this.getXPToNextTier();
    const progressPercent = this.getTierProgressPercent();
    const currentThreshold = TIER_XP_THRESHOLDS[currentTier - 1] || 0;
    const nextThreshold = TIER_XP_THRESHOLDS[currentTier] || TIER_XP_THRESHOLDS[TIER_XP_THRESHOLDS.length - 1];
    const tierXP = this._xp - currentThreshold;
    const tierTotal = nextThreshold - currentThreshold;

    return {
      currentTier,
      totalTiers: TOTAL_TIERS,
      currentXP: this._xp,
      xpToNext,
      progressPercent,
      tierXP,
      tierTotal,
      isPremium: this._premium,
      season: this._season,
      currentFreeReward: this.getFreeReward(currentTier + 1 <= TOTAL_TIERS ? currentTier + 1 : currentTier),
      nextPremiumReward: this.getPremiumReward(currentTier + 1 <= TOTAL_TIERS ? currentTier + 1 : currentTier),
      premiumPrice: PREMIUM_PRICE_USD,
      activeBoosts: this._activeBoosts.filter((b) => new Date(b.expiresAt) > new Date()),
      permanentBoost: this._permanentBoost,
    };
  }

  /**
   * Get preview data for the premium track (for non-premium players).
   * @returns {Array} Array of premium rewards with preview flag
   */
  getPremiumTrackPreview() {
    return PREMIUM_TIER_REWARDS.slice(0, 5).map((reward) => ({
      ...this.getItemPreview(reward.id),
      locked: true,
    }));
  }

  /**
   * Get the "next rewards" preview for UI display.
   * @returns {Object} Next free and premium rewards
   */
  getNextRewardsPreview() {
    const nextTier = Math.min(this._currentTier + 1, TOTAL_TIERS);
    return {
      nextTier,
      free: this.getFreeReward(nextTier),
      premium: this.getPremiumReward(nextTier),
      canClaimFree: nextTier <= this._currentTier + 1,
      canClaimPremium: this._premium && nextTier <= this._currentTier + 1,
    };
  }

  // ==========================================================================
  // SEASON INFO
  // ==========================================================================

  /**
   * Get current season information.
   * @returns {Object} Season details
   */
  getCurrentSeason() {
    return { ...this._season };
  }

  /**
   * Get all seasons list.
   * @returns {Array} Array of season objects
   */
  getAllSeasons() {
    return Object.values(SEASONS).map((s) => ({
      ...s,
      current: s.id === this._season.id,
    }));
  }

  /**
   * Get time remaining in current season.
   * @returns {Object} Days, hours, minutes remaining
   */
  getSeasonTimeRemaining() {
    const end = new Date(this._season.endDate);
    const now = new Date();
    const diff = end - now;
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, totalSeconds: 0 };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { days, hours, minutes, totalSeconds: Math.floor(diff / 1000) };
  }

  // ==========================================================================
  // STATISTICS & ANALYTICS
  // ==========================================================================

  /**
   * Get battle pass statistics.
   * @returns {Object} Stats object
   */
  getStats() {
    const freeClaimed = this._claimedRewards.size;
    const premiumClaimed = this._claimedPremiumRewards.size;
    const totalFreeRewards = FREE_TIER_REWARDS.length;
    const totalPremiumRewards = PREMIUM_TIER_REWARDS.length;
    const timeRemaining = this.getSeasonTimeRemaining();

    return {
      currentTier: this._currentTier,
      totalXP: this._xp,
      isPremium: this._premium,
      freeProgress: { claimed: freeClaimed, total: totalFreeRewards, percent: Math.round((freeClaimed / totalFreeRewards) * 100) },
      premiumProgress: this._premium ? { claimed: premiumClaimed, total: totalPremiumRewards, percent: Math.round((premiumClaimed / totalPremiumRewards) * 100) } : null,
      tierPurchaseCount: this._tierPurchaseHistory.length,
      giftsSent: this._giftHistory.length,
      sessionXP: this._sessionXP,
      playTimeMinutes: Math.floor(this._playTimeSeconds / 60),
      season: this._season,
      seasonTimeRemaining: timeRemaining,
      xpSources: this._analyzeXPSources(),
    };
  }

  /**
   * Analyze XP sources for analytics.
   * @private
   * @returns {Object} XP breakdown
   */
  _analyzeXPSources() {
    return {
      perMinute: XP_PER_MINUTE,
      perMinuteWithBoost: XP_PER_MINUTE * this._permanentBoost,
      dailyQuestTotal: MAX_DAILY_QUESTS * DAILY_QUEST_XP,
      weeklyChallengeTotal: WEEKLY_CHALLENGE_XP,
      estimatedWeeklyXP: (MAX_DAILY_QUESTS * DAILY_QUEST_XP * 7) + WEEKLY_CHALLENGE_XP + (XP_PER_MINUTE * 60 * 24 * 7 * this._permanentBoost),
    };
  }

  // ==========================================================================
  // UTILITY / INTERNAL
  // ==========================================================================

  /**
   * Storage helper — reads from localStorage or memory fallback.
   * @private
   * @param {string} key
   * @returns {string|null}
   */
  _getStorage(key) {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return this._memoryStorage?.[key] || null;
  }

  /**
   * Storage helper — writes to localStorage or memory fallback.
   * @private
   * @param {string} key
   * @param {string} value
   */
  _setStorage(key, value) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    } else {
      this._memoryStorage = this._memoryStorage || {};
      this._memoryStorage[key] = value;
    }
  }

  /**
   * Log helper.
   * @private
   * @param {string} level
   * @param {...any} args
   */
  _log(level, ...args) {
    const prefix = `[BattlePass:${this.playerId}]`;
    if (level === 'error') {
      console.error(prefix, ...args);
    } else if (level === 'warn') {
      console.warn(prefix, ...args);
    } else {
      console.log(prefix, ...args);
    }
  }

  /**
   * Clean up resources.
   */
  destroy() {
    this.stopPlayTimeTracker();
    this.removeAllListeners();
    this._saveState();
  }

  // ==========================================================================
  // ACHIEVEMENT INTEGRATION
  // ==========================================================================

  /**
   * Grant XP from achievement completion.
   * @param {Object} achievement
   * @returns {Object} XP result
   */
  onAchievementComplete(achievement) {
    const xpAmount = achievement.xpReward || 100;
    return this.addXP(xpAmount, 'achievement');
  }

  /**
   * Grant XP from minigame completion.
   * @param {Object} result
   * @returns {Object} XP result
   */
  onMinigameComplete(result) {
    const baseXP = 50;
    const placementMultiplier = { first: 3, second: 2, third: 1.5 }[result.placement] || 1;
    const xpAmount = Math.floor(baseXP * placementMultiplier);
    return this.addXP(xpAmount, 'minigame');
  }

  /**
   * Grant XP from trading.
   * @param {Object} trade
   * @returns {Object} XP result
   */
  onTradeComplete(trade) {
    const xpAmount = 25;
    return this.addXP(xpAmount, 'trade');
  }

  // ==========================================================================
  // SYNC & SERVER COMMUNICATION
  // ==========================================================================

  /**
   * Sync battle pass state with server.
   * @returns {Promise<boolean>} Whether sync was successful
   */
  async syncWithServer() {
    try {
      const payload = {
        playerId: this.playerId,
        xp: this._xp,
        currentTier: this._currentTier,
        seasonId: this._season.id,
        premium: this._premium,
        claimedRewards: Array.from(this._claimedRewards),
        claimedPremiumRewards: Array.from(this._claimedPremiumRewards),
        timestamp: new Date().toISOString(),
      };

      const response = await fetch('/api/battle-pass/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const serverState = await response.json();
        if (serverState.xp > this._xp) {
          this._xp = serverState.xp;
          this._currentTier = calculateTierFromXP(this._xp);
        }
        if (serverState.premium && !this._premium) {
          this._premium = true;
        }
        this._saveState();
        this.emit('syncComplete', { serverState });
        return true;
      }
      return false;
    } catch (error) {
      this._log('error', 'Server sync failed:', error.message);
      return false;
    }
  }

  /**
   * Force server-side tier update (for server-authoritative validation).
   * @param {number} serverXP
   * @param {boolean} serverPremium
   */
  onServerUpdate(serverXP, serverPremium) {
    if (serverXP > this._xp) {
      const oldTier = this._currentTier;
      this._xp = serverXP;
      this._currentTier = calculateTierFromXP(this._xp);
      for (let tier = oldTier + 1; tier <= this._currentTier; tier++) {
        this._onTierUp(tier);
      }
    }
    if (serverPremium && !this._premium) {
      this._premium = true;
      for (let tier = 1; tier <= this._currentTier; tier++) {
        const premiumReward = this.getPremiumReward(tier);
        if (premiumReward) {
          this._autoClaimReward(premiumReward, 'premium');
        }
      }
    }
    this._saveState();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { BattlePass, FREE_TIER_REWARDS, PREMIUM_TIER_REWARDS, SEASONS, RewardType, Rarity, DAILY_QUEST_POOL, WEEKLY_CHALLENGE_POOL };
export default BattlePass;
