/**
 * FurnitureCatalog.js
 * Starlight Inn v7.0 — Habbo-style Isometric Furniture Asset Factory
 * 60+ procedural Canvas 2D sprites with bold outlines, flat colors, 2:1 iso projection.
 * Each item: id, name, category, price, rarity, snap-to-grid size (tiles), draw(ctx, x, y, facing).
 *
 * @version 7.0.0
 * @module StarlightInn/assets/FurnitureCatalog
 */

'use strict';

/* ──────────── shared Habbo-style palette & helpers ──────────── */
const PAL = {
  outline: '#000000',
  // seating
  sofaRed: '#D32F2F', sofaRedDark: '#B71C1C', sofaRedLight: '#EF5350',
  sofaBlue: '#1976D2', sofaBlueDark: '#0D47A1', sofaBlueLight: '#42A5F5',
  sofaGreen: '#388E3C', sofaGreenDark: '#1B5E20', sofaGreenLight: '#66BB6A',
  sofaPurple: '#7B1FA2', sofaPurpleDark: '#4A148C', sofaPurpleLight: '#AB47BC',
  sofaGold: '#FBC02D', sofaGoldDark: '#F57F17', sofaGoldLight: '#FFF176',
  // tables
  woodLight: '#D7CCC8', woodMid: '#A1887F', woodDark: '#5D4037',
  glass: '#B3E5FC', glassEdge: '#0288D1',
  marble: '#F5F5F5', marbleVein: '#9E9E9E',
  metal: '#607D8B', metalDark: '#37474F',
  // beds
  bedSheet: '#E3F2FD', bedSheetDark: '#90CAF9', bedBlanket: '#FFCDD2',
  pillow: '#FFFFFF', pillowShadow: '#E0E0E0',
  // storage
  cabinetBody: '#795548', cabinetDoor: '#8D6E63',
  // electronics
  screenOff: '#212121', screenOn: '#00E676', screenGlow: '#69F0AE',
  plastic: '#424242', plasticLight: '#616161',
  // lighting
  lampShade: '#FFEB3B', lampShadeDark: '#FBC02D', lampGlow: '#FFF9C4',
  neonPink: '#FF4081', neonCyan: '#00E5FF', neonPurple: '#E040FB',
  candleWax: '#FFF8E1', candleFlame: '#FFAB00',
  // plants
  leafDark: '#1B5E20', leafMid: '#2E7D32', leafLight: '#4CAF50',
  potTerracotta: '#BF360C', potCeramic: '#ECEFF1',
  flowerPink: '#F8BBD0', flowerRed: '#E91E63', flowerYellow: '#FFEB3B',
  flowerBlue: '#2196F3', flowerWhite: '#FFFFFF',
  // decorations
  goldFrame: '#FFD700', paintingBg: '#1A237E',
  rugRed: '#C62828', rugBlue: '#1565C0', rugGreen: '#2E7D32',
  rugPattern: '#FFEB3B', rugBorder: '#FFFFFF',
  mirrorGlass: '#E1F5FE', statueStone: '#9E9E9E',
  fountainWater: '#4FC3F7', fountainStone: '#78909C',
  trophyGold: '#FFD700', trophySilver: '#B0BEC5', trophyBronze: '#8D6E63',
  // outdoor
  umbrellaRed: '#D32F2F', umbrellaWhite: '#FFFFFF', umbrellaStripe: '#F5F5F5',
  grillBlack: '#212121', grillCoal: '#3E2723', grillGrate: '#616161',
  tentCanvas: '#FF8A65', tentPole: '#5D4037',
  // special
  portalRing: '#00E676', portalCore: '#69F0AE', portalDark: '#004D40',
  teleporterPad: '#7C4DFF', teleporterGlow: '#B388FF',
  danceFloor1: '#FF4081', danceFloor2: '#00E5FF', danceFloor3: '#76FF03',
  djBoothBody: '#212121', djBoothAccent: '#FF4081',
  chestWood: '#5D4037', chestGold: '#FFD700', chestLock: '#FFC107',
};

const ISO = {
  /** tile width in screen px  */ tw: 64,
  /** tile height in screen px */ th: 32,
  /** half tile width          */ hw: 32,
  /** half tile height         */ hh: 16,
};

/* iso helpers: map 3D tile coords to 2D screen coords */
function isoX(tx, ty) { return (tx - ty) * ISO.hw; }
function isoY(tx, ty) { return (tx + ty) * ISO.hh; }

/**
 * Draw a filled isometric "block" (cube-like prism).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x screen anchor
 * @param {number} y screen anchor (bottom-center of block)
 * @param {number} w width in tiles
 * @param {number} d depth in tiles
 * @param {number} h height in px above floor
 * @param {Object} c {top, left, right, outline}
 */
