/**
 * ColorTable.js
 * ============
 * Pre-defined flat color definitions for every asset type in Starlight Inn v6.0.
 * Enforces the Habbo Hotel-inspired aesthetic: bold solid fills,
 * 1-pixel black outlines, no gradients, limited palettes per sprite.
 *
 * Defines color sets for floors, walls, furniture, and avatar parts.
 * All colors are 6-digit hex strings. Every set includes at minimum
 * base, light, dark, and outline colors.
 *
 * @module sprites/ColorTable
 * @version 6.0.0
 * @author Starlight Inn Team
 */

// =============================================================================
// Floor Tile Colors — 16 types
// =============================================================================

/**
 * Color definitions for all 16 floor tile variants.
 * Each entry provides base, light, dark, and outline for pixel-art
 * isometric floor rendering.
 *
 * @constant
 * @type {Object<string, ColorSet>}
 */
export const FLOOR_COLORS = {
  /** Light varnished wood planks. Classic tavern flooring. */
  wood_light: {
    base: '#C19A6B', light: '#D4A84B', dark: '#8B6914', outline: '#000000'
  },
  /** Dark stained hardwood. Formal dining rooms, studies. */
  wood_dark: {
    base: '#5D4037', light: '#795548', dark: '#3E2723', outline: '#000000'
  },
  /** Plain hewn stone. Dungeons, kitchens, courtyards. */
  stone_gray: {
    base: '#9E9E9E', light: '#BDBDBD', dark: '#757575', outline: '#000000'
  },
  /** Warm sandstone. Beach huts, desert rooms, terraces. */
  stone_sand: {
    base: '#D7CCC8', light: '#EFEBE9', dark: '#A1887F', outline: '#000000'
  },
  /** Rough cobblestone. Outdoor plazas, old streets. */
  cobblestone: {
    base: '#757575', light: '#9E9E9E', dark: '#616161', outline: '#000000'
  },
  /** Red fired brick. Industrial areas, fireplaces, kilns. */
  brick_red: {
    base: '#B71C1C', light: '#D32F2F', dark: '#7F0000', outline: '#000000'
  },
  /** Mossy green stone. Forest groves, overgrown ruins. */
  mossy_stone: {
    base: '#558B2F', light: '#7CB342', dark: '#33691E', outline: '#000000'
  },
  /** Polished white marble. Grand halls, ballrooms, galleries. */
  marble_white: {
    base: '#EEEEEE', light: '#FFFFFF', dark: '#BDBDBD', outline: '#000000'
  },
  /** Deep black obsidian. Ritual chambers, arcane spaces. */
  obsidian: {
    base: '#212121', light: '#424242', dark: '#000000', outline: '#000000'
  },
  /** Patterned ceramic tiles. Bathrooms, spas, kitchens. */
  ceramic_blue: {
    base: '#1976D2', light: '#42A5F5', dark: '#0D47A1', outline: '#000000'
  },
  /** Warm terracotta tiles. Mediterranean rooms, sunrooms. */
  terracotta: {
    base: '#A1887F', light: '#BCAAA4', dark: '#8D6E63', outline: '#000000'
  },
  /** Frozen ice floor. Winter caverns, ice palaces. */
  ice: {
    base: '#B2EBF2', light: '#E0F7FA', dark: '#4DD0E1', outline: '#000000'
  },
  /** Packed dirt path. Campsites, trails, outdoor areas. */
  dirt: {
    base: '#795548', light: '#8D6E63', dark: '#5D4037', outline: '#000000'
  },
  /** Lush grass turf. Gardens, meadows, clearings. */
  grass: {
    base: '#43A047', light: '#66BB6A', dark: '#2E7D32', outline: '#000000'
  },
  /** Woven bamboo mat. Zen rooms, tea houses, saunas. */
  bamboo: {
    base: '#C5E1A5', light: '#DCEDC8', dark: '#AED581', outline: '#000000'
  },
  /** Gleaming gold tiles. Treasure rooms, throne rooms. */
  gold: {
    base: '#FFD700', light: '#FFECB3', dark: '#C8A000', outline: '#000000'
  }
};

// =============================================================================
// Wall Colors — 8 types
// =============================================================================

/**
 * Color definitions for all 8 wall variants.
 * Walls use base, light, dark, and outline for flat pixel-art rendering.
 *
 * @constant
 * @type {Object<string, ColorSet>}
 */
