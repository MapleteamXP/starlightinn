/**
 * @fileoverview ChestManager.js — Rare chest spawning & loot system for Starlight Inn v3.0.
 * Handles timed chest spawns across all world areas, tiered rarity, loot generation,
 * player claiming, visual glow effects, and canvas rendering.
 *
 * @module events/ChestManager
 * @version 3.0.0
 * @author Starlight Inn Team
 */

/** @typedef {import('../Game.js').Game} Game */

/**
 * Represents a single spawned chest in the world.
 * @typedef {Object} Chest
 * @property {string} id — Unique chest identifier.
 * @property {'wooden'|'silver'|'golden'} tier — Chest rarity tier.
 * @property {string} area — World area where the chest spawned.
 * @property {number} x — Normalized X position (0..1) within the area.
 * @property {number} y — Normalized Y position (0..1) within the area.
 * @property {number} spawnedAt — Timestamp when the chest was spawned.
 * @property {string|null} claimedBy — Player ID who claimed it, or null.
 * @property {number} glowPhase — Current glow animation phase (radians).
 * @property {number} floatOffset — Vertical bobbing offset for idle animation.
 */

/**
 * Represents a single loot item awarded from a chest.
 * @typedef {Object} LootItem
 * @property {'silver'|'gold'|'item'} type — Currency type or item.
 * @property {number} [amount] — Quantity for currency types.
 * @property {string} [item] — Item ID for item types.
 */

/**
 * Manages rare chest spawning, loot tables, claiming, and rendering.
 * Chests spawn every 2 hours across 6 world areas with 3 rarity tiers.
 * @export
 */
export class ChestManager {
  /**
   * Creates a ChestManager instance.
   * @param {Game} game — The main Game instance.
   */
  constructor(game) {
    /** @type {Game} */
    this.game = game;

    /** @type {Chest[]} — Active unclaimed chests in the world. */
    this.chests = [];

    /** @type {number} — Timestamp of the most recent chest spawn. */
    this.lastSpawn = 0;

    /** @type {number} — Milliseconds between automatic spawns (2 hours). */
    this.spawnInterval = 7200000;

    /** @type {number|null} — Interval handle for the spawn checker. */
    this._spawnTimer = null;

    /** @type {number|null} — Interval handle for the glow animation updater. */
    this._glowTimer = null;

    /** @type {number} — Current global glow phase for pulsing effects. */
    this.globalGlow = 0;

    /** @type {string[]} — Common catalog item IDs for wooden chests. */
    this.commonItems = [
      'candle_common', 'pillow_common', 'teacup_common',
      'bookmark_common', 'coaster_common', 'napkin_common',
      'matchbox_common', 'soap_common', 'sachet_common'
    ];

    /** @type {string[]} — Uncommon catalog item IDs for silver chests. */
    this.uncommonItems = [
      'lantern_uncommon', 'blanket_uncommon', 'mug_uncommon',
      'journal_uncommon', 'frame_uncommon', 'incense_uncommon',
      'scarf_uncommon', 'cookie_jar_uncommon', 'wind_chime_uncommon'
    ];

    /** @type {string[]} — Rare catalog item IDs for golden chests. */
    this.rareItems = [
      'crystal_lamp_rare', 'tapestry_rare', 'music_box_rare',
      'celestial_map_rare', 'enchanted_pen_rare', 'moon_mirror_rare'
    ];

    /** @type {string[]} — Legendary catalog item IDs for golden chest bonus drops. */
    this.legendaryItems = [
      'starlight_crown_legendary', 'phoenix_feather_legendary',
      'dragon_scale_legendary', 'time_sand_legendary'
    ];
  }

  /* ================================================================ */
  /*  INITIALIZATION                                                  */
  /* ================================================================ */

  /**
   * Initializes the chest manager: starts spawn timers and glow animation.
   * Call once after the Game instance is ready.
   * @returns {void}
   */
  init() {
    this.startSpawnTimer();
    this.startGlowTimer();
    this.game.chat.system('📦 Chest system online. Rare chests will appear every 2 hours.');
  }

  /**
   * Starts the periodic spawn checker (every 60 seconds).
   * @returns {void}
   */
  startSpawnTimer() {
    if (this._spawnTimer) clearInterval(this._spawnTimer);
    this._spawnTimer = setInterval(() => this.checkSpawn(), 60000);
  }

  /**
   * Starts the glow animation updater (every 50 ms for smooth pulsing).
   * @returns {void}
   */
  startGlowTimer() {
    if (this._glowTimer) clearInterval(this._glowTimer);
    this._glowTimer = setInterval(() => {
      this.globalGlow += 0.05;
      this.chests.forEach(c => {
        c.glowPhase += 0.03;
        c.floatOffset = Math.sin(this.globalGlow + c.glowPhase) * 8;
      });
    }, 50);
  }

