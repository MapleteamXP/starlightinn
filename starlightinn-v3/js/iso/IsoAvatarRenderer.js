/**
 * @file IsoAvatarRenderer.js
 * @description Isometric avatar rendering system.
 * Provides specialized isometric avatar drawing with outfit support,
 * accessories, expressions, and facing-direction handling.
 * Integrates with the existing Avatar system.
 * @module iso/IsoAvatarRenderer
 * @version 5.0.0
 */

/**
 * Isometric avatar renderer. Handles drawing player and NPC avatars
 * in the isometric perspective, with full support for customization
 * expressions, accessories, and animations.
 * @export {IsoAvatarRenderer}
 */
export class IsoAvatarRenderer {
  /**
   * @param {import('../engine/Game.js').Game} game - The game instance.
   * @param {import('./IsoMath.js').IsoMath} isoMath - Isometric math.
   * @param {import('./IsoAssetLoader.js').IsoAssetLoader} assetLoader - Asset loader.
   */
  constructor(game, isoMath, assetLoader) {
    this.game = game;
    this.isoMath = isoMath;
    this.assetLoader = assetLoader;

    /** @type {Map<string, HTMLCanvasElement>} Avatar sprite cache. */
    this._spriteCache = new Map();
    /** @type {number} Animation phase. */
    this.phase = 0;
    /** @type {Map<string, number>} Per-entity animation phases. */
    this.entityPhases = new Map();

    // Color palettes
    this.skinColors = ['#ffe0bd', '#ffcd94', '#eac086', '#d2a56d', '#8d5524'];
    this.hairColors = ['#2d2d2d', '#5c3a21', '#d4a574', '#e8c547', '#a33b3b', '#6b4c9a'];
    this.outfitColors = ['#5b8c85', '#c75b5b', '#5b7fa8', '#a85ba8', '#8c5b5b', '#d4a45b'];
  }

  /**
   * Update animation phases.
   * @param {number} dt - Delta time.
   */
  update(dt) {
    this.phase += dt;
    for (const [id, phase] of this.entityPhases) {
      this.entityPhases.set(id, phase + dt);
    }
  }

  /**
   * Draw an avatar at screen coordinates.
   * @param {CanvasRenderingContext2D} ctx - Rendering context.
   * @param {number} sx - Screen X.
   * @param {number} sy - Screen Y.
   * @param {Object} avatar - Avatar data (skinColor, hairColor, outfitColor, etc.).
   * @param {Object} [options={}] - Drawing options.
   */
  draw(ctx, sx, sy, avatar, options = {}) {
    const size = options.size || 40;
    const moving = avatar.moving || false;
    const facing = avatar.facing || 'down';
    const entityId = avatar.id || avatar.name || 'unknown';

    // Get or init entity phase
    if (!this.entityPhases.has(entityId)) {
      this.entityPhases.set(entityId, Math.random() * Math.PI * 2);
    }
    const entPhase = this.entityPhases.get(entityId);

    // Bobbing when walking
    const bob = moving ? Math.sin(entPhase * 6) * 2.5 : Math.sin(entPhase * 1.5) * 0.5;

    // Shadow
    this._drawShadow(ctx, sx, sy + size * 0.25, size);

    // Body
    this._drawBody(ctx, sx, sy + bob, avatar, size, facing, entPhase, moving);

    // Head
    this._drawHead(ctx, sx, sy + bob, avatar, size, facing);

    // Accessories
    if (avatar.accessories) {
      this._drawAccessories(ctx, sx, sy + bob, avatar, size, facing);
    }
  }

  /**
   * Draw an avatar shadow.
   * @private
   */
  _drawShadow(ctx, sx, sy, size) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx, sy, size * 0.35, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Draw the avatar body (outfit + limbs).
   * @private
   */
  _drawBody(ctx, x, y, avatar, size, facing, phase, moving) {
    const outfit = this.outfitColors[avatar.outfitColor % this.outfitColors.length] || this.outfitColors[0];
    const bodyW = size * 0.28;
    const bodyH = size * 0.45;

    // Animate arms when walking
    const armSwing = moving ? Math.sin(phase * 8) * size * 0.06 : 0;

    // Left arm
    ctx.fillStyle = this._lighten(outfit, 10);
    ctx.save();
    ctx.translate(x - bodyW * 1.1, y + bodyH * 0.1);
    ctx.rotate(-armSwing * 0.5);
    ctx.fillRect(-bodyW * 0.25, 0, bodyW * 0.5, bodyH * 0.7);
    ctx.restore();

    // Right arm
    ctx.fillStyle = this._darken(outfit, 10);
    ctx.save();
    ctx.translate(x + bodyW * 1.1, y + bodyH * 0.1);
    ctx.rotate(armSwing * 0.5);
    ctx.fillRect(-bodyW * 0.25, 0, bodyW * 0.5, bodyH * 0.7);
    ctx.restore();

    // Torso (isometric diamond shape)
    ctx.fillStyle = outfit;
    ctx.beginPath();
    ctx.moveTo(x - bodyW, y);
    ctx.lineTo(x, y - bodyW * 0.3);
    ctx.lineTo(x + bodyW, y);
    ctx.lineTo(x + bodyW * 0.7, y + bodyH);
    ctx.lineTo(x - bodyW * 0.7, y + bodyH);
    ctx.closePath();
    ctx.fill();

    // Torso highlight
    ctx.fillStyle = this._lighten(outfit, 15);
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(x - bodyW, y);
    ctx.lineTo(x, y - bodyW * 0.3);
    ctx.lineTo(x + bodyW * 0.3, y);
    ctx.lineTo(x - bodyW * 0.3, y + bodyH * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Outfit detail lines
    ctx.strokeStyle = this._darken(outfit, 25);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y - bodyW * 0.3);
    ctx.lineTo(x, y + bodyH * 0.7);
    ctx.stroke();
  }

