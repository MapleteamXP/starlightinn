/**
 * RareEggs.js
 * Starlight Inn v7.0 — Gacha-style Rare Egg Hatching System
 * 20+ egg types across 5 rarities with procedural reward pools,
 * hatch timers, animation sequences, and badge drops.
 *
 * @version 7.0.0
 * @module StarlightInn/assets/RareEggs
 */

'use strict';

/* ──────────── rarity table & probability weights ──────────── */
const RARITY_WEIGHTS = {
  Common:    { weight: 50, label: 'Common',    color: '#B0BEC5', glow: '#ECEFF1', starCount: 1 },
  Uncommon:  { weight: 30, label: 'Uncommon',  color: '#66BB6A', glow: '#C8E6C9', starCount: 2 },
  Rare:      { weight: 15, label: 'Rare',      color: '#42A5F5', glow: '#BBDEFB', starCount: 3 },
  Epic:      { weight: 4,  label: 'Epic',      color: '#AB47BC', glow: '#E1BEE7', starCount: 4 },
  Legendary: { weight: 1,  label: 'Legendary', color: '#FFD700', glow: '#FFF9C4', starCount: 5 },
};

const TOTAL_WEIGHT = Object.values(RARITY_WEIGHTS).reduce((s, r) => s + r.weight, 0);

function rollRarity(seed = Math.random()) {
  let roll = seed * TOTAL_WEIGHT;
  for (const [key, data] of Object.entries(RARITY_WEIGHTS)) {
    roll -= data.weight;
    if (roll <= 0) return key;
  }
  return 'Common';
}

function rarityIndex(rarity) {
  return ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].indexOf(rarity);
}

