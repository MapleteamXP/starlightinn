/**
 * IsoFurniture.js — Starlight Inn v5.0
 * Modular isometric furniture and prop catalog.
 * 40+ furniture items drawn procedurally in chunky pixel-art style
 * (Habbo Hotel inspired — cute, cozy, snap-to-grid).
 *
 * Each furniture definition includes placement metadata, a draw function,
 * a shadow function, interaction data, and its colour palette.
 *
 * @module IsoFurniture
 * @version 5.0.0
 * @author Starlight Inn Team
 */

// ============================================================
// Isometric Grid Constants
// ============================================================

/** Half tile width (px) @type {number} */
const TILE_HW = 32;
/** Half tile height (px) @type {number} */
const TILE_HH = 16;

// ============================================================
// Drawing Utilities
// ============================================================

/**
 * Lighten a hex colour by a percentage.
 * @param {string} hex
 * @param {number} pct
 * @returns {string}
 */
function _L(hex, pct) {
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
 * @param {string} hex
 * @param {number} pct
 * @returns {string}
 */
function _D(hex, pct) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.floor(r * (1 - pct / 100)));
  g = Math.max(0, Math.floor(g * (1 - pct / 100)));
  b = Math.max(0, Math.floor(b * (1 - pct / 100)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Draw a standard drop-shadow ellipse beneath furniture.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} sx — screen X (centre)
 * @param {number} sy — screen Y (base)
 * @param {number} rw — shadow radius width
 * @param {number} rh — shadow radius height
 */
function _shadow(ctx, sx, sy, rw, rh) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(sx, sy, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a thick stroked rounded rectangle (pixel-art style).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.lineTo(x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.lineTo(x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.lineTo(x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.closePath();
}

// ============================================================
// Furniture Catalog
// ============================================================

/** @type {FurnitureDef[]} */
const FURNITURE_CATALOG = [];

/**
 * Register a furniture definition in the catalog.
 * @param {FurnitureDef} def
 */
function _register(def) {
  FURNITURE_CATALOG.push(def);
}

// ============================================================
// LIVING ROOM
// ============================================================

_register({
  id: 'sofa',
  name: 'Comfortable Sofa',
  category: 'living',
  width: 2, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#8B5E3C', highlight: '#A87850', shadow: '#5C3A24', accent: '#D4A878' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 56, h = 20, d = 16;
    // Backrest
    ctx.fillStyle = c.base;
    _roundRect(ctx, sx - w / 2, sy - h - 8, w, 12, 3);
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 20);
    ctx.lineWidth = 1;
    ctx.stroke();
    // Seat cushion
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 + 4, sy - 8);
    ctx.lineTo(sx + w / 2 - 4, sy - 8);
    ctx.lineTo(sx + w / 2, sy);
    ctx.lineTo(sx - w / 2, sy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Left arm
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2 - 4, sy - h, 8, h + 4);
    ctx.strokeRect(sx - w / 2 - 4, sy - h, 8, h + 4);
    // Right arm
    ctx.fillStyle = c.base;
    ctx.fillRect(sx + w / 2 - 4, sy - h, 8, h + 4);
    ctx.strokeRect(sx + w / 2 - 4, sy - h, 8, h + 4);
    // Cushion buttons
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(sx - 12, sy - 14, 2, 2);
    ctx.fillRect(sx + 2, sy - 14, 2, 2);
    ctx.globalAlpha = 1;
    // Legs
    ctx.fillStyle = _D(c.shadow, 30);
    ctx.fillRect(sx - w / 2, sy - 2, 3, 4);
    ctx.fillRect(sx + w / 2 - 3, sy - 2, 3, 4);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 32, 8); },
  interact: { type: 'sit', offset: { x: 0, y: -16 } }
});

_register({
  id: 'armchair',
  name: 'Cozy Armchair',
  category: 'living',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#6B4226', highlight: '#8B6040', shadow: '#4A2C18', accent: '#D4A878' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 28, h = 22;
    // Backrest
    ctx.fillStyle = c.base;
    _roundRect(ctx, sx - w / 2, sy - h - 6, w, 12, 3);
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 20); ctx.lineWidth = 1; ctx.stroke();
    // Seat
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 + 2, sy - 6);
    ctx.lineTo(sx + w / 2 - 2, sy - 6);
    ctx.lineTo(sx + w / 2 - 4, sy + 2);
    ctx.lineTo(sx - w / 2 + 4, sy + 2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Arms
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2 - 3, sy - h + 4, 6, h);
    ctx.strokeRect(sx - w / 2 - 3, sy - h + 4, 6, h);
    ctx.fillRect(sx + w / 2 - 3, sy - h + 4, 6, h);
    ctx.strokeRect(sx + w / 2 - 3, sy - h + 4, 6, h);
    // Button
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 2, sy - 12, 3, 3);
    // Legs
    ctx.fillStyle = _D(c.shadow, 30);
    ctx.fillRect(sx - w / 2 + 2, sy, 3, 3);
    ctx.fillRect(sx + w / 2 - 5, sy, 3, 3);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 18, 6); },
  interact: { type: 'sit', offset: { x: 0, y: -14 } }
});

_register({
  id: 'coffee_table',
  name: 'Coffee Table',
  category: 'living',
  width: 2, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#5C3A1E', highlight: '#7A5028', shadow: '#3A2010', accent: '#A07848' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 40, d = 20;
    // Table top (isometric rectangle)
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy - d / 2);
    ctx.lineTo(sx, sy - d);
    ctx.lineTo(sx + w / 2, sy - d / 2);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 20); ctx.lineWidth = 1; ctx.stroke();
    // Edge
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy - d / 2);
    ctx.lineTo(sx - w / 2 + 2, sy - d / 2 + 2);
    ctx.lineTo(sx + 2, sy + 2);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();
    // Legs
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - w / 2 + 2, sy - 2, 3, 6);
    ctx.fillRect(sx + w / 2 - 5, sy - 2, 3, 6);
    ctx.fillRect(sx - 4, sy - 4, 3, 5);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 24, 6); },
  interact: { type: 'use', offset: { x: 0, y: -8 } }
});

_register({
  id: 'bookshelf',
  name: 'Bookshelf',
  category: 'living',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#7A5030', highlight: '#A07850', shadow: '#503018', accent: '#D0A880' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 28, h = 44, d = 12;
    // Back panel
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    // Side panel
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.moveTo(sx + w / 2, sy - h);
    ctx.lineTo(sx + w / 2 + d / 2, sy - h - d / 2);
    ctx.lineTo(sx + w / 2 + d / 2, sy - d / 2);
    ctx.lineTo(sx + w / 2, sy);
    ctx.closePath();
    ctx.fill();
    // Front panel
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Shelves
    ctx.strokeStyle = c.base;
    for (let i = 1; i <= 3; i++) {
      const sy2 = sy - h + i * (h / 4);
      ctx.beginPath();
      ctx.moveTo(sx - w / 2, sy2);
      ctx.lineTo(sx + w / 2, sy2);
      ctx.stroke();
    }
    // Books
    const bookColors = ['#B84040', '#4068A0', '#388838', '#D8A840', '#884080', '#D06040'];
    for (let row = 0; row < 3; row++) {
      let bx = sx - w / 2 + 3;
      const sy3 = sy - h + row * (h / 4) + (h / 4);
      for (let b = 0; b < 5 && bx < sx + w / 2 - 4; b++) {
        const bw = 3 + (b % 3);
        ctx.fillStyle = bookColors[(row * 5 + b) % bookColors.length];
        ctx.fillRect(bx, sy3 - 8, bw, 8);
        ctx.strokeStyle = _D(bookColors[(row * 5 + b) % bookColors.length], 15);
        ctx.strokeRect(bx, sy3 - 8, bw, 8);
        bx += bw + 1;
      }
    }
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx + 4, sy + 2, 18, 6); },
  interact: { type: 'browse', offset: { x: 0, y: -24 } }
});

_register({
  id: 'tv_stand',
  name: 'TV Stand',
  category: 'living',
  width: 2, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#3A3A3A', highlight: '#585858', shadow: '#202020', accent: '#888888' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 44, h = 18, d = 14;
    // Main body
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Front highlight
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - w / 2 + 2, sy - h + 2, w - 4, h / 2 - 1);
    // Side
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.moveTo(sx + w / 2, sy - h);
    ctx.lineTo(sx + w / 2 + d / 2, sy - h - d / 2);
    ctx.lineTo(sx + w / 2 + d / 2, sy - d / 2);
    ctx.lineTo(sx + w / 2, sy);
    ctx.closePath();
    ctx.fill();
    // Screen
    ctx.fillStyle = '#1A1A28';
    ctx.fillRect(sx - w / 2 + 6, sy - h + 4, w - 12, h - 10);
    // Screen glow
    ctx.fillStyle = '#4068A0';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(sx - w / 2 + 8, sy - h + 6, w - 16, 4);
    ctx.globalAlpha = 1;
    // Drawer handle
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 3, sy - 6, 6, 2);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx + 4, sy + 2, 26, 7); },
  interact: { type: 'use', offset: { x: 0, y: -14 } }
});

