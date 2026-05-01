/** @fileoverview AvatarPreview.js — Real-time character preview for Starlight Inn v8.0
 *  Renders a 3×-scaled Habbo-style avatar with body, face, clothing, and hair.
 *  Supports 4 directions, idle/walk/dance animations, randomization, and PNG export.
 *  @author Starlight Inn UI Team
 *  @version 3.0.0
 */

/**
 * AvatarPreview renders a live pixel-art avatar preview.
 * @class
 */
class AvatarPreview {
  /**
   * @param {Object} game — Game reference (optional, for save integration).
   * @param {string} canvasId — ID of the preview <canvas> element.
   * @param {Object} [options] — Optional config.
   * @param {number} [options.scale=3] — Render scale factor.
   * @param {number} [options.width=96] — Canvas width in px.
   * @param {number} [options.height=144] — Canvas height in px.
   */
  constructor(game, canvasId, options = {}) {
    /** @type {Object|null} */
    this.game = game || null;
    /** @type {HTMLCanvasElement|null} */
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`AvatarPreview: canvas #${canvasId} not found`);
    }
    /** @type {CanvasRenderingContext2D} */
    this.ctx = this.canvas.getContext('2d');

    /** @type {number} */
    this.scale = options.scale || 3;
    /** @type {number} */
    this.baseWidth = options.width || 96;
    /** @type {number} */
    this.baseHeight = options.height || 144;
    this.canvas.width = this.baseWidth;
    this.canvas.height = this.baseHeight;

    // Avatar colors
    /** @type {Object<string,string>} */
    this.colors = {
      skin: options.skinColor || '#FFCC80',
      hair: options.hairColor || '#5D4037',
      shirt: options.shirtColor || '#1976D2',
      pants: options.pantsColor || '#424242',
      shoes: options.shoesColor || '#212121',
      eyes: '#3E2723',
    };

    // Avatar parts
    /** @type {string} */
    this.hairId = options.hairId || 'bob_short';
    /** @type {string} */
    this.expression = 'neutral';
    /** @type {boolean} */
    this.hasGlasses = false;
    /** @type {boolean} */
    this.hasFacialHair = false;

    // Direction & animation
    /** @type {number} 0=S,1=E,2=N,3=W */
    this.direction = 0;
    /** @type {number} Animation frame counter. */
    this.animFrame = 0;
    /** @type {string} Current animation name. */
    this.animName = 'idle';
    /** @type {boolean} */
    this.isAnimating = false;
    /** @type {number|null} */
    this.animTimer = null;

    // Internal offsets for walk bounce
    /** @type {number} */
    this.bounceY = 0;
    /** @type {number} */
    this.armSwing = 0;

    this.render();
  }

  /**
   * Set the active hairstyle and redraw.
   * @param {string} hairId
   */
  setHair(hairId) {
    this.hairId = hairId;
    this.render();
  }

  /**
   * Set a body part color and redraw.
   * @param {string} part — 'skin'|'hair'|'shirt'|'pants'|'shoes'
   * @param {string} color — HEX color string.
   */
  setColor(part, color) {
    if (this.colors[part] !== undefined) {
      this.colors[part] = color;
      this.render();
    }
  }

  /**
   * Set avatar facing direction.
   * @param {number} dir — 0=S,1=E,2=N,3=W
   */
  setDirection(dir) {
    this.direction = ((dir % 4) + 4) % 4;
    this.render();
  }

  /**
   * Rotate to the next direction clockwise.
   */
  nextDirection() {
    this.setDirection(this.direction + 1);
  }

  /**
   * Set facial expression.
   * @param {string} expr — 'neutral'|'happy'|'sad'|'angry'|'surprised'
   */
  setExpression(expr) {
    this.expression = expr;
    this.render();
  }

  /**
   * Toggle glasses.
   * @param {boolean} on
   */
  setGlasses(on) {
    this.hasGlasses = on;
    this.render();
  }

  /**
   * Toggle facial hair.
   * @param {boolean} on
   */
  setFacialHair(on) {
    this.hasFacialHair = on;
    this.render();
  }

  /**
   * Start playing an animation cycle.
   * @param {string} animName — 'idle'|'walk'|'dance'
   */
  playAnimation(animName) {
    this.animName = animName;
    this.isAnimating = true;
    this.animFrame = 0;
    if (this.animTimer) clearInterval(this.animTimer);
    this.animTimer = setInterval(() => {
      this.animFrame = (this.animFrame + 1) % 60;
      this._updateAnimOffsets();
      this.render();
    }, 83); // ~12 FPS
  }

  /** Stop the current animation and reset to idle. */
  stopAnimation() {
    this.isAnimating = false;
    if (this.animTimer) {
      clearInterval(this.animTimer);
      this.animTimer = null;
    }
    this.animFrame = 0;
    this.bounceY = 0;
    this.armSwing = 0;
    this.render();
  }

  /** @private — Compute bounce and arm offsets from animFrame. */
  _updateAnimOffsets() {
    const f = this.animFrame;
    if (this.animName === 'idle') {
      this.bounceY = Math.sin((f / 60) * Math.PI * 2) * 1;
      this.armSwing = 0;
    } else if (this.animName === 'walk') {
      this.bounceY = Math.abs(Math.sin((f / 30) * Math.PI)) * 2;
      this.armSwing = Math.sin((f / 15) * Math.PI) * 3;
    } else if (this.animName === 'dance') {
      this.bounceY = Math.abs(Math.sin((f / 10) * Math.PI)) * 3;
      this.armSwing = Math.sin((f / 8) * Math.PI) * 5;
    }
  }

  /**
   * Randomize all avatar attributes.
   * @param {Array<string>} [hairIds] — Optional pool of hairstyle IDs.
   */
  randomize(hairIds) {
    const pool = hairIds || (typeof HAIR_CATALOG !== 'undefined'
      ? HAIR_CATALOG.map((h) => h.id)
      : ['bob_short', 'pixie', 'mop_top', 'straight_long', 'ponytail_high', 'mohawk']);
    this.hairId = pool[Math.floor(Math.random() * pool.length)];
    this.colors.skin = this._randomSkinColor();
    this.colors.hair = this._randomHairColor();
    this.colors.shirt = this._randomClothingColor();
    this.colors.pants = this._randomClothingColor();
    this.colors.shoes = this._randomClothingColor();
    this.direction = Math.floor(Math.random() * 4);
    this.render();
  }

  /** @private */
  _randomSkinColor() {
    const skins = ['#FFDFC4', '#F0D5BE', '#EECFA1', '#E3B887', '#D4A76A', '#C68E58', '#A67B5B', '#8D5524'];
    return skins[Math.floor(Math.random() * skins.length)];
  }

  /** @private */
  _randomHairColor() {
    const hairs = ['#090806', '#2C222B', '#3B302A', '#4E433F', '#A55728', '#B55239', '#D6C4C2', '#E6CEA8'];
    return hairs[Math.floor(Math.random() * hairs.length)];
  }

  /** @private */
  _randomClothingColor() {
    const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    return `#${hex()}${hex()}${hex()}`.toUpperCase();
  }

  /**
   * Save the avatar configuration.
   * @returns {Object} Serializable avatar data.
   */
  save() {
    return {
      hairId: this.hairId,
      colors: { ...this.colors },
      direction: this.direction,
      expression: this.expression,
      hasGlasses: this.hasGlasses,
      hasFacialHair: this.hasFacialHair,
    };
  }

  /**
   * Load an avatar configuration.
   * @param {Object} data — Data from save().
   */
  load(data) {
    if (data.hairId) this.hairId = data.hairId;
    if (data.colors) this.colors = { ...this.colors, ...data.colors };
    if (data.direction !== undefined) this.direction = data.direction;
    if (data.expression) this.expression = data.expression;
    if (data.hasGlasses !== undefined) this.hasGlasses = data.hasGlasses;
    if (data.hasFacialHair !== undefined) this.hasFacialHair = data.hasFacialHair;
    this.render();
  }

  /**
   * Export the current preview as a PNG data URL.
   * @returns {string} PNG data URL.
   */
  exportPNG() {
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Trigger a browser download of the avatar PNG.
   * @param {string} [filename='starlight-avatar.png']
   */
  downloadPNG(filename = 'starlight-avatar.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = this.exportPNG();
    link.click();
  }

  /** Main render entry. Clears canvas and draws the full avatar. */
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear with transparent background
    ctx.clearRect(0, 0, w, h);

    // Background pattern (subtle grid)
    this._drawBackground(ctx, w, h);

    // Compute centered avatar position
    const cx = w / 2;
    const cy = h / 2 - 8;
    const sc = this.scale;

    ctx.save();
    // Apply animation bounce
    ctx.translate(0, this.bounceY * sc * 0.3);

    // Draw from back to front based on direction
    if (this.direction === 2) {
      // Facing north — back of head visible first
      this._drawHair(ctx, cx, cy, sc);
      this._drawBodyBack(ctx, cx, cy, sc);
      this._drawHeadBack(ctx, cx, cy, sc);
    } else {
      // Facing south/east/west — body then head then hair
      this._drawBody(ctx, cx, cy, sc);
      this._drawHead(ctx, cx, cy, sc);
      this._drawHair(ctx, cx, cy, sc);
      this._drawFaceExtras(ctx, cx, cy, sc);
    }

    ctx.restore();

    // Direction label
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const dirLabels = ['South', 'East', 'North', 'West'];
    ctx.fillText(dirLabels[this.direction], w / 2, h - 4);
  }

  /** @private — Draw subtle background grid. */
  _drawBackground(ctx, w, h) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const grid = 12;
    for (let x = 0; x < w; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  /** @private — Draw the avatar body (torso, arms, legs). */
  _drawBody(ctx, cx, cy, sc) {
    const { skin, shirt, pants, shoes } = this.colors;
    const dir = this.direction;
    const isSide = dir === 1 || dir === 3;

    // Legs
    const legW = isSide ? 3 : 2.5;
    const legH = 14;
    const legY = cy + 16 * sc;

    // Left leg
    this._fillPixel(ctx, cx - 4 * sc, legY, legW * sc, legH * sc, pants);
    this._fillPixel(ctx, cx - 4 * sc, legY + legH * sc, 4 * sc, 3 * sc, shoes);
    // Right leg
    this._fillPixel(ctx, cx + 1 * sc, legY, legW * sc, legH * sc, pants);
    this._fillPixel(ctx, cx + 1 * sc, legY + legH * sc, 4 * sc, 3 * sc, shoes);

    // Torso
    const torsoW = isSide ? 6 : 10;
    const torsoH = 14;
    const torsoY = cy + 4 * sc;
    this._fillPixel(ctx, cx - (torsoW / 2) * sc, torsoY, torsoW * sc, torsoH * sc, shirt);

    // Shirt detail
    if (!isSide) {
      this._fillPixel(ctx, cx - 1 * sc, torsoY + 3 * sc, 2 * sc, 5 * sc, shadeColor(shirt, 15));
    }

    // Arms
    const armW = 2.5;
    const armH = 11;
    const armY = torsoY + 1 * sc;
    const swing = this.armSwing * sc * 0.3;

    if (isSide) {
      const sideX = dir === 1 ? 1 : -1;
      // Front arm visible on side view
      this._fillPixel(ctx, cx + sideX * 3 * sc, armY + swing, armW * sc, armH * sc, skin);
      // Back arm slightly hidden
      this._fillPixel(ctx, cx - sideX * 1 * sc, armY - swing * 0.5, armW * sc, armH * sc, skin);
    } else {
      // Front view
      this._fillPixel(ctx, cx - 7 * sc, armY + swing, armW * sc, armH * sc, skin);
      this._fillPixel(ctx, cx + 4.5 * sc, armY - swing, armW * sc, armH * sc, skin);
      // Sleeve hints
      this._fillPixel(ctx, cx - 7 * sc, armY, armW * sc, 3 * sc, shirt);
      this._fillPixel(ctx, cx + 4.5 * sc, armY, armW * sc, 3 * sc, shirt);
    }
  }

  /** @private — Draw back of body for north-facing. */
  _drawBodyBack(ctx, cx, cy, sc) {
    const { shirt, pants, shoes } = this.colors;
    const legY = cy + 16 * sc;
    const legH = 14;

    this._fillPixel(ctx, cx - 4 * sc, legY, 3 * sc, legH * sc, pants);
    this._fillPixel(ctx, cx + 1 * sc, legY, 3 * sc, legH * sc, pants);
    this._fillPixel(ctx, cx - 4 * sc, legY + legH * sc, 4 * sc, 3 * sc, shoes);
    this._fillPixel(ctx, cx + 1 * sc, legY + legH * sc, 4 * sc, 3 * sc, shoes);

    const torsoW = 10;
    const torsoH = 14;
    const torsoY = cy + 4 * sc;
    this._fillPixel(ctx, cx - (torsoW / 2) * sc, torsoY, torsoW * sc, torsoH * sc, shirt);

    // Back arms
    const armW = 2.5;
    const armH = 11;
    const armY = torsoY + 1 * sc;
    this._fillPixel(ctx, cx - 7 * sc, armY, armW * sc, armH * sc, shirt);
    this._fillPixel(ctx, cx + 4.5 * sc, armY, armW * sc, armH * sc, shirt);
  }

  /** @private — Draw the head (front-facing). */
  _drawHead(ctx, cx, cy, sc) {
    const { skin } = this.colors;
    const dir = this.direction;
    const isSide = dir === 1 || dir === 3;

    const headW = isSide ? 8 : 12;
    const headH = 12;
    const headX = cx - (headW / 2) * sc;
    const headY = cy - 8 * sc;

    // Head base
    this._fillPixel(ctx, headX, headY, headW * sc, headH * sc, skin);
    this._strokePixel(ctx, headX, headY, headW * sc, headH * sc, 'rgba(0,0,0,0.2)');

    // Neck
    this._fillPixel(ctx, cx - 2 * sc, headY + headH * sc, 4 * sc, 3 * sc, skin);

    if (isSide) {
      this._drawFaceSide(ctx, cx, cy, sc, dir);
    } else {
      this._drawFaceFront(ctx, cx, cy, sc);
    }
  }

  /** @private — Draw front-facing face features. */
  _drawFaceFront(ctx, cx, cy, sc) {
    const { eyes } = this.colors;
    const eyeY = cy - 4 * sc;

    // Eyes
    this._fillPixel(ctx, cx - 4 * sc, eyeY, 2 * sc, 2 * sc, eyes);
    this._fillPixel(ctx, cx + 2 * sc, eyeY, 2 * sc, 2 * sc, eyes);

    // Eye shine
    this._fillPixel(ctx, cx - 3 * sc, eyeY, 1 * sc, 1 * sc, '#ffffff');
    this._fillPixel(ctx, cx + 3 * sc, eyeY, 1 * sc, 1 * sc, '#ffffff');

    // Expression variations
    if (this.expression === 'happy') {
      this._fillPixel(ctx, cx - 4 * sc, eyeY - 1 * sc, 2 * sc, 1 * sc, '#ffffff');
      this._fillPixel(ctx, cx + 2 * sc, eyeY - 1 * sc, 2 * sc, 1 * sc, '#ffffff');
      this._drawCurve(ctx, cx - 3 * sc, cy, 6 * sc, 2 * sc, '#3E2723'); // smile
    } else if (this.expression === 'sad') {
      this._fillPixel(ctx, cx - 4 * sc, eyeY + 1 * sc, 2 * sc, 1 * sc, '#ffffff');
      this._fillPixel(ctx, cx + 2 * sc, eyeY + 1 * sc, 2 * sc, 1 * sc, '#ffffff');
      this._drawCurve(ctx, cx - 3 * sc, cy + 2 * sc, 6 * sc, -2 * sc, '#3E2723'); // frown
    } else if (this.expression === 'surprised') {
      this._fillPixel(ctx, cx - 1 * sc, cy + 1 * sc, 2 * sc, 2 * sc, '#3E2723'); // O mouth
    } else if (this.expression === 'angry') {
      this._fillPixel(ctx, cx - 4 * sc, eyeY - 1 * sc, 2 * sc, 1 * sc, '#3E2723');
      this._fillPixel(ctx, cx + 2 * sc, eyeY - 1 * sc, 2 * sc, 1 * sc, '#3E2723');
      this._drawCurve(ctx, cx - 3 * sc, cy + 2 * sc, 6 * sc, -1 * sc, '#3E2723');
    } else {
      // Neutral mouth
      this._fillPixel(ctx, cx - 2 * sc, cy + 1 * sc, 4 * sc, 1 * sc, '#3E2723');
    }

    // Blush for happy
    if (this.expression === 'happy') {
      this._fillPixel(ctx, cx - 6 * sc, cy, 2 * sc, 2 * sc, 'rgba(255,100,100,0.3)');
      this._fillPixel(ctx, cx + 4 * sc, cy, 2 * sc, 2 * sc, 'rgba(255,100,100,0.3)');
    }
  }

  /** @private — Draw side-facing face features. */
  _drawFaceSide(ctx, cx, cy, sc, dir) {
    const side = dir === 1 ? 1 : -1;
    const eyeX = cx + side * 2 * sc;
    const eyeY = cy - 4 * sc;

    // Single visible eye
    this._fillPixel(ctx, eyeX, eyeY, 2 * sc, 2 * sc, this.colors.eyes);
    this._fillPixel(ctx, eyeX + 1 * sc, eyeY, 1 * sc, 1 * sc, '#ffffff');

    // Nose bump
    this._fillPixel(ctx, cx + side * 4 * sc, cy - 1 * sc, 1 * sc, 2 * sc, shadeColor(this.colors.skin, -10));

    // Mouth
    if (this.expression === 'happy') {
      this._fillPixel(ctx, cx + side * 1 * sc, cy + 1 * sc, 2 * sc, 1 * sc, '#3E2723');
    } else if (this.expression === 'sad') {
      this._fillPixel(ctx, cx + side * 1 * sc, cy + 2 * sc, 2 * sc, 1 * sc, '#3E2723');
    } else {
      this._fillPixel(ctx, cx + side * 1 * sc, cy + 1 * sc, 2 * sc, 1 * sc, '#3E2723');
    }
  }

  /** @private — Draw back of head (north-facing). */
  _drawHeadBack(ctx, cx, cy, sc) {
    const { skin } = this.colors;
    const headW = 12;
    const headH = 12;
    const headX = cx - (headW / 2) * sc;
    const headY = cy - 8 * sc;

    this._fillPixel(ctx, headX, headY, headW * sc, headH * sc, skin);
    this._strokePixel(ctx, headX, headY, headW * sc, headH * sc, 'rgba(0,0,0,0.2)');
    this._fillPixel(ctx, cx - 2 * sc, headY + headH * sc, 4 * sc, 3 * sc, skin);
  }

  /** @private — Draw hair using the catalog. */
  _drawHair(ctx, cx, cy, sc) {
    const headTopX = cx / sc;
    const headTopY = (cy - 8 * sc) / sc;
    if (typeof drawHairstyle === 'function') {
      drawHairstyle(ctx, this.hairId, headTopX + 6, headTopY + 3, this.colors.hair, this.direction);
    } else {
      // Fallback simple hair cap if catalog not loaded
      ctx.fillStyle = this.colors.hair;
      ctx.beginPath();
      ctx.arc(cx, cy - 5 * sc, 7 * sc, Math.PI, 0);
      ctx.fill();
    }
  }

  /** @private — Draw face extras (glasses, facial hair). */
  _drawFaceExtras(ctx, cx, cy, sc) {
    const dir = this.direction;
    const isSide = dir === 1 || dir === 3;

    if (this.hasGlasses && !isSide) {
      const gY = cy - 5 * sc;
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1.5 * sc;
      ctx.strokeRect(cx - 5.5 * sc, gY, 4 * sc, 3 * sc);
      ctx.strokeRect(cx + 1.5 * sc, gY, 4 * sc, 3 * sc);
      ctx.beginPath();
      ctx.moveTo(cx - 1.5 * sc, gY + 1.5 * sc);
      ctx.lineTo(cx + 1.5 * sc, gY + 1.5 * sc);
      ctx.stroke();
    }

    if (this.hasFacialHair && !isSide) {
      const fhY = cy + 2 * sc;
      this._fillPixel(ctx, cx - 3 * sc, fhY, 6 * sc, 2 * sc, this.colors.hair);
      this._fillPixel(ctx, cx - 2 * sc, fhY + 2 * sc, 4 * sc, 1 * sc, this.colors.hair);
    }
  }

  /** @private — Draw a simple curved mouth line. */
  _drawCurve(ctx, x, y, w, h, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y + h, x + w, y);
    ctx.stroke();
  }

  /**
   * @private — Fill a scaled pixel block.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string} color
   */
  _fillPixel(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /**
   * @private — Stroke a scaled pixel block.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string} color
   */
  _strokePixel(ctx, x, y, w, h, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 1, Math.round(h) - 1);
  }

  /** Destroy the preview and clean up timers. */
  destroy() {
    this.stopAnimation();
  }
}

// Re-declare shadeColor helper if module scope doesn't have it
if (typeof shadeColor === 'undefined') {
  /**
   * Darken or lighten a HEX color.
   * @param {string} color
   * @param {number} percent
   * @returns {string}
   */
  function shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1).toUpperCase()}`;
  }
}

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AvatarPreview };
}
