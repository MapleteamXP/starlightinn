/**
 * IsoTileset.js — Starlight Inn v5.0
 * Procedural isometric tileset renderer for 2:1 diamond-tile world.
 * Defines all floor tiles and wall types with Canvas 2D pixel-art drawing.
 *
 * Floor tiles: 16 types drawn as 64×32 diamonds with type-specific textures.
 * Wall types: 8 types with 3 visible faces (top, left, right) and per-face detail.
 *
 * @module IsoTileset
 * @version 5.0.0
 * @author Starlight Inn Team
 */

// ============================================================
// Isometric Grid Constants (2:1 diamond ratio)
// ============================================================

/** Half tile width in pixels @type {number} */
const TILE_HW = 32;
/** Half tile height in pixels @type {number} */
const TILE_HH = 16;
/** Wall face height in pixels @type {number} */
const WALL_H = 24;

// ============================================================
// Utility — Diamond Path Helpers
// ============================================================

/**
 * Begin a diamond-shaped path on the given 2D context.
 * The diamond spans TILE_WIDTH × TILE_HEIGHT (64×32) with its
 * top corner at (x, y).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x — screen X of the diamond's top corner
 * @param {number} y — screen Y of the diamond's top corner
 */
function _diamondPath(ctx, x, y) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + TILE_HW, y + TILE_HH);
  ctx.lineTo(x, y + TILE_HH * 2);
  ctx.lineTo(x - TILE_HW, y + TILE_HH);
  ctx.closePath();
}

/**
 * Clip subsequent drawing to the diamond shape.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x — top corner X
 * @param {number} y — top corner Y
 */
function _clipDiamond(ctx, x, y) {
  ctx.save();
  _diamondPath(ctx, x, y);
  ctx.clip();
}

/**
 * Fill the diamond with a solid colour.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {string} color
 */
function _fillDiamond(ctx, x, y, color) {
  ctx.fillStyle = color;
  _diamondPath(ctx, x, y);
  ctx.fill();
}

/**
 * Stroke a 1px outline around the diamond.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {string} color
 */
function _strokeDiamond(ctx, x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  _diamondPath(ctx, x, y);
  ctx.stroke();
}

/**
 * Draw the standard edge highlight (top-left) and shadow (bottom-right)
 * on top of an already-filled diamond.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {string} highlight
 * @param {string} shadow
 */
function _drawEdges(ctx, x, y, highlight, shadow) {
  // Top-left edge highlight
  ctx.strokeStyle = highlight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - TILE_HW + 1, y + TILE_HH);
  ctx.lineTo(x, y + 1);
  ctx.lineTo(x + TILE_HW - 1, y + TILE_HH);
  ctx.stroke();

  // Bottom-right edge shadow
  ctx.strokeStyle = shadow;
  ctx.beginPath();
  ctx.moveTo(x + TILE_HW - 1, y + TILE_HH);
  ctx.lineTo(x, y + TILE_HH * 2 - 1);
  ctx.lineTo(x - TILE_HW + 1, y + TILE_HH);
  ctx.stroke();
}

// ============================================================
// Utility — Colour Helpers
// ============================================================

/**
 * Lighten a hex colour by a percentage.
 *
 * @param {string} hex
 * @param {number} pct 0-100
 * @returns {string}
 */