_register({
  id: 'rug_round',
  name: 'Round Rug',
  category: 'living',
  width: 2, height: 2, zHeight: 0,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#8B2020', highlight: '#B84040', shadow: '#501010', accent: '#D4A830' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Flat on floor — isometric circle
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 4, 28, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.stroke();
    // Inner ring
    ctx.strokeStyle = c.accent;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 4, 20, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Centre pattern
    ctx.fillStyle = c.highlight;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 4, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { /* Rugs cast no shadow */ },
  interact: { type: 'stand', offset: { x: 0, y: -4 } }
});

_register({
  id: 'rug_rect',
  name: 'Rectangular Rug',
  category: 'living',
  width: 2, height: 2, zHeight: 0,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#204880', highlight: '#3068A0', shadow: '#103058', accent: '#D0D0D0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 52, d = 24;
    // Isometric rectangle
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy - d / 2);
    ctx.lineTo(sx, sy - d);
    ctx.lineTo(sx + w / 2, sy - d / 2);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1; ctx.stroke();
    // Border
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 + 4, sy - d / 2);
    ctx.lineTo(sx, sy - d + 4);
    ctx.lineTo(sx + w / 2 - 4, sy - d / 2);
    ctx.lineTo(sx, sy - 4);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { /* No shadow */ },
  interact: { type: 'stand', offset: { x: 0, y: -4 } }
});

_register({
  id: 'lamp_floor',
  name: 'Floor Lamp',
  category: 'living',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#A08840', highlight: '#C8A858', shadow: '#685828', accent: '#FFF8D0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Base
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pole
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - 2, sy - 42, 4, 40);
    // Shade
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.moveTo(sx - 10, sy - 36);
    ctx.lineTo(sx + 10, sy - 36);
    ctx.lineTo(sx + 7, sy - 48);
    ctx.lineTo(sx - 7, sy - 48);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1; ctx.stroke();
    // Light glow
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(sx - 7, sy - 37);
    ctx.lineTo(sx + 7, sy - 37);
    ctx.lineTo(sx + 5, sy - 46);
    ctx.lineTo(sx - 5, sy - 46);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 12, 4); },
  interact: { type: 'toggle', offset: { x: 0, y: -28 } }
});

_register({
  id: 'lamp_table',
  name: 'Table Lamp',
  category: 'living',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#C8A860', highlight: '#E8D090', shadow: '#887040', accent: '#FFF8E0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Base
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 1, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pole
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - 1, sy - 20, 2, 19);
    // Shade
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.moveTo(sx - 8, sy - 16);
    ctx.lineTo(sx + 8, sy - 16);
    ctx.lineTo(sx + 6, sy - 26);
    ctx.lineTo(sx - 6, sy - 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1; ctx.stroke();
    // Glow
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(sx - 5, sy - 17);
    ctx.lineTo(sx + 5, sy - 17);
    ctx.lineTo(sx + 4, sy - 24);
    ctx.lineTo(sx - 4, sy - 24);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 1, 8, 3); },
  interact: { type: 'toggle', offset: { x: 0, y: -18 } }
});

_register({
  id: 'fireplace',
  name: 'Fireplace',
  category: 'living',
  width: 2, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.3 },
  colors: { base: '#7A6858', highlight: '#988878', shadow: '#504038', accent: '#E85020' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 48, h = 38, d = 14;
    // Hearth base
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - w / 2, sy - 4, w, 6);
    // Main structure
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Mantle
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - w / 2 - 4, sy - h, w + 8, 6);
    ctx.strokeRect(sx - w / 2 - 4, sy - h, w + 8, 6);
    // Firebox (inner)
    ctx.fillStyle = '#2A1A10';
    ctx.fillRect(sx - 12, sy - h + 10, 24, h - 14);
    // Fire
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(sx - 6, sy - 6);
    ctx.quadraticCurveTo(sx - 2, sy - 18, sx, sy - 22);
    ctx.quadraticCurveTo(sx + 2, sy - 16, sx + 6, sy - 6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // Inner flame
    ctx.fillStyle = '#F8D040';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy - 6);
    ctx.quadraticCurveTo(sx, sy - 14, sx + 3, sy - 6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 26, 7); },
  interact: { type: 'warm', offset: { x: 0, y: -16 } }
});

// ============================================================
// BEDROOM
// ============================================================

_register({
  id: 'bed_single',
  name: 'Single Bed',
  category: 'bedroom',
  width: 1, height: 2, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#A07850', highlight: '#C09870', shadow: '#684830', accent: '#4068A0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 28, l = 40, h = 14;
    // Frame
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - l / 2 - h, w, l);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - l / 2 - h, w, l);
    // Mattress
    ctx.fillStyle = '#E8E0D8';
    ctx.fillRect(sx - w / 2 + 2, sy - l / 2 - h + 2, w - 4, l - 4);
    // Pillow
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(sx - w / 2 + 4, sy - l / 2 - h + 4, w - 8, 8);
    ctx.strokeStyle = _D('#FFFFFF', 10); ctx.strokeRect(sx - w / 2 + 4, sy - l / 2 - h + 4, w - 8, 8);
    // Blanket
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - w / 2 + 2, sy - 2, w - 4, 14);
    ctx.strokeStyle = _D(c.accent, 15);
    ctx.strokeRect(sx - w / 2 + 2, sy - 2, w - 4, 14);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 4, 18, 20); },
  interact: { type: 'sleep', offset: { x: 0, y: -10 } }
});

_register({
  id: 'bed_double',
  name: 'Double Bed',
  category: 'bedroom',
  width: 2, height: 2, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#7A5030', highlight: '#A07850', shadow: '#503018', accent: '#A83838' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 52, l = 44, h = 16;
    // Frame
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - l / 2 - h, w, l);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - l / 2 - h, w, l);
    // Headboard
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - w / 2, sy - l / 2 - h - 6, w, 8);
    ctx.strokeRect(sx - w / 2, sy - l / 2 - h - 6, w, 8);
    // Mattress
    ctx.fillStyle = '#E8E0D8';
    ctx.fillRect(sx - w / 2 + 2, sy - l / 2 - h + 2, w - 4, l - 4);
    // Two pillows
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(sx - w / 2 + 4, sy - l / 2 - h + 4, w / 2 - 6, 8);
    ctx.fillRect(sx + 2, sy - l / 2 - h + 4, w / 2 - 6, 8);
    // Blanket
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - w / 2 + 2, sy - 4, w - 4, 16);
    ctx.strokeStyle = _D(c.accent, 15);
    ctx.strokeRect(sx - w / 2 + 2, sy - 4, w - 4, 16);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 4, 30, 22); },
  interact: { type: 'sleep', offset: { x: 0, y: -12 } }
});

_register({
  id: 'wardrobe',
  name: 'Wardrobe',
  category: 'bedroom',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#604828', highlight: '#806840', shadow: '#402C18', accent: '#887050' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 32, h = 52, d = 14;
    // Body
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Side
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.moveTo(sx + w / 2, sy - h);
    ctx.lineTo(sx + w / 2 + d / 2, sy - h - d / 2);
    ctx.lineTo(sx + w / 2 + d / 2, sy - d / 2);
    ctx.lineTo(sx + w / 2, sy);
    ctx.closePath();
    ctx.fill();
    // Doors
    ctx.strokeStyle = c.highlight;
    ctx.beginPath();
    ctx.moveTo(sx, sy - h + 2);
    ctx.lineTo(sx, sy - 2);
    ctx.stroke();
    // Knobs
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 4, sy - h / 2, 3, 3);
    ctx.fillRect(sx + 2, sy - h / 2, 3, 3);
    // Top cornice
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - w / 2 - 2, sy - h - 4, w + 4, 5);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx + 4, sy + 2, 20, 7); },
  interact: { type: 'open', offset: { x: 0, y: -24 } }
});

_register({
  id: 'nightstand',
  name: 'Nightstand',
  category: 'bedroom',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#705030', highlight: '#907050', shadow: '#503820', accent: '#A08860' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 20, h = 18, d = 12;
    // Body
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Drawer front
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - w / 2 + 2, sy - h + 3, w - 4, h / 2 - 2);
    ctx.strokeRect(sx - w / 2 + 2, sy - h + 3, w - 4, h / 2 - 2);
    // Knob
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 2, sy - h + 6, 4, 3);
    // Side
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.moveTo(sx + w / 2, sy - h);
    ctx.lineTo(sx + w / 2 + d / 2, sy - h - d / 2);
    ctx.lineTo(sx + w / 2 + d / 2, sy - d / 2);
    ctx.lineTo(sx + w / 2, sy);
    ctx.closePath();
    ctx.fill();
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 12, 5); },
  interact: { type: 'open', offset: { x: 0, y: -10 } }
});

