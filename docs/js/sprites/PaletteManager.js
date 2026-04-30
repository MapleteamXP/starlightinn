/**
 * PaletteManager.js
 * =================
 * Master palette management system for Starlight Inn v6.0.
 * Enforces a Habbo Hotel-inspired flat, vibrant, limited color aesthetic:
 *   - Bold, solid colors with no gradients
 *   - 1-pixel black outlines on all sprites
 *   - Maximum 6 colors per sprite
 *   - Simplified blocky pixel shapes
 *
 * Provides 8 curated game palettes, color utility functions,
 * palette swapping, and area-to-palette mapping.
 *
 * @module sprites/PaletteManager
 * @version 6.0.0
 * @author Starlight Inn Team
 */

// =============================================================================
// Predefined Palettes — 8 Curated Game Palettes
// =============================================================================

/**
 * The Warm palette: wood browns, cream, terracotta, gold.
 * Used for taverns, inns, cozy hearths, and common rooms.
 * Evokes warmth, comfort, and candlelight.
 *
 * @type {GamePalette}
 */
const PALETTE_WARM = {
  name: 'Warm',
  colors: {
    base: '#8B6914',
    light: '#D4A84B',
    dark: '#5C4311',
    outline: '#000000',
    accent1: '#C44018',
    accent2: '#E8DCC4',
    bg: '#2A1F0D',
    text: '#FFFFFF'
  }
};

/**
 * The Cool palette: ice blues, silver, deep navy.
 * Used for caverns, mountain peaks, icy caves, and moonlit shores.
 * Evokes cold, mystery, and starlight.
 *
 * @type {GamePalette}
 */
const PALETTE_COOL = {
  name: 'Cool',
  colors: {
    base: '#4A90D9',
    light: '#87CEEB',
    dark: '#1E3A5F',
    outline: '#000000',
    accent1: '#00BCD4',
    accent2: '#E0F7FA',
    bg: '#0A1628',
    text: '#FFFFFF'
  }
};

/**
 * The Vibrant palette: saturated reds, greens, yellows.
 * Used for bustling bazaars, market plazas, and festival grounds.
 * Evokes energy, excitement, and commerce.
 *
 * @type {GamePalette}
 */
const PALETTE_VIBRANT = {
  name: 'Vibrant',
  colors: {
    base: '#E53935',
    light: '#FF6F60',
    dark: '#AB000D',
    outline: '#000000',
    accent1: '#43A047',
    accent2: '#FDD835',
    bg: '#3E0000',
    text: '#FFFFFF'
  }
};

/**
 * The Pastel palette: soft pinks, lavenders, mint.
 * Used for cloud lounges, gardens, tea rooms, and dreamy bedrooms.
 * Evokes softness, whimsy, and tranquility.
 *
 * @type {GamePalette}
 */
const PALETTE_PASTEL = {
  name: 'Pastel',
  colors: {
    base: '#F8BBD0',
    light: '#FCE4EC',
    dark: '#C2185B',
    outline: '#000000',
    accent1: '#E1BEE7',
    accent2: '#B2DFDB',
    bg: '#3E1A2C',
    text: '#FFFFFF'
  }
};

/**
 * The Neon palette: electric cyan, magenta, purple.
 * Used for cyber zones, arcade rooms, and futuristic spaces.
 * Evokes high-tech, nightlife, and digital worlds.
 *
 * @type {GamePalette}
 */
const PALETTE_NEON = {
  name: 'Neon',
  colors: {
    base: '#00E5FF',
    light: '#84FFFF',
    dark: '#00B8D4',
    outline: '#000000',
    accent1: '#E040FB',
    accent2: '#651FFF',
    bg: '#1A0033',
    text: '#FFFFFF'
  }
};

/**
 * The Earth palette: dirt browns, leaf greens, stone grays.
 * Used for forests, campsites, trails, and natural clearings.
 * Evokes nature, grounding, and the outdoors.
 *
 * @type {GamePalette}
 */