function _lighten(hex, pct) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.min(255, Math.floor(r + (255 - r) * (pct / 100)));
  g = Math.min(255, Math.floor(g + (255 - g) * (pct / 100)));
  b = Math.min(255, Math.floor(b + (255 - b) * (pct / 100)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Darken a hex colour by a percentage.
 *
 * @param {string} hex
 * @param {number} pct 0-100
 * @returns {string}
 */
function _darken(hex, pct) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.floor(r * (1 - pct / 100)));
  g = Math.max(0, Math.floor(g * (1 - pct / 100)));
  b = Math.max(0, Math.floor(b * (1 - pct / 100)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// ============================================================
// Floor Tile Palettes
// ============================================================

/** @type {Object<string, {base:string,highlight:string,shadow:string,accent:string}>} */
const FLOOR_PALETTES = {
  wood_light:     { base: '#D4A76A', highlight: '#E8C99A', shadow: '#A07840', accent: '#C49A5A' },
  wood_dark:      { base: '#5C2E16', highlight: '#8A5533', shadow: '#361A0A', accent: '#6B3A22' },
  wood_checker:   { base: '#C49A5A', highlight: '#E0C090', shadow: '#7A5020', accent: '#A07840' },
  stone_gray:     { base: '#8A8A8A', highlight: '#B0B0B0', shadow: '#5A5A5A', accent: '#707070' },
  stone_mosaic:   { base: '#7A7068', highlight: '#9A9088', shadow: '#4A4038', accent: '#D4B878' },
  carpet_red:     { base: '#8B2020', highlight: '#B84040', shadow: '#501010', accent: '#D4A830' },
  carpet_blue:    { base: '#204080', highlight: '#4068B0', shadow: '#102050', accent: '#A0B8D0' },
  carpet_green:   { base: '#206028', highlight: '#388848', shadow: '#103018', accent: '#E0D8A0' },
  grass:          { base: '#38A830', highlight: '#58D048', shadow: '#207020', accent: '#F8D850' },
  sand:           { base: '#D8B868', highlight: '#F0D890', shadow: '#A08840', accent: '#C8A858' },
  water:          { base: '#2088C8', highlight: '#58B8F0', shadow: '#105878', accent: '#90D8F8' },
  snow:           { base: '#E8F0F8', highlight: '#FFFFFF', shadow: '#B0C0D0', accent: '#D0E0F0' },
  marble_white:   { base: '#E8E8E8', highlight: '#FFFFFF', shadow: '#B0B0B0', accent: '#989898' },
  tile_terracotta:{ base: '#B86038', highlight: '#D88860', shadow: '#783818', accent: '#D0A070' },
  dirt:           { base: '#886840', highlight: '#A88860', shadow: '#584028', accent: '#706050' },
  neon_grid:      { base: '#181028', highlight: '#2A1848', shadow: '#0C0818', accent: '#00F8C8' }
};

/** @type {string[]} */
const FLOOR_TYPES = Object.keys(FLOOR_PALETTES);

/**
 * Get the colour palette for a floor tile type.
 *
 * @param {string} type
 * @returns {{base:string,highlight:string,shadow:string,accent:string}}
 */
export function getFloorPalette(type) {
  return FLOOR_PALETTES[type] || FLOOR_PALETTES.stone_gray;
}

// ============================================================
// Wall Palettes
// ============================================================

/** @type {Object<string, {top:string,left:string,right:string,highlight:string,shadow:string}>} */
const WALL_PALETTES = {
  wall_brick:   { top: '#C87860', left: '#A85840', right: '#884030', highlight: '#D89080', shadow: '#683020' },
  wall_stone:   { top: '#989898', left: '#787878', right: '#585858', highlight: '#B0B0B0', shadow: '#404040' },
  wall_wood:    { top: '#A07848', left: '#805830', right: '#604020', highlight: '#C09868', shadow: '#483018' },
  wall_plaster: { top: '#E0D8C8', left: '#C0B8A8', right: '#A09888', highlight: '#F0ECE0', shadow: '#887E70' },
  wall_bamboo:  { top: '#C8B068', left: '#A89048', right: '#887028', highlight: '#E0CC88', shadow: '#685420' },
  wall_ice:     { top: '#A8D8E8', left: '#80B8D0', right: '#5898B0', highlight: '#C8E8F5', shadow: '#407888' },
  wall_mossy:   { top: '#889878', left: '#687858', right: '#505E40', highlight: '#A0B090', shadow: '#3A4830' },
  wall_neon:    { top: '#282038', left: '#1C1830', right: '#141020', highlight: '#403858', shadow: '#0C0810' }
};

/** @type {string[]} */
const WALL_TYPES = Object.keys(WALL_PALETTES);

/**
 * Get the colour palette for a wall type.
 *
 * @param {string} type
 * @returns {{top:string,left:string,right:string,highlight:string,shadow:string}}
 */
export function getWallPalette(type) {
  return WALL_PALETTES[type] || WALL_PALETTES.wall_stone;
}

// ============================================================
// Floor Tile Draw Functions
// ============================================================

/**
 * 1. Light warm wood planks with subtle grain lines.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x — top corner X
 * @param {number} y — top corner Y
 */
export function drawFloor_wood_light(ctx, x, y) {
  const p = FLOOR_PALETTES.wood_light;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Plank seams
  ctx.strokeStyle = p.shadow;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x - TILE_HW, y + TILE_HH + i * 6);
    ctx.lineTo(x + TILE_HW, y + TILE_HH + i * 6);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Grain lines
  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 4; i++) {
    const gy = y + 8 + i * 7;
    ctx.beginPath();
    ctx.moveTo(x - 12 + i * 4, gy);
    ctx.lineTo(x + 8 + i * 5, gy + 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.restore();
  _drawEdges(ctx, x, y, p.highlight, p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 20));
}

/**
 * 2. Rich mahogany wood planks.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
export function drawFloor_wood_dark(ctx, x, y) {
  const p = FLOOR_PALETTES.wood_dark;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Horizontal plank lines
  ctx.strokeStyle = p.highlight;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x - TILE_HW, y + TILE_HH + i * 7);
    ctx.lineTo(x + TILE_HW, y + TILE_HH + i * 7);
    ctx.stroke();
  }
  // Vertical plank divisions
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 16, y);
    ctx.lineTo(x + i * 16, y + TILE_HH * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Wood grain
  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 20 + i * 10, y + 6 + i * 4);
    ctx.quadraticCurveTo(x + i * 4, y + 12 + i * 5, x + 10 + i * 6, y + 22 + i * 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.restore();
  _drawEdges(ctx, x, y, p.highlight, p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 25));
}

/**
 * 3. Alternating light/dark wood checkerboard squares.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
export function drawFloor_wood_checker(ctx, x, y) {
  const p = FLOOR_PALETTES.wood_checker;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  const light = '#D4A76A';
  const dark = '#7A5020';

  // Checker squares — draw small diamond patches
  const offsets = [
    { dx: -16, dy: 8, s: 1 }, { dx: 0, dy: 8, s: 0 },
    { dx: 16, dy: 8, s: 1 }, { dx: -16, dy: 16, s: 0 },
    { dx: 0, dy: 16, s: 1 }, { dx: 16, dy: 16, s: 0 },
    { dx: -16, dy: 24, s: 1 }, { dx: 0, dy: 24, s: 0 },
    { dx: 16, dy: 24, s: 1 }
  ];

  offsets.forEach(o => {
    ctx.fillStyle = o.s === 1 ? light : dark;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x + o.dx - 8, y + o.dy - 4, 16, 8);
  });
  ctx.globalAlpha = 1;

  // Grid lines
  ctx.strokeStyle = p.shadow;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 16, y + 8); ctx.lineTo(x - 16, y + 24);
  ctx.moveTo(x + 16, y + 8); ctx.lineTo(x + 16, y + 24);
  ctx.moveTo(x - 24, y + 16); ctx.lineTo(x + 24, y + 16);
  ctx.stroke();

  ctx.restore();
  _drawEdges(ctx, x, y, p.highlight, p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 20));
}

/**
 * 4. Smooth gray stone tiles.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
export function drawFloor_stone_gray(ctx, x, y) {
  const p = FLOOR_PALETTES.stone_gray;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Tile seams
  ctx.strokeStyle = p.shadow;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - TILE_HW, y + TILE_HH);
  ctx.lineTo(x + TILE_HW, y + TILE_HH);
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + TILE_HH * 2);
  ctx.stroke();

  // Subtle texture speckles
  ctx.fillStyle = p.accent;
  for (let i = 0; i < 12; i++) {
    const sx = x + (Math.sin(i * 2.7) * 24);
    const sy = y + 8 + (Math.cos(i * 1.3) * 12);
    ctx.globalAlpha = 0.2 + (i % 3) * 0.1;
    ctx.fillRect(Math.floor(sx), Math.floor(sy), 1, 1);
  }
  ctx.globalAlpha = 1;

  ctx.restore();
  _drawEdges(ctx, x, y, p.highlight, p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 15));
}

/**
 * 5. Decorative mosaic pattern in center.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
export function drawFloor_stone_mosaic(ctx, x, y) {
  const p = FLOOR_PALETTES.stone_mosaic;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Border ring
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  _diamondPath(ctx, x, y);
  ctx.stroke();

  // Inner decorative circle pattern
  ctx.fillStyle = p.accent;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(x, y + TILE_HH, 10, 0, Math.PI * 2);
  ctx.fill();

  // Mosaic star pattern in centre
  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  for (let a = 0; a < 8; a++) {
    const angle = (a * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(x, y + TILE_HH);
    ctx.lineTo(x + Math.cos(angle) * 10, y + TILE_HH + Math.sin(angle) * 5);
    ctx.stroke();
  }

  // Corner decorative dots
  ctx.globalAlpha = 0.4;
  const corners = [
    [x - 20, y + 10], [x + 20, y + 10],
    [x - 20, y + 22], [x + 20, y + 22]
  ];
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalAlpha = 1;
  ctx.restore();
  _drawEdges(ctx, x, y, p.highlight, p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 15));
}

/**
 * 6. Deep red plush carpet with gold border.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
export function drawFloor_carpet_red(ctx, x, y) {
  const p = FLOOR_PALETTES.carpet_red;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Inner field
  ctx.strokeStyle = p.shadow;
  ctx.lineWidth = 4;
  _diamondPath(ctx, x, y);
  ctx.stroke();

  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2;
  _diamondPath(ctx, x, y);
  ctx.stroke();

  // Plush texture — small vertical dashes
  ctx.strokeStyle = p.highlight;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.2;
  for (let i = -3; i <= 3; i++) {
    for (let j = -1; j <= 3; j++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 7, y + 10 + j * 5);
      ctx.lineTo(x + i * 7 + 1, y + 14 + j * 5);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  ctx.restore();
  _drawEdges(ctx, x, y, p.highlight, p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 15));
}

/**
 * 7. Royal blue carpet with silver border.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
export function drawFloor_carpet_blue(ctx, x, y) {
  const p = FLOOR_PALETTES.carpet_blue;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Silver border
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 3;
  _diamondPath(ctx, x, y);
  ctx.stroke();

  // Inner detail line
  ctx.strokeStyle = p.highlight;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  _diamondPath(ctx, x, y);
  ctx.stroke();

  // Subtle diamond pattern inside
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.moveTo(x, y + 6);
  ctx.lineTo(x + 8, y + TILE_HH);
  ctx.lineTo(x, y + 26);
  ctx.lineTo(x - 8, y + TILE_HH);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
  _drawEdges(ctx, x, y, p.highlight, p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 15));
}

/**
 * 8. Forest green carpet with cream border.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
export function drawFloor_carpet_green(ctx, x, y) {
  const p = FLOOR_PALETTES.carpet_green;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Cream border
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 3;
  _diamondPath(ctx, x, y);
  ctx.stroke();

  // Inner trim
  ctx.strokeStyle = p.highlight;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  _diamondPath(ctx, x, y);
  ctx.stroke();

  // Leaf motif in centre
  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 8);
  ctx.quadraticCurveTo(x + 6, y + TILE_HH, x, y + 24);
  ctx.quadraticCurveTo(x - 6, y + TILE_HH, x, y + 8);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();
  _drawEdges(ctx, x, y, p.highlight, p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 15));
}

/**
 * 9. Bright green grass with tiny flower dots.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
export function drawFloor_grass(ctx, x, y) {
  const p = FLOOR_PALETTES.grass;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Grass blade highlights
  ctx.strokeStyle = p.highlight;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.25;
  const blades = [
    [x - 18, y + 12], [x - 10, y + 18], [x + 2, y + 10],
    [x + 12, y + 20], [x + 20, y + 14], [x - 8, y + 24],
    [x + 6, y + 26], [x + 18, y + 8]
  ];
  blades.forEach(([gx, gy]) => {
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 1, gy - 3);
    ctx.stroke();
  });

  // Tiny flowers
  ctx.globalAlpha = 0.6;
  const flowers = [
    { fx: x - 8, fy: y + 16, c: '#F0E040' },
    { fx: x + 12, fy: y + 18, c: '#F8A0C0' },
    { fx: x - 4, fy: y + 22, c: '#FFFFFF' },
    { fx: x + 16, fy: y + 12, c: '#E8B840' }
  ];
  flowers.forEach(f => {
    ctx.fillStyle = f.c;
    ctx.fillRect(f.fx, f.fy, 2, 2);
  });

  ctx.globalAlpha = 1;
  ctx.restore();
  _drawEdges(ctx, x, y, p.highlight, p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 10));
}

/**
 * 10. Warm golden sand with subtle ripple texture.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
export function drawFloor_sand(ctx, x, y) {
  const p = FLOOR_PALETTES.sand;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Ripple lines
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  for (let i = -2; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x - TILE_HW + 4, y + TILE_HH + i * 5);
    ctx.quadraticCurveTo(
      x, y + TILE_HH + i * 5 + 2,
      x + TILE_HW - 4, y + TILE_HH + i * 5
    );
    ctx.stroke();
  }

  // Tiny pebbles
  ctx.fillStyle = _darken(p.accent, 15);
  ctx.globalAlpha = 0.25;
  const pebbles = [
    [x - 14, y + 14], [x + 8, y + 10], [x - 4, y + 20],
    [x + 18, y + 16], [x - 20, y + 20], [x + 4, y + 26]
  ];
  pebbles.forEach(([px, py]) => {
    ctx.fillRect(px, py, 2, 1);
  });

  ctx.globalAlpha = 1;
  ctx.restore();
  _drawEdges(ctx, x, y, p.highlight, p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 12));
}

/**
 * 11. Blue water with animated shimmer highlights.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} [time=0] — animation timestamp in ms
 */
export function drawFloor_water(ctx, x, y, time = 0) {
  const p = FLOOR_PALETTES.water;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Depth gradient
  const grad = ctx.createLinearGradient(x, y, x, y + TILE_HH * 2);
  grad.addColorStop(0, p.highlight);
  grad.addColorStop(0.5, p.base);
  grad.addColorStop(1, p.shadow);
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.4;
  _diamondPath(ctx, x, y);
  ctx.fill();

  // Animated shimmer lines
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 1;
  const waveOffset = Math.sin((time + x * 50) / 400) * 3;
  ctx.globalAlpha = 0.35 + Math.sin(time / 300) * 0.15;
  for (let i = -1; i <= 2; i++) {
    const wy = y + TILE_HH + i * 6 + waveOffset;
    ctx.beginPath();
    ctx.moveTo(x - 20, wy);
    ctx.quadraticCurveTo(x, wy + 2, x + 20, wy);
    ctx.stroke();
  }

  // Sparkle dots
  ctx.fillStyle = '#FFFFFF';
  ctx.globalAlpha = 0.3 + Math.sin(time / 200) * 0.15;
  const sparkles = [
    [x - 10 + waveOffset, y + 14],
    [x + 14, y + 10 - waveOffset],
    [x + 4, y + 22 + waveOffset]
  ];
  sparkles.forEach(([sx, sy]) => {
    ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 1);
  });

  ctx.globalAlpha = 1;
  ctx.restore();
  _drawEdges(ctx, x, y, p.highlight, p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 12));
}

