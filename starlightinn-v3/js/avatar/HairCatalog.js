/** @fileoverview HairCatalog.js — 100+ Habbo-style hairstyles for Starlight Inn v8.0
 *  Pixel-art hair renderer with category grouping, gender tags, collision boxes,
 *  and Canvas 2D draw routines for all 4 iso directions.
 *  @author Starlight Inn UI Team
 *  @version 3.0.0
 */

/**
 * Draw a symmetrical hairstyle for east/west directions.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x — Head center X
 * @param {number} y — Head top Y
 * @param {string} color — Hair fill color
 * @param {number} direction — 0=S,1=E,2=N,3=W
 * @param {Function} drawFn — Callback that receives (ctx, dx, mirror) where mirror=1/-1
 */
function drawSymmetrical(ctx, x, y, color, direction, drawFn) {
  if (direction === 0 || direction === 2) {
    drawFn(ctx, x, y, color, 1, direction);
  } else if (direction === 1) {
    drawFn(ctx, x, y, color, 1, direction);
  } else {
    ctx.save();
    ctx.translate(x * 2, 0);
    ctx.scale(-1, 1);
    drawFn(ctx, x, y, color, -1, direction);
    ctx.restore();
  }
}

/** Helper: fill a pixel rect with outline. */
function pixelRect(ctx, x, y, w, h, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, w - 1, h - 1);
  }
}

