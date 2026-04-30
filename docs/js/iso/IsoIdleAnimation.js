/**
 * @file IsoIdleAnimation.js
 * @description Isometric idle animation system.
 * Provides natural idle animations including breathing, subtle swaying,
 * occasional blinking, and randomized micro-movements for living avatars
 * standing still in the isometric world.
 * Integrates with IsoAvatarRenderer and the existing Avatar system.
 * @module iso/IsoIdleAnimation
 * @version 5.0.0
 */

/**
 * Idle animation system for isometric avatars.
 * Creates natural-looking idle poses with breathing, blinking,
 * and subtle body movements that vary over time.
 * @export {IsoIdleAnimation}
 */
export class IsoIdleAnimation {
  /**
   * @param {import('../engine/Game.js').Game} game - The game instance.
   * @param {import('./IsoAvatarRenderer.js').IsoAvatarRenderer} avatarRenderer - Avatar renderer.
   */
  constructor(game, avatarRenderer) {
    this.game = game;
    this.avatarRenderer = avatarRenderer;

    /** @type {number} Master animation phase. */
    this.phase = 0;
    /** @type {number} Breathing speed. */
    this.breathSpeed = 1.5;
    /** @type {number} Sway speed. */
    this.swaySpeed = 0.6;
    /** @type {number} Current blink state (0=open, 1=closed). */
    this.blinkState = 0;
    /** @type {number} Time until next blink. */
    this.blinkTimer = 0;
    /** @type {number} Blink duration timer. */
    this.blinkDuration = 0;
    /** @type {number} Micro-movement seed. */
    this.microSeed = Math.random() * 1000;

    // Per-entity animation states
    /** @type {Map<string, Object>} Entity-specific animation states. */
    this.entityStates = new Map();
  }

  /**
   * Update idle animations.
   * @param {number} dt - Delta time in seconds.
   */
  update(dt) {
    this.phase += dt;
    this._updateBlink(dt);
    this._updateEntityStates(dt);
  }

  /**
   * Update blink state machine.
   * @param {number} dt
   * @private
   */
  _updateBlink(dt) {
    this.blinkTimer -= dt;

    if (this.blinkTimer <= 0 && this.blinkState === 0) {
      // Start blink
      this.blinkState = 1;
      this.blinkDuration = 0.08 + Math.random() * 0.05;
    }

    if (this.blinkState === 1) {
      this.blinkDuration -= dt;
      if (this.blinkDuration <= 0) {
        this.blinkState = 0;
        this.blinkTimer = 2 + Math.random() * 4; // Next blink in 2-6 seconds
      }
    }
  }

  /**
   * Update per-entity animation states.
   * @param {number} dt
   * @private
   */
  _updateEntityStates(dt) {
    const entities = [
      { id: 'local', ...this.game.state.player },
      ...this.game.state.onlinePlayers.map((op, i) => ({ id: `online_${i}`, ...op })),
      ...this.game.state.npcs.map((npc, i) => ({ id: `npc_${npc.id || i}`, ...npc }))
    ];

    for (const ent of entities) {
      if (!this.entityStates.has(ent.id)) {
        this.entityStates.set(ent.id, {
          breathPhase: Math.random() * Math.PI * 2,
          swayPhase: Math.random() * Math.PI * 2,
          microPhase: Math.random() * Math.PI * 2,
          headTurnPhase: Math.random() * Math.PI * 2,
          headTurnAmount: 0,
          lastHeadTurn: 0
        });
      }

      const state = this.entityStates.get(ent.id);
      state.breathPhase += dt * this.breathSpeed;
      state.swayPhase += dt * this.swaySpeed;
      state.microPhase += dt * 0.4;

      // Occasional head turn
      state.lastHeadTurn -= dt;
      if (state.lastHeadTurn <= 0) {
        state.lastHeadTurn = 3 + Math.random() * 7;
        state.headTurnAmount = (Math.random() - 0.5) * 0.3;
      }
      state.headTurnPhase += dt * 2;
    }
  }

  /**
   * Get idle animation transforms for an entity.
   * @param {string} entityId - Entity identifier.
   * @returns {{breath:number, sway:number, microX:number, microY:number, headTurn:number, blink:number}}
   */
  getTransforms(entityId = 'local') {
    const state = this.entityStates.get(entityId);
    if (!state) {
      return { breath: 0, sway: 0, microX: 0, microY: 0, headTurn: 0, blink: 0 };
    }

    return {
      breath: Math.sin(state.breathPhase) * 0.8,
      sway: Math.sin(state.swayPhase) * 0.5,
      microX: Math.sin(state.microPhase) * 0.3,
      microY: Math.cos(state.microPhase * 1.3) * 0.2,
      headTurn: state.headTurnAmount * Math.sin(state.headTurnPhase),
      blink: this.blinkState
    };
  }