/**
 * 12. White snow with soft blue shadows.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
export function drawFloor_snow(ctx, x, y) {
  const p = FLOOR_PALETTES.snow;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Soft blue shadow patches
  ctx.fillStyle = p.shadow;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.ellipse(x - 8, y + 18, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 12, y + 14, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Snow sparkles
  ctx.fillStyle = '#FFFFFF';
  ctx.globalAlpha = 0.5;
  const sparkles = [
    [x - 14, y + 12], [x - 6, y + 18], [x + 4, y + 10],
    [x + 12, y + 20], [x + 18, y + 14], [x - 20, y + 20],
    [x + 8, y + 26], [x - 2, y + 22]
  ];
  sparkles.forEach(([sx, sy]) => {
    ctx.fillRect(sx, sy, 1, 1);
  });

  // Drift lines
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.moveTo(x - 20, y + 14);
  ctx.quadraticCurveTo(x - 8, y + 18, x + 4, y + 14);
  ctx.quadraticCurveTo(x + 16, y + 10, x + 24, y + 16);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();
  _drawEdges(ctx, x, y, '#FFFFFF', p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 20));
}

/**
 * 13. Elegant white marble with gray veins.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
export function drawFloor_marble_white(ctx, x, y) {
  const p = FLOOR_PALETTES.marble_white;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Marble veins
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;

  ctx.beginPath();
  ctx.moveTo(x - 20, y + 10);
  ctx.bezierCurveTo(x - 10, y + 8, x - 4, y + 20, x + 6, y + 16);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 4, y + 6);
  ctx.bezierCurveTo(x + 14, y + 12, x + 8, y + 24, x + 20, y + 20);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - 8, y + 22);
  ctx.quadraticCurveTo(x + 2, y + 26, x + 12, y + 24);
  ctx.stroke();

  // Subtle tile seams
  ctx.strokeStyle = p.shadow;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.moveTo(x - TILE_HW, y + TILE_HH);
  ctx.lineTo(x + TILE_HW, y + TILE_HH);
  ctx.stroke();

  // Specular highlight dot
  ctx.fillStyle = '#FFFFFF';
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(x + 4, y + 18, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
  _drawEdges(ctx, x, y, '#FFFFFF', p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 10));
}

/**
 * 14. Warm terracotta hex pattern.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
export function drawFloor_tile_terracotta(ctx, x, y) {
  const p = FLOOR_PALETTES.tile_terracotta;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Hexagonal pattern lines
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;

  const hexSize = 8;
  for (let row = -2; row <= 3; row++) {
    const hy = y + 8 + row * 7;
    for (let col = -2; col <= 2; col++) {
      const hx = x + col * 14 + (row % 2) * 7;
      ctx.beginPath();
      for (let s = 0; s < 6; s++) {
        const angle = (s * Math.PI) / 3 - Math.PI / 6;
        const px = hx + Math.cos(angle) * hexSize;
        const py = hy + Math.sin(angle) * hexSize * 0.5;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
  _drawEdges(ctx, x, y, p.highlight, p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 15));
}

/**
 * 15. Brown earth with small pebbles.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 */