/** Helper: draw a rounded hair cap / dome. */
function drawHairCap(ctx, cx, cy, w, h, color, dir) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const r = w / 2;
  if (dir === 0 || dir === 2) {
    ctx.ellipse(cx, cy + h / 2, r, h / 2, 0, Math.PI, 0);
  } else {
    ctx.ellipse(cx, cy + h / 2, r * 0.8, h / 2, 0, Math.PI, 0);
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Helper: darkened variant of a color for outlines/shadows. */
function shadeColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1).toUpperCase()}`;
}

// =============================================================================
// CATEGORY: SHORT (15 styles)
// =============================================================================

const HAIR_BUZZ = {
  id: 'buzz', name: 'Buzz Cut', category: 'short', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 2, 14, 5, color, dark);
    if (dir === 0) pixelRect(ctx, x - 6, y + 2, 12, 2, color, null);
  },
  collisionBox: { x: -7, y: -2, w: 14, h: 6 },
  zOffset: 1,
};

const HAIR_CREW = {
  id: 'crew', name: 'Crew Cut', category: 'short', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 6, color, dark);
    pixelRect(ctx, x - 5, y - 5, 10, 3, color, dark);
  },
  collisionBox: { x: -7, y: -5, w: 14, h: 8 },
  zOffset: 1,
};

const HAIR_FADE = {
  id: 'fade', name: 'Fade', category: 'short', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -30);
    const mid = shadeColor(color, -10);
    pixelRect(ctx, x - 7, y - 1, 14, 5, mid, dark);
    pixelRect(ctx, x - 6, y - 4, 12, 4, color, dark);
    pixelRect(ctx, x - 4, y - 6, 8, 3, color, null);
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 10 },
  zOffset: 1,
};

const HAIR_PIXIE = {
  id: 'pixie', name: 'Pixie Cut', category: 'short', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 6, color, dark);
    pixelRect(ctx, x - 5, y - 6, 10, 4, color, dark);
    pixelRect(ctx, x + (dir === 1 ? 4 : -6), y - 2, 3, 5, color, null);
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 9 },
  zOffset: 2,
};

const HAIR_BOB_SHORT = {
  id: 'bob_short', name: 'Short Bob', category: 'short', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 8, y, 3, 6, color, dark);
    pixelRect(ctx, x + 5, y, 3, 6, color, dark);
  },
  collisionBox: { x: -8, y: -6, w: 16, h: 12 },
  zOffset: 2,
};

const HAIR_UNDERCUT = {
  id: 'undercut', name: 'Undercut', category: 'short', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 6, y - 6, 12, 6, color, dark);
    pixelRect(ctx, x - 7, y, 3, 4, '#1a1a1a', null);
    pixelRect(ctx, x + 4, y, 3, 4, '#1a1a1a', null);
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 10 },
  zOffset: 2,
};

const HAIR_TEXTURED = {
  id: 'textured', name: 'Textured Crop', category: 'short', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 6, y - 5, 12, 5, color, dark);
    pixelRect(ctx, x - 5, y - 7, 4, 3, color, null);
    pixelRect(ctx, x + 1, y - 6, 4, 2, color, null);
    pixelRect(ctx, x - 3, y - 8, 3, 2, color, null);
  },
  collisionBox: { x: -6, y: -8, w: 12, h: 10 },
  zOffset: 2,
};

const HAIR_SPIKY_SHORT = {
  id: 'spiky_short', name: 'Short Spiky', category: 'short', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 6, y - 4, 12, 5, color, dark);
    pixelRect(ctx, x - 4, y - 8, 3, 5, color, null);
    pixelRect(ctx, x - 1, y - 9, 3, 6, color, null);
    pixelRect(ctx, x + 2, y - 7, 3, 4, color, null);
  },
  collisionBox: { x: -6, y: -9, w: 12, h: 11 },
  zOffset: 3,
};

const HAIR_FLAT_TOP = {
  id: 'flat_top', name: 'Flat Top', category: 'short', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 2, 14, 5, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 5, color, dark);
    pixelRect(ctx, x - 5, y - 7, 10, 2, color, null);
  },
  collisionBox: { x: -7, y: -7, w: 14, h: 10 },
  zOffset: 2,
};

const HAIR_CAESAR = {
  id: 'caesar', name: 'Caesar Cut', category: 'short', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 2, 14, 5, color, dark);
    pixelRect(ctx, x - 6, y - 5, 12, 4, color, dark);
    pixelRect(ctx, x - 5, y - 4, 10, 1, shadeColor(color, 10), null);
  },
  collisionBox: { x: -7, y: -5, w: 14, h: 7 },
  zOffset: 1,
};

const HAIR_FRENCH_CROP = {
  id: 'french_crop', name: 'French Crop', category: 'short', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 6, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 5, y - 2, 10, 2, shadeColor(color, 15), null);
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 9 },
  zOffset: 1,
};

const HAIR_SIDE_PART = {
  id: 'side_part', name: 'Side Part', category: 'short', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    const side = dir === 1 ? 1 : -1;
    pixelRect(ctx, x - 7, y - 3, 14, 6, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x + side * 2, y - 5, 5, 2, shadeColor(color, 10), null);
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 9 },
  zOffset: 1,
};

const HAIR_SLICKED = {
  id: 'slicked', name: 'Slicked Back', category: 'short', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 6, y - 4, 12, 5, color, dark);
    pixelRect(ctx, x - 5, y - 6, 10, 3, color, dark);
    pixelRect(ctx, x - 4, y - 2, 8, 1, shadeColor(color, 20), null);
  },
  collisionBox: { x: -6, y: -6, w: 12, h: 9 },
  zOffset: 1,
};

const HAIR_MESSY = {
  id: 'messy', name: 'Messy', category: 'short', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 6, color, dark);
    pixelRect(ctx, x - 5, y - 6, 4, 4, color, null);
    pixelRect(ctx, x + 1, y - 7, 4, 4, color, null);
    pixelRect(ctx, x - 2, y - 5, 3, 3, color, null);
  },
  collisionBox: { x: -7, y: -7, w: 14, h: 10 },
  zOffset: 2,
};

const HAIR_BEDHEAD = {
  id: 'bedhead', name: 'Bed Head', category: 'short', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 6, y - 3, 12, 5, color, dark);
    pixelRect(ctx, x - 5, y - 7, 4, 5, color, null);
    pixelRect(ctx, x + 1, y - 8, 5, 6, color, null);
    pixelRect(ctx, x - 1, y - 6, 3, 4, color, null);
    pixelRect(ctx, x + 3, y - 5, 2, 3, color, null);
  },
  collisionBox: { x: -6, y: -8, w: 12, h: 11 },
  zOffset: 3,
};

// =============================================================================
// CATEGORY: MEDIUM (20 styles)
// =============================================================================

const HAIR_BOB = {
  id: 'bob', name: 'Bob', category: 'medium', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 9, y + 1, 3, 7, color, dark);
    pixelRect(ctx, x + 6, y + 1, 3, 7, color, dark);
  },
  collisionBox: { x: -9, y: -6, w: 18, h: 14 },
  zOffset: 2,
};

const HAIR_LOB = {
  id: 'lob', name: 'Long Bob', category: 'medium', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 10, y + 2, 3, 10, color, dark);
    pixelRect(ctx, x + 7, y + 2, 3, 10, color, dark);
  },
  collisionBox: { x: -10, y: -6, w: 20, h: 18 },
  zOffset: 2,
};

const HAIR_SHAG = {
  id: 'shag', name: 'Shag', category: 'medium', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 10, y + 2, 4, 8, color, dark);
    pixelRect(ctx, x + 6, y + 2, 4, 8, color, dark);
    pixelRect(ctx, x - 9, y + 5, 3, 4, color, null);
    pixelRect(ctx, x + 6, y + 5, 3, 4, color, null);
  },
  collisionBox: { x: -10, y: -6, w: 20, h: 16 },
  zOffset: 2,
};

const HAIR_WOLF_CUT = {
  id: 'wolf_cut', name: 'Wolf Cut', category: 'medium', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 4, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 7, 14, 4, color, dark);
    pixelRect(ctx, x - 11, y + 1, 4, 10, color, dark);
    pixelRect(ctx, x + 7, y + 1, 4, 10, color, dark);
    pixelRect(ctx, x - 9, y + 4, 3, 5, color, null);
    pixelRect(ctx, x + 6, y + 4, 3, 5, color, null);
  },
  collisionBox: { x: -11, y: -7, w: 22, h: 18 },
  zOffset: 2,
};

const HAIR_CURTAIN = {
  id: 'curtain', name: 'Curtain', category: 'medium', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 4, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 7, 12, 4, color, dark);
    pixelRect(ctx, x - 9, y + 1, 4, 10, color, dark);
    pixelRect(ctx, x + 5, y + 1, 4, 10, color, dark);
    pixelRect(ctx, x - 2, y + 2, 4, 3, shadeColor(color, 10), null);
  },
  collisionBox: { x: -9, y: -7, w: 18, h: 18 },
  zOffset: 2,
};

const HAIR_MIDDLE_PART = {
  id: 'middle_part', name: 'Middle Part', category: 'medium', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 9, y + 1, 4, 9, color, dark);
    pixelRect(ctx, x + 5, y + 1, 4, 9, color, dark);
    pixelRect(ctx, x - 1, y - 5, 2, 3, shadeColor(color, 15), null);
  },
  collisionBox: { x: -9, y: -6, w: 18, h: 16 },
  zOffset: 2,
};

const HAIR_LAYERED = {
  id: 'layered', name: 'Layered', category: 'medium', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 10, y + 2, 4, 9, color, dark);
    pixelRect(ctx, x + 6, y + 2, 4, 9, color, dark);
    pixelRect(ctx, x - 11, y + 5, 3, 5, color, null);
    pixelRect(ctx, x + 8, y + 5, 3, 5, color, null);
  },
  collisionBox: { x: -11, y: -6, w: 22, h: 16 },
  zOffset: 2,
};

const HAIR_FEATHERED = {
  id: 'feathered', name: 'Feathered', category: 'medium', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 10, y + 2, 4, 8, color, dark);
    pixelRect(ctx, x + 6, y + 2, 4, 8, color, dark);
    pixelRect(ctx, x - 11, y + 6, 3, 3, color, null);
    pixelRect(ctx, x + 8, y + 6, 3, 3, color, null);
  },
  collisionBox: { x: -11, y: -6, w: 22, h: 15 },
  zOffset: 2,
};

const HAIR_WEDGE = {
  id: 'wedge', name: 'Wedge', category: 'medium', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 9, y + 2, 3, 10, color, dark);
    pixelRect(ctx, x + 6, y + 2, 3, 10, color, dark);
    pixelRect(ctx, x - 10, y + 8, 3, 4, color, null);
    pixelRect(ctx, x + 7, y + 8, 3, 4, color, null);
  },
  collisionBox: { x: -10, y: -6, w: 20, h: 18 },
  zOffset: 2,
};

const HAIR_PAGEBOY = {
  id: 'pageboy', name: 'Pageboy', category: 'medium', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 10, y + 1, 3, 10, color, dark);
    pixelRect(ctx, x + 7, y + 1, 3, 10, color, dark);
    pixelRect(ctx, x - 9, y + 9, 3, 2, color, null);
    pixelRect(ctx, x + 6, y + 9, 3, 2, color, null);
  },
  collisionBox: { x: -10, y: -6, w: 20, h: 17 },
  zOffset: 2,
};

const HAIR_BOWL_CUT = {
  id: 'bowl_cut', name: 'Bowl Cut', category: 'medium', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 4, 14, 7, color, dark);
    pixelRect(ctx, x - 8, y - 2, 2, 6, color, dark);
    pixelRect(ctx, x + 6, y - 2, 2, 6, color, dark);
    pixelRect(ctx, x - 6, y - 7, 12, 4, color, dark);
  },
  collisionBox: { x: -8, y: -7, w: 16, h: 11 },
  zOffset: 2,
};

const HAIR_MUSHROOM = {
  id: 'mushroom', name: 'Mushroom', category: 'medium', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 4, 16, 7, color, dark);
    pixelRect(ctx, x - 9, y - 1, 2, 5, color, dark);
    pixelRect(ctx, x + 7, y - 1, 2, 5, color, dark);
    pixelRect(ctx, x - 7, y - 7, 14, 4, color, dark);
  },
  collisionBox: { x: -9, y: -7, w: 18, h: 11 },
  zOffset: 2,
};

const HAIR_MOP_TOP = {
  id: 'mop_top', name: 'Mop Top', category: 'medium', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 4, 16, 7, color, dark);
    pixelRect(ctx, x - 7, y - 7, 14, 4, color, dark);
    pixelRect(ctx, x - 9, y - 1, 3, 5, color, dark);
    pixelRect(ctx, x + 6, y - 1, 3, 5, color, dark);
    pixelRect(ctx, x - 5, y - 9, 4, 3, color, null);
    pixelRect(ctx, x + 1, y - 9, 4, 3, color, null);
  },
  collisionBox: { x: -9, y: -9, w: 18, h: 14 },
  zOffset: 2,
};

const HAIR_SKATER = {
  id: 'skater', name: 'Skater', category: 'medium', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 7, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 10, y + 1, 4, 9, color, dark);
    pixelRect(ctx, x + 6, y + 1, 4, 9, color, dark);
    pixelRect(ctx, x - 5, y - 8, 5, 3, color, null);
  },
  collisionBox: { x: -10, y: -8, w: 20, h: 18 },
  zOffset: 2,
};

const HAIR_EMO = {
  id: 'emo', name: 'Emo', category: 'medium', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 7, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 10, y + 2, 4, 12, color, dark);
    pixelRect(ctx, x + 6, y + 2, 4, 12, color, dark);
    pixelRect(ctx, x - 9, y + 10, 3, 4, color, null);
    pixelRect(ctx, x + 6, y + 10, 3, 4, color, null);
  },
  collisionBox: { x: -10, y: -6, w: 20, h: 20 },
  zOffset: 2,
};

const HAIR_SCENE = {
  id: 'scene', name: 'Scene', category: 'medium', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 4, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 7, 14, 4, color, dark);
    pixelRect(ctx, x - 11, y + 1, 5, 12, color, dark);
    pixelRect(ctx, x + 6, y + 1, 5, 12, color, dark);
    pixelRect(ctx, x - 10, y + 10, 4, 4, color, null);
    pixelRect(ctx, x + 6, y + 10, 4, 4, color, null);
    pixelRect(ctx, x - 4, y - 9, 4, 3, color, null);
    pixelRect(ctx, x + 0, y - 9, 4, 3, color, null);
  },
  collisionBox: { x: -11, y: -9, w: 22, h: 23 },
  zOffset: 2,
};

const HAIR_INDIE = {
  id: 'indie', name: 'Indie', category: 'medium', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 7, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 10, y + 2, 4, 9, color, dark);
    pixelRect(ctx, x + 6, y + 2, 4, 9, color, dark);
    pixelRect(ctx, x - 4, y - 8, 5, 3, color, null);
  },
  collisionBox: { x: -10, y: -8, w: 20, h: 19 },
  zOffset: 2,
};

const HAIR_SURFER = {
  id: 'surfer', name: 'Surfer', category: 'medium', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 7, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 10, y + 2, 4, 10, color, dark);
    pixelRect(ctx, x + 6, y + 2, 4, 10, color, dark);
    pixelRect(ctx, x - 9, y + 8, 3, 4, color, null);
    pixelRect(ctx, x + 6, y + 8, 3, 4, color, null);
  },
  collisionBox: { x: -10, y: -6, w: 20, h: 18 },
  zOffset: 2,
};

const HAIR_PREPPY = {
  id: 'preppy', name: 'Preppy', category: 'medium', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 4, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 7, 12, 4, color, dark);
    pixelRect(ctx, x - 8, y + 1, 3, 8, color, dark);
    pixelRect(ctx, x + 5, y + 1, 3, 8, color, dark);
    pixelRect(ctx, x - 4, y - 2, 8, 1, shadeColor(color, 15), null);
  },
  collisionBox: { x: -8, y: -7, w: 16, h: 16 },
  zOffset: 2,
};

const HAIR_BUSINESSMAN = {
  id: 'businessman', name: 'Businessman', category: 'medium', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 4, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 7, 12, 4, color, dark);
    pixelRect(ctx, x - 8, y + 1, 3, 7, color, dark);
    pixelRect(ctx, x + 5, y + 1, 3, 7, color, dark);
    pixelRect(ctx, x - 4, y - 1, 8, 1, shadeColor(color, 10), null);
  },
  collisionBox: { x: -8, y: -7, w: 16, h: 15 },
  zOffset: 2,
};

// =============================================================================
// CATEGORY: LONG (20 styles)
// =============================================================================

const HAIR_STRAIGHT_LONG = {
  id: 'straight_long', name: 'Straight Long', category: 'long', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 11, y + 2, 5, 18, color, dark);
    pixelRect(ctx, x + 6, y + 2, 5, 18, color, dark);
  },
  collisionBox: { x: -11, y: -6, w: 22, h: 26 },
  zOffset: 2,
};

const HAIR_WAVY_LONG = {
  id: 'wavy_long', name: 'Wavy Long', category: 'long', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 12, y + 2, 5, 16, color, dark);
    pixelRect(ctx, x + 7, y + 2, 5, 16, color, dark);
    pixelRect(ctx, x - 11, y + 6, 3, 3, color, null);
    pixelRect(ctx, x + 8, y + 6, 3, 3, color, null);
    pixelRect(ctx, x - 12, y + 12, 3, 3, color, null);
    pixelRect(ctx, x + 9, y + 12, 3, 3, color, null);
  },
  collisionBox: { x: -12, y: -6, w: 24, h: 24 },
  zOffset: 2,
};

const HAIR_CURLY_LONG = {
  id: 'curly_long', name: 'Curly Long', category: 'long', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 9, y - 3, 18, 8, color, dark);
    pixelRect(ctx, x - 8, y - 6, 16, 4, color, dark);
    pixelRect(ctx, x - 13, y + 2, 6, 14, color, dark);
    pixelRect(ctx, x + 7, y + 2, 6, 14, color, dark);
    pixelRect(ctx, x - 12, y + 8, 4, 4, color, null);
    pixelRect(ctx, x + 8, y + 8, 4, 4, color, null);
  },
  collisionBox: { x: -13, y: -6, w: 26, h: 22 },
  zOffset: 2,
};

const HAIR_LAYERED_LONG = {
  id: 'layered_long', name: 'Layered Long', category: 'long', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 12, y + 2, 5, 16, color, dark);
    pixelRect(ctx, x + 7, y + 2, 5, 16, color, dark);
    pixelRect(ctx, x - 13, y + 8, 4, 6, color, null);
    pixelRect(ctx, x + 9, y + 8, 4, 6, color, null);
    pixelRect(ctx, x - 11, y + 4, 3, 4, color, null);
    pixelRect(ctx, x + 8, y + 4, 3, 4, color, null);
  },
  collisionBox: { x: -13, y: -6, w: 26, h: 24 },
  zOffset: 2,
};

const HAIR_FEATHERED_LONG = {
  id: 'feathered_long', name: 'Feathered Long', category: 'long', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 12, y + 2, 5, 14, color, dark);
    pixelRect(ctx, x + 7, y + 2, 5, 14, color, dark);
    pixelRect(ctx, x - 13, y + 10, 4, 4, color, null);
    pixelRect(ctx, x + 9, y + 10, 4, 4, color, null);
  },
  collisionBox: { x: -13, y: -6, w: 26, h: 22 },
  zOffset: 2,
};

const HAIR_70S_SHAG = {
  id: '70s_shag', name: '70s Shag', category: 'long', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 9, y - 4, 18, 8, color, dark);
    pixelRect(ctx, x - 8, y - 7, 16, 4, color, dark);
    pixelRect(ctx, x - 13, y + 2, 6, 16, color, dark);
    pixelRect(ctx, x + 7, y + 2, 6, 16, color, dark);
    pixelRect(ctx, x - 12, y + 8, 4, 4, color, null);
    pixelRect(ctx, x + 8, y + 8, 4, 4, color, null);
    pixelRect(ctx, x - 5, y - 9, 5, 3, color, null);
    pixelRect(ctx, x + 0, y - 9, 5, 3, color, null);
  },
  collisionBox: { x: -13, y: -9, w: 26, h: 27 },
  zOffset: 2,
};

const HAIR_80S_PERM = {
  id: '80s_perm', name: '80s Perm', category: 'long', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 10, y - 4, 20, 8, color, dark);
    pixelRect(ctx, x - 9, y - 7, 18, 4, color, dark);
    pixelRect(ctx, x - 14, y + 2, 7, 16, color, dark);
    pixelRect(ctx, x + 7, y + 2, 7, 16, color, dark);
    pixelRect(ctx, x - 13, y + 10, 5, 4, color, null);
    pixelRect(ctx, x + 8, y + 10, 5, 4, color, null);
    pixelRect(ctx, x - 6, y - 10, 5, 4, color, null);
    pixelRect(ctx, x + 1, y - 10, 5, 4, color, null);
  },
  collisionBox: { x: -14, y: -10, w: 28, h: 28 },
  zOffset: 2,
};

const HAIR_90S_BOYBAND = {
  id: '90s_boyband', name: '90s Boyband', category: 'long', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 11, y + 2, 5, 14, color, dark);
    pixelRect(ctx, x + 6, y + 2, 5, 14, color, dark);
    pixelRect(ctx, x - 4, y - 8, 4, 3, color, null);
    pixelRect(ctx, x + 0, y - 8, 4, 3, color, null);
  },
  collisionBox: { x: -11, y: -8, w: 22, h: 24 },
  zOffset: 2,
};

const HAIR_GOTH_LONG = {
  id: 'goth_long', name: 'Goth Long', category: 'long', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 9, y - 3, 18, 8, color, dark);
    pixelRect(ctx, x - 8, y - 6, 16, 4, color, dark);
    pixelRect(ctx, x - 13, y + 2, 6, 20, color, dark);
    pixelRect(ctx, x + 7, y + 2, 6, 20, color, dark);
    pixelRect(ctx, x - 12, y + 12, 4, 5, color, null);
    pixelRect(ctx, x + 8, y + 12, 4, 5, color, null);
  },
  collisionBox: { x: -13, y: -6, w: 26, h: 28 },
  zOffset: 2,
};

const HAIR_HIPPIE = {
  id: 'hippie', name: 'Hippie', category: 'long', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 9, y - 4, 18, 8, color, dark);
    pixelRect(ctx, x - 8, y - 7, 16, 4, color, dark);
    pixelRect(ctx, x - 14, y + 2, 7, 18, color, dark);
    pixelRect(ctx, x + 7, y + 2, 7, 18, color, dark);
    pixelRect(ctx, x - 5, y - 10, 5, 4, color, null);
    pixelRect(ctx, x + 0, y - 10, 5, 4, color, null);
  },
  collisionBox: { x: -14, y: -10, w: 28, h: 30 },
  zOffset: 2,
};

const HAIR_BOHEMIAN = {
  id: 'bohemian', name: 'Bohemian', category: 'long', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 9, y - 4, 18, 8, color, dark);
    pixelRect(ctx, x - 8, y - 7, 16, 4, color, dark);
    pixelRect(ctx, x - 14, y + 2, 7, 18, color, dark);
    pixelRect(ctx, x + 7, y + 2, 7, 18, color, dark);
    pixelRect(ctx, x - 13, y + 10, 5, 5, color, null);
    pixelRect(ctx, x + 8, y + 10, 5, 5, color, null);
    pixelRect(ctx, x - 5, y - 9, 5, 3, color, null);
  },
  collisionBox: { x: -14, y: -9, w: 28, h: 29 },
  zOffset: 2,
};

const HAIR_ROCKER = {
  id: 'rocker', name: 'Rocker', category: 'long', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 9, y - 4, 18, 8, color, dark);
    pixelRect(ctx, x - 8, y - 7, 16, 4, color, dark);
    pixelRect(ctx, x - 13, y + 2, 6, 16, color, dark);
    pixelRect(ctx, x + 7, y + 2, 6, 16, color, dark);
    pixelRect(ctx, x - 5, y - 10, 5, 4, color, null);
    pixelRect(ctx, x + 0, y - 10, 5, 4, color, null);
    pixelRect(ctx, x - 12, y + 12, 4, 4, color, null);
    pixelRect(ctx, x + 8, y + 12, 4, 4, color, null);
  },
  collisionBox: { x: -13, y: -10, w: 26, h: 28 },
  zOffset: 2,
};

const HAIR_METALHEAD = {
  id: 'metalhead', name: 'Metalhead', category: 'long', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 10, y - 4, 20, 8, color, dark);
    pixelRect(ctx, x - 9, y - 7, 18, 4, color, dark);
    pixelRect(ctx, x - 15, y + 2, 7, 20, color, dark);
    pixelRect(ctx, x + 8, y + 2, 7, 20, color, dark);
    pixelRect(ctx, x - 6, y - 11, 6, 4, color, null);
    pixelRect(ctx, x + 0, y - 11, 6, 4, color, null);
  },
  collisionBox: { x: -15, y: -11, w: 30, h: 33 },
  zOffset: 2,
};

const HAIR_VIKING = {
  id: 'viking', name: 'Viking', category: 'long', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 9, y - 4, 18, 8, color, dark);
    pixelRect(ctx, x - 8, y - 7, 16, 4, color, dark);
    pixelRect(ctx, x - 14, y + 2, 7, 18, color, dark);
    pixelRect(ctx, x + 7, y + 2, 7, 18, color, dark);
    pixelRect(ctx, x - 5, y - 10, 5, 4, color, null);
    pixelRect(ctx, x + 0, y - 10, 5, 4, color, null);
    pixelRect(ctx, x - 13, y + 14, 5, 4, color, null);
    pixelRect(ctx, x + 8, y + 14, 5, 4, color, null);
  },
  collisionBox: { x: -14, y: -10, w: 28, h: 30 },
  zOffset: 2,
};

const HAIR_SURFER_LONG = {
  id: 'surfer_long', name: 'Surfer Long', category: 'long', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 9, y - 3, 18, 8, color, dark);
    pixelRect(ctx, x - 8, y - 6, 16, 4, color, dark);
    pixelRect(ctx, x - 14, y + 2, 7, 18, color, dark);
    pixelRect(ctx, x + 7, y + 2, 7, 18, color, dark);
    pixelRect(ctx, x - 13, y + 10, 5, 5, color, null);
    pixelRect(ctx, x + 8, y + 10, 5, 5, color, null);
  },
  collisionBox: { x: -14, y: -6, w: 28, h: 26 },
  zOffset: 2,
};

const HAIR_PREPPY_LONG = {
  id: 'preppy_long', name: 'Preppy Long', category: 'long', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 4, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 7, 14, 4, color, dark);
    pixelRect(ctx, x - 12, y + 2, 5, 14, color, dark);
    pixelRect(ctx, x + 7, y + 2, 5, 14, color, dark);
    pixelRect(ctx, x - 4, y - 1, 8, 1, shadeColor(color, 15), null);
  },
  collisionBox: { x: -12, y: -7, w: 24, h: 23 },
  zOffset: 2,
};

const HAIR_BUSINESSMAN_LONG = {
  id: 'businessman_long', name: 'Businessman Long', category: 'long', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 4, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 7, 14, 4, color, dark);
    pixelRect(ctx, x - 12, y + 2, 5, 16, color, dark);
    pixelRect(ctx, x + 7, y + 2, 5, 16, color, dark);
    pixelRect(ctx, x - 4, y - 1, 8, 1, shadeColor(color, 10), null);
  },
  collisionBox: { x: -12, y: -7, w: 24, h: 25 },
  zOffset: 2,
};

const HAIR_ARTIST = {
  id: 'artist', name: 'Artist', category: 'long', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 9, y - 4, 18, 8, color, dark);
    pixelRect(ctx, x - 8, y - 7, 16, 4, color, dark);
    pixelRect(ctx, x - 14, y + 2, 7, 18, color, dark);
    pixelRect(ctx, x + 7, y + 2, 7, 18, color, dark);
    pixelRect(ctx, x - 5, y - 10, 5, 4, color, null);
  },
  collisionBox: { x: -14, y: -10, w: 28, h: 30 },
  zOffset: 2,
};

const HAIR_POET = {
  id: 'poet', name: 'Poet', category: 'long', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 4, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 7, 14, 4, color, dark);
    pixelRect(ctx, x - 12, y + 2, 5, 16, color, dark);
    pixelRect(ctx, x + 7, y + 2, 5, 16, color, dark);
    pixelRect(ctx, x - 4, y - 9, 4, 3, color, null);
    pixelRect(ctx, x + 0, y - 9, 4, 3, color, null);
  },
  collisionBox: { x: -12, y: -9, w: 24, h: 27 },
  zOffset: 2,
};

const HAIR_ROMANTIC = {
  id: 'romantic', name: 'Romantic', category: 'long', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 9, y - 3, 18, 8, color, dark);
    pixelRect(ctx, x - 8, y - 6, 16, 4, color, dark);
    pixelRect(ctx, x - 14, y + 2, 7, 20, color, dark);
    pixelRect(ctx, x + 7, y + 2, 7, 20, color, dark);
    pixelRect(ctx, x - 13, y + 14, 5, 5, color, null);
    pixelRect(ctx, x + 8, y + 14, 5, 5, color, null);
    pixelRect(ctx, x - 4, y - 8, 4, 3, color, null);
    pixelRect(ctx, x + 0, y - 8, 4, 3, color, null);
  },
  collisionBox: { x: -14, y: -8, w: 28, h: 30 },
  zOffset: 2,
};

// =============================================================================
// CATEGORY: UPDOS (15 styles)
// =============================================================================

const HAIR_PONYTAIL_HIGH = {
  id: 'ponytail_high', name: 'High Ponytail', category: 'updos', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 2, y - 10, 4, 5, color, dark);
    pixelRect(ctx, x - 3, y - 8, 6, 2, shadeColor(color, 10), null);
    pixelRect(ctx, x - 2, y - 18, 4, 10, color, dark);
  },
  collisionBox: { x: -7, y: -18, w: 14, h: 22 },
  zOffset: 3,
};

const HAIR_PONYTAIL_LOW = {
  id: 'ponytail_low', name: 'Low Ponytail', category: 'updos', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 2, y + 2, 4, 3, color, dark);
    pixelRect(ctx, x - 2, y + 4, 4, 12, color, dark);
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 22 },
  zOffset: 2,
};

const HAIR_PONYTAIL_SIDE = {
  id: 'ponytail_side', name: 'Side Ponytail', category: 'updos', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    const side = dir === 1 ? 1 : -1;
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x + side * 4, y - 2, 4, 3, color, dark);
    pixelRect(ctx, x + side * 5, y, 4, 12, color, dark);
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 20 },
  zOffset: 2,
};

const HAIR_BUN_HIGH = {
  id: 'bun_high', name: 'High Bun', category: 'updos', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 4, y - 12, 8, 8, color, dark);
    pixelRect(ctx, x - 3, y - 11, 6, 6, shadeColor(color, 10), null);
  },
  collisionBox: { x: -7, y: -12, w: 14, h: 16 },
  zOffset: 3,
};

const HAIR_BUN_LOW = {
  id: 'bun_low', name: 'Low Bun', category: 'updos', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 4, y + 2, 8, 6, color, dark);
    pixelRect(ctx, x - 3, y + 3, 6, 4, shadeColor(color, 10), null);
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 14 },
  zOffset: 2,
};

const HAIR_MESSY_BUN = {
  id: 'messy_bun', name: 'Messy Bun', category: 'updos', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 5, y - 12, 10, 8, color, dark);
    pixelRect(ctx, x - 3, y - 14, 6, 4, color, null);
    pixelRect(ctx, x - 6, y - 10, 3, 4, color, null);
    pixelRect(ctx, x + 3, y - 11, 3, 4, color, null);
  },
  collisionBox: { x: -7, y: -14, w: 14, h: 18 },
  zOffset: 3,
};

const HAIR_SPACE_BUNS = {
  id: 'space_buns', name: 'Space Buns', category: 'updos', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 9, y - 12, 7, 7, color, dark);
    pixelRect(ctx, x + 2, y - 12, 7, 7, color, dark);
    pixelRect(ctx, x - 8, y - 11, 5, 5, shadeColor(color, 10), null);
    pixelRect(ctx, x + 3, y - 11, 5, 5, shadeColor(color, 10), null);
  },
  collisionBox: { x: -9, y: -12, w: 18, h: 16 },
  zOffset: 3,
};

const HAIR_TOP_KNOT = {
  id: 'top_knot', name: 'Top Knot', category: 'updos', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 3, y - 14, 6, 10, color, dark);
    pixelRect(ctx, x - 2, y - 13, 4, 8, shadeColor(color, 10), null);
  },
  collisionBox: { x: -7, y: -14, w: 14, h: 18 },
  zOffset: 3,
};

const HAIR_CHIGNON = {
  id: 'chignon', name: 'Chignon', category: 'updos', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 5, y + 2, 10, 6, color, dark);
    pixelRect(ctx, x - 4, y + 3, 8, 4, shadeColor(color, 10), null);
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 14 },
  zOffset: 2,
};

const HAIR_FRENCH_TWIST = {
  id: 'french_twist', name: 'French Twist', category: 'updos', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 3, y + 1, 6, 8, color, dark);
    pixelRect(ctx, x - 2, y + 2, 4, 6, shadeColor(color, 10), null);
    pixelRect(ctx, x - 4, y + 3, 2, 4, color, null);
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 15 },
  zOffset: 2,
};

const HAIR_BRAIDED_BUN = {
  id: 'braided_bun', name: 'Braided Bun', category: 'updos', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 5, y + 2, 10, 6, color, dark);
    pixelRect(ctx, x - 4, y + 3, 8, 4, shadeColor(color, 10), null);
    pixelRect(ctx, x - 3, y + 4, 6, 1, dark, null);
    pixelRect(ctx, x - 3, y + 6, 6, 1, dark, null);
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 14 },
  zOffset: 2,
};

const HAIR_CROWN_BRAID_UPDOS = {
  id: 'crown_braid', name: 'Crown Braid', category: 'updos', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 8, y - 5, 3, 8, color, dark);
    pixelRect(ctx, x + 5, y - 5, 3, 8, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 7, y - 7, 3, 3, color, null);
    pixelRect(ctx, x + 4, y - 7, 3, 3, color, null);
  },
  collisionBox: { x: -8, y: -7, w: 16, h: 14 },
  zOffset: 2,
};

const HAIR_HALF_UP = {
  id: 'half_up', name: 'Half Up', category: 'updos', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 10, y + 2, 4, 10, color, dark);
    pixelRect(ctx, x + 6, y + 2, 4, 10, color, dark);
    pixelRect(ctx, x - 3, y - 10, 6, 5, color, dark);
    pixelRect(ctx, x - 2, y - 9, 4, 3, shadeColor(color, 10), null);
  },
  collisionBox: { x: -10, y: -10, w: 20, h: 22 },
  zOffset: 2,
};

const HAIR_PIGTAILS = {
  id: 'pigtails', name: 'Pigtails', category: 'updos', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 11, y - 2, 5, 14, color, dark);
    pixelRect(ctx, x + 6, y - 2, 5, 14, color, dark);
    pixelRect(ctx, x - 10, y - 3, 3, 3, color, null);
    pixelRect(ctx, x + 7, y - 3, 3, 3, color, null);
  },
  collisionBox: { x: -11, y: -6, w: 22, h: 20 },
  zOffset: 2,
};

const HAIR_PIGTAIL_BUNS = {
  id: 'pigtail_buns', name: 'Pigtail Buns', category: 'updos', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 12, y - 5, 6, 6, color, dark);
    pixelRect(ctx, x + 6, y - 5, 6, 6, color, dark);
    pixelRect(ctx, x - 11, y - 4, 4, 4, shadeColor(color, 10), null);
    pixelRect(ctx, x + 7, y - 4, 4, 4, shadeColor(color, 10), null);
  },
  collisionBox: { x: -12, y: -6, w: 24, h: 13 },
  zOffset: 3,
};

// =============================================================================
// CATEGORY: BRAIDS (15 styles)
// =============================================================================

const HAIR_SINGLE_BRAID = {
  id: 'single_braid', name: 'Single Braid', category: 'braids', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 2, y + 2, 4, 3, color, dark);
    for (let i = 0; i < 6; i++) {
      pixelRect(ctx, x - 2 + (i % 2), y + 4 + i * 3, 4, 2, color, dark);
    }
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 26 },
  zOffset: 2,
};

const HAIR_TWIN_BRAIDS = {
  id: 'twin_braids', name: 'Twin Braids', category: 'braids', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    for (let i = 0; i < 6; i++) {
      pixelRect(ctx, x - 8 + (i % 2), y + 2 + i * 3, 4, 2, color, dark);
      pixelRect(ctx, x + 4 + (i % 2), y + 2 + i * 3, 4, 2, color, dark);
    }
  },
  collisionBox: { x: -8, y: -6, w: 16, h: 24 },
  zOffset: 2,
};

const HAIR_FRENCH_BRAID = {
  id: 'french_braid', name: 'French Braid', category: 'braids', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 3, y + 2, 6, 3, color, dark);
    for (let i = 0; i < 7; i++) {
      pixelRect(ctx, x - 2 - Math.floor(i / 2), y + 4 + i * 3, 5 + i, 2, color, dark);
    }
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 28 },
  zOffset: 2,
};

const HAIR_DUTCH_BRAID = {
  id: 'dutch_braid', name: 'Dutch Braid', category: 'braids', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 3, y + 2, 6, 3, color, dark);
    for (let i = 0; i < 7; i++) {
      pixelRect(ctx, x - 2, y + 4 + i * 3, 5, 2, color, dark);
    }
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 28 },
  zOffset: 2,
};

const HAIR_FISHTAIL = {
  id: 'fishtail', name: 'Fishtail Braid', category: 'braids', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    for (let i = 0; i < 8; i++) {
      pixelRect(ctx, x - 1 - Math.floor(i / 3), y + 2 + i * 3, 3 + Math.floor(i / 2), 2, color, dark);
    }
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 30 },
  zOffset: 2,
};

const HAIR_WATERFALL = {
  id: 'waterfall', name: 'Waterfall Braid', category: 'braids', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 7, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 10, y + 2, 4, 12, color, dark);
    pixelRect(ctx, x + 6, y + 2, 4, 12, color, dark);
    for (let i = 0; i < 4; i++) {
      pixelRect(ctx, x - 8 + i * 4, y - 4 + i * 2, 3, 2, shadeColor(color, 10), null);
    }
  },
  collisionBox: { x: -10, y: -6, w: 20, h: 20 },
  zOffset: 2,
};

const HAIR_CROWN_BRAID_FULL = {
  id: 'crown_braid_full', name: 'Full Crown Braid', category: 'braids', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 4, 16, 8, color, dark);
    pixelRect(ctx, x - 9, y - 6, 4, 10, color, dark);
    pixelRect(ctx, x + 5, y - 6, 4, 10, color, dark);
    pixelRect(ctx, x - 7, y - 7, 14, 4, color, dark);
    for (let i = 0; i < 3; i++) {
      pixelRect(ctx, x - 8 + i * 5, y - 8 + i, 4, 2, shadeColor(color, 10), null);
    }
  },
  collisionBox: { x: -9, y: -8, w: 18, h: 16 },
  zOffset: 2,
};

const HAIR_SIDE_BRAID = {
  id: 'side_braid', name: 'Side Braid', category: 'braids', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    const side = dir === 1 ? 1 : -1;
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x + side * 5, y, 4, 3, color, dark);
    for (let i = 0; i < 6; i++) {
      pixelRect(ctx, x + side * 5 + (i % 2) * side, y + 2 + i * 3, 4, 2, color, dark);
    }
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 24 },
  zOffset: 2,
};

const HAIR_PULL_THROUGH = {
  id: 'pull_through', name: 'Pull Through', category: 'braids', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    for (let i = 0; i < 5; i++) {
      pixelRect(ctx, x - 3, y + 1 + i * 4, 6, 3, color, dark);
      pixelRect(ctx, x - 2, y + 2 + i * 4, 4, 1, shadeColor(color, 10), null);
    }
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 24 },
  zOffset: 2,
};

const HAIR_ROPE_BRAID = {
  id: 'rope_braid', name: 'Rope Braid', category: 'braids', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    for (let i = 0; i < 8; i++) {
      pixelRect(ctx, x - 2, y + 2 + i * 3, 4, 2, color, dark);
    }
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 28 },
  zOffset: 2,
};

const HAIR_BOX_BRAIDS = {
  id: 'box_braids', name: 'Box Braids', category: 'braids', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 4, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 7, 14, 4, color, dark);
    for (let i = 0; i < 6; i++) {
      pixelRect(ctx, x - 9 + (i % 3) * 6, y + 2 + i * 4, 4, 12, color, dark);
    }
  },
  collisionBox: { x: -9, y: -7, w: 18, h: 28 },
  zOffset: 2,
};

const HAIR_CORNROWS = {
  id: 'cornrows', name: 'Cornrows', category: 'braids', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 6, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    for (let i = 0; i < 5; i++) {
      pixelRect(ctx, x - 5 + i * 2, y - 5, 1, 5, dark, null);
    }
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 9 },
  zOffset: 1,
};

const HAIR_HALO_BRAID = {
  id: 'halo_braid', name: 'Halo Braid', category: 'braids', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 4, 16, 8, color, dark);
    pixelRect(ctx, x - 10, y - 6, 5, 10, color, dark);
    pixelRect(ctx, x + 5, y - 6, 5, 10, color, dark);
    pixelRect(ctx, x - 7, y - 8, 14, 4, color, dark);
    pixelRect(ctx, x - 9, y - 9, 4, 3, color, null);
    pixelRect(ctx, x + 5, y - 9, 4, 3, color, null);
  },
  collisionBox: { x: -10, y: -9, w: 20, h: 17 },
  zOffset: 2,
};

const HAIR_BRAIDED_PONY = {
  id: 'braided_pony', name: 'Braided Pony', category: 'braids', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 2, y - 10, 4, 5, color, dark);
    for (let i = 0; i < 6; i++) {
      pixelRect(ctx, x - 2, y - 8 + i * 3, 4, 2, color, dark);
    }
  },
  collisionBox: { x: -7, y: -10, w: 14, h: 20 },
  zOffset: 2,
};

const HAIR_FOUR_STRAND = {
  id: 'four_strand', name: 'Four Strand', category: 'braids', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    for (let i = 0; i < 8; i++) {
      pixelRect(ctx, x - 3, y + 2 + i * 3, 6, 2, color, dark);
      pixelRect(ctx, x - 2, y + 3 + i * 3, 4, 1, shadeColor(color, 10), null);
    }
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 30 },
  zOffset: 2,
};

// =============================================================================
// CATEGORY: SPECIAL (15+ styles)
// =============================================================================

const HAIR_MOHAWK = {
  id: 'mohawk', name: 'Mohawk', category: 'special', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 2, 14, 5, '#1a1a1a', null);
    pixelRect(ctx, x - 2, y - 8, 4, 14, color, dark);
    pixelRect(ctx, x - 1, y - 10, 2, 3, color, null);
    pixelRect(ctx, x - 1, y + 4, 2, 3, color, null);
  },
  collisionBox: { x: -7, y: -10, w: 14, h: 19 },
  zOffset: 3,
};

const HAIR_FAUX_HAWK = {
  id: 'faux_hawk', name: 'Faux Hawk', category: 'special', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 6, '#1a1a1a', null);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 3, y - 8, 6, 12, color, dark);
    pixelRect(ctx, x - 2, y - 10, 4, 3, color, null);
  },
  collisionBox: { x: -7, y: -10, w: 14, h: 18 },
  zOffset: 3,
};

const HAIR_LIBERTY_SPIKES = {
  id: 'liberty_spikes', name: 'Liberty Spikes', category: 'special', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 2, 14, 5, '#1a1a1a', null);
    pixelRect(ctx, x - 5, y - 14, 3, 14, color, dark);
    pixelRect(ctx, x - 1, y - 16, 2, 16, color, dark);
    pixelRect(ctx, x + 2, y - 12, 3, 12, color, dark);
    pixelRect(ctx, x - 1, y - 18, 2, 3, color, null);
  },
  collisionBox: { x: -7, y: -18, w: 14, h: 23 },
  zOffset: 4,
};

const HAIR_DEATH_HAWK = {
  id: 'death_hawk', name: 'Death Hawk', category: 'special', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 2, 14, 5, '#1a1a1a', null);
    pixelRect(ctx, x - 3, y - 14, 6, 16, color, dark);
    pixelRect(ctx, x - 5, y - 10, 3, 10, color, dark);
    pixelRect(ctx, x + 2, y - 10, 3, 10, color, dark);
    pixelRect(ctx, x - 2, y - 18, 4, 5, color, null);
  },
  collisionBox: { x: -7, y: -18, w: 14, h: 25 },
  zOffset: 4,
};

const HAIR_UNDERCUT_LONG = {
  id: 'undercut_long', name: 'Long Undercut', category: 'special', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 6, '#1a1a1a', null);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 5, y - 10, 10, 6, color, dark);
    pixelRect(ctx, x - 3, y - 14, 6, 5, color, dark);
    pixelRect(ctx, x - 10, y + 1, 4, 10, color, dark);
    pixelRect(ctx, x + 6, y + 1, 4, 10, color, dark);
  },
  collisionBox: { x: -10, y: -14, w: 20, h: 27 },
  zOffset: 3,
};

const HAIR_SHAVED_SIDES = {
  id: 'shaved_sides', name: 'Shaved Sides', category: 'special', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 6, '#1a1a1a', null);
    pixelRect(ctx, x - 3, y - 6, 6, 10, color, dark);
    pixelRect(ctx, x - 2, y - 9, 4, 4, color, dark);
    pixelRect(ctx, x - 1, y - 11, 2, 3, color, null);
  },
  collisionBox: { x: -7, y: -11, w: 14, h: 20 },
  zOffset: 3,
};

const HAIR_RAT_TAIL = {
  id: 'rat_tail', name: 'Rat Tail', category: 'special', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 6, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 1, y + 2, 2, 3, color, dark);
    pixelRect(ctx, x - 1, y + 4, 2, 14, color, dark);
  },
  collisionBox: { x: -7, y: -6, w: 14, h: 24 },
  zOffset: 2,
};

const HAIR_MULLET = {
  id: 'mullet', name: 'Mullet', category: 'special', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 6, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 3, y - 8, 6, 3, color, null);
    pixelRect(ctx, x - 8, y + 1, 4, 10, color, dark);
    pixelRect(ctx, x + 4, y + 1, 4, 10, color, dark);
    pixelRect(ctx, x - 2, y + 2, 4, 12, color, dark);
  },
  collisionBox: { x: -8, y: -8, w: 16, h: 24 },
  zOffset: 2,
};

const HAIR_SKULLET = {
  id: 'skullet', name: 'Skullet', category: 'special', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 5, '#e0e0e0', dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, '#e0e0e0', dark);
    pixelRect(ctx, x - 8, y + 1, 4, 10, color, dark);
    pixelRect(ctx, x + 4, y + 1, 4, 10, color, dark);
    pixelRect(ctx, x - 2, y + 2, 4, 12, color, dark);
  },
  collisionBox: { x: -8, y: -6, w: 16, h: 22 },
  zOffset: 2,
};

const HAIR_POMPADOUR = {
  id: 'pompadour', name: 'Pompadour', category: 'special', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 6, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 5, y - 12, 10, 8, color, dark);
    pixelRect(ctx, x - 4, y - 11, 8, 6, shadeColor(color, 10), null);
    pixelRect(ctx, x - 3, y - 2, 6, 1, shadeColor(color, 15), null);
  },
  collisionBox: { x: -7, y: -12, w: 14, h: 19 },
  zOffset: 3,
};

const HAIR_QUIFF = {
  id: 'quiff', name: 'Quiff', category: 'special', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 6, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 4, y - 11, 10, 7, color, dark);
    pixelRect(ctx, x - 3, y - 10, 8, 5, shadeColor(color, 10), null);
  },
  collisionBox: { x: -7, y: -11, w: 14, h: 18 },
  zOffset: 3,
};

const HAIR_AFRO = {
  id: 'afro', name: 'Afro', category: 'special', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 11, y - 6, 22, 16, color, dark);
    pixelRect(ctx, x - 10, y - 8, 20, 4, color, dark);
    pixelRect(ctx, x - 9, y - 10, 18, 4, color, dark);
    pixelRect(ctx, x - 7, y - 12, 14, 3, color, dark);
    pixelRect(ctx, x - 12, y - 2, 3, 8, color, null);
    pixelRect(ctx, x + 9, y - 2, 3, 8, color, null);
  },
  collisionBox: { x: -12, y: -12, w: 24, h: 26 },
  zOffset: 3,
};

const HAIR_BLOWOUT = {
  id: 'blowout', name: 'Blowout', category: 'special', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 9, y - 5, 18, 14, color, dark);
    pixelRect(ctx, x - 8, y - 8, 16, 4, color, dark);
    pixelRect(ctx, x - 6, y - 11, 12, 4, color, dark);
    pixelRect(ctx, x - 10, y - 1, 3, 6, color, null);
    pixelRect(ctx, x + 7, y - 1, 3, 6, color, null);
  },
  collisionBox: { x: -10, y: -11, w: 20, h: 22 },
  zOffset: 3,
};

const HAIR_HI_TOP_FADE = {
  id: 'hi_top_fade', name: 'Hi-Top Fade', category: 'special', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 2, 14, 5, '#1a1a1a', null);
    pixelRect(ctx, x - 6, y - 6, 12, 5, color, dark);
    pixelRect(ctx, x - 5, y - 16, 10, 12, color, dark);
    pixelRect(ctx, x - 4, y - 15, 8, 10, shadeColor(color, 10), null);
    pixelRect(ctx, x - 3, y - 3, 6, 1, shadeColor(color, 15), null);
  },
  collisionBox: { x: -7, y: -16, w: 14, h: 23 },
  zOffset: 3,
};

const HAIR_DREADS = {
  id: 'dreads', name: 'Dreads', category: 'special', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 9, y - 4, 18, 8, color, dark);
    pixelRect(ctx, x - 8, y - 7, 16, 4, color, dark);
    for (let i = 0; i < 7; i++) {
      pixelRect(ctx, x - 8 + i * 2, y + 2, 2, 14 + (i % 3) * 2, color, dark);
    }
  },
  collisionBox: { x: -9, y: -7, w: 18, h: 26 },
  zOffset: 2,
};

// =============================================================================
// BONUS STYLES (5 extra to hit 100+)
// =============================================================================

const HAIR_CROP_TOP_FADE = {
  id: 'crop_top_fade', name: 'Crop Top Fade', category: 'special', gender: 'male',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 2, 14, 5, '#1a1a1a', null);
    pixelRect(ctx, x - 6, y - 5, 12, 4, color, dark);
    pixelRect(ctx, x - 5, y - 10, 10, 6, color, dark);
    pixelRect(ctx, x - 4, y - 9, 8, 4, shadeColor(color, 10), null);
  },
  collisionBox: { x: -7, y: -10, w: 14, h: 17 },
  zOffset: 3,
};

const HAIR_BRAIDED_LOCS = {
  id: 'braided_locs', name: 'Braided Locs', category: 'braids', gender: 'unisex',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 9, y - 4, 18, 8, color, dark);
    pixelRect(ctx, x - 8, y - 7, 16, 4, color, dark);
    for (let i = 0; i < 6; i++) {
      pixelRect(ctx, x - 7 + i * 2, y + 2, 2, 16, color, dark);
    }
  },
  collisionBox: { x: -9, y: -7, w: 18, h: 25 },
  zOffset: 2,
};

const HAIR_LOB_LAYERS = {
  id: 'lob_layers', name: 'Lob with Layers', category: 'medium', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 8, y - 3, 16, 8, color, dark);
    pixelRect(ctx, x - 7, y - 6, 14, 4, color, dark);
    pixelRect(ctx, x - 11, y + 2, 4, 12, color, dark);
    pixelRect(ctx, x + 7, y + 2, 4, 12, color, dark);
    pixelRect(ctx, x - 10, y + 8, 3, 4, color, null);
    pixelRect(ctx, x + 7, y + 8, 3, 4, color, null);
  },
  collisionBox: { x: -11, y: -6, w: 22, h: 20 },
  zOffset: 2,
};

const HAIR_CHOPPY_BOB = {
  id: 'choppy_bob', name: 'Choppy Bob', category: 'short', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 7, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 8, y, 3, 6, color, dark);
    pixelRect(ctx, x + 5, y, 3, 6, color, dark);
    pixelRect(ctx, x - 7, y + 3, 2, 3, color, null);
    pixelRect(ctx, x + 5, y + 3, 2, 3, color, null);
    pixelRect(ctx, x - 5, y - 7, 3, 2, color, null);
    pixelRect(ctx, x + 2, y - 7, 3, 2, color, null);
  },
  collisionBox: { x: -8, y: -7, w: 16, h: 13 },
  zOffset: 2,
};

const HAIR_PIXIE_LONG = {
  id: 'pixie_long', name: 'Long Pixie', category: 'short', gender: 'female',
  draw: (ctx, x, y, color, dir) => {
    const dark = shadeColor(color, -20);
    pixelRect(ctx, x - 7, y - 3, 14, 6, color, dark);
    pixelRect(ctx, x - 6, y - 6, 12, 4, color, dark);
    pixelRect(ctx, x - 8, y + 1, 3, 8, color, dark);
    pixelRect(ctx, x + 5, y + 1, 3, 8, color, dark);
    pixelRect(ctx, x + (dir === 1 ? 4 : -6), y - 4, 3, 5, color, null);
  },
  collisionBox: { x: -8, y: -6, w: 16, h: 15 },
  zOffset: 2,
};

// =============================================================================
// MASTER CATALOG
// =============================================================================

/** Array of all 105 hairstyle definitions. */
const HAIR_CATALOG = [
  // Short (18 with bonuses)
  HAIR_BUZZ, HAIR_CREW, HAIR_FADE, HAIR_PIXIE, HAIR_BOB_SHORT, HAIR_UNDERCUT,
  HAIR_TEXTURED, HAIR_SPIKY_SHORT, HAIR_FLAT_TOP, HAIR_CAESAR, HAIR_FRENCH_CROP,
  HAIR_SIDE_PART, HAIR_SLICKED, HAIR_MESSY, HAIR_BEDHEAD, HAIR_CHOPPY_BOB,
  HAIR_PIXIE_LONG,
  // Medium (21 with bonuses)
  HAIR_BOB, HAIR_LOB, HAIR_SHAG, HAIR_WOLF_CUT, HAIR_CURTAIN, HAIR_MIDDLE_PART,
  HAIR_LAYERED, HAIR_FEATHERED, HAIR_WEDGE, HAIR_PAGEBOY, HAIR_BOWL_CUT,
  HAIR_MUSHROOM, HAIR_MOP_TOP, HAIR_SKATER, HAIR_EMO, HAIR_SCENE, HAIR_INDIE,
  HAIR_SURFER, HAIR_PREPPY, HAIR_BUSINESSMAN, HAIR_LOB_LAYERS,
  // Long (20)
  HAIR_STRAIGHT_LONG, HAIR_WAVY_LONG, HAIR_CURLY_LONG, HAIR_LAYERED_LONG,
  HAIR_FEATHERED_LONG, HAIR_70S_SHAG, HAIR_80S_PERM, HAIR_90S_BOYBAND,
  HAIR_GOTH_LONG, HAIR_HIPPIE, HAIR_BOHEMIAN, HAIR_ROCKER, HAIR_METALHEAD,
  HAIR_VIKING, HAIR_SURFER_LONG, HAIR_PREPPY_LONG, HAIR_BUSINESSMAN_LONG,
  HAIR_ARTIST, HAIR_POET, HAIR_ROMANTIC,
  // Updos (15)
  HAIR_PONYTAIL_HIGH, HAIR_PONYTAIL_LOW, HAIR_PONYTAIL_SIDE, HAIR_BUN_HIGH,
  HAIR_BUN_LOW, HAIR_MESSY_BUN, HAIR_SPACE_BUNS, HAIR_TOP_KNOT, HAIR_CHIGNON,
  HAIR_FRENCH_TWIST, HAIR_BRAIDED_BUN, HAIR_CROWN_BRAID_UPDOS, HAIR_HALF_UP,
  HAIR_PIGTAILS, HAIR_PIGTAIL_BUNS,
  // Braids (17 with bonuses)
  HAIR_SINGLE_BRAID, HAIR_TWIN_BRAIDS, HAIR_FRENCH_BRAID, HAIR_DUTCH_BRAID,
  HAIR_FISHTAIL, HAIR_WATERFALL, HAIR_CROWN_BRAID_FULL, HAIR_SIDE_BRAID,
  HAIR_PULL_THROUGH, HAIR_ROPE_BRAID, HAIR_BOX_BRAIDS, HAIR_CORNROWS,
  HAIR_HALO_BRAID, HAIR_BRAIDED_PONY, HAIR_FOUR_STRAND, HAIR_BRAIDED_LOCS,
  // Special (16 with bonuses)
  HAIR_MOHAWK, HAIR_FAUX_HAWK, HAIR_LIBERTY_SPIKES, HAIR_DEATH_HAWK,
  HAIR_UNDERCUT_LONG, HAIR_SHAVED_SIDES, HAIR_RAT_TAIL, HAIR_MULLET,
  HAIR_SKULLET, HAIR_POMPADOUR, HAIR_QUIFF, HAIR_AFRO, HAIR_BLOWOUT,
  HAIR_HI_TOP_FADE, HAIR_DREADS, HAIR_CROP_TOP_FADE,
];

/** Lookup map by hairstyle ID for O(1) retrieval. */
const HAIR_BY_ID = Object.fromEntries(HAIR_CATALOG.map((h) => [h.id, h]));

/** Category names for UI display. */
const HAIR_CATEGORIES = {
  short: 'Short',
  medium: 'Medium',
  long: 'Long',
  updos: 'Updos',
  braids: 'Braids',
  special: 'Special',
};

/**
 * Get hairstyles filtered by category and optionally gender.
 * @param {string|null} category — Category key or null for all.
 * @param {string|null} gender — 'male'|'female'|'unisex' or null for all.
 * @returns {Array<Object>} Filtered hairstyles.
 */
function getHairstyles(category = null, gender = null) {
  return HAIR_CATALOG.filter((h) => {
    if (category && h.category !== category) return false;
    if (gender && h.gender !== gender && h.gender !== 'unisex') return false;
    return true;
  });
}

/**
 * Draw a hairstyle by ID onto a canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} hairId
 * @param {number} x — Head center X.
 * @param {number} y — Head top Y.
 * @param {string} color — Hair color HEX.
 * @param {number} direction — 0=S,1=E,2=N,3=W.
 */
function drawHairstyle(ctx, hairId, x, y, color, direction) {
  const hair = HAIR_BY_ID[hairId];
  if (!hair) return;
  ctx.save();
  hair.draw(ctx, x, y, color, direction);
  ctx.restore();
}

/**
 * Get collision box for a hairstyle (merged with base head).
 * @param {string} hairId
 * @returns {{x:number,y:number,w:number,h:number}|null}
 */
function getHairCollisionBox(hairId) {
  const hair = HAIR_BY_ID[hairId];
  return hair ? hair.collisionBox : null;
}

/**
 * Get z-layer offset for a hairstyle.
 * @param {string} hairId
 * @returns {number}
 */
function getHairZOffset(hairId) {
  const hair = HAIR_BY_ID[hairId];
  return hair ? hair.zOffset : 0;
}

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HAIR_CATALOG,
    HAIR_BY_ID,
    HAIR_CATEGORIES,
    getHairstyles,
    drawHairstyle,
    getHairCollisionBox,
    getHairZOffset,
    shadeColor,
    pixelRect,
  };
}