export const WALL_COLORS = {
  /** Traditional fired-brick wall. Warm, sturdy, classic. */
  brick: {
    base: '#B71C1C', light: '#D32F2F', dark: '#7F0000', outline: '#000000'
  },
  /** Smooth cut-stone wall. Castles, towers, fortifications. */
  stone: {
    base: '#757575', light: '#9E9E9E', dark: '#616161', outline: '#000000'
  },
  /** Painted plaster wall. Inns, cottages, common rooms. */
  plaster: {
    base: '#FFF3E0', light: '#FFFFFF', dark: '#FFE0B2', outline: '#000000'
  },
  /** Rough-hewn log wall. Cabins, treehouses, frontier buildings. */
  log: {
    base: '#5D4037', light: '#795548', dark: '#3E2723', outline: '#000000'
  },
  /** Industrial metal panel wall. Cyber areas, workshops. */
  metal: {
    base: '#455A64', light: '#607D8B', dark: '#37474F', outline: '#000000'
  },
  /** Dark paneled wood wall. Studies, manor halls, libraries. */
  wood_panel: {
    base: '#3E2723', light: '#5D4037', dark: '#281815', outline: '#000000'
  },
  /** Crystal or glass wall. Ice caves, arcane laboratories. */
  crystal: {
    base: '#4DD0E1', light: '#B2EBF2', dark: '#00ACC1', outline: '#000000'
  },
  /** Living vine wall. Garden rooms, natural enclosures. */
  vine: {
    base: '#33691E', light: '#558B2F', dark: '#1B5E20', outline: '#000000'
  }
};

// =============================================================================
// Furniture Colors — 43 items
// =============================================================================

/**
 * Color definitions for 43 furniture items.
 * Each entry includes base, light, dark, and accent colors.
 * Accent is used for decorative details (buttons, trim, legs).
 *
 * @constant
 * @type {Object<string, FurnitureColorSet>}
 */
