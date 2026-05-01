/**
 * @file PixelEmoji.js
 * @description Aseprite-quality procedural 16×16 pixel-art emoji generator for Starlight Inn v8.0.
 * Replaces every text emoji with Canvas 2D sprites: 1 px black outlines, flat vibrant colours,
 * transparent backgrounds, pixel-perfect rendering.
 *
 * @module sprites/PixelEmoji
 * @version 8.0.0
 */

// ============================================================
// PALETTE — flat vibrant colours used across all emojis
// ============================================================

/** @constant {Object<string, string>} PALETTE */
const PAL = {
  outline: '#111111',
  skin: '#FFCC99',
  skinDark: '#E5A878',
  hair: '#5A3A1A',
  red: '#E53935',
  darkRed: '#B71C1C',
  pink: '#FF80AB',
  hotPink: '#F50057',
  purple: '#9C27B0',
  deepPurple: '#6A1B9A',
  blue: '#2196F3',
  darkBlue: '#1565C0',
  lightBlue: '#81D4FA',
  cyan: '#00BCD4',
  teal: '#009688',
  green: '#4CAF50',
  darkGreen: '#2E7D32',
  lime: '#CDDC39',
  yellow: '#FFEB3B',
  amber: '#FFC107',
  orange: '#FF9800',
  deepOrange: '#E64A19',
  brown: '#795548',
  grey: '#9E9E9E',
  darkGrey: '#424242',
  lightGrey: '#E0E0E0',
  white: '#FFFFFF',
  black: '#000000',
  gold: '#FFD700',
  silver: '#C0C0C0',
  cream: '#FFF8E1',
  wood: '#8D6E63',
};

// ============================================================
// LOW-LEVEL PIXEL HELPERS
// ============================================================

/**
 * Draw a single pixel (1×1 rect) at logical coordinates.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {string} color
 * @param {number} [size=1]
 */
function px(ctx, x, y, color, size = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
}

/**
 * Draw a filled rectangle of pixels.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} color
 */
function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/**
 * Draw a 1 px outline around a rectangle.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {string} color
 */
function outlineRect(ctx, x, y, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/**
 * Draw a filled circle using midpoint algorithm (pixelated).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {string} fill
 * @param {string} [stroke]
 */
function circ(ctx, cx, cy, r, fill, stroke = PAL.outline) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx + 0.5, cy + 0.5, r, 0, Math.PI * 2);
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * Draw a pixel-perfect line (Bresenham-ish via fillRect steps).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {string} color
 */
