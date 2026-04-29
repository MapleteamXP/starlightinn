/**
 * @fileoverview PowerUps.js — Social consumable effects system for Starlight Inn v3.0.
 * Provides fun, visual, social power-ups that players can use on themselves or
 * others. All effects are cosmetic — no competitive gameplay advantage.
 * Includes particle bursts, floating text, screen shake, and aura rendering.
 *
 * @module events/PowerUps
 * @version 3.0.0
 * @author Starlight Inn Team
 */

/** @typedef {import('../Game.js').Game} Game */

/**
 * Represents a single active power-up effect on a player.
 * @typedef {Object} ActiveEffect
 * @property {string} type — Effect identifier.
 * @property {number} endTime — Timestamp when the effect expires.
 * @property {string} [target] — Target player ID (for directed effects).
 * @property {number} [lastParticleSpawn] — Last particle emission timestamp.
 */

/**
 * Represents a single floating text particle.
 * @typedef {Object} FloatingText
 * @property {string} text — Text to display.
 * @property {number} x — Screen X position.
 * @property {number} y — Screen Y position.
 * @property {string} color — CSS color string.
 * @property {number} born — Creation timestamp.
 * @property {number} life — Total lifetime in ms.
 * @property {number} vy — Vertical drift velocity.
 */

/**
 * Represents a power-up definition in the catalog.
 * @typedef {Object} PowerUpDef
 * @property {string} id — Unique power-up key.
 * @property {string} name — Human-readable name.
 * @property {string} emoji — Display emoji.
 * @property {number} costGold — Price in Gold currency.
 * @property {number} duration — Effect duration in seconds.
 * @property {string} description — Tooltip / flavor text.
 * @property {boolean} [needsTarget] — Whether a target player is required.
 */

/**
 * Manages social consumable power-ups: purchase, activation, particle effects,
 * and rendering. All power-ups are purely visual and social — no PvP advantage.
 * @export
 */
export class PowerUps {
  /**
   * Catalog of all available social power-ups.
   * @type {Record<string, PowerUpDef>}
   */
  static CATALOG = {
    cocktail: {
      id: 'cocktail',
      name: 'Starlight Cocktail',
      emoji: '🍸',
      costGold: 125,
      duration: 30,
      description: 'Glowing golden aura + confetti particles for 30s',
      needsTarget: false
    },
    flower: {
      id: 'flower',
      name: 'Moon Flower',
      emoji: '🌸',
      costGold: 75,
      duration: 5,
      description: 'Burst of heart particles on a target player',
      needsTarget: true
    },
    kiss: {
      id: 'kiss',
      name: 'Fairy Kiss',
      emoji: '💋',
      costGold: 50,
      duration: 10,
      description: 'Floating heart emoji trail follows the target for 10s',
      needsTarget: true
    },
    uppercut: {
      id: 'uppercut',
      name: 'Comet Uppercut',
      emoji: '👊',
      costGold: 250,
      duration: 3,
      description: 'Comedic cartoon knockout! Target falls over, gets back up.',
      needsTarget: true
    }
  };

  /**
   * Creates a PowerUps instance.
   * @param {Game} game — The main Game instance.
   */
  constructor(game) {
    /** @type {Game} */
    this.game = game;

    /** @type {ActiveEffect[]} — Currently active effects on the local player. */
    this.activeEffects = [];

    /** @type {FloatingText[]} — Active floating text animations. */
    this.floatingTexts = [];

    /** @type {Object[]} — Independent particle bursts not tied to the engine. */
    this.particles = [];

    /** @type {number|null} — Cleanup interval handle. */
    this._cleanupTimer = null;
  }

  /* ================================================================ */
  /*  INITIALIZATION                                                  */
  /* ================================================================ */

  /**
   * Initializes the power-up system and starts the effect cleanup timer.
   * @returns {void}
   */
  init() {
    this._cleanupTimer = setInterval(() => this.cleanup(), 1000);
  }

  /* ================================================================ */
  /*  USAGE                                                           */
  /* ================================================================ */