  /**
   * Draw an idle avatar with natural animation.
   * @param {CanvasRenderingContext2D} ctx - Rendering context.
   * @param {number} sx - Screen X.
   * @param {number} sy - Screen Y.
   * @param {Object} avatar - Avatar data.
   * @param {number} [size=40] - Avatar size.
   * @param {string} [entityId='local'] - Entity ID for per-entity animation.
   */
  draw(ctx, sx, sy, avatar, size = 40, entityId = 'local') {
    const t = this.getTransforms(entityId);
    const skinColors = ['#ffe0bd', '#ffcd94', '#eac086', '#d2a56d', '#8d5524'];
    const hairColors = ['#2d2d2d', '#5c3a21', '#d4a574', '#e8c547', '#a33b3b', '#6b4c9a'];
    const outfitColors = ['#5b8c85', '#c75b5b', '#5b7fa8', '#a85ba8', '#8c5b5b', '#d4a45b'];

    const skin = skinColors[avatar.skinColor % skinColors.length] || skinColors[0];
    const hair = hairColors[avatar.hairColor % hairColors.length] || hairColors[0];
    const outfit = outfitColors[avatar.outfitColor % outfitColors.length] || outfitColors[0];

    const bobY = t.breath * 0.5 + t.microY;
    const swayX = t.sway * 0.3 + t.microX;
    const headTurn = t.headTurn;

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx + swayX * 0.2, sy + size * 0.25, size * 0.35, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const drawX = sx + swayX;
    const drawY = sy + bobY;

    // Body with breathing scale
    const breathScale = 1 + t.breath * 0.005;
    ctx.save();
    ctx.translate(drawX, drawY + size * 0.15);
    ctx.scale(breathScale, 1 / breathScale);

    const bodyW = size * 0.28;
    const bodyH = size * 0.42;
    ctx.fillStyle = outfit;
    ctx.beginPath();
    ctx.moveTo(-bodyW, 0);
    ctx.lineTo(0, -bodyW * 0.3);
    ctx.lineTo(bodyW, 0);
    ctx.lineTo(bodyW * 0.7, bodyH);
    ctx.lineTo(-bodyW * 0.7, bodyH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this._darken(outfit, 25);
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Detail line
    ctx.strokeStyle = this._darken(outfit, 15);
    ctx.beginPath();
    ctx.moveTo(0, -bodyW * 0.3);
    ctx.lineTo(0, bodyH * 0.7);
    ctx.stroke();

    ctx.restore();

    // Head with subtle turn
    const headY = drawY - size * 0.18;
    ctx.save();
    ctx.translate(drawX + headTurn * size * 0.1, headY);
    ctx.rotate(headTurn * 0.15);

    // Head base
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(0, -size * 0.05, size * 0.21, Math.PI * 1.15, Math.PI * 1.85);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-size * 0.12, size * 0.02, size * 0.07, size * 0.12, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this._darken(hair, 10);
    ctx.beginPath();
    ctx.ellipse(size * 0.12, size * 0.02, size * 0.07, size * 0.12, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (with blink)
    if (t.blink === 0) {
      ctx.fillStyle = '#2d2d2d';
      ctx.beginPath();
      ctx.arc(-size * 0.06, size * 0.01, size * 0.035, 0, Math.PI * 2);
      ctx.arc(size * 0.06, size * 0.01, size * 0.035, 0, Math.PI * 2);
      ctx.fill();

      // Highlights
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-size * 0.04, -size * 0.005, size * 0.015, 0, Math.PI * 2);
      ctx.arc(size * 0.08, -size * 0.005, size * 0.015, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Closed eyes (blinking)
      ctx.strokeStyle = '#2d2d2d';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-size * 0.1, size * 0.01);
      ctx.lineTo(-size * 0.02, size * 0.01);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(size * 0.02, size * 0.01);
      ctx.lineTo(size * 0.1, size * 0.01);
      ctx.stroke();
    }

    // Mouth
    const expression = avatar.expression || 'happy';
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    if (expression === 'happy' || expression === 'laugh') {
      ctx.beginPath();
      ctx.arc(0, size * 0.08, size * 0.04, 0.1, Math.PI - 0.1);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-size * 0.03, size * 0.08);
      ctx.lineTo(size * 0.03, size * 0.08);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Reset animation state for an entity.
   * @param {string} entityId
   */
  resetEntity(entityId) {
    this.entityStates.delete(entityId);
  }

  /** Reset all animation states. */
  resetAll() {
    this.entityStates.clear();
    this.phase = 0;
    this.blinkState = 0;
    this.blinkTimer = 2 + Math.random() * 4;
  }

  /** @private */
  _darken(hex, amount) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  /** @private */
  _lighten(hex, amount) {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }
}