export const FURNITURE_COLORS = {
  // -- Seating (10 items) --
  sofa: {
    base: '#C62828', light: '#E53935', dark: '#8E0000', accent: '#FFD700'
  },
  armchair: {
    base: '#1976D2', light: '#42A5F5', dark: '#0D47A1', accent: '#BBDEFB'
  },
  stool: {
    base: '#5D4037', light: '#795548', dark: '#3E2723', accent: '#D7CCC8'
  },
  bench: {
    base: '#795548', light: '#8D6E63', dark: '#5D4037', accent: '#A1887F'
  },
  beanbag: {
    base: '#E91E63', light: '#F48FB1', dark: '#C2185B', accent: '#F8BBD0'
  },
  throne: {
    base: '#FFD700', light: '#FFECB3', dark: '#C8A000', accent: '#FF6F00'
  },
  cushion: {
    base: '#FFCC80', light: '#FFE0B2', dark: '#FFB74D', accent: '#FFFFFF'
  },
  barstool: {
    base: '#424242', light: '#616161', dark: '#212121', accent: '#FF5722'
  },
  lounger: {
    base: '#00796B', light: '#009688', dark: '#004D40', accent: '#80CBC4'
  },
  swing: {
    base: '#8D6E63', light: '#A1887F', dark: '#6D4C41', accent: '#C5E1A5'
  },

  // -- Sleeping (4 items) --
  bed: {
    base: '#5D4037', light: '#8D6E63', dark: '#3E2723', accent: '#FFFFFF'
  },
  bunkbed: {
    base: '#6D4C41', light: '#8D6E63', dark: '#4E342E', accent: '#FFCC80'
  },
  hammock: {
    base: '#43A047', light: '#66BB6A', dark: '#2E7D32', accent: '#C8E6C9'
  },
  sleeping_bag: {
    base: '#E53935', light: '#EF5350', dark: '#C62828', accent: '#FFCDD2'
  },

  // -- Surfaces (8 items) --
  table: {
    base: '#8D6E63', light: '#A1887F', dark: '#5D4037', accent: '#FFE0B2'
  },
  dining_table: {
    base: '#795548', light: '#8D6E63', dark: '#5D4037', accent: '#FFD700'
  },
  coffee_table: {
    base: '#5D4037', light: '#6D4C41', dark: '#3E2723', accent: '#D7CCC8'
  },
  desk: {
    base: '#3E2723', light: '#5D4037', dark: '#281815', accent: '#8D6E63'
  },
  counter: {
    base: '#757575', light: '#9E9E9E', dark: '#616161', accent: '#E0E0E0'
  },
  shelf: {
    base: '#6D4C41', light: '#8D6E63', dark: '#4E342E', accent: '#FFFFFF'
  },
  bookcase: {
    base: '#5D4037', light: '#6D4C41', dark: '#3E2723', accent: '#FFCC80'
  },
  sideboard: {
    base: '#4E342E', light: '#5D4037', dark: '#3E2723', accent: '#FFD700'
  },

  // -- Storage (7 items) --
  chest: {
    base: '#8D6E63', light: '#A1887F', dark: '#5D4037', accent: '#FFD700'
  },
  wardrobe: {
    base: '#5D4037', light: '#6D4C41', dark: '#3E2723', accent: '#BCAAA4'
  },
  crate: {
    base: '#A1887F', light: '#BCAAA4', dark: '#8D6E63', accent: '#5D4037'
  },
  barrel: {
    base: '#6D4C41', light: '#8D6E63', dark: '#4E342E', accent: '#A1887F'
  },
  cabinet: {
    base: '#795548', light: '#8D6E63', dark: '#5D4037', accent: '#FFFFFF'
  },
  trunk: {
    base: '#4E342E', light: '#5D4037', dark: '#3E2723', accent: '#FFD700'
  },
  safe: {
    base: '#424242', light: '#616161', dark: '#212121', accent: '#FFD700'
  },

  // -- Lighting (4 items) --
  lamp: {
    base: '#8D6E63', light: '#FFEB3B', dark: '#5D4037', accent: '#FFFFFF'
  },
  chandelier: {
    base: '#FFD700', light: '#FFF59D', dark: '#C8A000', accent: '#FFFFFF'
  },
  lantern: {
    base: '#5D4037', light: '#FF9800', dark: '#3E2723', accent: '#FFC107'
  },
  torch: {
    base: '#3E2723', light: '#FF5722', dark: '#281815', accent: '#FF9800'
  },

  // -- Decorative (10 items) --
  rug: {
    base: '#C62828', light: '#E53935', dark: '#8E0000', accent: '#FFD700'
  },
  curtain: {
    base: '#7B1FA2', light: '#9C27B0', dark: '#4A148C', accent: '#E1BEE7'
  },
  mirror: {
    base: '#BDBDBD', light: '#F5F5F5', dark: '#9E9E9E', accent: '#FFD700'
  },
  painting: {
    base: '#5D4037', light: '#8D6E63', dark: '#3E2723', accent: '#FFCC80'
  },
  plant: {
    base: '#2E7D32', light: '#43A047', dark: '#1B5E20', accent: '#795548'
  },
  vase: {
    base: '#4DD0E1', light: '#B2EBF2', dark: '#00ACC1', accent: '#FFFFFF'
  },
  clock: {
    base: '#5D4037', light: '#8D6E63', dark: '#3E2723', accent: '#FFD700'
  },
  banner: {
    base: '#C62828', light: '#E53935', dark: '#8E0000', accent: '#FFD700'
  },
  trophy: {
    base: '#FFD700', light: '#FFF59D', dark: '#C8A000', accent: '#FFFFFF'
  },
  fountain: {
    base: '#607D8B', light: '#90A4AE', dark: '#455A64', accent: '#4DD0E1'
  }
};

// =============================================================================
// Avatar Part Colors
// =============================================================================

/**
 * Color definitions for avatar body parts.
 * Each part has base, light, and dark for flat pixel-art shading.
 * Hair and skin include additional option arrays for customization.
 *
 * @constant
 * @type {Object<string, AvatarColorSet>}
 */