  /**
   * Attempts to use a power-up. Deducts gold, applies the effect, and logs usage.
   * @param {string} powerUpId — Key from PowerUps.CATALOG.
   * @param {string|null} [targetPlayerId] — Target player for directed effects.
   * @returns {boolean} True if successfully used, false otherwise.
   */
  use(powerUpId, targetPlayerId = null) {
    const powerUp = PowerUps.CATALOG[powerUpId];
    if (!powerUp) {
      this.game.ui.toast('Unknown power-up!', 'error');
      return false;
    }

    // Validate target requirement
    if (powerUp.needsTarget && !targetPlayerId) {
      this.game.ui.toast(`${powerUp.name} needs a target player!`, 'warning');
      return false;
    }

    // Validate affordability
    if (!this.game.currency.spendGold(powerUp.costGold)) {
      this.game.ui.toast('Not enough Gold! 💰', 'error');
      return false;
    }

    // Apply effect based on type
    switch (powerUpId) {
      case 'cocktail':
        this.applyCocktail(powerUp.duration);
        break;
      case 'flower':
        this.applyFlower(targetPlayerId);
        break;
      case 'kiss':
        this.applyKiss(targetPlayerId);
        break;
      case 'uppercut':
        this.applyUppercut(targetPlayerId);
        break;
      default:
        return false;
    }

    // Social log
    const playerName = this.game.state.player?.name || 'Someone';
    this.game.chat.system(
      `${powerUp.emoji} **${playerName}** used *${powerUp.name}*!`
    );

    // Success toast
    this.game.ui.toast(`You used ${powerUp.name}!`, 'success', 2500);

    return true;
  }

  /* ================================================================ */
  /*  EFFECT APPLICATION                                              */
  /* ================================================================ */

  /**
   * Applies the Starlight Cocktail effect: golden glow aura + confetti particles.
   * @param {number} duration — Duration in seconds.
   * @returns {void}
   */
  applyCocktail(duration) {
    const endTime = Date.now() + duration * 1000;
    this.activeEffects.push({
      type: 'cocktail',
      endTime,
      lastParticleSpawn: 0
    });

    // Initial burst of confetti
    this.spawnParticles('confetti', null, 40);

    this.game.ui.toast('✨ Starlight Cocktail active! You are glowing!', 'info', 3000);
  }

  /**
   * Applies the Moon Flower effect: burst of heart particles at target location.
   * @param {string} targetPlayerId — Player to shower with hearts.
   * @returns {void}
   */
  applyFlower(targetPlayerId) {
    const target = this.game.state.onlinePlayers?.find(p => p.id === targetPlayerId);
    if (!target) {
      this.game.ui.toast('Target player not found!', 'error');
      return;
    }

    // Big heart burst
    this.spawnParticles('heart', targetPlayerId, 50);

    // Floating "love" text
    this.spawnFloatingText('💖', target.x || 0.5, (target.y || 0.5) - 0.05, '#ff69b4');

    // Target-side notification
    if (this.game.network) {
      this.game.network.send('powerup_received', {
        type: 'flower',
        from: this.game.state.player.id,
        to: targetPlayerId
      });
    }
  }