export function drawFloor_dirt(ctx, x, y) {
  const p = FLOOR_PALETTES.dirt;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Subtle clod texture
  ctx.strokeStyle = p.highlight;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 20 + i * 8, y + 10 + (i % 3) * 4);
    ctx.quadraticCurveTo(
      x - 16 + i * 8, y + 16 + (i % 3) * 4,
      x - 12 + i * 8, y + 12 + (i % 3) * 4
    );
    ctx.stroke();
  }

  // Pebbles
  const pebbleColors = [p.accent, _darken(p.accent, 10), p.highlight];
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = pebbleColors[i % 3];
    ctx.globalAlpha = 0.25 + (i % 2) * 0.1;
    const px = x + (Math.sin(i * 3.1) * 22);
    const py = y + 10 + (Math.cos(i * 2.7) * 10);
    ctx.fillRect(Math.floor(px), Math.floor(py), 2 + (i % 2), 1 + (i % 2));
  }

  ctx.globalAlpha = 1;
  ctx.restore();
  _drawEdges(ctx, x, y, p.highlight, p.shadow);
  _strokeDiamond(ctx, x, y, _darken(p.shadow, 15));
}

/**
 * 16. Cyberpunk glowing grid lines on dark floor.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} [time=0]
 */
export function drawFloor_neon_grid(ctx, x, y, time = 0) {
  const p = FLOOR_PALETTES.neon_grid;
  _fillDiamond(ctx, x, y, p.base);
  _clipDiamond(ctx, x, y);

  // Grid lines
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5 + Math.sin(time / 250) * 0.15;

  // Horizontal grid lines
  for (let i = -2; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x - TILE_HW, y + TILE_HH + i * 6);
    ctx.lineTo(x + TILE_HW, y + TILE_HH + i * 6);
    ctx.stroke();
  }
  // Vertical-ish grid lines (diagonal for isometric)
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 12, y);
    ctx.lineTo(x + i * 12, y + TILE_HH * 2);
    ctx.stroke();
  }

  // Glow intersection points
  ctx.fillStyle = p.accent;
  ctx.globalAlpha = 0.6 + Math.sin(time / 300) * 0.2;
  for (let i = -2; i <= 2; i++) {
    for (let j = -1; j <= 3; j++) {
      const gx = x + i * 12;
      const gy = y + TILE_HH + j * 6;
      if ((i + j) % 2 === 0) {
        ctx.fillRect(gx - 1, gy - 1, 2, 2);
      }
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
  _drawEdges(ctx, x, y, p.highlight, p.shadow);
  _strokeDiamond(ctx, x, y, p.accent);
}

// ============================================================
// Wall Draw Helpers
// ============================================================

/**
 * Draw the three visible faces of an isometric wall.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x — floor diamond top-corner X
 * @param {number} y — floor diamond top-corner Y
 * @param {number} height — wall height in pixels
 * @param {{top:string,left:string,right:string,highlight:string,shadow:string}} palette
 */
function _drawWallFaces(ctx, x, y, height, palette) {
  // Top face (diamond, lighter)
  ctx.fillStyle = palette.top;
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH - height);
  ctx.lineTo(x, y + TILE_HH * 2 - height);
  ctx.lineTo(x - TILE_HW, y + TILE_HH - height);
  ctx.closePath();
  ctx.fill();

  // Left face (rectangle, mid tone)
  ctx.fillStyle = palette.left;
  ctx.beginPath();
  ctx.moveTo(x - TILE_HW, y + TILE_HH - height);
  ctx.lineTo(x, y - height);
  ctx.lineTo(x, y);
  ctx.lineTo(x - TILE_HW, y + TILE_HH);
  ctx.closePath();
  ctx.fill();

  // Right face (rectangle, darker)
  ctx.fillStyle = palette.right;
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw wall edge highlights and shadows.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} height
 * @param {{highlight:string,shadow:string}} palette
 */
