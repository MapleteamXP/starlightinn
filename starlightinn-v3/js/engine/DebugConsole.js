/**
 * @file DebugConsole.js
 * @description In-game developer debug overlay for Starlight Inn v3.5.
 * Provides a comprehensive debugging interface rendered on an HTML5 Canvas
 * with performance graphs, network monitoring, game state inspection,
 * command execution, and error tracking.
 *
 * All visualizations are rendered using the Canvas 2D API with no
 * external dependencies. The overlay is toggleable, draggable, and
 * auto-scales all graph axes based on observed min/max values.
 *
 * @author Starlight Inn Team
 * @version 3.5.0
 * @since 2024-12-01
 */

// ============================================================
// CONSTANTS
// ============================================================

/** @constant {string} CONSOLE_TOGGLE_KEY - Keyboard key to toggle the debug console */
const CONSOLE_TOGGLE_KEY = '`';

/** @constant {string} CONSOLE_TOGGLE_KEY_ALT - Alternative key to toggle (Backslash) */
const CONSOLE_TOGGLE_KEY_ALT = '\\';

/** @constant {number} GRAPH_HISTORY_SIZE - Number of data points to keep for line graphs */
const GRAPH_HISTORY_SIZE = 60;

/** @constant {number} LOG_HISTORY_SIZE - Maximum console log entries to retain */
const LOG_HISTORY_SIZE = 200;

/** @constant {number} MAX_LOG_ENTRIES_PER_FRAME - Limit log processing per frame */
const MAX_LOG_ENTRIES_PER_FRAME = 10;

/** @constant {number} CONSOLE_WIDTH - Default width of the debug panel in pixels */
const CONSOLE_WIDTH = 720;

/** @constant {number} CONSOLE_HEIGHT - Default height of the debug panel in pixels */
const CONSOLE_HEIGHT = 520;

/** @constant {number} GRAPH_HEIGHT - Height of individual graph canvases */
const GRAPH_HEIGHT = 80;

/** @constant {number} HEADER_HEIGHT - Height of the panel header/drag handle */
const HEADER_HEIGHT = 28;

/** @constant {number} CATEGORY_COUNT - Number of debug categories */
const CATEGORY_COUNT = 12;

/** @constant {number} MINIMUM_MS_PER_FRAME - Floor for frame time calculations (prevents division by zero) */
const MINIMUM_MS_PER_FRAME = 0.1;

/** @constant {number} BYTES_PER_MB - Conversion factor for bytes to megabytes */
const BYTES_PER_MB = 1048576;

/** @constant {string} STORAGE_KEY_POSITION - localStorage key for console position */
const STORAGE_KEY_POSITION = 'starlight_debug_console_pos';

/** @constant {Array<string>} CONSOLE_CATEGORIES - Names of the 12 toggleable debug categories */
const CONSOLE_CATEGORIES = [
  'Performance',
  'Network',
  'Collision',
  'Assets',
  'Game State',
  'Log Viewer',
  'Commands',
  'Errors',
  'Memory',
  'Entities',
  'Rendering',
  'Seasonal',
];

/** @constant {Object} COLORS - Color palette for debug console rendering */
const COLORS = {
  bg: 'rgba(15, 15, 25, 0.92)',
  bgSolid: '#0f0f19',
  header: '#1a1a2e',
  border: '#2a2a3e',
  text: '#e0e0e0',
  textDim: '#888888',
  textHighlight: '#ffffff',
  accent: '#4fc3f7',
  accentDim: '#2979ff',
  success: '#66bb6a',
  warning: '#ffa726',
  error: '#ef5350',
  graphLine: '#4fc3f7',
  graphFill: 'rgba(79, 195, 247, 0.15)',
  graphGrid: '#2a2a3e',
  graphLineGreen: '#66bb6a',
  graphFillGreen: 'rgba(102, 187, 106, 0.15)',
  graphLineYellow: '#ffa726',
  graphFillYellow: 'rgba(255, 167, 38, 0.15)',
  graphLineRed: '#ef5350',
  categoryOn: '#66bb6a',
  categoryOff: '#444444',
  button: '#2a2a3e',
  buttonHover: '#3a3a4e',
  treeKey: '#4fc3f7',
  treeValue: '#a5d6a7',
  treeString: '#ce93d8',
};

// ============================================================
// DEBUG CONSOLE CLASS
// ============================================================

/**
 * @class DebugConsole
 * @classdesc In-game developer debug overlay providing comprehensive
 * runtime diagnostics for Starlight Inn. Renders performance graphs,
 * network monitoring, game state trees, log capture, command execution,
 * and error tracking — all using Canvas 2D with no external dependencies.
 *
 * @example
 * const debug = new DebugConsole(game, document.getElementById('game-canvas'));
 * debug.show(); // or press ` key
 * // In game loop:
 * debug.update(dt);
 * debug.render();
 */