/* ──────────── reward pool definitions ──────────── */
const REWARD_POOLS = {
  furniture_common: [
    { type: 'furniture', id: 'sofa_red',      chance: 12 },
    { type: 'furniture', id: 'sofa_blue',     chance: 12 },
    { type: 'furniture', id: 'armchair_red',  chance: 10 },
    { type: 'furniture', id: 'stool_wood',    chance: 10 },
    { type: 'furniture', id: 'table_coffee_wood', chance: 10 },
    { type: 'furniture', id: 'table_side_wood',   chance: 10 },
    { type: 'furniture', id: 'bed_single_white',  chance: 8 },
    { type: 'furniture', id: 'lamp_floor',    chance: 8 },
    { type: 'furniture', id: 'plant_potted_small', chance: 8 },
    { type: 'furniture', id: 'rug_red',       chance: 6 },
    { type: 'furniture', id: 'outdoor_bench', chance: 6 },
  ],
  furniture_uncommon: [
    { type: 'furniture', id: 'sofa_purple',   chance: 10 },
    { type: 'furniture', id: 'bench_stone',   chance: 10 },
    { type: 'furniture', id: 'table_coffee_glass', chance: 10 },
    { type: 'furniture', id: 'bed_double_white', chance: 10 },
    { type: 'furniture', id: 'bookshelf_wood', chance: 10 },
    { type: 'furniture', id: 'tv_flatscreen', chance: 10 },
    { type: 'furniture', id: 'mirror_gold',   chance: 8 },
    { type: 'furniture', id: 'plant_tree_palm', chance: 8 },
    { type: 'furniture', id: 'grill_bbq',     chance: 8 },
    { type: 'furniture', id: 'tent_camping',  chance: 8 },
    { type: 'furniture', id: 'dj_booth',      chance: 4 },
    { type: 'furniture', id: 'arcade_machine', chance: 4 },
  ],
  furniture_rare: [
    { type: 'furniture', id: 'sofa_gold',     chance: 10 },
    { type: 'furniture', id: 'table_dining_marble', chance: 10 },
    { type: 'furniture', id: 'bed_double_royal', chance: 10 },
    { type: 'furniture', id: 'wardrobe_modern', chance: 10 },
    { type: 'furniture', id: 'computer_gaming', chance: 10 },
    { type: 'furniture', id: 'chandelier_small', chance: 10 },
    { type: 'furniture', id: 'fountain_small', chance: 10 },
    { type: 'furniture', id: 'trophy_gold',   chance: 10 },
    { type: 'furniture', id: 'dance_floor',   chance: 8 },
    { type: 'furniture', id: 'portal_green',  chance: 6 },
    { type: 'furniture', id: 'treasure_chest', chance: 6 },
  ],
  furniture_epic: [
    { type: 'furniture', id: 'throne_gold',   chance: 12 },
    { type: 'furniture', id: 'chandelier_grand', chance: 12 },
    { type: 'furniture', id: 'statue_angel',  chance: 12 },
    { type: 'furniture', id: 'portal_purple', chance: 12 },
    { type: 'furniture', id: 'teleporter',    chance: 12 },
    { type: 'furniture', id: 'jukebox',       chance: 12 },
    { type: 'furniture', id: 'disco_ball',    chance: 12 },
    { type: 'furniture', id: 'magic_cauldron', chance: 10 },
    { type: 'furniture', id: 'statue_gold',   chance: 6 },
  ],
  furniture_legendary: [
    { type: 'furniture', id: 'throne_shadow', chance: 15 },
    { type: 'furniture', id: 'statue_gold',   chance: 15 },
    { type: 'furniture', id: 'dj_booth',      chance: 15 },
    { type: 'furniture', id: 'treasure_chest', chance: 15 },
    { type: 'furniture', id: 'portal_purple', chance: 15 },
    { type: 'furniture', id: 'disco_ball',    chance: 15 },
    { type: 'furniture', id: 'magic_cauldron', chance: 10 },
  ],
  clothing_common: [
    { type: 'clothing', id: 'shirt_white',  chance: 10 },
    { type: 'clothing', id: 'shirt_black',  chance: 10 },
    { type: 'clothing', id: 'shirt_red',    chance: 10 },
    { type: 'clothing', id: 'shirt_blue',   chance: 10 },
    { type: 'clothing', id: 'pants_jean',   chance: 10 },
    { type: 'clothing', id: 'pants_shorts_red', chance: 10 },
    { type: 'clothing', id: 'shoes_sneaker_white', chance: 10 },
    { type: 'clothing', id: 'shoes_sandals', chance: 10 },
    { type: 'clothing', id: 'hat_cap_red',  chance: 8 },
    { type: 'clothing', id: 'hat_cap_blue', chance: 8 },
    { type: 'clothing', id: 'glasses_black', chance: 8 },
    { type: 'clothing', id: 'mask_white',   chance: 6 },
  ],
  clothing_uncommon: [
    { type: 'clothing', id: 'shirt_striped', chance: 10 },
    { type: 'clothing', id: 'hoodie_navy',  chance: 10 },
    { type: 'clothing', id: 'pants_skirt_pink', chance: 10 },
    { type: 'clothing', id: 'pants_sweatpants', chance: 10 },
    { type: 'clothing', id: 'shoes_boots_brown', chance: 10 },
    { type: 'clothing', id: 'shoes_slippers', chance: 10 },
    { type: 'clothing', id: 'hat_beanie_grey', chance: 10 },
    { type: 'clothing', id: 'necklace_gold', chance: 10 },
    { type: 'clothing', id: 'backpack_red', chance: 10 },
    { type: 'clothing', id: 'blush_pink',   chance: 10 },
  ],
  clothing_rare: [
    { type: 'clothing', id: 'jacket_leather', chance: 12 },
    { type: 'clothing', id: 'jacket_bomber', chance: 12 },
    { type: 'clothing', id: 'dress_red',    chance: 12 },
    { type: 'clothing', id: 'suit_navy',    chance: 12 },
    { type: 'clothing', id: 'shoes_boots_black', chance: 12 },
    { type: 'clothing', id: 'hat_bunny_ears', chance: 12 },
    { type: 'clothing', id: 'wings_white',  chance: 10 },
    { type: 'clothing', id: 'horns_red',    chance: 10 },
    { type: 'clothing', id: 'facepaint_star', chance: 8 },
  ],
  clothing_epic: [
    { type: 'clothing', id: 'dress_gold',   chance: 15 },
    { type: 'clothing', id: 'suit_white',   chance: 15 },
    { type: 'clothing', id: 'wizard_robe',  chance: 15 },
    { type: 'clothing', id: 'hat_wizard',   chance: 15 },
    { type: 'clothing', id: 'wings_gold',   chance: 15 },
    { type: 'clothing', id: 'halo_gold',    chance: 15 },
    { type: 'clothing', id: 'facepaint_stripe', chance: 10 },
  ],
  clothing_legendary: [
    { type: 'clothing', id: 'hat_crown_gold', chance: 25 },
    { type: 'clothing', id: 'dress_gold',   chance: 20 },
    { type: 'clothing', id: 'wings_gold',   chance: 20 },
    { type: 'clothing', id: 'halo_gold',    chance: 20 },
    { type: 'clothing', id: 'wizard_robe',  chance: 15 },
  ],
  coins_common:    [{ type: 'coins', amount: 50,  chance: 30 }, { type: 'coins', amount: 100, chance: 20 }, { type: 'coins', amount: 25,  chance: 50 }],
  coins_uncommon:  [{ type: 'coins', amount: 150, chance: 30 }, { type: 'coins', amount: 200, chance: 20 }, { type: 'coins', amount: 100, chance: 50 }],
  coins_rare:      [{ type: 'coins', amount: 300, chance: 30 }, { type: 'coins', amount: 500, chance: 15 }, { type: 'coins', amount: 200, chance: 55 }],
  coins_epic:      [{ type: 'coins', amount: 750, chance: 25 }, { type: 'coins', amount: 1000, chance: 10 }, { type: 'coins', amount: 500, chance: 65 }],
  coins_legendary: [{ type: 'coins', amount: 2000, chance: 20 }, { type: 'coins', amount: 5000, chance: 5 }, { type: 'coins', amount: 1000, chance: 75 }],
};