function _drawWallEdges(ctx, x, y, height, palette) {
  // Top-left edge highlight
  ctx.strokeStyle = palette.highlight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - TILE_HW, y + TILE_HH - height);
  ctx.lineTo(x, y - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH - height);
  ctx.stroke();

  // Left face outer edge highlight
  ctx.beginPath();
  ctx.moveTo(x - TILE_HW, y + TILE_HH - height);
  ctx.lineTo(x - TILE_HW, y + TILE_HH);
  ctx.stroke();

  // Bottom shadow under left face
  ctx.strokeStyle = palette.shadow;
  ctx.beginPath();
  ctx.moveTo(x - TILE_HW, y + TILE_HH);
  ctx.lineTo(x, y);
  ctx.stroke();

  // Right face outer edge shadow
  ctx.beginPath();
  ctx.moveTo(x + TILE_HW, y + TILE_HH - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH);
  ctx.stroke();

  // Bottom shadow under right face
  ctx.beginPath();
  ctx.moveTo(x + TILE_HW, y + TILE_HH);
  ctx.lineTo(x, y);
  ctx.stroke();

  // Top face front point highlight
  ctx.strokeStyle = palette.highlight;
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x, y - height + 1);
  ctx.stroke();
}

// ============================================================
// Wall Type Draw Functions
// ============================================================

/**
 * 1. Red brick wall with mortar lines.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x — floor position top-corner X
 * @param {number} y — floor position top-corner Y
 * @param {number} height — wall height in pixels
 */
