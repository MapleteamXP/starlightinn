/**
 * Avatar.js — Procedural chibi avatar rendering engine for Starlight Inn v3.0
 *
 * Draws cozy-core chibi avatars using Canvas 2D primitives (fillRect, arc,
 * ellipse) with HSL runtime colorisation. Supports 12 character archetypes,
 * 6 facial expressions, accessory overlays, gesture animations, and a
 * shadow-based interaction anchor.
 *
 * @author Starlight Inn Team
 * @version 3.0.0
 */

/** @typedef {import('../Game.js').Game} Game */
import { AnimationEngine } from './AnimationEngine.js';

/**
 * @typedef {Object} AvatarOptions
 * @property {string} charId - Character archetype id
 * @property {number} [skinHue=30]   - Skin hue shift (0-360)
 * @property {number} [hairHue=0]    - Hair hue shift (0-360)
 * @property {number} [outfitHue=200]- Outfit hue shift (0-360)
 * @property {string} [expression='happy'] - Current expression key
 * @property {string[]} [accessories=[]]   - Active accessory ids
 * @property {number} [facing=1]   - 1 = right, -1 = left
 * @property {number} [bobOffset=0] - Vertical bob offset from walking
 * @property {number} [gestureProgress=0] - 0..1 gesture animation phase
 */

/**
 * @typedef {Object} RGB
 * @property {number} r
 * @property {number} g
 * @property {number} b
 */

/** Palette base colours (neutral) — shifted at runtime via HSL. */
const PALETTES = {
  skin:  { r: 255, g: 224, b: 196 },
  hair:  { r:  80, g:  60, b:  40 },
  outfit:{ r: 100, g: 150, b: 200 },
  shoes: { r:  50, g:  50, b:  55 },
  blush: { r: 255, g: 120, b: 140 }
};

/** Expression config: eye shape, mouth shape, blush intensity. */
const EXPRESSIONS = {
  happy:     { eye: 'happy',  mouth: 'smile', blush: 1.0 },
  sad:       { eye: 'sad',    mouth: 'frown', blush: 0.3 },
  cool:      { eye: 'cool',   mouth: 'smirk', blush: 0.0 },
  love:      { eye: 'hearts', mouth: 'bigsmile', blush: 1.0 },
  surprised: { eye: 'wide',   mouth: 'open', blush: 0.2 },
  sleepy:    { eye: 'sleep',  mouth: 'drool', blush: 0.1 }
};

/** Accessory draw helpers lookup. */
const ACCESSORY_DRAWERS = [
  'sunglasses', 'headband', 'witch_hat', 'staff',
  'cape', 'pirate_hat', 'eyepatch', 'carrot'
];

export class Avatar {
  /**
   * @param {Game} game — the main game instance (provides state + frameCount)
   */
  constructor(game) {
    this.game = game;
    this.debug = false;

    // ── Animation System Integration ─────────────────────────────────
    /** @type {AnimationEngine} Squash-and-stretch animation state machine. */
    this.animationEngine = new AnimationEngine();
    /** @type {string|null} Currently playing animation track ID. */
    this.currentAnimId = null;
    /** @type {number} Animation playback time accumulator. */
    this.animTime = 0;
    /** @type {Object} Current animation transform values (scaleX/Y, rotation, y-offset). */
    this.animTransform = { scaleX: 1, scaleY: 1, rotation: 0, y: 0, skewX: 0 };
    /** @type {string} Animation state: idle | walk | run | emote | sit | sleep | knocked | dance */
    this.animState = 'idle';
    /** @type {number} Entity ID for animation engine tracking. */
    this.animEntityId = 'avatar_' + Math.random().toString(36).slice(2, 8);
  }

