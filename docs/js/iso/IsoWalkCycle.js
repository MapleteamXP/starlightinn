/**
 * @file IsoWalkCycle.js
 * @description Isometric walk animation system.
 * Provides smooth walk cycle animation with proper isometric leg/arm
 * movement, body bobbing, and directional support.
 * Integrates with IsoAvatarRenderer and the existing Avatar system.
 * @module iso/IsoWalkCycle
 * @version 5.0.0
 */

/**
 * Walk cycle animation for isometric avatars.
 * Manages the walking animation state including leg swinging,
 * arm movement, body bobbing, and footstep timing.
 * @export {IsoWalkCycle}
 */
export class IsoWalkCycle {
  /**
   * @param {import('../engine/Game.js').Game} game - The game instance.
   * @param {import('./IsoAvatarRenderer.js').IsoAvatarRenderer} avatarRenderer - Avatar renderer.
   */
  constructor(game, avatarRenderer) {
    this.game = game;
    this.avatarRenderer = avatarRenderer;

    /** @type {number} Current animation phase (0..2PI). */
    this.phase = 0;
    /** @type {number} Walk speed multiplier. */
    this.speed = 8;
    /** @type {number} Bob amplitude in pixels. */
    this.bobAmount = 3;
    /** @type {number} Swing amplitude in radians. */
    this.swingAmount = 0.4;
    /** @type {boolean} Whether currently walking. */
    this.isWalking = false;
    /** @type {string} Current facing direction. */
    this.facing = 'down';
    /** @type {number} Footstep counter for audio sync. */
    this.footstepCounter = 0;
    /** @type {number} Last footstep phase. */
    this.lastFootstepPhase = 0;
  }

  /**
   * Start the walk cycle.
   * @param {string} [facing='down'] - Facing direction.
   */
  start(facing = 'down') {
    this.isWalking = true;
    this.facing = facing;
    this.phase = 0;
    this.footstepCounter = 0;
    this.lastFootstepPhase = 0;
  }

  /** Stop the walk cycle. */
  stop() {
    this.isWalking = false;
    this.phase = 0;
  }

  /**
   * Update the walk animation.
   * @param {number} dt - Delta time in seconds.
   * @param {boolean} [moving=false] - Whether the entity is currently moving.
   * @param {string} [facing='down'] - Current facing direction.
   */
  update(dt, moving = false, facing = 'down') {
    this.facing = facing;

    if (moving && !this.isWalking) {
      this.start(facing);
    } else if (!moving && this.isWalking) {
      this.stop();
      return;
    }

    if (!this.isWalking) return;

    this.phase += dt * this.speed;
    if (this.phase > Math.PI * 2) {
      this.phase -= Math.PI * 2;
    }

    // Footstep detection
    const footPhase = Math.sin(this.phase);
    if (this.lastFootstepPhase <= 0 && footPhase > 0) {
      this.footstepCounter++;
      this.onFootstep();
    }
    this.lastFootstepPhase = footPhase;
  }

  /**
   * Get current animation transforms for rendering.
   * @returns {{bob:number, legL:number, legR:number, armL:number, armR:number, bodyTilt:number}}
   */
  getTransforms() {
    if (!this.isWalking) {
      return { bob: 0, legL: 0, legR: 0, armL: 0, armR: 0, bodyTilt: 0 };
    }

    const sin = Math.sin(this.phase);
    const cos = Math.cos(this.phase);

    return {
      bob: Math.abs(sin) * this.bobAmount,
      legL: sin * this.swingAmount,
      legR: -sin * this.swingAmount,
      armL: -sin * this.swingAmount * 0.8,
      armR: sin * this.swingAmount * 0.8,
      bodyTilt: cos * 0.02
    };
  }