export function drawWall_wall_brick(ctx, x, y, height) {
  const p = WALL_PALETTES.wall_brick;
  _drawWallFaces(ctx, x, y, height, p);

  // Mortar lines on left face
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = _lighten(p.left, 12);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  const brickH = 6;
  for (let row = 0; row < Math.ceil((height + TILE_HH) / brickH); row++) {
    const ly = y + TILE_HH - row * brickH;
    ctx.beginPath();
    ctx.moveTo(x - TILE_HW, ly);
    ctx.lineTo(x, ly - TILE_HH);
    ctx.stroke();
  }
  // Vertical mortar on left
  for (let col = 0; col < 3; col++) {
    const lx = x - (col * TILE_HW / 2);
    const offset = col % 2 === 0 ? 0 : 3;
    ctx.beginPath();
    ctx.moveTo(lx, y - offset);
    ctx.lineTo(lx - TILE_HH, y + TILE_HH - offset);
    ctx.stroke();
  }
  ctx.restore();

  // Mortar lines on right face
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.clip();
  for (let row = 0; row < Math.ceil((height + TILE_HH) / brickH); row++) {
    const ry = y + TILE_HH - row * brickH;
    ctx.beginPath();
    ctx.moveTo(x, ry - TILE_HH);
    ctx.lineTo(x + TILE_HW, ry);
    ctx.stroke();
  }
  for (let col = 0; col < 3; col++) {
    const rx = x + (col * TILE_HW / 2);
    const offset = col % 2 === 0 ? 0 : 3;
    ctx.beginPath();
    ctx.moveTo(rx, y - offset);
    ctx.lineTo(rx + TILE_HH, y + TILE_HH - offset);
    ctx.stroke();
  }
  ctx.restore();

  _drawWallEdges(ctx, x, y, height, p);
}

/**
 * 2. Gray stone blocks.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} height
 */
export function drawWall_wall_stone(ctx, x, y, height) {
  const p = WALL_PALETTES.wall_stone;
  _drawWallFaces(ctx, x, y, height, p);

  // Stone block seams — left face
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = _darken(p.left, 15);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  const blockH = 12;
  const rows = Math.ceil((height + TILE_HH) / blockH);
  for (let row = 0; row < rows; row++) {
    const ly = y + TILE_HH - row * blockH;
    ctx.beginPath();
    ctx.moveTo(x - TILE_HW, ly);
    ctx.lineTo(x, ly - TILE_HH);
    ctx.stroke();
  }
  // Vertical seams
  for (let col = 0; col < 2; col++) {
    const lx = x - (col * 20) - 6;
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx - TILE_HH, y + TILE_HH);
    ctx.stroke();
  }
  ctx.restore();

  // Stone block seams — right face
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.clip();
  for (let row = 0; row < rows; row++) {
    const ry = y + TILE_HH - row * blockH;
    ctx.beginPath();
    ctx.moveTo(x, ry - TILE_HH);
    ctx.lineTo(x + TILE_HW, ry);
    ctx.stroke();
  }
  for (let col = 0; col < 2; col++) {
    const rx = x + (col * 20) + 6;
    ctx.beginPath();
    ctx.moveTo(rx, y);
    ctx.lineTo(rx + TILE_HH, y + TILE_HH);
    ctx.stroke();
  }
  ctx.restore();

  // Small cracks
  ctx.strokeStyle = _darken(p.right, 20);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.moveTo(x + 8, y - height + 10);
  ctx.lineTo(x + 12, y - height + 14);
  ctx.lineTo(x + 10, y - height + 18);
  ctx.stroke();
  ctx.globalAlpha = 1;

  _drawWallEdges(ctx, x, y, height, p);
}

/**
 * 3. Vertical wooden planks.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} height
 */
export function drawWall_wall_wood(ctx, x, y, height) {
  const p = WALL_PALETTES.wall_wood;
  _drawWallFaces(ctx, x, y, height, p);

  // Vertical plank lines — left face
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = _darken(p.left, 15);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  for (let col = 0; col < 4; col++) {
    const lx = x - 4 - col * 8;
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx - TILE_HH, y + TILE_HH);
    ctx.stroke();
  }
  // Horizontal plank knots
  ctx.fillStyle = _darken(p.left, 25);
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(x - 14, y - height / 2, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - 24, y - height / 3, 2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Vertical plank lines — right face
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.clip();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = _darken(p.right, 15);
  for (let col = 0; col < 4; col++) {
    const rx = x + 4 + col * 8;
    ctx.beginPath();
    ctx.moveTo(rx, y);
    ctx.lineTo(rx + TILE_HH, y + TILE_HH);
    ctx.stroke();
  }
  ctx.fillStyle = _darken(p.right, 25);
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(x + 16, y - height / 2 + 4, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  _drawWallEdges(ctx, x, y, height, p);
}

/**
 * 4. Smooth cream plaster.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} height
 */
export function drawWall_wall_plaster(ctx, x, y, height) {
  const p = WALL_PALETTES.wall_plaster;
  _drawWallFaces(ctx, x, y, height, p);

  // Subtle texture
  ctx.fillStyle = _darken(p.left, 8);
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 8; i++) {
    const tx = x - 8 + (Math.sin(i * 2.3) * 16);
    const ty = y - height / 2 + (Math.cos(i * 1.9) * height / 2);
    ctx.fillRect(Math.floor(tx), Math.floor(ty), 2, 1);
  }
  ctx.globalAlpha = 1;

  // Baseboard on left face
  ctx.fillStyle = _darken(p.left, 15);
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(x - TILE_HW, y + TILE_HH - 4);
  ctx.lineTo(x, y - 4);
  ctx.lineTo(x, y);
  ctx.lineTo(x - TILE_HW, y + TILE_HH);
  ctx.closePath();
  ctx.fill();

  // Baseboard on right face
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x + TILE_HW, y + TILE_HH - 4);
  ctx.lineTo(x + TILE_HW, y + TILE_HH);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
  _drawWallEdges(ctx, x, y, height, p);
}

/**
 * 5. Bamboo segment pattern.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} height
 */