const PALETTE_EARTH = {
  name: 'Earth',
  colors: {
    base: '#795548',
    light: '#A1887F',
    dark: '#3E2723',
    outline: '#000000',
    accent1: '#33691E',
    accent2: '#8D6E63',
    bg: '#1B120E',
    text: '#FFFFFF'
  }
};

/**
 * The Monochrome palette: grays for spooky, shadowy, manor areas.
 * Used for haunted halls, dungeons, graveyards, and stormy nights.
 * Evokes dread, elegance, and the unknown.
 *
 * @type {GamePalette}
 */
const PALETTE_MONOCHROME = {
  name: 'Monochrome',
  colors: {
    base: '#757575',
    light: '#BDBDBD',
    dark: '#424242',
    outline: '#000000',
    accent1: '#9E9E9E',
    accent2: '#E0E0E0',
    bg: '#1A1A1A',
    text: '#FFFFFF'
  }
};

/**
 * The Holiday palette: red, green, and gold for festive winter areas.
 * Used during seasonal events, Christmas markets, and winter wonderlands.
 * Evokes cheer, tradition, and celebration.
 *
 * @type {GamePalette}
 */
const PALETTE_HOLIDAY = {
  name: 'Holiday',
  colors: {
    base: '#D32F2F',
    light: '#EF5350',
    dark: '#B71C1C',
    outline: '#000000',
    accent1: '#388E3C',
    accent2: '#FFD700',
    bg: '#2A0E0E',
    text: '#FFFFFF'
  }
};

/**
 * Exportable collection of all 8 predefined game palettes.
 * Indexed by palette name for fast lookup.
 *
 * @constant
 * @type {Object<string, GamePalette>}
 */
export const PALETTES = {
  Warm: PALETTE_WARM,
  Cool: PALETTE_COOL,
  Vibrant: PALETTE_VIBRANT,
  Pastel: PALETTE_PASTEL,
  Neon: PALETTE_NEON,
  Earth: PALETTE_EARTH,
  Monochrome: PALETTE_MONOCHROME,
  Holiday: PALETTE_HOLIDAY
};

// =============================================================================
// PaletteManager Class
// =============================================================================

/**
 * Master palette management system for Starlight Inn.
 * Provides palette retrieval, swapping, validation, color utilities,
 * and area-to-palette mapping. Enforces the flat, vibrant, limited
 * color aesthetic inspired by Habbo Hotel's visual style.
 *
 * @class PaletteManager
 */
export class PaletteManager {
  /**
   * Creates a new PaletteManager and initializes all 8 curated palettes
   * plus the area-to-palette mapping.
   *
   * @constructor
   */
  constructor() {
    /**
     * Internal palette store, keyed by palette name.
     * @private
     * @type {Object<string, GamePalette>}
     */
    this._palettes = { ...PALETTES };

    /**
     * Mapping from area IDs to recommended palette names.
     * Used by {@link getPaletteForArea}.
     * @private
     * @type {Object<string, string>}
     */
    this._areaMap = {
      hub: 'Warm',
      moonbeach: 'Cool',
      whisperforest: 'Earth',
      cloudtreehouse: 'Warm',
      sunflowerpark: 'Pastel',
      crystalisland: 'Cool',
      auroralounge: 'Pastel',
      embercafe: 'Warm',
      mistylibrary: 'Monochrome',
      stardusttheater: 'Neon',
      twilightgarden: 'Pastel',
      cometarcade: 'Neon',
      dreambedroom: 'Pastel',
      meteormarket: 'Vibrant'
    };

    /**
     * Cache for parsed RGB values per palette to speed up blending.
     * @private
     * @type {Map<string, Object<string, number[]>>}
     */
    this._rgbCache = new Map();

    /**
     * Cached palette names for fast random selection.
     * @private
     * @type {string[]}
     */
    this._paletteNames = Object.keys(this._palettes);
  }

