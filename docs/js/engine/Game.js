/**
 * @file Game.js
 * @description Main game controller. Manages the game loop, state, and module coordination.
 * Provides lifecycle hooks for all subsystems and handles save/load via localStorage.
 */

/**
 * Main game controller. Manages the game loop, state, and module coordination.
 * @export {Game}
 */
export class Game {
  /**
   * Create a new Game instance.
   * @param {string} canvasId - The id of the target HTML canvas element.
   */
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.W = 960;
    this.H = 540;
    this.lastTime = 0;
    this.frameCount = 0;
    this.accumTime = 0;
    this.fps = 60;
    this.running = false;
    this.paused = false;
    this.debug = false;

    /** @type {Set<string>} Active debug flags. */
    this.debugFlags = new Set();

    /**
     * Canonical game state. All modules read and write through this object.
     * @type {Object}
     */
    this.state = {
      screen: 'landing', // landing | charselect | game | minigame | settings
      area: 'hub',
      player: {
        x: 480, y: 360,
        name: '',
        charId: 'human',
        skinColor: 0,
        hairColor: 0,
        outfitColor: 0,
        accessories: [],
        expression: 'happy',
        moving: false,
        facing: 'down',
        speed: 180,
        targetX: 480,
        targetY: 360,
        gestureTimer: 0,
        gestureId: 0
      },
      onlinePlayers: [],
      npcs: [],
      particles: [],
      chatMessages: [],
      inventory: [],
      silver: 500,
      gold: 100,
      settings: {
        sound: true,
        music: true,
        quality: 'high',
        touchMode: false,
        showNames: true,
        showChat: true,
        cameraSmooth: true
      },
      ui: {
        showChatPanel: false,
        showInventory: false,
        showMap: false,
        toastQueue: []
      }
    };

    /** @type {number} Accumulated time for fixed-step logic. */
    this.fixedAccumulator = 0;
    /** @type {number} Fixed timestep in seconds. */
    this.fixedDt = 1 / 60;

    // Injected modules (wired by main.js via init())
    /** @type {import('./Renderer.js').Renderer|null} */
    this.renderer = null;
    /** @type {import('./Camera.js').Camera|null} */
    this.camera = null;
    /** @type {import('./Input.js').Input|null} */
    this.input = null;
    /** @type {import('./Audio.js').Audio|null} */
    this.audio = null;
    /** @type {Object|null} */
    this.areaManager = null;
    /** @type {Object|null} */
    this.avatar = null;
    /** @type {Object|null} */
    this.chat = null;
    /** @type {Object|null} */
    this.ui = null;
    /** @type {import('./Assets.js').Assets|null} */
    this.assets = null;