export function drawWall_wall_bamboo(ctx, x, y, height) {
  const p = WALL_PALETTES.wall_bamboo;
  _drawWallFaces(ctx, x, y, height, p);

  // Bamboo segments — left face
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = _darken(p.left, 15);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  const segH = 10;
  for (let row = 0; row < Math.ceil((height + TILE_HH) / segH); row++) {
    const ly = y + TILE_HH - row * segH;
    ctx.beginPath();
    ctx.moveTo(x - TILE_HW, ly);
    ctx.lineTo(x, ly - TILE_HH);
    ctx.stroke();
  }
  // Bamboo vertical stalks
  for (let col = 0; col < 3; col++) {
    const lx = x - 6 - col * 12;
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx - TILE_HH, y + TILE_HH);
    ctx.stroke();
  }
  ctx.restore();

  // Bamboo segments — right face
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.clip();
  for (let row = 0; row < Math.ceil((height + TILE_HH) / segH); row++) {
    const ry = y + TILE_HH - row * segH;
    ctx.beginPath();
    ctx.moveTo(x, ry - TILE_HH);
    ctx.lineTo(x + TILE_HW, ry);
    ctx.stroke();
  }
  for (let col = 0; col < 3; col++) {
    const rx = x + 6 + col * 12;
    ctx.beginPath();
    ctx.moveTo(rx, y);
    ctx.lineTo(rx + TILE_HH, y + TILE_HH);
    ctx.stroke();
  }
  ctx.restore();

  // Node joints
  ctx.fillStyle = _darken(p.left, 20);
  ctx.globalAlpha = 0.3;
  for (let row = 0; row < 3; row++) {
    const jy = y + TILE_HH - row * segH;
    ctx.fillRect(x - 8, jy - 8, 4, 2);
    ctx.fillRect(x + 14, jy - 14, 4, 2);
  }
  ctx.globalAlpha = 1;

  _drawWallEdges(ctx, x, y, height, p);
}

/**
 * 6. Translucent ice blue with frost patterns.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} height
 */
export function drawWall_wall_ice(ctx, x, y, height) {
  const p = WALL_PALETTES.wall_ice;
  _drawWallFaces(ctx, x, y, height, p);

  // Frost crystal lines — left face
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = _lighten(p.left, 20);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;

  ctx.beginPath();
  ctx.moveTo(x - 12, y - height + 4);
  ctx.lineTo(x - 18, y - height + 14);
  ctx.lineTo(x - 10, y - height + 22);
  ctx.lineTo(x - 16, y - height + 32);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - 22, y - height + 8);
  ctx.lineTo(x - 6, y - height + 16);
  ctx.lineTo(x - 14, y - height + 28);
  ctx.stroke();

  // Ice refraction highlight
  ctx.fillStyle = '#FFFFFF';
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.moveTo(x - TILE_HW + 4, y + TILE_HH - height + 4);
  ctx.lineTo(x - 8, y - height + 4);
  ctx.lineTo(x - 8, y - height + 16);
  ctx.lineTo(x - TILE_HW + 4, y + TILE_HH - height + 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Frost crystal lines — right face
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.clip();

  ctx.strokeStyle = _lighten(p.right, 20);
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(x + 10, y - height + 6);
  ctx.lineTo(x + 18, y - height + 16);
  ctx.lineTo(x + 8, y - height + 24);
  ctx.lineTo(x + 16, y - height + 34);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.moveTo(x + 8, y - height + 4);
  ctx.lineTo(x + TILE_HW - 4, y + TILE_HH - height + 4);
  ctx.lineTo(x + TILE_HW - 4, y + TILE_HH - height + 16);
  ctx.lineTo(x + 8, y - height + 16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.globalAlpha = 1;
  _drawWallEdges(ctx, x, y, height, p);
}

/**
 * 7. Stone with green moss patches.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} height
 */
export function drawWall_wall_mossy(ctx, x, y, height) {
  const p = WALL_PALETTES.wall_mossy;
  _drawWallFaces(ctx, x, y, height, p);

  // Moss patches — left face
  ctx.save();
  ctx.clip();
  const mossColor = '#508030';
  ctx.fillStyle = mossColor;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 4);
  ctx.quadraticCurveTo(x - 16, y - 12, x - 20, y - 4);
  ctx.quadraticCurveTo(x - 18, y + 4, x - 8, y - 4);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - 18, y - height + 14);
  ctx.quadraticCurveTo(x - 10, y - height + 8, x - 6, y - height + 16);
  ctx.quadraticCurveTo(x - 14, y - height + 22, x - 18, y - height + 14);
  ctx.fill();

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#689848';
  ctx.beginPath();
  ctx.moveTo(x - 22, y + TILE_HH - 8);
  ctx.quadraticCurveTo(x - 14, y + TILE_HH - 16, x - 10, y + TILE_HH - 6);
  ctx.quadraticCurveTo(x - 18, y + TILE_HH - 2, x - 22, y + TILE_HH - 8);
  ctx.fill();
  ctx.restore();

  // Moss patches — right face
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = mossColor;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(x + 12, y - 6);
  ctx.quadraticCurveTo(x + 20, y - 14, x + 24, y - 6);
  ctx.quadraticCurveTo(x + 22, y + 2, x + 12, y - 6);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 8, y - height + 18);
  ctx.quadraticCurveTo(x + 18, y - height + 10, x + 22, y - height + 20);
  ctx.quadraticCurveTo(x + 12, y - height + 26, x + 8, y - height + 18);
  ctx.fill();
  ctx.restore();

  // Stone seams
  ctx.strokeStyle = _darken(p.left, 20);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.moveTo(x - TILE_HW, y + TILE_HH - 10);
  ctx.lineTo(x, y - 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x + TILE_HW, y + TILE_HH - 10);
  ctx.stroke();
  ctx.globalAlpha = 1;

  _drawWallEdges(ctx, x, y, height, p);
}

/**
 * 8. Dark base with glowing neon trim.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} height
 * @param {number} [time=0]
 */