  /* ================================================================ */
  /*  SPAWN LOGIC                                                     */
  /* ================================================================ */

  /**
   * Checks whether enough time has passed since the last spawn.
   * If so, triggers a new chest spawn and resets the timer.
   * @returns {void}
   */
  checkSpawn() {
    const now = Date.now();
    if (now - this.lastSpawn >= this.spawnInterval) {
      this.spawnChest();
      this.lastSpawn = now;
    }
  }

  /**
   * Immediately spawns a single chest in a random area.
   * Tier distribution: 70% wooden, 25% silver, 5% golden.
   * @returns {Chest} The spawned chest object.
   */
  spawnChest() {
    const roll = Math.random();
    let tier = 'wooden';
    if (roll > 0.95) tier = 'golden';
    else if (roll > 0.70) tier = 'silver';

    const area = this.getRandomArea();
    const chest = {
      id: `chest_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      tier,
      area,
      x: 0.2 + Math.random() * 0.6,
      y: 0.3 + Math.random() * 0.5,
      spawnedAt: Date.now(),
      claimedBy: null,
      glowPhase: Math.random() * Math.PI * 2,
      floatOffset: 0
    };

    this.chests.push(chest);

    const tierEmoji = { wooden: '🪵', silver: '🥈', golden: '🏆' }[tier];
    this.game.chat.system(
      `${tierEmoji} A **${tier} chest** has appeared in **${area}**!`
    );
    this.game.ui.toast(`A ${tier} chest appeared in ${area}!`, 'chest', 5000);

    // Auto-cleanup unclaimed chests after 24 hours
    setTimeout(() => this.removeChest(chest.id), 86400000);

    return chest;
  }

  /**
   * Forces an immediate chest spawn, bypassing the timer.
   * Useful for events like Chest Rush.
   * @param {string} [forcedTier] — Optional tier override.
   * @returns {Chest} The spawned chest.
   */
  forceSpawn(forcedTier = null) {
    const roll = Math.random();
    let tier = forcedTier || 'wooden';
    if (!forcedTier) {
      if (roll > 0.95) tier = 'golden';
      else if (roll > 0.70) tier = 'silver';
    }

    const area = this.getRandomArea();
    const chest = {
      id: `chest_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      tier,
      area,
      x: 0.2 + Math.random() * 0.6,
      y: 0.3 + Math.random() * 0.5,
      spawnedAt: Date.now(),
      claimedBy: null,
      glowPhase: Math.random() * Math.PI * 2,
      floatOffset: 0
    };

    this.chests.push(chest);
    this.lastSpawn = Date.now();

    const tierEmoji = { wooden: '🪵', silver: '🥈', golden: '🏆' }[tier];
    this.game.chat.system(
      `${tierEmoji} A **${tier} chest** has appeared in **${area}**!`
    );

    setTimeout(() => this.removeChest(chest.id), 86400000);
    return chest;
  }

  /**
   * Returns a random area ID from the world map.
   * @returns {string} One of the 6 world areas.
   */
  getRandomArea() {
    const areas = [
      'hub',
      'moonbeach',
      'whisperforest',
      'cloudtreehouse',
      'sunflowerpark',
      'crystalisland'
    ];
    return areas[Math.floor(Math.random() * areas.length)];
  }

  /* ================================================================ */
  /*  CLAIM & LOOT                                                    */
  /* ================================================================ */

  /**
   * Attempts to claim an unclaimed chest for a player.
   * Awards loot and schedules chest removal after 30 seconds.
   * @param {string} chestId — The chest to claim.
   * @param {string} playerId — The player claiming it.
   * @returns {LootItem[]|null} Array of loot items, or null if already claimed / not found.
   */
  claimChest(chestId, playerId) {
    const chest = this.chests.find(c => c.id === chestId && !c.claimedBy);
    if (!chest) return null;

    chest.claimedBy = playerId;
    const loot = this.generateLoot(chest.tier);

    // Award loot to player
    loot.forEach(item => {
      if (item.type === 'silver') {
        const amount = this.game.state.doubleSilver ? item.amount * 2 : item.amount;
        this.game.currency.addSilver(amount);
      }
      if (item.type === 'gold') this.game.currency.addGold(item.amount);
      if (item.type === 'item') this.game.inventory.addItem(item.item);
    });

    // Notify player
    const tierEmoji = { wooden: '🪵', silver: '🥈', golden: '🏆' }[chest.tier];
    this.game.ui.toast(`${tierEmoji} You claimed a ${chest.tier} chest!`, 'success', 4000);

    // Spawn celebration particles at chest location
    this.spawnClaimParticles(chest);

    // Remove chest entity after 30 seconds
    setTimeout(() => this.removeChest(chestId), 30000);

    return loot;
  }