    /** @type {WeakMap<Object, number>} Entity last-update timestamps for culling. */
    this._lastUpdate = new WeakMap();

    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
  }

  /**
   * Wire all subsystem references, bind events, resize the canvas, and prepare the loop.
   * Must be called once before start().
   * @param {Object} modules - Object containing { renderer, camera, input, audio, areaManager, avatar, chat, ui, assets }
   * @returns {Game}
   */
  init(modules) {
    if (!this.canvas) {
      throw new Error('Game canvas element not found.');
    }

    // Wire modules
    Object.assign(this, modules);

    this.resize();
    window.addEventListener('resize', this.resize);

    // Load saved state
    this.load();

    // Log init
    console.log('[Game] Engine initialized. Canvas:', this.W, 'x', this.H);
    return this;
  }

  /**
   * Begin the game loop.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
    console.log('[Game] Loop started.');
  }

  /**
   * Halt the game loop. Does not destroy listeners.
   */
  stop() {
    this.running = false;
    console.log('[Game] Loop stopped.');
  }

  /**
   * Toggle pause. When paused, update() is skipped but render() still fires.
   */
  togglePause() {
    this.paused = !this.paused;
  }

  /**
   * The core frame loop. Handles timing, delta-time capping, FPS counting,
   * and delegates to update() and render().
   * @param {number} timestamp - DOMHighResTimeStamp from requestAnimationFrame.
   */
  loop(timestamp) {
    if (!this.running) return;

    const rawDt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Cap dt to prevent spiral-of-death on lag spikes or tab-restore.
    const dt = Math.min(rawDt, 0.05);
    this.accumTime += dt;
    this.frameCount++;

    // FPS recalculation every second
    if (this.accumTime >= 1.0) {
      this.fps = Math.round(this.frameCount / this.accumTime);
      this.frameCount = 0;
      this.accumTime = 0;
    }

    if (!this.paused) {
      this.fixedAccumulator += dt;
      while (this.fixedAccumulator >= this.fixedDt) {
        this.fixedUpdate(this.fixedDt);
        this.fixedAccumulator -= this.fixedDt;
      }
      this.update(dt);
    }

    this.render();

    requestAnimationFrame(this.loop);
  }

  /**
   * Fixed-timestep update for deterministic physics/movement.
   * @param {number} dt - Fixed delta time in seconds.
   */
  fixedUpdate(dt) {
    const p = this.state.player;
    if (p.gestureTimer > 0) {
      p.gestureTimer -= dt;
      if (p.gestureTimer <= 0) {
        p.gestureId = 0;
        p.gestureTimer = 0;
      }
    }
  }

  /**
   * Variable-timestep update. Delegates to input, camera, entities, particles, and audio.
   * @param {number} dt - Delta time in seconds (capped at 50ms).
   */
  update(dt) {
    // Input -> movement
    if (this.input && this.state.screen === 'game') {
      const move = this.input.getMovementVector();
      const p = this.state.player;

      if (move.x !== 0 || move.y !== 0) {
        p.moving = true;
        if (Math.abs(move.x) > Math.abs(move.y)) {
          p.facing = move.x > 0 ? 'right' : 'left';
        } else {
          p.facing = move.y > 0 ? 'down' : 'up';
        }

        const speed = p.speed * dt;
        p.x += move.x * speed;
        p.y += move.y * speed;
      } else {
        p.moving = false;
      }

      // Gesture keys (1-6)
      const gesture = this.input.isGestureKeyPressed();
      if (gesture > 0) {
        this.triggerGesture(gesture);
      }
    }

    // Camera follow player
    if (this.camera && this.state.screen === 'game') {
      this.camera.follow(this.state.player.x, this.state.player.y);
      this.camera.update(dt);
    }

    // Area logic
    if (this.areaManager && this.areaManager.update) {
      this.areaManager.update(dt);
    }

    // NPC updates
    for (const npc of this.state.npcs) {
      if (npc.update) npc.update(dt, this);
    }

    // Online player interpolation / updates
    for (const op of this.state.onlinePlayers) {
      if (op.update) op.update(dt, this);
    }

    // Particle lifecycle
    this.updateParticles(dt);

    // UI toast timers
    this.updateToasts(dt);

    // Audio ambience based on area
    if (this.audio && this.audio.playAmbient && this.state.screen === 'game') {
      // Ambient handled inside audio module; no need to call every frame.
    }
  }

  /**
   * Update all particles: position, life, and removal.
   * @param {number} dt
   */
  updateParticles(dt) {
    const arr = this.state.particles;
    for (let i = arr.length - 1; i >= 0; i--) {
      const pt = arr[i];
      pt.x += (pt.vx || 0) * dt;
      pt.y += (pt.vy || 0) * dt;
      pt.life -= dt;
      if (pt.life <= 0) {
        arr.splice(i, 1);
      }
    }
  }

  /**
   * Decay toast message timers.
   * @param {number} dt
   */
  updateToasts(dt) {
    const toasts = this.state.ui.toastQueue;
    for (let i = toasts.length - 1; i >= 0; i--) {
      toasts[i].ttl -= dt;
      if (toasts[i].ttl <= 0) {
        toasts.splice(i, 1);
      }
    }
  }

  /**
   * Fire a player gesture by id.
   * @param {number} gestureId - 1=wave, 2=dance, 3=sit, 4=sleep, 5=laugh, 6=cry
   */
  triggerGesture(gestureId) {
    const p = this.state.player;
    if (p.gestureTimer > 0) return; // debounce
    p.gestureId = gestureId;
    p.gestureTimer = 2.0; // 2 seconds
    if (this.audio) {
      const sfxMap = { 1: 'wave', 2: 'dance', 3: 'sit', 4: 'sleep', 5: 'laugh', 6: 'cry' };
      this.audio.playSFX(sfxMap[gestureId] || 'click');
    }
    console.log('[Game] Gesture:', gestureId);
  }

  /**
   * Render one frame. Delegates to the Renderer and draws debug overlays if enabled.
   */
  render() {
    if (!this.renderer) return;

    this.renderer.clear();

    switch (this.state.screen) {
      case 'landing':
        this.renderer.renderLanding();
        break;
      case 'charselect':
        this.renderer.renderCharSelect();
        break;
      case 'game':
        this.renderer.renderGame();
        break;
      case 'minigame':
        this.renderer.renderMinigame();
        break;
      case 'settings':
        this.renderer.renderSettings();
        break;
      default:
        this.renderer.renderLanding();
    }

    // Debug overlay
    if (this.debug) {
      this.renderDebugOverlay();
    }
  }

  /**
   * Draw debug metrics on top of the frame.
   */
  renderDebugOverlay() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(4, 4, 160, 90);
    ctx.fillStyle = '#7fff7f';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let y = 8;
    ctx.fillText(`FPS: ${this.fps}`, 8, y); y += 14;
    ctx.fillText(`Particles: ${this.state.particles.length}`, 8, y); y += 14;
    ctx.fillText(`Online: ${this.state.onlinePlayers.length}`, 8, y); y += 14;
    ctx.fillText(`NPCs: ${this.state.npcs.length}`, 8, y); y += 14;
    ctx.fillText(`Area: ${this.state.area}`, 8, y); y += 14;
    ctx.fillText(`Screen: ${this.state.screen}`, 8, y); y += 14;
    if (this.camera) {
      ctx.fillText(`Cam: ${this.camera.x.toFixed(1)},${this.camera.y.toFixed(1)} z=${this.camera.zoom.toFixed(2)}`, 8, y);
    }
    ctx.restore();
  }

  /**
   * Adjust internal canvas resolution and CSS display size responsively.
   */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = this.canvas.clientWidth || this.W;
    const cssH = this.canvas.clientHeight || this.H;

    // Maintain 16:9 aspect ratio letterboxing
    let targetW = cssW;
    let targetH = cssW * (this.H / this.W);
    if (targetH > cssH) {
      targetH = cssH;
      targetW = cssH * (this.W / this.H);
    }

    // Set internal resolution
    this.canvas.width = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Store CSS display size for input mapping
    this._cssW = targetW;
    this._cssH = targetH;
  }

  /**
   * Change the active game screen.
   * @param {string} screen - One of landing|charselect|game|minigame|settings
   */
  setScreen(screen) {
    const old = this.state.screen;
    this.state.screen = screen;
    console.log(`[Game] Screen: ${old} -> ${screen}`);
  }

  /**
   * Change the active world area.
   * @param {string} areaId - Area identifier.
   */
  setArea(areaId) {
    this.state.area = areaId;
    if (this.areaManager && this.areaManager.loadArea) {
      this.areaManager.loadArea(areaId);
    }
    if (this.audio && this.audio.playAmbient) {
      this.audio.playAmbient(areaId);
    }
    this.addToast(`Entered ${areaId}`);
  }

  /**
   * Persist the full game state to localStorage.
   */
  save() {
    try {
      const payload = JSON.stringify(this.state);
      localStorage.setItem('starlight_save_v3', payload);
      console.log('[Game] Saved.');
    } catch (e) {
      console.warn('[Game] Save failed:', e.message);
    }
  }

  /**
   * Restore game state from localStorage. Non-destructive merge.
   */
  load() {
    try {
      const raw = localStorage.getItem('starlight_save_v3');
      if (!raw) return;
      const saved = JSON.parse(raw);
      // Shallow-merge top-level keys
      Object.keys(saved).forEach(key => {
        if (key in this.state && typeof this.state[key] === 'object' && this.state[key] !== null) {
          Object.assign(this.state[key], saved[key]);
        } else {
          this.state[key] = saved[key];
        }
      });
      console.log('[Game] Loaded save.');
    } catch (e) {
      console.warn('[Game] Load failed:', e.message);
    }
  }

  /**
   * Spawn a transient toast message.
   * @param {string} message
   * @param {number} [duration=3] - Seconds to display.
   */
  addToast(message, duration = 3) {
    this.state.ui.toastQueue.unshift({ text: message, ttl: duration, maxTtl: duration });
    if (this.state.ui.toastQueue.length > 5) {
      this.state.ui.toastQueue.pop();
    }
  }

  /**
   * Add a chat message to the log.
   * @param {string} sender
   * @param {string} text
   * @param {string} [type='chat']
   */
  addChat(sender, text, type = 'chat') {
    const msg = { sender, text, type, time: Date.now() };
    this.state.chatMessages.push(msg);
    if (this.state.chatMessages.length > 200) {
      this.state.chatMessages.shift();
    }
    if (this.audio) this.audio.playSFX('chat');
  }

  /**
   * Spawn a particle effect at world coordinates.
   * @param {number} x - World X.
   * @param {number} y - World Y.
   * @param {string} type - particle archetype: sparkle, heart, note, star, dust.
   * @param {number} [count=8]
   */
  spawnParticles(x, y, type, count = 8) {
    const palette = {
      sparkle: ['#fff8e7', '#ffd700', '#ffeb3b'],
      heart: ['#ff7eb3', '#ff4d6d', '#ffb3c6'],
      note: ['#a78bfa', '#c4b5fd', '#e9d5ff'],
      star: ['#fff8e7', '#fde68a', '#fcd34d'],
      dust: ['#d1d5db', '#9ca3af', '#6b7280']
    };
    const colors = palette[type] || palette.dust;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 60;
      this.state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.5 + Math.random() * 1.5,
        maxLife: 2,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        type
      });
    }
  }

  /**
   * Enable or disable debug overlay.
   * @param {boolean} [enabled=true]
   */
  setDebug(enabled = true) {
    this.debug = enabled;
  }

  /**
   * Clean shutdown. Remove listeners, stop loop, save state.
   */
  destroy() {
    this.stop();
    this.save();
    window.removeEventListener('resize', this.resize);
    if (this.input) this.input.destroy();
    if (this.audio && this.audio.ctx) this.audio.ctx.close();
    console.log('[Game] Destroyed.');
  }
}
