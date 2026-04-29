/**
 * @fileoverview UppercutEjection.js — Physics-based comedic room ejection for Starlight Inn v3.5.
 * A dramatic, high-impact social mechanic: the attacker winds up, delivers a cartoon
 * uppercut, and the victim is launched through the air along a physics-driven arc,
 * tumbles end-over-end, gets absorbed by a swirling portal at the screen edge, then
 * re-enters through a portal at the spawn point after a brief exile.
 *
 * Each phase is carefully timed for maximum visual spectacle:
 *   Phase 1: Wind-up   — 0.3s squash + wind-back anticipation
 *   Phase 2: Impact    — 0.2s stretch + thrust + white flash + "POW!"
 *   Phase 3: Ejection  — 2.0s physics arc + tumbling + camera tracking + portal
 *   Phase 4: Re-entry  — 3.0s void exile, then portal re-entry + dazed state
 *
 * @module UppercutEjection
 * @version 3.5.0
 * @author Starlight Inn Team
 */

/** @typedef {import('./engine/Game.js').Game} Game */

/**
 * @typedef {Object} EjectionRecord
 * @property {string} victimId — Player being ejected.
 * @property {string} attackerName — Name of the attacker (for chat messages).
 * @property {string} victimName — Name of the victim (for chat messages).
 * @property {number} startTime — Timestamp when ejection began.
 * @property {number} phase — Current phase: 1=windup, 2=impact, 3=ejection, 4=reentry.
 */

/**
 * @typedef {Object} EjectionParticle
 * @property {number} x — World X (pixels).
 * @property {number} y — World Y (pixels).
 * @property {number} vx — Horizontal velocity (px/s).
 * @property {number} vy — Vertical velocity (px/s).
 * @property {number} life — Remaining life in seconds.
 * @property {string} color — CSS color string.
 * @property {number} size — Particle size in pixels.
 * @property {boolean} spiral — If true, spirals toward center.
 * @property {number} [angle] — Current spiral angle.
 */

/**
 * @typedef {Object} PortalEffect
 * @property {number} x — World X center (normalized).
 * @property {number} y — World Y center (normalized).
 * @property {number} born — Creation timestamp.
 * @property {number} life — Lifetime in ms.
 * @property {boolean} isEntry — True for re-entry portal, false for exit.
 */

/**
 * Manages the full uppercut ejection sequence with physics simulation,
 * portal effects, camera drama, and social messaging.
 * @export
 */
export class UppercutEjection {
  /**
   * Cost in Gold to perform an uppercut.
   * @type {number}
   * @constant
   */
  static COST_GOLD = 250;

  /**
   * Gravity applied to launched victim (pixels/sec^2).
   * @type {number}
   * @constant
   */
  static GRAVITY = 800;

  /**
   * Horizontal launch speed (pixels/sec).
   * @type {number}
   * @constant
   */
  static LAUNCH_VX = 500;

  /**
   * Vertical launch speed (pixels/sec, negative = up).
   * @type {number}
   * @constant
   */
  static LAUNCH_VY = -700;

  /**
   * Rotational velocity while tumbling (rad/sec).
   * @type {number}
   * @constant
   */
  static ROTATION_SPEED = 15;

  /**
   * Duration of the ejection flight phase (ms).
   * @type {number}
   * @constant
   */
  static EJECTION_DURATION_MS = 2000;

  /**
   * Duration of exile in the void before re-entry (ms).
   * @type {number}
   * @constant
   */
  static EXILE_DURATION_MS = 3000;

  /**
   * Dazed state duration after re-entry (ms).
   * @type {number}
   * @constant
   */
  static DAZED_DURATION_MS = 3000;

  /**
   * Creates an UppercutEjection instance.
   * @param {Game} game — The main Game instance.
   */
  constructor(game) {
    /** @type {Game} */
    this.game = game;

    /** @type {Map<string, EjectionRecord>} — Active ejections keyed by victimId. */
    this.activeEjections = new Map();

    /** @type {EjectionParticle[]} — Active portal/ejection particles. */
    this.particles = [];

    /** @type {PortalEffect[]} — Active portal effects. */
    this.portals = [];

    /** @type {number|null} — Animation frame handle for the physics loop. */
    this._rafHandle = null;
  }

  /* ================================================================ */
  /*  PUBLIC API                                                      */
  /* ================================================================ */