_register({
  id: 'vanity',
  name: 'Vanity Table',
  category: 'bedroom',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#E8D8C8', highlight: '#F8F0E8', shadow: '#B8A898', accent: '#D0B8A0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 28, h = 16;
    // Table top
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy - h / 2);
    ctx.lineTo(sx, sy - h);
    ctx.lineTo(sx + w / 2, sy - h / 2);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1; ctx.stroke();
    // Legs
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2 + 2, sy - 2, 3, 6);
    ctx.fillRect(sx + w / 2 - 5, sy - 2, 3, 6);
    // Mirror
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 8, sy - h - 16, 16, 14);
    ctx.strokeStyle = _D(c.accent, 15); ctx.strokeRect(sx - 8, sy - h - 16, 16, 14);
    // Mirror glass
    ctx.fillStyle = '#D0E8F0';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(sx - 6, sy - h - 14, 12, 10);
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 16, 5); },
  interact: { type: 'use', offset: { x: 0, y: -14 } }
});

_register({
  id: 'mirror',
  name: 'Wall Mirror',
  category: 'bedroom',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.3 },
  colors: { base: '#D0B880', highlight: '#F0D8A0', shadow: '#A08858', accent: '#E8F0F8' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 20, h = 32;
    // Frame
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Ornate top
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.arc(sx, sy - h, 6, 0, Math.PI, true);
    ctx.fill();
    // Glass
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(sx - w / 2 + 3, sy - h + 5, w - 6, h - 10);
    ctx.globalAlpha = 1;
    // Reflection streak
    ctx.strokeStyle = '#FFFFFF';
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 4, sy - h + 8);
    ctx.lineTo(sx + 2, sy - 8);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { /* Wall mounted, minimal shadow */ },
  interact: { type: 'view', offset: { x: 0, y: -16 } }
});

_register({
  id: 'dresser',
  name: 'Dresser',
  category: 'bedroom',
  width: 2, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#785030', highlight: '#987050', shadow: '#583820', accent: '#B8A080' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 48, h = 22, d = 14;
    // Body
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Drawers
    ctx.strokeStyle = c.shadow;
    for (let i = 1; i <= 2; i++) {
      const dy = sy - h + i * (h / 3);
      ctx.beginPath();
      ctx.moveTo(sx - w / 2 + 2, dy);
      ctx.lineTo(sx + w / 2 - 2, dy);
      ctx.stroke();
    }
    // Knobs
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 12, sy - h + 5, 4, 3);
    ctx.fillRect(sx + 10, sy - h + 5, 4, 3);
    ctx.fillRect(sx - 12, sy - h / 2 + 1, 4, 3);
    ctx.fillRect(sx + 10, sy - h / 2 + 1, 4, 3);
    // Side
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.moveTo(sx + w / 2, sy - h);
    ctx.lineTo(sx + w / 2 + d / 2, sy - h - d / 2);
    ctx.lineTo(sx + w / 2 + d / 2, sy - d / 2);
    ctx.lineTo(sx + w / 2, sy);
    ctx.closePath();
    ctx.fill();
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx + 4, sy + 2, 28, 7); },
  interact: { type: 'open', offset: { x: 0, y: -10 } }
});

// ============================================================
// KITCHEN
// ============================================================

_register({
  id: 'kitchen_counter',
  name: 'Kitchen Counter',
  category: 'kitchen',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#C0C0C0', highlight: '#E0E0E0', shadow: '#888888', accent: '#A0A0A0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 28, h = 20, d = 14;
    // Cabinet body
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Countertop
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 - 2, sy - h);
    ctx.lineTo(sx, sy - h - 6);
    ctx.lineTo(sx + w / 2 + 2, sy - h);
    ctx.lineTo(sx, sy - h + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Cabinet door line
    ctx.strokeStyle = c.shadow;
    ctx.beginPath();
    ctx.moveTo(sx, sy - h + 2);
    ctx.lineTo(sx, sy - 2);
    ctx.stroke();
    // Knob
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 6, sy - h / 2, 3, 3);
    ctx.fillRect(sx + 4, sy - h / 2, 3, 3);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 16, 6); },
  interact: { type: 'use', offset: { x: 0, y: -12 } }
});

_register({
  id: 'stove',
  name: 'Stove',
  category: 'kitchen',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#A0A0A0', highlight: '#C8C8C8', shadow: '#707070', accent: '#E0E0E0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 26, h = 22, d = 12;
    // Body
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Cooktop
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy - h);
    ctx.lineTo(sx, sy - h - 5);
    ctx.lineTo(sx + w / 2, sy - h);
    ctx.lineTo(sx, sy - h + 3);
    ctx.closePath();
    ctx.fill();
    // Burners
    ctx.fillStyle = '#303030';
    ctx.beginPath();
    ctx.ellipse(sx - 6, sy - h + 1, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sx + 6, sy - h + 1, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Oven door
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - w / 2 + 3, sy - h + 8, w - 6, h - 12);
    ctx.strokeRect(sx - w / 2 + 3, sy - h + 8, w - 6, h - 12);
    // Handle
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - w / 2 + 4, sy - h + 10, w - 8, 2);
    // Knobs
    ctx.fillStyle = '#202020';
    ctx.fillRect(sx - 8, sy - h + 5, 3, 3);
    ctx.fillRect(sx - 2, sy - h + 5, 3, 3);
    ctx.fillRect(sx + 4, sy - h + 5, 3, 3);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 14, 5); },
  interact: { type: 'cook', offset: { x: 0, y: -14 } }
});

_register({
  id: 'fridge',
  name: 'Refrigerator',
  category: 'kitchen',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#D8E0E8', highlight: '#F0F4F8', shadow: '#A0A8B0', accent: '#C0C8D0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 24, h = 52, d = 16;
    // Body
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Side
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.moveTo(sx + w / 2, sy - h);
    ctx.lineTo(sx + w / 2 + d / 2, sy - h - d / 2);
    ctx.lineTo(sx + w / 2 + d / 2, sy - d / 2);
    ctx.lineTo(sx + w / 2, sy);
    ctx.closePath();
    ctx.fill();
    // Freezer line
    ctx.strokeStyle = c.shadow;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy - h + 18);
    ctx.lineTo(sx + w / 2, sy - h + 18);
    ctx.stroke();
    // Handles
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx + w / 2 - 4, sy - h + 6, 3, 10);
    ctx.fillRect(sx + w / 2 - 4, sy - h + 24, 3, 14);
    // Magnet detail
    ctx.fillStyle = '#E84040';
    ctx.fillRect(sx - 4, sy - h + 24, 3, 3);
    ctx.fillStyle = '#40A0E8';
    ctx.fillRect(sx + 2, sy - h + 28, 3, 3);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx + 4, sy + 2, 16, 6); },
  interact: { type: 'open', offset: { x: 0, y: -24 } }
});

_register({
  id: 'sink',
  name: 'Kitchen Sink',
  category: 'kitchen',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#B8B8B8', highlight: '#D8D8D8', shadow: '#888888', accent: '#A0C8E0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 28, h = 18;
    // Counter
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Basin
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - w / 2 + 4, sy - h + 4, w - 8, 8);
    ctx.strokeStyle = _D(c.accent, 15); ctx.strokeRect(sx - w / 2 + 4, sy - h + 4, w - 8, 8);
    // Water
    ctx.fillStyle = '#80D0F0';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(sx - w / 2 + 6, sy - h + 6, w - 12, 4);
    ctx.globalAlpha = 1;
    // Faucet
    ctx.strokeStyle = c.shadow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy - h);
    ctx.quadraticCurveTo(sx + 4, sy - h - 8, sx + 8, sy - h - 4);
    ctx.stroke();
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 16, 6); },
  interact: { type: 'use', offset: { x: 0, y: -10 } }
});

_register({
  id: 'dining_table',
  name: 'Dining Table',
  category: 'kitchen',
  width: 2, height: 2, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#806040', highlight: '#A08060', shadow: '#584028', accent: '#C0A080' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 48, d = 28;
    // Table top (isometric rectangle)
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy - d / 2);
    ctx.lineTo(sx, sy - d);
    ctx.lineTo(sx + w / 2, sy - d / 2);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 20); ctx.lineWidth = 1; ctx.stroke();
    // Edge
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy - d / 2);
    ctx.lineTo(sx - w / 2 + 2, sy - d / 2 + 2);
    ctx.lineTo(sx + 2, sy + 2);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();
    // Legs
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - w / 2 + 3, sy - 3, 4, 7);
    ctx.fillRect(sx + w / 2 - 7, sy - 3, 4, 7);
    ctx.fillRect(sx - 5, sy - 6, 4, 6);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 28, 10); },
  interact: { type: 'use', offset: { x: 0, y: -10 } }
});

_register({
  id: 'dining_chair',
  name: 'Dining Chair',
  category: 'kitchen',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#684830', highlight: '#886848', shadow: '#483018', accent: '#A08868' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Seat
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.moveTo(sx - 10, sy - 4);
    ctx.lineTo(sx, sy - 8);
    ctx.lineTo(sx + 10, sy - 4);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1; ctx.stroke();
    // Backrest
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - 10, sy - 24, 20, 16);
    ctx.strokeRect(sx - 10, sy - 24, 20, 16);
    // Slats
    ctx.strokeStyle = c.shadow;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 4, sy - 22); ctx.lineTo(sx - 4, sy - 10);
    ctx.moveTo(sx + 4, sy - 22); ctx.lineTo(sx + 4, sy - 10);
    ctx.stroke();
    // Legs
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - 8, sy - 2, 3, 5);
    ctx.fillRect(sx + 6, sy - 2, 3, 5);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 1, 12, 4); },
  interact: { type: 'sit', offset: { x: 0, y: -10 } }
});