class DebugConsole {
  /**
   * @description Creates an instance of DebugConsole.
   * @param {Object} game - The main game instance.
   * @param {Object} game.player - Player state object with position, area, currency.
   * @param {Object} game.network - Network manager with ping, message counts, connection status.
   * @param {Object} game.renderer - Renderer with draw call and sprite count info.
   * @param {Object} game.physics - Physics system with collision stats.
   * @param {Object} game.assetManager - Asset manager with load tracking.
   * @param {Object} game.seasons - SeasonalContent instance.
   * @param {Object} game.eventBus - Event bus for command execution.
   * @param {HTMLCanvasElement} renderCanvas - The game's main canvas element (for sizing reference).
   */
  constructor(game, renderCanvas) {
    /** @private @type {Object} */
    this._game = game;

    /** @private @type {HTMLCanvasElement} */
    this._renderCanvas = renderCanvas;

    /** @private @type {boolean} */
    this._visible = false;

    /** @private @type {number} */
    this._width = CONSOLE_WIDTH;

    /** @private @type {number} */
    this._height = CONSOLE_HEIGHT;

    /** @private @type {number} */
    this._x = 20;

    /** @private @type {number} */
    this._y = 20;

    /** @private @type {boolean} */
    this._dragging = false;

    /** @private @type {number} */
    this._dragOffsetX = 0;

    /** @private @type {number} */
    this._dragOffsetY = 0;

    /** @private @type {number} */
    this._errorCount = 0;

    /** @private @type {Object} */
    this._errorBreakdown = { collision: 0, network: 0, render: 0, other: 0 };

    // ---- Performance data ----
    /** @private @type {Array<number>} */
    this._fpsHistory = new Array(GRAPH_HISTORY_SIZE).fill(60);

    /** @private @type {Array<number>} */
    this._frameTimeHistory = new Array(GRAPH_HISTORY_SIZE).fill(16.67);

    /** @private @type {number} */
    this._currentFps = 60;

    /** @private @type {number} */
    this._currentFrameTime = 16.67;

    /** @private @type {number} */
    this._lastFrameTimestamp = 0;

    /** @private @type {number} */
    this._frameAccumulator = 0;

    /** @private @type {number} */
    this._frameCount = 0;

    // ---- Network data ----
    /** @private @type {Array<number>} */
    this._pingHistory = new Array(GRAPH_HISTORY_SIZE).fill(0);

    /** @private @type {number} */
    this._currentPing = 0;

    /** @private @type {number} */
    this._packetLossPercent = 0;

    /** @private @type {string} */
    this._connectionStatus = 'Unknown';

    /** @private @type {number} */
    this._messagesInPerSecond = 0;

    /** @private @type {number} */
    this._messagesOutPerSecond = 0;

    /** @private @type {number} */
    this._messagesInAccumulator = 0;

    /** @private @type {number} */
    this._messagesOutAccumulator = 0;

    /** @private @type {number} */
    this._networkAccumulateTimer = 0;

    // ---- Collision data ----
    /** @private @type {number} */
    this._entityCount = 0;

    /** @private @type {number} */
    this._collisionTestsPerFrame = 0;

    /** @private @type {number} */
    this._portalTriggersThisSession = 0;

    /** @private @type {number} */
    this._spatialHashAvgEntitiesPerCell = 0;

    // ---- Asset data ----
    /** @private @type {number} */
    this._loadedSpriteCount = 0;

    /** @private @type {number} */
    this._textureAtlasFillPercent = 0;

    /** @private @type {number} */
    this._cacheHitRatio = 0;

    /** @private @type {number} */
    this._totalTextureMemoryMB = 0;

    /** @private @type {number} */
    this._pendingLoadsCount = 0;

    // ---- Log viewer ----
    /** @private @type {Array<Object>} */
    this._capturedLogs = [];

    /** @private @type {string} */
    this._logFilter = '';

    // ---- Category toggles ----
    /** @private @type {Array<boolean>} */
    this._categoryEnabled = new Array(CATEGORY_COUNT).fill(true);

    // ---- Command input ----
    /** @private @type {string} */
    this._commandBuffer = '';

    /** @private @type {Array<string>} */
    this._commandHistory = [];

    /** @private @type {number} */
    this._commandHistoryIndex = -1;

    /** @private @type {string} */
    this._lastCommandOutput = '';

    // ---- Game state tree ----
    /** @private @type {Array<string>} */
    this._expandedTreePaths = [];

    // ---- Seasonal data ----
    /** @private @type {?Object} */
    this._seasonalData = null;

    // ---- Canvas setup ----
    /** @private @type {?HTMLCanvasElement} */
    this._consoleCanvas = null;

    /** @private @type {?CanvasRenderingContext2D} */
    this._ctx = null;

    // ---- Scroll offsets for panels ----
    /** @private @type {number} */
    this._logScrollY = 0;

    /** @private @type {number} */
    this._stateScrollY = 0;

    // ---- Cached command handlers ----
    /** @private @type {Object} */
    this._commands = this._buildCommandHandlers();

    // ---- Bindings ----
    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundMouseDown = this._onMouseDown.bind(this);
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundMouseUp = this._onMouseUp.bind(this);
    this._boundConsoleLog = this._onConsoleLog.bind(this);
    this._boundConsoleWarn = this._onConsoleWarn.bind(this);
    this._boundConsoleError = this._onConsoleError.bind(this);
    this._boundWindowError = this._onWindowError.bind(this);

    this._loadPosition();
    this._setupConsoleCapture();
    this._setupErrorCapture();
    this._setupDOM();
    this._setupInput();
  }

  // ============================================================
  // PUBLIC API - Visibility
  // ============================================================

  /**
   * @description Shows the debug console overlay.
   */
  show() {
    this._visible = true;
    if (this._consoleCanvas) {
      this._consoleCanvas.style.display = 'block';
    }
  }

  /**
   * @description Hides the debug console overlay.
   */
  hide() {
    this._visible = false;
    if (this._consoleCanvas) {
      this._consoleCanvas.style.display = 'none';
    }
  }