export const AVATAR_COLORS = {
  /** Default skin tone with warm peach shading. */
  skin: {
    base: '#FFCC80',
    light: '#FFE0B2',
    dark: '#FFB74D',
    options: [
      '#FFCC80', // warm peach
      '#E0AC69', // medium tan
      '#8D5524', // deep brown
      '#F5D0A9', // fair
      '#C68642', // olive
      '#E0C8A0', // light beige
      '#5C3A21'  // dark brown
    ]
  },

  /** Hair with common natural and fantasy color options. */
  hair: {
    base: '#5D4037',
    light: '#795548',
    dark: '#3E2723',
    options: [
      '#5D4037', // brown
      '#3E2723', // dark brown
      '#FFD54F', // blonde
      '#B71C1C', // red
      '#FFFFFF', // white / silver
      '#212121', // black
      '#E040FB', // fantasy purple
      '#00E5FF', // fantasy cyan
      '#FF6D00', // ginger
      '#757575'  // gray
    ]
  },

  /** Default shirt with classic blue tones. */
  shirt: {
    base: '#1976D2',
    light: '#42A5F5',
    dark: '#0D47A1',
    options: [
      '#1976D2', // blue
      '#C62828', // red
      '#388E3C', // green
      '#FBC02D', // yellow
      '#7B1FA2', // purple
      '#E64A19', // orange
      '#455A64', // slate
      '#FFFFFF', // white
      '#212121', // black
      '#FF80AB'  // pink
    ]
  },

  /** Default pants with neutral gray-blue tones. */
  pants: {
    base: '#424242',
    light: '#616161',
    dark: '#212121',
    options: [
      '#424242', // dark gray
      '#1565C0', // jeans blue
      '#5D4037', // brown
      '#212121', // black
      '#795548', // khaki
      '#37474F', // slate
      '#33691E', // olive
      '#6D4C41', // tan
      '#C62828', // red
      '#B0BEC5'  // light gray
    ]
  },

  /** Default shoes with dark leather tones. */
  shoes: {
    base: '#3E2723',
    light: '#5D4037',
    dark: '#1B0000',
    options: [
      '#3E2723', // dark brown
      '#212121', // black
      '#795548', // light brown
      '#B71C1C', // red
      '#FFFFFF', // white
      '#1565C0', // blue
      '#7B1FA2', // purple
      '#388E3C', // green
      '#E64A19', // orange
      '#FFD700'  // gold
    ]
  },

  /** Eyes with standard and fantasy options. */
  eyes: {
    base: '#424242',
    light: '#616161',
    dark: '#212121',
    options: [
      '#424242', // dark brown
      '#1976D2', // blue
      '#388E3C', // green
      '#E64A19', // hazel
      '#9E9E9E', // gray
      '#7B1FA2', // violet
      '#E040FB', // pink
      '#00E5FF', // cyan
      '#FFD700', // gold
      '#212121'  // black
    ]
  },

  /** Mouth / lips with subtle tones. */
  mouth: {
    base: '#E57373',
    light: '#EF9A9A',
    dark: '#C62828',
    options: [
      '#E57373', // soft red
      '#F48FB1', // pink
      '#D32F2F', // bold red
      '#8D6E63', // brown
      '#FFAB91', // peach
      '#CE93D8', // lavender
      '#BCAAA4', // neutral
      '#FFCC80'  // warm
    ]
  },

  /** Accessories — glasses, hats, jewelry base tones. */
  accessory: {
    base: '#FFD700',
    light: '#FFF59D',
    dark: '#C8A000',
    options: [
      '#FFD700', // gold
      '#C0C0C0', // silver
      '#8D6E63', // bronze
      '#E91E63', // pink
      '#212121', // black
      '#FFFFFF', // white
      '#4DD0E1', // crystal blue
      '#7B1FA2', // amethyst
      '#E64A19', // coral
      '#43A047'  // emerald
    ]
  }
};

// =============================================================================
// Color Rules & Validation Constraints
// =============================================================================

/**
 * Immutable rules that all sprites and color definitions must obey.
 * Enforces the flat, limited palette aesthetic.
 *
 * @constant
 * @type {ColorRules}
 */