function line(ctx, x0, y0, x1, y1, color) {
  ctx.fillStyle = color;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  while (true) {
    ctx.fillRect(x, y, 1, 1);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

/**
 * Draw a symmetric pixel pattern (mirrors horizontally & vertically around centre).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {Array<[number, number]>} offsets — [[dx,dy], ...]
 * @param {string} color
 */
function sym4(ctx, cx, cy, offsets, color) {
  ctx.fillStyle = color;
  for (const [dx, dy] of offsets) {
    ctx.fillRect(cx + dx, cy + dy, 1, 1);
    ctx.fillRect(cx - dx - 1, cy + dy, 1, 1);
    ctx.fillRect(cx + dx, cy - dy - 1, 1, 1);
    ctx.fillRect(cx - dx - 1, cy - dy - 1, 1, 1);
  }
}

/**
 * Draw a symmetric pixel pattern mirrored only horizontally.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {Array<[number, number]>} offsets
 * @param {string} color
 */
function symH(ctx, cx, cy, offsets, color) {
  ctx.fillStyle = color;
  for (const [dx, dy] of offsets) {
    ctx.fillRect(cx + dx, cy + dy, 1, 1);
    ctx.fillRect(cx - dx - 1, cy + dy, 1, 1);
  }
}

// ============================================================
// EMOJI DRAWERS — each receives a 16×16 CanvasRenderingContext2D
// ============================================================

const DRAWERS = {

  // ── UI / Action ───────────────────────────────────────────

  /** 👤 person silhouette */
  profile(ctx) {
    // head
    circ(ctx, 8, 5, 3, PAL.skin, PAL.outline);
    // shoulders
    rect(ctx, 3, 9, 10, 6, PAL.skinDark);
    outlineRect(ctx, 3, 9, 10, 6, PAL.outline);
    // neck fill
    rect(ctx, 6, 7, 4, 3, PAL.skin);
    outlineRect(ctx, 6, 7, 4, 3, PAL.outline);
    // hair
    px(ctx, 5, 3, PAL.hair);
    px(ctx, 6, 2, PAL.hair);
    px(ctx, 7, 2, PAL.hair);
    px(ctx, 8, 2, PAL.hair);
    px(ctx, 9, 2, PAL.hair);
    px(ctx, 10, 3, PAL.hair);
    px(ctx, 11, 4, PAL.hair);
  },

  /** 💬 speech bubble with dots */
  whisper(ctx) {
    // bubble body
    rect(ctx, 2, 2, 12, 9, PAL.white);
    outlineRect(ctx, 2, 2, 12, 9, PAL.outline);
    // tail
    px(ctx, 3, 11, PAL.outline);
    px(ctx, 2, 12, PAL.outline);
    px(ctx, 3, 12, PAL.white);
    // three dots
    px(ctx, 5, 6, PAL.darkGrey);
    px(ctx, 8, 6, PAL.darkGrey);
    px(ctx, 11, 6, PAL.darkGrey);
  },

  /** ⭐ star icon */
  friend(ctx) {
    const yellow = PAL.yellow;
    const orange = PAL.orange;
    const o = PAL.outline;
    // 5-point star drawn as symmetric pixel offsets from centre (7.5,7.5)
    const starPoints = [
      [0, -6], [1, -4], [2, -3], [4, -3], [5, -4],
      [5, -2], [4, -1], [4, 1], [5, 2], [3, 3],
      [2, 5], [0, 4], [-2, 5], [-3, 3], [-4, 1],
      [-4, -1], [-5, -2], [-5, -4], [-4, -3], [-2, -3], [-1, -4],
    ];
    // Fill
    ctx.fillStyle = yellow;
    for (const [dx, dy] of starPoints) {
      ctx.fillRect(7 + dx, 7 + dy, 1, 1);
      ctx.fillRect(8 + dx, 7 + dy, 1, 1);
    }
    // Outline (manual trace)
    const outlinePts = [
      [7, 1], [8, 1], [9, 2], [10, 4], [12, 5], [11, 7], [10, 9], [11, 11],
      [9, 10], [7, 12], [8, 12], [6, 10], [4, 11], [5, 9], [4, 7], [5, 5],
      [4, 4], [6, 4], [6, 2],
    ];
    ctx.fillStyle = o;
    for (const [x, y] of outlinePts) ctx.fillRect(x, y, 1, 1);
    // centre highlight
    px(ctx, 7, 6, PAL.cream);
    px(ctx, 8, 6, PAL.cream);
  },

  /** 🤝 two hands shaking */
  trade(ctx) {
    const s = PAL.skin; const d = PAL.skinDark; const o = PAL.outline;
    // left hand
    rect(ctx, 2, 5, 5, 5, s);
    outlineRect(ctx, 2, 5, 5, 5, o);
    px(ctx, 2, 4, o); px(ctx, 3, 4, o); px(ctx, 4, 4, o);
    // right hand
    rect(ctx, 9, 5, 5, 5, d);
    outlineRect(ctx, 9, 5, 5, 5, o);
    px(ctx, 11, 4, o); px(ctx, 12, 4, o); px(ctx, 13, 4, o);
    // shake overlap
    rect(ctx, 6, 6, 4, 4, s);
    outlineRect(ctx, 6, 6, 4, 4, o);
    // thumb details
    px(ctx, 5, 7, o);
    px(ctx, 10, 7, o);
  },

  /** 🚫 circle with slash */
  ignore(ctx) {
    circ(ctx, 8, 8, 6, PAL.red, PAL.outline);
    // slash
    line(ctx, 4, 4, 12, 12, PAL.white);
    line(ctx, 3, 4, 4, 3, PAL.outline);
    line(ctx, 11, 13, 13, 11, PAL.outline);
    // white border on slash
    px(ctx, 4, 4, PAL.white);
    px(ctx, 12, 12, PAL.white);
  },

  /** ⚠️ triangle with exclamation */
  report(ctx) {
    const y = PAL.yellow;
    const o = PAL.outline;
    // triangle fill
    for (let row = 0; row < 7; row++) {
      const w = row * 2 + 1;
      const startX = 8 - Math.floor(w / 2);
      rect(ctx, startX, 2 + row, w, 1, y);
    }
    // triangle outline
    line(ctx, 8, 1, 14, 13, o);
    line(ctx, 14, 13, 2, 13, o);
    line(ctx, 2, 13, 8, 1, o);
    // exclamation
    rect(ctx, 7, 4, 2, 4, o);
    px(ctx, 7, 10, o); px(ctx, 8, 10, o);
  },

  /** ⚙️ gear/cog */
  settings(ctx) {
    const g = PAL.grey; const o = PAL.outline;
    // centre
    circ(ctx, 8, 8, 3, g, o);
    // 8 teeth
    const teeth = [
      [6, 1, 4, 2], [12, 3, 2, 4], [12, 9, 2, 4], [6, 13, 4, 2],
      [2, 3, 2, 4], [2, 9, 2, 4], [6, 1, 4, 2], [6, 13, 4, 2],
    ];
    ctx.fillStyle = g;
    for (const [x, y, w, h] of teeth) {
      ctx.fillRect(x, y, w, h);
      outlineRect(ctx, x, y, w, h, o);
    }
  },

  /** 🎒 backpack */
  inventory(ctx) {
    const b = PAL.blue; const o = PAL.outline; const y = PAL.yellow;
    // main body
    rect(ctx, 5, 5, 6, 9, b);
    outlineRect(ctx, 5, 5, 6, 9, o);
    // flap
    rect(ctx, 5, 5, 6, 3, PAL.darkBlue);
    // pocket
    rect(ctx, 6, 8, 4, 3, PAL.lightBlue);
    outlineRect(ctx, 6, 8, 4, 3, o);
    // straps
    line(ctx, 4, 6, 4, 12, o);
    line(ctx, 11, 6, 11, 12, o);
    // handle
    px(ctx, 7, 4, o); px(ctx, 8, 4, o);
    // buckle
    px(ctx, 7, 6, y); px(ctx, 8, 6, y);
  },

  /** 🏪 shop building */
  catalog(ctx) {
    const w = PAL.white; const r = PAL.red; const o = PAL.outline; const br = PAL.brown;
    // awning
    for (let x = 2; x < 14; x += 2) {
      rect(ctx, x, 3, 2, 3, (x % 4 === 2) ? r : w);
    }
    outlineRect(ctx, 2, 3, 12, 3, o);
    // building body
    rect(ctx, 3, 6, 10, 8, w);
    outlineRect(ctx, 3, 6, 10, 8, o);
    // door
    rect(ctx, 6, 10, 4, 4, br);
    outlineRect(ctx, 6, 10, 4, 4, o);
    // window
    rect(ctx, 4, 7, 3, 2, PAL.lightBlue);
    outlineRect(ctx, 4, 7, 3, 2, o);
    rect(ctx, 9, 7, 3, 2, PAL.lightBlue);
    outlineRect(ctx, 9, 7, 3, 2, o);
    // shop sign "S"
    px(ctx, 7, 2, o); px(ctx, 8, 2, o);
    px(ctx, 7, 3, o); px(ctx, 8, 3, o);
  },

  /** 💬 chat bubble */
  chat(ctx) {
    const w = PAL.white; const o = PAL.outline;
    rect(ctx, 1, 2, 14, 9, w);
    outlineRect(ctx, 1, 2, 14, 9, o);
    // tail
    px(ctx, 3, 11, o);
    px(ctx, 2, 12, o);
    px(ctx, 3, 12, w);
    px(ctx, 2, 13, w);
    // lines inside
    rect(ctx, 3, 4, 8, 1, PAL.lightGrey);
    rect(ctx, 3, 6, 10, 1, PAL.lightGrey);
    rect(ctx, 3, 8, 6, 1, PAL.lightGrey);
  },

  /** 👥 two people */
  friends_list(ctx) {
    const s = PAL.skin; const o = PAL.outline; const h = PAL.hair;
    // person 1 (front)
    circ(ctx, 6, 5, 2, s, o);
    rect(ctx, 4, 7, 4, 5, s);
    outlineRect(ctx, 4, 7, 4, 5, o);
    px(ctx, 4, 3, h); px(ctx, 5, 3, h); px(ctx, 6, 3, h); px(ctx, 7, 3, h);
    // person 2 (behind, offset)
    circ(ctx, 11, 6, 2, s, o);
    rect(ctx, 9, 8, 4, 5, s);
    outlineRect(ctx, 9, 8, 4, 5, o);
    px(ctx, 9, 4, h); px(ctx, 10, 4, h); px(ctx, 11, 4, h); px(ctx, 12, 4, h);
  },

  /** 🎮 game controller */
  minigames(ctx) {
    const g = PAL.darkGrey; const o = PAL.outline; const r = PAL.red; const b = PAL.blue;
    // body
    rect(ctx, 3, 5, 10, 6, g);
    outlineRect(ctx, 3, 5, 10, 6, o);
    // handles
    rect(ctx, 2, 8, 2, 4, g);
    rect(ctx, 12, 8, 2, 4, g);
    outlineRect(ctx, 2, 8, 2, 4, o);
    outlineRect(ctx, 12, 8, 2, 4, o);
    // d-pad
    rect(ctx, 5, 7, 3, 1, PAL.lightGrey);
    rect(ctx, 6, 6, 1, 3, PAL.lightGrey);
    // buttons
    px(ctx, 10, 7, r);
    px(ctx, 11, 6, b);
    px(ctx, 12, 7, PAL.green);
    // start/select
    px(ctx, 8, 10, PAL.grey);
    px(ctx, 9, 10, PAL.grey);
  },

  /** 🏆 trophy */
  achievements(ctx) {
    const g = PAL.gold; const o = PAL.outline; const y = PAL.yellow;
    // cup body
    rect(ctx, 5, 4, 6, 6, g);
    outlineRect(ctx, 5, 4, 6, 6, o);
    // handles
    px(ctx, 4, 5, g); px(ctx, 4, 6, g); px(ctx, 3, 6, g);
    px(ctx, 11, 5, g); px(ctx, 11, 6, g); px(ctx, 12, 6, g);
    outlineRect(ctx, 3, 5, 2, 3, o);
    outlineRect(ctx, 11, 5, 2, 3, o);
    // stem & base
    rect(ctx, 7, 10, 2, 3, g);
    outlineRect(ctx, 7, 10, 2, 3, o);
    rect(ctx, 5, 13, 6, 2, g);
    outlineRect(ctx, 5, 13, 6, 2, o);
    // shine
    px(ctx, 6, 5, y); px(ctx, 6, 6, y);
  },

  /** 🎖️ medal */
  badges(ctx) {
    const g = PAL.gold; const o = PAL.outline; const r = PAL.red;
    // circle medal
    circ(ctx, 8, 7, 4, g, o);
    // star in centre
    px(ctx, 8, 5, o); px(ctx, 7, 6, o); px(ctx, 9, 6, o);
    px(ctx, 7, 7, o); px(ctx, 9, 7, o); px(ctx, 8, 8, o);
    // ribbon
    rect(ctx, 6, 11, 4, 2, r);
    outlineRect(ctx, 6, 11, 4, 2, o);
    px(ctx, 6, 13, r); px(ctx, 9, 13, r);
    // ribbon V
    px(ctx, 7, 13, r); px(ctx, 8, 13, r);
    px(ctx, 7, 14, r); px(ctx, 8, 14, r);
    px(ctx, 7, 15, r); px(ctx, 8, 15, r);
  },

  /** 💎 diamond/gem */
  store(ctx) {
    const c = PAL.cyan; const o = PAL.outline; const w = PAL.white;
    // top facet
    line(ctx, 6, 2, 10, 2, o);
    line(ctx, 5, 3, 11, 3, o);
    // sides
    line(ctx, 4, 4, 4, 8, o);
    line(ctx, 12, 4, 12, 8, o);
    // bottom point
    line(ctx, 4, 8, 8, 13, o);
    line(ctx, 12, 8, 8, 13, o);
    // fill facets
    rect(ctx, 6, 4, 4, 2, c);
    rect(ctx, 5, 5, 2, 3, PAL.lightBlue);
    rect(ctx, 9, 5, 2, 3, PAL.blue);
    rect(ctx, 6, 8, 4, 2, c);
    px(ctx, 7, 10, c); px(ctx, 8, 10, c);
    px(ctx, 7, 11, c); px(ctx, 8, 11, c);
    // shine
    px(ctx, 6, 4, w); px(ctx, 7, 5, w);
  },

  /** 🪙 coin stack */
  coins(ctx) {
    const g = PAL.gold; const o = PAL.outline; const y = PAL.yellow;
    // three coins stacked
    for (let i = 0; i < 3; i++) {
      const yy = 11 - i * 3;
      rect(ctx, 5, yy, 6, 2, g);
      outlineRect(ctx, 5, yy, 6, 2, o);
      px(ctx, 7, yy, y); px(ctx, 8, yy, y);
    }
    // "$" on top coin
    px(ctx, 7, 5, o); px(ctx, 8, 5, o);
    px(ctx, 7, 6, o); px(ctx, 8, 6, o);
  },

  /** ✕ X mark */
  close(ctx) {
    const r = PAL.red; const o = PAL.outline;
    line(ctx, 3, 3, 12, 12, o);
    line(ctx, 4, 3, 13, 12, o);
    line(ctx, 3, 4, 12, 13, o);
    line(ctx, 12, 3, 3, 12, o);
    line(ctx, 13, 3, 4, 12, o);
    line(ctx, 12, 4, 3, 13, o);
    // thick inner
    line(ctx, 4, 4, 11, 11, r);
    line(ctx, 11, 4, 4, 11, r);
  },

  /** ← left arrow */
  back(ctx) {
    const b = PAL.blue; const o = PAL.outline;
    line(ctx, 7, 2, 2, 7, o);
    line(ctx, 8, 2, 3, 7, o);
    line(ctx, 7, 12, 2, 7, o);
    line(ctx, 8, 12, 3, 7, o);
    line(ctx, 2, 7, 14, 7, o);
    line(ctx, 2, 8, 14, 8, o);
    // fill
    for (let y = 3; y <= 11; y++) {
      const w = 7 - Math.abs(y - 7);
      rect(ctx, 3, y, w, 1, b);
    }
    rect(ctx, 3, 7, 11, 2, b);
  },

  /** ▶️ play triangle */
  play(ctx) {
    const g = PAL.green; const o = PAL.outline;
    for (let row = 0; row < 11; row++) {
      const x = 2 + row;
      const w = 1 + Math.floor(row / 1.5);
      rect(ctx, x, 8 - Math.floor(w / 2), w, 1, g);
    }
    // outline
    line(ctx, 2, 3, 2, 12, o);
    line(ctx, 2, 3, 13, 8, o);
    line(ctx, 2, 12, 13, 8, o);
  },

  /** 🎵 musical note */
  music(ctx) {
    const b = PAL.blue; const o = PAL.outline;
    // note head
    circ(ctx, 5, 11, 2, b, o);
    // stem
    rect(ctx, 7, 3, 1, 9, b);
    outlineRect(ctx, 7, 3, 1, 9, o);
    // beam
    rect(ctx, 7, 3, 6, 2, b);
    outlineRect(ctx, 7, 3, 6, 2, o);
    // flag curl
    px(ctx, 13, 4, o); px(ctx, 13, 5, o); px(ctx, 12, 5, b);
  },

  /** 🔊 speaker */
  sound(ctx) {
    const g = PAL.grey; const o = PAL.outline;
    // speaker body (trapezoid-ish)
    rect(ctx, 2, 5, 4, 6, g);
    outlineRect(ctx, 2, 5, 4, 6, o);
    // cone
    rect(ctx, 6, 3, 2, 10, g);
    outlineRect(ctx, 6, 3, 2, 10, o);
    rect(ctx, 8, 2, 2, 12, g);
    outlineRect(ctx, 8, 2, 2, 12, o);
    // sound waves
    px(ctx, 12, 5, o); px(ctx, 12, 10, o);
    px(ctx, 13, 4, o); px(ctx, 13, 11, o);
    px(ctx, 14, 3, o); px(ctx, 14, 12, o);
  },

  /** 🔇 muted speaker */
  mute(ctx) {
    const g = PAL.grey; const o = PAL.outline;
    // speaker body
    rect(ctx, 2, 5, 4, 6, g);
    outlineRect(ctx, 2, 5, 4, 6, o);
    rect(ctx, 6, 3, 2, 10, g);
    outlineRect(ctx, 6, 3, 2, 10, o);
    rect(ctx, 8, 2, 2, 12, g);
    outlineRect(ctx, 8, 2, 2, 12, o);
    // red X over it
    line(ctx, 11, 3, 14, 13, PAL.red);
    line(ctx, 14, 3, 11, 13, PAL.red);
    line(ctx, 11, 3, 14, 13, o);
    line(ctx, 14, 3, 11, 13, o);
  },

  // ── Status dots ───────────────────────────────────────────

  /** 🟢 green dot */
  online(ctx) {
    circ(ctx, 8, 8, 5, PAL.green, PAL.outline);
    px(ctx, 6, 6, PAL.lightGrey);
    px(ctx, 7, 6, PAL.white);
  },

  /** ⚪ grey dot */
  offline(ctx) {
    circ(ctx, 8, 8, 5, PAL.lightGrey, PAL.outline);
    px(ctx, 6, 6, PAL.white);
  },

  /** 🟡 yellow dot */
  away(ctx) {
    circ(ctx, 8, 8, 5, PAL.yellow, PAL.outline);
    px(ctx, 6, 6, PAL.cream);
    px(ctx, 7, 6, PAL.white);
  },

  /** 🔴 red dot */
  busy(ctx) {
    circ(ctx, 8, 8, 5, PAL.red, PAL.outline);
    px(ctx, 6, 6, PAL.pink);
    px(ctx, 7, 6, PAL.white);
  },

  // ── Social / Heart ──────────────────────────────────────

  /** ❤️ pixel heart */
  heart(ctx) {
    const r = PAL.red; const o = PAL.outline; const p = PAL.pink;
    // top bumps
    rect(ctx, 4, 3, 3, 2, r);
    rect(ctx, 9, 3, 3, 2, r);
    outlineRect(ctx, 4, 3, 3, 2, o);
    outlineRect(ctx, 9, 3, 3, 2, o);
    // body fill
    rect(ctx, 4, 5, 8, 4, r);
    rect(ctx, 5, 9, 6, 2, r);
    rect(ctx, 6, 11, 4, 2, r);
    rect(ctx, 7, 13, 2, 1, r);
    // outline trace
    line(ctx, 3, 4, 3, 6, o);
    line(ctx, 3, 6, 7, 13, o);
    line(ctx, 7, 13, 9, 13, o);
    line(ctx, 9, 13, 13, 6, o);
    line(ctx, 13, 6, 13, 4, o);
    line(ctx, 12, 3, 10, 3, o);
    line(ctx, 7, 3, 5, 3, o);
    // shine
    px(ctx, 5, 4, p); px(ctx, 6, 5, p);
  },

  /** 🎁 gift box */
  gift(ctx) {
    const r = PAL.red; const o = PAL.outline; const g = PAL.gold;
    // box
    rect(ctx, 3, 6, 10, 8, r);
    outlineRect(ctx, 3, 6, 10, 8, o);
    // vertical ribbon
    rect(ctx, 7, 6, 2, 8, g);
    outlineRect(ctx, 7, 6, 2, 8, o);
    // horizontal ribbon
    rect(ctx, 3, 9, 10, 2, g);
    outlineRect(ctx, 3, 9, 10, 2, o);
    // lid
    rect(ctx, 2, 5, 12, 2, r);
    outlineRect(ctx, 2, 5, 12, 2, o);
    // bow
    px(ctx, 6, 3, g); px(ctx, 9, 3, g);
    px(ctx, 7, 2, g); px(ctx, 8, 2, g);
    px(ctx, 7, 4, g); px(ctx, 8, 4, g);
  },

  /** 🔔 bell */
  notification(ctx) {
    const g = PAL.gold; const o = PAL.outline; const y = PAL.yellow;
    // bell body
    rect(ctx, 5, 4, 6, 8, g);
    outlineRect(ctx, 5, 4, 6, 8, o);
    // rounded top
    px(ctx, 6, 3, g); px(ctx, 7, 3, g); px(ctx, 8, 3, g); px(ctx, 9, 3, g);
    px(ctx, 6, 3, o); px(ctx, 9, 3, o);
    px(ctx, 5, 2, o); px(ctx, 6, 2, o); px(ctx, 9, 2, o); px(ctx, 10, 2, o);
    // clapper
    px(ctx, 7, 12, o); px(ctx, 8, 12, o);
    px(ctx, 7, 13, o); px(ctx, 8, 13, o);
    // shine
    px(ctx, 6, 5, y); px(ctx, 6, 6, y);
  },

  /** 🔍 magnifying glass */
  search(ctx) {
    const l = PAL.lightBlue; const o = PAL.outline; const w = PAL.white;
    // lens
    circ(ctx, 7, 7, 5, l, o);
    // inner white ring
    circ(ctx, 7, 7, 3, w, null);
    // handle
    line(ctx, 11, 11, 14, 14, o);
    line(ctx, 10, 12, 13, 15, o);
    rect(ctx, 11, 11, 3, 3, PAL.wood);
  },

  /** ✏️ pencil */
  edit(ctx) {
    const y = PAL.yellow; const o = PAL.outline; const p = PAL.pink;
    // body
    rect(ctx, 3, 2, 3, 10, y);
    outlineRect(ctx, 3, 2, 3, 10, o);
    // eraser
    rect(ctx, 3, 1, 3, 2, p);
    outlineRect(ctx, 3, 1, 3, 2, o);
    // metal band
    rect(ctx, 3, 11, 3, 1, PAL.grey);
    outlineRect(ctx, 3, 11, 3, 1, o);
    // tip
    px(ctx, 4, 13, o);
    px(ctx, 4, 14, o);
    px(ctx, 4, 15, PAL.wood);
  },

  /** 🗑️ trash can */
  delete(ctx) {
    const g = PAL.grey; const o = PAL.outline; const d = PAL.darkGrey;
    // lid
    rect(ctx, 4, 2, 8, 2, d);
    outlineRect(ctx, 4, 2, 8, 2, o);
    px(ctx, 7, 1, o); px(ctx, 8, 1, o);
    // body
    rect(ctx, 5, 4, 6, 10, g);
    outlineRect(ctx, 5, 4, 6, 10, o);
    // lines
    px(ctx, 6, 6, d); px(ctx, 6, 8, d); px(ctx, 6, 10, d);
    px(ctx, 9, 6, d); px(ctx, 9, 8, d); px(ctx, 9, 10, d);
  },

  /** + plus sign */
  add(ctx) {
    const g = PAL.green; const o = PAL.outline;
    rect(ctx, 7, 2, 2, 12, g);
    outlineRect(ctx, 7, 2, 2, 12, o);
    rect(ctx, 2, 7, 12, 2, g);
    outlineRect(ctx, 2, 7, 12, 2, o);
  },

  /** − minus sign */
  remove(ctx) {
    const r = PAL.red; const o = PAL.outline;
    rect(ctx, 3, 7, 10, 2, r);
    outlineRect(ctx, 3, 7, 10, 2, o);
  },

  /** ✓ checkmark */
  check(ctx) {
    const g = PAL.green; const o = PAL.outline;
    line(ctx, 2, 8, 6, 13, o);
    line(ctx, 3, 8, 7, 13, o);
    line(ctx, 6, 13, 14, 3, o);
    line(ctx, 6, 12, 14, 2, o);
    // fill
    for (let x = 2; x <= 6; x++) {
      const yStart = 8 + Math.floor((x - 2) * 1.2);
      rect(ctx, x, yStart, 1, 14 - yStart, g);
    }
    for (let x = 7; x <= 14; x++) {
      const yEnd = 13 - Math.floor((x - 6) * 1.4);
      rect(ctx, x, yEnd, 1, 14 - yEnd, g);
    }
  },

  /** 🔒 lock */
  locked(ctx) {
    const g = PAL.gold; const o = PAL.outline; const d = PAL.darkGrey;
    // shackle
    rect(ctx, 5, 2, 6, 4, d);
    outlineRect(ctx, 5, 2, 6, 4, o);
    rect(ctx, 6, 3, 4, 3, PAL.cream); // hollow
    // body
    rect(ctx, 4, 6, 8, 8, g);
    outlineRect(ctx, 4, 6, 8, 8, o);
    // keyhole
    px(ctx, 7, 9, o); px(ctx, 8, 9, o);
    px(ctx, 7, 10, o); px(ctx, 8, 10, o);
    px(ctx, 7, 11, o); px(ctx, 8, 11, o);
    px(ctx, 7, 12, o); px(ctx, 8, 12, o);
    px(ctx, 8, 8, o);
  },

  /** 🔓 open lock */
  unlocked(ctx) {
    const g = PAL.gold; const o = PAL.outline; const d = PAL.darkGrey;
    // shackle (open, offset right)
    rect(ctx, 7, 2, 5, 4, d);
    outlineRect(ctx, 7, 2, 5, 4, o);
    rect(ctx, 8, 3, 3, 3, PAL.cream);
    px(ctx, 7, 4, PAL.cream);
    // body
    rect(ctx, 4, 6, 8, 8, g);
    outlineRect(ctx, 4, 6, 8, 8, o);
    // keyhole
    px(ctx, 7, 9, o); px(ctx, 8, 9, o);
    px(ctx, 7, 10, o); px(ctx, 8, 10, o);
    px(ctx, 7, 11, o); px(ctx, 8, 11, o);
    px(ctx, 7, 12, o); px(ctx, 8, 12, o);
    px(ctx, 8, 8, o);
  },

  /** 👑 crown */
  vip(ctx) {
    const g = PAL.gold; const o = PAL.outline; const r = PAL.red; const b = PAL.blue;
    // base band
    rect(ctx, 3, 10, 10, 4, g);
    outlineRect(ctx, 3, 10, 10, 4, o);
    // points
    px(ctx, 3, 9, g); px(ctx, 4, 8, g); px(ctx, 5, 7, g); px(ctx, 6, 6, g); px(ctx, 7, 7, g);
    px(ctx, 9, 7, g); px(ctx, 10, 6, g); px(ctx, 11, 7, g); px(ctx, 12, 8, g); px(ctx, 13, 9, g);
    // outline points
    line(ctx, 3, 10, 5, 6, o);
    line(ctx, 5, 6, 7, 8, o);
    line(ctx, 7, 8, 9, 8, o);
    line(ctx, 9, 8, 11, 6, o);
    line(ctx, 11, 6, 13, 10, o);
    // jewels
    px(ctx, 5, 9, r); px(ctx, 8, 8, b); px(ctx, 11, 9, r);
    // shine
    px(ctx, 4, 11, PAL.yellow);
  },

  /** 🆕 "NEW" badge */
  new(ctx) {
    const r = PAL.red; const o = PAL.outline; const w = PAL.white;
    // badge shape
    rect(ctx, 2, 4, 12, 8, r);
    outlineRect(ctx, 2, 4, 12, 8, o);
    // N
    rect(ctx, 4, 6, 1, 4, w);
    px(ctx, 5, 6, w); px(ctx, 5, 9, w);
    rect(ctx, 6, 6, 1, 4, w);
    // E
    rect(ctx, 8, 6, 1, 4, w);
    px(ctx, 9, 6, w); px(ctx, 9, 8, w); px(ctx, 9, 9, w);
    // W
    rect(ctx, 11, 6, 1, 4, w);
    px(ctx, 12, 7, w); px(ctx, 12, 9, w);
  },

  /** 🔥 flame */
  hot(ctx) {
    const o = PAL.orange; const r = PAL.red; const y = PAL.yellow;
    // flame body (teardrop-ish)
    const flamePixels = [
      [7, 2], [8, 2],
      [6, 3], [7, 3], [8, 3], [9, 3],
      [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4],
      [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5],
      [6, 6], [7, 6], [8, 6], [9, 6],
      [6, 7], [7, 7], [8, 7], [9, 7],
      [7, 8], [8, 8],
      [7, 9], [8, 9],
      [7, 10], [8, 10],
      [7, 11], [8, 11],
      [7, 12], [8, 12],
      [7, 13], [8, 13],
    ];
    for (const [x, yy] of flamePixels) {
      px(ctx, x, yy, o);
    }
    // inner hot core
    const core = [
      [7, 4], [8, 4], [7, 5], [8, 5], [7, 6], [8, 6],
      [7, 7], [8, 7], [7, 8], [8, 8],
    ];
    for (const [x, yy] of core) px(ctx, x, yy, y);
    // tip red
    px(ctx, 7, 13, r); px(ctx, 8, 13, r);
    // outline
    line(ctx, 6, 3, 5, 5, PAL.outline);
    line(ctx, 10, 3, 11, 5, PAL.outline);
    line(ctx, 5, 6, 6, 8, PAL.outline);
    line(ctx, 11, 6, 10, 8, PAL.outline);
    px(ctx, 6, 9, PAL.outline); px(ctx, 10, 9, PAL.outline);
    px(ctx, 6, 10, PAL.outline); px(ctx, 10, 10, PAL.outline);
  },

  /** ⏰ clock */
  time(ctx) {
    const g = PAL.gold; const o = PAL.outline; const w = PAL.white;
    circ(ctx, 8, 8, 6, g, o);
    // clock face
    circ(ctx, 8, 8, 4, w, null);
    // hands
    line(ctx, 8, 8, 8, 4, o);
    line(ctx, 8, 8, 11, 8, o);
    // bells on top
    px(ctx, 4, 3, g); px(ctx, 12, 3, g);
    px(ctx, 4, 3, o); px(ctx, 12, 3, o);
    px(ctx, 3, 4, o); px(ctx, 13, 4, o);
  },

  /** 📍 map pin */
  location(ctx) {
    const r = PAL.red; const o = PAL.outline;
    // pin head
    circ(ctx, 8, 6, 4, r, o);
    // pin point
    line(ctx, 8, 10, 5, 14, o);
    line(ctx, 8, 10, 11, 14, o);
    // fill point
    rect(ctx, 6, 11, 4, 2, r);
    px(ctx, 7, 13, r); px(ctx, 8, 13, r); px(ctx, 9, 13, r);
    // centre dot
    circ(ctx, 8, 6, 1, o, null);
  },

  // ── Gestures / Expressions ────────────────────────────────

  /** 💃 dancing figure */
  dance(ctx) {
    const s = PAL.skin; const o = PAL.outline; const d = PAL.skinDark;
    // head
    circ(ctx, 8, 3, 2, s, o);
    // body / dress
    rect(ctx, 6, 5, 4, 4, PAL.pink);
    outlineRect(ctx, 6, 5, 4, 4, o);
    // legs
    line(ctx, 7, 9, 6, 14, o);
    line(ctx, 8, 9, 9, 14, o);
    // arms up
    line(ctx, 5, 6, 3, 3, o);
    line(ctx, 9, 6, 11, 3, o);
    // arm fill
    px(ctx, 4, 4, s); px(ctx, 3, 4, s);
    px(ctx, 11, 4, s); px(ctx, 12, 4, s);
  },

  /** 🪑 chair */
  sit(ctx) {
    const w = PAL.wood; const o = PAL.outline; const r = PAL.red;
    // seat
    rect(ctx, 4, 8, 8, 2, w);
    outlineRect(ctx, 4, 8, 8, 2, o);
    // back
    rect(ctx, 4, 2, 2, 7, w);
    outlineRect(ctx, 4, 2, 2, 7, o);
    // back slats
    px(ctx, 4, 4, o); px(ctx, 5, 4, o);
    px(ctx, 4, 6, o); px(ctx, 5, 6, o);
    // legs
    line(ctx, 5, 10, 5, 14, o);
    line(ctx, 11, 10, 11, 14, o);
    // cushion
    rect(ctx, 6, 7, 6, 2, r);
  },

  /** 👋 waving hand */
  wave(ctx) {
    const s = PAL.skin; const o = PAL.outline;
    // palm
    rect(ctx, 6, 6, 5, 5, s);
    outlineRect(ctx, 6, 6, 5, 5, o);
    // fingers
    px(ctx, 6, 4, s); px(ctx, 6, 3, o);
    px(ctx, 7, 3, s); px(ctx, 7, 2, o);
    px(ctx, 8, 3, s); px(ctx, 8, 2, o);
    px(ctx, 9, 4, s); px(ctx, 9, 3, o);
    px(ctx, 10, 5, s); px(ctx, 10, 4, o);
    // thumb
    px(ctx, 5, 7, s); px(ctx, 4, 8, o);
    // wrist
    rect(ctx, 7, 11, 3, 3, s);
    outlineRect(ctx, 7, 11, 3, 3, o);
  },

  /** 😴 sleeping face */
  sleep(ctx) {
    const s = PAL.skin; const o = PAL.outline; const b = PAL.blue;
    // face
    circ(ctx, 8, 8, 6, s, o);
    // closed eyes
    line(ctx, 5, 7, 7, 7, o);
    line(ctx, 9, 7, 11, 7, o);
    // open mouth
    px(ctx, 7, 10, o); px(ctx, 8, 10, o); px(ctx, 9, 10, o);
    // "Zzz"
    px(ctx, 12, 3, b); px(ctx, 13, 3, b);
    px(ctx, 12, 4, b); px(ctx, 13, 4, b);
    px(ctx, 13, 2, b);
    px(ctx, 11, 1, b); px(ctx, 12, 1, b);
    px(ctx, 11, 2, b);
  },

  /** 😄 laughing face */
  laugh(ctx) {
    const s = PAL.skin; const o = PAL.outline; const w = PAL.white;
    // face
    circ(ctx, 8, 8, 6, s, o);
    // eyes (squint)
    line(ctx, 4, 6, 7, 6, o);
    line(ctx, 9, 6, 12, 6, o);
    line(ctx, 5, 5, 6, 5, o);
    line(ctx, 10, 5, 11, 5, o);
    // big smile
    rect(ctx, 4, 8, 8, 4, w);
    outlineRect(ctx, 4, 8, 8, 4, o);
    // tongue
    rect(ctx, 6, 11, 4, 2, PAL.pink);
    outlineRect(ctx, 6, 11, 4, 2, o);
  },

  /** 💋 lips */
  kiss(ctx) {
    const p = PAL.hotPink; const o = PAL.outline;
    // upper lip
    rect(ctx, 5, 6, 6, 2, p);
    outlineRect(ctx, 5, 6, 6, 2, o);
    // lower lip
    rect(ctx, 5, 8, 6, 2, p);
    outlineRect(ctx, 5, 8, 6, 2, o);
    // heart
    px(ctx, 11, 4, p); px(ctx, 12, 4, p);
    px(ctx, 10, 5, p); px(ctx, 11, 5, p); px(ctx, 12, 5, p); px(ctx, 13, 5, p);
    px(ctx, 11, 6, p); px(ctx, 12, 6, p);
  },

  /** 😢 crying face */
  cry(ctx) {
    const s = PAL.skin; const o = PAL.outline; const b = PAL.blue;
    // face
    circ(ctx, 8, 8, 6, s, o);
    // eyes (tears)
    px(ctx, 5, 6, o); px(ctx, 6, 6, o);
    px(ctx, 10, 6, o); px(ctx, 11, 6, o);
    // tears
    line(ctx, 5, 7, 5, 10, b);
    line(ctx, 11, 7, 11, 10, b);
    // sad mouth
    line(ctx, 5, 11, 8, 12, o);
    line(ctx, 8, 12, 11, 11, o);
  },

  /** 😠 angry face */
  angry(ctx) {
    const s = PAL.skin; const o = PAL.outline; const r = PAL.red;
    // face
    circ(ctx, 8, 8, 6, s, o);
    // angry brows
    line(ctx, 4, 5, 7, 6, o);
    line(ctx, 9, 6, 12, 5, o);
    // eyes
    px(ctx, 5, 7, o); px(ctx, 6, 7, o);
    px(ctx, 10, 7, o); px(ctx, 11, 7, o);
    // frown
    line(ctx, 6, 11, 8, 10, o);
    line(ctx, 8, 10, 10, 11, o);
    // red cheeks
    px(ctx, 4, 9, r); px(ctx, 12, 9, r);
  },

  /** 😮 surprised face */
  surprised(ctx) {
    const s = PAL.skin; const o = PAL.outline; const w = PAL.white;
    // face
    circ(ctx, 8, 8, 6, s, o);
    // wide eyes
    circ(ctx, 5, 6, 1, w, o);
    circ(ctx, 11, 6, 1, w, o);
    px(ctx, 5, 6, o); px(ctx, 11, 6, o);
    // O mouth
    circ(ctx, 8, 11, 2, w, o);
    px(ctx, 8, 11, o);
  },

  /** 😎 sunglasses face */
  cool(ctx) {
    const s = PAL.skin; const o = PAL.outline; const b = PAL.black;
    // face
    circ(ctx, 8, 8, 6, s, o);
    // sunglasses
    rect(ctx, 4, 5, 4, 3, b);
    rect(ctx, 9, 5, 4, 3, b);
    outlineRect(ctx, 4, 5, 4, 3, o);
    outlineRect(ctx, 9, 5, 4, 3, o);
    px(ctx, 8, 6, o); // bridge
    // smirk
    line(ctx, 6, 11, 9, 11, o);
    px(ctx, 9, 10, o);
  },

  /** 😍 heart eyes */
  love(ctx) {
    const s = PAL.skin; const o = PAL.outline; const r = PAL.red;
    // face
    circ(ctx, 8, 8, 6, s, o);
    // heart eyes
    const drawMiniHeart = (cx, cy) => {
      px(ctx, cx, cy - 1, r); px(ctx, cx + 1, cy - 1, r);
      px(ctx, cx - 1, cy, r); px(ctx, cx, cy, r); px(ctx, cx + 1, cy, r); px(ctx, cx + 2, cy, r);
      px(ctx, cx, cy + 1, r); px(ctx, cx + 1, cy + 1, r);
    };
    drawMiniHeart(4, 6);
    drawMiniHeart(9, 6);
    // smile
    line(ctx, 6, 11, 8, 12, o);
    line(ctx, 8, 12, 10, 11, o);
  },

  /** 🤢 sick face */
  sick(ctx) {
    const s = PAL.skin; const o = PAL.outline; const g = PAL.green;
    // face
    circ(ctx, 8, 8, 6, s, o);
    // X eyes
    line(ctx, 4, 5, 7, 7, o);
    line(ctx, 7, 5, 4, 7, o);
    line(ctx, 9, 5, 12, 7, o);
    line(ctx, 12, 5, 9, 7, o);
    // green mouth (nausea)
    rect(ctx, 6, 10, 4, 3, g);
    outlineRect(ctx, 6, 10, 4, 3, o);
    // sweat drop
    px(ctx, 13, 4, PAL.blue); px(ctx, 13, 5, PAL.blue); px(ctx, 14, 5, PAL.blue);
  },

  /** 😕 confused face */
  confused(ctx) {
    const s = PAL.skin; const o = PAL.outline;
    // face
    circ(ctx, 8, 8, 6, s, o);
    // one eye open, one squint
    circ(ctx, 5, 6, 1, PAL.white, o);
    px(ctx, 5, 6, o);
    line(ctx, 9, 6, 12, 6, o);
    // zigzag mouth
    line(ctx, 6, 11, 7, 10, o);
    line(ctx, 7, 10, 8, 11, o);
    line(ctx, 8, 11, 9, 10, o);
    line(ctx, 9, 10, 10, 11, o);
    // question mark
    px(ctx, 13, 3, o); px(ctx, 13, 4, o); px(ctx, 13, 5, o);
    px(ctx, 12, 3, o); px(ctx, 12, 5, o);
    px(ctx, 13, 7, o);
  },

  // ── Accessories / Wearables ─────────────────────────────

  /** 🎩 top hat */
  cool_hat(ctx) {
    const b = PAL.black; const o = PAL.outline; const r = PAL.red;
    // brim
    rect(ctx, 2, 10, 12, 2, b);
    outlineRect(ctx, 2, 10, 12, 2, o);
    // crown
    rect(ctx, 4, 3, 8, 8, b);
    outlineRect(ctx, 4, 3, 8, 8, o);
    // band
    rect(ctx, 4, 9, 8, 1, r);
    // shine
    px(ctx, 5, 4, PAL.grey); px(ctx, 5, 5, PAL.grey);
  },

  /** 🧙 wizard hat */
  wizard(ctx) {
    const p = PAL.purple; const o = PAL.outline; const b = PAL.blue; const y = PAL.yellow;
    // cone
    line(ctx, 2, 12, 8, 2, o);
    line(ctx, 14, 12, 8, 2, o);
    // fill
    for (let row = 0; row < 11; row++) {
      const yPos = 2 + row;
      const halfW = Math.floor((row + 1) * 0.6);
      rect(ctx, 8 - halfW, yPos, halfW * 2 + 1, 1, p);
    }
    // brim
    rect(ctx, 1, 12, 14, 2, p);
    outlineRect(ctx, 1, 12, 14, 2, o);
    // star
    px(ctx, 8, 5, y); px(ctx, 7, 6, y); px(ctx, 9, 6, y);
    px(ctx, 7, 7, y); px(ctx, 9, 7, y); px(ctx, 8, 8, y);
    // moons on brim
    px(ctx, 4, 13, b); px(ctx, 12, 13, b);
  },

  /** 👑 crown (alt) */
  crown(ctx) {
    // same as vip
    DRAWERS.vip(ctx);
  },

  /** 🐰 bunny ears */
  bunny_ears(ctx) {
    const p = PAL.pink; const o = PAL.outline; const w = PAL.white;
    // headband
    rect(ctx, 4, 9, 8, 2, p);
    outlineRect(ctx, 4, 9, 8, 2, o);
    // left ear
    rect(ctx, 5, 2, 2, 8, w);
    outlineRect(ctx, 5, 2, 2, 8, o);
    rect(ctx, 5, 3, 2, 5, p);
    // right ear
    rect(ctx, 9, 2, 2, 8, w);
    outlineRect(ctx, 9, 2, 2, 8, o);
    rect(ctx, 9, 3, 2, 5, p);
  },

  /** 🕊️ angel wings */
  wings(ctx) {
    const w = PAL.white; const o = PAL.outline; const b = PAL.lightBlue;
    // left wing
    rect(ctx, 1, 6, 5, 6, w);
    outlineRect(ctx, 1, 6, 5, 6, o);
    rect(ctx, 2, 5, 3, 1, w);
    px(ctx, 2, 4, o); px(ctx, 3, 4, w); px(ctx, 4, 4, o);
    // right wing
    rect(ctx, 10, 6, 5, 6, w);
    outlineRect(ctx, 10, 6, 5, 6, o);
    rect(ctx, 11, 5, 3, 1, w);
    px(ctx, 11, 4, o); px(ctx, 12, 4, w); px(ctx, 13, 4, o);
    // inner feather detail
    line(ctx, 2, 8, 2, 10, b);
    line(ctx, 12, 8, 12, 10, b);
  },

  /** 😇 halo */
  halo(ctx) {
    const y = PAL.yellow; const o = PAL.outline; const w = PAL.white;
    // halo ring
    rect(ctx, 3, 2, 10, 2, y);
    outlineRect(ctx, 3, 2, 10, 2, o);
    // glow
    px(ctx, 2, 2, y); px(ctx, 13, 2, y);
    px(ctx, 2, 3, y); px(ctx, 13, 3, y);
    // shine
    px(ctx, 4, 2, w); px(ctx, 5, 2, w);
  },

  /** 😈 devil horns */
  horns(ctx) {
    const r = PAL.red; const o = PAL.outline;
    // left horn
    px(ctx, 3, 4, r); px(ctx, 3, 3, o);
    px(ctx, 4, 3, r); px(ctx, 4, 2, o);
    px(ctx, 5, 2, r); px(ctx, 5, 1, o);
    // right horn
    px(ctx, 12, 4, r); px(ctx, 12, 3, o);
    px(ctx, 11, 3, r); px(ctx, 11, 2, o);
    px(ctx, 10, 2, r); px(ctx, 10, 1, o);
    // base
    rect(ctx, 4, 5, 8, 2, r);
    outlineRect(ctx, 4, 5, 8, 2, o);
  },

  /** 😷 face mask */
  mask(ctx) {
    const w = PAL.white; const o = PAL.outline; const b = PAL.lightBlue;
    // face outline
    circ(ctx, 8, 8, 6, PAL.skin, o);
    // mask rectangle
    rect(ctx, 3, 7, 10, 5, w);
    outlineRect(ctx, 3, 7, 10, 5, o);
    // mask folds
    line(ctx, 4, 9, 12, 9, b);
    line(ctx, 4, 10, 12, 10, b);
    // ear loops
    line(ctx, 3, 8, 2, 6, o);
    line(ctx, 12, 8, 13, 6, o);
    // eyes
    px(ctx, 5, 6, o); px(ctx, 6, 6, o);
    px(ctx, 10, 6, o); px(ctx, 11, 6, o);
  },

  /** 👓 glasses */
  glasses(ctx) {
    const b = PAL.brown; const o = PAL.outline; const w = PAL.white;
    // left lens
    rect(ctx, 2, 6, 5, 4, w);
    outlineRect(ctx, 2, 6, 5, 4, o);
    // right lens
    rect(ctx, 9, 6, 5, 4, w);
    outlineRect(ctx, 9, 6, 5, 4, o);
    // bridge
    rect(ctx, 7, 7, 2, 1, b);
    // arms
    line(ctx, 2, 7, 1, 6, o);
    line(ctx, 13, 7, 14, 6, o);
  },

  /** 🕶️ sunglasses */
  sunglasses(ctx) {
    const b = PAL.black; const o = PAL.outline;
    // left lens
    rect(ctx, 2, 6, 5, 3, b);
    outlineRect(ctx, 2, 6, 5, 3, o);
    // right lens
    rect(ctx, 9, 6, 5, 3, b);
    outlineRect(ctx, 9, 6, 5, 3, o);
    // bridge
    px(ctx, 7, 7, o); px(ctx, 8, 7, o);
    // arms
    line(ctx, 2, 7, 1, 6, o);
    line(ctx, 13, 7, 14, 6, o);
    // shine
    px(ctx, 3, 7, PAL.grey); px(ctx, 10, 7, PAL.grey);
  },

  /** 📿 beads */
  necklace(ctx) {
    const g = PAL.gold; const o = PAL.outline; const r = PAL.red;
    // string of beads
    const beadXs = [3, 5, 7, 9, 11, 13];
    for (const bx of beadXs) {
      circ(ctx, bx, 10, 1, g, o);
    }
    // chain
    line(ctx, 2, 5, 3, 9, o);
    line(ctx, 14, 5, 13, 9, o);
    // centre pendant
    px(ctx, 8, 12, r); px(ctx, 7, 12, o); px(ctx, 9, 12, o);
    px(ctx, 8, 13, r); px(ctx, 8, 14, o);
  },

  // ── Objects / Tech ──────────────────────────────────────

  /** 📱 smartphone */
  phone(ctx) {
    const b = PAL.black; const o = PAL.outline; const s = PAL.blue;
    // body
    rect(ctx, 5, 2, 6, 12, b);
    outlineRect(ctx, 5, 2, 6, 12, o);
    // screen
    rect(ctx, 6, 3, 4, 9, s);
    outlineRect(ctx, 6, 3, 4, 9, o);
    // home button
    px(ctx, 7, 13, PAL.grey); px(ctx, 8, 13, PAL.grey);
    // earpiece
    px(ctx, 7, 2, PAL.grey); px(ctx, 8, 2, PAL.grey);
  },

  /** 💻 laptop */
  computer(ctx) {
    const g = PAL.grey; const o = PAL.outline; const b = PAL.blue;
    // screen
    rect(ctx, 3, 3, 10, 7, g);
    outlineRect(ctx, 3, 3, 10, 7, o);
    // display
    rect(ctx, 4, 4, 8, 5, b);
    // keyboard base
    rect(ctx, 2, 10, 12, 2, g);
    outlineRect(ctx, 2, 10, 12, 2, o);
    // keys
    px(ctx, 4, 10, PAL.darkGrey); px(ctx, 6, 10, PAL.darkGrey);
    px(ctx, 8, 10, PAL.darkGrey); px(ctx, 10, 10, PAL.darkGrey);
  },

  /** 📺 television */
  tv(ctx) {
    const g = PAL.darkGrey; const o = PAL.outline; const b = PAL.blue;
    // body
    rect(ctx, 2, 3, 12, 9, g);
    outlineRect(ctx, 2, 3, 12, 9, o);
    // screen
    rect(ctx, 4, 4, 8, 6, b);
    outlineRect(ctx, 4, 4, 8, 6, o);
    // antenna
    line(ctx, 6, 3, 4, 1, o);
    line(ctx, 10, 3, 12, 1, o);
    px(ctx, 4, 1, o); px(ctx, 12, 1, o);
    // knobs
    px(ctx, 13, 5, PAL.grey); px(ctx, 13, 7, PAL.grey);
  },

  /** 📖 open book */
  book(ctx) {
    const w = PAL.white; const o = PAL.outline; const br = PAL.wood;
    // left page
    rect(ctx, 2, 4, 6, 9, w);
    outlineRect(ctx, 2, 4, 6, 9, o);
    // right page
    rect(ctx, 8, 4, 6, 9, w);
    outlineRect(ctx, 8, 4, 6, 9, o);
    // spine
    rect(ctx, 7, 3, 2, 10, br);
    outlineRect(ctx, 7, 3, 2, 10, o);
    // text lines
    line(ctx, 3, 6, 6, 6, PAL.lightGrey);
    line(ctx, 3, 8, 6, 8, PAL.lightGrey);
    line(ctx, 3, 10, 5, 10, PAL.lightGrey);
    line(ctx, 9, 6, 12, 6, PAL.lightGrey);
    line(ctx, 9, 8, 12, 8, PAL.lightGrey);
    line(ctx, 9, 10, 11, 10, PAL.lightGrey);
  },

  /** 🥤 soda cup */
  drink(ctx) {
    const r = PAL.red; const o = PAL.outline; const w = PAL.white;
    // cup body
    rect(ctx, 5, 5, 6, 9, r);
    outlineRect(ctx, 5, 5, 6, 9, o);
    // lid
    rect(ctx, 4, 4, 8, 2, w);
    outlineRect(ctx, 4, 4, 8, 2, o);
    // straw
    line(ctx, 9, 4, 11, 1, o);
    px(ctx, 11, 1, o);
    // stripe
    rect(ctx, 5, 8, 6, 1, w);
  },

  /** 🍕 pizza slice */
  food(ctx) {
    const y = PAL.yellow; const o = PAL.outline; const r = PAL.red;
    // crust
    rect(ctx, 6, 2, 4, 2, PAL.brown);
    outlineRect(ctx, 6, 2, 4, 2, o);
    // cheese triangle
    for (let row = 0; row < 8; row++) {
      const w = 8 - row;
      const startX = 8 - Math.floor(w / 2);
      rect(ctx, startX, 4 + row, w, 1, y);
    }
    // outline
    line(ctx, 5, 4, 3, 11, o);
    line(ctx, 11, 4, 13, 11, o);
    line(ctx, 3, 11, 13, 11, o);
    // pepperoni
    px(ctx, 7, 6, r); px(ctx, 9, 7, r); px(ctx, 8, 9, r);
  },

  /** 🍦 ice cream */
  ice_cream(ctx) {
    const p = PAL.pink; const o = PAL.outline; const br = PAL.brown;
    // cone
    for (let row = 0; row < 6; row++) {
      const w = 6 - row;
      const startX = 8 - Math.floor(w / 2);
      rect(ctx, startX, 9 + row, w, 1, br);
    }
    line(ctx, 5, 9, 3, 14, o);
    line(ctx, 11, 9, 13, 14, o);
    // scoop
    circ(ctx, 8, 6, 4, p, o);
    // highlight
    px(ctx, 6, 5, PAL.white); px(ctx, 7, 5, PAL.white);
  },

  /** ☕ coffee cup */
  coffee(ctx) {
    const w = PAL.white; const o = PAL.outline; const br = PAL.brown;
    // cup
    rect(ctx, 4, 6, 7, 7, w);
    outlineRect(ctx, 4, 6, 7, 7, o);
    // handle
    px(ctx, 11, 8, o); px(ctx, 12, 8, o);
    px(ctx, 12, 9, o); px(ctx, 12, 10, o);
    px(ctx, 11, 10, o);
    // coffee
    rect(ctx, 5, 7, 5, 5, br);
    // steam
    px(ctx, 6, 4, PAL.lightGrey); px(ctx, 8, 3, PAL.lightGrey); px(ctx, 10, 4, PAL.lightGrey);
  },

  // ── Party / Celebration ─────────────────────────────────

  /** 🎈 balloon */
  balloon(ctx) {
    const r = PAL.red; const o = PAL.outline;
    // balloon body
    circ(ctx, 8, 6, 5, r, o);
    // shine
    px(ctx, 5, 4, PAL.pink); px(ctx, 6, 5, PAL.pink);
    // knot
    px(ctx, 7, 11, o); px(ctx, 8, 11, o);
    // string
    line(ctx, 8, 12, 8, 15, o);
    line(ctx, 7, 13, 9, 14, o);
  },

  /** 🎉 party popper */
  confetti(ctx) {
    const o = PAL.outline; const y = PAL.yellow; const r = PAL.red; const b = PAL.blue;
    // cone
    rect(ctx, 2, 8, 6, 6, PAL.purple);
    outlineRect(ctx, 2, 8, 6, 6, o);
    // streamers
    line(ctx, 8, 6, 13, 3, y);
    line(ctx, 9, 8, 14, 5, r);
    line(ctx, 8, 10, 13, 9, b);
    // dots
    px(ctx, 10, 4, r); px(ctx, 12, 5, y); px(ctx, 11, 7, b);
    px(ctx, 13, 6, y); px(ctx, 12, 8, r); px(ctx, 14, 8, b);
    // confetti burst
    px(ctx, 6, 4, y); px(ctx, 7, 3, r); px(ctx, 9, 4, b);
  },

  /** 🎆 firework */
  firework(ctx) {
    const o = PAL.outline; const y = PAL.yellow; const r = PAL.red; const b = PAL.blue;
    // rocket body
    rect(ctx, 7, 8, 2, 6, PAL.red);
    outlineRect(ctx, 7, 8, 2, 6, o);
    // nose cone
    px(ctx, 7, 7, o); px(ctx, 8, 7, o);
    px(ctx, 7, 6, y); px(ctx, 8, 6, y);
    // fuse
    line(ctx, 8, 14, 9, 15, o);
    // burst
    const burstCentre = [8, 3];
    for (const [dx, dy, col] of [
      [0, -2, y], [0, 2, r], [-2, 0, b], [2, 0, y],
      [-1, -1, r], [1, -1, b], [-1, 1, y], [1, 1, r],
      [0, -3, y], [0, 3, r], [-3, 0, b], [3, 0, y],
    ]) {
      px(ctx, burstCentre[0] + dx, burstCentre[1] + dy, col);
    }
  },

  /** ⭐ star (alt) */
  star(ctx) {
    DRAWERS.friend(ctx);
  },

  /** 🌙 crescent moon */
  moon(ctx) {
    const y = PAL.yellow; const o = PAL.outline;
    circ(ctx, 8, 8, 5, y, o);
    // bite out the right side
    circ(ctx, 11, 8, 4, PAL.cream, null);
    // re-outline the visible crescent
    px(ctx, 3, 8, o); px(ctx, 4, 5, o); px(ctx, 4, 11, o);
    px(ctx, 6, 4, o); px(ctx, 6, 12, o);
    px(ctx, 8, 4, o); px(ctx, 8, 12, o);
    px(ctx, 10, 6, o); px(ctx, 10, 10, o);
    px(ctx, 11, 8, o);
    // shadow detail
    px(ctx, 5, 7, PAL.orange); px(ctx, 5, 8, PAL.orange); px(ctx, 5, 9, PAL.orange);
  },

  /** ☀️ sun */
  sun(ctx) {
    const y = PAL.yellow; const o = PAL.outline;
    circ(ctx, 8, 8, 4, y, o);
    // rays
    const rays = [
      [8, 1], [8, 15], [1, 8], [15, 8],
      [3, 3], [13, 13], [13, 3], [3, 13],
    ];
    for (const [rx, ry] of rays) {
      px(ctx, rx, ry, o);
    }
    // inner face
    px(ctx, 6, 7, o); px(ctx, 10, 7, o);
    line(ctx, 6, 10, 10, 10, o);
  },

  /** ☁️ cloud */
  cloud(ctx) {
    const w = PAL.white; const o = PAL.outline; const b = PAL.lightBlue;
    // main puffs
    circ(ctx, 5, 7, 3, w, o);
    circ(ctx, 8, 6, 4, w, o);
    circ(ctx, 11, 7, 3, w, o);
    // bottom fill
    rect(ctx, 4, 8, 9, 3, w);
    outlineRect(ctx, 4, 8, 9, 3, o);
    // rain drops
    px(ctx, 6, 12, b); px(ctx, 8, 13, b); px(ctx, 10, 12, b);
  },

  /** 🌧️ rain cloud */
  rain(ctx) {
    DRAWERS.cloud(ctx);
    // more rain
    const b = PAL.blue;
    px(ctx, 5, 12, b); px(ctx, 7, 13, b); px(ctx, 9, 14, b); px(ctx, 11, 13, b);
    px(ctx, 6, 14, b); px(ctx, 8, 15, b); px(ctx, 10, 15, b);
  },

  /** ❄️ snowflake */
  snow(ctx) {
    const b = PAL.blue; const o = PAL.outline; const w = PAL.white;
    // centre
    px(ctx, 8, 8, o);
    // 6 arms
    const arms = [
      [8, 2, 8, 14], [2, 8, 14, 8],
      [3, 3, 13, 13], [13, 3, 3, 13],
      [5, 2, 11, 14], [11, 2, 5, 14],
    ];
    for (const [x0, y0, x1, y1] of arms) {
      line(ctx, x0, y0, x1, y1, b);
    }
    // crosses on arms
    px(ctx, 8, 4, w); px(ctx, 8, 12, w);
    px(ctx, 4, 8, w); px(ctx, 12, 8, w);
    px(ctx, 5, 5, w); px(ctx, 11, 11, w);
    px(ctx, 11, 5, w); px(ctx, 5, 11, w);
  },

  /** 🌸 cherry blossom */
  flower(ctx) {
    const p = PAL.pink; const o = PAL.outline; const y = PAL.yellow;
    // 5 petals
    circ(ctx, 8, 4, 2, p, o);
    circ(ctx, 4, 8, 2, p, o);
    circ(ctx, 12, 8, 2, p, o);
    circ(ctx, 6, 12, 2, p, o);
    circ(ctx, 10, 12, 2, p, o);
    // centre
    circ(ctx, 8, 8, 2, y, o);
  },

  /** 🌳 tree */
  tree(ctx) {
    const g = PAL.green; const o = PAL.outline; const br = PAL.wood;
    // trunk
    rect(ctx, 7, 10, 2, 5, br);
    outlineRect(ctx, 7, 10, 2, 5, o);
    // foliage layers
    rect(ctx, 3, 5, 10, 6, g);
    outlineRect(ctx, 3, 5, 10, 6, o);
    rect(ctx, 5, 2, 6, 4, g);
    outlineRect(ctx, 5, 2, 6, 4, o);
    // detail
    px(ctx, 5, 6, PAL.darkGreen); px(ctx, 9, 4, PAL.darkGreen);
    px(ctx, 8, 7, PAL.darkGreen);
  },

  /** 🍂 autumn leaf */
  leaf(ctx) {
    const o = PAL.orange; const br = PAL.brown; const y = PAL.yellow;
    // leaf shape
    const leafPixels = [
      [8, 2], [7, 3], [9, 3],
      [6, 4], [7, 4], [8, 4], [9, 4], [10, 4],
      [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5],
      [6, 6], [7, 6], [8, 6], [9, 6], [10, 6],
      [7, 7], [8, 7], [9, 7],
      [8, 8], [8, 9], [8, 10], [8, 11],
    ];
    for (const [lx, ly] of leafPixels) px(ctx, lx, ly, o);
    // outline
    line(ctx, 8, 2, 5, 5, br);
    line(ctx, 5, 5, 7, 7, br);
    line(ctx, 7, 7, 8, 11, br);
    line(ctx, 8, 2, 11, 5, br);
    line(ctx, 11, 5, 9, 7, br);
    line(ctx, 9, 7, 8, 11, br);
    // vein
    line(ctx, 8, 4, 8, 9, br);
    // highlight
    px(ctx, 7, 4, y);
  },

  /** 🔥 flame (alt) */
  fire(ctx) {
    DRAWERS.hot(ctx);
  },

  /** 💧 water drop */
  water(ctx) {
    const b = PAL.blue; const o = PAL.outline; const l = PAL.lightBlue;
    // drop shape
    const drop = [
      [8, 2],
      [7, 3], [8, 3], [9, 3],
      [6, 4], [7, 4], [8, 4], [9, 4], [10, 4],
      [6, 5], [7, 5], [8, 5], [9, 5], [10, 5],
      [7, 6], [8, 6], [9, 6],
      [7, 7], [8, 7], [9, 7],
      [8, 8],
    ];
    for (const [dx, dy] of drop) px(ctx, dx, dy, b);
    // outline
    line(ctx, 8, 2, 6, 4, o);
    line(ctx, 6, 4, 6, 5, o);
    line(ctx, 6, 5, 8, 8, o);
    line(ctx, 8, 8, 10, 5, o);
    line(ctx, 10, 5, 10, 4, o);
    line(ctx, 10, 4, 8, 2, o);
    // shine
    px(ctx, 7, 4, l); px(ctx, 7, 5, l);
  },

  /** ⚡ lightning bolt */
  bolt(ctx) {
    const y = PAL.yellow; const o = PAL.outline;
    const boltPts = [
      [6, 1], [7, 1], [8, 1],
      [6, 2], [7, 2], [8, 2], [9, 2],
      [7, 3], [8, 3], [9, 3],
      [8, 4], [9, 4], [10, 4],
      [5, 5], [6, 5], [7, 5],
      [5, 6], [6, 6], [7, 6],
      [4, 7], [5, 7], [6, 7],
      [4, 8], [5, 8],
      [3, 9], [4, 9], [5, 9],
      [3, 10], [4, 10],
      [3, 11], [4, 11],
      [3, 12], [4, 12],
      [3, 13], [4, 13],
      [3, 14], [4, 14],
    ];
    for (const [bx, by] of boltPts) px(ctx, bx, by, y);
    // outline
    line(ctx, 6, 1, 9, 2, o);
    line(ctx, 9, 2, 5, 5, o);
    line(ctx, 5, 5, 3, 14, o);
    line(ctx, 3, 14, 4, 14, o);
    line(ctx, 4, 14, 6, 5, o);
    line(ctx, 6, 5, 10, 4, o);
    line(ctx, 10, 4, 8, 1, o);
  },

  /** 🌈 rainbow */
  rainbow(ctx) {
    const bands = [PAL.red, PAL.orange, PAL.yellow, PAL.green, PAL.blue, PAL.purple];
    for (let i = 0; i < bands.length; i++) {
      const yy = 10 - i;
      rect(ctx, 2, yy, 12, 1, bands[i]);
    }
    // outline the arch
    line(ctx, 2, 10, 2, 5, PAL.outline);
    line(ctx, 2, 5, 5, 2, PAL.outline);
    line(ctx, 5, 2, 11, 2, PAL.outline);
    line(ctx, 11, 2, 14, 5, PAL.outline);
    line(ctx, 14, 5, 14, 10, PAL.outline);
    // clouds at ends
    px(ctx, 1, 10, PAL.outline); px(ctx, 1, 11, PAL.white);
    px(ctx, 15, 10, PAL.outline); px(ctx, 15, 11, PAL.white);
  },

  /** 🌍 globe */
  earth(ctx) {
    const b = PAL.blue; const o = PAL.outline; const g = PAL.green;
    circ(ctx, 8, 8, 6, b, o);
    // continents
    px(ctx, 5, 5, g); px(ctx, 6, 5, g); px(ctx, 7, 5, g);
    px(ctx, 5, 6, g); px(ctx, 6, 6, g);
    px(ctx, 9, 7, g); px(ctx, 10, 7, g); px(ctx, 11, 7, g);
    px(ctx, 9, 8, g); px(ctx, 10, 8, g);
    px(ctx, 6, 10, g); px(ctx, 7, 10, g); px(ctx, 8, 10, g);
    px(ctx, 6, 11, g); px(ctx, 7, 11, g);
    // equator line
    line(ctx, 3, 8, 13, 8, PAL.lightBlue);
  },

  /** 🚀 rocket */
  rocket(ctx) {
    const w = PAL.white; const o = PAL.outline; const r = PAL.red;
    // body
    rect(ctx, 6, 4, 4, 9, w);
    outlineRect(ctx, 6, 4, 4, 9, o);
    // nose
    px(ctx, 7, 3, w); px(ctx, 8, 3, w);
    px(ctx, 7, 3, o); px(ctx, 8, 3, o);
    px(ctx, 7, 2, o); px(ctx, 8, 2, o);
    // fins
    px(ctx, 5, 10, r); px(ctx, 5, 11, r);
    px(ctx, 10, 10, r); px(ctx, 10, 11, r);
    // flame
    px(ctx, 7, 13, PAL.yellow); px(ctx, 8, 13, PAL.yellow);
    px(ctx, 7, 14, PAL.orange); px(ctx, 8, 14, PAL.orange);
    px(ctx, 7, 15, PAL.red); px(ctx, 8, 15, PAL.red);
    // window
    circ(ctx, 8, 7, 1, PAL.blue, o);
  },

  /** 🛸 flying saucer */
  ufo(ctx) {
    const s = PAL.silver; const o = PAL.outline; const g = PAL.green;
    // dome
    circ(ctx, 8, 6, 3, PAL.lightBlue, o);
    // saucer body
    rect(ctx, 2, 8, 12, 3, s);
    outlineRect(ctx, 2, 8, 12, 3, o);
    // rim
    rect(ctx, 1, 10, 14, 2, s);
    outlineRect(ctx, 1, 10, 14, 2, o);
    // lights
    px(ctx, 4, 9, g); px(ctx, 7, 9, g); px(ctx, 10, 9, g); px(ctx, 12, 9, g);
  },

  /** 👻 ghost */
  ghost(ctx) {
    const w = PAL.white; const o = PAL.outline; const b = PAL.black;
    // body
    rect(ctx, 4, 3, 8, 10, w);
    outlineRect(ctx, 4, 3, 8, 10, o);
    // rounded top
    px(ctx, 5, 2, w); px(ctx, 6, 2, w); px(ctx, 7, 2, w); px(ctx, 8, 2, w);
    px(ctx, 9, 2, w); px(ctx, 10, 2, w);
    px(ctx, 5, 2, o); px(ctx, 10, 2, o);
    // wavy bottom
    px(ctx, 4, 13, w); px(ctx, 5, 13, o); px(ctx, 6, 13, w);
    px(ctx, 7, 13, o); px(ctx, 8, 13, w); px(ctx, 9, 13, o);
    px(ctx, 10, 13, w); px(ctx, 11, 13, o);
    // eyes
    px(ctx, 6, 6, b); px(ctx, 7, 6, b);
    px(ctx, 10, 6, b); px(ctx, 11, 6, b);
    // blush
    px(ctx, 5, 8, PAL.pink); px(ctx, 12, 8, PAL.pink);
  },

  /** 🎃 jack-o-lantern */
  pumpkin(ctx) {
    const o = PAL.orange; const ot = PAL.outline; const y = PAL.yellow;
    // body
    rect(ctx, 3, 5, 10, 9, o);
    outlineRect(ctx, 3, 5, 10, 9, ot);
    // stem
    rect(ctx, 7, 2, 2, 4, PAL.green);
    outlineRect(ctx, 7, 2, 2, 4, ot);
    // face
    // eyes (triangles)
    px(ctx, 5, 7, y); px(ctx, 6, 7, y); px(ctx, 6, 8, y);
    px(ctx, 10, 7, y); px(ctx, 11, 7, y); px(ctx, 10, 8, y);
    // nose
    px(ctx, 8, 9, y);
    // mouth
    line(ctx, 5, 11, 11, 11, y);
    px(ctx, 5, 12, y); px(ctx, 6, 12, y); px(ctx, 10, 12, y); px(ctx, 11, 12, y);
    // teeth
    px(ctx, 7, 11, ot); px(ctx, 9, 11, ot);
  },

  /** 💀 skull */
  skull(ctx) {
    const w = PAL.white; const o = PAL.outline; const b = PAL.black;
    // cranium
    circ(ctx, 8, 6, 5, w, o);
    // face
    rect(ctx, 5, 9, 6, 5, w);
    outlineRect(ctx, 5, 9, 6, 5, o);
    // eyes
    px(ctx, 6, 7, b); px(ctx, 7, 7, b);
    px(ctx, 10, 7, b); px(ctx, 11, 7, b); // Actually adjust for 16x16
    // correct eyes
    px(ctx, 6, 7, b); px(ctx, 7, 7, b);
    px(ctx, 9, 7, b); px(ctx, 10, 7, b);
    // nose
    px(ctx, 8, 9, b);
    // teeth
    line(ctx, 6, 12, 10, 12, o);
    px(ctx, 7, 13, o); px(ctx, 9, 13, o);
  },

  /** 🕷️ spider */
  spider(ctx) {
    const b = PAL.black; const o = PAL.outline; const r = PAL.red;
    // body
    circ(ctx, 8, 7, 3, b, o);
    // head
    circ(ctx, 8, 4, 2, b, o);
    // eyes
    px(ctx, 7, 3, r); px(ctx, 9, 3, r);
    // legs (8 legs)
    line(ctx, 5, 5, 2, 3, o);
    line(ctx, 5, 6, 1, 6, o);
    line(ctx, 5, 7, 2, 9, o);
    line(ctx, 5, 8, 3, 11, o);
    line(ctx, 11, 5, 14, 3, o);
    line(ctx, 11, 6, 15, 6, o);
    line(ctx, 11, 7, 14, 9, o);
    line(ctx, 11, 8, 13, 11, o);
  },

  /** 🦇 bat */
  bat(ctx) {
    const p = PAL.purple; const o = PAL.outline; const b = PAL.black;
    // body
    rect(ctx, 7, 6, 2, 5, b);
    outlineRect(ctx, 7, 6, 2, 5, o);
    // head
    px(ctx, 7, 5, b); px(ctx, 8, 5, b);
    px(ctx, 7, 5, o); px(ctx, 8, 5, o);
    // ears
    px(ctx, 6, 3, o); px(ctx, 7, 4, o);
    px(ctx, 9, 4, o); px(ctx, 10, 3, o);
    // wings
    line(ctx, 7, 7, 1, 4, p);
    line(ctx, 1, 4, 1, 8, p);
    line(ctx, 1, 8, 6, 10, p);
    line(ctx, 8, 7, 14, 4, p);
    line(ctx, 14, 4, 14, 8, p);
    line(ctx, 14, 8, 9, 10, p);
    // wing outline
    line(ctx, 7, 7, 1, 4, o);
    line(ctx, 8, 7, 14, 4, o);
  },

  /** 🍬 candy */
  candy(ctx) {
    const p = PAL.pink; const o = PAL.outline; const w = PAL.white;
    // wrapper body
    circ(ctx, 8, 8, 3, p, o);
    // left wrapper tail
    px(ctx, 4, 7, p); px(ctx, 4, 8, p); px(ctx, 4, 9, p);
    px(ctx, 3, 6, p); px(ctx, 3, 10, p);
    px(ctx, 4, 7, o); px(ctx, 4, 9, o);
    // right wrapper tail
    px(ctx, 12, 7, p); px(ctx, 12, 8, p); px(ctx, 12, 9, p);
    px(ctx, 13, 6, p); px(ctx, 13, 10, p);
    px(ctx, 12, 7, o); px(ctx, 12, 9, o);
    // stripes
    px(ctx, 7, 7, w); px(ctx, 9, 8, w); px(ctx, 7, 9, w);
  },

  /** 🎁 red gift (alt) */
  gift_red(ctx) {
    const r = PAL.red; const o = PAL.outline; const g = PAL.gold;
    // box
    rect(ctx, 3, 5, 10, 8, r);
    outlineRect(ctx, 3, 5, 10, 8, o);
    // ribbon
    rect(ctx, 7, 5, 2, 8, g);
    outlineRect(ctx, 7, 5, 2, 8, o);
    rect(ctx, 3, 8, 10, 2, g);
    outlineRect(ctx, 3, 8, 10, 2, o);
    // bow
    px(ctx, 6, 3, g); px(ctx, 9, 3, g);
    px(ctx, 7, 4, g); px(ctx, 8, 4, g);
    px(ctx, 7, 3, o); px(ctx, 8, 3, o);
  },

  /** 🎄 xmas ornament */
  ornament(ctx) {
    const r = PAL.red; const o = PAL.outline; const g = PAL.green;
    // hook
    line(ctx, 8, 1, 8, 3, o);
    // cap
    rect(ctx, 6, 3, 4, 2, g);
    outlineRect(ctx, 6, 3, 4, 2, o);
    // ball
    circ(ctx, 8, 9, 5, r, o);
    // shine
    px(ctx, 6, 7, PAL.pink); px(ctx, 7, 8, PAL.pink);
    // stripe
    px(ctx, 8, 11, g); px(ctx, 8, 12, g);
  },

  /** ⛄ snowman */
  snowman(ctx) {
    const w = PAL.white; const o = PAL.outline; const b = PAL.black;
    // bottom ball
    circ(ctx, 8, 11, 4, w, o);
    // middle ball
    circ(ctx, 8, 7, 3, w, o);
    // head
    circ(ctx, 8, 3, 2, w, o);
    // eyes
    px(ctx, 7, 3, b); px(ctx, 9, 3, b);
    // nose
    px(ctx, 8, 4, PAL.orange);
    // buttons
    px(ctx, 8, 6, b); px(ctx, 8, 8, b); px(ctx, 8, 10, b);
    // arms
    line(ctx, 5, 7, 2, 6, PAL.brown);
    line(ctx, 11, 7, 14, 6, PAL.brown);
    // hat
    rect(ctx, 6, 1, 4, 1, PAL.black);
    px(ctx, 6, 0, PAL.black); px(ctx, 7, 0, PAL.black);
    px(ctx, 8, 0, PAL.black); px(ctx, 9, 0, PAL.black);
  },

  // ── Hearts (coloured variants) ────────────────────────────

  /** 💗 pink heart */
  heart_pink(ctx) {
    // Reuse heart shape, recolour
    const p = PAL.hotPink; const o = PAL.outline; const h = PAL.pink;
    rect(ctx, 4, 3, 3, 2, p); rect(ctx, 9, 3, 3, 2, p);
    outlineRect(ctx, 4, 3, 3, 2, o); outlineRect(ctx, 9, 3, 3, 2, o);
    rect(ctx, 4, 5, 8, 4, p); rect(ctx, 5, 9, 6, 2, p);
    rect(ctx, 6, 11, 4, 2, p); rect(ctx, 7, 13, 2, 1, p);
    line(ctx, 3, 4, 3, 6, o); line(ctx, 3, 6, 7, 13, o);
    line(ctx, 7, 13, 9, 13, o); line(ctx, 9, 13, 13, 6, o);
    line(ctx, 13, 6, 13, 4, o); line(ctx, 12, 3, 10, 3, o);
    line(ctx, 7, 3, 5, 3, o);
    px(ctx, 5, 4, h); px(ctx, 6, 5, h);
  },

  /** 💜 purple heart */
  heart_purple(ctx) {
    const pu = PAL.purple; const o = PAL.outline; const dp = PAL.deepPurple;
    rect(ctx, 4, 3, 3, 2, pu); rect(ctx, 9, 3, 3, 2, pu);
    outlineRect(ctx, 4, 3, 3, 2, o); outlineRect(ctx, 9, 3, 3, 2, o);
    rect(ctx, 4, 5, 8, 4, pu); rect(ctx, 5, 9, 6, 2, pu);
    rect(ctx, 6, 11, 4, 2, pu); rect(ctx, 7, 13, 2, 1, pu);
    line(ctx, 3, 4, 3, 6, o); line(ctx, 3, 6, 7, 13, o);
    line(ctx, 7, 13, 9, 13, o); line(ctx, 9, 13, 13, 6, o);
    line(ctx, 13, 6, 13, 4, o); line(ctx, 12, 3, 10, 3, o);
    line(ctx, 7, 3, 5, 3, o);
    px(ctx, 5, 4, dp); px(ctx, 6, 5, dp);
  },

  /** 💙 blue heart */
  heart_blue(ctx) {
    const bl = PAL.blue; const o = PAL.outline; const lb = PAL.lightBlue;
    rect(ctx, 4, 3, 3, 2, bl); rect(ctx, 9, 3, 3, 2, bl);
    outlineRect(ctx, 4, 3, 3, 2, o); outlineRect(ctx, 9, 3, 3, 2, o);
    rect(ctx, 4, 5, 8, 4, bl); rect(ctx, 5, 9, 6, 2, bl);
    rect(ctx, 6, 11, 4, 2, bl); rect(ctx, 7, 13, 2, 1, bl);
    line(ctx, 3, 4, 3, 6, o); line(ctx, 3, 6, 7, 13, o);
    line(ctx, 7, 13, 9, 13, o); line(ctx, 9, 13, 13, 6, o);
    line(ctx, 13, 6, 13, 4, o); line(ctx, 12, 3, 10, 3, o);
    line(ctx, 7, 3, 5, 3, o);
    px(ctx, 5, 4, lb); px(ctx, 6, 5, lb);
  },

  /** 💚 green heart */
  heart_green(ctx) {
    const gr = PAL.green; const o = PAL.outline; const lg = PAL.lime;
    rect(ctx, 4, 3, 3, 2, gr); rect(ctx, 9, 3, 3, 2, gr);
    outlineRect(ctx, 4, 3, 3, 2, o); outlineRect(ctx, 9, 3, 3, 2, o);
    rect(ctx, 4, 5, 8, 4, gr); rect(ctx, 5, 9, 6, 2, gr);
    rect(ctx, 6, 11, 4, 2, gr); rect(ctx, 7, 13, 2, 1, gr);
    line(ctx, 3, 4, 3, 6, o); line(ctx, 3, 6, 7, 13, o);
    line(ctx, 7, 13, 9, 13, o); line(ctx, 9, 13, 13, 6, o);
    line(ctx, 13, 6, 13, 4, o); line(ctx, 12, 3, 10, 3, o);
    line(ctx, 7, 3, 5, 3, o);
    px(ctx, 5, 4, lg); px(ctx, 6, 5, lg);
  },

  /** 💛 yellow heart */
  heart_yellow(ctx) {
    const y = PAL.yellow; const o = PAL.outline; const c = PAL.cream;
    rect(ctx, 4, 3, 3, 2, y); rect(ctx, 9, 3, 3, 2, y);
    outlineRect(ctx, 4, 3, 3, 2, o); outlineRect(ctx, 9, 3, 3, 2, o);
    rect(ctx, 4, 5, 8, 4, y); rect(ctx, 5, 9, 6, 2, y);
    rect(ctx, 6, 11, 4, 2, y); rect(ctx, 7, 13, 2, 1, y);
    line(ctx, 3, 4, 3, 6, o); line(ctx, 3, 6, 7, 13, o);
    line(ctx, 7, 13, 9, 13, o); line(ctx, 9, 13, 13, 6, o);
    line(ctx, 13, 6, 13, 4, o); line(ctx, 12, 3, 10, 3, o);
    line(ctx, 7, 3, 5, 3, o);
    px(ctx, 5, 4, c); px(ctx, 6, 5, c);
  },

  /** 🧡 orange heart */
  heart_orange(ctx) {
    const or = PAL.orange; const o = PAL.outline; const y = PAL.yellow;
    rect(ctx, 4, 3, 3, 2, or); rect(ctx, 9, 3, 3, 2, or);
    outlineRect(ctx, 4, 3, 3, 2, o); outlineRect(ctx, 9, 3, 3, 2, o);
    rect(ctx, 4, 5, 8, 4, or); rect(ctx, 5, 9, 6, 2, or);
    rect(ctx, 6, 11, 4, 2, or); rect(ctx, 7, 13, 2, 1, or);
    line(ctx, 3, 4, 3, 6, o); line(ctx, 3, 6, 7, 13, o);
    line(ctx, 7, 13, 9, 13, o); line(ctx, 9, 13, 13, 6, o);
    line(ctx, 13, 6, 13, 4, o); line(ctx, 12, 3, 10, 3, o);
    line(ctx, 7, 3, 5, 3, o);
    px(ctx, 5, 4, y); px(ctx, 6, 5, y);
  },

  /** 🖤 black heart */
  heart_black(ctx) {
    const bl = PAL.black; const o = PAL.outline; const g = PAL.grey;
    rect(ctx, 4, 3, 3, 2, bl); rect(ctx, 9, 3, 3, 2, bl);
    outlineRect(ctx, 4, 3, 3, 2, o); outlineRect(ctx, 9, 3, 3, 2, o);
    rect(ctx, 4, 5, 8, 4, bl); rect(ctx, 5, 9, 6, 2, bl);
    rect(ctx, 6, 11, 4, 2, bl); rect(ctx, 7, 13, 2, 1, bl);
    line(ctx, 3, 4, 3, 6, o); line(ctx, 3, 6, 7, 13, o);
    line(ctx, 7, 13, 9, 13, o); line(ctx, 9, 13, 13, 6, o);
    line(ctx, 13, 6, 13, 4, o); line(ctx, 12, 3, 10, 3, o);
    line(ctx, 7, 3, 5, 3, o);
    px(ctx, 5, 4, g); px(ctx, 6, 5, g);
  },

  /** 💔 broken heart */
  heart_broken(ctx) {
    const r = PAL.red; const o = PAL.outline; const p = PAL.pink;
    // left half
    rect(ctx, 4, 3, 3, 2, r); outlineRect(ctx, 4, 3, 3, 2, o);
    rect(ctx, 4, 5, 4, 4, r); rect(ctx, 4, 9, 3, 2, r);
    rect(ctx, 4, 11, 2, 2, r); rect(ctx, 4, 13, 1, 1, r);
    // right half (offset)
    rect(ctx, 10, 3, 3, 2, r); outlineRect(ctx, 10, 3, 3, 2, o);
    rect(ctx, 8, 5, 4, 4, r); rect(ctx, 9, 9, 3, 2, r);
    rect(ctx, 10, 11, 2, 2, r); rect(ctx, 11, 13, 1, 1, r);
    // crack
    line(ctx, 8, 3, 7, 5, o);
    line(ctx, 7, 5, 9, 7, o);
    line(ctx, 9, 7, 7, 9, o);
    line(ctx, 7, 9, 9, 11, o);
    line(ctx, 9, 11, 8, 13, o);
    // outline
    line(ctx, 3, 4, 3, 6, o); line(ctx, 3, 6, 5, 13, o);
    line(ctx, 12, 4, 12, 6, o); line(ctx, 12, 6, 10, 13, o);
    px(ctx, 5, 4, p);
  },

  /** 💖 sparkling heart */
  heart_sparkle(ctx) {
    DRAWERS.heart(ctx);
    // sparkles
    const s = PAL.yellow; const o = PAL.outline;
    px(ctx, 12, 3, s); px(ctx, 13, 3, o); px(ctx, 12, 4, o);
    px(ctx, 2, 5, s); px(ctx, 2, 6, o); px(ctx, 3, 5, o);
    px(ctx, 13, 10, s); px(ctx, 14, 10, o); px(ctx, 13, 11, o);
    // star sparkle
    px(ctx, 14, 3, s); px(ctx, 14, 4, s); px(ctx, 13, 4, s);
  },

  /** 💘 arrow through heart */
  heart_arrow(ctx) {
    // heart base
    DRAWERS.heart(ctx);
    // arrow
    const w = PAL.white; const br = PAL.wood; const o = PAL.outline;
    line(ctx, 2, 2, 14, 14, br);
    line(ctx, 2, 2, 14, 14, o);
    // arrowhead
    px(ctx, 13, 13, o); px(ctx, 12, 14, o); px(ctx, 14, 12, o);
    // fletching
    px(ctx, 2, 2, w); px(ctx, 3, 3, w);
    px(ctx, 2, 3, w); px(ctx, 3, 2, w);
  },

  /** 💝 heart with ribbon */
  heart_ribbon(ctx) {
    DRAWERS.heart(ctx);
    const g = PAL.gold; const o = PAL.outline;
    // ribbon top
    rect(ctx, 6, 1, 4, 2, g);
    outlineRect(ctx, 6, 1, 4, 2, o);
    // ribbon tails
    line(ctx, 6, 3, 4, 5, o);
    line(ctx, 9, 3, 11, 5, o);
    px(ctx, 4, 5, g); px(ctx, 11, 5, g);
  },

  /** ❤️‍🔥 heart on fire */
  heart_fire(ctx) {
    DRAWERS.heart(ctx);
    // small flames on top
    const o = PAL.orange; const y = PAL.yellow;
    px(ctx, 6, 1, o); px(ctx, 7, 0, y); px(ctx, 8, 0, y); px(ctx, 9, 1, o);
    px(ctx, 7, 1, o); px(ctx, 8, 1, o);
    px(ctx, 5, 2, o); px(ctx, 10, 2, o);
  },

  /** ❤️‍🩹 mending heart */
  heart_bandage(ctx) {
    DRAWERS.heart(ctx);
    const w = PAL.white; const o = PAL.outline;
    // bandage strip
    rect(ctx, 5, 5, 6, 3, w);
    outlineRect(ctx, 5, 5, 6, 3, o);
    // cross detail
    px(ctx, 7, 6, o); px(ctx, 8, 6, o);
    px(ctx, 7, 7, o); px(ctx, 8, 7, o);
    // tape ends
    px(ctx, 4, 6, w); px(ctx, 11, 6, w);
  },

  /** 💞 revolving hearts */
  heart_revolving(ctx) {
    const r = PAL.red; const p = PAL.pink; const o = PAL.outline;
    // small heart 1
    rect(ctx, 2, 3, 2, 2, r); rect(ctx, 4, 3, 2, 2, r);
    rect(ctx, 2, 5, 4, 2, r); rect(ctx, 3, 7, 2, 1, r);
    line(ctx, 1, 4, 1, 5, o); line(ctx, 1, 5, 3, 8, o);
    line(ctx, 3, 8, 5, 8, o); line(ctx, 5, 8, 7, 5, o);
    line(ctx, 7, 5, 7, 4, o); line(ctx, 6, 3, 4, 3, o);
    line(ctx, 3, 3, 1, 4, o);
    // orbit ring
    circ(ctx, 8, 8, 6, null, PAL.lightBlue);
    // small heart 2 (rotated position)
    rect(ctx, 10, 9, 2, 2, p); rect(ctx, 12, 9, 2, 2, p);
    rect(ctx, 10, 11, 4, 2, p); rect(ctx, 11, 13, 2, 1, p);
    line(ctx, 9, 10, 9, 11, o); line(ctx, 9, 11, 11, 14, o);
    line(ctx, 11, 14, 13, 14, o); line(ctx, 13, 14, 15, 11, o);
    line(ctx, 15, 11, 15, 10, o); line(ctx, 14, 9, 12, 9, o);
    line(ctx, 11, 9, 9, 10, o);
  },

  /** 💕 two hearts */
  heart_two(ctx) {
    const r = PAL.red; const p = PAL.pink; const o = PAL.outline;
    // small heart left
    rect(ctx, 2, 4, 2, 2, r); rect(ctx, 4, 4, 2, 2, r);
    rect(ctx, 2, 6, 4, 2, r); rect(ctx, 3, 8, 2, 1, r);
    line(ctx, 1, 5, 1, 6, o); line(ctx, 1, 6, 3, 9, o);
    line(ctx, 3, 9, 5, 9, o); line(ctx, 5, 9, 7, 6, o);
    line(ctx, 7, 6, 7, 5, o); line(ctx, 6, 4, 4, 4, o);
    line(ctx, 3, 4, 1, 5, o);
    // large heart right
    rect(ctx, 9, 6, 3, 2, p); rect(ctx, 12, 6, 3, 2, p);
    rect(ctx, 9, 8, 6, 3, p); rect(ctx, 10, 11, 4, 2, p);
    rect(ctx, 11, 13, 2, 1, p);
    line(ctx, 8, 7, 8, 9, o); line(ctx, 8, 9, 11, 14, o);
    line(ctx, 11, 14, 13, 14, o); line(ctx, 13, 14, 16, 9, o);
    line(ctx, 16, 9, 16, 7, o); line(ctx, 15, 6, 12, 6, o);
    line(ctx, 11, 6, 8, 7, o);
  },

};

// ============================================================
// FALLBACK / MISSING EMOJI HANDLER
// ============================================================

/**
 * Renders a "?" in a box for any missing emoji name.
 * @param {CanvasRenderingContext2D} ctx
 */
function drawMissing(ctx) {
  rect(ctx, 2, 2, 12, 12, PAL.yellow);
  outlineRect(ctx, 2, 2, 12, 12, PAL.outline);
  rect(ctx, 6, 4, 2, 2, PAL.outline);
  rect(ctx, 6, 7, 2, 4, PAL.outline);
  px(ctx, 7, 12, PAL.outline);
}

// ============================================================
// EMOJI CACHE
// ============================================================

/** @type {Map<string, HTMLCanvasElement>} */
const _cache = new Map();

/** @type {number} Default emoji sprite size in pixels */
const DEFAULT_SIZE = 16;

/**
 * Generates a single emoji canvas at the requested size.
 * Results are cached per (name, size) pair.
 *
 * @param {string} name — One of the keys in DRAWERS
 * @param {number} [size=16] — Output width/height in px
 * @returns {HTMLCanvasElement}
 */
export function getEmoji(name, size = DEFAULT_SIZE) {
  const cacheKey = `${name}:${size}`;
  if (_cache.has(cacheKey)) {
    return _cache.get(cacheKey);
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Pixel-perfect: disable smoothing, keep crisp edges
  ctx.imageSmoothingEnabled = false;

  // If size != 16, scale the coordinate system so all drawer code still works in 16×16 space
  if (size !== 16) {
    ctx.scale(size / 16, size / 16);
  }

  const drawer = DRAWERS[name];
  if (drawer) {
    drawer(ctx);
  } else {
    drawMissing(ctx);
    console.warn(`[PixelEmoji] Missing emoji: "${name}"`);
  }

  _cache.set(cacheKey, canvas);
  return canvas;
}

/**
 * Draws an emoji directly onto an existing canvas context.
 * No cache is used — draws fresh each call.
 *
 * @param {CanvasRenderingContext2D} ctx — Target 2D context
 * @param {string} name — Emoji key
 * @param {number} x — Destination X
 * @param {number} y — Destination Y
 * @param {number} [size=16] — Width/height in px
 */
export function drawEmoji(ctx, name, x, y, size = DEFAULT_SIZE) {
  const src = getEmoji(name, 16); // always generate at native resolution
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, x, y, size, size);
  ctx.restore();
}

/**
 * Returns an array of all defined emoji names.
 * @returns {Array<string>}
 */
export function getAllEmojis() {
  return Object.keys(DRAWERS);
}

/**
 * Pre-generates every emoji at 16×16 and stores it in the internal cache.
 * Call during a loading screen to avoid stutter later.
 * @param {number} [size=16]
 * @returns {number} Count of emojis generated
 */
export function preload(size = 16) {
  let count = 0;
  for (const name of Object.keys(DRAWERS)) {
    getEmoji(name, size);
    count++;
  }
  console.log(`[PixelEmoji] Preloaded ${count} emojis at ${size}×${size}`);
  return count;
}

/**
 * Clears the internal emoji cache, freeing canvas memory.
 */
export function clearCache() {
  _cache.clear();
}

/**
 * Checks whether an emoji name exists.
 * @param {string} name
 * @returns {boolean}
 */
export function hasEmoji(name) {
  return name in DRAWERS;
}

// ============================================================
// DEFAULT EXPORT — PixelEmoji namespace object
// ============================================================

/**
 * @namespace PixelEmoji
 * @description Central API for all procedural pixel-art emoji sprites.
 */
const PixelEmoji = {
  getEmoji,
  drawEmoji,
  getAllEmojis,
  preload,
  clearCache,
  hasEmoji,
  PALETTE: { ...PAL },
};

export default PixelEmoji;