  /**
   * Retrieves a palette by its name.
   *
   * @param {string} name — The palette name (e.g., 'Warm', 'Cool', 'Neon').
   * @returns {GamePalette|null} The matching palette, or null if not found.
   *
   * @example
   * const warm = manager.getPalette('Warm');
   * console.log(warm.colors.base); // '#8B6914'
   */
  getPalette(name) {
    if (!name || typeof name !== 'string') {
      console.warn('[PaletteManager] getPalette called with invalid name:', name);
      return null;
    }
    return this._palettes[name] ?? null;
  }

  /**
   * Returns all available palettes as an array.
   *
   * @returns {GamePalette[]} Array of all 8 curated palettes.
   *
   * @example
   * const all = manager.getAllPalettes();
   * all.forEach(p => console.log(p.name));
   */
  getAllPalettes() {
    return Object.values(this._palettes);
  }

  /**
   * Selects a random palette from the curated set.
   * Useful for procedural decoration or surprise areas.
   *
   * @returns {GamePalette} A randomly chosen palette.
   *
   * @example
   * const surprise = manager.getRandomPalette();
   */
  getRandomPalette() {
    const idx = Math.floor(Math.random() * this._paletteNames.length);
    const name = this._paletteNames[idx];
    return this._palettes[name];
  }

  /**
   * Maps a game area ID to its recommended palette.
   * Falls back to 'Warm' if the area is unknown.
   *
   * @param {string} areaId — The area identifier (e.g., 'plaza', 'tavern', 'caverns').
   * @returns {GamePalette} The palette best suited for that area.
   *
   * @example
   * const marketPalette = manager.getPaletteForArea('meteormarket');
   * // Returns the Vibrant palette.
   */
  getPaletteForArea(areaId) {
    if (!areaId || typeof areaId !== 'string') {
      console.warn('[PaletteManager] getPaletteForArea called with invalid areaId:', areaId);
      return this._palettes['Warm'];
    }
    const mappedName = this._areaMap[areaId.toLowerCase()];
    if (!mappedName) {
      console.warn(`[PaletteManager] No palette mapped for area "${areaId}"; falling back to Warm.`);
      return this._palettes['Warm'];
    }
    return this._palettes[mappedName];
  }