export const COLOR_RULES = {
  /** Maximum number of unique colors allowed in a single sprite. */
  maxColorsPerSprite: 6,

  /** Every sprite must have a solid black outline. */
  mustHaveOutline: true,

  /** The canonical outline color. */
  outlineColor: '#000000',

  /** Gradients, soft shadows, and blending are forbidden. */
  noGradients: true,

  /** Anti-aliased edges (semi-transparent edge pixels) are forbidden. */
  noAntiAliasing: true,

  /** Semi-transparent fill colors (alpha < 1.0) are forbidden. */
  noSemiTransparent: true,

  /** All fills must be flat, solid colors. */
  mustBeFlatFill: true,

  /** Minimum contrast ratio between text and background for legibility. */
  minContrastRatio: 3.0,

  /** Whether accent colors must differ from base by a minimum distance. */
  accentMinDistance: 60,

  /** All defined hex strings must be exactly 6 characters after '#'. */
  strictHexFormat: true,

  /** Alpha channel must be either 0 (transparent) or 255 (opaque). */
  binaryAlpha: true
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Retrieves the color set for a specific floor tile type.
 *
 * @param {string} type — Floor type identifier (e.g., 'wood_light', 'stone_gray').
 * @returns {ColorSet|null} The color set, or null if the type is unknown.
 *
 * @example
 * const colors = getFloorColors('wood_light');
 * console.log(colors.base); // '#C19A6B'
 */
export function getFloorColors(type) {
  if (!type || typeof type !== 'string') {
    console.warn('[ColorTable] getFloorColors called with invalid type:', type);
    return null;
  }
  const key = type.toLowerCase().replace(/\s+/g, '_');
  return FLOOR_COLORS[key] ?? null;
}

/**
 * Retrieves the color set for a specific wall type.
 *
 * @param {string} type — Wall type identifier (e.g., 'brick', 'stone', 'plaster').
 * @returns {ColorSet|null} The color set, or null if the type is unknown.
 *
 * @example
 * const colors = getWallColors('brick');
 * console.log(colors.base); // '#B71C1C'
 */
export function getWallColors(type) {
  if (!type || typeof type !== 'string') {
    console.warn('[ColorTable] getWallColors called with invalid type:', type);
    return null;
  }
  const key = type.toLowerCase().replace(/\s+/g, '_');
  return WALL_COLORS[key] ?? null;
}

/**
 * Retrieves the color set for a specific furniture item.
 *
 * @param {string} id — Furniture identifier (e.g., 'sofa', 'bed', 'table').
 * @returns {FurnitureColorSet|null} The color set, or null if the id is unknown.
 *
 * @example
 * const colors = getFurnitureColors('sofa');
 * console.log(colors.accent); // '#FFD700'
 */
export function getFurnitureColors(id) {
  if (!id || typeof id !== 'string') {
    console.warn('[ColorTable] getFurnitureColors called with invalid id:', id);
    return null;
  }
  const key = id.toLowerCase().replace(/\s+/g, '_');
  return FURNITURE_COLORS[key] ?? null;
}

/**
 * Retrieves the color set for an avatar body part.
 *
 * @param {string} part — Body part identifier (e.g., 'skin', 'hair', 'shirt').
 * @returns {AvatarColorSet|null} The color set with options, or null if unknown.
 *
 * @example
 * const skin = getAvatarColors('skin');
 * console.log(skin.options.length); // 7
 */
export function getAvatarColors(part) {
  if (!part || typeof part !== 'string') {
    console.warn('[ColorTable] getAvatarColors called with invalid part:', part);
    return null;
  }
  const key = part.toLowerCase().replace(/\s+/g, '_');
  return AVATAR_COLORS[key] ?? null;
}

// =============================================================================
// Color Manipulation Functions
// =============================================================================

/**
 * Parses a 6-digit hex color string into an [R, G, B] array.
 *
 * @param {string} hex — Hex color (e.g., '#FF0000').
 * @returns {number[]} [R, G, B] in range 0–255.
 * @private
 */
function _hexToRgbArray(hex) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

/**
 * Converts [R, G, B] values to a 6-digit hex string.
 *
 * @param {number} r — Red (0–255).
 * @param {number} g — Green (0–255).
 * @param {number} b — Blue (0–255).
 * @returns {string} Hex color string with leading '#'.
 * @private
 */
function _rgbArrayToHex(r, g, b) {
  const toHex = (n) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts RGB to HSL.
 *
 * @param {number} r — Red (0–255).
 * @param {number} g — Green (0–255).
 * @param {number} b — Blue (0–255).
 * @returns {number[]} [H, S, L] where H is 0–360, S and L are 0–1.
 * @private
 */
function _rgbToHsl(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  let h = 0, s = 0;
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
 * Converts HSL to RGB.
 *
 * @param {number} h — Hue (0–360).
 * @param {number} s — Saturation (0–1).
 * @param {number} l — Lightness (0–1).
 * @returns {number[]} [R, G, B] in range 0–255.
 * @private
 */
function _hslToRgb(h, s, l) {
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
 * Applies an HSL shift to a single hex color.
 *
 * @param {string} hex — Source hex color.
 * @param {Object} hslShift — HSL delta values.
 * @param {number} [hslShift.h=0] — Hue shift in degrees.
 * @param {number} [hslShift.s=0] — Saturation shift (-1 to +1).
 * @param {number} [hslShift.l=0] — Lightness shift (-1 to +1).
 * @returns {string} The shifted hex color.
 * @private
 */
function _shiftSingleColor(hex, hslShift) {
  const [r, g, b] = _hexToRgbArray(hex);
  let [h, s, l] = _rgbToHsl(r, g, b);

  h = (h + (hslShift.h || 0)) % 360;
  if (h < 0) h += 360;
  s = Math.max(0, Math.min(1, s + (hslShift.s || 0)));
  l = Math.max(0, Math.min(1, l + (hslShift.l || 0)));

  const [nr, ng, nb] = _hslToRgb(h, s, l);
  return _rgbArrayToHex(nr, ng, nb);
}

/**
 * Shifts all colors in a color set by a given HSL delta.
 * Useful for generating seasonal or time-of-day variants.
 *
 * @param {ColorSet|FurnitureColorSet} colors — The color set to shift.
 * @param {Object} hslShift — HSL delta values.
 * @param {number} [hslShift.h=0] — Hue shift in degrees.
 * @param {number} [hslShift.s=0] — Saturation shift (-1 to +1).
 * @param {number} [hslShift.l=0] — Lightness shift (-1 to +1).
 * @returns {ColorSet|FurnitureColorSet} A new color set with shifted values.
 *
 * @example
 * const autumnWood = applyHSL(FLOOR_COLORS.wood_light, { h: 15, s: 0.1, l: -0.05 });
 */
export function applyHSL(colors, hslShift = {}) {
  if (!colors || typeof colors !== 'object') {
    console.warn('[ColorTable] applyHSL called with invalid colors object.');
    return null;
  }

  const shifted = {};
  for (const [key, hex] of Object.entries(colors)) {
    if (typeof hex === 'string' && hex.startsWith('#')) {
      shifted[key] = _shiftSingleColor(hex, hslShift);
    } else if (key === 'options' && Array.isArray(hex)) {
      shifted[key] = hex.map(c => _shiftSingleColor(c, hslShift));
    } else {
      shifted[key] = hex; // Preserve non-color properties as-is.
    }
  }
  return shifted;
}

/**
 * Generates a randomized variant of a furniture color set by perturbing
 * each color's lightness slightly. Useful for giving identical furniture
 * items subtle visual variety.
 *
 * @param {FurnitureColorSet|ColorSet} basePalette — The base color set.
 * @param {number} [variance=0.08] — Maximum lightness variance (+/-).
 * @returns {FurnitureColorSet|ColorSet} A randomized color variant.
 *
 * @example
 * const randomSofa = randomizeFurnitureColors(FURNITURE_COLORS.sofa);
 */
export function randomizeFurnitureColors(basePalette, variance = 0.08) {
  if (!basePalette || typeof basePalette !== 'object') {
    console.warn('[ColorTable] randomizeFurnitureColors called with invalid basePalette.');
    return null;
  }

  const randomized = {};
  for (const [key, hex] of Object.entries(basePalette)) {
    if (typeof hex === 'string' && hex.startsWith('#')) {
      const shift = {
        h: 0,
        s: 0,
        l: (Math.random() * 2 - 1) * variance
      };
      randomized[key] = _shiftSingleColor(hex, shift);
    } else {
      randomized[key] = hex;
    }
  }
  return randomized;
}

// =============================================================================
// Bulk Color Utilities
// =============================================================================

/**
 * Returns all floor color keys as an array.
 *
 * @returns {string[]} Array of floor type identifiers.
 */
export function getAllFloorTypes() {
  return Object.keys(FLOOR_COLORS);
}

/**
 * Returns all wall color keys as an array.
 *
 * @returns {string[]} Array of wall type identifiers.
 */
export function getAllWallTypes() {
  return Object.keys(WALL_COLORS);
}

/**
 * Returns all furniture color keys as an array.
 *
 * @returns {string[]} Array of furniture identifiers.
 */
export function getAllFurnitureIds() {
  return Object.keys(FURNITURE_COLORS);
}

/**
 * Returns all avatar part keys as an array.
 *
 * @returns {string[]} Array of avatar part identifiers.
 */
export function getAllAvatarParts() {
  return Object.keys(AVATAR_COLORS);
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Checks whether a hex string is valid and in 6-digit format.
 *
 * @param {string} hex — The color string to validate.
 * @returns {boolean} True if valid 6-digit hex with leading '#'.
 */
export function isValidHex(hex) {
  if (typeof hex !== 'string') return false;
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

/**
 * Computes the relative luminance of a hex color (per WCAG 2.1).
 *
 * @param {string} hex — Hex color string.
 * @returns {number} Relative luminance, 0–1.
 */
export function getLuminance(hex) {
  const [r, g, b] = _hexToRgbArray(hex).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Computes the contrast ratio between two hex colors.
 *
 * @param {string} hexA — First hex color.
 * @param {string} hexB — Second hex color.
 * @returns {number} Contrast ratio (1–21).
 */
export function getContrastRatio(hexA, hexB) {
  const lumA = getLuminance(hexA);
  const lumB = getLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Validates that a given color set conforms to COLOR_RULES.
 * Ensures all entries are valid hex, an outline is present,
 * and accent colors are sufficiently distinct from base.
 *
 * @param {ColorSet|FurnitureColorSet} colorSet — The color set to validate.
 * @param {string} [setName='unknown'] — Name for error messages.
 * @returns {{valid: boolean, errors: string[]}} Validation result.
 */
export function validateColorSet(colorSet, setName = 'unknown') {
  const errors = [];

  if (!colorSet || typeof colorSet !== 'object') {
    errors.push(`[${setName}] Color set is not an object.`);
    return { valid: false, errors };
  }

  const entries = Object.entries(colorSet);
  if (entries.length === 0) {
    errors.push(`[${setName}] Color set is empty.`);
  }

  // Check max colors.
  const colorEntries = entries.filter(([k, v]) => typeof v === 'string' && v.startsWith('#'));
  if (colorEntries.length > COLOR_RULES.maxColorsPerSprite) {
    errors.push(`[${setName}] Color set has ${colorEntries.length} colors, max is ${COLOR_RULES.maxColorsPerSprite}.`);
  }

  // Validate hex format.
  for (const [key, val] of colorEntries) {
    if (!isValidHex(val)) {
      errors.push(`[${setName}] Invalid hex for key "${key}": ${val}`);
    }
  }

  // Check outline presence.
  if (COLOR_RULES.mustHaveOutline) {
    const hasOutline = colorEntries.some(([k, v]) => k === 'outline' && v === COLOR_RULES.outlineColor);
    if (!hasOutline) {
      errors.push(`[${setName}] Missing required black outline.`);
    }
  }

  // Check accent distance from base.
  if (colorSet.accent && colorSet.base) {
    const [r1, g1, b1] = _hexToRgbArray(colorSet.base);
    const [r2, g2, b2] = _hexToRgbArray(colorSet.accent);
    const dist = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
    if (dist < COLOR_RULES.accentMinDistance) {
      errors.push(`[${setName}] Accent color too close to base (distance ${Math.round(dist)}).`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Runs validation across all defined color tables and reports issues.
 *
 * @returns {{totalErrors: number, reports: Object<string, {valid: boolean, errors: string[]}>}}
 */
export function validateAllColorTables() {
  const reports = {};
  let totalErrors = 0;

  for (const [name, set] of Object.entries(FLOOR_COLORS)) {
    const r = validateColorSet(set, `FLOOR:${name}`);
    reports[`floor:${name}`] = r;
    if (!r.valid) totalErrors += r.errors.length;
  }
  for (const [name, set] of Object.entries(WALL_COLORS)) {
    const r = validateColorSet(set, `WALL:${name}`);
    reports[`wall:${name}`] = r;
    if (!r.valid) totalErrors += r.errors.length;
  }
  for (const [name, set] of Object.entries(FURNITURE_COLORS)) {
    const r = validateColorSet(set, `FURNITURE:${name}`);
    reports[`furniture:${name}`] = r;
    if (!r.valid) totalErrors += r.errors.length;
  }
  for (const [name, set] of Object.entries(AVATAR_COLORS)) {
    const r = validateColorSet(set, `AVATAR:${name}`);
    reports[`avatar:${name}`] = r;
    if (!r.valid) totalErrors += r.errors.length;
  }

  return { totalErrors, reports };
}

// =============================================================================
// Color Set Builders
// =============================================================================

/**
 * Creates a new color set from a base color, automatically generating
 * light and dark variants plus a black outline.
 *
 * @param {string} baseHex — The base fill color.
 * @param {number} [lightAmount=40] — Amount to lighten for the highlight.
 * @param {number} [darkAmount=40] — Amount to darken for the shadow.
 * @returns {ColorSet} A complete color set with base, light, dark, outline.
 */
export function buildColorSet(baseHex, lightAmount = 40, darkAmount = 40) {
  const [r, g, b] = _hexToRgbArray(baseHex);

  const light = _rgbArrayToHex(
    Math.min(255, r + lightAmount),
    Math.min(255, g + lightAmount),
    Math.min(255, b + lightAmount)
  );
  const dark = _rgbArrayToHex(
    Math.max(0, r - darkAmount),
    Math.max(0, g - darkAmount),
    Math.max(0, b - darkAmount)
  );

  return {
    base: baseHex,
    light,
    dark,
    outline: '#000000'
  };
}

/**
 * Generates a complete furniture color set from a base and an accent.
 *
 * @param {string} baseHex — Main fill color.
 * @param {string} accentHex — Decorative accent color.
 * @returns {FurnitureColorSet} Full furniture color set.
 */
export function buildFurnitureColors(baseHex, accentHex) {
  const [r, g, b] = _hexToRgbArray(baseHex);

  const light = _rgbArrayToHex(
    Math.min(255, r + 40),
    Math.min(255, g + 40),
    Math.min(255, b + 40)
  );
  const dark = _rgbArrayToHex(
    Math.max(0, r - 40),
    Math.max(0, g - 40),
    Math.max(0, b - 40)
  );

  return {
    base: baseHex,
    light,
    dark,
    accent: accentHex,
    outline: '#000000'
  };
}

// =============================================================================
// Lookup Indices for Fast Access
// =============================================================================

/**
 * Map from room theme keywords to recommended floor color types.
 * @constant
 * @type {Object<string, string[]>}
 */
export const THEME_FLOOR_MAP = {
  tavern: ['wood_light', 'wood_dark', 'cobblestone'],
  cavern: ['stone_gray', 'obsidian', 'ice'],
  bazaar: ['ceramic_blue', 'terracotta', 'cobblestone'],
  garden: ['grass', 'dirt', 'mossy_stone'],
  cloud: ['bamboo', 'wood_light', 'marble_white'],
  cyber: ['metal', 'obsidian', 'ceramic_blue'],
  forest: ['dirt', 'grass', 'mossy_stone'],
  manor: ['marble_white', 'wood_dark', 'stone_gray'],
  holiday: ['wood_dark', 'red_brick', 'gold'],
  beach: ['stone_sand', 'wood_light', 'dirt']
};

/**
 * Map from room theme keywords to recommended wall color types.
 * @constant
 * @type {Object<string, string[]>}
 */
export const THEME_WALL_MAP = {
  tavern: ['log', 'wood_panel', 'plaster'],
  cavern: ['stone', 'crystal', 'metal'],
  bazaar: ['plaster', 'brick', 'stone'],
  garden: ['vine', 'log', 'plaster'],
  cloud: ['plaster', 'wood_panel', 'log'],
  cyber: ['metal', 'stone', 'crystal'],
  forest: ['log', 'vine', 'wood_panel'],
  manor: ['wood_panel', 'stone', 'plaster'],
  holiday: ['brick', 'wood_panel', 'plaster'],
  beach: ['plaster', 'log', 'stone']
};

// =============================================================================
// Default Export
// =============================================================================

export default {
  FLOOR_COLORS,
  WALL_COLORS,
  FURNITURE_COLORS,
  AVATAR_COLORS,
  COLOR_RULES,
  THEME_FLOOR_MAP,
  THEME_WALL_MAP,
  getFloorColors,
  getWallColors,
  getFurnitureColors,
  getAvatarColors,
  applyHSL,
  randomizeFurnitureColors,
  getAllFloorTypes,
  getAllWallTypes,
  getAllFurnitureIds,
  getAllAvatarParts,
  isValidHex,
  getLuminance,
  getContrastRatio,
  validateColorSet,
  validateAllColorTables,
  buildColorSet,
  buildFurnitureColors
};
