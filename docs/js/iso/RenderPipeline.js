/**
 * @file RenderPipeline.js
 * @description Rendering pipeline orchestrator for Starlight Inn v6.0.
 * Coordinates YSortRenderer, PixelPerfectScaler, IsoCamera, world tilemap,
 * sprite cache, and UI overlays into a single frame loop.
 *
 * Pipeline order per frame:
 *   1. Clear canvas
 *   2. Render background (sky/walls from IsoAreaBackgrounds)
 *   3. Render floor tiles (Y-sorted)
 *   4. Render wall tiles (Y-sorted)
 *   5. Render furniture/props (Y-sorted)
 *   6. Render entities/players (Y-sorted)
 *   7. Render effects/particles (Y-sorted)
 *   8. Render UI overlay (chat bubbles, nameplates)
 *   9. Render debug overlay (grid, stats)
 *
 * @module iso/RenderPipeline
 * @version 6.0.0
 */

import YSortRenderer from "./YSortRenderer.js";
import PixelPerfectScaler from "./PixelPerfectScaler.js";
import { Z_LAYER } from "./IsoDepthSorter.js";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default canvas width in backing pixels */
const DEFAULT_WIDTH = 1024;

/** Default canvas height in backing pixels */
const DEFAULT_HEIGHT = 768;

/** FPS smoothing factor (0-1, lower = smoother) */
const FPS_SMOOTHING = 0.9;

/** Maximum delta time in ms to prevent spiral-of-death */
const MAX_DELTA_TIME = 50;

/** Debug overlay toggle key code (F3) */
const DEBUG_KEY_CODE = 114;

/** UI overlay z-layer offset */
const UI_LAYER = Z_LAYER.UI_OVERLAY;

// =============================================================================
// RENDER PIPELINE CLASS
// =============================================================================

/**
 * Orchestrates the full isometric rendering pipeline.
 *
 * Holds references to all rendering subsystems and coordinates them
 * into a single per-frame render pass.  The pipeline handles:
 *   - Canvas setup and pixel-perfect scaling
 *   - Camera integration
 *   - World / tilemap rendering via Y-sort
 *   - Sprite cache binding
 *   - FPS and draw-count telemetry
 *   - Debug overlay
 */
export default class RenderPipeline {
  /**
   * Create a new RenderPipeline.
   *
   * @param {Object} game - Game instance reference
   */
  constructor(game) {
    /** @type {Object} Game instance */
    this._game = game;

    /** @type {YSortRenderer|null} Isometric Y-sort renderer */
    this._renderer = null;

    /** @type {PixelPerfectScaler|null} Pixel-perfect scaling wrapper */
    this._scaler = null;

    /** @type {import("./IsoCamera.js").default|null} Isometric camera */
    this._camera = null;

    /** @type {Object|null} Tilemap / world data provider */
    this._tilemap = null;

    /** @type {Object|null} Sprite cache (IsoAssetLoader-compatible) */
    this._spriteCache = null;

    /** @type {Object|null} Area backgrounds provider */
    this._areaBackgrounds = null;

    /** @type {HTMLCanvasElement|null} Primary canvas */
    this._canvas = null;

    /** @type {CanvasRenderingContext2D|null} Primary 2D context */
    this._ctx = null;

    /** @type {number} Current frame index */
    this._frameCount = 0;

    /** @type {number} Last frame timestamp */
    this._lastTime = 0;

    /** @type {number} Smoothed FPS estimate */
    this._fps = 60;

    /** @type {number} Accumulated raw frame time */
    this._rawFpsAccum = 0;

    /** @type {number} Raw frame counter */
    this._rawFpsFrames = 0;

    /** @type {number} Sprites drawn last frame */
    this._lastDrawCount = 0;

    /** @type {boolean} Whether debug overlay is visible */
    this._debugVisible = false;

    /** @type {boolean} Whether UI overlay is visible */
    this._uiVisible = true;

    /** @type {boolean} Whether the pipeline is paused */
    this._paused = false;

    /** @type {Array<Function>} Pre-render hooks */
    this._preRenderHooks = [];

    /** @type {Array<Function>} Post-render hooks */
    this._postRenderHooks = [];

    /** @type {Function|null} Bound keydown handler for debug toggle */
    this._keydownHandler = null;

    /** @type {boolean} Whether the pipeline has been initialised */
    this._initialised = false;

    /** @type {number} Canvas backing width */
    this._width = DEFAULT_WIDTH;

    /** @type {number} Canvas backing height */
    this._height = DEFAULT_HEIGHT;
  }