  /**
   * Swaps the colors of a sprite from one palette to another.
   * Operates on an HTMLCanvasElement or OffscreenCanvas.
   * Each pixel color is matched to the nearest color in the source palette,
   * then replaced with the corresponding color in the target palette.
   *
   * @param {HTMLCanvasElement|OffscreenCanvas} sprite — The canvas containing the sprite.
   * @param {GamePalette|string} fromPalette — Source palette or its name.
   * @param {GamePalette|string} toPalette — Target palette or its name.
   * @returns {HTMLCanvasElement|OffscreenCanvas} The same canvas instance (mutated in place).
   *
   * @example
   * const canvas = document.getElementById('mySprite');
   * manager.swapPalette(canvas, 'Warm', 'Cool');
   */
  swapPalette(sprite, fromPalette, toPalette) {
    if (!sprite || typeof sprite.getContext !== 'function') {
      console.warn('[PaletteManager] swapPalette: invalid sprite canvas provided.');
      return sprite;
    }

    const from = (typeof fromPalette === 'string') ? this.getPalette(fromPalette) : fromPalette;
    const to = (typeof toPalette === 'string') ? this.getPalette(toPalette) : toPalette;

    if (!from || !to) {
      console.warn('[PaletteManager] swapPalette: invalid from/to palette.');
      return sprite;
    }

    const ctx = sprite.getContext('2d');
    if (!ctx) {
      console.warn('[PaletteManager] swapPalette: could not acquire 2D context.');
      return sprite;
    }

    const width = sprite.width;
    const height = sprite.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Build ordered color lists from both palettes.
    const fromKeys = Object.keys(from.colors);
    const fromColors = fromKeys.map(k => PaletteManager._hexToRgb(from.colors[k]));
    const toColors = fromKeys.map(k => PaletteManager._hexToRgb(to.colors[k]));

    // For each pixel, find the nearest source palette color and replace.
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue; // Skip fully transparent pixels.

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      let bestIdx = -1;
      let bestDist = Infinity;

      for (let j = 0; j < fromColors.length; j++) {
        const fc = fromColors[j];
        const dr = r - fc[0];
        const dg = g - fc[1];
        const db = b - fc[2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = j;
        }
      }

      if (bestIdx >= 0) {
        const tc = toColors[bestIdx];
        data[i] = tc[0];
        data[i + 1] = tc[1];
        data[i + 2] = tc[2];
        // Alpha is preserved.
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return sprite;
  }

  /**
   * Validates whether a sprite only uses colors from the specified palette.
   * Returns a validation report object.
   *
   * @param {HTMLCanvasElement|OffscreenCanvas} sprite — The sprite canvas.
   * @param {GamePalette|string} palette — The palette or its name to validate against.
   * @returns {SpriteValidationReport} Report detailing validity and violations.
   *
   * @example
   * const report = manager.validateSprite(canvas, 'Warm');
   * if (!report.valid) console.log('Offending colors:', report.offendingColors);
   */
  validateSprite(sprite, palette) {
    if (!sprite || typeof sprite.getContext !== 'function') {
      return {
        valid: false,
        offendingColors: [],
        reason: 'Invalid sprite canvas provided.'
      };
    }

    const pal = (typeof palette === 'string') ? this.getPalette(palette) : palette;
    if (!pal) {
      return {
        valid: false,
        offendingColors: [],
        reason: 'Invalid palette provided.'
      };
    }

    const ctx = sprite.getContext('2d');
    const imageData = ctx.getImageData(0, 0, sprite.width, sprite.height);
    const data = imageData.data;

    // Build a Set of allowed hex colors.
    const allowed = new Set(Object.values(pal.colors).map(c => c.toUpperCase()));
    const offending = new Set();

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue; // Ignore transparent.
      const hex = PaletteManager._rgbToHex(data[i], data[i + 1], data[i + 2]).toUpperCase();
      if (!allowed.has(hex)) {
        offending.add(hex);
      }
    }

    const offendingArr = Array.from(offending);
    return {
      valid: offendingArr.length === 0,
      offendingColors: offendingArr,
      reason: offendingArr.length > 0
        ? `Sprite uses ${offendingArr.length} color(s) not in palette "${pal.name}".`
        : 'Sprite conforms to palette.'
    };
  }

  /**
   * Enforces a palette on a CanvasRenderingContext2D by pre-setting
   * its fillStyle and strokeStyle to the palette's base and outline colors.
   * This is a convenience helper for code that draws procedurally.
   *
   * @param {CanvasRenderingContext2D} ctx — The 2D rendering context.
   * @param {GamePalette|string} palette — The palette or its name.
   * @param {Object} [options] — Optional overrides.
   * @param {string} [options.fillType='base'] — Which palette slot to use for fillStyle.
   * @param {string} [options.strokeType='outline'] — Which palette slot to use for strokeStyle.
   *
   * @example
   * manager.enforcePalette(ctx, 'Warm');
   * ctx.fillRect(10, 10, 20, 20); // Uses Warm base color
   */
  enforcePalette(ctx, palette, options = {}) {
    if (!ctx || typeof ctx.fillRect !== 'function') {
      console.warn('[PaletteManager] enforcePalette: invalid canvas context.');
      return;
    }

    const pal = (typeof palette === 'string') ? this.getPalette(palette) : palette;
    if (!pal) {
      console.warn('[PaletteManager] enforcePalette: invalid palette.');
      return;
    }

    const fillType = options.fillType || 'base';
    const strokeType = options.strokeType || 'outline';

    const fillColor = pal.colors[fillType];
    const strokeColor = pal.colors[strokeType];

    if (fillColor) ctx.fillStyle = fillColor;
    if (strokeColor) ctx.strokeStyle = strokeColor;

    // Ensure crisp pixel edges (no anti-aliasing).
    ctx.imageSmoothingEnabled = false;
  }