export function drawWall_wall_neon(ctx, x, y, height, time = 0) {
  const p = WALL_PALETTES.wall_neon;
  _drawWallFaces(ctx, x, y, height, p);

  // Glowing trim — horizontal neon strips
  const glowAlpha = 0.5 + Math.sin(time / 300) * 0.2;

  ctx.save();
  ctx.clip();

  // Left face neon strip
  ctx.fillStyle = '#00F8C8';
  ctx.globalAlpha = glowAlpha;
  ctx.beginPath();
  ctx.moveTo(x - TILE_HW, y + TILE_HH - height / 2);
  ctx.lineTo(x, y - height / 2);
  ctx.lineTo(x, y - height / 2 + 2);
  ctx.lineTo(x - TILE_HW, y + TILE_HH - height / 2 + 2);
  ctx.closePath();
  ctx.fill();

  // Left face vertical neon strip
  ctx.fillStyle = '#F800C8';
  ctx.globalAlpha = glowAlpha * 0.7;
  ctx.fillRect(x - 10, y - height + 6, 2, height - 8);
  ctx.restore();

  // Right face neon strip
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH - height);
  ctx.lineTo(x + TILE_HW, y + TILE_HH);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = '#00F8C8';
  ctx.globalAlpha = glowAlpha;
  ctx.beginPath();
  ctx.moveTo(x, y - height / 2);
  ctx.lineTo(x + TILE_HW, y + TILE_HH - height / 2);
  ctx.lineTo(x + TILE_HW, y + TILE_HH - height / 2 + 2);
  ctx.lineTo(x, y - height / 2 + 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#F800C8';
  ctx.globalAlpha = glowAlpha * 0.7;
  ctx.fillRect(x + 10, y - height + 6, 2, height - 8);
  ctx.restore();

  // Corner glow
  ctx.fillStyle = '#00F8C8';
  ctx.globalAlpha = glowAlpha * 0.4;
  ctx.beginPath();
  ctx.arc(x, y - height, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  _drawWallEdges(ctx, x, y, height, p);
}

// ============================================================
// Lookup Dispatchers
// ============================================================

/** Floor draw function lookup map @type {Object<string,Function>} */
const FLOOR_DRAWERS = {
  wood_light: drawFloor_wood_light,
  wood_dark: drawFloor_wood_dark,
  wood_checker: drawFloor_wood_checker,
  stone_gray: drawFloor_stone_gray,
  stone_mosaic: drawFloor_stone_mosaic,
  carpet_red: drawFloor_carpet_red,
  carpet_blue: drawFloor_carpet_blue,
  carpet_green: drawFloor_carpet_green,
  grass: drawFloor_grass,
  sand: drawFloor_sand,
  water: drawFloor_water,
  snow: drawFloor_snow,
  marble_white: drawFloor_marble_white,
  tile_terracotta: drawFloor_tile_terracotta,
  dirt: drawFloor_dirt,
  neon_grid: drawFloor_neon_grid
};

/** Wall draw function lookup map @type {Object<string,Function>} */
const WALL_DRAWERS = {
  wall_brick: drawWall_wall_brick,
  wall_stone: drawWall_wall_stone,
  wall_wood: drawWall_wall_wood,
  wall_plaster: drawWall_wall_plaster,
  wall_bamboo: drawWall_wall_bamboo,
  wall_ice: drawWall_wall_ice,
  wall_mossy: drawWall_wall_mossy,
  wall_neon: drawWall_wall_neon
};

/**
 * Generic floor tile dispatcher.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} type — floor tile type ID
 * @param {number} x — top corner X
 * @param {number} y — top corner Y
 * @param {number} [time=0] — animation time for animated tiles
 */
export function drawFloor(ctx, type, x, y, time = 0) {
  const fn = FLOOR_DRAWERS[type];
  if (fn) {
    if (type === 'water' || type === 'neon_grid') {
      fn(ctx, x, y, time);
    } else {
      fn(ctx, x, y);
    }
  } else {
    drawFloor_stone_gray(ctx, x, y);
  }
}

/**
 * Generic wall dispatcher.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} type — wall type ID
 * @param {number} x — floor position top corner X
 * @param {number} y — floor position top corner Y
 * @param {number} height — wall height in pixels
 * @param {number} [time=0] — animation time for animated walls
 */
export function drawWall(ctx, type, x, y, height, time = 0) {
  const fn = WALL_DRAWERS[type];
  if (fn) {
    if (type === 'wall_neon') {
      fn(ctx, x, y, height, time);
    } else {
      fn(ctx, x, y, height);
    }
  } else {
    drawWall_wall_stone(ctx, x, y, height);
  }
}

// ============================================================
// Tileset Class (convenience wrapper)
// ============================================================

/**
 * IsoTileset manages all procedural tile rendering for the isometric world.
 * Provides batched palette access and type enumerations.
 */
export class IsoTileset {
  constructor() {
    /** @type {string[]} */
    this.floorTypes = [...FLOOR_TYPES];
    /** @type {string[]} */
    this.wallTypes = [...WALL_TYPES];
  }

  /**
   * Draw a floor tile.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} type
   * @param {number} x
   * @param {number} y
   * @param {number} [time]
   */
  drawFloor(ctx, type, x, y, time) {
    drawFloor(ctx, type, x, y, time);
  }

  /**
   * Draw a wall.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} type
   * @param {number} x
   * @param {number} y
   * @param {number} height
   * @param {number} [time]
   */
  drawWall(ctx, type, x, y, height, time) {
    drawWall(ctx, type, x, y, height, time);
  }

  /**
   * Get a floor palette.
   *
   * @param {string} type
   * @returns {{base:string,highlight:string,shadow:string,accent:string}}
   */
  getFloorPalette(type) {
    return getFloorPalette(type);
  }

  /**
   * Get a wall palette.
   *
   * @param {string} type
   * @returns {{top:string,left:string,right:string,highlight:string,shadow:string}}
   */
  getWallPalette(type) {
    return getWallPalette(type);
  }
}

// ============================================================
// Named Exports Summary
// ============================================================

export { FLOOR_TYPES, WALL_TYPES };
export default IsoTileset;
