/**
 * SpriteGenerator.js -- v6.0
 * Generates procedural pixel-art sprites for tiles, furniture, and avatars.
 * Uses deterministic algorithms + palette constraints for Habbo-grade assets.
 */

import { ColorTable } from './ColorTable.js';
import { PaletteValidator } from './PaletteValidator.js';

export class SpriteGenerator {
  constructor(paletteManager) {
    this.paletteManager = paletteManager;
    this._seedCounter = 0;
  }

  // ---- TILES ----

  generateFloorTile(floorType = 'woodOak', size = 64) {
    const color = ColorTable.floors[floorType] || ColorTable.floors.woodOak;
    const palette = ['#000000', color, this._shade(color, -20), this._shade(color, 20)];
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size / 2;
    const ctx = c.getContext('2d');

    // Isometric diamond
    ctx.fillStyle = palette[1];
    this._drawIsoDiamond(ctx, size / 2, size / 4, size, size / 2);
    // Highlight top edge
    ctx.strokeStyle = palette[3];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size, size / 4);
    ctx.stroke();
    // Shadow bottom edge
    ctx.strokeStyle = palette[2];
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    ctx.lineTo(0, size / 4);
    ctx.stroke();
    // Outline
    ctx.strokeStyle = palette[0];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, size / 4);
    ctx.lineTo(size / 2, 0);
    ctx.lineTo(size, size / 4);
    ctx.lineTo(size / 2, size / 2);
    ctx.closePath();
    ctx.stroke();

    return c;
  }

  generateWallTile(wallType = 'plasterWhite', width = 64, height = 48) {
    const color = ColorTable.walls[wallType] || ColorTable.walls.plasterWhite;
    const palette = ['#000000', color, this._shade(color, -30)];
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');

    // Wall face
    ctx.fillStyle = palette[1];
    ctx.fillRect(0, 0, width, height);
    // Side shadow
    ctx.fillStyle = palette[2];
    ctx.fillRect(width - 4, 0, 4, height);
    // Outline
    ctx.strokeStyle = palette[0];
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    return c;
  }

  // ---- FURNITURE ----

  generateFurnitureSprite(furnitureId, paletteOverride = null) {
    const color = ColorTable.furniture[furnitureId] || ColorTable.furniture.sofaDefault;
    const palette = paletteOverride || ['#000000', color, this._shade(color, -20), this._shade(color, 20)];
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');

    // Generic furniture silhouette (box with accent)
    ctx.fillStyle = palette[1];
    this._drawIsoBox(ctx, 32, 40, 48, 32, 24);
    // Highlight
    ctx.fillStyle = palette[3];
    ctx.fillRect(12, 24, 40, 4);
    // Outline
    ctx.strokeStyle = palette[0];
    ctx.lineWidth = 1;
    this._strokeIsoBox(ctx, 32, 40, 48, 32, 24);

    return c;
  }

  // ---- AVATAR ----

  generateAvatarSprite(avatarData, direction = 's', frame = 0) {
    const skin = avatarData.skin || ColorTable.avatar.skinLight;
    const hair = avatarData.hair || ColorTable.avatar.hairBrown;
    const shirt = avatarData.shirt || ColorTable.avatar.shirtBlue;
    const pants = avatarData.pants || ColorTable.avatar.pantsBlue;
    const palette = ['#000000', skin, hair, shirt, pants, '#FFFFFF'];

    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 48;
    const ctx = c.getContext('2d');

    // Body
    ctx.fillStyle = palette[4];
    ctx.fillRect(10, 24, 12, 16);
    // Shirt
    ctx.fillStyle = palette[3];
    ctx.fillRect(10, 24, 12, 10);
    // Head
    ctx.fillStyle = palette[1];
    ctx.fillRect(8, 8, 16, 14);
    // Hair
    ctx.fillStyle = palette[2];
    ctx.fillRect(8, 4, 16, 8);
    // Eyes
    ctx.fillStyle = palette[5];
    if (direction === 'e' || direction === 'se') {
      ctx.fillRect(18, 14, 3, 3);
    } else if (direction === 'w' || direction === 'sw') {
      ctx.fillRect(11, 14, 3, 3);
    } else {
      ctx.fillRect(12, 14, 2, 2);
      ctx.fillRect(18, 14, 2, 2);
    }
    // Outline
    ctx.strokeStyle = palette[0];
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 4, 16, 18);
    ctx.strokeRect(10, 24, 12, 16);

    // Walk bob
    if (frame === 1) {
      ctx.clearRect(0, 0, 32, 48);
      // Same but shifted 1px down
      ctx.fillStyle = palette[4]; ctx.fillRect(10, 25, 12, 15);
      ctx.fillStyle = palette[3]; ctx.fillRect(10, 25, 12, 9);
      ctx.fillStyle = palette[1]; ctx.fillRect(8, 9, 16, 14);
      ctx.fillStyle = palette[2]; ctx.fillRect(8, 5, 16, 8);
      ctx.fillStyle = palette[5];
      if (direction === 'e' || direction === 'se') ctx.fillRect(18, 15, 3, 3);
      else if (direction === 'w' || direction === 'sw') ctx.fillRect(11, 15, 3, 3);
      else { ctx.fillRect(12, 15, 2, 2); ctx.fillRect(18, 15, 2, 2); }
      ctx.strokeStyle = palette[0]; ctx.lineWidth = 1;
      ctx.strokeRect(8, 5, 16, 18); ctx.strokeRect(10, 25, 12, 15);
    }

    return c;
  }

  // ---- GENERIC ----

  generateFromPixels(pixelGrid, palette) {
    const validated = PaletteValidator.validate(palette);
    const pal = validated.valid ? validated.normalized : palette;
    const rows = pixelGrid.length;
    const cols = pixelGrid[0]?.length || 0;
    const c = document.createElement('canvas');
    c.width = cols;
    c.height = rows;
    const ctx = c.getContext('2d');
    const imgData = ctx.createImageData(cols, rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const colorIdx = pixelGrid[y][x];
        if (colorIdx >= 0 && colorIdx < pal.length) {
          const rgb = this._hexToRgb(pal[colorIdx]);
          const idx = (y * cols + x) * 4;
          imgData.data[idx] = rgb.r;
          imgData.data[idx + 1] = rgb.g;
          imgData.data[idx + 2] = rgb.b;
          imgData.data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return c;
  }

  // ---- HELPERS ----

  _drawIsoDiamond(ctx, cx, cy, w, h) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy);
    ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy);
    ctx.closePath();
    ctx.fill();
  }

  _drawIsoBox(ctx, cx, cy, w, d, h) {
    // Top face
    ctx.beginPath();
    ctx.moveTo(cx, cy - h - d / 2);
    ctx.lineTo(cx + w / 2, cy - h);
    ctx.lineTo(cx, cy - h + d / 2);
    ctx.lineTo(cx - w / 2, cy - h);
    ctx.closePath();
    ctx.fill();
    // Front face
    ctx.fillRect(cx - w / 2, cy - h, w, h);
  }

  _strokeIsoBox(ctx, cx, cy, w, d, h) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h - d / 2);
    ctx.lineTo(cx + w / 2, cy - h);
    ctx.lineTo(cx + w / 2, cy);
    ctx.lineTo(cx, cy + d / 2);
    ctx.lineTo(cx - w / 2, cy);
    ctx.lineTo(cx - w / 2, cy - h);
    ctx.closePath();
    ctx.stroke();
  }

  _shade(hex, percent) {
    const rgb = this._hexToRgb(hex);
    const r = Math.min(255, Math.max(0, Math.round(rgb.r * (1 + percent / 100))));
    const g = Math.min(255, Math.max(0, Math.round(rgb.g * (1 + percent / 100))));
    const b = Math.min(255, Math.max(0, Math.round(rgb.b * (1 + percent / 100))));
    return this._rgbToHex(r, g, b);
  }

  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 0, g: 0, b: 0 };
  }

  _rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }
}

