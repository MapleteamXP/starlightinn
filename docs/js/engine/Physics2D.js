/**
 * Physics2D.js — 2D Physics Simulation Engine for Starlight Inn
 *
 * Handles avatar knockouts, projectile trajectories, fart recoil,
 * and environmental collisions using Velocity Verlet integration
 * for stable, energy-conserving simulation.
 *
 * Core systems:
 * - Velocity Verlet integration (stable, reversible)
 * - Floor and wall collision with bounce + friction
 * - Rotational physics from linear friction
 * - Uppercut launch (upward + horizontal arc)
 * - Fart recoil (backward impulse + squash-stretch)
 * - Gravity well system for portals / area transitions
 * - Screen shake integration via game.camera
 *
 * @author Starlight Inn Team
 * @version 3.5.0
 */

/** @typedef {import('./Camera.js').Camera} Camera */
/** @typedef {import('./Game.js').Game} Game */

/**
 * @typedef {Object} PhysicsBody
 * @property {string} id       — Unique entity identifier
 * @property {number} x        — Position X (world units)
 * @property {number} y        — Position Y (world units, positive = down)
 * @property {number} vx       — Velocity X
 * @property {number} vy       — Velocity Y
 * @property {number} ax       — Acceleration X
 * @property {number} ay       — Acceleration Y
 * @property {number} prevX    — Previous position X (for Verlet)
 * @property {number} prevY    — Previous position Y (for Verlet)
 * @property {number} rotation — Rotation in radians
 * @property {number} vr       — Angular velocity (rad/s)
 * @property {number} width    — Collision width
 * @property {number} height   — Collision height
 * @property {number} bounce   — Restitution coefficient (0..1)
 * @property {number} friction — Linear friction per frame (0..1)
 * @property {number} mass     — Mass in kg (affects impulse response)
 * @property {boolean} grounded — Is the body on the ground?
 * @property {boolean} alive    — False = scheduled for removal
 * @property {string} [tag]     — Optional tag for filtering ('player', 'npc', 'projectile')
 * @property {number} [groundY=400] — Floor Y position for this body
 * @property {Function} [onCollision] — Callback on collision
 */

/**
 * @typedef {Object} PhysicsConfig
 * @property {number} gravity     — Downward acceleration (px/s^2)
 * @property {number} airFriction — Air resistance multiplier
 * @property {number} maxVelocity — Velocity cap (px/s)
 * @property {number} floorY      — Default floor Y position
 * @property {boolean} allowSleep — Allow bodies to sleep when settled
 * @property {number} sleepThreshold — Velocity below which body sleeps
 */

/** @type {PhysicsConfig} */
const DEFAULT_CONFIG = {
  gravity: 850,
  airFriction: 0.999,
  maxVelocity: 2500,
  floorY: 400,
  allowSleep: true,
  sleepThreshold: 8,
};

/**
 * 2D Physics engine using Velocity Verlet integration.
 * Optimised for platformer-style gameplay with cartoon physics.
 */
export class Physics2D {
  /**
   * @param {Game} game — The main game instance (for camera shake access)
   * @param {Partial<PhysicsConfig>} [config] — Physics parameter overrides
   */
  constructor(game, config = {}) {
    this.game = game;
    /** @type {PhysicsConfig} */
    this.config = { ...DEFAULT_CONFIG, ...config };

    /** @type {PhysicsBody[]} */
    this.bodies = [];
    /** @type {Map<string, number>} */
    this.bodyIndex = new Map(); // id -> array index

    /** @type {Set<Function>} */
    this.collisionListeners = new Set();
    /** @type {Set<Function>} */
    this.triggerListeners = new Set();

    // Pre-allocate temp vectors to avoid GC
    this._tmp1 = { x: 0, y: 0 };
    this._tmp2 = { x: 0, y: 0 };
  }

  /* ================================================================
     BODY MANAGEMENT
     ================================================================ */