_register({
  id: 'bar_stool',
  name: 'Bar Stool',
  category: 'kitchen',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#505050', highlight: '#707070', shadow: '#303030', accent: '#A04040' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Seat
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 18, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = _D(c.accent, 20); ctx.lineWidth = 1; ctx.stroke();
    // Legs (crossed)
    ctx.strokeStyle = c.base;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx - 6, sy - 16);
    ctx.lineTo(sx + 6, sy - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx + 6, sy - 16);
    ctx.lineTo(sx - 6, sy - 4);
    ctx.stroke();
    // Foot rest
    ctx.strokeStyle = c.highlight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 6, sy - 10);
    ctx.lineTo(sx + 6, sy - 10);
    ctx.stroke();
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 1, 10, 3); },
  interact: { type: 'sit', offset: { x: 0, y: -18 } }
});

// ============================================================
// OFFICE
// ============================================================

_register({
  id: 'desk',
  name: 'Office Desk',
  category: 'office',
  width: 2, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#705030', highlight: '#907050', shadow: '#503820', accent: '#A08868' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 48, d = 22;
    // Top
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy - d / 2);
    ctx.lineTo(sx, sy - d);
    ctx.lineTo(sx + w / 2, sy - d / 2);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 20); ctx.lineWidth = 1; ctx.stroke();
    // Front panel
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy - d / 2);
    ctx.lineTo(sx - w / 2 + 2, sy - d / 2 + 2);
    ctx.lineTo(sx + 2, sy + 2);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();
    // Drawer
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - 10, sy - d / 2 - 2, 20, 6);
    // Knob
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 2, sy - d / 2, 4, 2);
    // Legs
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - w / 2 + 2, sy - 2, 3, 6);
    ctx.fillRect(sx + w / 2 - 5, sy - 2, 3, 6);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 26, 7); },
  interact: { type: 'use', offset: { x: 0, y: -10 } }
});

_register({
  id: 'office_chair',
  name: 'Office Chair',
  category: 'office',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#303848', highlight: '#485868', shadow: '#1C2028', accent: '#505050' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Seat
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.moveTo(sx - 12, sy - 6);
    ctx.lineTo(sx, sy - 10);
    ctx.lineTo(sx + 12, sy - 6);
    ctx.lineTo(sx, sy - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1; ctx.stroke();
    // Backrest (mesh)
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - 10, sy - 28, 20, 18);
    ctx.strokeRect(sx - 10, sy - 28, 20, 18);
    // Mesh lines
    ctx.strokeStyle = c.shadow;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(sx - 8, sy - 25 + i * 5);
      ctx.lineTo(sx + 8, sy - 25 + i * 5);
      ctx.stroke();
    }
    // Base (wheel column)
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 1, sy - 10, 2, 8);
    // Wheels
    ctx.fillStyle = '#202020';
    ctx.fillRect(sx - 6, sy - 2, 3, 3);
    ctx.fillRect(sx + 4, sy - 2, 3, 3);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 1, 14, 4); },
  interact: { type: 'sit', offset: { x: 0, y: -14 } }
});

_register({
  id: 'computer',
  name: 'Computer',
  category: 'office',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#383838', highlight: '#585858', shadow: '#202020', accent: '#60A8E0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Monitor base
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - 6, sy - 2, 12, 4);
    // Stand
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - 2, sy - 10, 4, 8);
    // Screen bezel
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - 14, sy - 24, 28, 16);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - 14, sy - 24, 28, 16);
    // Screen
    ctx.fillStyle = '#1A1A28';
    ctx.fillRect(sx - 12, sy - 22, 24, 12);
    // Screen glow
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(sx - 10, sy - 20, 20, 8);
    // Simple "code" lines
    ctx.fillStyle = '#90D8A0';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(sx - 8, sy - 18, 6, 1);
    ctx.fillRect(sx - 8, sy - 15, 10, 1);
    ctx.fillRect(sx + 2, sy - 18, 4, 1);
    ctx.globalAlpha = 1;
    // Keyboard
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - 10, sy - 6, 20, 4);
    ctx.strokeStyle = _D(c.shadow, 10); ctx.strokeRect(sx - 10, sy - 6, 20, 4);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 16, 4); },
  interact: { type: 'use', offset: { x: 0, y: -14 } }
});

_register({
  id: 'filing_cabinet',
  name: 'Filing Cabinet',
  category: 'office',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#787878', highlight: '#989898', shadow: '#585858', accent: '#B0B0B0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 22, h = 44, d = 12;
    // Body
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Side
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.moveTo(sx + w / 2, sy - h);
    ctx.lineTo(sx + w / 2 + d / 2, sy - h - d / 2);
    ctx.lineTo(sx + w / 2 + d / 2, sy - d / 2);
    ctx.lineTo(sx + w / 2, sy);
    ctx.closePath();
    ctx.fill();
    // Drawers
    for (let i = 0; i < 3; i++) {
      const dy = sy - h + 4 + i * 14;
      ctx.fillStyle = c.highlight;
      ctx.fillRect(sx - w / 2 + 2, dy, w - 4, 10);
      ctx.strokeRect(sx - w / 2 + 2, dy, w - 4, 10);
      // Label slot
      ctx.fillStyle = c.accent;
      ctx.fillRect(sx - 4, dy + 2, 8, 3);
      // Handle
      ctx.fillStyle = '#484848';
      ctx.fillRect(sx - 3, dy + 6, 6, 2);
    }
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx + 4, sy + 2, 14, 6); },
  interact: { type: 'open', offset: { x: 0, y: -24 } }
});

_register({
  id: 'whiteboard',
  name: 'Whiteboard',
  category: 'office',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.3 },
  colors: { base: '#E8E8E8', highlight: '#FFFFFF', shadow: '#B0B0B0', accent: '#484848' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 6, h = 36;
    // Frame
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - 14, sy - h, 28, h);
    // Board surface
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - 12, sy - h + 2, 24, h - 6);
    ctx.strokeStyle = c.shadow; ctx.lineWidth = 1;
    ctx.strokeRect(sx - 12, sy - h + 2, 24, h - 6);
    // Marker scribbles
    ctx.strokeStyle = '#E84040';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(sx - 8, sy - h + 8);
    ctx.lineTo(sx + 4, sy - h + 12);
    ctx.lineTo(sx - 4, sy - h + 18);
    ctx.stroke();
    ctx.strokeStyle = '#4080E8';
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy - h + 16);
    ctx.lineTo(sx + 8, sy - h + 22);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Tray
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - 14, sy - 4, 28, 4);
    // Marker
    ctx.fillStyle = '#40E840';
    ctx.fillRect(sx + 4, sy - 5, 6, 2);
  },
  drawShadow(ctx, sx, sy) { /* Wall mounted */ },
  interact: { type: 'write', offset: { x: 0, y: -18 } }
});

_register({
  id: 'potted_plant_large',
  name: 'Large Potted Plant',
  category: 'office',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#A06830', highlight: '#C08850', shadow: '#704820', accent: '#389030' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Pot
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.moveTo(sx - 10, sy - 4);
    ctx.lineTo(sx + 10, sy - 4);
    ctx.lineTo(sx + 8, sy - 18);
    ctx.lineTo(sx - 8, sy - 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 20); ctx.lineWidth = 1; ctx.stroke();
    // Rim
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - 12, sy - 20, 24, 4);
    ctx.strokeRect(sx - 12, sy - 20, 24, 4);
    // Soil
    ctx.fillStyle = '#503018';
    ctx.fillRect(sx - 8, sy - 18, 16, 3);
    // Stems
    ctx.strokeStyle = '#287020';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 18);
    ctx.lineTo(sx, sy - 36);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx, sy - 24);
    ctx.lineTo(sx - 10, sy - 34);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx, sy - 22);
    ctx.lineTo(sx + 10, sy - 32);
    ctx.stroke();
    // Leaves
    ctx.fillStyle = c.accent;
    const leaves = [
      [sx - 4, sy - 42, 8], [sx + 4, sy - 40, 8],
      [sx - 12, sy - 36, 6], [sx + 12, sy - 34, 6],
      [sx, sy - 44, 10]
    ];
    leaves.forEach(([lx, ly, lr]) => {
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    });
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 14, 5); },
  interact: { type: 'water', offset: { x: 0, y: -24 } }
});

// ============================================================
// DECOR
// ============================================================