  // ---------------------------------------------------------------------------
  // INITIALISATION
  // ---------------------------------------------------------------------------

  /**
   * Initialise the pipeline with a canvas element.
   * Creates the YSortRenderer and PixelPerfectScaler.
   *
   * @param {HTMLCanvasElement} canvas - The game canvas
   */
  init(canvas) {
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError("RenderPipeline: expected HTMLCanvasElement");
    }

    this._canvas = canvas;
    this._width = canvas.width || DEFAULT_WIDTH;
    this._height = canvas.height || DEFAULT_HEIGHT;

    // Create scaler
    this._scaler = new PixelPerfectScaler(canvas);
    this._scaler.applyCSS();
    this._scaler.startResizeTracking();

    // Create Y-sort renderer
    this._renderer = new YSortRenderer(this._game, canvas);

    // Store context reference
    this._ctx = canvas.getContext("2d", { alpha: false });

    // Bind debug toggle key
    this._bindDebugToggle();

    this._initialised = true;

    // Emit init event if game has event bus
    this._emit("pipeline:init", {
      width: this._width,
      height: this._height,
    });
  }

  /**
   * Bind the F3 key to toggle debug overlay.
   * @private
   */
  _bindDebugToggle() {
    this._keydownHandler = (e) => {
      if (e.keyCode === DEBUG_KEY_CODE || e.key === "F3") {
        e.preventDefault();
        this.toggleDebug();
      }
    };
    document.addEventListener("keydown", this._keydownHandler);
  }

  // ---------------------------------------------------------------------------
  // SUBSYSTEM LINKING
  // ---------------------------------------------------------------------------

  /**
   * Link the isometric camera.
   *
   * @param {import("./IsoCamera.js").default} camera
   */
  setCamera(camera) {
    this._camera = camera;
    if (this._renderer && camera) {
      // Sync viewport size with camera
      camera.setCanvas(this._canvas);
    }
  }

  /**
   * Link the tilemap / world data provider.
   *
   * @param {Object} tilemap - Object with getCurrentArea(), getTileAt(), etc.
   */
  setTilemap(tilemap) {
    this._tilemap = tilemap;
  }

  /**
   * Link the sprite cache (IsoAssetLoader or compatible).
   *
   * @param {Object} cache - Sprite cache with getSprite(id) interface
   */
  setSpriteCache(cache) {
    this._spriteCache = cache;
  }

  /**
   * Link the area backgrounds provider.
   *
   * @param {Object} areaBackgrounds - IsoAreaBackgrounds instance
   */
  setAreaBackgrounds(areaBackgrounds) {
    this._areaBackgrounds = areaBackgrounds;
  }

  /**
   * Get the linked camera.
   * @returns {import("./IsoCamera.js").default|null}
   */
  getCamera() {
    return this._camera;
  }

  /**
   * Get the linked sprite cache.
   * @returns {Object|null}
   */
  getSpriteCache() {
    return this._spriteCache;
  }

  /**
   * Get the YSortRenderer instance.
   * @returns {YSortRenderer|null}
   */
  getRenderer() {
    return this._renderer;
  }

  /**
   * Get the PixelPerfectScaler instance.
   * @returns {PixelPerfectScaler|null}
   */
  getScaler() {
    return this._scaler;
  }

  // ---------------------------------------------------------------------------
  // MAIN FRAME LOOP
  // ---------------------------------------------------------------------------

  /**
   * Render one complete frame.  Called every frame by the game loop.
   * Coordinates all rendering subsystems in the correct order.
   *
   * @param {number} [timestamp=0] - DOMHighResTimeStamp from requestAnimationFrame
   */
  renderFrame(timestamp = 0) {
    if (!this._initialised || this._paused) return;

    this._frameCount++;

    // Calculate delta time and FPS
    const dt = this._lastTime > 0
      ? Math.min(timestamp - this._lastTime, MAX_DELTA_TIME)
      : 16.667;
    this._lastTime = timestamp;

    // Update FPS
    this._rawFpsAccum += dt;
    this._rawFpsFrames++;
    if (this._rawFpsAccum >= 1000) {
      const rawFps = Math.round((this._rawFpsFrames * 1000) / this._rawFpsAccum);
      this._fps = Math.round(this._fps * FPS_SMOOTHING + rawFps * (1 - FPS_SMOOTHING));
      this._rawFpsAccum = 0;
      this._rawFpsFrames = 0;
    }

    // Update camera
    if (this._camera) {
      this._camera.update(dt);
    }

    // Resolve current world area
    const world = this._resolveWorld();

    // Resolve entities
    const entities = this._resolveEntities();

    // Pre-render hooks
    this._runPreRender(dt, timestamp);

    // === STAGE 1: Clear ===
    this._stageClear();

    // === STAGE 2: Background ===
    this._stageBackground(world);

    // === STAGE 3-7: Y-sorted world rendering ===
    if (this._renderer && this._camera) {
      this._renderer.render(world, this._camera, entities, this._spriteCache);
      this._lastDrawCount = this._renderer.getDrawCount();
    }

    // === STAGE 8: UI Overlay ===
    if (this._uiVisible) {
      this._stageUI(entities, world);
    }

    // === STAGE 9: Debug Overlay ===
    if (this._debugVisible && this._renderer) {
      // Debug is rendered inside YSortRenderer when enabled,
      // but we can add pipeline-level debug info here if needed.
      this._stagePipelineDebug();
    }

    // Post-render hooks
    this._runPostRender(dt, timestamp);

    // Emit frame complete event
    this._emit("pipeline:frame", {
      frame: this._frameCount,
      fps: this._fps,
      drawCount: this._lastDrawCount,
      dt,
    });
  }

  // ---------------------------------------------------------------------------
  // RENDER STAGES
  // ---------------------------------------------------------------------------

  /**
   * Stage 1: Clear the canvas.
   * @private
   */
  _stageClear() {
    // The YSortRenderer handles clearing in its render() method.
    // If no renderer is active, clear manually.
    if (!this._renderer && this._ctx) {
      this._ctx.fillStyle = "#0a0a0f";
      this._ctx.fillRect(0, 0, this._width, this._height);
    }
  }

  /**
   * Stage 2: Render the area background (sky gradient, stars).
   *
   * @param {Object} world
   * @private
   */
  _stageBackground(world) {
    if (!this._renderer) return;

    // Use area palette for background
    if (world && world.palette) {
      const p = world.palette;
      this._renderer.renderBackgroundGradient(
        p.bgTop || p.light || "#1a1025",
        p.bgBottom || p.shadow || "#0a0a0f",
        {
          stars: world.ambient?.particles === "firefly" ? 30 : 50,
          starSeed: world.id ? this._hashString(world.id) : 0,
        },
      );
    } else {
      this._renderer.renderBackgroundGradient("#1a1025", "#0a0a0f", { stars: 50, starSeed: 42 });
    }

    // Render atmospheric overlay
    if (world && world.ambient) {
      const ambient = world.ambient;
      if (ambient.color && ambient.intensity > 0) {
        this._renderer.renderAtmosphere(ambient.color, ambient.intensity);
      }
    }
  }

  /**
   * Stage 8: Render UI overlays (global UI elements not tied to world tiles).
   *
   * @param {Array<Object>} entities
   * @param {Object} [world]
   * @private
   */
  _stageUI(entities, world) {
    if (!this._ctx) return;

    // Draw vignette overlay
    if (this._renderer) {
      this._renderer.renderVignette();
    }

    // Draw area name if transitioning or first entering
    if (world && world.name && this._game?.state?.showAreaName) {
      this._drawAreaName(world.name);
    }
  }

  /**
   * Stage 9: Pipeline-level debug info (complements renderer debug).
   * @private
   */
  _stagePipelineDebug() {
    if (!this._ctx) return;

    const ctx = this._ctx;
    ctx.save();

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(this._width - 180, 8, 170, 80);

    ctx.fillStyle = "#0ff";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const lines = [
      `Pipeline v6.0`,
      `Frame: ${this._frameCount}`,
      `FPS: ${this._fps}`,
      `Draws: ${this._lastDrawCount}`,
      `Zoom: ${this._scaler ? this._scaler.getZoom() : 1}`,
    ];

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], this._width - 174, 14 + i * 14);
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // WORLD & ENTITY RESOLUTION
  // ---------------------------------------------------------------------------

  /**
   * Resolve the current world / area object.
   * Tries areaBackgrounds, then tilemap, then fallback.
   *
   * @returns {Object|null}
   * @private
   */
  _resolveWorld() {
    if (this._areaBackgrounds && typeof this._areaBackgrounds.getCurrent === "function") {
      return this._areaBackgrounds.getCurrent();
    }
    if (this._tilemap && typeof this._tilemap.getCurrentArea === "function") {
      return this._tilemap.getCurrentArea();
    }
    if (this._game && this._game.state && this._game.state.currentArea) {
      return this._game.state.currentArea;
    }
    return null;
  }

  /**
   * Resolve the entity list for rendering.
   * Collects local player, online players, and NPCs.
   *
   * @returns {Array<Object>}
   * @private
   */
  _resolveEntities() {
    const entities = [];

    if (!this._game || !this._game.state) return entities;

    const state = this._game.state;

    // Local player
    if (state.player) {
      entities.push({
        ...state.player,
        type: "player",
        isLocal: true,
      });
    }

    // Online players
    if (state.onlinePlayers && Array.isArray(state.onlinePlayers)) {
      for (const op of state.onlinePlayers) {
        if (!op) continue;
        entities.push({
          ...op,
          type: "player",
          isLocal: false,
        });
      }
    }

    // NPCs
    if (state.npcs && Array.isArray(state.npcs)) {
      for (const npc of state.npcs) {
        if (!npc) continue;
        entities.push({
          ...npc,
          type: "npc",
          isNPC: true,
        });
      }
    }

    return entities;
  }

  // ---------------------------------------------------------------------------
  // UI DRAWING HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Draw the current area name as a large centered label.
   *
   * @param {string} name
   * @private
   */
  _drawAreaName(name) {
    const ctx = this._ctx;
    if (!ctx) return;

    ctx.save();

    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const tw = ctx.measureText(name).width;
    const pw = Math.ceil(tw + 24);
    const ph = 32;
    const px = Math.round((this._width - pw) / 2);
    const py = 16;

    // Background pill
    ctx.fillStyle = "rgba(10, 10, 15, 0.75)";
    this._drawRoundedRect(px, py, pw, ph, 16);
    ctx.fill();

    // Text
    ctx.fillStyle = "#ffd700";
    ctx.fillText(name, Math.round(this._width / 2), Math.round(py + 9));

    ctx.restore();
  }

  /**
   * Draw a rounded rectangle path.
   *
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} r
   * @private
   */
  _drawRoundedRect(x, y, w, h, r) {
    const ctx = this._ctx;
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  // ---------------------------------------------------------------------------
  // HOOKS SYSTEM
  // ---------------------------------------------------------------------------

  /**
   * Register a pre-render hook called before each frame.
   *
   * @param {Function} fn - Hook function(dt, timestamp)
   * @returns {Function} Unregister function
   */
  addPreRenderHook(fn) {
    if (typeof fn !== "function") {
      throw new TypeError("Hook must be a function");
    }
    this._preRenderHooks.push(fn);
    return () => this.removePreRenderHook(fn);
  }

  /**
   * Remove a pre-render hook.
   * @param {Function} fn
   */
  removePreRenderHook(fn) {
    const idx = this._preRenderHooks.indexOf(fn);
    if (idx !== -1) {
      this._preRenderHooks.splice(idx, 1);
    }
  }

  /**
   * Register a post-render hook called after each frame.
   *
   * @param {Function} fn - Hook function(dt, timestamp)
   * @returns {Function} Unregister function
   */
  addPostRenderHook(fn) {
    if (typeof fn !== "function") {
      throw new TypeError("Hook must be a function");
    }
    this._postRenderHooks.push(fn);
    return () => this.removePostRenderHook(fn);
  }

  /**
   * Remove a post-render hook.
   * @param {Function} fn
   */
  removePostRenderHook(fn) {
    const idx = this._postRenderHooks.indexOf(fn);
    if (idx !== -1) {
      this._postRenderHooks.splice(idx, 1);
    }
  }

  /**
   * Run all pre-render hooks.
   * @param {number} dt
   * @param {number} timestamp
   * @private
   */
  _runPreRender(dt, timestamp) {
    for (const hook of this._preRenderHooks) {
      try {
        hook(dt, timestamp);
      } catch (err) {
        console.error("RenderPipeline pre-render hook error:", err);
      }
    }
  }

  /**
   * Run all post-render hooks.
   * @param {number} dt
   * @param {number} timestamp
   * @private
   */
  _runPostRender(dt, timestamp) {
    for (const hook of this._postRenderHooks) {
      try {
        hook(dt, timestamp);
      } catch (err) {
        console.error("RenderPipeline post-render hook error:", err);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // RESIZE
  // ---------------------------------------------------------------------------

  /**
   * Handle window / canvas resize.
   * Propagates to scaler, camera, and renderer.
   */
  resize() {
    if (!this._canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = Math.round(this._canvas.clientWidth * dpr);
    const displayH = Math.round(this._canvas.clientHeight * dpr);

    // Only resize backing store if display size changed significantly
    if (Math.abs(displayW - this._width) > 2 || Math.abs(displayH - this._height) > 2) {
      this._width = displayW;
      this._height = displayH;
      this._canvas.width = displayW;
      this._canvas.height = displayH;
    }

    if (this._scaler) {
      this._scaler.handleResize();
    }

    if (this._camera) {
      this._camera.updateBounds();
    }

    if (this._renderer) {
      this._renderer.resize(this._width, this._height);
    }

    this._emit("pipeline:resize", {
      width: this._width,
      height: this._height,
    });
  }

  // ---------------------------------------------------------------------------
  // TELEMETRY
  // ---------------------------------------------------------------------------

  /**
   * Get the current FPS estimate.
   * @returns {number}
   */
  getFPS() {
    return this._fps;
  }

  /**
   * Get the number of sprites drawn in the last frame.
   * @returns {number}
   */
  getDrawCount() {
    return this._lastDrawCount;
  }

  /**
   * Get the current frame counter.
   * @returns {number}
   */
  getFrameCount() {
    return this._frameCount;
  }

  /**
   * Get the total number of tracked objects from the last render.
   * @returns {number}
   */
  getObjectCount() {
    return this._renderer ? this._renderer.getObjectCount() : 0;
  }

  // ---------------------------------------------------------------------------
  // DEBUG
  // ---------------------------------------------------------------------------

  /**
   * Toggle the debug overlay on/off.
   * @returns {boolean} New debug state
   */
  toggleDebug() {
    this._debugVisible = !this._debugVisible;
    if (this._renderer) {
      this._renderer.setDebug(this._debugVisible);
    }
    this._emit("pipeline:debug", { enabled: this._debugVisible });
    return this._debugVisible;
  }

  /**
   * Explicitly set the debug overlay state.
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this._debugVisible = !!enabled;
    if (this._renderer) {
      this._renderer.setDebug(this._debugVisible);
    }
  }

  /**
   * Check if debug overlay is currently visible.
   * @returns {boolean}
   */
  isDebugVisible() {
    return this._debugVisible;
  }

  // ---------------------------------------------------------------------------
  // UI VISIBILITY
  // ---------------------------------------------------------------------------

  /**
   * Toggle UI overlay visibility.
   * @returns {boolean}
   */
  toggleUI() {
    this._uiVisible = !this._uiVisible;
    return this._uiVisible;
  }

  /**
   * Set UI overlay visibility.
   * @param {boolean} enabled
   */
  setUIVisible(enabled) {
    this._uiVisible = !!enabled;
  }

  /**
   * Check if UI overlay is visible.
   * @returns {boolean}
   */
  isUIVisible() {
    return this._uiVisible;
  }

  // ---------------------------------------------------------------------------
  // PAUSE / RESUME
  // ---------------------------------------------------------------------------

  /**
   * Pause the render pipeline (frames will not render).
   */
  pause() {
    this._paused = true;
  }

  /**
   * Resume the render pipeline.
   */
  resume() {
    this._paused = false;
    this._lastTime = 0;
  }

  /**
   * Check if the pipeline is paused.
   * @returns {boolean}
   */
  isPaused() {
    return this._paused;
  }

  // ---------------------------------------------------------------------------
  // UTILITY
  // ---------------------------------------------------------------------------

  /**
   * Hash a string to a numeric seed.
   *
   * @param {string} str
   * @returns {number}
   * @private
   */
  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  /**
   * Emit an event on the game event bus if available.
   *
   * @param {string} event
   * @param {Object} data
   * @private
   */
  _emit(event, data) {
    if (this._game && typeof this._game.emit === "function") {
      this._game.emit(event, data);
    }
  }

  // ---------------------------------------------------------------------------
  // STATIC HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Create a full pipeline with all subsystems wired together.
   * Convenience factory for bootstrapping.
   *
   * @param {Object} config
   * @param {Object} config.game - Game instance
   * @param {HTMLCanvasElement} config.canvas - Canvas element
   * @param {import("./IsoCamera.js").default} [config.camera] - Camera
   * @param {Object} [config.tilemap] - Tilemap
   * @param {Object} [config.sprites] - Sprite cache
   * @param {Object} [config.areas] - Area backgrounds
   * @returns {RenderPipeline}
   */
  static create(config) {
    const pipeline = new RenderPipeline(config.game);
    pipeline.init(config.canvas);

    if (config.camera) pipeline.setCamera(config.camera);
    if (config.tilemap) pipeline.setTilemap(config.tilemap);
    if (config.sprites) pipeline.setSpriteCache(config.sprites);
    if (config.areas) pipeline.setAreaBackgrounds(config.areas);

    return pipeline;
  }

  // ---------------------------------------------------------------------------
  // LIFECYCLE
  // ---------------------------------------------------------------------------

  /**
   * Clean up all resources, event listeners, and references.
   */
  destroy() {
    // Remove debug toggle listener
    if (this._keydownHandler) {
      document.removeEventListener("keydown", this._keydownHandler);
      this._keydownHandler = null;
    }

    // Destroy subsystems
    if (this._renderer) {
      this._renderer.destroy();
      this._renderer = null;
    }

    if (this._scaler) {
      this._scaler.destroy();
      this._scaler = null;
    }

    // Clear hooks
    this._preRenderHooks.length = 0;
    this._postRenderHooks.length = 0;

    // Clear references
    this._camera = null;
    this._tilemap = null;
    this._spriteCache = null;
    this._areaBackgrounds = null;
    this._canvas = null;
    this._ctx = null;
    this._initialised = false;
  }
}