  /**
   * Retrieves a specific color slot from a palette.
   *
   * @param {string} type — The color slot name (e.g., 'base', 'light', 'dark', 'outline').
   * @param {GamePalette|string} palette — The palette or its name.
   * @returns {string|null} The hex color string, or null if unavailable.
   *
   * @example
   * const highlight = manager.getColor('light', 'Cool');
   * // Returns '#87CEEB'
   */
  getColor(type, palette) {
    if (!type || typeof type !== 'string') {
      console.warn('[PaletteManager] getColor: invalid type.');
      return null;
    }
    const pal = (typeof palette === 'string') ? this.getPalette(palette) : palette;
    if (!pal) {
      console.warn('[PaletteManager] getColor: invalid palette.');
      return null;
    }
    return pal.colors[type] ?? null;
  }

  /**
   * Blends two hex colors by a ratio using simple RGB interpolation.
   * No gamma correction — designed for fast pixel-art operations.
   *
   * @param {string} color1 — First hex color (e.g., '#FF0000').
   * @param {string} color2 — Second hex color (e.g., '#0000FF').
   * @param {number} ratio — Blend ratio from 0.0 (all color1) to 1.0 (all color2).
   * @returns {string} The resulting blended hex color.
   *
   * @example
   * const mid = manager.blend('#FF0000', '#0000FF', 0.5);
   * // Returns '#800080' (purple)
   */
  blend(color1, color2, ratio) {
    if (typeof ratio !== 'number' || isNaN(ratio)) {
      console.warn('[PaletteManager] blend: invalid ratio; defaulting to 0.5.');
      ratio = 0.5;
    }
    const clamped = Math.max(0, Math.min(1, ratio));
    const c1 = PaletteManager._hexToRgb(color1);
    const c2 = PaletteManager._hexToRgb(color2);

    const r = Math.round(c1[0] + (c2[0] - c1[0]) * clamped);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * clamped);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * clamped);

    return PaletteManager._rgbToHex(r, g, b);
  }

  /**
   * Lightens a hex color by a fixed amount per channel.
   * Useful for generating highlight variants on the fly.
   *
   * @param {string} color — The hex color to lighten.
   * @param {number} [amount=32] — Amount to add to each RGB channel (0–255).
   * @returns {string} The lightened hex color.
   *
   * @example
   * const highlight = manager.lighten('#8B6914', 40);
   * // Returns a brighter brown
   */
  lighten(color, amount = 32) {
    const amt = Math.max(0, Math.min(255, amount));
    const [r, g, b] = PaletteManager._hexToRgb(color);
    return PaletteManager._rgbToHex(
      Math.min(255, r + amt),
      Math.min(255, g + amt),
      Math.min(255, b + amt)
    );
  }

  /**
   * Darkens a hex color by a fixed amount per channel.
   * Useful for generating shadow variants on the fly.
   *
   * @param {string} color — The hex color to darken.
   * @param {number} [amount=32] — Amount to subtract from each RGB channel (0–255).
   * @returns {string} The darkened hex color.
   *
   * @example
   * const shadow = manager.darken('#D4A84B', 40);
   * // Returns a deeper gold
   */
  darken(color, amount = 32) {
    const amt = Math.max(0, Math.min(255, amount));
    const [r, g, b] = PaletteManager._hexToRgb(color);
    return PaletteManager._rgbToHex(
      Math.max(0, r - amt),
      Math.max(0, g - amt),
      Math.max(0, b - amt)
    );
  }

  /**
   * Generates a variant palette by shifting the hue of all colors
   * in a base palette by a given HSL delta. Useful for seasonal
   * recoloring or subtle palette variations.
   *
   * @param {GamePalette|string} palette — The base palette or its name.
   * @param {Object} hslShift — HSL shift values.
   * @param {number} [hslShift.h=0] — Hue shift in degrees (-360 to +360).
   * @param {number} [hslShift.s=0] — Saturation shift (-1.0 to +1.0).
   * @param {number} [hslShift.l=0] — Lightness shift (-1.0 to +1.0).
   * @returns {GamePalette} A new palette with shifted colors.
   *
   * @example
   * const autumnWarm = manager.shiftPalette('Warm', { h: 15, s: 0.1, l: -0.05 });
   */
  shiftPalette(palette, hslShift = {}) {
    const pal = (typeof palette === 'string') ? this.getPalette(palette) : palette;
    if (!pal) {
      console.warn('[PaletteManager] shiftPalette: invalid palette.');
      return null;
    }

    const shiftedColors = {};
    for (const [key, hex] of Object.entries(pal.colors)) {
      shiftedColors[key] = PaletteManager._shiftHSL(hex, hslShift);
    }

    return {
      name: `${pal.name}_shifted`,
      colors: shiftedColors,
      derivedFrom: pal.name
    };
  }

  /**
   * Computes the Euclidean color distance between two hex colors.
   * Useful for finding the closest palette match.
   *
   * @param {string} colorA — First hex color.
   * @param {string} colorB — Second hex color.
   * @returns {number} Squared Euclidean distance in RGB space.
   *
   * @example
   * const dist = manager.colorDistance('#FF0000', '#FF3333');
   * // Returns a small number (close colors)
   */
  colorDistance(colorA, colorB) {
    const a = PaletteManager._hexToRgb(colorA);
    const b = PaletteManager._hexToRgb(colorB);
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
  }

  /**
   * Finds the nearest color in a palette to a given target color.
   *
   * @param {string} targetHex — The target hex color.
   * @param {GamePalette|string} palette — The palette or its name to search.
   * @returns {{key: string, hex: string, distance: number}} The closest palette entry.
   *
   * @example
   * const match = manager.findNearestColor('#7A7A7A', 'Monochrome');
   * // Returns { key: 'base', hex: '#757575', distance: ... }
   */
  findNearestColor(targetHex, palette) {
    const pal = (typeof palette === 'string') ? this.getPalette(palette) : palette;
    if (!pal) {
      console.warn('[PaletteManager] findNearestColor: invalid palette.');
      return null;
    }

    let bestKey = null;
    let bestHex = null;
    let bestDist = Infinity;

    for (const [key, hex] of Object.entries(pal.colors)) {
      const dist = this.colorDistance(targetHex, hex);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = key;
        bestHex = hex;
      }
    }

    return { key: bestKey, hex: bestHex, distance: bestDist };
  }

  /**
   * Creates a new palette by mixing two existing palettes.
   * Each color slot is blended at the given ratio.
   *
   * @param {GamePalette|string} paletteA — First palette or its name.
   * @param {GamePalette|string} paletteB — Second palette or its name.
   * @param {number} [ratio=0.5] — Blend ratio (0.0 = all A, 1.0 = all B).
   * @param {string} [newName] — Optional name for the resulting palette.
   * @returns {GamePalette} A newly created hybrid palette.
   *
   * @example
   * const twilight = manager.mixPalettes('Warm', 'Cool', 0.5, 'Twilight');
   */
  mixPalettes(paletteA, paletteB, ratio = 0.5, newName) {
    const a = (typeof paletteA === 'string') ? this.getPalette(paletteA) : paletteA;
    const b = (typeof paletteB === 'string') ? this.getPalette(paletteB) : paletteB;

    if (!a || !b) {
      console.warn('[PaletteManager] mixPalettes: one or both palettes invalid.');
      return null;
    }

    const mixedColors = {};
    const allKeys = new Set([...Object.keys(a.colors), ...Object.keys(b.colors)]);

    for (const key of allKeys) {
      const colorA = a.colors[key] || '#000000';
      const colorB = b.colors[key] || '#000000';
      mixedColors[key] = this.blend(colorA, colorB, ratio);
    }

    return {
      name: newName || `${a.name}_x_${b.name}`,
      colors: mixedColors
    };
  }

  /**
   * Returns an array of palette names recommended for a given mood.
   * Useful for ambient procedural content generation.
   *
   * @param {string} mood — Mood keyword: 'cozy', 'mysterious', 'energetic', 'spooky', 'festive', 'natural', 'futuristic', 'dreamy'.
   * @returns {string[]} Array of matching palette names.
   *
   * @example
   * const palettes = manager.getPalettesForMood('cozy');
   * // Returns ['Warm', 'Pastel']
   */
  getPalettesForMood(mood) {
    const moodMap = {
      cozy: ['Warm', 'Pastel'],
      mysterious: ['Cool', 'Monochrome'],
      energetic: ['Vibrant', 'Neon'],
      spooky: ['Monochrome', 'Cool'],
      festive: ['Holiday', 'Vibrant'],
      natural: ['Earth', 'Warm'],
      futuristic: ['Neon', 'Cool'],
      dreamy: ['Pastel', 'Cool'],
      neutral: ['Monochrome', 'Warm']
    };
    return moodMap[mood?.toLowerCase()] || ['Warm'];
  }

  /**
   * Serializes a palette to a compact JSON string for storage or network transfer.
   *
   * @param {GamePalette|string} palette — The palette or its name.
   * @returns {string} JSON string representation.
   */
  serializePalette(palette) {
    const pal = (typeof palette === 'string') ? this.getPalette(palette) : palette;
    if (!pal) return '{}';
    return JSON.stringify({
      n: pal.name,
      c: Object.entries(pal.colors).reduce((acc, [k, v]) => {
        acc[k[0]] = v; // Compact keys: 'b' for base, 'l' for light, etc.
        return acc;
      }, {})
    });
  }

  // =============================================================================
  // Static Utility Methods
  // =============================================================================

  /**
   * Converts a 6-digit hex color string to an [R, G, B] array.
   *
   * @private
   * @param {string} hex — Hex color string (e.g., '#FF0000' or 'FF0000').
   * @returns {number[]} [R, G, B] array with values 0–255.
   */
  static _hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r, g, b];
  }

  /**
   * Converts R, G, B values to a 6-digit hex color string.
   *
   * @private
   * @param {number} r — Red (0–255).
   * @param {number} g — Green (0–255).
   * @param {number} b — Blue (0–255).
   * @returns {string} Hex color string with leading '#', zero-padded.
   */
  static _rgbToHex(r, g, b) {
    const toHex = (n) => {
      const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Converts RGB values to HSL.
   *
   * @private
   * @param {number} r — Red (0–255).
   * @param {number} g — Green (0–255).
   * @param {number} b — Blue (0–255).
   * @returns {number[]} [H, S, L] where H is 0–360, S and L are 0–1.
   */
  static _rgbToHsl(r, g, b) {
    const R = r / 255;
    const G = g / 255;
    const B = b / 255;
    const max = Math.max(R, G, B);
    const min = Math.min(R, G, B);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case R: h = (G - B) / d + (G < B ? 6 : 0); break;
        case G: h = (B - R) / d + 2; break;
        case B: h = (R - G) / d + 4; break;
      }
      h *= 60;
    }

    return [h, s, l];
  }

  /**
   * Converts HSL values to RGB.
   *
   * @private
   * @param {number} h — Hue (0–360).
   * @param {number} s — Saturation (0–1).
   * @param {number} l — Lightness (0–1).
   * @returns {number[]} [R, G, B] with values 0–255.
   */
  static _hslToRgb(h, s, l) {
    const hueToRgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hueToRgb(p, q, h / 360 + 1 / 3);
      g = hueToRgb(p, q, h / 360);
      b = hueToRgb(p, q, h / 360 - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  /**
   * Shifts a hex color by HSL delta values.
   *
   * @private
   * @param {string} hex — The source hex color.
   * @param {Object} shift — HSL shift values.
   * @param {number} [shift.h=0] — Hue shift in degrees.
   * @param {number} [shift.s=0] — Saturation shift.
   * @param {number} [shift.l=0] — Lightness shift.
   * @returns {string} The shifted hex color.
   */
  static _shiftHSL(hex, shift = {}) {
    const [r, g, b] = PaletteManager._hexToRgb(hex);
    let [h, s, l] = PaletteManager._rgbToHsl(r, g, b);

    h = (h + (shift.h || 0)) % 360;
    if (h < 0) h += 360;
    s = Math.max(0, Math.min(1, s + (shift.s || 0)));
    l = Math.max(0, Math.min(1, l + (shift.l || 0)));

    const [nr, ng, nb] = PaletteManager._hslToRgb(h, s, l);
    return PaletteManager._rgbToHex(nr, ng, nb);
  }
}

// =============================================================================
// Palette Slot Definitions (for external reference)
// =============================================================================

/**
 * Canonical list of color slot keys used across all palettes.
 * @constant
 * @type {string[]}
 */
export const PALETTE_SLOTS = ['base', 'light', 'dark', 'outline', 'accent1', 'accent2', 'bg', 'text'];

/**
 * Human-readable descriptions for each palette slot.
 * @constant
 * @type {Object<string, string>}
 */
export const SLOT_DESCRIPTIONS = {
  base: 'Main fill color for the majority of a sprite surface.',
  light: 'Highlight color for top-left facing surfaces (bevel simulation).',
  dark: 'Shadow color for bottom-right facing surfaces (bevel simulation).',
  outline: '1-pixel black outline around every sprite element.',
  accent1: 'Primary decorative accent for details, patterns, trim.',
  accent2: 'Secondary decorative accent for subtle differentiation.',
  bg: 'Background / ambient color for area behind the sprite.',
  text: 'Text color designed for legibility over this palette.'
};

// =============================================================================
// Palette Compatibility Matrix
// =============================================================================

/**
 * Matrix defining which palettes pair well for adjacent areas
 * or mixed sprite compositions. Values 0–3 where 3 is best harmony.
 * @constant
 * @type {Object<string, Object<string, number>>}
 */
export const PALETTE_COMPATIBILITY = {
  Warm: { Warm: 3, Cool: 1, Vibrant: 2, Pastel: 2, Neon: 0, Earth: 3, Monochrome: 1, Holiday: 3 },
  Cool: { Warm: 1, Cool: 3, Vibrant: 1, Pastel: 3, Neon: 2, Earth: 2, Monochrome: 2, Holiday: 1 },
  Vibrant: { Warm: 2, Cool: 1, Vibrant: 3, Pastel: 1, Neon: 2, Earth: 2, Monochrome: 0, Holiday: 3 },
  Pastel: { Warm: 2, Cool: 3, Vibrant: 1, Pastel: 3, Neon: 1, Earth: 2, Monochrome: 1, Holiday: 2 },
  Neon: { Warm: 0, Cool: 2, Vibrant: 2, Pastel: 1, Neon: 3, Earth: 0, Monochrome: 1, Holiday: 1 },
  Earth: { Warm: 3, Cool: 2, Vibrant: 2, Pastel: 2, Neon: 0, Earth: 3, Monochrome: 2, Holiday: 2 },
  Monochrome: { Warm: 1, Cool: 2, Vibrant: 0, Pastel: 1, Neon: 1, Earth: 2, Monochrome: 3, Holiday: 1 },
  Holiday: { Warm: 3, Cool: 1, Vibrant: 3, Pastel: 2, Neon: 1, Earth: 2, Monochrome: 1, Holiday: 3 }
};

// =============================================================================
// Default Export
// =============================================================================

export default PaletteManager;