  /**
   * Executes the full uppercut ejection sequence on a target player.
   * Deducts gold from the attacker and plays the complete 4-phase animation:
   * wind-up → impact → ejection → re-entry.
   *
   * @param {string} attackerId — ID of the player delivering the uppercut.
   * @param {string} victimId — ID of the player being ejected.
   * @returns {boolean} True if the uppercut was initiated; false if blocked.
   */
  execute(attackerId, victimId) {
    // Prevent self-uppercut
    if (attackerId === victimId) {
      this.game.ui.toast('You cannot uppercut yourself!', 'warning');
      return false;
    }

    // Resolve both players
    const attacker = this._resolvePlayer(attackerId);
    const victim = this._resolvePlayer(victimId);
    if (!attacker || !victim) {
      this.game.ui.toast('Player not found!', 'error');
      return false;
    }

    // Prevent duplicate ejection
    if (this.activeEjections.has(victimId)) {
      this.game.ui.toast('That player is already being ejected!', 'warning');
      return false;
    }

    // Deduct gold
    if (this.game.currency && !this.game.currency.spendGold(UppercutEjection.COST_GOLD)) {
      this.game.ui.toast(`Not enough Gold! Uppercut costs ${UppercutEjection.COST_GOLD}G.`, 'error');
      return false;
    }

    // Register the active ejection
    /** @type {EjectionRecord} */
    const record = {
      victimId,
      attackerName: attacker.name || 'Someone',
      victimName: victim.name || 'Someone',
      startTime: Date.now(),
      phase: 1
    };
    this.activeEjections.set(victimId, record);

    // Launch the phased sequence
    this._phaseWindUp(attacker, victim, record);

    return true;
  }