  /**
   * Generates loot items based on chest tier.
   * @param {'wooden'|'silver'|'golden'} tier — Chest rarity.
   * @returns {LootItem[]} Array of loot items.
   */
  generateLoot(tier) {
    const loot = [];

    if (tier === 'wooden') {
      const silverAmount = 50 + Math.floor(Math.random() * 100);
      loot.push({ type: 'silver', amount: silverAmount });
      if (Math.random() < 0.3) {
        loot.push({ type: 'item', item: this.getRandomCommonItem() });
      }
    } else if (tier === 'silver') {
      const silverAmount = 200 + Math.floor(Math.random() * 200);
      const goldAmount = 10 + Math.floor(Math.random() * 20);
      loot.push({ type: 'silver', amount: silverAmount });
      loot.push({ type: 'gold', amount: goldAmount });
      if (Math.random() < 0.5) {
        loot.push({ type: 'item', item: this.getRandomUncommonItem() });
      }
    } else {
      // golden
      const silverAmount = 500 + Math.floor(Math.random() * 500);
      const goldAmount = 50 + Math.floor(Math.random() * 50);
      loot.push({ type: 'silver', amount: silverAmount });
      loot.push({ type: 'gold', amount: goldAmount });
      loot.push({ type: 'item', item: this.getRandomRareItem() });
      if (Math.random() < 0.2) {
        loot.push({ type: 'item', item: this.getRandomLegendaryItem() });
      }
    }

    return loot;
  }

  /**
   * Returns a random common item ID.
   * @returns {string} Common item ID.
   */
  getRandomCommonItem() {
    return this.commonItems[Math.floor(Math.random() * this.commonItems.length)];
  }

  /**
   * Returns a random uncommon item ID.
   * @returns {string} Uncommon item ID.
   */
  getRandomUncommonItem() {
    return this.uncommonItems[Math.floor(Math.random() * this.uncommonItems.length)];
  }

  /**
   * Returns a random rare item ID.
   * @returns {string} Rare item ID.
   */
  getRandomRareItem() {
    return this.rareItems[Math.floor(Math.random() * this.rareItems.length)];
  }

  /**
   * Returns a random legendary item ID.
   * @returns {string} Legendary item ID.
   */
  getRandomLegendaryItem() {
    return this.legendaryItems[Math.floor(Math.random() * this.legendaryItems.length)];
  }

  /* ================================================================ */
  /*  CHEST LIFECYCLE                                                 */
  /* ================================================================ */

  /**
   * Removes a chest from the active list by ID.
   * @param {string} chestId — Chest to remove.
   * @returns {void}
   */
  removeChest(chestId) {
    const before = this.chests.length;
    this.chests = this.chests.filter(c => c.id !== chestId);
    if (this.chests.length < before && this.game.debug) {
      console.log(`[ChestManager] Removed chest ${chestId}`);
    }
  }

  /**
   * Returns all unclaimed chests in a specific area.
   * @param {string} areaId — Area to filter by.
   * @returns {Chest[]} Array of matching chests.
   */
  getChestsInArea(areaId) {
    return this.chests.filter(c => c.area === areaId && !c.claimedBy);
  }

  /**
   * Returns all active chests regardless of area.
   * @returns {Chest[]} Array of all chests.
   */
  getAllChests() {
    return this.chests;
  }

  /**
   * Returns the total number of unclaimed chests across all areas.
   * @returns {number} Unclaimed chest count.
   */
  getUnclaimedCount() {
    return this.chests.filter(c => !c.claimedBy).length;
  }

  /* ================================================================ */
  /*  VISUAL EFFECTS                                                  */
  /* ================================================================ */

  /**
   * Spawns sparkle particles when a chest is claimed.
   * @param {Chest} chest — The chest that was claimed.
   * @returns {void}
   */
  spawnClaimParticles(chest) {
    if (!this.game.particles) return;
    const color = {
      wooden: '#d4a373',
      silver: '#c0c0c0',
      golden: '#ffd700'
    }[chest.tier];

    for (let i = 0; i < 24; i++) {
      this.game.particles.emit({
        x: chest.x,
        y: chest.y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3 - 1,
        life: 800 + Math.random() * 600,
        color,
        size: 2 + Math.random() * 4,
        gravity: 0.02
      });
    }
  }