/* badge pool */
const BADGE_POOL = [
  { id: 'badge_starter',   name: 'Starlight Starter',   chance: 20 },
  { id: 'badge_explorer',  name: 'Room Explorer',       chance: 15 },
  { id: 'badge_collector', name: 'Furniture Collector',  chance: 12 },
  { id: 'badge_social',    name: 'Social Butterfly',      chance: 12 },
  { id: 'badge_dancer',    name: 'Dance Floor King',     chance: 10 },
  { id: 'badge_dj',        name: 'DJ Master',            chance: 10 },
  { id: 'badge_rich',      name: 'Coin Hoarder',         chance: 8 },
  { id: 'badge_rare',      name: 'Rare Finder',          chance: 6 },
  { id: 'badge_epic',      name: 'Epic Hunter',          chance: 4 },
  { id: 'badge_legend',    name: 'Living Legend',        chance: 3 },
];

/* ──────────── egg type definitions ──────────── */
const EGG_TYPES = [
  { id: 'egg_star',       name: 'Star Egg',       theme: 'celestial', colors: { shell: '#FFEE58', spots: '#FFD700', glow: '#FFF9C4' } },
  { id: 'egg_moon',       name: 'Moon Egg',       theme: 'celestial', colors: { shell: '#E0E0E0', spots: '#9E9E9E', glow: '#F5F5F5' } },
  { id: 'egg_crystal',    name: 'Crystal Egg',     theme: 'elemental', colors: { shell: '#B3E5FC', spots: '#0288D1', glow: '#E1F5FE' } },
  { id: 'egg_golden',     name: 'Golden Egg',      theme: 'treasure',  colors: { shell: '#FFD700', spots: '#F57F17', glow: '#FFF9C4' } },
  { id: 'egg_rainbow',    name: 'Rainbow Egg',     theme: 'celestial', colors: { shell: '#FF4081', spots: '#00E5FF', glow: '#F8BBD0' } },
  { id: 'egg_shadow',     name: 'Shadow Egg',      theme: 'dark',      colors: { shell: '#424242', spots: '#000000', glow: '#9E9E9E' } },
  { id: 'egg_fire',       name: 'Fire Egg',        theme: 'elemental', colors: { shell: '#FF5722', spots: '#BF360C', glow: '#FFAB91' } },
  { id: 'egg_ice',        name: 'Ice Egg',         theme: 'elemental', colors: { shell: '#E0F7FA', spots: '#00BCD4', glow: '#B2EBF2' } },
  { id: 'egg_nature',     name: 'Nature Egg',      theme: 'elemental', colors: { shell: '#C8E6C9', spots: '#388E3C', glow: '#A5D6A7' } },
  { id: 'egg_tech',       name: 'Tech Egg',        theme: 'future',    colors: { shell: '#212121', spots: '#00E676', glow: '#69F0AE' } },
  { id: 'egg_ocean',      name: 'Ocean Egg',       theme: 'elemental', colors: { shell: '#1976D2', spots: '#0D47A1', glow: '#90CAF9' } },
  { id: 'egg_galaxy',     name: 'Galaxy Egg',      theme: 'celestial', colors: { shell: '#1A237E', spots: '#7C4DFF', glow: '#B388FF' } },
  { id: 'egg_chocolate',  name: 'Chocolate Egg',   theme: 'sweet',     colors: { shell: '#795548', spots: '#3E2723', glow: '#A1887F' } },
  { id: 'egg_candy',      name: 'Candy Egg',       theme: 'sweet',     colors: { shell: '#F48FB1', spots: '#EC407A', glow: '#FCE4EC' } },
  { id: 'egg_ghost',      name: 'Ghost Egg',       theme: 'dark',      colors: { shell: '#FAFAFA', spots: '#E0E0E0', glow: '#FFFFFF' } },
  { id: 'egg_music',      name: 'Music Egg',       theme: 'future',    colors: { shell: '#AB47BC', spots: '#4A148C', glow: '#E1BEE7' } },
  { id: 'egg_love',       name: 'Love Egg',        theme: 'celestial', colors: { shell: '#F06292', spots: '#C2185B', glow: '#F8BBD0' } },
  { id: 'egg_lucky',      name: 'Lucky Egg',       theme: 'treasure',  colors: { shell: '#66BB6A', spots: '#1B5E20', glow: '#C8E6C9' } },
  { id: 'egg_time',       name: 'Time Egg',        theme: 'future',    colors: { shell: '#607D8B', spots: '#263238', glow: '#B0BEC5' } },
  { id: 'egg_comet',      name: 'Comet Egg',       theme: 'celestial', colors: { shell: '#FF9800', spots: '#E65100', glow: '#FFE0B2' } },
];