_register({
  id: 'potted_plant_small',
  name: 'Small Potted Plant',
  category: 'decor',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#A06830', highlight: '#C08850', shadow: '#704820', accent: '#48A838' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Pot
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.moveTo(sx - 6, sy - 2);
    ctx.lineTo(sx + 6, sy - 2);
    ctx.lineTo(sx + 5, sy - 10);
    ctx.lineTo(sx - 5, sy - 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 20); ctx.lineWidth = 1; ctx.stroke();
    // Plant
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(sx - 3, sy - 14, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + 3, sy - 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy - 20, 5, 0, Math.PI * 2);
    ctx.fill();
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 8, 3); },
  interact: { type: 'water', offset: { x: 0, y: -10 } }
});

_register({
  id: 'potted_plant_hanging',
  name: 'Hanging Plant',
  category: 'decor',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.3 },
  colors: { base: '#B08040', highlight: '#D8A060', shadow: '#805828', accent: '#48A838' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Chain
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 48);
    ctx.lineTo(sx, sy - 28);
    ctx.stroke();
    // Pot
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.moveTo(sx - 8, sy - 28);
    ctx.lineTo(sx + 8, sy - 28);
    ctx.lineTo(sx + 6, sy - 36);
    ctx.lineTo(sx - 6, sy - 36);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 20); ctx.lineWidth = 1; ctx.stroke();
    // Trailing vines
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + i * 3, sy - 30);
      ctx.quadraticCurveTo(sx + i * 5, sy - 18, sx + i * 2, sy - 10);
      ctx.stroke();
      // Leaf at end
      ctx.fillStyle = c.accent;
      ctx.fillRect(sx + i * 2 - 1, sy - 11, 3, 3);
    }
  },
  drawShadow(ctx, sx, sy) { /* Hanging, no shadow */ },
  interact: { type: 'water', offset: { x: 0, y: -24 } }
});

_register({
  id: 'painting',
  name: 'Wall Painting',
  category: 'decor',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.3 },
  colors: { base: '#D0A850', highlight: '#F0C870', shadow: '#A08038', accent: '#4068A0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 20, h = 24;
    // Frame
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Canvas
    ctx.fillStyle = '#E8E0D0';
    ctx.fillRect(sx - w / 2 + 3, sy - h + 3, w - 6, h - 6);
    // "Landscape" pixels
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(sx - 5, sy - h + 12, 10, 6);
    ctx.fillStyle = '#48A848';
    ctx.fillRect(sx - 5, sy - h + 16, 10, 3);
    ctx.fillStyle = '#F8D040';
    ctx.fillRect(sx - 2, sy - h + 6, 4, 4);
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { },
  interact: { type: 'view', offset: { x: 0, y: -14 } }
});

_register({
  id: 'clock_wall',
  name: 'Wall Clock',
  category: 'decor',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.3 },
  colors: { base: '#D8C8A0', highlight: '#F8ECD0', shadow: '#A89870', accent: '#484848' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Face
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.arc(sx, sy - 18, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c.shadow; ctx.lineWidth = 2; ctx.stroke();
    // Inner face
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.arc(sx, sy - 18, 10, 0, Math.PI * 2);
    ctx.fill();
    // Hour markers
    ctx.fillStyle = c.accent;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.fillRect(
        sx + Math.cos(a) * 7 - 1,
        sy - 18 + Math.sin(a) * 7 - 1,
        2, 2
      );
    }
    // Hands
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, sy - 18); ctx.lineTo(sx, sy - 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx, sy - 18); ctx.lineTo(sx + 5, sy - 16); ctx.stroke();
    // Centre dot
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 1, sy - 19, 2, 2);
  },
  drawShadow(ctx, sx, sy) { },
  interact: { type: 'view', offset: { x: 0, y: -18 } }
});

_register({
  id: 'chandelier',
  name: 'Chandelier',
  category: 'decor',
  width: 2, height: 2, zHeight: 2,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#D8C070', highlight: '#F8E8A0', shadow: '#A89048', accent: '#FFF8D0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Chain
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 44);
    ctx.lineTo(sx, sy - 28);
    ctx.stroke();
    // Central hub
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.arc(sx, sy - 24, 5, 0, Math.PI * 2);
    ctx.fill();
    // Arms
    ctx.strokeStyle = c.highlight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx - 18, sy - 14);
    ctx.lineTo(sx, sy - 24);
    ctx.lineTo(sx + 18, sy - 14);
    ctx.stroke();
    // Candle cups
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - 20, sy - 16, 4, 4);
    ctx.fillRect(sx + 16, sy - 16, 4, 4);
    ctx.fillRect(sx - 2, sy - 12, 4, 4);
    // Candles
    ctx.fillStyle = '#F8F0E0';
    ctx.fillRect(sx - 19, sy - 22, 2, 6);
    ctx.fillRect(sx + 17, sy - 22, 2, 6);
    ctx.fillRect(sx - 1, sy - 18, 2, 6);
    // Flames
    ctx.fillStyle = '#F8D040';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(sx - 19, sy - 24, 2, 2);
    ctx.fillRect(sx + 17, sy - 24, 2, 2);
    ctx.fillRect(sx - 1, sy - 20, 2, 2);
    ctx.globalAlpha = 1;
    // Glow
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.arc(sx, sy - 16, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { /* Ceiling mounted */ },
  interact: { type: 'toggle', offset: { x: 0, y: -18 } }
});

_register({
  id: 'candle',
  name: 'Candle',
  category: 'decor',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#F0E8D8', highlight: '#FFFDF8', shadow: '#C8B8A0', accent: '#F8D040' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Holder plate
    ctx.fillStyle = '#B0A090';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 1, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Candle body
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - 3, sy - 14, 6, 12);
    ctx.strokeStyle = _D(c.base, 10); ctx.lineWidth = 1;
    ctx.strokeRect(sx - 3, sy - 14, 6, 12);
    // Wax drip
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy - 14);
    ctx.lineTo(sx - 1, sy - 10);
    ctx.lineTo(sx + 1, sy - 12);
    ctx.lineTo(sx + 3, sy - 14);
    ctx.closePath();
    ctx.fill();
    // Wick
    ctx.fillStyle = '#484848';
    ctx.fillRect(sx, sy - 16, 1, 2);
    // Flame
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 20);
    ctx.lineTo(sx + 2, sy - 16);
    ctx.lineTo(sx - 1, sy - 16);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // Glow
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.arc(sx, sy - 14, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 1, 6, 2); },
  interact: { type: 'toggle', offset: { x: 0, y: -12 } }
});

_register({
  id: 'vase_flowers',
  name: 'Flower Vase',
  category: 'decor',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#C08860', highlight: '#E0A880', shadow: '#906040', accent: '#E84068' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Vase body
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.moveTo(sx - 5, sy - 4);
    ctx.quadraticCurveTo(sx - 7, sy - 12, sx - 4, sy - 18);
    ctx.lineTo(sx + 4, sy - 18);
    ctx.quadraticCurveTo(sx + 7, sy - 12, sx + 5, sy - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1; ctx.stroke();
    // Rim
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - 5, sy - 20, 10, 3);
    // Flowers
    const flowerColors = ['#E84068', '#F8D040', '#E868A8', '#F8A040'];
    const flowers = [
      [sx - 4, sy - 28], [sx + 2, sy - 30],
      [sx - 2, sy - 34], [sx + 4, sy - 26]
    ];
    flowers.forEach(([fx, fy], i) => {
      ctx.fillStyle = flowerColors[i % flowerColors.length];
      ctx.beginPath();
      ctx.arc(fx, fy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8F0D0';
      ctx.beginPath();
      ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
    // Stems
    ctx.strokeStyle = '#489838';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 20);
    ctx.lineTo(sx - 3, sy - 26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx, sy - 20);
    ctx.lineTo(sx + 2, sy - 28);
    ctx.stroke();
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 8, 3); },
  interact: { type: 'smell', offset: { x: 0, y: -16 } }
});

_register({
  id: 'fish_tank',
  name: 'Fish Tank',
  category: 'decor',
  width: 2, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#585858', highlight: '#787878', shadow: '#383838', accent: '#80D0F8' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 40, h = 24;
    // Frame
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Glass (water)
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(sx - w / 2 + 3, sy - h + 3, w - 6, h - 6);
    ctx.globalAlpha = 1;
    // Water line
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 + 3, sy - h + 8);
    ctx.lineTo(sx + w / 2 - 3, sy - h + 8);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Fish
    ctx.fillStyle = '#F8A838';
    ctx.fillRect(sx - 8, sy - 14, 6, 3);
    ctx.fillRect(sx - 10, sy - 13, 2, 2);
    ctx.fillStyle = '#F86060';
    ctx.fillRect(sx + 6, sy - 16, 5, 3);
    ctx.fillRect(sx + 4, sy - 15, 2, 2);
    // Gravel
    ctx.fillStyle = '#A08060';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(sx - w / 2 + 6 + i * 5, sy - 4, 3, 2);
    }
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 22, 5); },
  interact: { type: 'feed', offset: { x: 0, y: -14 } }
});