  /**
   * Draw a walking avatar with animation applied.
   * @param {CanvasRenderingContext2D} ctx - Rendering context.
   * @param {number} sx - Screen X.
   * @param {number} sy - Screen Y.
   * @param {Object} avatar - Avatar data.
   * @param {number} [size=40] - Avatar size.
   */
  draw(ctx, sx, sy, avatar, size = 40) {
    const t = this.getTransforms();
    const skinColors = ['#ffe0bd', '#ffcd94', '#eac086', '#d2a56d', '#8d5524'];
    const outfitColors = ['#5b8c85', '#c75b5b', '#5b7fa8', '#a85ba8', '#8c5b5b', '#d4a45b'];
    const skin = skinColors[avatar.skinColor % skinColors.length] || skinColors[0];
    const outfit = outfitColors[avatar.outfitColor % outfitColors.length] || outfitColors[0];

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx, sy + size * 0.25, size * 0.35, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const bodyY = sy - t.bob;

    // Legs with swing
    this._drawLeg(ctx, sx - size * 0.1, bodyY + size * 0.2, size, t.legL, skin, true);
    this._drawLeg(ctx, sx + size * 0.1, bodyY + size * 0.2, size, t.legR, skin, false);

    // Body
    ctx.save();
    ctx.translate(sx, bodyY + size * 0.15);
    ctx.rotate(t.bodyTilt);

    const bodyW = size * 0.28;
    const bodyH = size * 0.4;
    ctx.fillStyle = outfit;
    ctx.beginPath();
    ctx.moveTo(-bodyW, 0);
    ctx.lineTo(0, -bodyW * 0.3);
    ctx.lineTo(bodyW, 0);
    ctx.lineTo(bodyW * 0.7, bodyH);
    ctx.lineTo(-bodyW * 0.7, bodyH);
    ctx.closePath();
    ctx.fill();

    // Arms with swing
    this._drawArm(ctx, -bodyW * 1.1, bodyH * 0.1, size, t.armL, outfit, true);
    this._drawArm(ctx, bodyW * 1.1, bodyH * 0.1, size, t.armR, outfit, false);

    ctx.restore();

    // Head (bobs slightly less than body)
    const headY = bodyY - size * 0.15 + t.bob * 0.3;
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(sx, headY, size * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Simple eyes
    ctx.fillStyle = '#2d2d2d';
    ctx.beginPath();
    ctx.arc(sx - size * 0.06, headY, size * 0.03, 0, Math.PI * 2);
    ctx.arc(sx + size * 0.06, headY, size * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw a leg with rotation.
   * @private
   */
  _drawLeg(ctx, x, y, size, angle, skin, isLeft) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = isLeft ? this._darken(skin, 15) : skin;
    ctx.fillRect(-size * 0.04, 0, size * 0.08, size * 0.25);
    // Foot
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(-size * 0.05, size * 0.22, size * 0.1, size * 0.04);
    ctx.restore();
  }

  /**
   * Draw an arm with rotation.
   * @private
   */
  _drawArm(ctx, x, y, size, angle, outfit, isLeft) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = isLeft ? this._lighten(outfit, 10) : this._darken(outfit, 10);
    ctx.fillRect(-size * 0.03, 0, size * 0.06, size * 0.22);
    ctx.restore();
  }

  /**
   * Footstep callback. Override or connect to audio.
   * @protected
   */
  onFootstep() {
    // Connect to footstep audio system
    if (this.game.footstepSystem) {
      this.game.footstepSystem.playStep();
    }
  }

  /**
   * Serialize walk state.
   * @returns {Object}
   */
  serialize() {
    return {
      isWalking: this.isWalking,
      facing: this.facing,
      phase: this.phase
    };
  }

  /**
   * Deserialize walk state.
   * @param {Object} data
   */
  deserialize(data) {
    if (data.isWalking !== undefined) this.isWalking = data.isWalking;
    if (data.facing !== undefined) this.facing = data.facing;
    if (data.phase !== undefined) this.phase = data.phase;
  }

  /** @private */
  _lighten(hex, amount) {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  /** @private */
  _darken(hex, amount) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }
}