  /**
   * Create and register a new physics body.
   *
   * @param {Object} props
   * @param {string} props.id
   * @param {number} props.x
   * @param {number} props.y
   * @param {number} [props.vx=0]
   * @param {number} [props.vy=0]
   * @param {number} [props.vr=0]
   * @param {number} [props.width=32]
   * @param {number} [props.height=48]
   * @param {number} [props.bounce=0.45]
   * @param {number} [props.friction=0.94]
   * @param {number} [props.mass=1.0]
   * @param {string} [props.tag='']
   * @param {number} [props.groundY]
   * @param {Function} [props.onCollision]
   * @returns {PhysicsBody}
   */
  addBody(props) {
    const cfg = this.config;
    const body = {
      id: props.id,
      x: props.x,
      y: props.y,
      vx: props.vx || 0,
      vy: props.vy || 0,
      ax: 0,
      ay: cfg.gravity,
      prevX: props.x - (props.vx || 0) * 0.016,
      prevY: props.y - (props.vy || 0) * 0.016,
      rotation: 0,
      vr: props.vr || 0,
      width: props.width || 32,
      height: props.height || 48,
      bounce: props.bounce ?? 0.45,
      friction: props.friction ?? 0.94,
      mass: props.mass ?? 1.0,
      grounded: false,
      alive: true,
      tag: props.tag || '',
      groundY: props.groundY ?? cfg.floorY,
      onCollision: props.onCollision || null,
    };

    this.bodies.push(body);
    this.bodyIndex.set(body.id, this.bodies.length - 1);
    return body;
  }

  /**
   * Get a body by its ID.
   * @param {string} id
   * @returns {PhysicsBody|undefined}
   */
  getBody(id) {
    const idx = this.bodyIndex.get(id);
    if (idx !== undefined && this.bodies[idx]?.alive) {
      return this.bodies[idx];
    }
    // Fallback: linear search if index is stale
    return this.bodies.find(b => b.id === id && b.alive);
  }

  /**
   * Apply a force to a body (acceleration-based).
   * @param {string} id
   * @param {number} fx — Force X
   * @param {number} fy — Force Y
   */
  applyForce(id, fx, fy) {
    const body = this.getBody(id);
    if (!body) return;
    body.ax += fx / body.mass;
    body.ay += fy / body.mass;
  }

  /**
   * Apply an instantaneous impulse to a body (velocity change).
   * @param {string} id
   * @param {number} ix — Impulse X
   * @param {number} iy — Impulse Y
   * @param {number} [ir=0] — Rotational impulse
   */
  applyImpulse(id, ix, iy, ir = 0) {
    const body = this.getBody(id);
    if (!body) return;
    body.vx += ix / body.mass;
    body.vy += iy / body.mass;
    body.vr += ir / body.mass;
    body.grounded = false;
  }

  /**
   * Remove a body from the simulation.
   * @param {string} id
   */
  removeBody(id) {
    const body = this.getBody(id);
    if (body) {
      body.alive = false;
      this.bodyIndex.delete(id);
    }
  }

  /** Remove all bodies. */
  clear() {
    this.bodies = [];
    this.bodyIndex.clear();
  }

  /* ================================================================
     MAIN UPDATE — Velocity Verlet Integration
     ================================================================ */

  /**
   * Advance the physics simulation by one timestep.
   * Uses Velocity Verlet for stable, energy-conserving integration.
   *
   * @param {number} dt — Delta time in seconds
   */
  update(dt) {
    // Clamp dt to prevent physics explosions on lag spikes
    const safeDt = Math.min(dt, 0.05);
    const dtSq = safeDt * safeDt;
    const cfg = this.config;

    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      if (!body.alive) continue;

      // ── Velocity Verlet Integration ─────────────────────────────
      // x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt^2
      // Store old acceleration
      const oldAx = body.ax;
      const oldAy = body.ay;

      // Update position
      body.x += body.vx * safeDt + 0.5 * oldAx * dtSq;
      body.y += body.vy * safeDt + 0.5 * oldAy * dtSq;

      // v(t+dt) = v(t) + 0.5*(a(t) + a(t+dt))*dt
      // For constant gravity, a(t+dt) = a(t) = gravity
      body.vx += oldAx * safeDt;
      body.vy += oldAy * safeDt;

      // Apply air friction
      body.vx *= cfg.airFriction;
      body.vy *= cfg.airFriction;

      // Apply linear friction (ground or air resistance)
      body.vx *= body.friction;
      if (!body.grounded) {
        body.vy *= 0.9995; // Tiny air drag on Y
      }

      // Update rotation
      body.rotation += body.vr * safeDt;
      body.vr *= 0.975; // Rotational damping

      // Cap velocity
      const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
      if (speed > cfg.maxVelocity) {
        const scale = cfg.maxVelocity / speed;
        body.vx *= scale;
        body.vy *= scale;
      }

      // Reset accelerations (gravity persists)
      body.ax = 0;
      body.ay = cfg.gravity;

      // ── Floor Collision ─────────────────────────────────────────
      const floorY = body.groundY ?? cfg.floorY;
      if (body.y > floorY - body.height * 0.5) {
        // Hit floor
        body.y = floorY - body.height * 0.5;

        if (Math.abs(body.vy) > cfg.sleepThreshold) {
          // Bounce
          body.vy = -body.vy * body.bounce;

          // Friction causes rotation: angular kick from horizontal velocity
          body.vr += (body.vx * 0.12) / body.mass;

          // Notify listeners
          this._fireCollision(body, 'floor', { x: body.x, y: floorY });

          if (body.onCollision) {
            body.onCollision('floor', body);
          }
        } else {
          // Settle
          body.vy = 0;
          body.grounded = true;
          body.vr *= 0.8; // Dampen rotation when grounded
        }

        // Apply ground friction
        body.vx *= body.friction;

        // Stop micro-bouncing when nearly still
        if (Math.abs(body.vy) < 2 && Math.abs(body.vx) < cfg.sleepThreshold) {
          body.vy = 0;
          body.vx = 0;
          body.vr *= 0.9;
          body.grounded = true;
        }
      } else {
        body.grounded = false;
      }

      // ── Ceiling Collision ───────────────────────────────────────
      if (body.y < -2000) {
        body.y = -2000;
        body.vy = Math.abs(body.vy) * body.bounce;
      }

      // ── Wall Collision ──────────────────────────────────────────
      const halfW = body.width * 0.5;
      if (body.x < -4000) {
        body.x = -4000;
        body.vx = Math.abs(body.vx) * body.bounce;
        body.vr -= body.vy * 0.05;
        this._fireCollision(body, 'wall_left', { x: -4000, y: body.y });
      }
      if (body.x > 4000) {
        body.x = 4000;
        body.vx = -Math.abs(body.vx) * body.bounce;
        body.vr += body.vy * 0.05;
        this._fireCollision(body, 'wall_right', { x: 4000, y: body.y });
      }
    }