_register({
  id: 'trophy_case',
  name: 'Trophy Case',
  category: 'decor',
  width: 2, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#503820', highlight: '#705840', shadow: '#382410', accent: '#F8D040' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 48, h = 40;
    // Base
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - w / 2, sy - 4, w, 6);
    // Back
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Shelves
    ctx.strokeStyle = c.shadow;
    for (let i = 1; i <= 2; i++) {
      const ly = sy - h + i * (h / 3);
      ctx.beginPath();
      ctx.moveTo(sx - w / 2 + 2, ly);
      ctx.lineTo(sx + w / 2 - 2, ly);
      ctx.stroke();
    }
    // Trophies
    ctx.fillStyle = c.accent;
    // Trophy 1
    ctx.fillRect(sx - 16, sy - h + 8, 6, 6);
    ctx.fillRect(sx - 15, sy - h + 14, 4, 3);
    ctx.fillRect(sx - 17, sy - h + 16, 8, 2);
    // Trophy 2
    ctx.fillRect(sx + 6, sy - h + 18, 6, 6);
    ctx.fillRect(sx + 7, sy - h + 24, 4, 3);
    ctx.fillRect(sx + 5, sy - h + 26, 8, 2);
    // Star
    ctx.fillStyle = '#F8F8F8';
    ctx.fillRect(sx - 4, sy - h + 30, 3, 3);
    ctx.fillRect(sx - 6, sy - h + 32, 7, 2);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 26, 6); },
  interact: { type: 'view', offset: { x: 0, y: -20 } }
});

_register({
  id: 'globe',
  name: 'Globe',
  category: 'decor',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#805830', highlight: '#A07850', shadow: '#583818', accent: '#48A0E0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Stand
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - 3, sy - 4, 6, 5);
    // Base plate
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Arc
    ctx.strokeStyle = c.highlight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy - 14, 12, Math.PI * 0.8, Math.PI * 2.2);
    ctx.stroke();
    // Globe sphere
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(sx, sy - 14, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = _D(c.accent, 20); ctx.lineWidth = 1; ctx.stroke();
    // Continents (abstract)
    ctx.fillStyle = '#48A848';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(sx - 6, sy - 18, 5, 4);
    ctx.fillRect(sx + 2, sy - 14, 4, 6);
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 1, 10, 3); },
  interact: { type: 'spin', offset: { x: 0, y: -14 } }
});

// ============================================================
// OUTDOOR
// ============================================================

_register({
  id: 'bench',
  name: 'Park Bench',
  category: 'outdoor',
  width: 2, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#684828', highlight: '#886840', shadow: '#483018', accent: '#A08860' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 44;
    // Seat
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - w / 2, sy - 10, w, 6);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - 10, w, 6);
    // Seat planks
    ctx.strokeStyle = c.shadow;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy - 7);
    ctx.lineTo(sx + w / 2, sy - 7);
    ctx.stroke();
    // Backrest
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - 22, w, 8);
    ctx.strokeRect(sx - w / 2, sy - 22, w, 8);
    // Back slats
    ctx.strokeStyle = c.shadow;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy - 18);
    ctx.lineTo(sx + w / 2, sy - 18);
    ctx.stroke();
    // Legs
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - w / 2 + 3, sy - 4, 4, 6);
    ctx.fillRect(sx + w / 2 - 7, sy - 4, 4, 6);
    ctx.fillRect(sx - 3, sy - 4, 4, 6);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 24, 5); },
  interact: { type: 'sit', offset: { x: 0, y: -14 } }
});

_register({
  id: 'streetlamp',
  name: 'Street Lamp',
  category: 'outdoor',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#303848', highlight: '#485868', shadow: '#1C2028', accent: '#FFF8D0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Base
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pole
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - 2, sy - 50, 4, 48);
    // Top bracket
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - 8, sy - 54, 16, 4);
    // Lantern housing
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - 6, sy - 62, 12, 10);
    ctx.strokeStyle = c.shadow; ctx.lineWidth = 1;
    ctx.strokeRect(sx - 6, sy - 62, 12, 10);
    // Glass
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(sx - 4, sy - 60, 8, 6);
    ctx.globalAlpha = 1;
    // Cap
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.moveTo(sx - 8, sy - 62);
    ctx.lineTo(sx, sy - 66);
    ctx.lineTo(sx + 8, sy - 62);
    ctx.closePath();
    ctx.fill();
    // Light glow
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.arc(sx, sy - 56, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 1, 10, 3); },
  interact: { type: 'toggle', offset: { x: 0, y: -36 } }
});

_register({
  id: 'fountain',
  name: 'Water Fountain',
  category: 'outdoor',
  width: 2, height: 2, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#989898', highlight: '#B8B8B8', shadow: '#707070', accent: '#80D0F8' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Basin rim (isometric circle)
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 4, 24, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1; ctx.stroke();
    // Water surface
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 6, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Central pillar
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - 4, sy - 28, 8, 20);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - 4, sy - 28, 8, 20);
    // Top bowl
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.moveTo(sx - 8, sy - 28);
    ctx.lineTo(sx + 8, sy - 28);
    ctx.lineTo(sx + 6, sy - 34);
    ctx.lineTo(sx - 6, sy - 34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Water spout
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 34);
    ctx.lineTo(sx + 2, sy - 28);
    ctx.lineTo(sx - 1, sy - 28);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 28, 10); },
  interact: { type: 'wish', offset: { x: 0, y: -18 } }
});

_register({
  id: 'birdbath',
  name: 'Bird Bath',
  category: 'outdoor',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#A0A0A0', highlight: '#C8C8C8', shadow: '#787878', accent: '#80D0F8' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Base pedestal
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - 4, sy - 20, 8, 18);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - 4, sy - 20, 8, 18);
    // Base foot
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bowl
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 22, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Water
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 23, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Tiny bird
    ctx.fillStyle = '#484848';
    ctx.fillRect(sx + 4, sy - 27, 4, 3);
    ctx.fillRect(sx + 5, sy - 29, 2, 2);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 1, 10, 3); },
  interact: { type: 'watch', offset: { x: 0, y: -16 } }
});

_register({
  id: 'flower_bed',
  name: 'Flower Bed',
  category: 'outdoor',
  width: 2, height: 1, zHeight: 0,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#684020', highlight: '#886040', shadow: '#482810', accent: '#F8A0C0' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 48, d = 20;
    // Soil bed
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2, sy - d / 2);
    ctx.lineTo(sx, sy - d);
    ctx.lineTo(sx + w / 2, sy - d / 2);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1; ctx.stroke();
    // Border
    ctx.strokeStyle = c.highlight;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 + 2, sy - d / 2);
    ctx.lineTo(sx, sy - d + 2);
    ctx.lineTo(sx + w / 2 - 2, sy - d / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Flowers
    const flowerColors = ['#F8A0C0', '#F8D040', '#E8A8F0', '#F8C880', '#F0F0A0'];
    for (let i = 0; i < 6; i++) {
      const fx = sx - 16 + i * 7 + (Math.sin(i * 3) * 2);
      const fy = sy - 10 + (Math.cos(i * 2) * 3);
      // Stem
      ctx.strokeStyle = '#48A848';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy - 6);
      ctx.stroke();
      // Bloom
      ctx.fillStyle = flowerColors[i % flowerColors.length];
      ctx.beginPath();
      ctx.arc(fx, fy - 7, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8F0D0';
      ctx.beginPath();
      ctx.arc(fx, fy - 7, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  drawShadow(ctx, sx, sy) { /* Ground level */ },
  interact: { type: 'water', offset: { x: 0, y: -6 } }
});

_register({
  id: 'tree_oak',
  name: 'Oak Tree',
  category: 'outdoor',
  width: 2, height: 2, zHeight: 3,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#684020', highlight: '#886040', shadow: '#482810', accent: '#489838' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Trunk
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - 5, sy - 36, 10, 32);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - 5, sy - 36, 10, 32);
    // Trunk texture
    ctx.strokeStyle = c.shadow;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 2, sy - 30); ctx.lineTo(sx - 2, sy - 20);
    ctx.moveTo(sx + 2, sy - 26); ctx.lineTo(sx + 2, sy - 14);
    ctx.stroke();
    // Canopy (multiple overlapping circles)
    ctx.fillStyle = c.accent;
    const blobs = [
      [sx - 14, sy - 40, 14], [sx + 14, sy - 38, 13],
      [sx, sy - 52, 16], [sx - 8, sy - 48, 12],
      [sx + 8, sy - 46, 12], [sx, sy - 40, 18]
    ];
    blobs.forEach(([cx, cy, cr]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    });
    // Highlight on canopy
    ctx.fillStyle = _L(c.accent, 15);
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(sx - 4, sy - 48, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 20, 8); },
  interact: { type: 'shake', offset: { x: 0, y: -32 } }
});