  /**
   * Applies the Fairy Kiss effect: floating heart emojis trail behind target.
   * @param {string} targetPlayerId — Player to receive the kiss trail.
   * @returns {void}
   */
  applyKiss(targetPlayerId) {
    const target = this.game.state.onlinePlayers?.find(p => p.id === targetPlayerId);
    if (!target) {
      this.game.ui.toast('Target player not found!', 'error');
      return;
    }

    const endTime = Date.now() + 10000;
    this.activeEffects.push({
      type: 'kiss',
      target: targetPlayerId,
      endTime,
      lastParticleSpawn: 0
    });

    // Immediate floating hearts
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.spawnFloatingText('💋', target.x || 0.5, (target.y || 0.5) - 0.02 * i, '#ff4444');
      }, i * 200);
    }

    // Notify target
    if (this.game.network) {
      this.game.network.send('powerup_received', {
        type: 'kiss',
        from: this.game.state.player.id,
        to: targetPlayerId
      });
    }
  }

  /**
   * Applies the Comet Uppercut effect: comedic cartoon knockout.
   * Target falls backward, screen shakes, "POW!" text appears.
   * @param {string} targetPlayerId — Player to comedically uppercut.
   * @returns {void}
   */
  applyUppercut(targetPlayerId) {
    const target = this.game.state.onlinePlayers?.find(p => p.id === targetPlayerId);
    if (!target) {
      this.game.ui.toast('Target player not found!', 'error');
      return;
    }

    // Set knockdown state on target
    target.knockdown = true;
    target.knockdownTimer = 3000;
    target.knockdownStart = Date.now();

    // Screen shake
    if (this.game.camera) {
      this.game.camera.shake(12, 800);
    }

    // "POW!" floating text
    this.spawnFloatingText('POW!', target.x || 0.5, target.y || 0.5, '#ff4444');
    this.spawnFloatingText('💫', (target.x || 0.5) + 0.03, (target.y || 0.5) - 0.03, '#ffd700');
    this.spawnFloatingText('✦', (target.x || 0.5) - 0.03, (target.y || 0.5) - 0.05, '#ffffff');

    // Star burst particles
    this.spawnParticles('star', targetPlayerId, 20);

    // Comedic "boing" bounce after recovery
    setTimeout(() => {
      if (target.knockdown) {
        target.knockdown = false;
        target.knockdownTimer = 0;
        this.spawnFloatingText('🌟', target.x || 0.5, (target.y || 0.5) - 0.04, '#ffd700');
      }
    }, 3000);

    // Network broadcast
    if (this.game.network) {
      this.game.network.send('powerup_received', {
        type: 'uppercut',
        from: this.game.state.player.id,
        to: targetPlayerId
      });
    }
  }

  /* ================================================================ */
  /*  PARTICLE & TEXT SPAWNING                                        */
  /* ================================================================ */

  /**
   * Spawns a burst of particles of the given type.
   * @param {'confetti'|'heart'|'star'} type — Particle visual type.
   * @param {string|null} targetPlayerId — Optional target for origin point.
   * @param {number} count — Number of particles to spawn.
   * @returns {void}
   */
  spawnParticles(type, targetPlayerId, count) {
    let originX = 0.5;
    let originY = 0.5;

    if (targetPlayerId) {
      const target = this.game.state.onlinePlayers?.find(p => p.id === targetPlayerId);
      if (target) {
        originX = target.x || 0.5;
        originY = target.y || 0.5;
      }
    } else {
      originX = this.game.state.player?.x || 0.5;
      originY = this.game.state.player?.y || 0.5;
    }

    const palettes = {
      confetti: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff9ff3', '#ffffff'],
      heart: ['#ff6b81', '#ff4757', '#ff69b4', '#ffa502', '#ff6348'],
      star: ['#ffd700', '#ffaa00', '#ffffff', '#ffdd44', '#ffbb33']
    };
    const palette = palettes[type] || palettes.confetti;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed * 0.003,
        vy: Math.sin(angle) * speed * 0.003 - 0.002,
        life: 1000 + Math.random() * 1500,
        born: Date.now(),
        color: palette[Math.floor(Math.random() * palette.length)],
        size: 2 + Math.random() * 5,
        type,
        gravity: 0.00005,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2
      });
    }
  }

  /**
   * Spawns floating text at a world-normalized position.
   * @param {string} text — Text / emoji to display.
   * @param {number} x — Normalized X (0..1).
   * @param {number} y — Normalized Y (0..1).
   * @param {string} color — CSS color string.
   * @returns {void}
   */
  spawnFloatingText(text, x, y, color) {
    this.floatingTexts.push({
      text,
      x,
      y,
      color,
      born: Date.now(),
      life: 1800,
      vy: -0.0004
    });
  }

  /* ================================================================ */
  /*  UPDATE LOOP                                                     */
  /* ================================================================ */

  /**
   * Updates active effects, particles, and floating text.
   * Call every frame with the delta time.
   * @param {number} dt — Delta time in milliseconds.
   * @returns {void}
   */
  update(dt) {
    const now = Date.now();

    // Remove expired effects
    this.activeEffects = this.activeEffects.filter(e => e.endTime > now);

    // Update particles
    this.particles = this.particles.filter(p => {
      const age = now - p.born;
      if (age > p.life) return false;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.rotation += p.rotationSpeed * dt * 0.06;
      return true;
    });

    // Update floating texts
    this.floatingTexts = this.floatingTexts.filter(t => {
      const age = now - t.born;
      if (age > t.life) return false;
      t.y += t.vy * dt;
      return true;
    });

    // Emit ongoing cocktail confetti
    for (const effect of this.activeEffects) {
      if (effect.type === 'cocktail' && now - effect.lastParticleSpawn > 400) {
        effect.lastParticleSpawn = now;
        this.spawnParticles('confetti', null, 3);
      }
      if (effect.type === 'kiss' && now - effect.lastParticleSpawn > 600) {
        effect.lastParticleSpawn = now;
        const target = this.game.state.onlinePlayers?.find(p => p.id === effect.target);
        if (target) {
          this.particles.push({
            x: target.x || 0.5,
            y: (target.y || 0.5) - 0.04,
            vx: (Math.random() - 0.5) * 0.001,
            vy: -0.001 - Math.random() * 0.001,
            life: 1200,
            born: now,
            color: '#ff6b81',
            size: 8 + Math.random() * 6,
            type: 'heart',
            gravity: 0,
            rotation: 0,
            rotationSpeed: 0
          });
        }
      }
    }
  }

  /**
   * Removes expired effects and old particles. Called by the cleanup interval.
   * @returns {void}
   */
  cleanup() {
    const now = Date.now();
    this.activeEffects = this.activeEffects.filter(e => e.endTime > now);
    this.particles = this.particles.filter(p => now - p.born < p.life);
    this.floatingTexts = this.floatingTexts.filter(t => now - t.born < t.life);
  }

  /* ================================================================ */
  /*  RENDERING                                                       */
  /* ================================================================ */

  /**
   * Renders all active power-up visual effects onto the canvas.
   * Draws cocktail auras, kiss trails, knockdown states, particles, and floating text.
   * @param {CanvasRenderingContext2D} ctx — Canvas 2D context.
   * @param {number} W — Canvas width.
   * @param {number} H — Canvas height.
   * @returns {void}
   */
  renderEffects(ctx, W, H) {
    const now = Date.now();

    // Draw cocktail golden aura
    const cocktailEffect = this.activeEffects.find(e => e.type === 'cocktail');
    if (cocktailEffect) {
      const px = (this.game.state.player?.x || 0.5) * W;
      const py = (this.game.state.player?.y || 0.5) * H;
      const pulse = 0.6 + 0.4 * Math.sin(now / 300);

      ctx.save();
      const gradient = ctx.createRadialGradient(px, py, 10, px, py, 50 * pulse);
      gradient.addColorStop(0, 'rgba(255, 215, 0, 0.35)');
      gradient.addColorStop(0.5, 'rgba(255, 200, 50, 0.15)');
      gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, 50 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw kiss trail hearts on target
    const kissEffect = this.activeEffects.find(e => e.type === 'kiss');
    if (kissEffect) {
      const target = this.game.state.onlinePlayers?.find(p => p.id === kissEffect.target);
      if (target) {
        const tx = target.x * W;
        const ty = target.y * H;
        ctx.save();
        ctx.font = '18px serif';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 200);
        ctx.fillText('💋', tx, ty - 35);
        ctx.restore();
      }
    }

    // Draw knockdown states for online players
    for (const player of this.game.state.onlinePlayers || []) {
      if (player.knockdown) {
        const px = player.x * W;
        const py = player.y * H;
        const progress = Math.min(1, (now - (player.knockdownStart || now)) / 3000);

        ctx.save();
        ctx.translate(px, py);
        // Rotate backward then spring back up
        const knockAngle = progress < 0.3
          ? -Math.PI / 2 * (progress / 0.3)
          : progress < 0.7
            ? -Math.PI / 2
            : -Math.PI / 2 * (1 - (progress - 0.7) / 0.3);
        ctx.rotate(knockAngle);

        // Dizzy stars circling head
        const starCount = 3;
        for (let s = 0; s < starCount; s++) {
          const starAngle = (now / 150) + (s * Math.PI * 2 / starCount);
          const sx = Math.cos(starAngle) * 25;
          const sy = Math.sin(starAngle) * 10 - 30;
          ctx.fillStyle = '#ffd700';
          ctx.font = '12px serif';
          ctx.fillText('✦', sx, sy);
        }

        ctx.restore();
      }
    }

    // Draw particles
    for (const p of this.particles) {
      const age = now - p.born;
      const lifeRatio = age / p.life;
      const alpha = 1 - lifeRatio;
      const px = p.x * W;
      const py = p.y * H;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(px, py);
      ctx.rotate(p.rotation);

      if (p.type === 'heart') {
        ctx.fillStyle = p.color;
        ctx.font = `${p.size * 1.5}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText('💖', 0, 0);
      } else if (p.type === 'star') {
        ctx.fillStyle = p.color;
        ctx.font = `${p.size * 1.2}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText('⭐', 0, 0);
      } else {
        // confetti square
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }

      ctx.restore();
    }

    // Draw floating text
    for (const t of this.floatingTexts) {
      const age = now - t.born;
      const lifeRatio = age / t.life;
      const alpha = lifeRatio < 0.2 ? lifeRatio / 0.2 : 1 - lifeRatio;
      const scale = 1 + lifeRatio * 0.3;
      const tx = t.x * W;
      const ty = t.y * H;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(tx, ty);
      ctx.scale(scale, scale);
      ctx.fillStyle = t.color;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }

  /* ================================================================ */
  /*  UTILITY                                                         */
  /* ================================================================ */

  /**
   * Checks whether the player can afford a specific power-up.
   * @param {string} powerUpId — Key from PowerUps.CATALOG.
   * @returns {boolean} True if affordable.
   */
  canAfford(powerUpId) {
    const powerUp = PowerUps.CATALOG[powerUpId];
    if (!powerUp) return false;
    return this.game.currency.canAffordGold(powerUp.costGold);
  }

  /**
   * Returns the catalog entry for a power-up.
   * @param {string} powerUpId — Key from PowerUps.CATALOG.
   * @returns {PowerUpDef|undefined} The definition or undefined.
   */
  getPowerUp(powerUpId) {
    return PowerUps.CATALOG[powerUpId];
  }

  /**
   * Returns an array of all affordable power-up IDs.
   * @returns {string[]} Array of affordable power-up keys.
   */
  getAffordablePowerUps() {
    return Object.keys(PowerUps.CATALOG).filter(id => this.canAfford(id));
  }

  /**
   * Destroys timers and clears all effects.
   * @returns {void}
   */
  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    this.activeEffects = [];
    this.particles = [];
    this.floatingTexts = [];
  }
}