export default SpriteGenerator;

// =============================================================================
// FURNITURE SPRITE GENERATOR
// =============================================================================

/**
 * Draw a standard drop-shadow ellipse beneath furniture on a canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx - shadow center X
 * @param {number} cy - shadow base Y
 * @param {number} rw - radius width
 * @param {number} rh - radius height
 */
function _drawShadow(ctx, cx, cy, rw, rh) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a thick 1px-outlined rounded rectangle (pixel-art style).
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

/**
 * Draw a pixel-art oval (axis-aligned ellipse filled and stroked).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} rx
 * @param {number} ry
 * @param {string} fill
 * @param {string} [stroke]
 */
function _pixelOval(ctx, cx, cy, rx, ry, fill, stroke) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * Draw an isometric cube top and visible faces.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx - center X
 * @param {number} cy - center Y (middle of top face)
 * @param {number} w - width (diamond width)
 * @param {number} d - depth (diamond depth)
 * @param {number} h - height in pixels
 * @param {string} topColor
 * @param {string} leftColor
 * @param {string} rightColor
 * @param {string} outline
 */
function _isoBox(ctx, cx, cy, w, d, h, topColor, leftColor, rightColor, outline) {
  const hw = w / 2;
  const hd = d / 2;
  // Top face
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hd);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hd);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Left face
  ctx.fillStyle = leftColor;
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy);
  ctx.lineTo(cx, cy + hd);
  ctx.lineTo(cx, cy + hd + h);
  ctx.lineTo(cx - hw, cy + h);
  ctx.closePath();
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.stroke();
  }
  // Right face
  ctx.fillStyle = rightColor;
  ctx.beginPath();
  ctx.moveTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hd);
  ctx.lineTo(cx, cy + hd + h);
  ctx.lineTo(cx + hw, cy + h);
  ctx.closePath();
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.stroke();
  }
}

/**
 * Build a furniture sprite by id using per-id draw routines.
 * All furniture follows Habbo chunky pixel-art style:
 * bold shapes, flat fills, 1px black outlines, top-left lighter,
 * bottom-right darker, drop shadow at bottom.
 *
 * @param {string} id - Furniture identifier
 * @param {{base:string,highlight:string,shadow:string,accent:string,outline?:string}} [palette]
 * @returns {{canvas:HTMLCanvasElement, width:number, height:number, anchorX:number, anchorY:number, hitW:number, hitH:number}}
 */