  /**
   * Main draw routine — renders a complete chibi avatar.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx  — centre X (world / screen space)
   * @param {number} cy  — centre Y (feet position on ground)
   * @param {number} scale — uniform sprite scale (1.0 = 64 px tall)
   * @param {AvatarOptions} options
   */
  draw(ctx, cx, cy, scale, options) {
    const s = scale;                         // local shorthand
    const o = {                              // defaults merged
      charId: 'human',
      skinHue: 0, hairHue: 0, outfitHue: 0,
      expression: 'happy',
      accessories: [],
      facing: 1,
      bobOffset: 0,
      gestureProgress: 0,
      ...options
    };

    const skin   = this.shiftColor(PALETTES.skin,   o.skinHue,   0, 0);
    const hair   = this.shiftColor(PALETTES.hair,   o.hairHue,   0, 0);
    const outfit = this.shiftColor(PALETTES.outfit, o.outfitHue, 0, 0);
    const shoes  = PALETTES.shoes;
    const blush  = PALETTES.blush;

    // ── Get current animation transforms ──────────────────────
    const animTx = this.animationEngine.getTransform(this.animEntityId);
    const sx = animTx.scaleX || 1;
    const sy = animTx.scaleY || 1;
    const animRot = animTx.rotation || 0;
    const animYOffset = animTx.y || 0;

    ctx.save();
    // Apply bob + animation Y offset
    ctx.translate(cx, cy - (o.bobOffset + animYOffset) * s);
    // Apply facing scale * squash-and-stretch (preserve facing direction)
    ctx.scale(o.facing * s * sx, s * sy);
    // Apply animation rotation (slight body tilt from movement/emotes)
    if (animRot !== 0) {
      ctx.rotate((animRot * Math.PI) / 180);
    }

    // ── 1. Shadow anchor ──────────────────────────────────────
    // Shadow is drawn BEFORE the entity at the bottom layer
    this.drawShadow(ctx, 0, 0, 28, 8, 0.25);

    // ── 2. Legs ───────────────────────────────────────────────
    ctx.fillStyle = this.rgbToHex(skin);
    ctx.fillRect(-8, -18, 6, 14);   // left leg
    ctx.fillRect(2,  -18, 6, 14);   // right leg

    // ── 3. Shoes ──────────────────────────────────────────────
    ctx.fillStyle = this.rgbToHex(shoes);
    ctx.fillRect(-9, -6, 8, 5);
    ctx.fillRect(1,  -6, 8, 5);

    // ── 4. Torso (outfit) ───────────────────────────────────
    ctx.fillStyle = this.rgbToHex(outfit);
    ctx.fillRect(-10, -36, 20, 20);
    // outfit detail — collar
    ctx.fillStyle = this.lighten(outfit, 15);
    ctx.fillRect(-6, -36, 12, 4);

    // ── 5. Arms ──────────────────────────────────────────────
    ctx.fillStyle = this.rgbToHex(skin);
    ctx.fillRect(-14, -34, 4, 14);  // left arm
    ctx.fillRect(10,  -34, 4, 14);  // right arm

    // ── 6. Hands ─────────────────────────────────────────────
    ctx.fillStyle = this.rgbToHex(skin);
    ctx.beginPath();
    ctx.arc(-12, -20, 3, 0, Math.PI * 2);
    ctx.arc(12,  -20, 3, 0, Math.PI * 2);
    ctx.fill();

    // ── 7. Head (oversized chibi — 60 % of sprite height) ─────
    const headSize = 22;   // radius
    ctx.fillStyle = this.rgbToHex(skin);
    ctx.beginPath();
    ctx.arc(0, -48, headSize, 0, Math.PI * 2);
    ctx.fill();

    // ── 8. Face (skin tone — same as head) ──────────────────
    //  (already covered by head circle; ears / blush add detail)

    // ── 9. Expression ───────────────────────────────────────
    this.drawExpression(ctx, o.expression, { headSize, skin, outfit });

    // ── 10. Blush ───────────────────────────────────────────
    const blushCfg = EXPRESSIONS[o.expression] || EXPRESSIONS.happy;
    if (blushCfg.blush > 0) {
      ctx.globalAlpha = blushCfg.blush;
      ctx.fillStyle = this.rgbToHex(blush);
      ctx.beginPath();
      ctx.ellipse(-10, -44, 4, 2.5, 0, 0, Math.PI * 2);
      ctx.ellipse(10,  -44, 4, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // ── 11. Hair ──────────────────────────────────────────────
    const hairFn = `drawHair_${o.charId}`;
    if (typeof this[hairFn] === 'function') {
      this[hairFn](ctx, hair, s);
    } else {
      this.drawHair_human(ctx, hair, 'medium', s);
    }

    // ── 12. Accessories ──────────────────────────────────────
    o.accessories.forEach(acc => this.drawAccessory(ctx, acc, { hair, outfit, skin, headSize }));

    // ── 13. Gesture overlay ───────────────────────────────────
    if (o.gestureProgress > 0) {
      this.drawGestureOverlay(ctx, o.gestureProgress, { headSize, outfit });
    }

    // ── 14. Subtle outline ──────────────────────────────────
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -48, headSize, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /* ============================================================
     12 CHARACTER HAIR STYLES
     ============================================================ */

  /**
   * Catgirl: twintails + cat ears.
   * @param {CanvasRenderingContext2D} ctx
   * @param {RGB} hairColor
   * @param {number} s — scale
   */
  drawHair_catgirl(ctx, hairColor, s) {
    const c = this.rgbToHex(hairColor);
    ctx.fillStyle = c;
    // Twintails
    ctx.fillRect(-18, -58, 7, 22);
    ctx.fillRect(11,  -58, 7, 22);
    // Bangs
    ctx.fillRect(-12, -62, 24, 8);
    // Cat ears
    ctx.beginPath();
    ctx.moveTo(-14, -64); ctx.lineTo(-18, -74); ctx.lineTo(-6, -66);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -64);  ctx.lineTo(18, -74);  ctx.lineTo(6,  -66);
    ctx.fill();
    // Inner ear (pink)
    ctx.fillStyle = '#ffb7c5';
    ctx.beginPath();
    ctx.moveTo(-14, -65); ctx.lineTo(-16, -71); ctx.lineTo(-8, -67);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -65);  ctx.lineTo(16, -71);  ctx.lineTo(8,  -67);
    ctx.fill();
  }

  /** Human: long / short spiky / medium wavy. */
  drawHair_human(ctx, hairColor, hairStyle, s) {
    const c = this.rgbToHex(hairColor);
    ctx.fillStyle = c;
    const style = hairStyle || 'medium';
    if (style === 'long') {
      ctx.fillRect(-14, -58, 28, 40);       // back hair
      ctx.fillRect(-12, -62, 24, 8);        // bangs
    } else if (style === 'short') {
      ctx.fillRect(-12, -58, 24, 14);       // spiky short
      ctx.fillRect(-12, -62, 6, 6);
      ctx.fillRect(-4,  -64, 8, 6);
      ctx.fillRect(6,   -62, 6, 6);
    } else { // medium wavy
      ctx.fillRect(-14, -58, 28, 22);
      ctx.fillRect(-12, -62, 24, 8);
      ctx.fillRect(-16, -52, 4, 10);
      ctx.fillRect(12,  -52, 4, 10);
    }
  }

  /** Bunny: bunny ears + tail puff. */
  drawHair_bunny(ctx, hairColor, s) {
    const c = this.rgbToHex(hairColor);
    ctx.fillStyle = c;
    ctx.fillRect(-12, -60, 24, 10);   // bangs
    // Ears
    ctx.fillRect(-10, -80, 6, 22);
    ctx.fillRect(4,   -80, 6, 22);
    // Inner ear
    ctx.fillStyle = '#ffeef2';
    ctx.fillRect(-8, -76, 3, 16);
    ctx.fillRect(6,  -76, 3, 16);
    // Tail puff
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(0, -26, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Robot: metallic dome + antenna. */
  drawHair_robot(ctx, s) {
    ctx.fillStyle = '#aabbcc';
    ctx.fillRect(-12, -64, 24, 16);   // dome
    ctx.fillStyle = '#8899aa';
    ctx.fillRect(-10, -68, 20, 6);    // dome top
    // Antenna
    ctx.fillStyle = '#ff5555';
    ctx.fillRect(-1, -78, 2, 10);
    ctx.beginPath();
    ctx.arc(0, -80, 3, 0, Math.PI * 2);
    ctx.fill();
    // Blink light
    ctx.fillStyle = this.game && this.game.frameCount % 60 < 30 ? '#55ff55' : '#338833';
    ctx.beginPath();
    ctx.arc(6, -58, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Fox: fox ears + fluffy tail. */
  drawHair_fox(ctx, hairColor, s) {
    const c = this.rgbToHex(hairColor);
    ctx.fillStyle = c;
    ctx.fillRect(-12, -60, 24, 10);   // bangs
    // Triangular ears
    ctx.beginPath();
    ctx.moveTo(-14, -60); ctx.lineTo(-18, -76); ctx.lineTo(-4, -64);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -60);  ctx.lineTo(18, -76);  ctx.lineTo(4,  -64);
    ctx.fill();
    // Tail behind
    ctx.beginPath();
    ctx.ellipse(16, -30, 14, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Tail tip (white)
    ctx.fillStyle = '#fff8ee';
    ctx.beginPath();
    ctx.ellipse(26, -34, 5, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Dragon: horns + scales on forehead. */
  drawHair_dragon(ctx, hairColor, s) {
    const c = this.rgbToHex(hairColor);
    ctx.fillStyle = c;
    // Horns
    ctx.beginPath();
    ctx.moveTo(-12, -58); ctx.lineTo(-22, -74); ctx.lineTo(-6, -64);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(12, -58);  ctx.lineTo(22, -74);  ctx.lineTo(6, -64);
    ctx.fill();
    // Scale patch
    ctx.fillStyle = this.lighten(hairColor, 20);
    ctx.fillRect(-4, -64, 8, 5);
    ctx.fillRect(-2, -68, 4, 4);
    // Bangs
    ctx.fillStyle = c;
    ctx.fillRect(-12, -60, 24, 8);
  }

  /** Fairy: translucent wings + sparkle hair. */
  drawHair_fairy(ctx, hairColor, s) {
    const c = this.rgbToHex(hairColor);
    ctx.fillStyle = c;
    ctx.fillRect(-12, -60, 24, 14);
    // Wings (behind)
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#d4f7ff';
    ctx.beginPath();
    ctx.ellipse(-20, -50, 10, 18, -0.5, 0, Math.PI * 2);
    ctx.ellipse(20,  -50, 10, 18, 0.5,  0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    // Sparkle highlight
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-4, -62, 3, 3);
    ctx.fillRect(2,  -64, 2, 2);
  }

  /** Ghost: translucent body wisp. */
  drawHair_ghost(ctx, s) {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#e0e8ff';
    ctx.beginPath();
    ctx.moveTo(-14, -56);
    ctx.quadraticCurveTo(0, -80, 14, -56);
    ctx.lineTo(12, -30);
    ctx.quadraticCurveTo(0, -22, -12, -30);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    // Wisp particles
    ctx.fillStyle = '#ffffff';
    const t = this.game ? this.game.frameCount : 0;
    ctx.beginPath();
    ctx.arc(-8 + Math.sin(t * 0.05) * 3, -72, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Mushroom: cap hat. */
  drawHair_mushroom(ctx, s) {
    ctx.fillStyle = '#cc4444';
    ctx.beginPath();
    ctx.ellipse(0, -66, 18, 10, 0, 0, Math.PI, false);
    ctx.fill();
    // Spots
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-8, -68, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6,  -70, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2,  -64, 2.5, 0, Math.PI * 2); ctx.fill();
    // Stem
    ctx.fillStyle = '#f5e6d3';
    ctx.fillRect(-5, -66, 10, 6);
  }

  /** Star: star-shaped hair / crown. */
  drawHair_star(ctx, hairColor, s) {
    const c = this.rgbToHex(hairColor);
    ctx.fillStyle = c;
    ctx.fillRect(-12, -60, 24, 10);
    // Star crown
    ctx.fillStyle = '#ffdd55';
    this.drawStarPolygon(ctx, 0, -72, 8, 5, 0.5);
    // Sparkle
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -78, 2, 2);
  }

  /** Moon: crescent moon accessory. */
  drawHair_moon(ctx, hairColor, s) {
    const c = this.rgbToHex(hairColor);
    ctx.fillStyle = c;
    ctx.fillRect(-12, -60, 24, 10);
    // Crescent
    ctx.fillStyle = '#ffeebb';
    ctx.beginPath();
    ctx.arc(0, -70, 9, Math.PI * 0.2, Math.PI * 1.2, false);
    ctx.arc(0, -70, 5, Math.PI * 1.2, Math.PI * 0.2, true);
    ctx.fill();
  }

  /** Cloud: fluffy cloud hair. */
  drawHair_cloud(ctx, hairColor, s) {
    const c = this.rgbToHex(hairColor);
    ctx.fillStyle = c;
    // Fluffy bumps
    ctx.beginPath(); ctx.arc(-8, -58, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0,  -64, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8,  -58, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-14, -52, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(14,  -52, 6, 0, Math.PI * 2); ctx.fill();
    // Highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-4, -66, 3, 0, Math.PI * 2); ctx.fill();
  }

  /* ============================================================
     EXPRESSIONS (6 moods)
     ============================================================ */

  /**
   * Render eyes + mouth for the chosen expression.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} expression
   * @param {Object} meta — { headSize, skin, outfit }
   */
  drawExpression(ctx, expression, meta) {
    const e = EXPRESSIONS[expression] || EXPRESSIONS.happy;
    const yEye = -52;
    const yMouth = -40;

    // ── Eyes ─────────────────────────────────────────────────
    switch (e.eye) {
      case 'happy':
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-6, yEye, 4, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(6,  yEye, 4, Math.PI, 0);
        ctx.stroke();
        break;

      case 'sad':
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-6, yEye - 2, 4, 0, Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(6,  yEye - 2, 4, 0, Math.PI);
        ctx.stroke();
        // Tears
        ctx.fillStyle = '#88ccff';
        ctx.beginPath(); ctx.arc(-6, yEye + 5, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(6,  yEye + 5, 1.5, 0, Math.PI * 2); ctx.fill();
        break;

      case 'cool':
        ctx.fillStyle = '#111';
        ctx.fillRect(-10, yEye - 2, 8, 4);
        ctx.fillRect(2,   yEye - 2, 8, 4);
        // Sunglasses bridge
        ctx.fillRect(-2,  yEye - 1, 4, 2);
        break;

      case 'hearts':
        ctx.fillStyle = '#ff3366';
        this.drawHeart(ctx, -6, yEye, 3.5);
        this.drawHeart(ctx, 6,  yEye, 3.5);
        break;

      case 'wide':
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(-6, yEye, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(6,  yEye, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-5, yEye - 1, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(7,  yEye - 1, 1.5, 0, Math.PI * 2); ctx.fill();
        break;

      case 'sleep':
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-10, yEye); ctx.lineTo(-2, yEye); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2,  yEye);  ctx.lineTo(10, yEye); ctx.stroke();
        break;
    }

    // ── Mouth ───────────────────────────────────────────────
    ctx.strokeStyle = '#442222';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#442222';
    switch (e.mouth) {
      case 'smile':
        ctx.beginPath();
        ctx.arc(0, yMouth + 2, 4, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        break;
      case 'frown':
        ctx.beginPath();
        ctx.arc(0, yMouth + 6, 4, 1.15 * Math.PI, 1.85 * Math.PI);
        ctx.stroke();
        break;
      case 'smirk':
        ctx.beginPath();
        ctx.moveTo(-4, yMouth + 1); ctx.lineTo(0, yMouth + 3); ctx.lineTo(4, yMouth + 1);
        ctx.stroke();
        break;
      case 'bigsmile':
        ctx.beginPath();
        ctx.arc(0, yMouth + 2, 5, 0, Math.PI);
        ctx.fill();
        // Teeth
        ctx.fillStyle = '#fff';
        ctx.fillRect(-3, yMouth + 2, 6, 2);
        break;
      case 'open':
        ctx.beginPath();
        ctx.ellipse(0, yMouth + 3, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'drool':
        ctx.beginPath();
        ctx.moveTo(-3, yMouth); ctx.quadraticCurveTo(0, yMouth + 4, 3, yMouth);
        ctx.stroke();
        // Drool
        ctx.fillStyle = '#ccddff';
        ctx.beginPath();
        ctx.ellipse(2, yMouth + 6, 1.5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  }

  /* ============================================================
     ACCESSORIES
     ============================================================ */

  /**
   * Dispatch accessory drawing by id.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} accId
   * @param {Object} palette
   */
  drawAccessory(ctx, accId, palette) {
    switch (accId) {
      case 'sunglasses':
        ctx.fillStyle = '#111';
        ctx.fillRect(-12, -56, 10, 5);
        ctx.fillRect(2,  -56, 10, 5);
        ctx.fillRect(-2, -55, 4, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(-10, -55, 3, 2);
        ctx.fillRect(4,   -55, 3, 2);
        break;
      case 'headband':
        ctx.fillStyle = '#ff99aa';
        ctx.fillRect(-14, -60, 28, 3);
        ctx.beginPath(); ctx.arc(0, -60, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6688'; ctx.fill();
        break;
      case 'witch_hat':
        ctx.fillStyle = '#442266';
        ctx.beginPath();
        ctx.moveTo(-16, -58); ctx.lineTo(0, -88); ctx.lineTo(16, -58);
        ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(-14, -62, 28, 3);
        break;
      case 'staff':
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(18, -50, 3, 40);
        ctx.fillStyle = '#55ddff';
        ctx.beginPath(); ctx.arc(19.5, -54, 4, 0, Math.PI * 2); ctx.fill();
        break;
      case 'cape':
        ctx.fillStyle = this.rgbToHex(palette.outfit);
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(-10, -36); ctx.lineTo(-18, -6); ctx.lineTo(18, -6); ctx.lineTo(10, -36);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        break;
      case 'pirate_hat':
        ctx.fillStyle = '#222233';
        ctx.beginPath();
        ctx.ellipse(0, -64, 18, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-8, -72, 16, 10);
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(-2, -68, 4, 4);
        break;
      case 'eyepatch':
        ctx.fillStyle = '#111';
        ctx.fillRect(2, -56, 8, 6);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-6, -54); ctx.lineTo(10, -54); ctx.stroke();
        break;
      case 'carrot':
        ctx.fillStyle = '#ff8822';
        ctx.beginPath();
        ctx.ellipse(12, -58, 4, 10, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#33aa33';
        ctx.fillRect(10, -70, 2, 6);
        ctx.fillRect(13, -70, 2, 5);
        break;
    }
  }

  /* ============================================================
     GESTURE OVERLAY
     ============================================================ */

  /**
   * Draw a subtle overlay when a gesture is active.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} progress 0..1
   * @param {Object} meta
   */
  drawGestureOverlay(ctx, progress, meta) {
    ctx.globalAlpha = 0.3 * (1 - progress);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -48, meta.headSize + 2 + progress * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  /* ============================================================
     SHADOW ANCHOR
     ============================================================ */

  /**
   * Draw an elliptical shadow beneath the avatar.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx   — local X centre
   * @param {number} cy   — local Y centre (ground level)
   * @param {number} w    — ellipse width
   * @param {number} h    — ellipse height
   * @param {number} [alpha=0.25] — shadow opacity
   */
  drawShadow(ctx, cx, cy, w, h, alpha = 0.25) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, w);
    grad.addColorStop(0, 'rgba(30,30,40,0.55)');
    grad.addColorStop(0.5, 'rgba(30,30,40,0.15)');
    grad.addColorStop(1, 'rgba(30,30,40,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     ANIMATION HELPERS
     ============================================================ */

  /**
   * Compute vertical bob offset for walking animation.
   * @param {number} frameCount
   * @param {boolean} moving
   * @returns {number} pixel offset (positive = up)
   */
  getBobOffset(frameCount, moving) {
    return moving ? Math.sin(frameCount * 0.15) * 3 : 0;
  }

  /* ============================================================
     COLOR UTILITIES
     ============================================================ */

  /**
   * Shift an RGB base colour by HSL deltas.
   * Converts base → HSL, adds deltas, converts back → RGB.
   *
   * @param {RGB} base
   * @param {number} hueShift   degrees (-360..360)
   * @param {number} satShift   percentage points (-100..100)
   * @param {number} lightShift percentage points (-100..100)
   * @returns {RGB}
   */
  shiftColor(base, hueShift, satShift, lightShift) {
    const hsl = this.rgbToHsl(base.r, base.g, base.b);
    hsl.h = (hsl.h + hueShift + 360) % 360;
    hsl.s = Math.max(0, Math.min(100, hsl.s + satShift));
    hsl.l = Math.max(0, Math.min(100, hsl.l + lightShift));
    return this.hslToRgb(hsl.h, hsl.s, hsl.l);
  }

  /** Convert H,S,L → hex string for Canvas fillStyle. */
  hslToHex(h, s, l) {
    const rgb = this.hslToRgb(h, s, l);
    return this.rgbToHex(rgb);
  }

  /** RGB → hex. */
  rgbToHex({ r, g, b }) {
    const toHex = n => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /** Lighten an RGB colour by percent. */
  lighten(rgb, pct) {
    const f = 1 + pct / 100;
    return {
      r: Math.min(255, Math.round(rgb.r * f)),
      g: Math.min(255, Math.round(rgb.g * f)),
      b: Math.min(255, Math.round(rgb.b * f))
    };
  }

  /** RGB → HSL conversion. */
  rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
        case g: h = ((b - r) / d + 2); break;
        case b: h = ((r - g) / d + 4); break;
      }
      h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
  }

  /** HSL → RGB conversion. */
  hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    const hh = h / 60;
    if (hh < 1)       { r = c; g = x; }
    else if (hh < 2)  { r = x; g = c; }
    else if (hh < 3)  { g = c; b = x; }
    else if (hh < 4)  { g = x; b = c; }
    else if (hh < 5)  { r = x; b = c; }
    else              { r = c; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  /* ============================================================
     SHAPE HELPERS
     ============================================================ */

  /**
   * Draw a simple heart shape centred at (cx,cy).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} size
   */
  drawHeart(ctx, cx, cy, size) {
    const s = size;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.3);
    ctx.bezierCurveTo(cx, cy, cx - s, cy - s * 0.5, cx - s, cy + s * 0.3);
    ctx.bezierCurveTo(cx - s, cy + s * 0.8, cx, cy + s * 1.2, cx, cy + s * 1.4);
    ctx.bezierCurveTo(cx, cy + s * 1.2, cx + s, cy + s * 0.8, cx + s, cy + s * 0.3);
    ctx.bezierCurveTo(cx + s, cy - s * 0.5, cx, cy, cx, cy + s * 0.3);
    ctx.fill();
  }

  /**
   * Draw a star / polygon.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} outerR
   * @param {number} points
   * @param {number} innerRatio — 0..1
   */
  drawStarPolygon(ctx, cx, cy, outerR, points, innerRatio) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : outerR * innerRatio;
      const a = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  /* ============================================================
     DEBUG / DEV
     ============================================================ */

  /** Draw a wireframe bounding box around the avatar for debugging. */
  drawDebugBox(ctx, cx, cy, scale) {
    if (!this.debug) return;
    ctx.save();
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 20 * scale, cy - 80 * scale, 40 * scale, 80 * scale);
    ctx.restore();
  }

  /* ============================================================
     ANIMATION INTEGRATION
     ============================================================ */

  /**
   * Update the avatar's animation state. Call once per frame.
   * @param {number} dt — Delta time in seconds
   * @param {Object} [state] — Optional state hints
   * @param {boolean} [state.moving=false]
   * @param {boolean} [state.running=false]
   * @param {string} [state.facing='right']
   * @param {string} [state.emote=null]
   */
  updateAnimation(dt, state = {}) {
    const { moving = false, running = false, facing = 'right', emote = null } = state;

    // ── Determine target animation from state ───────────────────
    let targetAnim = 'idle';

    if (emote) {
      // Emote animations take priority
      const emoteMap = {
        wave: 'emote_wave',
        uppercut: 'emote_uppercut',
        fart: 'emote_fart',
        laugh: 'emote_laugh',
        cry: 'emote_cry',
        dance: 'dance',
        sit: 'sit',
        sleep: 'sleep',
      };
      targetAnim = emoteMap[emote] || 'idle';
    } else if (this.animState === 'knocked') {
      targetAnim = 'knocked';
    } else if (moving) {
      targetAnim = running ? 'run' : 'walk';
    } else {
      // Stay in current pose-state if idle
      if (this.animState === 'sit') targetAnim = 'sit_loop';
      else if (this.animState === 'sleep') targetAnim = 'sleep';
      else targetAnim = 'idle';
    }

    // ── Play the target animation ───────────────────────────────
    if (targetAnim !== this.currentAnimId) {
      this.animationEngine.play(this.animEntityId, targetAnim);
      this.currentAnimId = targetAnim;
    }

    // ── Advance animation engine ────────────────────────────────
    this.animationEngine.update(dt);

    // ── Cache current transforms ────────────────────────────────
    this.animTransform = this.animationEngine.getTransform(this.animEntityId);
  }

  /**
   * Set the animation state machine state.
   * @param {string} state — 'idle' | 'walk' | 'run' | 'emote' | 'sit' | 'sleep' | 'knocked' | 'dance'
   */
  setAnimState(state) {
    const prevState = this.animState;
    this.animState = state;

    // State transitions
    if (state === 'knocked' && prevState !== 'knocked') {
      this.animationEngine.play(this.animEntityId, 'knocked', true);
      this.currentAnimId = 'knocked';
    } else if (state === 'sit' && prevState !== 'sit') {
      this.animationEngine.play(this.animEntityId, 'sit', true);
      this.currentAnimId = 'sit';
    } else if (state === 'sleep' && prevState !== 'sleep') {
      this.animationEngine.play(this.animEntityId, 'sleep', true);
      this.currentAnimId = 'sleep';
    } else if (state === 'recover' && prevState === 'knocked') {
      this.animationEngine.play(this.animEntityId, 'recover', true);
      this.currentAnimId = 'recover';
      this.animState = 'idle';
    }
  }

  /**
   * Trigger an emote animation.
   * @param {string} emoteId — 'wave' | 'uppercut' | 'fart' | 'laugh' | 'cry' | 'dance'
   */
  playEmote(emoteId) {
    const emoteMap = {
      wave: 'emote_wave',
      uppercut: 'emote_uppercut',
      fart: 'emote_fart',
      laugh: 'emote_laugh',
      cry: 'emote_cry',
      dance: 'dance',
    };
    const animId = emoteMap[emoteId];
    if (animId) {
      this.animationEngine.play(this.animEntityId, animId, true);
      this.currentAnimId = animId;
      this.animState = 'emote';
    }
  }

  /**
   * Check if the current animation has finished playing.
   * @returns {boolean}
   */
  isAnimFinished() {
    return this.animationEngine.isFinished(this.animEntityId);
  }

  /**
   * Get the current animation-derived Y offset (for renderer positioning).
   * Combines animation squash-stretch Y with any state-specific offset.
   * @returns {number}
   */
  getAnimOffsetY() {
    return this.animTransform.y || 0;
  }

  /**
   * Get the current animation-derived rotation in degrees.
   * @returns {number}
   */
  getAnimRotation() {
    return this.animTransform.rotation || 0;
  }

  /**
   * Play the portal entry animation.
   */
  playEntryAnimation() {
    this.animationEngine.play(this.animEntityId, 'transition_in', true);
    this.currentAnimId = 'transition_in';
  }

  /**
   * Play the portal exit animation.
   */
  playExitAnimation() {
    this.animationEngine.play(this.animEntityId, 'transition_out', true);
    this.currentAnimId = 'transition_out';
  }

  /**
   * Dispose the avatar and clean up animation resources.
   */
  dispose() {
    this.animationEngine.stop(this.animEntityId);
  }
}