  /**
   * @description Toggles the debug console visibility.
   */
  toggle() {
    if (this._visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * @description Returns whether the debug console is currently visible.
   * @returns {boolean} True if the console is visible.
   */
  isVisible() {
    return this._visible;
  }

  // ============================================================
  // PUBLIC API - Per-Frame Update
  // ============================================================

  /**
   * @description Updates the debug console state. Call once per frame from the game loop.
   * @param {number} dt - Delta time in milliseconds since last frame.
   */
  update(dt) {
    if (!this._visible) return;

    // Update FPS and frame time
    this._updatePerformanceMetrics(dt);

    // Update network metrics
    this._updateNetworkMetrics(dt);

    // Update game-derived metrics
    this._updateGameMetrics();

    // Update seasonal data
    this._updateSeasonalData();
  }

  /**
   * @description Renders the debug console. Call once per frame after update().
   */
  render() {
    if (!this._visible || !this._ctx) return;

    const ctx = this._ctx;
    const w = this._width;
    const h = this._height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    // Border
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);

    // Header
    this._renderHeader(ctx, w);

    // Category checkboxes
    const contentTop = HEADER_HEIGHT + 4;
    this._renderCategories(ctx, contentTop);

    // Content area
    const contentY = contentTop + 28;
    const contentHeight = h - contentY - 30;
    this._renderContent(ctx, contentY, contentHeight, w);

    // Command input bar
    this._renderCommandBar(ctx, h - 26, w);

    // Error badge
    if (this._errorCount > 0) {
      this._renderErrorBadge(ctx, w);
    }
  }

  // ============================================================
  // PUBLIC API - Error Tracking
  // ============================================================

  /**
   * @description Records a collision-related error.
   */
  recordCollisionError() {
    this._errorCount++;
    this._errorBreakdown.collision++;
  }

  /**
   * @description Records a network-related error.
   */
  recordNetworkError() {
    this._errorCount++;
    this._errorBreakdown.network++;
  }

  /**
   * @description Records a render-related error.
   */
  recordRenderError() {
    this._errorCount++;
    this._errorBreakdown.render++;
  }

  /**
   * @description Records a generic/other error.
   */
  recordError() {
    this._errorCount++;
    this._errorBreakdown.other++;
  }

  /**
   * @description Returns the current error count.
   * @returns {number} Number of errors recorded this session.
   */
  getErrorCount() {
    return this._errorCount;
  }

  // ============================================================
  // PUBLIC API - Data Feeders (called by game systems)
  // ============================================================

  /**
   * @description Feeds a ping sample into the network monitor.
   * @param {number} pingMs - Round-trip time in milliseconds.
   */
  feedPing(pingMs) {
    this._pingHistory.push(Math.max(0, pingMs));
    if (this._pingHistory.length > GRAPH_HISTORY_SIZE) {
      this._pingHistory.shift();
    }
    this._currentPing = pingMs;
  }

  /**
   * @description Feeds packet loss data.
   * @param {number} percent - Packet loss percentage (0-100).
   */
  feedPacketLoss(percent) {
    this._packetLossPercent = Math.max(0, Math.min(100, percent));
  }

  /**
   * @description Feeds connection status.
   * @param {string} status - Connection status string (e.g., 'Connected', 'Disconnected').
   */
  feedConnectionStatus(status) {
    this._connectionStatus = status;
  }

  /**
   * @description Feeds incoming WebSocket message count.
   * @param {number} count - Number of messages received.
   */
  feedMessagesIn(count) {
    this._messagesInAccumulator += count;
  }

  /**
   * @description Feeds outgoing WebSocket message count.
   * @param {number} count - Number of messages sent.
   */
  feedMessagesOut(count) {
    this._messagesOutAccumulator += count;
  }

  /**
   * @description Feeds collision statistics.
   * @param {Object} stats - Collision stats object.
   * @param {number} stats.entityCount - Total entity count.
   * @param {number} stats.testsPerFrame - Collision tests per frame.
   * @param {number} stats.spatialHashAvgEntities - Average entities per spatial hash cell.
   */
  feedCollisionStats(stats) {
    if (!stats) return;
    this._entityCount = stats.entityCount || 0;
    this._collisionTestsPerFrame = stats.testsPerFrame || 0;
    this._spatialHashAvgEntitiesPerCell = stats.spatialHashAvgEntities || 0;
  }

  /**
   * @description Feeds asset loading statistics.
   * @param {Object} stats - Asset stats object.
   * @param {number} stats.loadedSprites - Number of loaded sprites.
   * @param {number} stats.atlasFillPercent - Texture atlas fill percentage.
   * @param {number} stats.cacheHitRatio - Cache hit ratio (0-1).
   * @param {number} stats.textureMemoryMB - Total texture memory in MB.
   * @param {number} stats.pendingLoads - Number of pending loads.
   */
  feedAssetStats(stats) {
    if (!stats) return;
    this._loadedSpriteCount = stats.loadedSprites || 0;
    this._textureAtlasFillPercent = stats.atlasFillPercent || 0;
    this._cacheHitRatio = stats.cacheHitRatio || 0;
    this._totalTextureMemoryMB = stats.textureMemoryMB || 0;
    this._pendingLoadsCount = stats.pendingLoads || 0;
  }

  /**
   * @description Increments the portal trigger counter.
   */
  recordPortalTrigger() {
    this._portalTriggersThisSession++;
  }

  // ============================================================
  // PUBLIC API - Report Export
  // ============================================================

  /**
   * @description Generates a JSON snapshot of all debug data for bug reporting.
   * @returns {Object} Complete debug snapshot.
   */
  exportReport() {
    const report = {
      timestamp: Date.now(),
      dateISO: new Date().toISOString(),
      session: {
        uptimeMs: this._lastFrameTimestamp,
        totalErrors: this._errorCount,
        errorBreakdown: { ...this._errorBreakdown },
      },
      performance: {
        fpsHistory: [...this._fpsHistory],
        currentFps: this._currentFps,
        currentFrameTimeMs: this._currentFrameTime,
        averageFps: this._fpsHistory.reduce((a, b) => a + b, 0) / this._fpsHistory.length,
      },
      network: {
        pingHistory: [...this._pingHistory],
        currentPing: this._currentPing,
        packetLossPercent: this._packetLossPercent,
        connectionStatus: this._connectionStatus,
        messagesInPerSecond: this._messagesInPerSecond,
        messagesOutPerSecond: this._messagesOutPerSecond,
      },
      collision: {
        entityCount: this._entityCount,
        collisionTestsPerFrame: this._collisionTestsPerFrame,
        portalTriggersThisSession: this._portalTriggersThisSession,
        spatialHashAvgEntitiesPerCell: this._spatialHashAvgEntitiesPerCell,
      },
      assets: {
        loadedSpriteCount: this._loadedSpriteCount,
        textureAtlasFillPercent: this._textureAtlasFillPercent,
        cacheHitRatio: this._cacheHitRatio,
        totalTextureMemoryMB: this._totalTextureMemoryMB,
        pendingLoadsCount: this._pendingLoadsCount,
      },
      gameState: this._captureGameState(),
      logs: this._capturedLogs.slice(-50),
    };

    return report;
  }

  /**
   * @description Exports the debug report as a downloadable JSON file.
   */
  downloadReport() {
    const report = this.exportReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `starlight-debug-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // PUBLIC API - Lifecycle
  // ============================================================

  /**
   * @description Disposes the debug console, removing all DOM elements and listeners.
   */
  dispose() {
    this._restoreConsole();
    this._teardownDOM();
    document.removeEventListener('keydown', this._boundKeyDown);
    window.removeEventListener('error', this._boundWindowError);
    this._savePosition();
  }

  // ============================================================
  // PRIVATE METHODS - Performance Tracking
  // ============================================================

  /**
   * @private
   * @description Updates FPS and frame time metrics from delta time.
   * @param {number} dt - Delta time in milliseconds.
   */
  _updatePerformanceMetrics(dt) {
    // Frame time
    this._currentFrameTime = Math.max(MINIMUM_MS_PER_FRAME, dt);
    this._frameTimeHistory.push(this._currentFrameTime);
    if (this._frameTimeHistory.length > GRAPH_HISTORY_SIZE) {
      this._frameTimeHistory.shift();
    }

    // FPS calculation using accumulator
    this._frameAccumulator += dt;
    this._frameCount++;

    if (this._frameAccumulator >= 1000) {
      this._currentFps = this._frameCount;
      this._fpsHistory.push(this._frameCount);
      if (this._fpsHistory.length > GRAPH_HISTORY_SIZE) {
        this._fpsHistory.shift();
      }
      this._frameAccumulator = 0;
      this._frameCount = 0;
    }
  }

  /**
   * @private
   * @description Updates network metrics from accumulated counters.
   * @param {number} dt - Delta time in milliseconds.
   */
  _updateNetworkMetrics(dt) {
    this._networkAccumulateTimer += dt;
    if (this._networkAccumulateTimer >= 1000) {
      this._messagesInPerSecond = this._messagesInAccumulator;
      this._messagesOutPerSecond = this._messagesOutAccumulator;
      this._messagesInAccumulator = 0;
      this._messagesOutAccumulator = 0;
      this._networkAccumulateTimer = 0;
    }
  }

  /**
   * @private
   * @description Pulls the latest metrics from the game instance.
   */
  _updateGameMetrics() {
    if (!this._game) return;

    // Try to get draw call count and sprite count from renderer
    if (this._game.renderer) {
      const r = this._game.renderer;
      this._loadedSpriteCount = r.spriteCount || this._loadedSpriteCount;
    }

    // Try to get collision stats from physics
    if (this._game.physics) {
      const p = this._game.physics;
      this._entityCount = p.entityCount || this._entityCount;
      this._collisionTestsPerFrame = p.lastCollisionTestCount || this._collisionTestsPerFrame;
      if (p.spatialHash) {
        this._spatialHashAvgEntitiesPerCell = p.spatialHash.averageEntitiesPerCell || 0;
      }
    }

    // Try to get network stats
    if (this._game.network) {
      const n = this._game.network;
      if (n.ping !== undefined) this.feedPing(n.ping);
      if (n.connectionState) this.feedConnectionStatus(n.connectionState);
    }

    // Try to get asset stats
    if (this._game.assetManager) {
      const a = this._game.assetManager;
      this._pendingLoadsCount = a.pendingLoads || 0;
      if (a.loadedCount !== undefined) this._loadedSpriteCount = a.loadedCount;
      if (a.cacheHitRatio !== undefined) this._cacheHitRatio = a.cacheHitRatio;
      if (a.textureMemoryMB !== undefined) this._totalTextureMemoryMB = a.textureMemoryMB;
      if (a.atlasFillPercent !== undefined) this._textureAtlasFillPercent = a.atlasFillPercent;
    }
  }

  /**
   * @private
   * @description Updates seasonal data from the game's seasonal content system.
   */
  _updateSeasonalData() {
    if (!this._game || !this._game.seasons) return;
    const s = this._game.seasons;
    const season = s.getCurrentSeason ? s.getCurrentSeason() : null;
    this._seasonalData = season ? {
      name: season.displayName || season.name,
      progress: s.getSeasonProgress ? s.getSeasonProgress() : 0,
      countdown: s.getCountdown ? s.getCountdown() : null,
      hourlyGold: s.getHourlyGoldRate ? s.getHourlyGoldRate() : 100,
      isBoosted: s.isGoldBoosted ? s.isGoldBoosted() : false,
      achievementCount: s.getSeasonalAchievements ? s.getSeasonalAchievements().length : 0,
    } : null;
  }

  // ============================================================
  // PRIVATE METHODS - Game State Capture
  // ============================================================

  /**
   * @private
   * @description Captures current game state for the tree view and report export.
   * @returns {Object} Game state snapshot.
   */
  _captureGameState() {
    if (!this._game) return {};

    const state = {};

    // Player position
    if (this._game.player) {
      const p = this._game.player;
      state.player = {
        position: { x: p.x || 0, y: p.y || 0 },
        currentArea: p.currentArea || 'unknown',
        direction: p.direction || 'down',
      };
    }

    // Currency
    if (this._game.currency) {
      const c = this._game.currency;
      state.currency = {
        silver: c.silver || 0,
        gold: c.gold || 0,
      };
    }

    // Online players
    if (this._game.social) {
      state.onlinePlayerCount = this._game.social.onlineCount || 0;
    }

    // Active entities
    state.activeEntityCount = this._entityCount;

    // Season
    if (this._game.seasons) {
      const season = this._game.seasons.getCurrentSeason ? this._game.seasons.getCurrentSeason() : null;
      state.activeSeason = season ? season.id : null;
    }

    return state;
  }

  // ============================================================
  // PRIVATE METHODS - Canvas Rendering
  // ============================================================

  /**
   * @private
   * @description Renders the panel header with title and drag indicator.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} w - Panel width.
   */
  _renderHeader(ctx, w) {
    ctx.fillStyle = COLORS.header;
    ctx.fillRect(1, 1, w - 2, HEADER_HEIGHT - 1);

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 13px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('Starlight Inn Debug Console v3.5', 10, HEADER_HEIGHT / 2 + 1);

    // Close button
    const closeX = w - 24;
    ctx.fillStyle = COLORS.error;
    ctx.fillRect(closeX, 6, 16, 16);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('x', closeX + 8, HEADER_HEIGHT / 2 + 1);
    ctx.textAlign = 'left';
  }

  /**
   * @private
   * @description Renders the category toggle checkboxes.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} y - Starting Y position.
   */
  _renderCategories(ctx, y) {
    const boxSize = 10;
    const gap = 6;
    const labelWidth = 84;
    let x = 8;

    ctx.font = '10px monospace';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < CATEGORY_COUNT; i++) {
      const enabled = this._categoryEnabled[i];
      const name = CONSOLE_CATEGORIES[i];

      // Checkbox
      ctx.fillStyle = enabled ? COLORS.categoryOn : COLORS.categoryOff;
      ctx.fillRect(x, y + 2, boxSize, boxSize);
      ctx.strokeStyle = COLORS.border;
      ctx.strokeRect(x, y + 2, boxSize, boxSize);

      // Label
      ctx.fillStyle = enabled ? COLORS.text : COLORS.textDim;
      ctx.fillText(name, x + boxSize + 3, y + 8);

      x += boxSize + labelWidth + gap;

      // Wrap to next row if needed
      if (x + labelWidth > this._width - 20) {
        x = 8;
        y += 18;
      }
    }
  }

  /**
   * @private
   * @description Renders the main content area based on enabled categories.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} y - Starting Y position.
   * @param {number} h - Available height.
   * @param {number} w - Panel width.
   */
  _renderContent(ctx, y, h, w) {
    let cursorY = y;
    const colW = Math.floor((w - 20) / 2);

    // Left column: Performance + Network (if enabled)
    if (this._categoryEnabled[0]) { // Performance
      this._renderPerformanceSection(ctx, 10, cursorY, colW);
      cursorY += 110;
    }

    if (this._categoryEnabled[1] && cursorY < y + h) { // Network
      this._renderNetworkSection(ctx, 10, cursorY, colW);
      cursorY += 110;
    }

    if (this._categoryEnabled[7] && cursorY < y + h) { // Errors
      this._renderErrorsSection(ctx, 10, cursorY, colW);
      cursorY += 70;
    }

    if (this._categoryEnabled[3] && cursorY < y + h) { // Assets
      this._renderAssetsSection(ctx, 10, cursorY, colW);
      cursorY += 85;
    }

    // Right column
    let rightY = y;

    if (this._categoryEnabled[4]) { // Game State
      this._renderGameStateSection(ctx, 10 + colW + 10, rightY, colW);
      rightY += 140;
    }

    if (this._categoryEnabled[2] && rightY < y + h) { // Collision
      this._renderCollisionSection(ctx, 10 + colW + 10, rightY, colW);
      rightY += 85;
    }

    if (this._categoryEnabled[5] && rightY < y + h) { // Log Viewer
      this._renderLogViewer(ctx, 10 + colW + 10, rightY, colW, Math.min(180, y + h - rightY));
      rightY += Math.min(180, y + h - rightY);
    }

    if (this._categoryEnabled[11] && rightY < y + h) { // Seasonal
      this._renderSeasonalSection(ctx, 10 + colW + 10, rightY, colW);
      rightY += 75;
    }
  }

  /**
   * @private
   * @description Renders the Performance section with FPS and frame time graphs.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {number} w - Section width.
   */
  _renderPerformanceSection(ctx, x, y, w) {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 11px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`PERFORMANCE  FPS: ${this._currentFps}  Frame: ${this._currentFrameTime.toFixed(2)}ms`, x, y);

    // FPS Graph
    this._renderLineGraph(ctx, x, y + 14, Math.floor(w / 2) - 4, GRAPH_HEIGHT,
      this._fpsHistory, 0, 75, 'FPS', COLORS.graphLine, COLORS.graphFill);

    // Frame time graph
    this._renderLineGraph(ctx, x + Math.floor(w / 2), y + 14, Math.floor(w / 2) - 4, GRAPH_HEIGHT,
      this._frameTimeHistory, 0, 33.33, 'ms', COLORS.graphLineYellow, COLORS.graphFillYellow);

    // Memory usage
    if (performance && performance.memory) {
      const memMB = (performance.memory.usedJSHeapSize / BYTES_PER_MB).toFixed(1);
      const totalMB = (performance.memory.totalJSHeapSize / BYTES_PER_MB).toFixed(1);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '9px monospace';
      ctx.fillText(`JS Heap: ${memMB} / ${totalMB} MB`, x, y + 14 + GRAPH_HEIGHT + 2);
    }
  }

  /**
   * @private
   * @description Renders the Network section with ping graph and stats.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {number} w - Section width.
   */
  _renderNetworkSection(ctx, x, y, w) {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`NETWORK  Ping: ${this._currentPing}ms  Loss: ${this._packetLossPercent.toFixed(1)}%`, x, y);

    // Ping graph
    const pingMax = Math.max(200, ...this._pingHistory);
    this._renderLineGraph(ctx, x, y + 14, Math.floor(w / 2) - 4, GRAPH_HEIGHT,
      this._pingHistory, 0, pingMax, 'ms', COLORS.graphLineGreen, COLORS.graphFillGreen);

    // Connection stats text block
    const statsX = x + Math.floor(w / 2);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px monospace';
    ctx.fillText(`Status: ${this._connectionStatus}`, statsX, y + 18);
    ctx.fillText(`In: ${this._messagesInPerSecond}/s`, statsX, y + 32);
    ctx.fillText(`Out: ${this._messagesOutPerSecond}/s`, statsX, y + 46);
    ctx.fillText(`Samples: ${this._pingHistory.filter(p => p > 0).length}`, statsX, y + 60);
  }

  /**
   * @private
   * @description Renders the Collision stats section.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {number} w - Section width.
   */
  _renderCollisionSection(ctx, x, y, w) {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 11px monospace';
    ctx.fillText('COLLISION', x, y);

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px monospace';
    const lines = [
      `Entities: ${this._entityCount}`,
      `Tests/frame: ${this._collisionTestsPerFrame}`,
      `Portals: ${this._portalTriggersThisSession}`,
      `Spatial hash: ${this._spatialHashAvgEntitiesPerCell.toFixed(1)} avg/cell`,
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y + 16 + i * 14);
    });
  }

  /**
   * @private
   * @description Renders the Asset tracking section.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {number} w - Section width.
   */
  _renderAssetsSection(ctx, x, y, w) {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 11px monospace';
    ctx.fillText('ASSETS', x, y);

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px monospace';
    const lines = [
      `Sprites loaded: ${this._loadedSpriteCount}`,
      `Atlas fill: ${this._textureAtlasFillPercent.toFixed(1)}%`,
      `Cache hit: ${(this._cacheHitRatio * 100).toFixed(1)}%`,
      `Texture mem: ${this._totalTextureMemoryMB.toFixed(1)} MB`,
      `Pending loads: ${this._pendingLoadsCount}`,
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y + 16 + i * 14);
    });
  }

  /**
   * @private
   * @description Renders the Game State tree view section.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {number} w - Section width.
   */
  _renderGameStateSection(ctx, x, y, w) {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 11px monospace';
    ctx.fillText('GAME STATE', x, y);

    const state = this._captureGameState();
    ctx.font = '10px monospace';

    let lineY = y + 16;
    const lineHeight = 13;

    // Render state tree recursively
    this._renderTree(ctx, x, lineY, w, state, '', 0, lineHeight);
  }

  /**
   * @private
   * @description Recursively renders an object as a collapsible tree.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} x - X position.
   * @param {number} y - Starting Y position.
   * @param {number} w - Available width.
   * @param {Object} obj - Object to render.
   * @param {string} path - Current tree path for expansion tracking.
   * @param {number} depth - Current recursion depth.
   * @param {number} lineHeight - Height of each line.
   * @returns {number} Updated Y position after rendering.
   */
  _renderTree(ctx, x, y, w, obj, path, depth, lineHeight) {
    if (!obj || typeof obj !== 'object') return y;

    const indent = depth * 12;
    const maxDepth = 4;

    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      const isExpanded = this._expandedTreePaths.includes(fullPath);
      const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);

      // Draw toggle arrow for objects
      if (isObject && depth < maxDepth) {
        ctx.fillStyle = COLORS.accent;
        ctx.fillText(isExpanded ? 'v' : '>', x + indent, y);
      }

      // Key
      ctx.fillStyle = COLORS.treeKey;
      const keyX = x + indent + (isObject ? 12 : 0);
      ctx.fillText(`${key}:`, keyX, y);

      // Value
      if (isObject && depth < maxDepth) {
        if (isExpanded) {
          y += lineHeight;
          y = this._renderTree(ctx, x, y, w, value, fullPath, depth + 1, lineHeight);
        }
      } else {
        const valueStr = this._formatValue(value);
        const valueColor = typeof value === 'string' ? COLORS.treeString : COLORS.treeValue;
        ctx.fillStyle = valueColor;
        ctx.fillText(valueStr, keyX + ctx.measureText(`${key}:`).width + 4, y);
      }

      y += lineHeight;
      if (y > this._height - 40) break;
    }

    return y;
  }

  /**
   * @private
   * @description Formats a value for display in the tree view.
   * @param {*} value - Value to format.
   * @returns {string} Formatted string.
   */
  _formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return value.length > 20 ? `"${value.slice(0, 18)}.."` : `"${value}"`;
    if (Array.isArray(value)) return `[${value.length}]`;
    return '{}';
  }

  /**
   * @private
   * @description Renders the Log Viewer section.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {number} w - Section width.
   * @param {number} h - Section height.
   */
  _renderLogViewer(ctx, x, y, w, h) {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`LOG VIEWER (${this._capturedLogs.length})`, x, y);

    // Filter indicator
    if (this._logFilter) {
      ctx.fillStyle = COLORS.accent;
      ctx.font = '9px monospace';
      ctx.fillText(`[filter: ${this._logFilter}]`, x + 140, y);
    }

    // Log background
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x, y + 12, w, h - 14);

    // Visible log entries
    ctx.font = '9px monospace';
    const lineHeight = 11;
    const visibleLines = Math.floor((h - 18) / lineHeight);
    const filtered = this._getFilteredLogs();
    const startIdx = Math.max(0, filtered.length - visibleLines - Math.floor(this._logScrollY / lineHeight));

    let lineY = y + 22;
    for (let i = startIdx; i < Math.min(filtered.length, startIdx + visibleLines); i++) {
      const entry = filtered[i];
      ctx.fillStyle = this._getLogColor(entry.level);

      const timeStr = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false });
      const text = `[${timeStr}] ${entry.message.slice(0, Math.floor(w / 6))}`;
      ctx.fillText(text, x + 4, lineY);
      lineY += lineHeight;
    }
  }

  /**
   * @private
   * @description Returns filtered log entries based on current filter string.
   * @returns {Array<Object>} Filtered log entries.
   */
  _getFilteredLogs() {
    if (!this._logFilter) return this._capturedLogs;
    const f = this._logFilter.toLowerCase();
    return this._capturedLogs.filter(e =>
      e.message.toLowerCase().includes(f) || e.level.toLowerCase().includes(f)
    );
  }

  /**
   * @private
   * @description Returns the display color for a log level.
   * @param {string} level - Log level string.
   * @returns {string} CSS color string.
   */
  _getLogColor(level) {
    switch (level) {
      case 'error': return COLORS.error;
      case 'warn': return COLORS.warning;
      default: return COLORS.text;
    }
  }

  /**
   * @private
   * @description Renders the Errors section.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {number} w - Section width.
   */
  _renderErrorsSection(ctx, x, y, w) {
    ctx.fillStyle = COLORS.error;
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`ERRORS  Total: ${this._errorCount}`, x, y);

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '10px monospace';
    ctx.fillText(`Collision: ${this._errorBreakdown.collision}  Network: ${this._errorBreakdown.network}  Render: ${this._errorBreakdown.render}`, x, y + 16);
  }

  /**
   * @private
   * @description Renders the Seasonal section.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {number} w - Section width.
   */
  _renderSeasonalSection(ctx, x, y, w) {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 11px monospace';
    ctx.fillText('SEASONAL', x, y);

    ctx.font = '10px monospace';
    if (this._seasonalData) {
      const s = this._seasonalData;
      ctx.fillStyle = COLORS.success;
      ctx.fillText(`Active: ${s.name}`, x, y + 16);
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(`Progress: ${(s.progress * 100).toFixed(0)}%`, x, y + 30);
      ctx.fillText(`Hourly Gold: ${s.hourlyGold}${s.isBoosted ? ' (BOOSTED)' : ''}`, x, y + 44);
    } else {
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText('No active season', x, y + 16);
    }
  }

  /**
   * @private
   * @description Renders a line graph with auto-scaled Y-axis.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {number} w - Graph width.
   * @param {number} h - Graph height.
   * @param {Array<number>} data - Data array to graph.
   * @param {number} yMin - Minimum Y value (or 0 for auto).
   * @param {number} yMax - Maximum Y value (or 0 for auto).
   * @param {string} unit - Unit label for Y-axis.
   * @param {string} lineColor - Color for the line.
   * @param {string} fillColor - Color for the area fill.
   */
  _renderLineGraph(ctx, x, y, w, h, data, yMin, yMax, unit, lineColor, fillColor) {
    // Determine Y range
    const dataMin = Math.min(...data);
    const dataMax = Math.max(...data);
    const min = yMin !== undefined ? yMin : dataMin;
    const max = (yMax !== undefined && yMax > 0) ? yMax : (dataMax > min ? dataMax : min + 1);
    const range = max - min;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x, y, w, h);

    // Grid lines
    ctx.strokeStyle = COLORS.graphGrid;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 3; i++) {
      const gy = y + (h * i) / 3;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();

      // Y-axis labels
      const val = max - (range * i) / 3;
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '8px monospace';
      ctx.fillText(`${Math.round(val)}${unit}`, x + 2, gy + 9);
    }

    if (data.length < 2) return;

    // Build path
    const stepX = w / (GRAPH_HISTORY_SIZE - 1);

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const px = x + (i * stepX);
      const normalized = range > 0 ? (data[i] - min) / range : 0.5;
      const py = y + h - (normalized * h);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    // Fill area
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const px = x + (i * stepX);
      const normalized = range > 0 ? (data[i] - min) / range : 0.5;
      const py = y + h - (normalized * h);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Current value label
    const current = data[data.length - 1] || 0;
    ctx.fillStyle = lineColor;
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`${Math.round(current)}`, x + w - 20, y + 10);
  }

  /**
   * @private
   * @description Renders the command input bar at the bottom of the panel.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} y - Y position.
   * @param {number} w - Panel width.
   */
  _renderCommandBar(ctx, y, w) {
    // Background
    ctx.fillStyle = COLORS.header;
    ctx.fillRect(1, y - 2, w - 2, 28);

    // Prompt
    ctx.fillStyle = COLORS.accent;
    ctx.font = '12px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('>', 8, y + 10);

    // Input text
    ctx.fillStyle = COLORS.textHighlight;
    const inputX = 22;
    ctx.fillText(this._commandBuffer + '_', inputX, y + 10);

    // Command output
    if (this._lastCommandOutput) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '9px monospace';
      const outputX = inputX + ctx.measureText(this._commandBuffer).width + 20;
      if (outputX < w - 20) {
        ctx.fillText(this._lastCommandOutput, outputX, y + 10);
      }
    }
  }

  /**
   * @private
   * @description Renders the error count badge.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} w - Panel width.
   */
  _renderErrorBadge(ctx, w) {
    const badgeW = 24;
    const badgeH = 18;
    const badgeX = w - badgeW - 4;
    const badgeY = HEADER_HEIGHT + 6;

    ctx.fillStyle = COLORS.error;
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this._errorCount > 99 ? '99+' : this._errorCount.toString(), badgeX + badgeW / 2, badgeY + badgeH / 2);
    ctx.textAlign = 'left';
  }

  // ============================================================
  // PRIVATE METHODS - Command System
  // ============================================================

  /**
   * @private
   * @description Builds the command handler registry.
   * @returns {Object} Map of command name -> handler function.
   */
  _buildCommandHandlers() {
    return {
      fps: (args) => this._cmdFps(args),
      noclip: (args) => this._cmdNoclip(args),
      spawn: (args) => this._cmdSpawn(args),
      gold: (args) => this._cmdGold(args),
      season: (args) => this._cmdSeason(args),
      net: (args) => this._cmdNet(args),
      cam: (args) => this._cmdCam(args),
      help: () => this._cmdHelp(),
    };
  }

  /**
   * @private
   * @description Processes a command string entered into the console.
   * @param {string} cmd - The command string (without leading slash).
   */
  _processCommand(cmd) {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Add to history
    this._commandHistory.push(trimmed);
    if (this._commandHistory.length > 50) this._commandHistory.shift();
    this._commandHistoryIndex = this._commandHistory.length;

    const handler = this._commands[command];
    if (handler) {
      try {
        const result = handler(args);
        this._lastCommandOutput = result || 'OK';
      } catch (err) {
        this._lastCommandOutput = `Error: ${err.message}`;
      }
    } else {
      this._lastCommandOutput = `Unknown command: /${command}. Type /help for list.`;
    }
  }

  /** @private @description /fps command - toggles FPS cap */
  _cmdFps(args) {
    const game = this._game;
    if (!game || !game.settings) return 'No game settings available.';

    if (args.length > 0) {
      const cap = parseInt(args[0], 10);
      if (isNaN(cap) || cap < 1) return 'Usage: /fps [cap|off]';
      game.settings.fpsCap = cap;
      return `FPS cap set to ${cap}`;
    }

    // Toggle
    if (game.settings.fpsCap === 0) {
      game.settings.fpsCap = 60;
      return 'FPS cap ON (60)';
    }
    game.settings.fpsCap = 0;
    return 'FPS cap OFF (uncapped)';
  }

  /** @private @description /noclip command - toggles collision */
  _cmdNoclip() {
    const game = this._game;
    if (!game || !game.player) return 'Player not available.';

    game.player.noclip = !game.player.noclip;
    return `Noclip ${game.player.noclip ? 'ENABLED' : 'DISABLED'}`;
  }

  /** @private @description /spawn command - spawns entities */
  _cmdSpawn(args) {
    const game = this._game;
    if (!game || !game.eventBus) return 'Event bus not available.';

    const entityType = (args[0] || 'chest').toLowerCase();
    game.eventBus.emit('debug:spawn', { type: entityType });
    return `Spawn request sent: ${entityType}`;
  }

  /** @private @description /gold command - adds gold */
  _cmdGold(args) {
    const game = this._game;
    if (!game || !game.currency) return 'Currency system not available.';

    const amount = parseInt(args[0], 10);
    if (isNaN(amount)) return 'Usage: /gold <amount>';

    if (typeof game.currency.addGold === 'function') {
      game.currency.addGold(amount, 'Debug console');
    } else {
      game.currency.gold = (game.currency.gold || 0) + amount;
    }
    return `Added ${amount} Gold. New total: ${game.currency.gold || 0}`;
  }

  /** @private @description /season command - forces a season */
  _cmdSeason(args) {
    const game = this._game;
    if (!game || !game.seasons) return 'Seasonal content system not available.';

    const seasonName = (args[0] || '').toLowerCase();
    if (!seasonName || seasonName === 'clear' || seasonName === 'none') {
      game.seasons.forceSeason(null);
      return 'Season override cleared.';
    }

    const validSeasons = ['christmas', 'halloween', 'easter', 'tribal'];
    if (!validSeasons.includes(seasonName)) {
      return `Invalid season. Valid: ${validSeasons.join(', ')}`;
    }

    game.seasons.forceSeason(seasonName);
    return `Season forced to: ${seasonName}`;
  }

  /** @private @description /net command - simulates network conditions */
  _cmdNet(args) {
    const game = this._game;
    if (!game || !game.network) return 'Network system not available.';

    const subCmd = (args[0] || '').toLowerCase();
    const value = parseInt(args[1], 10);

    if (subCmd === 'lag' && !isNaN(value)) {
      game.network.simulatedLatency = value;
      return `Simulated latency: ${value}ms`;
    }
    if (subCmd === 'lag' && (args[1] === 'off' || args[1] === '0')) {
      game.network.simulatedLatency = 0;
      return 'Simulated latency OFF';
    }
    if (subCmd === 'drop' && !isNaN(value)) {
      game.network.simulatedPacketLoss = value;
      return `Simulated packet loss: ${value}%`;
    }
    return 'Usage: /net lag <ms> | /net drop <%>';
  }

  /** @private @description /cam command - camera follow */
  _cmdCam(args) {
    const game = this._game;
    if (!game || !game.camera) return 'Camera system not available.';

    const target = args[0];
    if (!target || target === 'reset' || target === 'player') {
      game.camera.followTarget = game.player;
      return 'Camera following player.';
    }

    // Follow specific player by ID
    if (game.social && game.social.players) {
      const targetPlayer = game.social.players[target];
      if (targetPlayer) {
        game.camera.followTarget = targetPlayer;
        return `Camera following player: ${target}`;
      }
    }
    return `Player not found: ${target}`;
  }

  /** @private @description /help command - lists all commands */
  _cmdHelp() {
    return 'Commands: /fps [N|off], /noclip, /spawn [chest], /gold N, /season [name|clear], /net lag N, /cam follow [id], /help';
  }

  // ============================================================
  // PRIVATE METHODS - Input Handling
  // ============================================================

  /**
   * @private
   * @description Sets up keyboard and mouse input listeners.
   */
  _setupInput() {
    document.addEventListener('keydown', this._boundKeyDown);
  }

  /**
   * @private
   * @description Handles keyboard input for the debug console.
   * @param {KeyboardEvent} e - Keyboard event.
   */
  _onKeyDown(e) {
    // Toggle console
    if (e.key === CONSOLE_TOGGLE_KEY || e.key === CONSOLE_TOGGLE_KEY_ALT) {
      e.preventDefault();
      this.toggle();
      return;
    }

    if (!this._visible) return;

    // Command input handling
    if (e.key === 'Enter') {
      this._processCommand(this._commandBuffer);
      this._commandBuffer = '';
      return;
    }

    if (e.key === 'Backspace') {
      this._commandBuffer = this._commandBuffer.slice(0, -1);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this._commandHistoryIndex > 0) {
        this._commandHistoryIndex--;
        this._commandBuffer = this._commandHistory[this._commandHistoryIndex] || '';
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this._commandHistoryIndex < this._commandHistory.length - 1) {
        this._commandHistoryIndex++;
        this._commandBuffer = this._commandHistory[this._commandHistoryIndex] || '';
      } else {
        this._commandHistoryIndex = this._commandHistory.length;
        this._commandBuffer = '';
      }
      return;
    }

    if (e.key === 'Escape') {
      this.hide();
      return;
    }

    // Printable characters
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this._commandBuffer += e.key;
    }
  }

  /**
   * @private
   * @description Handles mouse down for dragging and clicking.
   * @param {MouseEvent} e - Mouse event.
   */
  _onMouseDown(e) {
    if (!this._visible || !this._consoleCanvas) return;

    const rect = this._consoleCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Close button
    if (my >= 6 && my <= HEADER_HEIGHT - 6 && mx >= this._width - 28 && mx <= this._width - 8) {
      this.hide();
      return;
    }

    // Header drag
    if (my >= 0 && my <= HEADER_HEIGHT) {
      this._dragging = true;
      this._dragOffsetX = e.clientX - rect.left;
      this._dragOffsetY = e.clientY - rect.top;
      return;
    }

    // Category checkboxes
    this._handleCategoryClick(mx, my);

    // Tree toggle clicks
    this._handleTreeClick(mx, my);
  }

  /**
   * @private
   * @description Handles mouse move for dragging.
   * @param {MouseEvent} e - Mouse event.
   */
  _onMouseMove(e) {
    if (!this._dragging) return;

    this._x = e.clientX - this._dragOffsetX;
    this._y = e.clientY - this._dragOffsetY;

    // Clamp to window
    this._x = Math.max(0, Math.min(window.innerWidth - this._width, this._x));
    this._y = Math.max(0, Math.min(window.innerHeight - this._height, this._y));

    if (this._consoleCanvas) {
      this._consoleCanvas.style.left = `${this._x}px`;
      this._consoleCanvas.style.top = `${this._y}px`;
    }
  }

  /**
   * @private
   * @description Handles mouse up to end dragging.
   */
  _onMouseUp() {
    if (this._dragging) {
      this._dragging = false;
      this._savePosition();
    }
  }

  /**
   * @private
   * @description Handles clicks on category checkboxes.
   * @param {number} mx - Mouse X relative to panel.
   * @param {number} my - Mouse Y relative to panel.
   */
  _handleCategoryClick(mx, my) {
    const contentTop = HEADER_HEIGHT + 4;
    const boxSize = 10;
    const gap = 6;
    const labelWidth = 84;
    let x = 8;
    let y = contentTop;

    for (let i = 0; i < CATEGORY_COUNT; i++) {
      if (mx >= x && mx <= x + boxSize + labelWidth && my >= y + 2 && my <= y + 2 + boxSize + 2) {
        this._categoryEnabled[i] = !this._categoryEnabled[i];
        return;
      }
      x += boxSize + labelWidth + gap;
      if (x + labelWidth > this._width - 20) {
        x = 8;
        y += 18;
      }
    }
  }

  /**
   * @private
   * @description Handles clicks on tree expand/collapse toggles.
   * @param {number} mx - Mouse X relative to panel.
   * @param {number} my - Mouse Y relative to panel.
   */
  _handleTreeClick(mx, my) {
    if (!this._categoryEnabled[4]) return; // Game State category
    // Tree toggle clicking is handled by checking against rendered positions
    // For simplicity, this is a basic implementation
    const rightColX = 10 + Math.floor((this._width - 20) / 2) + 10;
    const state = this._captureGameState();
    this._toggleTreeAtPosition(state, '', 0, mx, my, rightColX, HEADER_HEIGHT + 20);
  }

  /**
   * @private
   * @description Recursively checks if a click position matches a tree node.
   */
  _toggleTreeAtPosition(obj, path, depth, mx, my, baseX, baseY) {
    if (!obj || typeof obj !== 'object') return baseY;

    let y = baseY;
    const lineHeight = 13;
    const indent = depth * 12;

    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
      const toggleX = baseX + indent;

      if (isObject && depth < 4) {
        if (mx >= toggleX && mx <= toggleX + 10 && my >= y - 6 && my <= y + 6) {
          // Toggle this path
          const idx = this._expandedTreePaths.indexOf(fullPath);
          if (idx >= 0) {
            this._expandedTreePaths.splice(idx, 1);
          } else {
            this._expandedTreePaths.push(fullPath);
          }
          return y;
        }

        y += lineHeight;
        if (this._expandedTreePaths.includes(fullPath)) {
          y = this._toggleTreeAtPosition(value, fullPath, depth + 1, mx, my, baseX, y);
        }
      } else {
        y += lineHeight;
      }

      if (y > this._height - 40) break;
    }
    return y;
  }

  // ============================================================
  // PRIVATE METHODS - Console Message Capture
  // ============================================================

  /**
   * @private
   * @description Sets up interception of console.log/warn/error calls.
   */
  _setupConsoleCapture() {
    this._originalLog = console.log;
    this._originalWarn = console.warn;
    this._originalError = console.error;

    console.log = (...args) => {
      this._originalLog.apply(console, args);
      this._captureLogEntry('log', args);
    };
    console.warn = (...args) => {
      this._originalWarn.apply(console, args);
      this._captureLogEntry('warn', args);
    };
    console.error = (...args) => {
      this._originalError.apply(console, args);
      this._captureLogEntry('error', args);
    };
  }

  /**
   * @private
   * @description Restores original console functions.
   */
  _restoreConsole() {
    if (this._originalLog) console.log = this._originalLog;
    if (this._originalWarn) console.warn = this._originalWarn;
    if (this._originalError) console.error = this._originalError;
  }

  /**
   * @private
   * @description Captures a console log entry.
   * @param {string} level - Log level (log/warn/error).
   * @param {Array} args - Original console arguments.
   */
  _captureLogEntry(level, args) {
    const message = args.map(a => {
      if (typeof a === 'object') {
        try { return JSON.stringify(a).slice(0, 200); } catch { return '[Object]'; }
      }
      return String(a).slice(0, 200);
    }).join(' ');

    this._capturedLogs.push({ level, message, timestamp: Date.now() });

    if (this._capturedLogs.length > LOG_HISTORY_SIZE) {
      this._capturedLogs.shift();
    }
  }

  /** @private @description Handler for console.log */
  _onConsoleLog(...args) { this._captureLogEntry('log', args); }

  /** @private @description Handler for console.warn */
  _onConsoleWarn(...args) { this._captureLogEntry('warn', args); }

  /** @private @description Handler for console.error */
  _onConsoleError(...args) { this._captureLogEntry('error', args); }

  // ============================================================
  // PRIVATE METHODS - Error Capture
  // ============================================================

  /**
   * @private
   * @description Sets up window error event capture.
   */
  _setupErrorCapture() {
    window.addEventListener('error', this._boundWindowError);
  }

  /**
   * @private
   * @description Handles global window errors.
   * @param {ErrorEvent} e - Error event.
   */
  _onWindowError(e) {
    this._errorCount++;
    this._errorBreakdown.other++;
    this._captureLogEntry('error', [`[Window Error] ${e.message} at ${e.filename}:${e.lineno}`]);
  }

  // ============================================================
  // PRIVATE METHODS - DOM Setup
  // ============================================================

  /**
   * @private
   * @description Creates the debug console canvas element and attaches it to the DOM.
   */
  _setupDOM() {
    // Remove existing if any
    if (this._consoleCanvas) {
      this._consoleCanvas.remove();
    }

    this._consoleCanvas = document.createElement('canvas');
    this._consoleCanvas.width = this._width;
    this._consoleCanvas.height = this._height;
    this._consoleCanvas.style.cssText = `
      position: fixed;
      left: ${this._x}px;
      top: ${this._y}px;
      z-index: 99999;
      display: none;
      cursor: default;
      user-select: none;
      -webkit-user-select: none;
    `;

    this._ctx = this._consoleCanvas.getContext('2d');
    document.body.appendChild(this._consoleCanvas);

    // Mouse handlers
    this._consoleCanvas.addEventListener('mousedown', this._boundMouseDown);
    document.addEventListener('mousemove', this._boundMouseMove);
    document.addEventListener('mouseup', this._boundMouseUp);
  }

  /**
   * @private
   * @description Removes the debug console canvas from the DOM.
   */
  _teardownDOM() {
    if (this._consoleCanvas) {
      this._consoleCanvas.removeEventListener('mousedown', this._boundMouseDown);
      this._consoleCanvas.remove();
      this._consoleCanvas = null;
    }
    document.removeEventListener('mousemove', this._boundMouseMove);
    document.removeEventListener('mouseup', this._boundMouseUp);
  }

  // ============================================================
  // PRIVATE METHODS - Position Persistence
  // ============================================================

  /**
   * @private
   * @description Saves console position to localStorage.
   */
  _savePosition() {
    try {
      localStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify({ x: this._x, y: this._y }));
    } catch (err) {
      // Silently fail
    }
  }

  /**
   * @private
   * @description Loads console position from localStorage.
   */
  _loadPosition() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_POSITION);
      if (raw) {
        const pos = JSON.parse(raw);
        this._x = pos.x || 20;
        this._y = pos.y || 20;
      }
    } catch (err) {
      // Use defaults
    }
  }
}

// ============================================================
// EXPORT
// ============================================================

export default DebugConsole;