_register({
  id: 'tree_pine',
  name: 'Pine Tree',
  category: 'outdoor',
  width: 2, height: 2, zHeight: 3,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#503818', highlight: '#705830', shadow: '#382410', accent: '#206028' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Trunk
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - 4, sy - 20, 8, 18);
    // Foliage layers (triangles)
    ctx.fillStyle = c.accent;
    // Bottom layer
    ctx.beginPath();
    ctx.moveTo(sx - 22, sy - 18);
    ctx.lineTo(sx, sy - 38);
    ctx.lineTo(sx + 22, sy - 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.accent, 15); ctx.lineWidth = 1; ctx.stroke();
    // Middle layer
    ctx.fillStyle = _L(c.accent, 8);
    ctx.beginPath();
    ctx.moveTo(sx - 18, sy - 28);
    ctx.lineTo(sx, sy - 46);
    ctx.lineTo(sx + 18, sy - 28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Top layer
    ctx.fillStyle = _L(c.accent, 15);
    ctx.beginPath();
    ctx.moveTo(sx - 12, sy - 36);
    ctx.lineTo(sx, sy - 54);
    ctx.lineTo(sx + 12, sy - 36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Snow tip
    ctx.fillStyle = '#E8F0F8';
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(sx - 4, sy - 48);
    ctx.lineTo(sx, sy - 54);
    ctx.lineTo(sx + 4, sy - 48);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 18, 6); },
  interact: { type: 'shake', offset: { x: 0, y: -36 } }
});

_register({
  id: 'bush',
  name: 'Shrub',
  category: 'outdoor',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#307820', highlight: '#489838', shadow: '#205018', accent: '#58B048' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Multiple rounded blobs
    ctx.fillStyle = c.accent;
    const blobs = [
      [sx - 8, sy - 8, 10], [sx + 8, sy - 10, 9],
      [sx, sy - 14, 11], [sx - 6, sy - 18, 8],
      [sx + 6, sy - 16, 8]
    ];
    blobs.forEach(([bx, by, br]) => {
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    });
    // Highlight
    ctx.fillStyle = c.highlight;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(sx - 3, sy - 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 12, 5); },
  interact: { type: 'shake', offset: { x: 0, y: -10 } }
});

_register({
  id: 'rock',
  name: 'Rock',
  category: 'outdoor',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#909090', highlight: '#B0B0B0', shadow: '#686868', accent: '#787878' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Main rock body
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.moveTo(sx - 12, sy - 2);
    ctx.quadraticCurveTo(sx - 14, sy - 12, sx - 6, sy - 16);
    ctx.quadraticCurveTo(sx + 2, sy - 20, sx + 10, sy - 14);
    ctx.quadraticCurveTo(sx + 16, sy - 8, sx + 12, sy - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1; ctx.stroke();
    // Highlight
    ctx.fillStyle = c.highlight;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(sx - 8, sy - 8);
    ctx.quadraticCurveTo(sx - 4, sy - 14, sx + 2, sy - 12);
    ctx.quadraticCurveTo(sx - 2, sy - 8, sx - 8, sy - 8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // Cracks
    ctx.strokeStyle = c.shadow;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy - 6);
    ctx.lineTo(sx - 2, sy - 10);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 1, 14, 4); },
  interact: { type: 'kick', offset: { x: 0, y: -8 } }
});

_register({
  id: 'mailbox',
  name: 'Mailbox',
  category: 'outdoor',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#C0C8D0', highlight: '#E0E8F0', shadow: '#888890', accent: '#E83030' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Post
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - 2, sy - 20, 4, 18);
    // Box
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.moveTo(sx - 10, sy - 20);
    ctx.lineTo(sx + 10, sy - 20);
    ctx.lineTo(sx + 10, sy - 30);
    ctx.quadraticCurveTo(sx + 10, sy - 38, sx, sy - 38);
    ctx.quadraticCurveTo(sx - 10, sy - 38, sx - 10, sy - 30);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1; ctx.stroke();
    // Flag
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx + 10, sy - 30, 3, 8);
    // Door line
    ctx.strokeStyle = c.shadow;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 10, sy - 24);
    ctx.lineTo(sx + 10, sy - 24);
    ctx.stroke();
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 1, 12, 3); },
  interact: { type: 'check', offset: { x: 0, y: -22 } }
});

// ============================================================
// SPECIAL
// ============================================================

_register({
  id: 'jukebox',
  name: 'Jukebox',
  category: 'special',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#C84040', highlight: '#E86060', shadow: '#882828', accent: '#F8D040' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 26, h = 44, d = 14;
    // Body
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Side
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.moveTo(sx + w / 2, sy - h);
    ctx.lineTo(sx + w / 2 + d / 2, sy - h - d / 2);
    ctx.lineTo(sx + w / 2 + d / 2, sy - d / 2);
    ctx.lineTo(sx + w / 2, sy);
    ctx.closePath();
    ctx.fill();
    // Chrome top
    ctx.fillStyle = c.highlight;
    ctx.beginPath();
    ctx.arc(sx, sy - h + 10, 10, Math.PI, 0);
    ctx.fill();
    // Speaker grille
    ctx.fillStyle = '#202020';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(sx - 8, sy - h + 18, 16, 12);
    ctx.globalAlpha = 1;
    // Grille dots
    ctx.fillStyle = '#404040';
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) {
        ctx.fillRect(sx - 6 + j * 4, sy - h + 20 + i * 4, 2, 2);
      }
    }
    // Neon strip
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(sx - 10, sy - h + 32, 20, 3);
    ctx.globalAlpha = 1;
    // Selection buttons
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(sx - 6, sy - 8, 3, 3);
    ctx.fillRect(sx - 1, sy - 8, 3, 3);
    ctx.fillRect(sx + 4, sy - 8, 3, 3);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx + 4, sy + 2, 16, 6); },
  interact: { type: 'play', offset: { x: 0, y: -24 } }
});

_register({
  id: 'arcade_machine',
  name: 'Arcade Machine',
  category: 'special',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#202848', highlight: '#384868', shadow: '#101420', accent: '#F8D040' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 28, h = 50, d = 18;
    // Cabinet body
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h, w, h);
    // Side panel
    ctx.fillStyle = c.shadow;
    ctx.beginPath();
    ctx.moveTo(sx + w / 2, sy - h);
    ctx.lineTo(sx + w / 2 + d / 2, sy - h - d / 2);
    ctx.lineTo(sx + w / 2 + d / 2, sy - d / 2);
    ctx.lineTo(sx + w / 2, sy);
    ctx.closePath();
    ctx.fill();
    // Screen bezel
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - 10, sy - h + 6, 20, 16);
    ctx.strokeRect(sx - 10, sy - h + 6, 20, 16);
    // Screen glow
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(sx - 8, sy - h + 8, 16, 12);
    ctx.globalAlpha = 1;
    // Screen content (abstract game)
    ctx.fillStyle = '#F8A040';
    ctx.fillRect(sx - 4, sy - h + 14, 4, 4);
    ctx.fillStyle = '#40A8F8';
    ctx.fillRect(sx + 2, sy - h + 10, 4, 2);
    // Control panel
    ctx.fillStyle = c.shadow;
    ctx.fillRect(sx - 12, sy - h + 24, 24, 6);
    // Joystick
    ctx.fillStyle = '#E83030';
    ctx.beginPath();
    ctx.arc(sx - 4, sy - h + 26, 3, 0, Math.PI * 2);
    ctx.fill();
    // Buttons
    ctx.fillStyle = '#30E830';
    ctx.fillRect(sx + 4, sy - h + 25, 3, 3);
    ctx.fillStyle = '#3080F8';
    ctx.fillRect(sx + 8, sy - h + 25, 3, 3);
    // Coin slot
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 2, sy - h + 34, 4, 3);
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx + 4, sy + 2, 18, 6); },
  interact: { type: 'play', offset: { x: 0, y: -28 } }
});

_register({
  id: 'chest_treasure',
  name: 'Treasure Chest',
  category: 'special',
  width: 1, height: 1, zHeight: 1,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#885020', highlight: '#A86830', shadow: '#603818', accent: '#F8D040' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    const w = 28, h = 16;
    // Base
    ctx.fillStyle = c.base;
    ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
    ctx.strokeStyle = _D(c.base, 15); ctx.lineWidth = 1;
    ctx.strokeRect(sx - w / 2, sy - h / 2, w, h);
    // Metal bands
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - w / 2, sy - h / 2, 4, h);
    ctx.fillRect(sx + w / 2 - 4, sy - h / 2, 4, h);
    ctx.fillRect(sx - w / 2, sy - 2, w, 4);
    // Lock
    ctx.fillStyle = c.accent;
    ctx.fillRect(sx - 3, sy - 4, 6, 5);
    ctx.fillStyle = '#F8F0D0';
    ctx.fillRect(sx - 1, sy - 2, 2, 3);
    // Lid (slightly open)
    ctx.fillStyle = c.highlight;
    ctx.fillRect(sx - w / 2 - 2, sy - h / 2 - 6, w + 4, 6);
    ctx.strokeRect(sx - w / 2 - 2, sy - h / 2 - 6, w + 4, 6);
    // Gold peeking out
    ctx.fillStyle = '#F8E880';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(sx - 6, sy - h / 2 - 2, 12, 3);
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 16, 5); },
  interact: { type: 'open', offset: { x: 0, y: -10 } }
});