/* ──────────── egg factory ──────────── */
function createEgg(typeId, rarityOverride = null) {
  const template = EGG_TYPES.find(e => e.id === typeId) || EGG_TYPES[0];
  const rarity = rarityOverride || rollRarity();
  const rarityData = RARITY_WEIGHTS[rarity];
  const hatchHours = Math.max(1, 6 - rarityIndex(rarity) * 1 + Math.floor(Math.random() * 4));

  return {
    id: `${typeId}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    typeId: template.id,
    name: `${rarityData.label} ${template.name}`,
    rarity,
    theme: template.theme,
    colors: template.colors,
    hatchTimeHours: hatchHours,
    placedAt: Date.now(),
    hatchAt: Date.now() + hatchHours * 3600 * 1000,
    isHatched: false,
    rewardPool: buildRewardPool(rarity, template.theme),
    draw(ctx, x, y, scale = 1, bounce = 0) {
      drawEggSprite(ctx, x, y + bounce, scale, template.colors, rarityData);
    },
    drawHatching(ctx, x, y, progress) {
      drawHatchAnimation(ctx, x, y, progress, template.colors, rarityData);
    },
  };
}

function buildRewardPool(rarity, theme) {
  const pool = [];
  const ri = rarityIndex(rarity);
  const rKey = rarity.toLowerCase();

  // furniture (40% chance)
  if (Math.random() < 0.40) {
    const fPool = REWARD_POOLS[`furniture_${rKey}`] || REWARD_POOLS.furniture_common;
    pool.push(pickWeighted(fPool));
  }
  // clothing (30% chance)
  if (Math.random() < 0.30) {
    const cPool = REWARD_POOLS[`clothing_${rKey}`] || REWARD_POOLS.clothing_common;
    pool.push(pickWeighted(cPool));
  }
  // coins (25% chance)
  if (Math.random() < 0.25) {
    const cnPool = REWARD_POOLS[`coins_${rKey}`] || REWARD_POOLS.coins_common;
    pool.push(pickWeighted(cnPool));
  }
  // badge (5% chance, increases with rarity)
  const badgeChance = 0.05 + ri * 0.03;
  if (Math.random() < badgeChance) {
    pool.push({ type: 'badge', ...pickWeighted(BADGE_POOL) });
  }

  // guarantee at least 1 reward
  if (pool.length === 0) {
    const fPool = REWARD_POOLS[`furniture_${rKey}`] || REWARD_POOLS.furniture_common;
    pool.push(pickWeighted(fPool));
  }

  return pool;
}

function pickWeighted(pool) {
  const total = pool.reduce((s, i) => s + i.chance, 0);
  let roll = Math.random() * total;
  for (const item of pool) {
    roll -= item.chance;
    if (roll <= 0) return { ...item };
  }
  return { ...pool[pool.length - 1] };
}

/* ──────────── egg sprite renderer ──────────── */
function drawEggSprite(ctx, x, y, scale, colors, rarityData) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const { shell, spots, glow } = colors;
  const { color, starCount } = rarityData;

  // glow aura for rare+
  if (rarityData.label !== 'Common') {
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.ellipse(0, -16, 22, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  // main egg body
  ctx.fillStyle = shell; ctx.strokeStyle = '#000000'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -16, 16, 22, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // highlight
  ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.ellipse(-5, -22, 6, 10, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1.0;

  // spots pattern
  ctx.fillStyle = spots; ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
  const spotOffsets = [
    [-8, -24, 3], [6, -28, 2.5], [-4, -12, 3.5],
    [8, -14, 2], [-6, -4, 3], [5, -6, 2.5],
    [0, -20, 2], [-10, -16, 2]
  ];
  spotOffsets.forEach(([sx, sy, sr]) => {
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });

  // rarity stars along top
  ctx.fillStyle = color; ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
  for (let i = 0; i < starCount; i++) {
    const sx = (i - (starCount - 1) / 2) * 8;
    const sy = -38;
    drawStar(ctx, sx, sy, 3, 5, 2);
  }

  ctx.restore();
}

function drawStar(ctx, cx, cy, outerR, points, innerR) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (Math.PI * i) / points - Math.PI / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

/* ──────────── hatch animation renderer ──────────── */
function drawHatchAnimation(ctx, x, y, progress, colors, rarityData) {
  // progress 0.0 → 1.0
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);

  const { shell, spots, glow } = colors;
  const { label, color } = rarityData;

  // shake intensity increases
  const shake = progress < 0.6 ? Math.sin(progress * Math.PI * 8) * (progress * 3) : 0;
  ctx.translate(shake, 0);

  // cracks appear at 0.3
  if (progress > 0.25) {
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 2;
    const crackAlpha = Math.min(1, (progress - 0.25) * 4);
    ctx.globalAlpha = crackAlpha;
    ctx.beginPath(); ctx.moveTo(-4, -28); ctx.lineTo(0, -16); ctx.lineTo(6, -22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(-2, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(-10, -12); ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // glow burst at 0.7
  if (progress > 0.6) {
    const glowScale = Math.min(1, (progress - 0.6) * 3);
    ctx.fillStyle = glow;
    ctx.globalAlpha = glowScale * 0.5;
    ctx.beginPath(); ctx.arc(0, -16, 20 + glowScale * 20, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  // shell breaks at 0.8 → pieces fly
  if (progress < 0.85) {
    ctx.fillStyle = shell; ctx.strokeStyle = '#000000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -16, 16 * (1 - progress * 0.3), 22 * (1 - progress * 0.3), 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // spots remain
    ctx.fillStyle = spots;
    const spotOffsets = [[-8, -24, 3], [6, -28, 2.5], [-4, -12, 3.5], [8, -14, 2], [-6, -4, 3], [5, -6, 2.5]];
    spotOffsets.forEach(([sx, sy, sr]) => {
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
  }

  // shell fragments flying outward at 0.8+
  if (progress > 0.75) {
    const fly = (progress - 0.75) * 4;
    ctx.fillStyle = shell; ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
    const fragments = [
      { dx: -20, dy: -30, r: 5 }, { dx: 18, dy: -35, r: 4 },
      { dx: -12, dy: -10, r: 4 }, { dx: 14, dy: -8, r: 5 },
      { dx: 0, dy: -40, r: 3 }, { dx: -22, dy: -18, r: 3 },
    ];
    fragments.forEach((fr, i) => {
      ctx.beginPath(); ctx.arc(fr.dx * fly, fr.dy * fly + (i % 2 === 0 ? fly * 8 : 0), fr.r * (1 - fly * 0.2), 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    });
  }

  // reward preview / sparkle burst at 0.9
  if (progress > 0.85) {
    const sparkAlpha = Math.min(1, (progress - 0.85) * 6);
    ctx.globalAlpha = sparkAlpha;
    ctx.fillStyle = color;
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const dist = (progress - 0.85) * 100;
      ctx.beginPath(); ctx.arc(Math.cos(angle) * dist, -16 + Math.sin(angle) * dist * 0.5, 2 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
    }
    // center glow orb
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(0, -16, 6 + (progress - 0.85) * 20, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  ctx.restore();
}

/* ──────────── batch egg generators ──────────── */
function generateRandomEgg(rarity = null) {
  const typeIdx = Math.floor(Math.random() * EGG_TYPES.length);
  return createEgg(EGG_TYPES[typeIdx].id, rarity);
}

function generateEggPack(count = 5, guaranteedRarity = null) {
  const pack = [];
  for (let i = 0; i < count; i++) {
    pack.push(generateRandomEgg(i === count - 1 ? guaranteedRarity : null));
  }
  return pack;
}

function generateStarterPack() {
  return [
    createEgg('egg_star', 'Common'),
    createEgg('egg_nature', 'Common'),
    createEgg('egg_crystal', 'Uncommon'),
  ];
}

function generateMegaPack(count = 10) {
  const pack = [];
  for (let i = 0; i < count; i++) {
    const rarity = rollRarity();
    pack.push(generateRandomEgg(rarity));
  }
  // guarantee at least 1 rare+
  if (!pack.some(e => rarityIndex(e.rarity) >= 2)) {
    pack[pack.length - 1] = generateRandomEgg('Rare');
  }
  return pack;
}

/* ──────────── egg hatch runtime ──────────── */
class EggHatchManager {
  constructor() {
    this.eggs = new Map(); // id -> egg instance
    this.onHatch = null;   // callback(egg, rewards)
  }

  addEgg(egg) {
    this.eggs.set(egg.id, egg);
    this._scheduleHatch(egg);
  }

  _scheduleHatch(egg) {
    const delay = Math.max(0, egg.hatchAt - Date.now());
    setTimeout(() => this._performHatch(egg.id), delay);
  }

  _performHatch(eggId) {
    const egg = this.eggs.get(eggId);
    if (!egg || egg.isHatched) return;
    egg.isHatched = true;
    const rewards = egg.rewardPool.map(r => ({ ...r }));
    if (this.onHatch) this.onHatch(egg, rewards);
  }

  canHatchNow(eggId) {
    const egg = this.eggs.get(eggId);
    if (!egg) return false;
    return Date.now() >= egg.hatchAt;
  }

  instantHatch(eggId) {
    const egg = this.eggs.get(eggId);
    if (!egg) return null;
    egg.hatchAt = Date.now();
    this._performHatch(eggId);
    return egg.rewardPool.map(r => ({ ...r }));
  }

  getAllEggs() { return Array.from(this.eggs.values()); }
  getEggById(id) { return this.eggs.get(id) || null; }
  removeEgg(id) { this.eggs.delete(id); }

  serialize() {
    return Array.from(this.eggs.values()).map(e => ({
      id: e.id, typeId: e.typeId, rarity: e.rarity,
      hatchTimeHours: e.hatchTimeHours, placedAt: e.placedAt,
      hatchAt: e.hatchAt, isHatched: e.isHatched,
      rewardPool: e.rewardPool,
    }));
  }

  static deserialize(dataArray) {
    const mgr = new EggHatchManager();
    dataArray.forEach(data => {
      const egg = createEgg(data.typeId, data.rarity);
      egg.id = data.id;
      egg.hatchTimeHours = data.hatchTimeHours;
      egg.placedAt = data.placedAt;
      egg.hatchAt = data.hatchAt;
      egg.isHatched = data.isHatched;
      egg.rewardPool = data.rewardPool;
      mgr.eggs.set(egg.id, egg);
      if (!egg.isHatched) mgr._scheduleHatch(egg);
    });
    return mgr;
  }
}

/* ──────────── gacha shop / egg store ──────────── */
const EGG_SHOP = {
  basic_egg:   { price: 100,  name: 'Basic Egg',   rarityBias: null,     count: 1 },
  uncommon_pack:{ price: 400,  name: 'Uncommon Pack', rarityBias: 'Uncommon', count: 3 },
  rare_pack:   { price: 900,  name: 'Rare Pack',     rarityBias: 'Rare',     count: 3 },
  epic_pack:   { price: 2500, name: 'Epic Pack',     rarityBias: 'Epic',     count: 2 },
  legendary_pack:{ price: 8000, name: 'Legendary Pack', rarityBias: 'Legendary', count: 1 },
  mega_bundle: { price: 5000, name: 'Mega Bundle',   rarityBias: null,     count: 10 },
};

function purchasePack(packId, playerCoins) {
  const pack = EGG_SHOP[packId];
  if (!pack) return { success: false, error: 'Invalid pack' };
  if (playerCoins < pack.price) return { success: false, error: 'Insufficient coins' };

  const eggs = [];
  for (let i = 0; i < pack.count; i++) {
    const rarity = pack.rarityBias || rollRarity();
    eggs.push(generateRandomEgg(rarity));
  }
  return { success: true, eggs, cost: pack.price, remaining: playerCoins - pack.price };
}

function getShopCatalog() {
  return Object.entries(EGG_SHOP).map(([key, pack]) => ({ id: key, ...pack }));
}

/* ──────────── egg draw batch helper ──────────── */
function drawEggCollection(ctx, eggs, startX, startY, cols = 5, spacingX = 50, spacingY = 60) {
  eggs.forEach((egg, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * spacingX;
    const y = startY + row * spacingY;
    const bounce = egg.isHatched ? 0 : Math.sin(Date.now() / 400 + i) * 2;
    egg.draw(ctx, x, y, 1.0, bounce);
  });
}

/* ──────────── statistics / analytics ──────────── */
function getRarityDistribution(sampleSize = 10000) {
  const counts = { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0 };
  for (let i = 0; i < sampleSize; i++) {
    counts[rollRarity()]++;
  }
  return Object.fromEntries(
    Object.entries(counts).map(([k, v]) => [k, { count: v, pct: ((v / sampleSize) * 100).toFixed(2) + '%' }])
  );
}

function getEggSummary() {
  return {
    totalTypes: EGG_TYPES.length,
    rarityWeights: RARITY_WEIGHTS,
    totalWeight: TOTAL_WEIGHT,
    shopItems: getShopCatalog(),
    rewardCategories: Object.keys(REWARD_POOLS),
    badgePoolSize: BADGE_POOL.length,
  };
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════ */

export {
  RARITY_WEIGHTS,
  TOTAL_WEIGHT,
  rollRarity,
  rarityIndex,
  EGG_TYPES,
  REWARD_POOLS,
  BADGE_POOL,
  createEgg,
  generateRandomEgg,
  generateEggPack,
  generateStarterPack,
  generateMegaPack,
  EggHatchManager,
  EGG_SHOP,
  purchasePack,
  getShopCatalog,
  drawEggCollection,
  getRarityDistribution,
  getEggSummary,
  drawEggSprite,
  drawHatchAnimation,
  drawStar,
  pickWeighted,
  buildRewardPool,
};

export default {
  RARITY_WEIGHTS,
  EGG_TYPES,
  createEgg,
  generateRandomEgg,
  EggHatchManager,
  purchasePack,
  getShopCatalog,
};

if (typeof window !== 'undefined') {
  window.RareEggs = {
    RARITY_WEIGHTS, EGG_TYPES, createEgg, generateRandomEgg,
    EggHatchManager, purchasePack, getShopCatalog,
    drawEggSprite, drawHatchAnimation, rollRarity,
  };
}