  /* ================================================================ */
  /*  RENDERING                                                       */
  /* ================================================================ */

  /**
   * Renders all unclaimed chests for the current area onto the canvas.
   * Draws emoji-based chests with pulsing glow halos, floating bob,
   * tier-colored auras, and subtle sparkles.
   * @param {CanvasRenderingContext2D} ctx — Canvas 2D context.
   * @param {string} areaId — Current area being rendered.
   * @param {number} W — Canvas width in pixels.
   * @param {number} H — Canvas height in pixels.
   * @returns {void}
   */
  renderChests(ctx, areaId, W, H) {
    const areaChests = this.getChestsInArea(areaId);
    if (areaChests.length === 0) return;

    const now = Date.now();

    for (const chest of areaChests) {
      const px = chest.x * W;
      const py = chest.y * H + chest.floatOffset;
      const pulse = 0.5 + 0.5 * Math.sin(chest.glowPhase);
      const isGolden = chest.tier === 'golden';
      const isSilver = chest.tier === 'silver';

      // Aura glow (pulsing halo behind chest)
      const glowRadius = isGolden ? 45 + pulse * 15 : isSilver ? 32 + pulse * 10 : 24 + pulse * 6;
      const glowColor = isGolden
        ? `rgba(255, 215, 0, ${0.25 + pulse * 0.2})`
        : isSilver
          ? `rgba(192, 192, 192, ${0.2 + pulse * 0.15})`
          : `rgba(212, 163, 115, ${0.15 + pulse * 0.1})`;

      ctx.save();

      // Outer glow ring
      const gradient = ctx.createRadialGradient(px, py, 4, px, py, glowRadius);
      gradient.addColorStop(0, glowColor);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Sparkle dots for golden/silver
      if (isGolden || isSilver) {
        const sparkleCount = isGolden ? 6 : 3;
        for (let s = 0; s < sparkleCount; s++) {
          const angle = (now / 300) + (s * (Math.PI * 2 / sparkleCount));
          const sr = glowRadius + 8 + Math.sin(now / 200 + s) * 4;
          const sx = px + Math.cos(angle) * sr;
          const sy = py + Math.sin(angle) * sr;
          const sa = 0.4 + 0.6 * Math.abs(Math.sin(now / 400 + s));
          ctx.fillStyle = isGolden ? `rgba(255, 255, 150, ${sa})` : `rgba(255, 255, 255, ${sa})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.5 + pulse, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Chest shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(px, py + 28, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Chest emoji
      const emoji = { wooden: '🪵', silver: '🥈', golden: '🏆' }[chest.tier];
      ctx.font = `${isGolden ? 36 : 30}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, px, py);

      // Tier label beneath
      ctx.font = '11px sans-serif';
      ctx.fillStyle = isGolden ? '#ffd700' : isSilver ? '#c0c0c0' : '#d4a373';
      const label = chest.tier.charAt(0).toUpperCase() + chest.tier.slice(1);
      ctx.fillText(label, px, py + 32);

      // Click hint
      const hintAlpha = 0.4 + 0.4 * Math.sin(now / 500);
      ctx.font = '10px sans-serif';
      ctx.fillStyle = `rgba(255,255,255,${hintAlpha})`;
      ctx.fillText('Click to open', px, py + 44);

      ctx.restore();
    }
  }

  /**
   * Checks if a screen coordinate hits any chest in the current area.
   * Returns the chest ID if clicked, null otherwise.
   * @param {string} areaId — Current area.
   * @param {number} screenX — Click X in pixels.
   * @param {number} screenY — Click Y in pixels.
   * @param {number} W — Canvas width.
   * @param {number} H — Canvas height.
   * @returns {string|null} Chest ID or null.
   */
  hitTest(areaId, screenX, screenY, W, H) {
    const areaChests = this.getChestsInArea(areaId);
    for (const chest of areaChests) {
      const px = chest.x * W;
      const py = chest.y * H + chest.floatOffset;
      const dx = screenX - px;
      const dy = screenY - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 40) return chest.id;
    }
    return null;
  }

  /* ================================================================ */
  /*  CLEANUP                                                         */
  /* ================================================================ */

  /**
   * Destroys all timers and clears chest state.
   * Call on game shutdown or scene transition.
   * @returns {void}
   */
  destroy() {
    if (this._spawnTimer) {
      clearInterval(this._spawnTimer);
      this._spawnTimer = null;
    }
    if (this._glowTimer) {
      clearInterval(this._glowTimer);
      this._glowTimer = null;
    }
    this.chests = [];
  }
}