function drawBlock(ctx, x, y, w, d, h, c) {
  const tw = ISO.tw, th = ISO.th, hw = ISO.hw, hh = ISO.hh;
  const pxW = w * tw;           // total screen width of footprint
  const pxD = d * th;           // total screen depth of footprint
  const pxH = h;                // vertical height in px

  // footprint corners (bottom center is x,y)
  const bl = { x: x - pxW * 0.5, y: y };
  const br = { x: x + pxW * 0.5, y: y };
  const tl = { x: x - pxD,      y: y - pxD * 0.5 };
  const tr = { x: x + pxD,      y: y - pxD * 0.5 };

  // top surface corners
  const tbl = { x: bl.x, y: bl.y - pxH };
  const tbr = { x: br.x, y: br.y - pxH };
  const ttl = { x: tl.x, y: tl.y - pxH };
  const ttr = { x: tr.x, y: tr.y - pxH };

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';

  // top face
  ctx.beginPath();
  ctx.moveTo(ttl.x, ttl.y);
  ctx.lineTo(ttr.x, ttr.y);
  ctx.lineTo(tbr.x, tbr.y);
  ctx.lineTo(tbl.x, tbl.y);
  ctx.closePath();
  ctx.fillStyle = c.top;
  ctx.fill();
  ctx.strokeStyle = c.outline || PAL.outline;
  ctx.stroke();

  // left face
  ctx.beginPath();
  ctx.moveTo(tbl.x, tbl.y);
  ctx.lineTo(tl.x, tl.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.lineTo(tbr.x, tbr.y); // shared edge
  ctx.closePath();
  ctx.fillStyle = c.left;
  ctx.fill();
  ctx.stroke();

  // right face
  ctx.beginPath();
  ctx.moveTo(tbr.x, tbr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(ttr.x, ttr.y);
  ctx.closePath();
  ctx.fillStyle = c.right;
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a simple outline-only iso rectangle (floor footprint).
 */
function drawFootprint(ctx, x, y, w, d) {
  const hw = ISO.hw, hh = ISO.hh;
  const pxW = w * ISO.tw;
  const pxD = d * ISO.th;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.lineWidth = 2;
  ctx.strokeStyle = PAL.outline;
  ctx.beginPath();
  ctx.moveTo(x, y - pxD * 0.5);          // top
  ctx.lineTo(x + pxD + pxW * 0.5, y);    // right
  ctx.lineTo(x + pxW * 0.5, y + pxD * 0.5); // bottom-right-ish (visual bottom)
  ctx.lineTo(x - pxD, y);                // left
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a circle in iso perspective (ellipse squashed vertically).
 */
function drawIsoCircle(ctx, cx, cy, rx, ry, fill, stroke) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry || rx * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw a pixel-art-style rounded rectangle (for UI or small details).
 */
function drawPixelRect(ctx, x, y, w, h, fill, stroke, r = 2) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = fill;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
  if (stroke) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.strokeRect(Math.floor(x), Math.floor(y), w, h);
  }
  ctx.restore();
}

/* ──────────── furniture item factory ──────────── */
function makeFurniture({ id, name, category, price, rarity, tilesW = 1, tilesD = 1, height = 32, interactable = false, draw }) {
  return {
    id, name, category, price, rarity,
    grid: { w: tilesW, d: tilesD, h: height },
    interactable,
    draw(ctx, x, y, facing = 'SE') {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      draw(ctx, x, y, facing);
      ctx.restore();
    },
  };
}

/* ═══════════════════════════════════════════════════════════════
   CATALOG
   ═══════════════════════════════════════════════════════════════ */

const FurnitureCatalog = {};

/* ──────── SEATING (10 items) ──────── */

FurnitureCatalog.sofa_red = makeFurniture({
  id: 'sofa_red', name: 'Crimson Sofa', category: 'seating', price: 250, rarity: 'Common',
  tilesW: 2, tilesD: 1, height: 36,
  draw(ctx, x, y) {
    const c = {
      top: PAL.sofaRedLight, left: PAL.sofaRed, right: PAL.sofaRedDark, outline: PAL.outline
    };
    drawBlock(ctx, x, y, 2, 1, 36, c);
    // backrest (vertical block at rear)
    drawBlock(ctx, x - ISO.hw, y - ISO.hh * 0.5, 2, 0.4, 28, {
      top: PAL.sofaRedLight, left: PAL.sofaRed, right: PAL.sofaRedDark, outline: PAL.outline
    });
    // cushion lines
    ctx.save();
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - 36 - 4);
    ctx.lineTo(x, y - 4);
    ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.sofa_blue = makeFurniture({
  id: 'sofa_blue', name: 'Ocean Sofa', category: 'seating', price: 250, rarity: 'Common',
  tilesW: 2, tilesD: 1, height: 36,
  draw(ctx, x, y) {
    const c = { top: PAL.sofaBlueLight, left: PAL.sofaBlue, right: PAL.sofaBlueDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 36, c);
    drawBlock(ctx, x - ISO.hw, y - ISO.hh * 0.5, 2, 0.4, 28, c);
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x, y - 4); ctx.stroke(); ctx.restore();
  }
});

FurnitureCatalog.sofa_green = makeFurniture({
  id: 'sofa_green', name: 'Forest Sofa', category: 'seating', price: 250, rarity: 'Common',
  tilesW: 2, tilesD: 1, height: 36,
  draw(ctx, x, y) {
    const c = { top: PAL.sofaGreenLight, left: PAL.sofaGreen, right: PAL.sofaGreenDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 36, c);
    drawBlock(ctx, x - ISO.hw, y - ISO.hh * 0.5, 2, 0.4, 28, c);
  }
});

FurnitureCatalog.sofa_purple = makeFurniture({
  id: 'sofa_purple', name: 'Royal Sofa', category: 'seating', price: 450, rarity: 'Uncommon',
  tilesW: 2, tilesD: 1, height: 38,
  draw(ctx, x, y) {
    const c = { top: PAL.sofaPurpleLight, left: PAL.sofaPurple, right: PAL.sofaPurpleDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 38, c);
    drawBlock(ctx, x - ISO.hw, y - ISO.hh * 0.5, 2, 0.4, 30, c);
    // gold trim
    ctx.save(); ctx.strokeStyle = PAL.goldFrame; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 40, y - 14); ctx.lineTo(x + 40, y - 14); ctx.stroke(); ctx.restore();
  }
});

FurnitureCatalog.sofa_gold = makeFurniture({
  id: 'sofa_gold', name: 'Golden Sofa', category: 'seating', price: 1200, rarity: 'Rare',
  tilesW: 2, tilesD: 1, height: 40,
  draw(ctx, x, y) {
    const c = { top: PAL.sofaGoldLight, left: PAL.sofaGold, right: PAL.sofaGoldDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 40, c);
    drawBlock(ctx, x - ISO.hw, y - ISO.hh * 0.5, 2, 0.4, 32, c);
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 42); ctx.lineTo(x, y - 2); ctx.stroke(); ctx.restore();
  }
});

FurnitureCatalog.armchair_red = makeFurniture({
  id: 'armchair_red', name: 'Crimson Armchair', category: 'seating', price: 150, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 34,
  draw(ctx, x, y) {
    const c = { top: PAL.sofaRedLight, left: PAL.sofaRed, right: PAL.sofaRedDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 34, c);
    drawBlock(ctx, x - ISO.hw * 0.5, y - ISO.hh * 0.25, 1, 0.4, 22, c);
  }
});

FurnitureCatalog.armchair_blue = makeFurniture({
  id: 'armchair_blue', name: 'Ocean Armchair', category: 'seating', price: 150, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 34,
  draw(ctx, x, y) {
    const c = { top: PAL.sofaBlueLight, left: PAL.sofaBlue, right: PAL.sofaBlueDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 34, c);
    drawBlock(ctx, x - ISO.hw * 0.5, y - ISO.hh * 0.25, 1, 0.4, 22, c);
  }
});

FurnitureCatalog.beanbag_pink = makeFurniture({
  id: 'beanbag_pink', name: 'Pink Beanbag', category: 'seating', price: 80, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 18,
  draw(ctx, x, y) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // squashed blob shape
    ctx.fillStyle = '#F48FB1';
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y - 10, 24, 14, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#F8BBD0';
    ctx.beginPath();
    ctx.ellipse(x, y - 16, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.beanbag_teal = makeFurniture({
  id: 'beanbag_teal', name: 'Teal Beanbag', category: 'seating', price: 80, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 18,
  draw(ctx, x, y) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#4DB6AC'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 10, 24, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#80CBC4';
    ctx.beginPath(); ctx.ellipse(x, y - 16, 18, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.bench_wood = makeFurniture({
  id: 'bench_wood', name: 'Wooden Bench', category: 'seating', price: 120, rarity: 'Common',
  tilesW: 2, tilesD: 1, height: 28,
  draw(ctx, x, y) {
    const c = { top: PAL.woodLight, left: PAL.woodMid, right: PAL.woodDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 28, c);
    // seat slats
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(x + i * 16, y - 6); ctx.lineTo(x + i * 16, y - 28); ctx.stroke();
    }
    ctx.restore();
  }
});

FurnitureCatalog.bench_stone = makeFurniture({
  id: 'bench_stone', name: 'Stone Bench', category: 'seating', price: 200, rarity: 'Uncommon',
  tilesW: 2, tilesD: 1, height: 26,
  draw(ctx, x, y) {
    const c = { top: '#CFD8DC', left: '#90A4AE', right: '#546E7A', outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 26, c);
    ctx.save(); ctx.fillStyle = '#B0BEC5'; ctx.fillRect(x - 20, y - 22, 40, 8); ctx.restore();
  }
});

FurnitureCatalog.throne_gold = makeFurniture({
  id: 'throne_gold', name: 'Golden Throne', category: 'seating', price: 2500, rarity: 'Legendary',
  tilesW: 1, tilesD: 1, height: 70,
  draw(ctx, x, y) {
    const gold = { top: PAL.sofaGoldLight, left: PAL.sofaGold, right: PAL.sofaGoldDark, outline: PAL.outline };
    // tall back
    drawBlock(ctx, x - ISO.hw * 0.3, y - ISO.hh * 0.15, 1, 0.3, 60, gold);
    // seat
    drawBlock(ctx, x, y, 1, 1, 24, { top: '#FFF59D', left: PAL.sofaGold, right: PAL.sofaGoldDark, outline: PAL.outline });
    // armrests
    drawBlock(ctx, x - ISO.hw * 0.6, y + ISO.hh * 0.1, 0.3, 0.5, 18, gold);
    drawBlock(ctx, x + ISO.hw * 0.3, y + ISO.hh * 0.1, 0.3, 0.5, 18, gold);
    // crown emblem
    ctx.save(); ctx.fillStyle = PAL.outline;
    ctx.beginPath(); ctx.moveTo(x - 4, y - 58); ctx.lineTo(x, y - 66); ctx.lineTo(x + 4, y - 58); ctx.fill(); ctx.restore();
  }
});

FurnitureCatalog.throne_shadow = makeFurniture({
  id: 'throne_shadow', name: 'Shadow Throne', category: 'seating', price: 3000, rarity: 'Legendary',
  tilesW: 1, tilesD: 1, height: 72,
  draw(ctx, x, y) {
    const dark = { top: '#7B1FA2', left: '#4A148C', right: '#311B92', outline: PAL.outline };
    drawBlock(ctx, x - ISO.hw * 0.3, y - ISO.hh * 0.15, 1, 0.3, 62, dark);
    drawBlock(ctx, x, y, 1, 1, 24, { top: '#9C27B0', left: '#7B1FA2', right: '#4A148C', outline: PAL.outline });
    drawBlock(ctx, x - ISO.hw * 0.6, y + ISO.hh * 0.1, 0.3, 0.5, 18, dark);
    drawBlock(ctx, x + ISO.hw * 0.3, y + ISO.hh * 0.1, 0.3, 0.5, 18, dark);
    // glowing eyes
    ctx.save(); ctx.fillStyle = '#00E676';
    ctx.fillRect(x - 6, y - 50, 4, 4); ctx.fillRect(x + 2, y - 50, 4, 4); ctx.restore();
  }
});

FurnitureCatalog.stool_wood = makeFurniture({
  id: 'stool_wood', name: 'Wooden Stool', category: 'seating', price: 60, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 22,
  draw(ctx, x, y) {
    const c = { top: PAL.woodLight, left: PAL.woodMid, right: PAL.woodDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 22, c);
    // legs suggestion
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 10, y - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + 10, y - 8); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.stool_metal = makeFurniture({
  id: 'stool_metal', name: 'Metal Stool', category: 'seating', price: 80, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 22,
  draw(ctx, x, y) {
    const c = { top: PAL.metal, left: PAL.metalDark, right: '#455A64', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 22, c);
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 10, y - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + 10, y - 8); ctx.stroke();
    ctx.restore();
  }
});

/* ──────── TABLES (10 items) ──────── */

FurnitureCatalog.table_coffee_wood = makeFurniture({
  id: 'table_coffee_wood', name: 'Coffee Table', category: 'tables', price: 180, rarity: 'Common',
  tilesW: 2, tilesD: 1, height: 20,
  draw(ctx, x, y) {
    const c = { top: PAL.woodLight, left: PAL.woodMid, right: PAL.woodDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 20, c);
    // legs
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x - 20, y - 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 20, y); ctx.lineTo(x + 20, y - 6); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.table_coffee_glass = makeFurniture({
  id: 'table_coffee_glass', name: 'Glass Coffee Table', category: 'tables', price: 350, rarity: 'Uncommon',
  tilesW: 2, tilesD: 1, height: 20,
  draw(ctx, x, y) {
    const c = { top: PAL.glass, left: PAL.glassEdge, right: '#01579B', outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 20, c);
    // shine
    ctx.save(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 16, y - 12); ctx.lineTo(x - 8, y - 16); ctx.stroke(); ctx.restore();
  }
});

FurnitureCatalog.table_dining_wood = makeFurniture({
  id: 'table_dining_wood', name: 'Dining Table', category: 'tables', price: 300, rarity: 'Common',
  tilesW: 2, tilesD: 2, height: 28,
  draw(ctx, x, y) {
    const c = { top: PAL.woodLight, left: PAL.woodMid, right: PAL.woodDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 2, 28, c);
    // center leg
    ctx.save(); ctx.fillStyle = PAL.woodDark; ctx.fillRect(x - 4, y - 8, 8, 8); ctx.restore();
  }
});

FurnitureCatalog.table_dining_marble = makeFurniture({
  id: 'table_dining_marble', name: 'Marble Dining Table', category: 'tables', price: 800, rarity: 'Rare',
  tilesW: 2, tilesD: 2, height: 30,
  draw(ctx, x, y) {
    const c = { top: PAL.marble, left: '#EEEEEE', right: '#BDBDBD', outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 2, 30, c);
    // marble vein
    ctx.save(); ctx.strokeStyle = PAL.marbleVein; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 10, y - 20); ctx.lineTo(x + 10, y - 14); ctx.stroke(); ctx.restore();
  }
});

FurnitureCatalog.table_side_wood = makeFurniture({
  id: 'table_side_wood', name: 'Side Table', category: 'tables', price: 100, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 24,
  draw(ctx, x, y) {
    const c = { top: PAL.woodLight, left: PAL.woodMid, right: PAL.woodDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 24, c);
  }
});

FurnitureCatalog.table_side_glass = makeFurniture({
  id: 'table_side_glass', name: 'Glass Side Table', category: 'tables', price: 220, rarity: 'Uncommon',
  tilesW: 1, tilesD: 1, height: 24,
  draw(ctx, x, y) {
    const c = { top: PAL.glass, left: PAL.glassEdge, right: '#01579B', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 24, c);
  }
});

FurnitureCatalog.table_desk_wood = makeFurniture({
  id: 'table_desk_wood', name: 'Wooden Desk', category: 'tables', price: 280, rarity: 'Common',
  tilesW: 2, tilesD: 1, height: 30,
  draw(ctx, x, y) {
    const c = { top: PAL.woodLight, left: PAL.woodMid, right: PAL.woodDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 30, c);
    // drawers suggestion
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 20, y - 14); ctx.lineTo(x - 20, y - 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 20, y - 14); ctx.lineTo(x + 20, y - 26); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.table_desk_metal = makeFurniture({
  id: 'table_desk_metal', name: 'Metal Desk', category: 'tables', price: 320, rarity: 'Uncommon',
  tilesW: 2, tilesD: 1, height: 30,
  draw(ctx, x, y) {
    const c = { top: '#ECEFF1', left: PAL.metal, right: PAL.metalDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 30, c);
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 20, y - 14); ctx.lineTo(x - 20, y - 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 20, y - 14); ctx.lineTo(x + 20, y - 26); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.table_bar = makeFurniture({
  id: 'table_bar', name: 'Bar Counter', category: 'tables', price: 500, rarity: 'Uncommon',
  tilesW: 2, tilesD: 1, height: 38,
  draw(ctx, x, y) {
    const c = { top: PAL.woodLight, left: PAL.woodMid, right: PAL.woodDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 38, c);
    // top shelf
    drawBlock(ctx, x, y - 38, 2, 0.4, 6, { top: '#3E2723', left: '#4E342E', right: '#5D4037', outline: PAL.outline });
    // bottles suggestion
    ctx.save(); ctx.fillStyle = '#EF5350'; ctx.fillRect(x - 16, y - 48, 6, 10); ctx.restore();
    ctx.save(); ctx.fillStyle = '#66BB6A'; ctx.fillRect(x - 6, y - 50, 6, 12); ctx.restore();
    ctx.save(); ctx.fillStyle = '#42A5F5'; ctx.fillRect(x + 6, y - 48, 6, 10); ctx.restore();
  }
});

FurnitureCatalog.table_bar_neon = makeFurniture({
  id: 'table_bar_neon', name: 'Neon Bar Counter', category: 'tables', price: 900, rarity: 'Rare',
  tilesW: 2, tilesD: 1, height: 38,
  draw(ctx, x, y) {
    const c = { top: '#212121', left: '#424242', right: '#000000', outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 38, c);
    // neon strip
    ctx.save(); ctx.strokeStyle = PAL.neonPink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 40, y - 36); ctx.lineTo(x + 40, y - 36); ctx.stroke(); ctx.restore();
    // glow
    ctx.save(); ctx.strokeStyle = PAL.neonCyan; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 40, y - 30); ctx.lineTo(x + 40, y - 30); ctx.stroke(); ctx.restore();
  }
});

/* ──────── BEDS (8 items) ──────── */

FurnitureCatalog.bed_single_white = makeFurniture({
  id: 'bed_single_white', name: 'Single Bed', category: 'beds', price: 300, rarity: 'Common',
  tilesW: 1, tilesD: 2, height: 24,
  draw(ctx, x, y) {
    const c = { top: PAL.bedSheet, left: PAL.bedSheetDark, right: '#64B5F6', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 2, 24, c);
    // headboard
    drawBlock(ctx, x - ISO.hw * 0.8, y - ISO.hh, 1, 0.3, 30, { top: PAL.woodLight, left: PAL.woodMid, right: PAL.woodDark, outline: PAL.outline });
    // pillow
    ctx.save(); ctx.fillStyle = PAL.pillow; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x + 6, y - 6, 10, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
});

FurnitureCatalog.bed_single_red = makeFurniture({
  id: 'bed_single_red', name: 'Crimson Single Bed', category: 'beds', price: 320, rarity: 'Common',
  tilesW: 1, tilesD: 2, height: 24,
  draw(ctx, x, y) {
    const c = { top: '#EF9A9A', left: '#EF5350', right: '#D32F2F', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 2, 24, c);
    drawBlock(ctx, x - ISO.hw * 0.8, y - ISO.hh, 1, 0.3, 30, { top: PAL.woodLight, left: PAL.woodMid, right: PAL.woodDark, outline: PAL.outline });
    ctx.save(); ctx.fillStyle = PAL.pillow; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x + 6, y - 6, 10, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
});

FurnitureCatalog.bed_double_white = makeFurniture({
  id: 'bed_double_white', name: 'Double Bed', category: 'beds', price: 500, rarity: 'Uncommon',
  tilesW: 2, tilesD: 2, height: 26,
  draw(ctx, x, y) {
    const c = { top: PAL.bedSheet, left: PAL.bedSheetDark, right: '#64B5F6', outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 2, 26, c);
    drawBlock(ctx, x - ISO.hw, y - ISO.hh, 2, 0.3, 32, { top: PAL.woodLight, left: PAL.woodMid, right: PAL.woodDark, outline: PAL.outline });
    // two pillows
    ctx.save(); ctx.fillStyle = PAL.pillow; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x - 10, y - 8, 10, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 14, y - 4, 10, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
});

FurnitureCatalog.bed_double_royal = makeFurniture({
  id: 'bed_double_royal', name: 'Royal Double Bed', category: 'beds', price: 1500, rarity: 'Epic',
  tilesW: 2, tilesD: 2, height: 30,
  draw(ctx, x, y) {
    const c = { top: '#E1BEE7', left: '#CE93D8', right: '#AB47BC', outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 2, 30, c);
    drawBlock(ctx, x - ISO.hw, y - ISO.hh, 2, 0.3, 36, { top: PAL.goldFrame, left: '#F9A825', right: '#F57F17', outline: PAL.outline });
    ctx.save(); ctx.fillStyle = '#FFF9C4'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x - 10, y - 8, 10, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 14, y - 4, 10, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    // canopy posts
    ctx.save(); ctx.strokeStyle = PAL.goldFrame; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 32, y - 50); ctx.lineTo(x - 32, y - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 32, y - 50); ctx.lineTo(x + 32, y - 8); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.bed_bunk = makeFurniture({
  id: 'bed_bunk', name: 'Bunk Bed', category: 'beds', price: 600, rarity: 'Uncommon',
  tilesW: 1, tilesD: 2, height: 72,
  draw(ctx, x, y) {
    const c = { top: PAL.bedSheet, left: PAL.bedSheetDark, right: '#64B5F6', outline: PAL.outline };
    // bottom bunk
    drawBlock(ctx, x, y, 1, 2, 24, c);
    // top bunk (elevated)
    drawBlock(ctx, x, y - 36, 1, 2, 24, c);
    // ladder
    ctx.save(); ctx.strokeStyle = PAL.metalDark; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 12, y); ctx.lineTo(x + 12, y - 48); ctx.stroke();
    // rungs
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(x + 8, y - i * 10); ctx.lineTo(x + 16, y - i * 10); ctx.stroke();
    }
    ctx.restore();
    // posts
    ctx.save(); ctx.strokeStyle = PAL.woodDark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x - 12, y - 60); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 20, y); ctx.lineTo(x + 20, y - 60); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.bed_hammock_blue = makeFurniture({
  id: 'bed_hammock_blue', name: 'Blue Hammock', category: 'beds', price: 350, rarity: 'Uncommon',
  tilesW: 2, tilesD: 1, height: 28,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // posts
    ctx.strokeStyle = PAL.woodDark; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 40, y); ctx.lineTo(x - 40, y - 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 40, y); ctx.lineTo(x + 40, y - 40); ctx.stroke();
    // hammock curve
    ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.fillStyle = '#90CAF9';
    ctx.beginPath();
    ctx.moveTo(x - 40, y - 36);
    ctx.quadraticCurveTo(x, y - 8, x + 40, y - 36);
    ctx.quadraticCurveTo(x, y - 16, x - 40, y - 36);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.bed_hammock_rainbow = makeFurniture({
  id: 'bed_hammock_rainbow', name: 'Rainbow Hammock', category: 'beds', price: 800, rarity: 'Rare',
  tilesW: 2, tilesD: 1, height: 28,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = PAL.woodDark; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 40, y); ctx.lineTo(x - 40, y - 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 40, y); ctx.lineTo(x + 40, y - 40); ctx.stroke();
    const colors = ['#EF5350', '#FF9800', '#FFEB3B', '#66BB6A', '#42A5F5', '#AB47BC'];
    for (let i = 0; i < colors.length; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      const off = (i - 2.5) * 6;
      ctx.moveTo(x - 40 + i * 2, y - 36 + i);
      ctx.quadraticCurveTo(x, y - 8 + off, x + 40 - i * 2, y - 36 + i);
      ctx.quadraticCurveTo(x, y - 14 + off, x - 40 + i * 2, y - 36 + i);
      ctx.fill(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  }
});

FurnitureCatalog.bed_futon = makeFurniture({
  id: 'bed_futon', name: 'Floor Futon', category: 'beds', price: 200, rarity: 'Common',
  tilesW: 1, tilesD: 2, height: 8,
  draw(ctx, x, y) {
    const c = { top: '#FFECB3', left: '#FFE082', right: '#FFD54F', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 2, 8, c);
    ctx.save(); ctx.fillStyle = '#FFF8E1'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x + 6, y - 4, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
});

/* ──────── STORAGE (8 items) ──────── */

FurnitureCatalog.wardrobe_wood = makeFurniture({
  id: 'wardrobe_wood', name: 'Wooden Wardrobe', category: 'storage', price: 280, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 64,
  draw(ctx, x, y) {
    const c = { top: PAL.cabinetBody, left: PAL.woodMid, right: PAL.woodDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 64, c);
    // doors
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x, y - 58); ctx.stroke();
    // knobs
    ctx.fillStyle = PAL.goldFrame;
    ctx.fillRect(x - 4, y - 24, 3, 3); ctx.fillRect(x + 2, y - 24, 3, 3);
    ctx.restore();
  }
});

FurnitureCatalog.wardrobe_modern = makeFurniture({
  id: 'wardrobe_modern', name: 'Modern Wardrobe', category: 'storage', price: 400, rarity: 'Uncommon',
  tilesW: 1, tilesD: 1, height: 64,
  draw(ctx, x, y) {
    const c = { top: '#FFFFFF', left: '#ECEFF1', right: '#CFD8DC', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 64, c);
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x, y - 58); ctx.stroke();
    ctx.fillStyle = PAL.metal;
    ctx.fillRect(x - 4, y - 24, 3, 3); ctx.fillRect(x + 2, y - 24, 3, 3); ctx.restore();
  }
});

FurnitureCatalog.chest_wood = makeFurniture({
  id: 'chest_wood', name: 'Wooden Chest', category: 'storage', price: 180, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 28,
  draw(ctx, x, y) {
    const c = { top: PAL.chestWood, left: '#4E342E', right: '#3E2723', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 28, c);
    // lid line
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 20, y - 14); ctx.lineTo(x + 20, y - 14); ctx.stroke();
    ctx.fillStyle = PAL.chestGold;
    ctx.beginPath(); ctx.arc(x, y - 14, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
});

FurnitureCatalog.chest_gold = makeFurniture({
  id: 'chest_gold', name: 'Golden Chest', category: 'storage', price: 800, rarity: 'Rare',
  tilesW: 1, tilesD: 1, height: 28,
  draw(ctx, x, y) {
    const c = { top: PAL.chestGold, left: '#F9A825', right: '#F57F17', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 28, c);
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 20, y - 14); ctx.lineTo(x + 20, y - 14); ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(x, y - 14, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
});

FurnitureCatalog.bookshelf_wood = makeFurniture({
  id: 'bookshelf_wood', name: 'Bookshelf', category: 'storage', price: 220, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 56,
  draw(ctx, x, y) {
    const c = { top: PAL.cabinetBody, left: PAL.woodMid, right: PAL.woodDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 56, c);
    // shelves
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const sy = y - i * 14;
      ctx.beginPath(); ctx.moveTo(x - 22, sy); ctx.lineTo(x + 22, sy); ctx.stroke();
      // books
      const colors = ['#EF5350', '#42A5F5', '#66BB6A', '#FFEE58', '#AB47BC'];
      for (let b = 0; b < 4; b++) {
        ctx.fillStyle = colors[(i + b) % colors.length];
        ctx.fillRect(x - 18 + b * 10, sy - 10, 8, 10);
        ctx.strokeStyle = PAL.outline; ctx.strokeRect(x - 18 + b * 10, sy - 10, 8, 10);
      }
    }
    ctx.restore();
  }
});

FurnitureCatalog.bookshelf_tall = makeFurniture({
  id: 'bookshelf_tall', name: 'Tall Bookshelf', category: 'storage', price: 320, rarity: 'Uncommon',
  tilesW: 1, tilesD: 1, height: 80,
  draw(ctx, x, y) {
    const c = { top: PAL.cabinetBody, left: PAL.woodMid, right: PAL.woodDark, outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 80, c);
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const sy = y - i * 18;
      ctx.beginPath(); ctx.moveTo(x - 22, sy); ctx.lineTo(x + 22, sy); ctx.stroke();
      const colors = ['#EF5350', '#42A5F5', '#66BB6A', '#FFEE58'];
      for (let b = 0; b < 4; b++) {
        ctx.fillStyle = colors[(i + b) % colors.length];
        ctx.fillRect(x - 18 + b * 10, sy - 12, 8, 12);
        ctx.strokeRect(x - 18 + b * 10, sy - 12, 8, 12);
      }
    }
    ctx.restore();
  }
});

FurnitureCatalog.cabinet_kitchen = makeFurniture({
  id: 'cabinet_kitchen', name: 'Kitchen Cabinet', category: 'storage', price: 260, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 32,
  draw(ctx, x, y) {
    const c = { top: '#FFFFFF', left: '#ECEFF1', right: '#CFD8DC', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 32, c);
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y - 30); ctx.stroke();
    ctx.fillStyle = PAL.metal;
    ctx.fillRect(x - 4, y - 18, 3, 3); ctx.fillRect(x + 2, y - 18, 3, 3); ctx.restore();
  }
});

FurnitureCatalog.cabinet_tool = makeFurniture({
  id: 'cabinet_tool', name: 'Tool Cabinet', category: 'storage', price: 240, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 36,
  draw(ctx, x, y) {
    const c = { top: PAL.metal, left: '#546E7A', right: '#37474F', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 36, c);
    ctx.save(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y - 34); ctx.stroke();
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x - 2, y - 20, 4, 4); ctx.restore();
  }
});

/* ──────── ELECTRONICS (8 items) ──────── */

FurnitureCatalog.tv_flatscreen = makeFurniture({
  id: 'tv_flatscreen', name: 'Flatscreen TV', category: 'electronics', price: 600, rarity: 'Uncommon',
  tilesW: 2, tilesD: 1, height: 40,
  draw(ctx, x, y) {
    const c = { top: PAL.plastic, left: PAL.plasticLight, right: PAL.plastic, outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 12, c); // stand
    // screen
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.screenOff; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    const sx = x - 28, sy = y - 44, sw = 56, sh = 32;
    ctx.fillRect(sx, sy, sw, sh); ctx.strokeRect(sx, sy, sw, sh);
    // glow if on (handled via state elsewhere; draw a standby dot)
    ctx.fillStyle = '#00E676';
    ctx.fillRect(x + 20, y - 14, 3, 3);
    ctx.restore();
  }
});

FurnitureCatalog.tv_retro = makeFurniture({
  id: 'tv_retro', name: 'Retro TV', category: 'electronics', price: 450, rarity: 'Uncommon',
  tilesW: 1, tilesD: 1, height: 36,
  draw(ctx, x, y) {
    const c = { top: '#795548', left: '#5D4037', right: '#4E342E', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 28, c);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#9E9E9E'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 14, y - 36, 28, 20); ctx.strokeRect(x - 14, y - 36, 28, 20);
    ctx.fillStyle = PAL.screenOff;
    ctx.fillRect(x - 10, y - 34, 20, 14); ctx.strokeRect(x - 10, y - 34, 20, 14);
    // antenna
    ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 36); ctx.lineTo(x - 6, y - 48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 36); ctx.lineTo(x + 6, y - 48); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.computer_desktop = makeFurniture({
  id: 'computer_desktop', name: 'Desktop Computer', category: 'electronics', price: 550, rarity: 'Uncommon',
  tilesW: 1, tilesD: 1, height: 36,
  draw(ctx, x, y) {
    const c = { top: PAL.plasticLight, left: PAL.plastic, right: '#263238', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 14, c); // base
    // tower
    drawBlock(ctx, x - 10, y - 4, 0.35, 0.5, 28, c);
    // monitor
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.plastic; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 10, y - 36, 20, 18); ctx.strokeRect(x - 10, y - 36, 20, 18);
    ctx.fillStyle = '#81D4FA';
    ctx.fillRect(x - 8, y - 34, 16, 12);
    // keyboard
    ctx.fillStyle = PAL.plasticLight;
    ctx.fillRect(x - 12, y - 14, 24, 6); ctx.strokeRect(x - 12, y - 14, 24, 6);
    ctx.restore();
  }
});

FurnitureCatalog.computer_gaming = makeFurniture({
  id: 'computer_gaming', name: 'Gaming Rig', category: 'electronics', price: 1200, rarity: 'Rare',
  tilesW: 1, tilesD: 1, height: 44,
  draw(ctx, x, y) {
    const c = { top: '#212121', left: '#424242', right: '#000000', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 14, c);
    // RGB tower
    drawBlock(ctx, x - 12, y - 4, 0.4, 0.5, 34, c);
    ctx.save(); ctx.fillStyle = PAL.neonPink; ctx.fillRect(x - 10, y - 30, 3, 6); ctx.restore();
    ctx.save(); ctx.fillStyle = PAL.neonCyan; ctx.fillRect(x - 10, y - 20, 3, 6); ctx.restore();
    // curved monitor
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#212121'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 2, y - 44, 16, 22); ctx.strokeRect(x - 2, y - 44, 16, 22);
    ctx.fillStyle = '#69F0AE';
    ctx.fillRect(x, y - 42, 12, 16);
    ctx.restore();
  }
});

FurnitureCatalog.stereo = makeFurniture({
  id: 'stereo', name: 'Stereo System', category: 'electronics', price: 350, rarity: 'Uncommon',
  tilesW: 1, tilesD: 1, height: 24,
  draw(ctx, x, y) {
    const c = { top: PAL.plasticLight, left: PAL.plastic, right: '#263238', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 12, c); // main unit
    // speakers
    drawBlock(ctx, x - 18, y - 2, 0.4, 0.4, 20, c);
    drawBlock(ctx, x + 14, y - 2, 0.4, 0.4, 20, c);
    ctx.save(); ctx.fillStyle = '#212121'; ctx.fillRect(x - 16, y - 16, 10, 10); ctx.fillRect(x + 14, y - 16, 10, 10);
    ctx.fillStyle = '#757575'; ctx.beginPath(); ctx.arc(x - 11, y - 11, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 19, y - 11, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
});

FurnitureCatalog.arcade_machine = makeFurniture({
  id: 'arcade_machine', name: 'Arcade Machine', category: 'electronics', price: 900, rarity: 'Rare',
  tilesW: 1, tilesD: 1, height: 64,
  draw(ctx, x, y) {
    const body = { top: '#D32F2F', left: '#B71C1C', right: '#7F0000', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 64, body);
    // screen area
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#212121'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 14, y - 56, 28, 28); ctx.strokeRect(x - 14, y - 56, 28, 28);
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(x - 10, y - 52, 20, 18);
    // joystick
    ctx.fillStyle = '#424242';
    ctx.beginPath(); ctx.arc(x - 6, y - 24, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = PAL.outline; ctx.beginPath(); ctx.moveTo(x - 6, y - 24); ctx.lineTo(x - 6, y - 32); ctx.stroke();
    ctx.beginPath(); ctx.arc(x - 6, y - 32, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // buttons
    ctx.fillStyle = '#FFEB3B'; ctx.beginPath(); ctx.arc(x + 6, y - 26, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#00E676'; ctx.beginPath(); ctx.arc(x + 12, y - 24, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.jukebox = makeFurniture({
  id: 'jukebox', name: 'Jukebox', category: 'electronics', price: 1100, rarity: 'Rare',
  tilesW: 1, tilesD: 1, height: 60,
  draw(ctx, x, y) {
    const body = { top: '#D32F2F', left: '#C62828', right: '#B71C1C', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 60, body);
    // dome
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#B3E5FC'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 58, 18, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // bubbles
    ctx.fillStyle = '#E1F5FE';
    ctx.beginPath(); ctx.arc(x - 6, y - 60, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 6, y - 58, 3, 0, Math.PI * 2); ctx.fill();
    // speaker grill
    ctx.fillStyle = '#212121';
    ctx.fillRect(x - 12, y - 40, 24, 20); ctx.strokeRect(x - 12, y - 40, 24, 20);
    // selection panel
    ctx.fillStyle = '#FFEB3B';
    ctx.fillRect(x - 8, y - 18, 16, 8); ctx.strokeRect(x - 8, y - 18, 16, 8);
    ctx.restore();
  }
});

FurnitureCatalog.laptop = makeFurniture({
  id: 'laptop', name: 'Laptop', category: 'electronics', price: 400, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 8,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#B0BEC5'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    // base
    ctx.fillRect(x - 14, y - 4, 28, 6); ctx.strokeRect(x - 14, y - 4, 28, 6);
    // screen lid
    ctx.fillStyle = '#455A64';
    ctx.fillRect(x - 12, y - 18, 24, 16); ctx.strokeRect(x - 12, y - 18, 24, 16);
    ctx.fillStyle = '#81D4FA';
    ctx.fillRect(x - 10, y - 16, 20, 12);
    ctx.restore();
  }
});

/* ──────── LIGHTING (8 items) ──────── */

FurnitureCatalog.lamp_floor = makeFurniture({
  id: 'lamp_floor', name: 'Floor Lamp', category: 'lighting', price: 150, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 56,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // base
    ctx.fillStyle = PAL.metalDark; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 4, 14, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // pole
    ctx.strokeStyle = PAL.metal; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x, y - 48); ctx.stroke();
    // shade
    ctx.fillStyle = PAL.lampShade; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 48); ctx.lineTo(x + 14, y - 48);
    ctx.lineTo(x + 10, y - 64); ctx.lineTo(x - 10, y - 64); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // bulb glow
    ctx.fillStyle = PAL.lampGlow;
    ctx.beginPath(); ctx.arc(x, y - 52, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
});

FurnitureCatalog.lamp_table = makeFurniture({
  id: 'lamp_table', name: 'Table Lamp', category: 'lighting', price: 100, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 28,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.metalDark; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = PAL.metal; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y - 18); ctx.stroke();
    ctx.fillStyle = '#FFF9C4'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 18); ctx.lineTo(x + 10, y - 18);
    ctx.lineTo(x + 8, y - 28); ctx.lineTo(x - 8, y - 28); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.lampGlow; ctx.beginPath(); ctx.arc(x, y - 20, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
});

FurnitureCatalog.lamp_neon_pink = makeFurniture({
  id: 'lamp_neon_pink', name: 'Neon Pink Lamp', category: 'lighting', price: 350, rarity: 'Uncommon',
  tilesW: 1, tilesD: 1, height: 36,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#212121'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = PAL.neonPink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y - 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 8, y - 18); ctx.lineTo(x + 8, y - 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 8, y - 18); ctx.lineTo(x - 12, y - 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 8, y - 18); ctx.lineTo(x + 12, y - 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 12, y - 30); ctx.lineTo(x + 12, y - 30); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.chandelier_small = makeFurniture({
  id: 'chandelier_small', name: 'Small Chandelier', category: 'lighting', price: 600, rarity: 'Rare',
  tilesW: 1, tilesD: 1, height: 48,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // chain
    ctx.strokeStyle = PAL.goldFrame; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 48); ctx.lineTo(x, y - 36); ctx.stroke();
    // body
    ctx.fillStyle = PAL.goldFrame; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - 30, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // arms
    ctx.beginPath(); ctx.moveTo(x - 18, y - 24); ctx.lineTo(x, y - 30); ctx.lineTo(x + 18, y - 24); ctx.stroke();
    // candles
    ctx.fillStyle = PAL.candleWax;
    ctx.fillRect(x - 20, y - 28, 4, 8); ctx.strokeRect(x - 20, y - 28, 4, 8);
    ctx.fillRect(x + 16, y - 28, 4, 8); ctx.strokeRect(x + 16, y - 28, 4, 8);
    // flames
    ctx.fillStyle = PAL.candleFlame;
    ctx.beginPath(); ctx.ellipse(x - 18, y - 32, 2, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 18, y - 32, 2, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
});

FurnitureCatalog.chandelier_grand = makeFurniture({
  id: 'chandelier_grand', name: 'Grand Chandelier', category: 'lighting', price: 1800, rarity: 'Epic',
  tilesW: 2, tilesD: 2, height: 64,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = PAL.goldFrame; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 64); ctx.lineTo(x, y - 48); ctx.stroke();
    ctx.fillStyle = PAL.goldFrame; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - 40, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 4 arms
    const arms = [[-30, -20], [30, -20], [-18, -10], [18, -10]];
    arms.forEach(([dx, dy]) => {
      ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(x, y - 40); ctx.stroke();
      ctx.fillStyle = PAL.candleWax;
      ctx.fillRect(x + dx - 2, y + dy - 8, 4, 8); ctx.strokeRect(x + dx - 2, y + dy - 8, 4, 8);
      ctx.fillStyle = PAL.candleFlame;
      ctx.beginPath(); ctx.ellipse(x + dx, y + dy - 12, 2, 4, 0, 0, Math.PI * 2); ctx.fill();
    });
    // crystals
    ctx.fillStyle = '#B3E5FC';
    for (let i = 0; i < 6; i++) {
      const cx = x + (Math.random() - 0.5) * 30;
      const cy = y - 30 + (Math.random() - 0.5) * 10;
      ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
});

FurnitureCatalog.neon_sign_star = makeFurniture({
  id: 'neon_sign_star', name: 'Neon Star Sign', category: 'lighting', price: 500, rarity: 'Rare',
  tilesW: 1, tilesD: 1, height: 40,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = PAL.neonPink; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y - 40); ctx.lineTo(x + 4, y - 30); ctx.lineTo(x + 14, y - 30);
    ctx.lineTo(x + 6, y - 24); ctx.lineTo(x + 10, y - 14);
    ctx.lineTo(x, y - 20); ctx.lineTo(x - 10, y - 14);
    ctx.lineTo(x - 6, y - 24); ctx.lineTo(x - 14, y - 30);
    ctx.lineTo(x - 4, y - 30); ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = '#FF80AB'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.neon_sign_moon = makeFurniture({
  id: 'neon_sign_moon', name: 'Neon Moon Sign', category: 'lighting', price: 500, rarity: 'Rare',
  tilesW: 1, tilesD: 1, height: 40,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = PAL.neonCyan; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y - 26, 14, Math.PI * 0.2, Math.PI * 1.3);
    ctx.stroke();
    ctx.strokeStyle = '#80DEEA'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.candle_holder = makeFurniture({
  id: 'candle_holder', name: 'Candle Holder', category: 'lighting', price: 60, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 16,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.metal; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 2, 8, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.candleWax;
    ctx.fillRect(x - 3, y - 12, 6, 10); ctx.strokeRect(x - 3, y - 12, 6, 10);
    ctx.fillStyle = PAL.candleFlame;
    ctx.beginPath(); ctx.ellipse(x, y - 16, 2, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
});

/* ──────── PLANTS (8 items) ──────── */

FurnitureCatalog.plant_potted_small = makeFurniture({
  id: 'plant_potted_small', name: 'Small Potted Plant', category: 'plants', price: 80, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 24,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // pot
    ctx.fillStyle = PAL.potTerracotta; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 10, y - 8); ctx.lineTo(x + 10, y - 8);
    ctx.lineTo(x + 8, y - 2); ctx.lineTo(x - 8, y - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    // leaves
    ctx.fillStyle = PAL.leafMid;
    ctx.beginPath(); ctx.ellipse(x - 4, y - 14, 5, 8, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 4, y - 14, 5, 8, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.leafLight;
    ctx.beginPath(); ctx.ellipse(x, y - 20, 4, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.plant_potted_large = makeFurniture({
  id: 'plant_potted_large', name: 'Large Potted Plant', category: 'plants', price: 150, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 48,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.potCeramic; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 12, y - 10); ctx.lineTo(x + 12, y - 10);
    ctx.lineTo(x + 10, y - 2); ctx.lineTo(x - 10, y - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    // trunk
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(x - 3, y - 34, 6, 24); ctx.strokeRect(x - 3, y - 34, 6, 24);
    // canopy
    ctx.fillStyle = PAL.leafDark;
    ctx.beginPath(); ctx.arc(x, y - 40, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.leafMid;
    ctx.beginPath(); ctx.arc(x - 6, y - 36, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 6, y - 36, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.plant_hanging = makeFurniture({
  id: 'plant_hanging', name: 'Hanging Plant', category: 'plants', price: 120, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 40,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // hook / chain
    ctx.strokeStyle = PAL.metal; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x, y - 28); ctx.stroke();
    // pot
    ctx.fillStyle = PAL.potCeramic; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 24, 10, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // trailing leaves
    ctx.fillStyle = PAL.leafMid;
    ctx.beginPath(); ctx.ellipse(x - 6, y - 14, 4, 8, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 6, y - 12, 4, 9, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y - 10, 4, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.plant_tree_palm = makeFurniture({
  id: 'plant_tree_palm', name: 'Palm Tree', category: 'plants', price: 500, rarity: 'Uncommon',
  tilesW: 1, tilesD: 1, height: 96,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // trunk
    ctx.fillStyle = '#8D6E63'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 4, y - 70, 8, 68); ctx.strokeRect(x - 4, y - 70, 8, 68);
    // fronds
    const fronds = [-0.6, -0.3, 0, 0.3, 0.6];
    fronds.forEach((angle, i) => {
      ctx.fillStyle = i % 2 === 0 ? PAL.leafDark : PAL.leafMid;
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(angle) * 20, y - 72 + Math.cos(angle) * 6, 18, 5, angle, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    });
    ctx.restore();
  }
});

FurnitureCatalog.plant_flower_red = makeFurniture({
  id: 'plant_flower_red', name: 'Red Flower Pot', category: 'plants', price: 90, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 20,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.potTerracotta; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 4, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.leafMid;
    ctx.beginPath(); ctx.ellipse(x - 3, y - 10, 4, 6, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 3, y - 10, 4, 6, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.flowerRed;
    ctx.beginPath(); ctx.arc(x, y - 16, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFEB3B';
    ctx.beginPath(); ctx.arc(x, y - 16, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
});

FurnitureCatalog.plant_flower_blue = makeFurniture({
  id: 'plant_flower_blue', name: 'Blue Flower Pot', category: 'plants', price: 90, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 20,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.potCeramic; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 4, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.leafMid;
    ctx.beginPath(); ctx.ellipse(x - 3, y - 10, 4, 6, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 3, y - 10, 4, 6, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.flowerBlue;
    ctx.beginPath(); ctx.arc(x, y - 16, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFEB3B';
    ctx.beginPath(); ctx.arc(x, y - 16, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
});

FurnitureCatalog.plant_cactus = makeFurniture({
  id: 'plant_cactus', name: 'Cactus', category: 'plants', price: 110, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 32,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.potTerracotta; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 4, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.leafLight; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    // main body
    ctx.fillRect(x - 6, y - 30, 12, 26); ctx.strokeRect(x - 6, y - 30, 12, 26);
    // arm
    ctx.fillRect(x + 6, y - 22, 8, 6); ctx.strokeRect(x + 6, y - 22, 8, 6);
    ctx.fillRect(x + 6, y - 28, 6, 8); ctx.strokeRect(x + 6, y - 28, 6, 8);
    // spikes
    ctx.fillStyle = PAL.outline;
    ctx.fillRect(x - 2, y - 26, 1, 1); ctx.fillRect(x + 2, y - 22, 1, 1);
    ctx.fillRect(x - 3, y - 18, 1, 1); ctx.fillRect(x + 3, y - 14, 1, 1);
    ctx.restore();
  }
});

FurnitureCatalog.plant_bonsai = makeFurniture({
  id: 'plant_bonsai', name: 'Bonsai Tree', category: 'plants', price: 400, rarity: 'Uncommon',
  tilesW: 1, tilesD: 1, height: 28,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // tray
    ctx.fillStyle = '#5D4037'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 2, 14, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // trunk
    ctx.fillStyle = '#6D4C41';
    ctx.fillRect(x - 2, y - 14, 4, 12); ctx.strokeRect(x - 2, y - 14, 4, 12);
    // foliage
    ctx.fillStyle = PAL.leafDark;
    ctx.beginPath(); ctx.arc(x - 6, y - 18, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 6, y - 16, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y - 24, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

/* ──────── DECORATIONS (10 items) ──────── */

FurnitureCatalog.painting_landscape = makeFurniture({
  id: 'painting_landscape', name: 'Landscape Painting', category: 'decorations', price: 200, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 32,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // easel / wall mount look (leaning)
    ctx.fillStyle = PAL.goldFrame; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 14, y - 32, 28, 24); ctx.strokeRect(x - 14, y - 32, 28, 24);
    ctx.fillStyle = '#81D4FA'; // sky
    ctx.fillRect(x - 12, y - 30, 24, 10);
    ctx.fillStyle = PAL.leafMid; // hill
    ctx.beginPath(); ctx.moveTo(x - 12, y - 20); ctx.lineTo(x + 12, y - 20); ctx.lineTo(x, y - 26); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
});

FurnitureCatalog.painting_portrait = makeFurniture({
  id: 'painting_portrait', name: 'Royal Portrait', category: 'decorations', price: 350, rarity: 'Uncommon',
  tilesW: 1, tilesD: 1, height: 36,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.goldFrame; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 10, y - 36, 20, 28); ctx.strokeRect(x - 10, y - 36, 20, 28);
    ctx.fillStyle = '#1A237E';
    ctx.fillRect(x - 8, y - 34, 16, 20);
    // face silhouette
    ctx.fillStyle = '#FFCC80';
    ctx.beginPath(); ctx.arc(x, y - 26, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
});

FurnitureCatalog.rug_red = makeFurniture({
  id: 'rug_red', name: 'Red Rug', category: 'decorations', price: 120, rarity: 'Common',
  tilesW: 2, tilesD: 2, height: 2,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.rugRed; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    // flat iso rectangle
    ctx.beginPath();
    ctx.moveTo(x, y - ISO.hh);
    ctx.lineTo(x + ISO.tw, y);
    ctx.lineTo(x, y + ISO.hh);
    ctx.lineTo(x - ISO.tw, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // border
    ctx.strokeStyle = PAL.rugBorder; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - ISO.hh + 2);
    ctx.lineTo(x + ISO.tw - 4, y - 2);
    ctx.lineTo(x, y + ISO.hh - 2);
    ctx.lineTo(x - ISO.tw + 4, y + 2);
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.rug_blue = makeFurniture({
  id: 'rug_blue', name: 'Blue Rug', category: 'decorations', price: 120, rarity: 'Common',
  tilesW: 2, tilesD: 2, height: 2,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.rugBlue; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - ISO.hh);
    ctx.lineTo(x + ISO.tw, y);
    ctx.lineTo(x, y + ISO.hh);
    ctx.lineTo(x - ISO.tw, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = PAL.rugPattern; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x + 20, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.rug_royal = makeFurniture({
  id: 'rug_royal', name: 'Royal Rug', category: 'decorations', price: 600, rarity: 'Rare',
  tilesW: 3, tilesD: 3, height: 2,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    const w = 3, d = 3;
    ctx.fillStyle = '#4A148C'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - d * ISO.hh);
    ctx.lineTo(x + w * ISO.hw, y);
    ctx.lineTo(x, y + d * ISO.hh);
    ctx.lineTo(x - w * ISO.hw, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // gold pattern
    ctx.strokeStyle = PAL.goldFrame; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = PAL.goldFrame;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
});

FurnitureCatalog.mirror_gold = makeFurniture({
  id: 'mirror_gold', name: 'Gold Mirror', category: 'decorations', price: 400, rarity: 'Uncommon',
  tilesW: 1, tilesD: 1, height: 48,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // stand
    ctx.fillStyle = PAL.woodDark; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 2, y - 10, 4, 10); ctx.strokeRect(x - 2, y - 10, 4, 10);
    ctx.beginPath(); ctx.ellipse(x, y - 2, 12, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // frame
    ctx.fillStyle = PAL.goldFrame; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 28, 14, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // glass
    ctx.fillStyle = PAL.mirrorGlass;
    ctx.beginPath(); ctx.ellipse(x, y - 28, 10, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.fountain_small = makeFurniture({
  id: 'fountain_small', name: 'Small Fountain', category: 'decorations', price: 800, rarity: 'Rare',
  tilesW: 2, tilesD: 2, height: 36,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // basin
    const c = { top: PAL.fountainStone, left: '#607D8B', right: '#455A64', outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 2, 12, c);
    // pedestal
    drawBlock(ctx, x, y - 10, 0.5, 0.5, 14, c);
    // top bowl
    drawBlock(ctx, x, y - 22, 0.8, 0.8, 8, c);
    // water
    ctx.fillStyle = PAL.fountainWater;
    ctx.beginPath(); ctx.ellipse(x, y - 6, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y - 24, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    // spray
    ctx.strokeStyle = '#B3E5FC'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x - 4, y - 36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x + 4, y - 36); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.statue_angel = makeFurniture({
  id: 'statue_angel', name: 'Angel Statue', category: 'decorations', price: 1200, rarity: 'Epic',
  tilesW: 1, tilesD: 1, height: 48,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // pedestal
    ctx.fillStyle = PAL.statueStone; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 10, y - 10, 20, 10); ctx.strokeRect(x - 10, y - 10, 20, 10);
    // body
    ctx.fillStyle = '#ECEFF1';
    ctx.fillRect(x - 6, y - 30, 12, 22); ctx.strokeRect(x - 6, y - 30, 12, 22);
    // head
    ctx.beginPath(); ctx.arc(x, y - 36, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // wings
    ctx.fillStyle = '#CFD8DC';
    ctx.beginPath(); ctx.ellipse(x - 12, y - 30, 8, 14, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + 12, y - 30, 8, 14, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.statue_gold = makeFurniture({
  id: 'statue_gold', name: 'Gold Statue', category: 'decorations', price: 2000, rarity: 'Legendary',
  tilesW: 1, tilesD: 1, height: 52,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.goldFrame; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 12, y - 12, 24, 12); ctx.strokeRect(x - 12, y - 12, 24, 12);
    ctx.fillRect(x - 8, y - 36, 16, 26); ctx.strokeRect(x - 8, y - 36, 16, 26);
    ctx.beginPath(); ctx.arc(x, y - 42, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // crown
    ctx.fillStyle = '#D32F2F';
    ctx.beginPath(); ctx.moveTo(x - 8, y - 48); ctx.lineTo(x - 4, y - 56); ctx.lineTo(x, y - 50);
    ctx.lineTo(x + 4, y - 56); ctx.lineTo(x + 8, y - 48); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.trophy_gold = makeFurniture({
  id: 'trophy_gold', name: 'Gold Trophy', category: 'decorations', price: 1500, rarity: 'Rare',
  tilesW: 1, tilesD: 1, height: 28,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.trophyGold; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    // base
    ctx.fillRect(x - 8, y - 6, 16, 6); ctx.strokeRect(x - 8, y - 6, 16, 6);
    // stem
    ctx.fillRect(x - 3, y - 14, 6, 10); ctx.strokeRect(x - 3, y - 14, 6, 10);
    // cup
    ctx.beginPath(); ctx.moveTo(x - 10, y - 14); ctx.lineTo(x + 10, y - 14);
    ctx.quadraticCurveTo(x + 10, y - 28, x, y - 28);
    ctx.quadraticCurveTo(x - 10, y - 28, x - 10, y - 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.trophy_silver = makeFurniture({
  id: 'trophy_silver', name: 'Silver Trophy', category: 'decorations', price: 1000, rarity: 'Uncommon',
  tilesW: 1, tilesD: 1, height: 28,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.trophySilver; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 8, y - 6, 16, 6); ctx.strokeRect(x - 8, y - 6, 16, 6);
    ctx.fillRect(x - 3, y - 14, 6, 10); ctx.strokeRect(x - 3, y - 14, 6, 10);
    ctx.beginPath(); ctx.moveTo(x - 10, y - 14); ctx.lineTo(x + 10, y - 14);
    ctx.quadraticCurveTo(x + 10, y - 28, x, y - 28);
    ctx.quadraticCurveTo(x - 10, y - 28, x - 10, y - 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

/* ──────── OUTDOOR (8 items) ──────── */

FurnitureCatalog.outdoor_bench = makeFurniture({
  id: 'outdoor_bench', name: 'Park Bench', category: 'outdoor', price: 180, rarity: 'Common',
  tilesW: 2, tilesD: 1, height: 28,
  draw(ctx, x, y) {
    const c = { top: '#A1887F', left: '#8D6E63', right: '#6D4C41', outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 28, c);
    // iron legs suggestion
    ctx.save(); ctx.strokeStyle = '#37474F'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x - 20, y - 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 20, y); ctx.lineTo(x + 20, y - 6); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.umbrella_red = makeFurniture({
  id: 'umbrella_red', name: 'Red Beach Umbrella', category: 'outdoor', price: 250, rarity: 'Common',
  tilesW: 2, tilesD: 2, height: 56,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // pole
    ctx.strokeStyle = PAL.woodDark; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 48); ctx.stroke();
    // canopy (red/white stripes)
    const colors = [PAL.umbrellaRed, PAL.umbrellaWhite];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = colors[i % 2];
      ctx.beginPath();
      const a1 = (Math.PI * i) / 6;
      const a2 = (Math.PI * (i + 1)) / 6;
      ctx.moveTo(x, y - 48);
      ctx.lineTo(x + Math.cos(a1) * 28, y - 48 + Math.sin(a1) * 10);
      ctx.lineTo(x + Math.cos(a2) * 28, y - 48 + Math.sin(a2) * 10);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  }
});

FurnitureCatalog.umbrella_rainbow = makeFurniture({
  id: 'umbrella_rainbow', name: 'Rainbow Umbrella', category: 'outdoor', price: 400, rarity: 'Uncommon',
  tilesW: 2, tilesD: 2, height: 56,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = PAL.woodDark; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 48); ctx.stroke();
    const colors = ['#EF5350', '#FF9800', '#FFEB3B', '#66BB6A', '#42A5F5', '#AB47BC'];
    for (let i = 0; i < colors.length; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      const a1 = (Math.PI * i) / colors.length;
      const a2 = (Math.PI * (i + 1)) / colors.length;
      ctx.moveTo(x, y - 48);
      ctx.lineTo(x + Math.cos(a1) * 28, y - 48 + Math.sin(a1) * 10);
      ctx.lineTo(x + Math.cos(a2) * 28, y - 48 + Math.sin(a2) * 10);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  }
});

FurnitureCatalog.grill_bbq = makeFurniture({
  id: 'grill_bbq', name: 'BBQ Grill', category: 'outdoor', price: 350, rarity: 'Uncommon',
  tilesW: 1, tilesD: 1, height: 32,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // legs
    ctx.strokeStyle = PAL.grillBlack; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 6, y - 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + 6, y - 14); ctx.stroke();
    // bowl
    ctx.fillStyle = PAL.grillBlack; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 14, 14, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // coals
    ctx.fillStyle = PAL.grillCoal;
    ctx.beginPath(); ctx.ellipse(x, y - 16, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    // grate
    ctx.strokeStyle = PAL.grillGrate; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 10, y - 16); ctx.lineTo(x + 10, y - 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x, y - 12); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.tent_camping = makeFurniture({
  id: 'tent_camping', name: 'Camping Tent', category: 'outdoor', price: 450, rarity: 'Uncommon',
  tilesW: 2, tilesD: 2, height: 36,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.tentCanvas; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    // tent body (triangle front)
    ctx.beginPath();
    ctx.moveTo(x - 32, y);
    ctx.lineTo(x, y - 36);
    ctx.lineTo(x + 32, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // entrance
    ctx.fillStyle = '#3E2723';
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x, y - 20);
    ctx.lineTo(x + 10, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.tent_party = makeFurniture({
  id: 'tent_party', name: 'Party Tent', category: 'outdoor', price: 800, rarity: 'Rare',
  tilesW: 3, tilesD: 3, height: 48,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 48, y);
    ctx.lineTo(x, y - 48);
    ctx.lineTo(x + 48, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // stripes
    ctx.fillStyle = PAL.neonPink;
    ctx.beginPath(); ctx.moveTo(x - 16, y - 16); ctx.lineTo(x, y - 40); ctx.lineTo(x + 16, y - 16); ctx.closePath(); ctx.fill(); ctx.stroke();
    // poles
    ctx.strokeStyle = PAL.tentPole; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 48, y); ctx.lineTo(x - 48, y - 48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 48, y); ctx.lineTo(x + 48, y - 48); ctx.stroke();
    ctx.restore();
  }
});

FurnitureCatalog.outdoor_lantern = makeFurniture({
  id: 'outdoor_lantern', name: 'Garden Lantern', category: 'outdoor', price: 160, rarity: 'Common',
  tilesW: 1, tilesD: 1, height: 24,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.woodDark; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.metal;
    ctx.fillRect(x - 6, y - 18, 12, 16); ctx.strokeRect(x - 6, y - 18, 12, 16);
    ctx.fillStyle = PAL.lampGlow;
    ctx.fillRect(x - 4, y - 16, 8, 10);
    ctx.fillStyle = PAL.goldFrame;
    ctx.fillRect(x - 8, y - 20, 16, 4); ctx.fillRect(x - 8, y - 6, 16, 4);
    ctx.restore();
  }
});

FurnitureCatalog.outdoor_swing = makeFurniture({
  id: 'outdoor_swing', name: 'Garden Swing', category: 'outdoor', price: 500, rarity: 'Uncommon',
  tilesW: 2, tilesD: 1, height: 48,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // frame
    ctx.strokeStyle = PAL.woodDark; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 32, y); ctx.lineTo(x - 32, y - 48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 32, y); ctx.lineTo(x + 32, y - 48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 32, y - 48); ctx.lineTo(x + 32, y - 48); ctx.stroke();
    // swing seat
    ctx.strokeStyle = PAL.woodDark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 16, y - 36); ctx.lineTo(x - 16, y - 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 16, y - 36); ctx.lineTo(x + 16, y - 20); ctx.stroke();
    ctx.fillStyle = PAL.woodLight; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.fillRect(x - 20, y - 20, 40, 6); ctx.strokeRect(x - 20, y - 20, 40, 6);
    ctx.restore();
  }
});

/* ──────── SPECIAL (8 items) ──────── */

FurnitureCatalog.portal_green = makeFurniture({
  id: 'portal_green', name: 'Emerald Portal', category: 'special', price: 2500, rarity: 'Legendary',
  tilesW: 2, tilesD: 1, height: 72,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // frame (stone arch)
    const arch = { top: '#455A64', left: '#37474F', right: '#263238', outline: PAL.outline };
    drawBlock(ctx, x - 16, y, 0.5, 1, 72, arch);
    drawBlock(ctx, x + 16, y, 0.5, 1, 72, arch);
    drawBlock(ctx, x, y - 56, 2, 0.4, 12, arch);
    // swirling portal
    ctx.fillStyle = PAL.portalCore; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 30, 20, 30, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.portalRing;
    ctx.beginPath(); ctx.ellipse(x, y - 30, 14, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.ellipse(x, y - 30, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
});

FurnitureCatalog.portal_purple = makeFurniture({
  id: 'portal_purple', name: 'Void Portal', category: 'special', price: 3000, rarity: 'Legendary',
  tilesW: 2, tilesD: 1, height: 72,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    const arch = { top: '#4A148C', left: '#311B92', right: '#1A237E', outline: PAL.outline };
    drawBlock(ctx, x - 16, y, 0.5, 1, 72, arch);
    drawBlock(ctx, x + 16, y, 0.5, 1, 72, arch);
    drawBlock(ctx, x, y - 56, 2, 0.4, 12, arch);
    ctx.fillStyle = '#7C4DFF'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 30, 20, 30, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.neonPurple;
    ctx.beginPath(); ctx.ellipse(x, y - 30, 14, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.ellipse(x, y - 30, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
});

FurnitureCatalog.teleporter = makeFurniture({
  id: 'teleporter', name: 'Teleporter Pad', category: 'special', price: 1800, rarity: 'Epic',
  tilesW: 1, tilesD: 1, height: 12,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // base ring
    ctx.fillStyle = PAL.teleporterPad; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 4, 24, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // inner pad
    ctx.fillStyle = PAL.teleporterGlow;
    ctx.beginPath(); ctx.ellipse(x, y - 6, 16, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // symbols
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - 2, y - 8, 4, 4);
    ctx.restore();
  }
});

FurnitureCatalog.dance_floor = makeFurniture({
  id: 'dance_floor', name: 'Dance Floor', category: 'special', price: 1000, rarity: 'Rare',
  tilesW: 2, tilesD: 2, height: 4,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    const colors = [PAL.danceFloor1, PAL.danceFloor2, PAL.danceFloor3, '#FFEA00'];
    // 2x2 grid of tiles
    const offsets = [
      { dx: -16, dy: -8 }, { dx: 16, dy: -8 },
      { dx: -16, dy: 8 }, { dx: 16, dy: 8 }
    ];
    offsets.forEach((o, i) => {
      ctx.fillStyle = colors[i % colors.length];
      ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + o.dx, y + o.dy - ISO.hh * 0.5);
      ctx.lineTo(x + o.dx + ISO.hw, y + o.dy);
      ctx.lineTo(x + o.dx, y + o.dy + ISO.hh * 0.5);
      ctx.lineTo(x + o.dx - ISO.hw, y + o.dy);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });
    ctx.restore();
  }
});

FurnitureCatalog.dj_booth = makeFurniture({
  id: 'dj_booth', name: 'DJ Booth', category: 'special', price: 1500, rarity: 'Epic',
  tilesW: 2, tilesD: 1, height: 44,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    const c = { top: PAL.djBoothBody, left: '#424242', right: '#000000', outline: PAL.outline };
    drawBlock(ctx, x, y, 2, 1, 44, c);
    // mixer deck
    ctx.fillStyle = '#424242'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
    ctx.fillRect(x - 24, y - 40, 48, 8); ctx.strokeRect(x - 24, y - 40, 48, 8);
    // knobs
    ctx.fillStyle = PAL.djBoothAccent;
    ctx.beginPath(); ctx.arc(x - 16, y - 36, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - 36, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 16, y - 36, 2, 0, Math.PI * 2); ctx.fill();
    // neon side strips
    ctx.fillStyle = PAL.neonCyan;
    ctx.fillRect(x - 28, y - 30, 4, 20);
    ctx.fillRect(x + 24, y - 30, 4, 20);
    ctx.restore();
  }
});

FurnitureCatalog.treasure_chest = makeFurniture({
  id: 'treasure_chest', name: 'Treasure Chest', category: 'special', price: 2000, rarity: 'Legendary',
  tilesW: 1, tilesD: 1, height: 28,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    const c = { top: PAL.chestWood, left: '#5D4037', right: '#4E342E', outline: PAL.outline };
    drawBlock(ctx, x, y, 1, 1, 28, c);
    // gold bands
    ctx.fillStyle = PAL.chestGold; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 1;
    ctx.fillRect(x - 18, y - 26, 4, 22); ctx.strokeRect(x - 18, y - 26, 4, 22);
    ctx.fillRect(x + 14, y - 26, 4, 22); ctx.strokeRect(x + 14, y - 26, 4, 22);
    // lock
    ctx.fillStyle = PAL.chestLock;
    ctx.beginPath(); ctx.arc(x, y - 14, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // sparkles
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - 10, y - 24, 2, 2); ctx.fillRect(x + 8, y - 20, 2, 2);
    ctx.restore();
  }
});

FurnitureCatalog.disco_ball = makeFurniture({
  id: 'disco_ball', name: 'Disco Ball', category: 'special', price: 800, rarity: 'Rare',
  tilesW: 1, tilesD: 1, height: 48,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // chain
    ctx.strokeStyle = PAL.metal; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 48); ctx.lineTo(x, y - 36); ctx.stroke();
    // ball
    ctx.fillStyle = '#E0E0E0'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - 26, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // mirror tiles
    ctx.strokeStyle = '#9E9E9E'; ctx.lineWidth = 1;
    for (let row = -1; row <= 1; row++) {
      ctx.beginPath(); ctx.moveTo(x - 12, y - 26 + row * 8); ctx.lineTo(x + 12, y - 26 + row * 8); ctx.stroke();
    }
    for (let col = -1; col <= 1; col++) {
      ctx.beginPath(); ctx.moveTo(x + col * 8, y - 36); ctx.lineTo(x + col * 8, y - 16); ctx.stroke();
    }
    ctx.restore();
  }
});

FurnitureCatalog.magic_cauldron = makeFurniture({
  id: 'magic_cauldron', name: 'Magic Cauldron', category: 'special', price: 1600, rarity: 'Epic',
  tilesW: 1, tilesD: 1, height: 28,
  draw(ctx, x, y) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // legs
    ctx.strokeStyle = '#37474F'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 6, y - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + 6, y - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 10); ctx.stroke();
    // body
    ctx.fillStyle = '#37474F'; ctx.strokeStyle = PAL.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 10, 14, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillRect(x - 12, y - 22, 24, 14); ctx.strokeRect(x - 12, y - 22, 24, 14);
    // rim
    ctx.fillStyle = '#455A64';
    ctx.beginPath(); ctx.ellipse(x, y - 22, 14, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // bubbling potion
    ctx.fillStyle = '#00E676';
    ctx.beginPath(); ctx.ellipse(x, y - 22, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    // bubbles
    ctx.fillStyle = '#69F0AE';
    ctx.beginPath(); ctx.arc(x - 4, y - 28, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, y - 30, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
});

/* ═══════════════════════════════════════════════════════════════
   CATALOG META API
   ═══════════════════════════════════════════════════════════════ */

const ALL_KEYS = Object.keys(FurnitureCatalog);

function byCategory(cat) {
  return ALL_KEYS.filter(k => FurnitureCatalog[k].category === cat).map(k => FurnitureCatalog[k]);
}

function byRarity(rarity) {
  return ALL_KEYS.filter(k => FurnitureCatalog[k].rarity === rarity).map(k => FurnitureCatalog[k]);
}

function byPriceRange(min, max) {
  return ALL_KEYS
    .filter(k => { const p = FurnitureCatalog[k].price; return p >= min && p <= max; })
    .map(k => FurnitureCatalog[k]);
}

function getTotalCount() { return ALL_KEYS.length; }

function generateSpriteSheet(canvasWidth = 1024, canvasHeight = 1024, cols = 8) {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#00000000';
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const cellW = Math.floor(canvasWidth / cols);
  const cellH = 128;
  let idx = 0;

  ALL_KEYS.forEach(key => {
    const item = FurnitureCatalog[key];
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cx = col * cellW + cellW / 2;
    const cy = row * cellH + cellH - 16;
    item.draw(ctx, cx, cy, 'SE');
    idx++;
  });

  return { canvas, count: idx, cols, cellW, cellH };
}

function exportSpriteSheetDataURL() {
  const sheet = generateSpriteSheet();
  return sheet.canvas.toDataURL('image/png');
}

/* ES module + global bridge */
export {
  FurnitureCatalog,
  PAL,
  ISO,
  drawBlock,
  drawFootprint,
  drawIsoCircle,
  drawPixelRect,
  isoX,
  isoY,
  byCategory,
  byRarity,
  byPriceRange,
  getTotalCount,
  generateSpriteSheet,
  exportSpriteSheetDataURL,
};

export default FurnitureCatalog;

/* backward-compat global assignment */
if (typeof window !== 'undefined') {
  window.FurnitureCatalog = FurnitureCatalog;
  window.FurniturePalette = PAL;
  window.FurnitureISO = ISO;
}
