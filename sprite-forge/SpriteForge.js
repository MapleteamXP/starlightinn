/**
 * ═══════════════════════════════════════════════════════════════
 * STARLIGHT SPRITE FORGE — Procedural Pixel Art Generator
 * Analyzes chibi sprite patterns to generate infinite variations
 * ═══════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

// ─── Sprite Dimensions (Maplestory proportions) ────────────────────
const SPRITE_W = 32;
const SPRITE_H = 48;
const DIRECTIONS = ['down', 'left', 'right', 'up'];
const FRAMES_PER_DIR = 2; // idle + walk

// ─── Base Chibi Anatomy Pattern (pixel-perfect grid) ───────────────
// Format: [x, y, w, h, colorKey] — all in sprite-local coordinates
// This defines the CANONICAL chibi body that all variations stem from

const ANATOMY = {
  // HEAD (oversized — 60% of sprite height, cute factor)
  head: { x: 8, y: 4, w: 16, h: 14 },
  
  // FACE (within head, centered)
  face: { x: 10, y: 6, w: 12, h: 10 },
  
  // EYES (large, expressive — 3×3 each, spaced apart)
  eyeL: { x: 11, y: 10, w: 3, h: 3 },
  eyeR: { x: 18, y: 10, w: 3, h: 3 },
  
  // PUPILS (2×2, slightly down-right for cuteness)
  pupilL: { x: 12, y: 11, w: 2, h: 2 },
  pupilR: { x: 19, y: 11, w: 2, h: 2 },
  
  // BLUSH (under eyes, 2×1 soft rectangles)
  blushL: { x: 10, y: 14, w: 3, h: 1 },
  blushR: { x: 20, y: 14, w: 3, h: 1 },
  
  // MOUTH (tiny, center-bottom of face, 2×1 or 1×1)
  mouth: { x: 15, y: 15, w: 2, h: 1 },
  
  // HAIR BASE (frames face, varies wildly by style)
  hairBase: { x: 6, y: 0, w: 20, h: 18 },
  
  // BODY (tiny — only 30% of height, head dominates)
  torso: { x: 10, y: 20, w: 12, h: 10 },
  
  // LEGS (short, stubby, 3×8 each)
  legL: { x: 11, y: 30, w: 4, h: 8 },
  legR: { x: 17, y: 30, w: 4, h: 8 },
  
  // FEET (3×2 nubbins)
  footL: { x: 10, y: 38, w: 5, h: 2 },
  footR: { x: 17, y: 38, w: 5, h: 2 },
  
  // ARMS (2×6, attach to torso sides)
  armL: { x: 6, y: 22, w: 3, h: 7 },
  armR: { x: 23, y: 22, w: 3, h: 7 },
  
  // HANDS (2×2)
  handL: { x: 5, y: 29, w: 3, h: 2 },
  handR: { x: 24, y: 29, w: 3, h: 2 },
};

// ─── Hair Style Pixel Patterns (each is an array of {x, y, w, h} offsets from hairBase) ──
const HAIR_STYLES = {
  // Long flowing (Luna mage style)
  long: [
    {x:-2,y:0,w:4,h:20},{x:22,y:0,w:4,h:20}, // side falls
    {x:0,y:-2,w:24,h:6}, // bangs across
    {x:6,y:4,w:4,h:16},{x:18,y:4,w:4,h:16}, // inner volume
    {x:2,y:18,w:6,h:6},{x:20,y:18,w:6,h:6}, // tips curling
  ],
  // Short spiky (Kiko pirate style)
  short: [
    {x:0,y:-3,w:8,h:4},{x:16,y:-3,w:8,h:4}, // side spikes
    {x:8,y:-4,w:8,h:5}, // center spike
    {x:4,y:0,w:6,h:6},{x:18,y:0,w:6,h:6}, // side volume
    {x:2,y:6,w:4,h:4},{x:22,y:6,w:4,h:4}, // messy bits
  ],
  // Dreadlock style (Rasta)
  dreads: [
    {x:-1,y:2,w:3,h:22},{x:4,y:4,w:3,h:20},{x:9,y:5,w:3,h:18}, // left dreads
    {x:30,y:2,w:3,h:22},{x:25,y:4,w:3,h:20},{x:20,y:5,w:3,h:18}, // right dreads
    {x:0,y:-2,w:32,h:5}, // band across top
  ],
  // Twin tails (Neko catgirl style)
  twintails: [
    {x:0,y:2,w:6,h:8},{x:26,y:2,w:6,h:8}, // base buns
    {x:-4,y:6,w:6,h:16},{x:30,y:6,w:6,h:16}, // tails flowing down
    {x:2,y:10,w:4,h:10},{x:28,y:10,w:4,h:10}, // inner volume
    {x:6,y:-2,w:20,h:6}, // bangs
  ],
  // Bunny ears (Bun-Bun)
  bunny: [
    {x:4,y:-14,w:5,h:16},{x:23,y:-14,w:5,h:16}, // long ears up
    {x:5,y:-12,w:3,h:10},{x:24,y:-12,w:3,h:10}, // inner ear
    {x:6,y:0,w:20,h:8}, // head fluff
    {x:2,y:4,w:6,h:6},{x:24,y:4,w:6,h:6}, // cheek fluff
  ],
  // Robot dome (Byte)
  robot: [
    {x:4,y:-2,w:24,h:14}, // dome
    {x:6,y:-1,w:20,h:10}, // face screen area
    {x:14,y:-6,w:4,h:6}, // antenna base
    {x:15,y:-10,w:2,h:6}, // antenna stick
    {x:14,y:-12,w:4,h:3}, // antenna ball
    {x:10,y:12,w:3,h:3},{x:19,y:12,w:3,h:3}, // side bolts
  ],
};

// ─── Outfit Patterns (torso + legs variations) ─────────────────────
const OUTFITS = {
  // Default tunic/dress
  tunic: {
    torso: [{x:0,y:0,w:12,h:10},{x:0,y:8,w:12,h:4}], // main + hem
    legs: [{x:0,y:0,w:4,h:8},{x:0,y:0,w:4,h:8}], // pants under
  },
  // Pirate coat
  pirate: {
    torso: [{x:-1,y:0,w:14,h:10},{x:0,y:8,w:12,h:5}], // coat + tails
    legs: [{x:0,y:0,w:4,h:8},{x:0,y:0,w:4,h:8}],
  },
  // Mage robe
  robe: {
    torso: [{x:-2,y:0,w:16,h:18}], // long robe covers legs
    legs: [{x:1,y:10,w:2,h:6},{x:1,y:10,w:2,h:6}], // barely visible
  },
  // Robot body
  mech: {
    torso: [{x:-1,y:0,w:14,h:10},{x:1,y:8,w:10,h:4}], // boxy + panel
    legs: [{x:0,y:0,w:4,h:8},{x:0,y:0,w:4,h:8}], // mechanical joints
  },
};

// ─── Color Palettes ──────────────────────────────────────────────
const PALETTES = {
  skin:  ['#f5d0b5','#e8b896','#d4a07a','#c28b65','#a06d4f','#7d5239','#5a3a28','#3d2719'],
  hair:  ['#1a1a1a','#4a3018','#8b6914','#c9a227','#e85d75','#7dd3c0','#b8a9d9','#ff9f5e','#ff5252','#4fc3f7'],
  outfit:['#ff9f5e','#7dd3c0','#b8a9d9','#ffd54f','#ff8a65','#ba68c8','#4fc3f7','#e0e0e0','#ff5252','#2a2040'],
  metal: ['#b0b0b0','#c0c0c0','#a0a0a0','#808080','#909090'], // for robot
  glow:  ['#ffd700','#ff9f5e','#ff5252','#4fc3f7','#7dd3c0'], // eye glows, accents
};

// ─── Canvas-based PNG Generator ────────────────────────────────────
class SpriteForge {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this._initNodeCanvas();
  }
  
  _initNodeCanvas() {
    // Try to use node-canvas if available, otherwise create a mock for browser
    try {
      const { createCanvas } = require('canvas');
      this._createCanvas = createCanvas;
    } catch (e) {
      // Browser fallback — will use document.createElement('canvas')
      this._createCanvas = null;
    }
  }
  
  createSpriteSheet(characterId, options = {}) {
    const {
      skinColor = 0,
      hairColor = 0,
      outfitColor = 0,
      hairStyle = 'long',
      outfitStyle = 'tunic',
      accessories = [],
      facing = 'down',
    } = options;
    
    const W = SPRITE_W;
    const H = SPRITE_H;
    
    // Create canvas for this sprite
    let canvas, ctx;
    if (this._createCanvas) {
      canvas = this._createCanvas(W, H);
      ctx = canvas.getContext('2d');
    } else {
      canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      ctx = canvas.getContext('2d');
    }
    
    // Disable smoothing for crisp pixels
    ctx.imageSmoothingEnabled = false;
    
    // ─── DRAW BASE ─────────────────────────────────────────
    const skin = PALETTES.skin[skinColor % PALETTES.skin.length];
    const hair = PALETTES.hair[hairColor % PALETTES.hair.length];
    const outfit = PALETTES.outfit[outfitColor % PALETTES.outfit.length];
    const metal = PALETTES.metal[0];
    
    // 1. LEGS (behind everything)
    const legL = ANATOMY.legL;
    const legR = ANATOMY.legR;
    ctx.fillStyle = skin;
    ctx.fillRect(legL.x, legL.y, legL.w, legL.h);
    ctx.fillRect(legR.x, legR.y, legR.w, legR.h);
    
    // 2. FEET
    const footL = ANATOMY.footL;
    const footR = ANATOMY.footR;
    ctx.fillStyle = '#3d2719'; // shoe color
    ctx.fillRect(footL.x, footL.y, footL.w, footL.h);
    ctx.fillRect(footR.x, footR.y, footR.w, footR.h);
    
    // 3. TORSO (outfit)
    const torso = ANATOMY.torso;
    ctx.fillStyle = outfit;
    
    // Draw outfit shape
    const outfitData = OUTFITS[outfitStyle] || OUTFITS.tunic;
    outfitData.torso.forEach(rect => {
      ctx.fillRect(torso.x + rect.x, torso.y + rect.y, rect.w, rect.h);
    });
    
    // 4. ARMS
    const armL = ANATOMY.armL;
    const armR = ANATOMY.armR;
    ctx.fillStyle = skin;
    ctx.fillRect(armL.x, armL.y, armL.w, armL.h);
    ctx.fillRect(armR.x, armR.y, armR.w, armR.h);
    
    // 5. HANDS
    const handL = ANATOMY.handL;
    const handR = ANATOMY.handR;
    ctx.fillStyle = skin;
    ctx.fillRect(handL.x, handL.y, handL.w, handL.h);
    ctx.fillRect(handR.x, handR.y, handR.w, handR.h);
    
    // 6. HEAD (big chibi head!)
    const head = ANATOMY.head;
    ctx.fillStyle = skin;
    ctx.fillRect(head.x, head.y, head.w, head.h);
    
    // Round the head slightly (erase corners for circle feel)
    ctx.clearRect(head.x, head.y, 2, 2);
    ctx.clearRect(head.x + head.w - 2, head.y, 2, 2);
    ctx.fillRect(head.x + 1, head.y + 1, head.w - 2, head.h - 1);
    
    // 7. FACE (slightly lighter skin tone for highlight)
    const face = ANATOMY.face;
    ctx.fillStyle = this._lighten(skin, 10);
    ctx.fillRect(face.x, face.y, face.w, face.h);
    
    // 8. EYES (white sclera + black pupil + white highlight)
    const eyeL = ANATOMY.eyeL;
    const eyeR = ANATOMY.eyeR;
    
    // Sclera
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(eyeL.x, eyeL.y, eyeL.w, eyeL.h);
    ctx.fillRect(eyeR.x, eyeR.y, eyeR.w, eyeR.h);
    
    // Pupils (2×2, slightly offset for cuteness)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(eyeL.x + 1, eyeL.y + 1, 2, 2);
    ctx.fillRect(eyeR.x + 1, eyeR.y + 1, 2, 2);
    
    // Eye highlight (1×1, top-left of pupil)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(eyeL.x + 1, eyeL.y + 1, 1, 1);
    ctx.fillRect(eyeR.x + 1, eyeR.y + 1, 1, 1);
    
    // 9. BLUSH (soft pink under eyes)
    const blushL = ANATOMY.blushL;
    const blushR = ANATOMY.blushR;
    ctx.fillStyle = 'rgba(255,150,150,0.5)';
    ctx.fillRect(blushL.x, blushL.y, blushL.w, blushL.h);
    ctx.fillRect(blushR.x, blushR.y, blushR.w, blushR.h);
    
    // 10. MOUTH (tiny, centered)
    const mouth = ANATOMY.mouth;
    ctx.fillStyle = '#a06060';
    ctx.fillRect(mouth.x, mouth.y, mouth.w, mouth.h);
    
    // 11. HAIR (the defining feature!)
    const hairBase = ANATOMY.hairBase;
    const hStyle = HAIR_STYLES[hairStyle] || HAIR_STYLES.long;
    ctx.fillStyle = hair;
    hStyle.forEach(rect => {
      ctx.fillRect(hairBase.x + rect.x, hairBase.y + rect.y, rect.w, rect.h);
    });
    
    // 11b. HAIR HIGHLIGHTS (add dimension with lighter streaks)
    const hairHighlight = this._lighten(hair, 20);
    ctx.fillStyle = hairHighlight;
    if (hairStyle === 'long') {
      ctx.fillRect(hairBase.x + 8, hairBase.y + 2, 4, 2);
      ctx.fillRect(hairBase.x + 14, hairBase.y + 8, 3, 2);
    } else if (hairStyle === 'short') {
      ctx.fillRect(hairBase.x + 10, hairBase.y + 1, 4, 2);
    } else if (hairStyle === 'dreads') {
      ctx.fillRect(hairBase.x + 2, hairBase.y + 4, 2, 2);
      ctx.fillRect(hairBase.x + 26, hairBase.y + 4, 2, 2);
    } else if (hairStyle === 'twintails') {
      ctx.fillRect(hairBase.x + 2, hairBase.y + 6, 3, 2);
      ctx.fillRect(hairBase.x + 27, hairBase.y + 6, 3, 2);
    } else if (hairStyle === 'bunny') {
      ctx.fillRect(hairBase.x + 6, hairBase.y - 10, 2, 4);
      ctx.fillRect(hairBase.x + 25, hairBase.y - 10, 2, 4);
    } else if (hairStyle === 'robot') {
      ctx.fillStyle = this._lighten(metal, 15);
      ctx.fillRect(hairBase.x + 8, hairBase.y + 2, 16, 3);
    }
    
    // 11c. HAIR SHADOWS (add depth)
    const hairShadow = this._darken(hair, 20);
    ctx.fillStyle = hairShadow;
    if (hairStyle !== 'robot') {
      ctx.fillRect(hairBase.x + 8, hairBase.y + 14, 16, 2);
    }
    
    // 12. ACCESSORIES (cat ears, hats, glasses, etc.)
    accessories.forEach(acc => {
      this._drawAccessory(ctx, acc, hair, skin, outfit);
    });
    
    // 13. OUTLINE (1-pixel dark border around entire sprite for pop)
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, W, H);
    
    return { canvas, characterId, options };
  }
  
  _drawAccessory(ctx, acc, hairColor, skinColor, outfitColor) {
    switch(acc) {
      case 'cat_ears':
        ctx.fillStyle = hairColor;
        ctx.fillRect(4, -2, 6, 6);   // left ear
        ctx.fillRect(22, -2, 6, 6);  // right ear
        ctx.fillStyle = '#ffb7c5'; // inner ear pink
        ctx.fillRect(5, 0, 3, 3);
        ctx.fillRect(23, 0, 3, 3);
        break;
      case 'sunglasses':
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(9, 10, 5, 3);   // left lens
        ctx.fillRect(18, 10, 5, 3);  // right lens
        ctx.fillRect(14, 11, 3, 1);  // bridge
        break;
      case 'headband':
        ctx.fillStyle = '#4a3018';
        ctx.fillRect(6, 2, 20, 3);
        break;
      case 'witch_hat':
        ctx.fillStyle = '#2a2040';
        ctx.fillRect(10, -10, 12, 14); // cone
        ctx.fillRect(6, 4, 20, 3);      // brim
        ctx.fillStyle = '#b8a9d9';
        ctx.fillRect(14, -2, 4, 2);   // band
        break;
      case 'pirate_hat':
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(6, -4, 20, 8);   // main
        ctx.fillRect(2, 4, 28, 3);    // brim wide
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(14, 0, 4, 2);   // emblem
        break;
      case 'staff':
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(28, 14, 2, 20);  // stick
        ctx.fillStyle = '#4fc3f7';
        ctx.fillRect(27, 10, 4, 4);   // crystal
        break;
      case 'cape':
        ctx.fillStyle = '#b8a9d9';
        ctx.fillRect(8, 20, 16, 18);  // back cape
        break;
      case 'eyepatch':
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(18, 10, 4, 3);
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(17, 9, 6, 1); // strap
        break;
      case 'bunny_ears':
        ctx.fillStyle = '#f5d0b5';
        ctx.fillRect(6, -14, 5, 16);  // left
        ctx.fillRect(21, -14, 5, 16); // right
        ctx.fillStyle = '#ffb7c5';
        ctx.fillRect(7, -12, 3, 12);
        ctx.fillRect(22, -12, 3, 12);
        break;
      case 'carrot':
        ctx.fillStyle = '#ff9f5e';
        ctx.fillRect(28, 26, 3, 8);   // carrot body
        ctx.fillStyle = '#7dd3c0';
        ctx.fillRect(28, 22, 3, 4);   // greens
        break;
      case 'antenna':
        ctx.fillStyle = '#888888';
        ctx.fillRect(15, -8, 2, 8);   // stick
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(14, -10, 4, 3);  // ball
        break;
      case 'screen_face':
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(10, 6, 12, 10);  // screen
        ctx.fillStyle = '#4fc3f7';
        ctx.fillRect(12, 10, 2, 2);   // eye 1
        ctx.fillRect(18, 10, 2, 2);   // eye 2
        ctx.fillStyle = '#7dd3c0';
        ctx.fillRect(14, 14, 4, 1);  // mouth
        break;
    }
  }
  
  _lighten(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }
  
  _darken(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }
  
  // Generate a full sprite sheet (all directions, idle + walk)
  generateSpriteSheet(characterConfig) {
    const directions = ['down', 'left', 'right', 'up'];
    const frames = 2; // idle, walk
    const sheetW = SPRITE_W * frames;
    const sheetH = SPRITE_H * directions.length;
    
    let canvas, ctx;
    if (this._createCanvas) {
      canvas = this._createCanvas(sheetW, sheetH);
      ctx = canvas.getContext('2d');
    } else {
      canvas = document.createElement('canvas');
      canvas.width = sheetW; canvas.height = sheetH;
      ctx = canvas.getContext('2d');
    }
    ctx.imageSmoothingEnabled = false;
    
    directions.forEach((dir, dirIdx) => {
      for (let frame = 0; frame < frames; frame++) {
        const sprite = this.createSpriteSheet(characterConfig.id, {
          ...characterConfig,
          facing: dir,
        });
        
        // Extract canvas data and draw onto sheet
        ctx.drawImage(sprite.canvas, frame * SPRITE_W, dirIdx * SPRITE_H);
      }
    });
    
    return canvas;
  }
  
  // Save PNG to disk (Node.js only)
  savePng(canvas, filepath) {
    if (canvas.toBuffer) {
      const buf = canvas.toBuffer('image/png');
      fs.writeFileSync(filepath, buf);
    } else {
      // Browser fallback — would need blob download
      console.log('Browser mode — use canvas.toBlob() for download');
    }
  }
}

// ─── Character Presets ─────────────────────────────────────────────
const CHARACTERS = [
  { id: 'neko',    name: 'Neko',    hairStyle: 'twintails', outfitStyle: 'tunic',  accessories: ['cat_ears'], skinColor: 1, hairColor: 4, outfitColor: 0 },
  { id: 'rasta',   name: 'Rasta',   hairStyle: 'dreads',    outfitStyle: 'tunic',  accessories: ['headband', 'sunglasses'], skinColor: 4, hairColor: 2, outfitColor: 5 },
  { id: 'luna',    name: 'Luna',    hairStyle: 'long',      outfitStyle: 'robe',   accessories: ['witch_hat', 'staff', 'cape'], skinColor: 0, hairColor: 6, outfitColor: 3 },
  { id: 'kiko',    name: 'Cpt.Kiko',hairStyle: 'short',     outfitStyle: 'pirate', accessories: ['pirate_hat', 'eyepatch'], skinColor: 2, hairColor: 0, outfitColor: 8 },
  { id: 'bunbun',  name: 'Bun-Bun', hairStyle: 'bunny',     outfitStyle: 'tunic',  accessories: ['bunny_ears', 'carrot'], skinColor: 0, hairColor: 1, outfitColor: 1 },
  { id: 'byte',    name: 'Byte',    hairStyle: 'robot',     outfitStyle: 'mech',   accessories: ['antenna', 'screen_face'], skinColor: 0, hairColor: 0, outfitColor: 6 },
];

// ─── Random Character Generator (Infinite Variations!) ──────────────
function generateRandomCharacter(seed) {
  const rng = mulberry32(seed || Date.now());
  const hairStyles = Object.keys(HAIR_STYLES);
  const outfitStyles = Object.keys(OUTFITS);
  const accessoryPool = ['cat_ears', 'sunglasses', 'headband', 'witch_hat', 'staff', 'cape', 'pirate_hat', 'eyepatch', 'bunny_ears', 'carrot', 'antenna', 'screen_face'];
  
  const numAccessories = Math.floor(rng() * 3); // 0-2 accessories
  const accessories = [];
  for (let i = 0; i < numAccessories; i++) {
    const acc = accessoryPool[Math.floor(rng() * accessoryPool.length)];
    if (!accessories.includes(acc)) accessories.push(acc);
  }
  
  return {
    id: `random_${seed || Date.now()}`,
    name: `Traveler ${Math.floor(rng() * 999)}`,
    hairStyle: hairStyles[Math.floor(rng() * hairStyles.length)],
    outfitStyle: outfitStyles[Math.floor(rng() * outfitStyles.length)],
    accessories,
    skinColor: Math.floor(rng() * PALETTES.skin.length),
    hairColor: Math.floor(rng() * PALETTES.hair.length),
    outfitColor: Math.floor(rng() * PALETTES.outfit.length),
  };
}

// Simple PRNG for deterministic variation
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Node.js Execution ───────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SpriteForge, CHARACTERS, SPRITE_W, SPRITE_H, generateRandomCharacter, mulberry32 };
  
  // Auto-generate if run directly
  if (require.main === module) {
    const forge = new SpriteForge();
    const outDir = path.join(__dirname, 'generated-sprites');
    
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    
    console.log('🎨 Starlight Sprite Forge — Generating character sprites...\n');
    
    // Generate the 6 canonical characters
    CHARACTERS.forEach(char => {
      const sprite = forge.createSpriteSheet(char.id, char);
      const filepath = path.join(outDir, `${char.id}.png`);
      forge.savePng(sprite.canvas, filepath);
      console.log(`✅ ${char.name} → ${filepath}`);
    });
    
    // Generate 10 random variations (infinite possible!)
    console.log('\n🎲 Generating 10 random travelers...\n');
    for (let i = 0; i < 10; i++) {
      const seed = Date.now() + i * 1337;
      const randChar = generateRandomCharacter(seed);
      const sprite = forge.createSpriteSheet(randChar.id, randChar);
      const filepath = path.join(outDir, `random_${i}.png`);
      forge.savePng(sprite.canvas, filepath);
      console.log(`🎲 ${randChar.name} (${randChar.hairStyle} + ${randChar.outfitStyle}) → ${filepath}`);
    }
    
    console.log(`\n🌟 Generated ${CHARACTERS.length + 10} sprites in ${outDir}/`);
    console.log('Each sprite is 32×48 pixels, Maplestory-style chibi proportions');
    console.log('Run again for 10 NEW random characters! 🔄');
  }
}

// ─── Browser Globals ─────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.SpriteForge = SpriteForge;
  window.CHARACTERS = CHARACTERS;
}