    // ── Remove dead bodies ────────────────────────────────────────
    this.bodies = this.bodies.filter(b => b.alive);
    // Rebuild index
    this.bodyIndex.clear();
    for (let i = 0; i < this.bodies.length; i++) {
      this.bodyIndex.set(this.bodies[i].id, i);
    }
  }

  /* ================================================================
     GAME-SPECIFIC ACTIONS
     ================================================================ */

  /**
   * Launch a victim with an uppercut:
   * - Applies upward + diagonal force
     * - Triggers screen shake
   * - Camera briefly follows victim trajectory
   * - Victim spins through the air
   *
   * @param {string} victimId — Body ID of the uppercut recipient
   * @param {number} [direction=1] — 1 = right, -1 = left
   * @param {Object} [options]
   * @param {number} [options.upForce=650] — Vertical launch velocity
   * @param {number} [options.horizForce=380] — Horizontal launch velocity
   * @param {number} [options.spinRate=12] — Angular velocity (rad/s)
   * @param {number} [options.shakeIntensity=8] — Screen shake amount
   * @param {number} [options.recoveryTime=2.0] — Seconds before eject through portal
   */
  launchUppercutVictim(victimId, direction = 1, options = {}) {
    const {
      upForce = 650,
      horizForce = 380,
      spinRate = 12,
      shakeIntensity = 8,
      recoveryTime = 2.0,
    } = options;

    const body = this.getBody(victimId);
    if (!body) {
      console.warn(`Physics2D: uppercut target "${victimId}" not found`);
      return;
    }

    // Break out of any grounded state
    body.grounded = false;
    body.alive = true;

    // Apply launch impulse
    body.vy = -upForce;
    body.vx = direction * horizForce;
    body.vr = direction * spinRate;

    // Screen shake through camera
    if (this.game?.camera) {
      this.game.camera.shake(shakeIntensity, 0.82);
    }

    // Fire event for systems to react (particles, sound, etc.)
    this._fireTrigger('uppercut_launch', {
      victimId,
      direction,
      position: { x: body.x, y: body.y },
      velocity: { x: body.vx, y: body.vy },
    });

    // Schedule portal ejection after recovery time
    if (recoveryTime > 0) {
      setTimeout(() => {
        this._fireTrigger('uppercut_eject', { victimId });
        // Fade out: reduce physics involvement
        const b = this.getBody(victimId);
        if (b) {
          b.vy -= 400; // Extra boost toward portal
          b.friction = 0.99; // Reduce ground friction
        }
      }, recoveryTime * 1000);
    }
  }

  /**
   * Apply fart recoil to an entity:
   * - Slight backward impulse
   * - Squash-then-stretch animation trigger
   * - Propels nearby entities with a radial blast
   *
   * @param {string} entityId — The entity producing the fart
   * @param {number} direction — 1 = facing right, -1 = facing left
   * @param {Object} [options]
   * @param {number} [options.recoilForce=120] — Backward push strength
   * @param {number} [options.blastRadius=100] — Affected radius
   * @param {number} [options.blastForce=200] — Force applied to nearby bodies
   */
  applyFartRecoil(entityId, direction, options = {}) {
    const {
      recoilForce = 120,
      blastRadius = 100,
      blastForce = 200,
    } = options;

    const body = this.getBody(entityId);
    if (!body) return;

    // Recoil: push backward
    body.vx = -direction * recoilForce;
    body.grounded = false;

    // Tiny hop
    body.vy = -60;

    // Trigger animation event
    this._fireTrigger('fart_recoil', {
      entityId,
      direction,
      position: { x: body.x, y: body.y },
    });

    // Blast radius: push nearby entities
    for (const other of this.bodies) {
      if (!other.alive || other.id === entityId) continue;

      const dx = other.x - body.x;
      const dy = other.y - body.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < blastRadius && dist > 0.1) {
        const force = blastForce * (1 - dist / blastRadius);
        const nx = dx / dist;
        const ny = dy / dist;

        other.vx += nx * force * 0.5;
        other.vy += ny * force * 0.3 - force * 0.2; // Slight upward push
        other.grounded = false;
      }
    }

    // Mini screen shake
    if (this.game?.camera) {
      this.game.camera.microShake(3);
    }
  }

  /**
   * Launch a body as a projectile with a given angle and power.
   * Useful for knockback, explosions, or ability effects.
   *
   * @param {string} bodyId
   * @param {number} angle — Launch angle in radians (0 = right, -PI/2 = up)
   * @param {number} power — Launch speed
   * @param {number} [spin=0] — Optional spin rate
   */
  launchProjectile(bodyId, angle, power, spin = 0) {
    const body = this.getBody(bodyId);
    if (!body) return;

    body.grounded = false;
    body.vx = Math.cos(angle) * power;
    body.vy = Math.sin(angle) * power;
    body.vr = spin;
  }

  /**
   * Apply an explosion force at a point, affecting all bodies
   * within the blast radius.
   *
   * @param {number} ex — Explosion centre X
   * @param {number} ey — Explosion centre Y
   * @param {number} radius — Blast radius
   * @param {number} maxForce — Maximum force at centre
   */
  applyExplosion(ex, ey, radius, maxForce) {
    for (const body of this.bodies) {
      if (!body.alive) continue;

      const dx = body.x - ex;
      const dy = body.y - ey;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius && dist > 0.1) {
        const force = maxForce * (1 - dist / radius);
        const nx = dx / dist;
        const ny = dy / dist;

        body.vx += (nx * force) / body.mass;
        body.vy += (ny * force) / body.mass - force * 0.3; // Upward bias
        body.vr += (Math.random() - 0.5) * force * 0.02;
        body.grounded = false;
      }
    }

    // Screen shake proportional to explosion force
    if (this.game?.camera) {
      const shakeAmount = Math.min(maxForce * 0.02, 12);
      this.game.camera.shake(shakeAmount, 0.85);
    }

    this._fireTrigger('explosion', { x: ex, y: ey, radius, maxForce });
  }

  /**
   * Pull a body toward a gravity well (portal attraction).
   *
   * @param {string} bodyId
   * @param {number} wx — Well centre X
   * @param {number} wy — Well centre Y
   * @param {number} strength — Pull acceleration (px/s^2)
   * @param {number} radius — Well radius of influence
   */
  applyGravityWell(bodyId, wx, wy, strength, radius) {
    const body = this.getBody(bodyId);
    if (!body) return;

    const dx = wx - body.x;
    const dy = wy - body.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < radius && dist > 1) {
      const force = strength * (1 - dist / radius);
      const nx = dx / dist;
      const ny = dy / dist;

      body.ax += nx * force;
      body.ay += ny * force;
    }
  }

  /* ================================================================
     QUERY
     ================================================================ */

  /**
   * Check if a body is at rest (sleeping).
   * @param {string} bodyId
   * @returns {boolean}
   */
  isAtRest(bodyId) {
    const body = this.getBody(bodyId);
    if (!body) return false;
    const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
    return body.grounded && speed < this.config.sleepThreshold;
  }

  /**
   * Get the predicted landing position for a body in flight.
   * Uses projectile motion equations.
   *
   * @param {string} bodyId
   * @returns {{x: number, y: number, time: number}|null}
   */
  predictLanding(bodyId) {
    const body = this.getBody(bodyId);
    if (!body || body.grounded) return null;

    const floorY = body.groundY ?? this.config.floorY;
    const dy = floorY - body.height * 0.5 - body.y;

    // Quadratic: 0.5*g*t^2 + vy*t - dy = 0
    const a = 0.5 * this.config.gravity;
    const b = body.vy;
    const c = -dy;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;

    const t = (-b + Math.sqrt(discriminant)) / (2 * a);
    if (t < 0) return null;

    return {
      x: body.x + body.vx * t,
      y: floorY - body.height * 0.5,
      time: t,
    };
  }

  /**
   * Get all bodies with a given tag.
   * @param {string} tag
   * @returns {PhysicsBody[]}
   */
  getByTag(tag) {
    return this.bodies.filter(b => b.alive && b.tag === tag);
  }

  /**
   * Count active (non-sleeping) bodies.
   * @returns {number}
   */
  getActiveCount() {
    let count = 0;
    for (const b of this.bodies) {
      if (b.alive && !b.grounded) count++;
    }
    return count;
  }

  /* ================================================================
     EVENTS
     ================================================================ */

  /**
   * Subscribe to collision events.
   * @param {Function} callback — (body, surfaceType, contactPoint) => void
   * @returns {Function} Unsubscribe
   */
  onCollision(callback) {
    this.collisionListeners.add(callback);
    return () => this.collisionListeners.delete(callback);
  }

  /**
   * Subscribe to physics trigger events (uppercuts, explosions, etc).
   * @param {Function} callback — (eventType, data) => void
   * @returns {Function} Unsubscribe
   */
  onTrigger(callback) {
    this.triggerListeners.add(callback);
    return () => this.triggerListeners.delete(callback);
  }

  /** @private */
  _fireCollision(body, surfaceType, contactPoint) {
    for (const cb of this.collisionListeners) {
      try { cb(body, surfaceType, contactPoint); } catch (e) { /* ignore */ }
    }
  }

  /** @private */
  _fireTrigger(eventType, data) {
    for (const cb of this.triggerListeners) {
      try { cb(eventType, data); } catch (e) { /* ignore */ }
    }
  }

  /* ================================================================
     SERIALIZATION
     ================================================================ */

  /**
   * Serialize all body states for save/load.
   * @returns {Object[]}
   */
  serialize() {
    return this.bodies
      .filter(b => b.alive)
      .map(b => ({
        id: b.id,
        x: b.x, y: b.y,
        vx: b.vx, vy: b.vy,
        rotation: b.rotation,
        vr: b.vr,
        grounded: b.grounded,
        tag: b.tag,
      }));
  }

  /**
   * Restore body states from serialized data.
   * @param {Object[]} data
   */
  deserialize(data) {
    this.clear();
    for (const item of data) {
      this.addBody({
        id: item.id,
        x: item.x, y: item.y,
        vx: item.vx, vy: item.vy,
        vr: item.vr,
        tag: item.tag || '',
      });
      const body = this.getBody(item.id);
      if (body) {
        body.rotation = item.rotation || 0;
        body.grounded = item.grounded || false;
      }
    }
  }

  /* ================================================================
     DEBUG
     ================================================================ */

  /**
   * Draw debug visualization of physics bodies.
   * @param {CanvasRenderingContext2D} ctx
   */
  drawDebug(ctx) {
    for (const body of this.bodies) {
      if (!body.alive) continue;

      ctx.save();

      // Bounding box
      ctx.strokeStyle = body.grounded ? '#00ff88' : '#ff8844';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        body.x - body.width * 0.5,
        body.y - body.height * 0.5,
        body.width,
        body.height
      );

      // Velocity vector
      ctx.strokeStyle = '#4488ff';
      ctx.beginPath();
      ctx.moveTo(body.x, body.y);
      ctx.lineTo(body.x + body.vx * 0.1, body.y + body.vy * 0.1);
      ctx.stroke();

      // Rotation indicator
      const rx = body.x + Math.cos(body.rotation) * 15;
      const ry = body.y + Math.sin(body.rotation) * 15;
      ctx.strokeStyle = '#ff44ff';
      ctx.beginPath();
      ctx.moveTo(body.x, body.y);
      ctx.lineTo(rx, ry);
      ctx.stroke();

      // ID label
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.fillText(body.id, body.x - 10, body.y - body.height * 0.5 - 4);

      ctx.restore();
    }
  }
}