export function generateFurnitureSprite(id, palette) {
  let width = 64;
  let height = 64;
  let anchorX = 32;
  let anchorY = 0;

  switch (id) {
    case 'sofa':
      width = 80; height = 48; anchorX = 40; anchorY = 8; break;
    case 'bed':
      width = 80; height = 56; anchorX = 40; anchorY = 4; break;
    case 'table':
      width = 48; height = 40; anchorX = 24; anchorY = 12; break;
    case 'chair':
      width = 32; height = 48; anchorX = 16; anchorY = 8; break;
    case 'lamp':
      width = 24; height = 56; anchorX = 12; anchorY = 0; break;
    case 'tree':
      width = 64; height = 80; anchorX = 32; anchorY = 0; break;
    case 'fountain':
      width = 80; height = 64; anchorX = 40; anchorY = 8; break;
    case 'dresser':
      width = 56; height = 52; anchorX = 28; anchorY = 8; break;
    case 'bookshelf':
      width = 48; height = 72; anchorX = 24; anchorY = 0; break;
    case 'rug_round':
      width = 48; height = 24; anchorX = 24; anchorY = 0; break;
    case 'plant':
      width = 24; height = 40; anchorX = 12; anchorY = 8; break;
    case 'tv':
      width = 40; height = 44; anchorX = 20; anchorY = 4; break;
    case 'desk':
      width = 56; height = 44; anchorX = 28; anchorY = 8; break;
    case 'wardrobe':
      width = 48; height = 72; anchorX = 24; anchorY = 0; break;
    case 'fridge':
      width = 40; height = 64; anchorX = 20; anchorY = 0; break;
    case 'stove':
      width = 40; height = 48; anchorX = 20; anchorY = 8; break;
    case 'sink':
      width = 40; height = 40; anchorX = 20; anchorY = 12; break;
    case 'toilet':
      width = 32; height = 44; anchorX = 16; anchorY = 8; break;
    case 'bathtub':
      width = 56; height = 40; anchorX = 28; anchorY = 8; break;
    case 'piano':
      width = 64; height = 48; anchorX = 32; anchorY = 8; break;
    case 'clock':
      width = 16; height = 40; anchorX = 8; anchorY = 0; break;
    case 'mirror':
      width = 24; height = 48; anchorX = 12; anchorY = 0; break;
    case 'fireplace':
      width = 56; height = 56; anchorX = 28; anchorY = 0; break;
    case 'chest':
      width = 40; height = 32; anchorX = 20; anchorY = 8; break;
    default:
      width = 48; height = 48; anchorX = 24; anchorY = 8; break;
  }

  const canvas = _createCanvas(width, height);
  const ctx = _getCtx(canvas);
  const c = palette || _defaultFurniturePalette(id);

  // Draw shadow
  _drawShadow(ctx, anchorX, height - 4, width * 0.35, 4);

  // Draw furniture body based on id
  switch (id) {
    case 'sofa': {
      const w = 56, h = 20, d = 16;
      // Backrest
      ctx.fillStyle = c.base;
      _roundRect(ctx, anchorX - w / 2, anchorY, w, 12, 3);
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = 1;
      ctx.stroke();
      // Seat
      ctx.fillStyle = c.highlight;
      ctx.beginPath();
      ctx.moveTo(anchorX - w / 2 + 4, anchorY + 12);
      ctx.lineTo(anchorX + w / 2 - 4, anchorY + 12);
      ctx.lineTo(anchorX + w / 2, anchorY + 20);
      ctx.lineTo(anchorX - w / 2, anchorY + 20);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.stroke();
      // Left arm
      ctx.fillStyle = c.base;
      _roundRect(ctx, anchorX - w / 2 - 4, anchorY + 8, 8, 14, 2);
      ctx.fill();
      ctx.stroke();
      // Right arm
      _roundRect(ctx, anchorX + w / 2 - 4, anchorY + 8, 8, 14, 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'bed': {
      const bw = 52, bd = 28;
      // Mattress top
      ctx.fillStyle = c.highlight;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(anchorX + bw / 2, anchorY + bd / 2);
      ctx.lineTo(anchorX, anchorY + bd);
      ctx.lineTo(anchorX - bw / 2, anchorY + bd / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = 1;
      ctx.stroke();
      // Left side
      ctx.fillStyle = c.base;
      ctx.beginPath();
      ctx.moveTo(anchorX - bw / 2, anchorY + bd / 2);
      ctx.lineTo(anchorX, anchorY + bd);
      ctx.lineTo(anchorX, anchorY + bd + 8);
      ctx.lineTo(anchorX - bw / 2, anchorY + bd / 2 + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Right side
      ctx.fillStyle = c.shadow;
      ctx.beginPath();
      ctx.moveTo(anchorX + bw / 2, anchorY + bd / 2);
      ctx.lineTo(anchorX, anchorY + bd);
      ctx.lineTo(anchorX, anchorY + bd + 8);
      ctx.lineTo(anchorX + bw / 2, anchorY + bd / 2 + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Pillow
      ctx.fillStyle = '#F0E8D8';
      ctx.beginPath();
      ctx.moveTo(anchorX - 10, anchorY + bd / 2 - 4);
      ctx.lineTo(anchorX + 10, anchorY + bd / 2 - 4);
      ctx.lineTo(anchorX + 8, anchorY + bd / 2 + 4);
      ctx.lineTo(anchorX - 8, anchorY + bd / 2 + 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.stroke();
      // Blanket
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(anchorX - 14, anchorY + bd / 2 + 2);
      ctx.lineTo(anchorX + 14, anchorY + bd / 2 + 2);
      ctx.lineTo(anchorX + 12, anchorY + bd - 2);
      ctx.lineTo(anchorX - 12, anchorY + bd - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'table': {
      const tw = 32, td = 20, th = 14;
      _isoBox(ctx, anchorX, anchorY + 8, tw, td, th, c.highlight, c.base, c.shadow, c.outline);
      // Legs
      ctx.fillStyle = c.dark;
      const legW = 3;
      const legH = 8;
      // front-left leg
      ctx.fillRect(anchorX - tw / 2 + 2, anchorY + 8 + td / 2 + th, legW, legH);
      ctx.strokeStyle = c.outline;
      ctx.strokeRect(anchorX - tw / 2 + 2, anchorY + 8 + td / 2 + th, legW, legH);
      // front-right leg
      ctx.fillRect(anchorX + tw / 2 - 5, anchorY + 8 + td / 2 + th, legW, legH);
      ctx.strokeRect(anchorX + tw / 2 - 5, anchorY + 8 + td / 2 + th, legW, legH);
      break;
    }
    case 'chair': {
      const cw = 16, cd = 12, ch = 16;
      // Seat
      _isoBox(ctx, anchorX, anchorY + 10, cw, cd, 4, c.highlight, c.base, c.shadow, c.outline);
      // Backrest
      ctx.fillStyle = c.base;
      _roundRect(ctx, anchorX - cw / 2 - 2, anchorY, cw + 4, 12, 2);
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = 1;
      ctx.stroke();
      // Legs
      ctx.fillStyle = c.dark;
      ctx.fillRect(anchorX - cw / 2 + 1, anchorY + 10 + cd / 2 + 4, 2, 8);
      ctx.fillRect(anchorX + cw / 2 - 3, anchorY + 10 + cd / 2 + 4, 2, 8);
      ctx.strokeRect(anchorX - cw / 2 + 1, anchorY + 10 + cd / 2 + 4, 2, 8);
      ctx.strokeRect(anchorX + cw / 2 - 3, anchorY + 10 + cd / 2 + 4, 2, 8);
      break;
    }
    case 'lamp': {
      // Base
      ctx.fillStyle = c.base;
      _roundRect(ctx, anchorX - 6, anchorY + 36, 12, 6, 2);
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.stroke();
      // Pole
      ctx.fillStyle = c.dark;
      ctx.fillRect(anchorX - 1, anchorY + 12, 2, 24);
      ctx.strokeRect(anchorX - 1, anchorY + 12, 2, 24);
      // Shade
      ctx.fillStyle = c.highlight;
      ctx.beginPath();
      ctx.moveTo(anchorX - 8, anchorY + 12);
      ctx.lineTo(anchorX + 8, anchorY + 12);
      ctx.lineTo(anchorX + 6, anchorY + 24);
      ctx.lineTo(anchorX - 6, anchorY + 24);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.stroke();
      // Bulb glow
      ctx.fillStyle = c.accent;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(anchorX, anchorY + 18, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'tree': {
      // Trunk
      ctx.fillStyle = c.base;
      ctx.fillRect(anchorX - 4, anchorY + 36, 8, 20);
      ctx.strokeStyle = c.outline;
      ctx.strokeRect(anchorX - 4, anchorY + 36, 8, 20);
      // Foliage layers (3 stacked ovals)
      ctx.fillStyle = c.highlight;
      _pixelOval(ctx, anchorX, anchorY + 28, 20, 10, c.highlight, c.outline);
      ctx.fillStyle = c.base;
      _pixelOval(ctx, anchorX, anchorY + 18, 18, 10, c.base, c.outline);
      ctx.fillStyle = c.shadow;
      _pixelOval(ctx, anchorX, anchorY + 8, 14, 8, c.shadow, c.outline);
      // Leaves detail dots
      ctx.fillStyle = c.accent;
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(anchorX - 10 + (i * 4) % 22, anchorY + 12 + (i * 6) % 22, 2, 2);
      }
      break;
    }
    case 'fountain': {
      // Basin outer
      _isoBox(ctx, anchorX, anchorY + 24, 48, 28, 10, c.base, c.shadow, c.dark, c.outline);
      // Basin inner (water)
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY + 18);
      ctx.lineTo(anchorX + 14, anchorY + 24);
      ctx.lineTo(anchorX, anchorY + 30);
      ctx.lineTo(anchorX - 14, anchorY + 24);
      ctx.closePath();
      ctx.fill();
      // Central pillar
      ctx.fillStyle = c.highlight;
      ctx.fillRect(anchorX - 3, anchorY + 10, 6, 16);
      ctx.strokeStyle = c.outline;
      ctx.strokeRect(anchorX - 3, anchorY + 10, 6, 16);
      // Top bowl
      ctx.fillStyle = c.base;
      ctx.beginPath();
      ctx.moveTo(anchorX - 8, anchorY + 10);
      ctx.lineTo(anchorX + 8, anchorY + 10);
      ctx.lineTo(anchorX + 4, anchorY + 14);
      ctx.lineTo(anchorX - 4, anchorY + 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Water spurts
      ctx.fillStyle = c.accent;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(anchorX - 1, anchorY + 4, 2, 6);
      ctx.globalAlpha = 1;
      break;
    }
    case 'dresser': {
      const dw = 40, dd = 18, dh = 20;
      _isoBox(ctx, anchorX, anchorY + 12, dw, dd, dh, c.highlight, c.base, c.shadow, c.outline);
      // Drawers
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const dy = anchorY + 16 + i * 10;
        ctx.beginPath();
        ctx.moveTo(anchorX - dw / 2 + 4, dy);
        ctx.lineTo(anchorX + dw / 2 - 4, dy);
        ctx.stroke();
        // Knobs
        ctx.fillStyle = c.accent;
        ctx.fillRect(anchorX - 4, dy - 1, 2, 2);
        ctx.fillRect(anchorX + 2, dy - 1, 2, 2);
      }
      break;
    }
    case 'bookshelf': {
      const bw2 = 28, bd2 = 14, bh = 40;
      _isoBox(ctx, anchorX, anchorY + 20, bw2, bd2, bh, c.highlight, c.base, c.shadow, c.outline);
      // Shelves
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const sy = anchorY + 12 + i * 10;
        ctx.beginPath();
        ctx.moveTo(anchorX - bw2 / 2 + 2, sy);
        ctx.lineTo(anchorX + bw2 / 2 - 2, sy);
        ctx.stroke();
        // Book spines
        ctx.fillStyle = c.accent;
        for (let j = 0; j < 3; j++) {
          ctx.fillRect(anchorX - 8 + j * 8, sy - 6, 3, 6);
        }
      }
      break;
    }
    case 'rug_round': {
      ctx.fillStyle = c.base;
      ctx.beginPath();
      ctx.ellipse(anchorX, anchorY + 10, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.ellipse(anchorX, anchorY + 10, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.stroke();
      break;
    }
    case 'plant': {
      // Pot
      ctx.fillStyle = c.base;
      ctx.beginPath();
      ctx.moveTo(anchorX - 6, anchorY + 28);
      ctx.lineTo(anchorX + 6, anchorY + 28);
      ctx.lineTo(anchorX + 4, anchorY + 36);
      ctx.lineTo(anchorX - 4, anchorY + 36);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.stroke();
      // Leaves
      ctx.fillStyle = c.highlight;
      for (let i = 0; i < 5; i++) {
        const lx = anchorX - 6 + i * 3;
        const ly = anchorY + 12 + (i % 2) * 6;
        ctx.fillRect(lx, ly, 3, 10);
      }
      ctx.strokeStyle = c.outline;
      for (let i = 0; i < 5; i++) {
        const lx = anchorX - 6 + i * 3;
        const ly = anchorY + 12 + (i % 2) * 6;
        ctx.strokeRect(lx, ly, 3, 10);
      }
      break;
    }
    case 'tv': {
      // Stand
      ctx.fillStyle = c.base;
      _roundRect(ctx, anchorX - 12, anchorY + 28, 24, 8, 2);
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.stroke();
      // Screen
      ctx.fillStyle = c.shadow;
      _roundRect(ctx, anchorX - 14, anchorY + 6, 28, 22, 3);
      ctx.fill();
      ctx.stroke();
      // Screen glow
      ctx.fillStyle = c.accent;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(anchorX - 10, anchorY + 10, 20, 14);
      ctx.globalAlpha = 1;
      // Antenna
      ctx.strokeStyle = c.outline;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY + 6);
      ctx.lineTo(anchorX - 4, anchorY - 2);
      ctx.moveTo(anchorX, anchorY + 6);
      ctx.lineTo(anchorX + 4, anchorY - 2);
      ctx.stroke();
      break;
    }
    case 'desk': {
      const dkw = 36, dkd = 18, dkh = 14;
      _isoBox(ctx, anchorX, anchorY + 10, dkw, dkd, dkh, c.highlight, c.base, c.shadow, c.outline);
      // Drawer front
      ctx.fillStyle = c.highlight;
      ctx.fillRect(anchorX - 8, anchorY + 18, 16, 8);
      ctx.strokeStyle = c.outline;
      ctx.strokeRect(anchorX - 8, anchorY + 18, 16, 8);
      // Knob
      ctx.fillStyle = c.accent;
      ctx.fillRect(anchorX - 2, anchorY + 21, 4, 2);
      break;
    }
    case 'wardrobe': {
      const ww = 28, wd = 14, wh = 48;
      _isoBox(ctx, anchorX, anchorY + 24, ww, wd, wh, c.highlight, c.base, c.shadow, c.outline);
      // Doors line
      ctx.strokeStyle = c.outline;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY + 12);
      ctx.lineTo(anchorX, anchorY + 52);
      ctx.stroke();
      // Handles
      ctx.fillStyle = c.accent;
      ctx.fillRect(anchorX - 6, anchorY + 28, 2, 4);
      ctx.fillRect(anchorX + 4, anchorY + 28, 2, 4);
      break;
    }
    case 'fridge': {
      const fw = 20, fd = 16, fh = 44;
      _isoBox(ctx, anchorX, anchorY + 22, fw, fd, fh, c.highlight, c.base, c.shadow, c.outline);
      // Door line
      ctx.strokeStyle = c.outline;
      ctx.beginPath();
      ctx.moveTo(anchorX - fw / 2 + 2, anchorY + 22);
      ctx.lineTo(anchorX + fw / 2 - 2, anchorY + 22);
      ctx.stroke();
      // Handle
      ctx.fillStyle = c.accent;
      ctx.fillRect(anchorX + 4, anchorY + 26, 2, 6);
      break;
    }
    case 'stove': {
      const sw = 24, sd = 18, sh = 20;
      _isoBox(ctx, anchorX, anchorY + 12, sw, sd, sh, c.highlight, c.base, c.shadow, c.outline);
      // Burners
      ctx.fillStyle = c.dark;
      ctx.beginPath();
      ctx.arc(anchorX - 4, anchorY + 10, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(anchorX + 4, anchorY + 10, 3, 0, Math.PI * 2);
      ctx.fill();
      // Oven window
      ctx.fillStyle = c.accent;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(anchorX - 6, anchorY + 20, 12, 8);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.outline;
      ctx.strokeRect(anchorX - 6, anchorY + 20, 12, 8);
      break;
    }
    case 'sink': {
      const skw = 24, skd = 16, skh = 14;
      _isoBox(ctx, anchorX, anchorY + 10, skw, skd, skh, c.highlight, c.base, c.shadow, c.outline);
      // Basin
      ctx.fillStyle = c.accent;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(anchorX - 6, anchorY + 10);
      ctx.lineTo(anchorX + 6, anchorY + 10);
      ctx.lineTo(anchorX + 4, anchorY + 16);
      ctx.lineTo(anchorX - 4, anchorY + 16);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      // Faucet
      ctx.strokeStyle = c.outline;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY + 6);
      ctx.lineTo(anchorX, anchorY - 2);
      ctx.lineTo(anchorX + 4, anchorY - 2);
      ctx.stroke();
      break;
    }
    case 'toilet': {
      // Tank
      ctx.fillStyle = c.base;
      _roundRect(ctx, anchorX - 8, anchorY, 16, 14, 2);
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.stroke();
      // Bowl
      ctx.fillStyle = c.highlight;
      ctx.beginPath();
      ctx.moveTo(anchorX - 8, anchorY + 16);
      ctx.lineTo(anchorX + 8, anchorY + 16);
      ctx.lineTo(anchorX + 6, anchorY + 26);
      ctx.lineTo(anchorX - 6, anchorY + 26);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Seat
      ctx.fillStyle = c.shadow;
      ctx.beginPath();
      ctx.ellipse(anchorX, anchorY + 16, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'bathtub': {
      const btw = 44, btd = 20, bth = 14;
      _isoBox(ctx, anchorX, anchorY + 10, btw, btd, bth, c.highlight, c.base, c.shadow, c.outline);
      // Water
      ctx.fillStyle = c.accent;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(anchorX - 14, anchorY + 10);
      ctx.lineTo(anchorX + 14, anchorY + 10);
      ctx.lineTo(anchorX + 10, anchorY + 16);
      ctx.lineTo(anchorX - 10, anchorY + 16);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      // Feet
      ctx.fillStyle = c.dark;
      ctx.fillRect(anchorX - 16, anchorY + 10 + btd / 2 + bth, 3, 3);
      ctx.fillRect(anchorX + 13, anchorY + 10 + btd / 2 + bth, 3, 3);
      ctx.strokeStyle = c.outline;
      ctx.strokeRect(anchorX - 16, anchorY + 10 + btd / 2 + bth, 3, 3);
      ctx.strokeRect(anchorX + 13, anchorY + 10 + btd / 2 + bth, 3, 3);
      break;
    }
    case 'piano': {
      const pw = 44, pd = 20, ph = 18;
      _isoBox(ctx, anchorX, anchorY + 10, pw, pd, ph, c.highlight, c.base, c.shadow, c.outline);
      // Keyboard
      ctx.fillStyle = '#F0E8D8';
      ctx.beginPath();
      ctx.moveTo(anchorX - 12, anchorY + 14);
      ctx.lineTo(anchorX + 12, anchorY + 14);
      ctx.lineTo(anchorX + 10, anchorY + 18);
      ctx.lineTo(anchorX - 10, anchorY + 18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.stroke();
      // Black keys
      ctx.fillStyle = c.outline;
      for (let i = 0; i < 7; i++) {
        ctx.fillRect(anchorX - 10 + i * 3, anchorY + 14, 1, 3);
      }
      // Lid (open)
      ctx.fillStyle = c.base;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(anchorX - pw / 2, anchorY + 6);
      ctx.lineTo(anchorX + pw / 2, anchorY + 6);
      ctx.lineTo(anchorX + pw / 2, anchorY + 10);
      ctx.lineTo(anchorX - pw / 2, anchorY + 10);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'clock': {
      // Frame
      ctx.fillStyle = c.base;
      _roundRect(ctx, anchorX - 4, anchorY, 8, 30, 2);
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.stroke();
      // Face
      ctx.fillStyle = c.highlight;
      ctx.fillRect(anchorX - 3, anchorY + 2, 6, 26);
      // Hands
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY + 6);
      ctx.lineTo(anchorX, anchorY + 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY + 14);
      ctx.lineTo(anchorX + 2, anchorY + 18);
      ctx.stroke();
      break;
    }
    case 'mirror': {
      // Frame
      ctx.fillStyle = c.base;
      _roundRect(ctx, anchorX - 6, anchorY, 12, 36, 3);
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.stroke();
      // Glass
      ctx.fillStyle = c.accent;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(anchorX - 4, anchorY + 2, 8, 32);
      ctx.globalAlpha = 1;
      // Reflection line
      ctx.strokeStyle = c.highlight;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(anchorX - 2, anchorY + 6);
      ctx.lineTo(anchorX + 2, anchorY + 14);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'fireplace': {
      const fpw = 40, fpd = 18, fph = 28;
      _isoBox(ctx, anchorX, anchorY + 16, fpw, fpd, fph, c.highlight, c.base, c.shadow, c.outline);
      // Opening
      ctx.fillStyle = c.dark;
      ctx.beginPath();
      ctx.moveTo(anchorX - 10, anchorY + 20);
      ctx.lineTo(anchorX + 10, anchorY + 20);
      ctx.lineTo(anchorX + 8, anchorY + 36);
      ctx.lineTo(anchorX - 8, anchorY + 36);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.stroke();
      // Fire
      ctx.fillStyle = c.accent;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(anchorX - 4, anchorY + 30);
      ctx.lineTo(anchorX + 4, anchorY + 30);
      ctx.lineTo(anchorX, anchorY + 20);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      // Mantel
      ctx.fillStyle = c.highlight;
      _roundRect(ctx, anchorX - 18, anchorY + 10, 36, 6, 2);
      ctx.fill();
      ctx.strokeStyle = c.outline;
      ctx.stroke();
      break;
    }
    case 'chest': {
      const chw = 28, chd = 14, chh = 12;
      _isoBox(ctx, anchorX, anchorY + 8, chw, chd, chh, c.highlight, c.base, c.shadow, c.outline);
      // Lid line
      ctx.strokeStyle = c.outline;
      ctx.beginPath();
      ctx.moveTo(anchorX - chw / 2 + 2, anchorY + 8 + chd / 2);
      ctx.lineTo(anchorX + chw / 2 - 2, anchorY + 8 + chd / 2);
      ctx.stroke();
      // Lock
      ctx.fillStyle = c.accent;
      ctx.fillRect(anchorX - 2, anchorY + 10, 4, 4);
      break;
    }
    default: {
      // Generic box furniture
      const gw = 24, gd = 16, gh = 18;
      _isoBox(ctx, anchorX, anchorY + 8, gw, gd, gh, c.highlight, c.base, c.shadow, c.outline);
      break;
    }
  }

  return {
    canvas,
    width,
    height,
    anchorX,
    anchorY,
    hitW: width,
    hitH: height
  };
}

/**
 * Return a default furniture palette based on id.
 *
 * @param {string} id
 * @returns {{base:string,highlight:string,shadow:string,accent:string,outline:string,dark:string}}
 */
function _defaultFurniturePalette(id) {
  const palettes = {
    sofa:      { base: '#8B5E3C', highlight: '#A87850', shadow: '#5C3A24', accent: '#D4A878', outline: OUTLINE_COLOR, dark: '#4A3018' },
    bed:       { base: '#6B5B8A', highlight: '#8A7AA8', shadow: '#4A3A68', accent: '#B0A0D0', outline: OUTLINE_COLOR, dark: '#3A2A50' },
    table:     { base: '#8A6A4A', highlight: '#A88A6A', shadow: '#6A4A2A', accent: '#C8A878', outline: OUTLINE_COLOR, dark: '#5A3A1A' },
    chair:     { base: '#8B5E3C', highlight: '#A87850', shadow: '#5C3A24', accent: '#D4A878', outline: OUTLINE_COLOR, dark: '#4A3018' },
    lamp:      { base: '#6A6A6A', highlight: '#8A8A8A', shadow: '#4A4A4A', accent: '#F8E878', outline: OUTLINE_COLOR, dark: '#3A3A3A' },
    tree:      { base: '#6B4423', highlight: '#4A7A30', shadow: '#3A5A20', accent: '#78B850', outline: OUTLINE_COLOR, dark: '#2A4010' },
    fountain:  { base: '#A0A0A0', highlight: '#C0C0C0', shadow: '#808080', accent: '#58B8F0', outline: OUTLINE_COLOR, dark: '#606060' },
    dresser:   { base: '#7A6040', highlight: '#988060', shadow: '#5A4020', accent: '#B89868', outline: OUTLINE_COLOR, dark: '#4A3010' },
    bookshelf: { base: '#6B4423', highlight: '#8A6A40', shadow: '#4A2E18', accent: '#D4B878', outline: OUTLINE_COLOR, dark: '#3A2010' },
    rug_round: { base: '#8B2020', highlight: '#B84040', shadow: '#501010', accent: '#D4A830', outline: OUTLINE_COLOR, dark: '#400808' },
    plant:     { base: '#8A6040', highlight: '#48A830', shadow: '#306820', accent: '#68C850', outline: OUTLINE_COLOR, dark: '#204810' },
    tv:        { base: '#5A5A5A', highlight: '#787878', shadow: '#3A3A3A', accent: '#90D8F8', outline: OUTLINE_COLOR, dark: '#2A2A2A' },
    desk:      { base: '#7A6040', highlight: '#988060', shadow: '#5A4020', accent: '#B89868', outline: OUTLINE_COLOR, dark: '#4A3010' },
    wardrobe:  { base: '#6B4423', highlight: '#8A6A40', shadow: '#4A2E18', accent: '#D4B878', outline: OUTLINE_COLOR, dark: '#3A2010' },
    fridge:    { base: '#D0D8E0', highlight: '#F0F4F8', shadow: '#A0A8B0', accent: '#90D8F8', outline: OUTLINE_COLOR, dark: '#808890' },
    stove:     { base: '#A0A0A0', highlight: '#C0C0C0', shadow: '#808080', accent: '#F8A830', outline: OUTLINE_COLOR, dark: '#606060' },
    sink:      { base: '#D0D8E0', highlight: '#F0F4F8', shadow: '#A0A8B0', accent: '#90D8F8', outline: OUTLINE_COLOR, dark: '#808890' },
    toilet:    { base: '#D0D8E0', highlight: '#F0F4F8', shadow: '#A0A8B0', accent: '#B0B8C0', outline: OUTLINE_COLOR, dark: '#808890' },
    bathtub:   { base: '#D0D8E0', highlight: '#F0F4F8', shadow: '#A0A8B0', accent: '#90D8F8', outline: OUTLINE_COLOR, dark: '#808890' },
    piano:     { base: '#2A2A2A', highlight: '#484848', shadow: '#1A1A1A', accent: '#F0E8D8', outline: OUTLINE_COLOR, dark: '#0A0A0A' },
    clock:     { base: '#6B4423', highlight: '#8A6A40', shadow: '#4A2E18', accent: '#D4B878', outline: OUTLINE_COLOR, dark: '#3A2010' },
    mirror:    { base: '#6B4423', highlight: '#8A6A40', shadow: '#4A2E18', accent: '#C8E0F0', outline: OUTLINE_COLOR, dark: '#3A2010' },
    fireplace: { base: '#7A6040', highlight: '#988060', shadow: '#5A4020', accent: '#F87830', outline: OUTLINE_COLOR, dark: '#4A3010' },
    chest:     { base: '#8A6A30', highlight: '#A88848', shadow: '#6A4A18', accent: '#D4B840', outline: OUTLINE_COLOR, dark: '#5A3A10' }
  };
  return palettes[id] || palettes.sofa;
}


// =============================================================================
// AVATAR PART SPRITE GENERATOR
// =============================================================================

/**
 * Generate an avatar head part (14x12 oval).
 *
 * @param {string} skinColor - Hex skin colour
 * @param {string} [outlineColor]
 * @returns {{canvas:HTMLCanvasElement, width:number, height:number}}
 */
export function generateAvatarHead(skinColor, outlineColor = OUTLINE_COLOR) {
  const W = 14, H = 12;
  const canvas = _createCanvas(W, H);
  const ctx = _getCtx(canvas);

  // Skin fill
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(7, 6, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 1px outline
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  return { canvas, width: W, height: H };
}

/**
 * Generate an avatar body part (12x14 rect with shirt).
 *
 * @param {string} shirtColor
 * @param {string} [outlineColor]
 * @returns {{canvas:HTMLCanvasElement, width:number, height:number}}
 */
export function generateAvatarBody(shirtColor, outlineColor = OUTLINE_COLOR) {
  const W = 12, H = 14;
  const canvas = _createCanvas(W, H);
  const ctx = _getCtx(canvas);

  // Main body
  ctx.fillStyle = shirtColor;
  ctx.fillRect(1, 1, 10, 12);

  // Folded arms suggestion (darker stripe)
  ctx.fillStyle = _darken(shirtColor, 15);
  ctx.fillRect(1, 6, 10, 3);

  // Outline
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, 10, 12);

  return { canvas, width: W, height: H };
}

/**
 * Generate left or right leg (5x12 each).
 *
 * @param {'left'|'right'} side
 * @param {string} pantsColor
 * @param {string} [outlineColor]
 * @returns {{canvas:HTMLCanvasElement, width:number, height:number}}
 */
export function generateAvatarLeg(side, pantsColor, outlineColor = OUTLINE_COLOR) {
  const W = 5, H = 12;
  const canvas = _createCanvas(W, H);
  const ctx = _getCtx(canvas);

  ctx.fillStyle = pantsColor;
  ctx.fillRect(0, 0, 5, 12);

  // Slight shading per side
  if (side === 'right') {
    ctx.fillStyle = _darken(pantsColor, 10);
    ctx.fillRect(3, 0, 2, 12);
  } else {
    ctx.fillStyle = _lighten(pantsColor, 10);
    ctx.fillRect(0, 0, 2, 12);
  }

  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 5, 12);

  return { canvas, width: W, height: H };
}

/**
 * Generate shoes (6x4).
 *
 * @param {string} shoeColor
 * @param {string} [outlineColor]
 * @returns {{canvas:HTMLCanvasElement, width:number, height:number}}
 */
export function generateAvatarShoes(shoeColor, outlineColor = OUTLINE_COLOR) {
  const W = 6, H = 4;
  const canvas = _createCanvas(W, H);
  const ctx = _getCtx(canvas);

  ctx.fillStyle = shoeColor;
  ctx.fillRect(0, 0, 6, 4);

  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 6, 4);

  return { canvas, width: W, height: H };
}

/**
 * Generate hair sprite based on style.
 *
 * @param {string} style - 'spiky' | 'long' | 'short' | 'curly' | 'bald'
 * @param {string} hairColor
 * @param {string} [outlineColor]
 * @returns {{canvas:HTMLCanvasElement, width:number, height:number}}
 */
export function generateAvatarHair(style, hairColor, outlineColor = OUTLINE_COLOR) {
  let W = 16, H = 14;
  const canvas = _createCanvas(W, H);
  const ctx = _getCtx(canvas);

  ctx.fillStyle = hairColor;
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1;

  switch (style) {
    case 'spiky': {
      // 5 spikes across top
      for (let i = 0; i < 5; i++) {
        const sx = 2 + i * 3;
        const sy = 6 - (i % 2) * 3;
        ctx.beginPath();
        ctx.moveTo(sx, 10);
        ctx.lineTo(sx + 1, sy);
        ctx.lineTo(sx + 2, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // Side tuft
      ctx.fillRect(0, 8, 2, 4);
      ctx.strokeRect(0, 8, 2, 4);
      break;
    }
    case 'long': {
      // Flowing back hair covering top and sides
      ctx.fillRect(1, 2, 14, 6);
      ctx.fillRect(0, 4, 3, 8);
      ctx.fillRect(13, 4, 3, 8);
      ctx.strokeRect(1, 2, 14, 6);
      ctx.strokeRect(0, 4, 3, 8);
      ctx.strokeRect(13, 4, 3, 8);
      // Flow lines
      ctx.strokeStyle = _lighten(hairColor, 15);
      ctx.beginPath();
      ctx.moveTo(3, 6);
      ctx.lineTo(3, 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(12, 6);
      ctx.lineTo(12, 10);
      ctx.stroke();
      break;
    }
    case 'short': {
      // Flat top covering forehead
      ctx.fillRect(2, 2, 12, 5);
      ctx.strokeRect(2, 2, 12, 5);
      ctx.fillRect(1, 5, 2, 3);
      ctx.strokeRect(1, 5, 2, 3);
      ctx.fillRect(13, 5, 2, 3);
      ctx.strokeRect(13, 5, 2, 3);
      break;
    }
    case 'curly': {
      // Bouncy rounded clumps
      for (let i = 0; i < 4; i++) {
        const cx = 3 + i * 3;
        const cy = 4 + (i % 2) * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'bald':
    default: {
      // Nothing drawn — bald head shows skin
      break;
    }
  }

  return { canvas, width: W, height: H };
}

/**
 * Generate eyes (2x2 dots with white highlight).
 *
 * @param {string} eyeColor
 * @param {string} [outlineColor]
 * @returns {{canvas:HTMLCanvasElement, width:number, height:number}}
 */
export function generateAvatarEyes(eyeColor, outlineColor = OUTLINE_COLOR) {
  const W = 10, H = 4;
  const canvas = _createCanvas(W, H);
  const ctx = _getCtx(canvas);

  // Eye whites
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 4, 4);
  ctx.fillRect(6, 0, 4, 4);

  // Iris
  ctx.fillStyle = eyeColor;
  ctx.fillRect(1, 1, 2, 2);
  ctx.fillRect(7, 1, 2, 2);

  // Pupil
  ctx.fillStyle = outlineColor;
  ctx.fillRect(2, 1, 1, 2);
  ctx.fillRect(8, 1, 1, 2);

  // Outline
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 4, 4);
  ctx.strokeRect(6, 0, 4, 4);

  return { canvas, width: W, height: H };
}

/**
 * Generate mouth sprite.
 *
 * @param {string} variant - 'smile' | 'frown' | 'open' | 'neutral'
 * @param {string} [lipColor]
 * @param {string} [outlineColor]
 * @returns {{canvas:HTMLCanvasElement, width:number, height:number}}
 */
export function generateAvatarMouth(variant, lipColor = '#D08070', outlineColor = OUTLINE_COLOR) {
  const W = 8, H = 4;
  const canvas = _createCanvas(W, H);
  const ctx = _getCtx(canvas);

  ctx.fillStyle = lipColor;
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1;

  switch (variant) {
    case 'smile': {
      ctx.beginPath();
      ctx.arc(4, 0, 3, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'frown': {
      ctx.beginPath();
      ctx.arc(4, 4, 3, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'open': {
      ctx.fillStyle = '#402020';
      ctx.fillRect(2, 0, 4, 4);
      ctx.strokeRect(2, 0, 4, 4);
      break;
    }
    case 'neutral':
    default: {
      ctx.fillRect(1, 2, 6, 1);
      ctx.strokeRect(1, 2, 6, 1);
      break;
    }
  }

  return { canvas, width: W, height: H };
}

// =============================================================================
// AVATAR COMPOSITE SPRITE GENERATOR
// =============================================================================

/**
 * Default avatar color presets.
 * @type {Object<string, {skin:string,shirt:string,pants:string,shoes:string,hair:string,eyes:string}>}
 */
export const AVATAR_COLOR_PRESETS = {
  default: { skin: '#FFE0BD', shirt: '#5B8C85', pants: '#304860', shoes: '#202020', hair: '#2D2D2D', eyes: '#4068A0' },
  warm:    { skin: '#FFCD94', shirt: '#C75B5B', pants: '#5B3A3A', shoes: '#2A1818', hair: '#5C3A21', eyes: '#6B4C9A' },
  cool:    { skin: '#EAC086', shirt: '#5B7FA8', pants: '#283850', shoes: '#1A1A2A', hair: '#D4A574', eyes: '#2D8A60' },
  dark:    { skin: '#D2A56D', shirt: '#8C5B5B', pants: '#3A3A3A', shoes: '#181818', hair: '#2D2D2D', eyes: '#3A60A0' },
  bright:  { skin: '#FFE0BD', shirt: '#D4A45B', pants: '#5B7FA8', shoes: '#303030', hair: '#E8C547', eyes: '#4A90D0' }
};

/**
 * Generate a full 32x48 avatar composite for a given direction and colors.
 * Supports 4 directions: 'south', 'east', 'north', 'west'.
 * Each direction gets 4 walk frames + 1 idle frame.
 *
 * @param {string} direction - 'south' | 'east' | 'north' | 'west'
 * @param {Object} colors - {skin, shirt, pants, shoes, hair, eyes}
 * @param {string} hairStyle
 * @param {string} mouthVariant
 * @returns {{idle:HTMLCanvasElement, frames:HTMLCanvasElement[], width:number, height:number, anchorX:number, anchorY:number}}
 */
export function generateAvatarSprite(direction, colors, hairStyle = 'short', mouthVariant = 'smile') {
  const W = 32;
  const H = 48;
  const anchorX = 16;
  const anchorY = 0;

  const frames = [];

  // Generate each walk frame (0-3) and idle (stored separately)
  for (let frame = 0; frame < 4; frame++) {
    frames.push(_buildAvatarFrame(direction, colors, hairStyle, mouthVariant, frame, W, H, false));
  }
  const idle = _buildAvatarFrame(direction, colors, hairStyle, mouthVariant, 0, W, H, true);

  return {
    idle,
    frames,
    width: W,
    height: H,
    anchorX,
    anchorY
  };
}

/**
 * Build a single avatar frame canvas by compositing parts.
 *
 * @param {string} direction
 * @param {Object} colors
 * @param {string} hairStyle
 * @param {string} mouthVariant
 * @param {number} frameIndex
 * @param {number} W
 * @param {number} H
 * @param {boolean} isIdle
 * @returns {HTMLCanvasElement}
 */
function _buildAvatarFrame(direction, colors, hairStyle, mouthVariant, frameIndex, W, H, isIdle) {
  const canvas = _createCanvas(W, H);
  const ctx = _getCtx(canvas);

  const { skin, shirt, pants, shoes, hair: hairColor, eyes } = colors;
  const outline = OUTLINE_COLOR;

  // Animation offsets
  const walkPhase = isIdle ? 0 : Math.sin((frameIndex / 4) * Math.PI * 2) * 2;
  const bobY = isIdle ? 0 : Math.abs(Math.sin((frameIndex / 4) * Math.PI * 2)) * 1;

  // Base positions (from top-left of 32x48 canvas)
  const headCX = 16;
  const headCY = 8 + bobY;
  const bodyY = 16 + bobY;
  const legY = 30 + bobY;

  // Shadow
  _drawShadow(ctx, 16, 44, 10, 3);

  // --- Draw legs ---
  const legOffset = isIdle ? 0 : Math.sin((frameIndex / 4) * Math.PI * 2) * 3;

  if (direction === 'south' || direction === 'north') {
    // Left leg
    ctx.fillStyle = pants;
    ctx.fillRect(11 + (isIdle ? 0 : -legOffset), legY, 5, 12);
    ctx.strokeStyle = outline;
    ctx.strokeRect(11 + (isIdle ? 0 : -legOffset), legY, 5, 12);
    // Right leg
    ctx.fillRect(16 + (isIdle ? 0 : legOffset), legY, 5, 12);
    ctx.strokeRect(16 + (isIdle ? 0 : legOffset), legY, 5, 12);
  } else {
    // East / West: one leg slightly forward
    const frontLegX = direction === 'east' ? 17 : 10;
    const backLegX = direction === 'east' ? 10 : 17;
    const fx = frontLegX + (isIdle ? 0 : legOffset);
    const bx = backLegX - (isIdle ? 0 : legOffset);
    ctx.fillStyle = _darken(pants, 10);
    ctx.fillRect(bx, legY, 5, 12);
    ctx.strokeRect(bx, legY, 5, 12);
    ctx.fillStyle = pants;
    ctx.fillRect(fx, legY, 5, 12);
    ctx.strokeRect(fx, legY, 5, 12);
  }

  // --- Draw shoes ---
  ctx.fillStyle = shoes;
  if (direction === 'south' || direction === 'north') {
    ctx.fillRect(11 + (isIdle ? 0 : -legOffset), legY + 12, 5, 4);
    ctx.strokeRect(11 + (isIdle ? 0 : -legOffset), legY + 12, 5, 4);
    ctx.fillRect(16 + (isIdle ? 0 : legOffset), legY + 12, 5, 4);
    ctx.strokeRect(16 + (isIdle ? 0 : legOffset), legY + 12, 5, 4);
  } else {
    const frontLegX = direction === 'east' ? 17 : 10;
    const backLegX = direction === 'east' ? 10 : 17;
    const fx = frontLegX + (isIdle ? 0 : legOffset);
    const bx = backLegX - (isIdle ? 0 : legOffset);
    ctx.fillRect(bx, legY + 12, 5, 4);
    ctx.strokeRect(bx, legY + 12, 5, 4);
    ctx.fillRect(fx, legY + 12, 5, 4);
    ctx.strokeRect(fx, legY + 12, 5, 4);
  }

  // --- Draw body ---
  ctx.fillStyle = shirt;
  ctx.fillRect(10, bodyY, 12, 14);
  ctx.strokeStyle = outline;
  ctx.strokeRect(10, bodyY, 12, 14);
  // Arm fold shading
  ctx.fillStyle = _darken(shirt, 15);
  ctx.fillRect(10, bodyY + 6, 12, 3);

  // --- Draw head ---
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(headCX, headCY + 6, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1;
  ctx.stroke();

  // --- Draw hair (behind ears for some styles) ---
  if (hairStyle !== 'bald') {
    const hairCanvas = generateAvatarHair(hairStyle, hairColor, outline).canvas;
    const hairX = headCX - 8;
    const hairY = headCY - 4;
    ctx.drawImage(hairCanvas, hairX, hairY);
  }

  // --- Draw eyes ---
  const eyeCanvas = generateAvatarEyes(eyes, outline).canvas;
  let eyeX = headCX - 5;
  let eyeY = headCY + 2;
  if (direction === 'east') { eyeX = headCX - 1; }
  if (direction === 'west') { eyeX = headCX - 9; }
  if (direction === 'north') { eyeX = headCX - 5; eyeY = headCY + 1; }
  ctx.drawImage(eyeCanvas, eyeX, eyeY);

  // --- Draw mouth ---
  const mouthCanvas = generateAvatarMouth(mouthVariant, '#D08070', outline).canvas;
  let mouthX = headCX - 4;
  let mouthY = headCY + 8;
  if (direction === 'east') { mouthX = headCX; }
  if (direction === 'west') { mouthX = headCX - 8; }
  if (direction === 'north') { mouthY = headCY + 6; }
  ctx.drawImage(mouthCanvas, mouthX, mouthY);

  // --- Direction-specific extras ---
  if (direction === 'east') {
    // Ear visible
    ctx.fillStyle = skin;
    ctx.fillRect(headCX + 5, headCY + 4, 2, 3);
    ctx.strokeRect(headCX + 5, headCY + 4, 2, 3);
  } else if (direction === 'west') {
    // Ear visible
    ctx.fillStyle = skin;
    ctx.fillRect(headCX - 7, headCY + 4, 2, 3);
    ctx.strokeRect(headCX - 7, headCY + 4, 2, 3);
  }

  return canvas;
}

/**
 * Generate all frames for an avatar: 4 directions x (idle + 4 walk frames).
 *
 * @param {Object} colors - Avatar colors
 * @param {string} [hairStyle]
 * @param {string} [mouthVariant]
 * @returns {Object<string, {idle:HTMLCanvasElement, frames:HTMLCanvasElement[], width:number, height:number, anchorX:number, anchorY:number}>}
 */
export function generateAvatarFullSheet(colors, hairStyle = 'short', mouthVariant = 'smile') {
  const directions = ['south', 'east', 'north', 'west'];
  const result = {};
  for (const dir of directions) {
    result[dir] = generateAvatarSprite(dir, colors, hairStyle, mouthVariant);
  }
  return result;
}

// =============================================================================
// DECOR / PROP SPRITE GENERATOR
// =============================================================================

/**
 * Generate a simple decor prop sprite.
 *
 * @param {string} type - 'star', 'heart', 'coin', 'gem', 'flower', 'cloud'
 * @param {string} [color]
 * @returns {{canvas:HTMLCanvasElement, width:number, height:number, anchorX:number, anchorY:number, hitW:number, hitH:number}}
 */
export function generateDecorSprite(type, color) {
  let W = 16, H = 16;
  const canvas = _createCanvas(W, H);
  const ctx = _getCtx(canvas);

  const c = color || '#F8D850';
  ctx.fillStyle = c;
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 1;

  switch (type) {
    case 'star': {
      const cx = 8, cy = 8, r = 7;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 4 * Math.PI / 5) - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(Math.floor(x), Math.floor(y));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'heart': {
      ctx.beginPath();
      ctx.moveTo(8, 14);
      ctx.bezierCurveTo(1, 10, 1, 3, 8, 5);
      ctx.bezierCurveTo(15, 3, 15, 10, 8, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'coin': {
      ctx.beginPath();
      ctx.arc(8, 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(7, 5, 2, 6);
      break;
    }
    case 'gem': {
      ctx.beginPath();
      ctx.moveTo(8, 2);
      ctx.lineTo(14, 6);
      ctx.lineTo(8, 14);
      ctx.lineTo(2, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = _lighten(c, 30);
      ctx.fillRect(6, 5, 4, 2);
      break;
    }
    case 'flower': {
      // Petals
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI / 5) - Math.PI / 2;
        const px = 8 + Math.cos(a) * 4;
        const py = 8 + Math.sin(a) * 4;
        ctx.beginPath();
        ctx.arc(Math.floor(px), Math.floor(py), 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#F8E850';
      ctx.beginPath();
      ctx.arc(8, 8, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'cloud': {
      ctx.fillStyle = '#E8F0F8';
      ctx.beginPath();
      ctx.arc(6, 10, 4, 0, Math.PI * 2);
      ctx.arc(10, 8, 5, 0, Math.PI * 2);
      ctx.arc(14, 10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    default: {
      ctx.fillRect(4, 4, 8, 8);
      ctx.strokeRect(4, 4, 8, 8);
    }
  }

  return {
    canvas,
    width: W,
    height: H,
    anchorX: W / 2,
    anchorY: H / 2,
    hitW: W,
    hitH: H
  };
}

// =============================================================================
// BULK GENERATION HELPERS
// =============================================================================

/**
 * Generate all floor tile sprites.
 *
 * @returns {Object<string, {canvas:HTMLCanvasElement, width:number, height:number, anchorX:number, anchorY:number, hitW:number, hitH:number}>}
 */
export function generateAllFloorSprites() {
  const out = {};
  for (const type of FLOOR_TYPES) {
    out[type] = generateTileSprite(type);
  }
  return out;
}

/**
 * Generate all wall sprites.
 *
 * @returns {Object<string, {canvas:HTMLCanvasElement, width:number, height:number, anchorX:number, anchorY:number, hitW:number, hitH:number}>}
 */
export function generateAllWallSprites() {
  const out = {};
  for (const type of WALL_TYPES) {
    out[type] = generateWallSprite(type);
  }
  return out;
}

/**
 * Generate all furniture sprites.
 *
 * @returns {Object<string, {canvas:HTMLCanvasElement, width:number, height:number, anchorX:number, anchorY:number, hitW:number, hitH:number}>}
 */
export function generateAllFurnitureSprites() {
  const ids = [
    'sofa', 'bed', 'table', 'chair', 'lamp', 'tree', 'fountain',
    'dresser', 'bookshelf', 'rug_round', 'plant', 'tv', 'desk',
    'wardrobe', 'fridge', 'stove', 'sink', 'toilet', 'bathtub',
    'piano', 'clock', 'mirror', 'fireplace', 'chest'
  ];
  const out = {};
  for (const id of ids) {
    out[id] = generateFurnitureSprite(id);
  }
  return out;
}

/**
 * Generate all decor sprites.
 *
 * @returns {Object<string, {canvas:HTMLCanvasElement, width:number, height:number, anchorX:number, anchorY:number, hitW:number, hitH:number}>}
 */
export function generateAllDecorSprites() {
  const types = ['star', 'heart', 'coin', 'gem', 'flower', 'cloud'];
  const colors = ['#F8D850', '#F85050', '#F8C830', '#50A8F8', '#F878D0', '#A0C8F8'];
  const out = {};
  for (let i = 0; i < types.length; i++) {
    out[types[i]] = generateDecorSprite(types[i], colors[i]);
  }
  return out;
}

/**
 * Generate a complete tile + wall + furniture + avatar asset bundle.
 *
 * @param {Object} [avatarColors]
 * @param {string} [hairStyle]
 * @param {string} [mouthVariant]
 * @returns {Object}
 */
export function generateFullAssetBundle(avatarColors, hairStyle, mouthVariant) {
  const colors = avatarColors || AVATAR_COLOR_PRESETS.default;
  return {
    floors: generateAllFloorSprites(),
    walls: generateAllWallSprites(),
    furniture: generateAllFurnitureSprites(),
    decor: generateAllDecorSprites(),
    avatar: generateAvatarFullSheet(colors, hairStyle || 'short', mouthVariant || 'smile'),
    avatarParts: {
      head: generateAvatarHead(colors.skin),
      body: generateAvatarBody(colors.shirt),
      legL: generateAvatarLeg('left', colors.pants),
      legR: generateAvatarLeg('right', colors.pants),
      shoes: generateAvatarShoes(colors.shoes),
      hair: generateAvatarHair(hairStyle || 'short', colors.hair),
      eyes: generateAvatarEyes(colors.eyes),
      mouth: generateAvatarMouth(mouthVariant || 'smile')
    }
  };
}

/** Default export is the full module API. */
export default {
  TILE_WIDTH, TILE_HEIGHT, TILE_HW, TILE_HH, WALL_H,
  FLOOR_PALETTES, FLOOR_TYPES, getFloorPalette,
  WALL_PALETTES, WALL_TYPES, getWallPalette,
  AVATAR_COLOR_PRESETS,
  generateTileSprite,
  generateWallSprite,
  generateFurnitureSprite,
  generateAvatarHead,
  generateAvatarBody,
  generateAvatarLeg,
  generateAvatarShoes,
  generateAvatarHair,
  generateAvatarEyes,
  generateAvatarMouth,
  generateAvatarSprite,
  generateAvatarFullSheet,
  generateDecorSprite,
  generateAllFloorSprites,
  generateAllWallSprites,
  generateAllFurnitureSprites,
  generateAllDecorSprites,
  generateFullAssetBundle
};