_register({
  id: 'portal_ring',
  name: 'Portal Ring',
  category: 'special',
  width: 2, height: 2, zHeight: 2,
  anchor: { x: 0.5, y: 0.5 },
  colors: { base: '#5830A0', highlight: '#7848D0', shadow: '#381868', accent: '#00F8D8' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Stone ring base
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 28, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c.highlight; ctx.lineWidth = 2; ctx.stroke();
    // Rune marks
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.fillRect(sx + Math.cos(a) * 22 - 1, sy + Math.sin(a) * 7 - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
    // Portal glow (centre)
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 18, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Energy column
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.08;
    ctx.fillRect(sx - 12, sy - 52, 24, 44);
    ctx.globalAlpha = 1;
    // Floating sparkles
    ctx.fillStyle = c.accent;
    const sparkles = [
      [sx - 8, sy - 20], [sx + 6, sy - 30],
      [sx - 4, sy - 42], [sx + 10, sy - 18]
    ];
    sparkles.forEach(([px, py]) => {
      ctx.fillRect(px, py, 2, 2);
    });
  },
  drawShadow(ctx, sx, sy) { _shadow(ctx, sx, sy + 2, 30, 10); },
  interact: { type: 'teleport', offset: { x: 0, y: -28 } }
});

_register({
  id: 'disco_ball',
  name: 'Disco Ball',
  category: 'special',
  width: 1, height: 1, zHeight: 2,
  anchor: { x: 0.5, y: 0.3 },
  colors: { base: '#A0A0A0', highlight: '#D0D0D0', shadow: '#707070', accent: '#F8F8F8' },
  draw(ctx, sx, sy) {
    const c = this.colors;
    // Chain
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 40);
    ctx.lineTo(sx, sy - 28);
    ctx.stroke();
    // Sphere
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.arc(sx, sy - 18, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c.shadow; ctx.lineWidth = 1; ctx.stroke();
    // Mirror facets (grid pattern)
    ctx.strokeStyle = c.highlight;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    for (let i = -8; i <= 8; i += 4) {
      ctx.beginPath();
      ctx.moveTo(sx + i, sy - 28);
      ctx.lineTo(sx + i, sy - 8);
      ctx.stroke();
    }
    for (let j = -8; j <= 4; j += 4) {
      ctx.beginPath();
      ctx.moveTo(sx - 10, sy - 18 + j);
      ctx.lineTo(sx + 10, sy - 18 + j);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Sparkle reflections
    ctx.fillStyle = c.accent;
    const sparkles = [
      [sx - 6, sy - 22], [sx + 4, sy - 16],
      [sx - 2, sy - 14], [sx + 8, sy - 24],
      [sx, sy - 20]
    ];
    sparkles.forEach(([px, py]) => {
      ctx.globalAlpha = 0.5 + Math.random() * 0.3;
      ctx.fillRect(px, py, 2, 2);
    });
    ctx.globalAlpha = 1;
    // Light rays
    ctx.strokeStyle = c.accent;
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 8;
    for (let a = 0; a < 4; a++) {
      const angle = (a * Math.PI) / 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 18);
      ctx.lineTo(sx + Math.cos(angle) * 40, sy - 18 + Math.sin(angle) * 15);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
  drawShadow(ctx, sx, sy) { /* Ceiling mounted */ },
  interact: { type: 'toggle', offset: { x: 0, y: -16 } }
});

// ============================================================
// Catalog Accessors
// ============================================================

/**
 * @typedef {Object} FurnitureColors
 * @property {string} base
 * @property {string} highlight
 * @property {string} shadow
 * @property {string} accent
 */

/**
 * @typedef {Object} FurnitureInteract
 * @property {string} type
 * @property {{x:number,y:number}} offset
 */

/**
 * @typedef {Object} FurnitureDef
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {number} width
 * @property {number} height
 * @property {number} zHeight
 * @property {{x:number,y:number}} anchor
 * @property {FurnitureColors} colors
 * @property {function(CanvasRenderingContext2D,number,number):void} draw
 * @property {function(CanvasRenderingContext2D,number,number):void} drawShadow
 * @property {FurnitureInteract} interact
 */

/**
 * Get all furniture definitions.
 * @returns {FurnitureDef[]}
 */
export function getFurnitureCatalog() {
  return [...FURNITURE_CATALOG];
}

/**
 * Look up a single furniture definition by ID.
 *
 * @param {string} id
 * @returns {FurnitureDef|undefined}
 */
export function getFurniture(id) {
  return FURNITURE_CATALOG.find(f => f.id === id);
}

/**
 * Get all furniture in a category.
 *
 * @param {string} category
 * @returns {FurnitureDef[]}
 */
export function getByCategory(category) {
  return FURNITURE_CATALOG.filter(f => f.category === category);
}

/**
 * Convenience: draw a furniture item by ID.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} id
 * @param {number} screenX
 * @param {number} screenY
 * @returns {boolean} true if the furniture was found and drawn
 */
export function drawFurniture(ctx, id, screenX, screenY) {
  const f = getFurniture(id);
  if (!f) return false;
  ctx.save();
  f.drawShadow(ctx, screenX, screenY);
  f.draw(ctx, screenX, screenY);
  ctx.restore();
  return true;
}

/**
 * Convenience: draw only the shadow for a furniture item by ID.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} id
 * @param {number} screenX
 * @param {number} screenY
 * @returns {boolean}
 */
export function drawFurnitureShadow(ctx, id, screenX, screenY) {
  const f = getFurniture(id);
  if (!f) return false;
  f.drawShadow(ctx, screenX, screenY);
  return true;
}

/**
 * Get all available category IDs.
 * @returns {string[]}
 */
export function getCategories() {
  return [...new Set(FURNITURE_CATALOG.map(f => f.category))];
}

/**
 * Search furniture by name substring (case-insensitive).
 *
 * @param {string} query
 * @returns {FurnitureDef[]}
 */
export function searchFurniture(query) {
  const q = query.toLowerCase();
  return FURNITURE_CATALOG.filter(f =>
    f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)
  );
}

// ============================================================
// Category Constants
// ============================================================

/** @type {string} */
export const CATEGORY_LIVING = 'living';
/** @type {string} */
export const CATEGORY_BEDROOM = 'bedroom';
/** @type {string} */
export const CATEGORY_KITCHEN = 'kitchen';
/** @type {string} */
export const CATEGORY_OFFICE = 'office';
/** @type {string} */
export const CATEGORY_DECOR = 'decor';
/** @type {string} */
export const CATEGORY_OUTDOOR = 'outdoor';
/** @type {string} */
export const CATEGORY_SPECIAL = 'special';

/** All category IDs @type {string[]} */
export const ALL_CATEGORIES = [
  CATEGORY_LIVING, CATEGORY_BEDROOM, CATEGORY_KITCHEN,
  CATEGORY_OFFICE, CATEGORY_DECOR, CATEGORY_OUTDOOR, CATEGORY_SPECIAL
];

// ============================================================
// Default Export — FurnitureCatalog class
// ============================================================

/**
 * FurnitureCatalog provides an object-oriented interface
 * to the furniture catalog with search, filter, and batch operations.
 */
export class FurnitureCatalog {
  constructor() {
    /** @private @type {FurnitureDef[]} */
    this._items = [...FURNITURE_CATALOG];
  }

  /** @returns {FurnitureDef[]} */
  get all() { return [...this._items]; }

  /** @returns {number} */
  get count() { return this._items.length; }

  /**
   * @param {string} id
   * @returns {FurnitureDef|undefined}
   */
  get(id) { return this._items.find(f => f.id === id); }

  /**
   * @param {string} category
   * @returns {FurnitureDef[]}
   */
  byCategory(category) { return this._items.filter(f => f.category === category); }

  /**
   * @param {string} query
   * @returns {FurnitureDef[]}
   */
  search(query) {
    const q = query.toLowerCase();
    return this._items.filter(f =>
      f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)
    );
  }

  /** @returns {string[]} */
  get categories() { return [...new Set(this._items.map(f => f.category))]; }

  /**
   * Draw a furniture item.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} id
   * @param {number} screenX
   * @param {number} screenY
   * @returns {boolean}
   */
  draw(ctx, id, screenX, screenY) {
    return drawFurniture(ctx, id, screenX, screenY);
  }
}

/** Re-export the catalog array */
export { FURNITURE_CATALOG };

export default FurnitureCatalog;

// ── Adapter class for main.js compatibility ──
export class IsoFurniture {
  constructor(game) {
    this.game = game;
    this.catalog = FurnitureCatalog || getFurnitureCatalog();
    this.placed = [];
  }
  getCatalog() { return this.catalog; }
  place(item, tx, ty) {
    const placed = { ...item, tileX: tx, tileY: ty, id: Date.now() + Math.random() };
    this.placed.push(placed);
    return placed;
  }
  remove(id) { this.placed = this.placed.filter(p => p.id !== id); }
  getAt(tx, ty) { return this.placed.filter(p => p.tileX === tx && p.tileY === ty); }
  getAll() { return this.placed; }
  clear() { this.placed = []; }
}