  /**
   * Renders all active ejection visuals: portals, particles, trajectories.
   * Call every frame after the world is rendered.
   *
   * @param {CanvasRenderingContext2D} ctx — Canvas 2D context.
   * @param {number} W — Canvas width in pixels.
   * @param {number} H — Canvas height in pixels.
   * @returns {void}
   */
  render(ctx, W, H) {
    const now = Date.now();

    // ── Render portal effects ─────────────────────────────────────
    for (const portal of this.portals) {
      const age = now - portal.born;
      const lifeRatio = age / portal.life;
      if (lifeRatio >= 1) continue;

      const px = portal.x * W;
      const py = portal.y * H;
      const pulse = 0.8 + 0.2 * Math.sin(age / 80);
      const alpha = lifeRatio < 0.2
        ? lifeRatio / 0.2
        : 1 - ((lifeRatio - 0.2) / 0.8);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(px, py);

      // Outer swirl ring (purple)
      const outerR = 40 * pulse;
      ctx.strokeStyle = '#9C27B0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const angle = (i / 60) * Math.PI * 4 + (age / 200);
        const r = outerR * (0.5 + 0.5 * (i / 60));
        const sx = Math.cos(angle) * r;
        const sy = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Inner swirl ring (blue)
      const innerR = 25 * pulse;
      ctx.strokeStyle = '#3F51B5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const angle = -(i / 40) * Math.PI * 3 + (age / 150);
        const r = innerR * (0.5 + 0.5 * (i / 40));
        const sx = Math.cos(angle) * r;
        const sy = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Center glow
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 20 * pulse);
      glow.addColorStop(0, 'rgba(156, 39, 176, 0.6)');
      glow.addColorStop(0.5, 'rgba(63, 81, 181, 0.3)');
      glow.addColorStop(1, 'rgba(156, 39, 176, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 20 * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // ── Render ejection particles ─────────────────────────────────
    for (const p of this.particles) {
      const lifeRatio = 1 - (p.life / 1.5);
      if (lifeRatio >= 1) continue;

      ctx.save();
      ctx.globalAlpha = 1 - lifeRatio;
      ctx.fillStyle = p.color;

      if (p.spiral) {
        // Spiral particles draw as tiny diamonds
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        // Regular particles draw as circles
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── Render active ejection labels ─────────────────────────────
    for (const [, record] of this.activeEjections) {
      const victim = this._resolvePlayer(record.victimId);
      if (victim && victim.visible !== false && record.phase === 3) {
        // Speed lines trailing the flying victim
        const vxScreen = (victim.x || 0.5) * W;
        const vyScreen = (victim.y || 0.5) * H;
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const offset = 15 + i * 12;
          const dir = victim.vx && victim.vx > 0 ? -1 : 1;
          ctx.beginPath();
          ctx.moveTo(vxScreen + offset * dir, vyScreen - 10 + i * 8);
          ctx.lineTo(vxScreen + (offset + 10) * dir, vyScreen - 10 + i * 8);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  /**
   * Updates active ejection state and particles. Call once per frame.
   *
   * @param {number} dt — Delta time in seconds.
   * @returns {void}
   */
  update(dt) {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.spiral) {
        // Spiral particles orbit and shrink toward center
        p.angle = (p.angle || 0) + dt * 8;
        const cx = p.x;
        const cy = p.y;
        p.x = cx + Math.cos(p.angle) * 2;
        p.y = cy + Math.sin(p.angle) * 2;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 20 * dt; // Slight gravity on particles
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Expire old portals
    const now = Date.now();
    this.portals = this.portals.filter(p => (now - p.born) < p.life);
  }

  /**
   * Returns whether a given player is currently being ejected.
   *
   * @param {string} playerId — Player to query.
   * @returns {boolean}
   */
  isBeingEjected(playerId) {
    return this.activeEjections.has(playerId);
  }

  /**
   * Returns the current ejection phase for a player, or 0 if not being ejected.
   *
   * @param {string} playerId — Player to query.
   * @returns {number} Phase 1-4, or 0.
   */
  getEjectionPhase(playerId) {
    const record = this.activeEjections.get(playerId);
    return record ? record.phase : 0;
  }

  /**
   * Gets animation deformation for a player being uppercut.
   * Returns scale/rotation values for the renderer.
   *
   * @param {string} playerId — Player to query.
   * @returns {{scaleX:number, scaleY:number, rotation:number, alpha:number}}
   */
  getAnimState(playerId) {
    const record = this.activeEjections.get(playerId);
    const victim = this._resolvePlayer(playerId);
    if (!record || !victim) {
      return { scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 };
    }

    if (record.phase >= 3 && victim.visible === false) {
      return { scaleX: 1, scaleY: 1, rotation: 0, alpha: 0 };
    }

    // Tumbling rotation during ejection
    if (record.phase === 3 && victim._ejectionRotation !== undefined) {
      return {
        scaleX: 1,
        scaleY: 1,
        rotation: victim._ejectionRotation,
        alpha: 1
      };
    }

    // Dazed: slight wobble
    if (victim.animState === 'dazed') {
      const wobble = Math.sin(Date.now() / 150) * 0.05;
      return { scaleX: 1, scaleY: 1, rotation: wobble, alpha: 1 };
    }

    return { scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 };
  }

  /**
   * Cleans up all active ejections, particles, and portals.
   *
   * @returns {void}
   */
  clear() {
    if (this._rafHandle) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
    this.activeEjections.clear();
    this.particles = [];
    this.portals = [];
  }

  /* ================================================================ */
  /*  PHASE 1: WIND-UP                                                */
  /* ================================================================ */

  /**
   * Phase 1 — Attacker squashes down and winds back for 0.3 seconds.
   * Builds anticipation before the strike.
   *
   * @param {Object} attacker — The attacking player.
   * @param {Object} victim — The target player.
   * @param {EjectionRecord} record — Ejection tracking record.
   * @private
   */
  _phaseWindUp(attacker, victim, record) {
    record.phase = 1;

    // Attacker animation state
    attacker.animState = 'uppercut_windup';
    attacker._uppercutScaleX = 0.8;
    attacker._uppercutScaleY = 1.3;

    // Victim notices something is coming
    victim.animState = 'shocked';

    setTimeout(() => {
      attacker._uppercutScaleX = 1;
      attacker._uppercutScaleY = 1;
      this._phaseImpact(attacker, victim, record);
    }, 300);
  }

  /* ================================================================ */
  /*  PHASE 2: IMPACT                                                 */
  /* ================================================================ */

  /**
   * Phase 2 — Attacker stretches and thrusts forward. White flash frame,
   * "POW!" floating text, golden impact particles. Victim receives
   * launch velocity and begins tumbling.
   *
   * @param {Object} attacker — The attacking player.
   * @param {Object} victim — The target player.
   * @param {EjectionRecord} record — Ejection tracking record.
   * @private
   */
  _phaseImpact(attacker, victim, record) {
    record.phase = 2;

    // Determine direction (hit victim away from attacker)
    const direction = (victim.x || 0.5) >= (attacker.x || 0.5) ? 1 : -1;

    // Attacker stretch animation
    attacker.animState = 'uppercut_strike';
    attacker._uppercutScaleX = 1.4;
    attacker._uppercutScaleY = 0.7;

    // Restore attacker scale after the strike
    setTimeout(() => {
      attacker._uppercutScaleX = 1;
      attacker._uppercutScaleY = 1;
      attacker.animState = 'idle';
    }, 300);

    // Screen shake + white flash
    this.game.camera.shake(15, 0.90);
    if (this.game.screenEffects) {
      this.game.screenEffects.flash('#FFFFFF', 0.12);
      this.game.screenEffects.hitstop(0.06);
    }

    // "POW!" floating text
    if (this.game.screenEffects) {
      this.game.screenEffects.floatingText(
        'POW!', victim.x || 0.5, (victim.y || 0.5) - 0.05, '#FF4444', 1500
      );
    } else if (this.game.ui && this.game.ui.floatingText) {
      this.game.ui.floatingText('POW!', victim.x || 0.5, (victim.y || 0.5) - 0.05, '#FF4444', 1500);
    }

    // Impact star particles
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      this.particles.push({
        x: (victim.x || 0.5) * (this.game.W || 800),
        y: ((victim.y || 0.5) - 0.03) * (this.game.H || 600),
        vx: Math.cos(angle) * speed * (0.5 + Math.random()),
        vy: Math.sin(angle) * speed - 50,
        life: 0.5 + Math.random() * 0.5,
        color: '#FFD700',
        size: 3 + Math.random() * 5,
        spiral: false
      });
    }

    // Velocity shockwave ring
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.particles.push({
        x: (victim.x || 0.5) * (this.game.W || 800),
        y: (victim.y || 0.5) * (this.game.H || 600),
        vx: Math.cos(angle) * 150,
        vy: Math.sin(angle) * 150,
        life: 0.3,
        color: '#FFFFFF',
        size: 2,
        spiral: false
      });
    }

    // Launch victim with physics
    victim.vx = direction * UppercutEjection.LAUNCH_VX;
    victim.vy = UppercutEjection.LAUNCH_VY;
    victim._ejectionRotation = 0;
    victim._ejectionRotVel = direction * UppercutEjection.ROTATION_SPEED;
    victim.animState = 'knocked';

    setTimeout(() => {
      this._phaseEjection(victim, record);
    }, 200);
  }

  /* ================================================================ */
  /*  PHASE 3: EJECTION                                               */
  /* ================================================================ */

  /**
   * Phase 3 — Physics-driven flight for 2 seconds. The victim follows a ballistic
   * arc under gravity while tumbling end-over-end. The camera tracks the victim.
   * A portal appears at the edge and absorbs them.
   *
   * @param {Object} victim — The ejected player.
   * @param {EjectionRecord} record — Ejection tracking record.
   * @private
   */
  _phaseEjection(victim, record) {
    record.phase = 3;

    const W = this.game.W || 800;
    const H = this.game.H || 600;
    const startTime = Date.now();
    const duration = UppercutEjection.EJECTION_DURATION_MS;

    // Convert normalized position to pixels for physics
    let physX = (victim.x || 0.5) * W;
    let physY = (victim.y || 0.5) * H;
    let physVx = victim.vx || 0;
    let physVy = victim.vy || 0;
    let physRot = victim._ejectionRotation || 0;
    let physRotVel = victim._ejectionRotVel || 0;

    const step = () => {
      const elapsed = Date.now() - startTime;
      const dt = 0.016; // Fixed timestep for stable physics

      if (elapsed >= duration) {
        // ── Absorb into portal ────────────────────────────────────
        this._spawnPortal(victim.x || 0.5, victim.y || 0.5, false);
        victim.visible = false;
        victim.vx = 0;
        victim.vy = 0;

        this.game.chat.system(`${record.victimName} was uppercut into the void! ☄️`);
        this._phaseReentry(victim, record);
        return;
      }

      // ── Apply physics ────────────────────────────────────────────
      physVy += UppercutEjection.GRAVITY * dt;
      physX += physVx * dt;
      physY += physVy * dt;
      physRot += physRotVel * dt;
      physRotVel *= 0.98; // Slight rotational damping

      // Clamp to screen bounds (don't let them fly off too far)
      physX = Math.max(-50, Math.min(W + 50, physX));
      physY = Math.max(-100, Math.min(H + 100, physY));

      // Sync back to normalized coordinates
      victim.x = physX / W;
      victim.y = physY / H;
      victim._ejectionRotation = physRot;

      // Camera tracks the flying victim (dramatic!)
      if (this.game.camera) {
        this.game.camera.follow(physX, physY);
      }

      // Spawn trail particles every few frames
      if (elapsed % 80 < 20) {
        this.particles.push({
          x: physX,
          y: physY,
          vx: (Math.random() - 0.5) * 30,
          vy: -20 - Math.random() * 40,
          life: 0.4 + Math.random() * 0.3,
          color: Math.random() > 0.5 ? '#FFD700' : '#FF8C00',
          size: 2 + Math.random() * 3,
          spiral: false
        });
      }

      this._rafHandle = requestAnimationFrame(step);
    };

    step();
  }

  /* ================================================================ */
  /*  PHASE 4: RE-ENTRY                                               */
  /* ================================================================ */

  /**
   * Phase 4 — After 3 seconds of exile, the victim re-enters through a portal
   * at the spawn point. They are in a "dazed" state for 3 seconds before
   * returning to normal.
   *
   * @param {Object} victim — The ejected player.
   * @param {EjectionRecord} record — Ejection tracking record.
   * @private
   */
  _phaseReentry(victim, record) {
    record.phase = 4;

    setTimeout(() => {
      // Restore victim at spawn point
      victim.x = 0.5;
      victim.y = 0.8;
      victim.visible = true;
      victim.animState = 'dazed';
      victim._ejectionRotation = 0;
      delete victim._ejectionRotVel;

      // Spawn entry portal
      this._spawnPortal(victim.x, victim.y, true);

      // Burst of return particles
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        this.particles.push({
          x: victim.x * (this.game.W || 800),
          y: victim.y * (this.game.H || 600),
          vx: Math.cos(angle) * 60,
          vy: Math.sin(angle) * 60 - 30,
          life: 0.6,
          color: i % 2 === 0 ? '#9C27B0' : '#7C4DFF',
          size: 3 + Math.random() * 4,
          spiral: false
        });
      }

      this.game.chat.system(`${record.victimName} returns from the void, dazed... 😵`);

      // Clear dazed state after duration
      setTimeout(() => {
        victim.animState = 'idle';
        this.activeEjections.delete(record.victimId);
      }, UppercutEjection.DAZED_DURATION_MS);

    }, UppercutEjection.EXILE_DURATION_MS);
  }

  /* ================================================================ */
  /*  PORTAL EFFECT                                                   */
  /* ================================================================ */

  /**
   * Spawns a swirling purple/blue portal at the given position.
   *
   * @param {number} x — Normalized X position.
   * @param {number} y — Normalized Y position.
   * @param {boolean} isEntry — True if this is a re-entry portal.
   * @private
   */
  _spawnPortal(x, y, isEntry) {
    /** @type {PortalEffect} */
    const portal = {
      x,
      y,
      born: Date.now(),
      life: 1500,
      isEntry
    };
    this.portals.push(portal);

    // Spiral particles that get sucked into the portal
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const speed = 40 + Math.random() * 30;
      this.particles.push({
        x: x * (this.game.W || 800),
        y: y * (this.game.H || 600),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 1.0,
        color: i % 2 === 0 ? '#9C27B0' : '#3F51B5',
        size: 3 + Math.random() * 3,
        spiral: true,
        angle: angle
      });
    }
  }

  /* ================================================================ */
  /*  INTERNAL HELPERS                                                */
  /* ================================================================ */

  /**
   * Resolves a player object from an ID string.
   *
   * @param {string} playerId — ID to resolve.
   * @returns {Object|null} The player object, or null if not found.
   * @private
   */
  _resolvePlayer(playerId) {
    if (this.game.state.player && this.game.state.player.id === playerId) {
      return this.game.state.player;
    }
    if (this.game.state.onlinePlayers && Array.isArray(this.game.state.onlinePlayers)) {
      return this.game.state.onlinePlayers.find(p => p.id === playerId) || null;
    }
    return null;
  }

  /**
   * Quadratic ease-out for smooth animation transitions.
   *
   * @param {number} t — 0..1
   * @returns {number}
   * @private
   */
  _easeOutQuad(t) {
    return t * (2 - t);
  }
}