  /**
   * Draw the avatar head with full facial features.
   * @private
   */
  _drawHead(ctx, x, y, avatar, size, facing) {
    const skin = this.skinColors[avatar.skinColor % this.skinColors.length] || this.skinColors[0];
    const hair = this.hairColors[avatar.hairColor % this.hairColors.length] || this.hairColors[0];
    const headR = size * 0.22;
    const headY = y - size * 0.18;

    // Face offset based on facing
    const faceOffset = facing === 'left' ? -size * 0.02 : facing === 'right' ? size * 0.02 : 0;

    // Head base
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(x + faceOffset, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    this._drawHair(ctx, x + faceOffset, headY, hair, headR, facing, avatar);

    // Eyes
    this._drawEyes(ctx, x + faceOffset, headY, size, facing, avatar);

    // Mouth / expression
    this._drawMouth(ctx, x + faceOffset, headY, size, avatar);
  }

  /**
   * Draw hair on the avatar.
   * @private
   */
  _drawHair(ctx, x, y, hairColor, headR, facing, avatar) {
    ctx.fillStyle = hairColor;

    // Top hair
    ctx.beginPath();
    ctx.arc(x, y - headR * 0.2, headR * 1.05, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();

    // Side hair based on facing
    if (facing === 'left' || facing === 'down' || facing === 'up') {
      ctx.beginPath();
      ctx.ellipse(x - headR * 0.6, y, headR * 0.35, headR * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (facing === 'right' || facing === 'down' || facing === 'up') {
      ctx.fillStyle = this._darken(hairColor, 10);
      ctx.beginPath();
      ctx.ellipse(x + headR * 0.6, y, headR * 0.35, headR * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bangs / front hair
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(x, y - headR * 0.3, headR * 0.85, Math.PI * 1.2, Math.PI * 1.8);
    ctx.fill();
  }

  /**
   * Draw eyes with expression support.
   * @private
   */
  _drawEyes(ctx, x, y, size, facing, avatar) {
    const expression = avatar.expression || 'happy';
    const eyeOffset = facing === 'left' ? -2 : facing === 'right' ? 2 : 0;
    const eyeY = y + size * 0.01;
    const eyeSpacing = size * 0.07;

    ctx.fillStyle = '#2d2d2d';

    if (expression === 'sleep') {
      // Closed eyes (lines)
      ctx.strokeStyle = '#2d2d2d';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - eyeSpacing + eyeOffset, eyeY);
      ctx.lineTo(x - eyeSpacing * 0.3 + eyeOffset, eyeY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + eyeSpacing * 0.3 + eyeOffset, eyeY);
      ctx.lineTo(x + eyeSpacing + eyeOffset, eyeY);
      ctx.stroke();
    } else if (expression === 'laugh') {
      // Happy squint
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - eyeSpacing * 0.5 + eyeOffset, eyeY, size * 0.04, 0, Math.PI * 2);
      ctx.arc(x + eyeSpacing * 0.5 + eyeOffset, eyeY, size * 0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2d2d2d';
      ctx.beginPath();
      ctx.arc(x - eyeSpacing * 0.5 + eyeOffset, eyeY, size * 0.022, 0, Math.PI * 2);
      ctx.arc(x + eyeSpacing * 0.5 + eyeOffset, eyeY, size * 0.022, 0, Math.PI * 2);
      ctx.fill();
    } else if (expression === 'cry') {
      ctx.beginPath();
      ctx.arc(x - eyeSpacing * 0.5 + eyeOffset, eyeY, size * 0.032, 0, Math.PI * 2);
      ctx.arc(x + eyeSpacing * 0.5 + eyeOffset, eyeY, size * 0.032, 0, Math.PI * 2);
      ctx.fill();
      // Tears
      ctx.fillStyle = '#60a5fa';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(x - eyeSpacing * 0.5 + eyeOffset, eyeY + size * 0.08, size * 0.02, 0, Math.PI * 2);
      ctx.arc(x + eyeSpacing * 0.5 + eyeOffset, eyeY + size * 0.08, size * 0.02, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // Normal open eyes
      ctx.beginPath();
      ctx.arc(x - eyeSpacing * 0.5 + eyeOffset, eyeY, size * 0.035, 0, Math.PI * 2);
      ctx.arc(x + eyeSpacing * 0.5 + eyeOffset, eyeY, size * 0.035, 0, Math.PI * 2);
      ctx.fill();

      // Eye highlights
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - eyeSpacing * 0.4 + eyeOffset, eyeY - 1, size * 0.015, 0, Math.PI * 2);
      ctx.arc(x + eyeSpacing * 0.6 + eyeOffset, eyeY - 1, size * 0.015, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draw mouth based on expression.
   * @private
   */
  _drawMouth(ctx, x, y, size, avatar) {
    const expression = avatar.expression || 'happy';
    const mouthY = y + size * 0.1;

    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';

    switch (expression) {
      case 'happy':
      case 'laugh':
        ctx.beginPath();
        ctx.arc(x, mouthY, size * 0.05, 0.1, Math.PI - 0.1);
        ctx.stroke();
        break;
      case 'sleep':
        ctx.beginPath();
        ctx.moveTo(x - size * 0.03, mouthY);
        ctx.lineTo(x + size * 0.03, mouthY);
        ctx.stroke();
        break;
      case 'cry':
        ctx.beginPath();
        ctx.moveTo(x - size * 0.04, mouthY - 1);
        ctx.quadraticCurveTo(x, mouthY + 2, x + size * 0.04, mouthY - 1);
        ctx.stroke();
        break;
      case 'surprised':
        ctx.fillStyle = '#5a3020';
        ctx.beginPath();
        ctx.arc(x, mouthY, size * 0.025, 0, Math.PI * 2);
        ctx.fill();
        break;
      default:
        ctx.beginPath();
        ctx.moveTo(x - size * 0.03, mouthY);
        ctx.lineTo(x + size * 0.03, mouthY);
        ctx.stroke();
    }
  }

  /**
   * Draw avatar accessories.
   * @private
   */
  _drawAccessories(ctx, x, y, avatar, size, facing) {
    const acc = avatar.accessories;
    if (!Array.isArray(acc)) return;

    const eyeOffset = facing === 'left' ? -2 : facing === 'right' ? 2 : 0;
    const eyeY = y - size * 0.18 + size * 0.01;

    // Glasses
    if (acc.includes('glasses')) {
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x - size * 0.07 + eyeOffset, eyeY, size * 0.06, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + size * 0.07 + eyeOffset, eyeY, size * 0.06, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + size * 0.01 + eyeOffset, eyeY);
      ctx.lineTo(x - size * 0.01 + eyeOffset, eyeY);
      ctx.stroke();
    }

    // Hat
    if (acc.includes('hat')) {
      ctx.fillStyle = '#5b7fa8';
      const hatY = y - size * 0.45;
      ctx.beginPath();
      ctx.ellipse(x, hatY, size * 0.3, size * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a6e97';
      ctx.fillRect(x - size * 0.15, hatY - size * 0.15, size * 0.3, size * 0.15);
      ctx.beginPath();
      ctx.ellipse(x, hatY - size * 0.15, size * 0.15, size * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bow
    if (acc.includes('bow')) {
      ctx.fillStyle = '#c75b5b';
      const bowY = y - size * 0.4;
      ctx.beginPath();
      ctx.ellipse(x - size * 0.06, bowY, size * 0.06, size * 0.04, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + size * 0.06, bowY, size * 0.06, size * 0.04, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a33b3b';
      ctx.beginPath();
      ctx.arc(x, bowY, size * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Generate a cached avatar sprite for a given appearance.
   * @param {Object} appearance - Avatar appearance data.
   * @param {number} [size=48] - Sprite size.
   * @returns {HTMLCanvasElement}
   */
  generateSprite(appearance, size = 48) {
    const key = `${appearance.skinColor}_${appearance.hairColor}_${appearance.outfitColor}_${appearance.expression}_${(appearance.accessories || []).join(',')}`;

    if (this._spriteCache.has(key)) {
      return this._spriteCache.get(key);
    }

    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    this.draw(ctx, size / 2, size * 0.55, { ...appearance, moving: false, facing: 'down' }, { size });

    this._spriteCache.set(key, c);
    return c;
  }

  /**
   * Clear the sprite cache.
   */
  clearCache() {
    this._spriteCache.clear();
    this.entityPhases.clear();
  }

  /**
   * Lighten a hex color.
   * @private
   */
  _lighten(hex, amount) {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  /**
   * Darken a hex color.
   * @private
   */
  _darken(hex, amount) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }
}
