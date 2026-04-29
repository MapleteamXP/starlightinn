/**
 * Starlight Inn v3.5 — Main Entry Point
 * AAA-grade cozy-core social virtual world web game
 *
 * Wires all engine, world, avatar, social, economy, minigame,
 * event, safety, and network modules together into a cohesive Game instance.
 *
 * Features WebGL rendering, A* pathfinding, seasonal content,
 * AI moderation, debug console, and island creator.
 *
 * @module main
 * @version 3.5.0
 * @author Starlight Inn Team
 */

// ============================================================
// Engine Core
// ============================================================

import { Game } from './engine/Game.js';
import { Renderer } from './engine/Renderer.js';
import { Camera } from './engine/Camera.js';
import { Input } from './engine/Input.js';
import { Assets } from './engine/Assets.js';
import { Audio } from './engine/Audio.js';
import { DebugConsole } from './engine/DebugConsole.js';

// ============================================================
// World Systems
// ============================================================

import { AreaManager } from './world/AreaManager.js';
import { NPCManager } from './world/NPC.js';
import { GridPathfinding } from './world/GridPathfinding.js';
import { CollisionSystem } from './world/CollisionSystem.js';
import { SeasonalContent } from './world/SeasonalContent.js';
import { IslandEditor } from './world/IslandEditor.js';
import { IslandEditorUI } from './world/IslandEditorUI.js';

// ============================================================
// Avatar Systems
// ============================================================

import { Avatar } from './avatar/Avatar.js';
import { Customizer } from './avatar/Customizer.js';
import { Gestures } from './avatar/Gestures.js';
import { Presets } from './avatar/Presets.js';

// ============================================================
// Social Systems
// ============================================================

import { Chat } from './social/Chat.js';
import { RadialMenu } from './social/RadialMenu.js';
import { Friends } from './social/Friends.js';
import { TradeWindow } from './social/Trade.js';

// ============================================================
// Economy Systems
// ============================================================

import { Currency } from './economy/Currency.js';
import { Catalog } from './economy/Catalog.js';
import { Inventory } from './economy/Inventory.js';
import { TradeEngine } from './economy/TradeEngine.js';

// ============================================================
// Mini-Game Systems
// ============================================================

import { MinigameHub } from './minigames/MinigameHub.js';
import { StarCatcher } from './minigames/StarCatcher.js';
import { MemoryMatch } from './minigames/MemoryMatch.js';
import { RhythmDance } from './minigames/RhythmDance.js';
import { Trivia } from './minigames/Trivia.js';

// ============================================================
// Event Systems
// ============================================================

import { ChestManager } from './events/ChestManager.js';
import { PowerUps } from './events/PowerUps.js';
import { EventCalendar } from './events/EventCalendar.js';

// ============================================================
// Safety & Moderation Systems
// ============================================================

import { Filter } from './safety/Filter.js';
import { RateLimit } from './safety/RateLimit.js';
import { SpamDetector } from './safety/SpamDetector.js';
import { Report } from './safety/Report.js';
import { Moderation } from './safety/Moderation.js';
import { ChildSafety } from './safety/ChildSafety.js';
import { AIModeration } from './safety/AIModeration.js';

// ============================================================
// Game Feel Mechanics
// ============================================================

import { FartMechanic } from './FartMechanic.js';
import { UppercutEjection } from './UppercutEjection.js';
import { ScreenEffects } from './ScreenEffects.js';

// ============================================================
// Network Layer
// ============================================================

import { SocketClient } from './net/SocketClient.js';

// ============================================================
// Module Instantiation & Wiring
// ============================================================

/** @type {Game} The primary game instance */
const game = new Game('game-canvas');

/**
 * Wire all engine subsystems into the game instance.
 * This centralizes module initialization order and dependency injection.
 *
 * @param {Game} game - The game instance to wire modules into
 */
function wireEngineModules(game) {
  // Rendering & display (WebGL with Canvas 2D fallback)
  game.renderer = new Renderer(game);
  game.camera = new Camera(game);

  // Input handling (keyboard, mouse, touch)
  game.input = new Input(game);

  // Audio system (music, SFX, voice)
  game.audio = new Audio();

  // Asset loader (sprites, textures, maps)
  game.assets = new Assets();

  // Debug console overlay (backtick toggle)
  game.debugConsole = new DebugConsole(game);
}

/**
 * Wire world-building modules for areas, NPCs, pathfinding,
 * collision, seasonal content, and island editor.
 *
 * @param {Game} game - The game instance
 */
function wireWorldModules(game) {
  // Area/world management (rooms, loading, transitions)
  game.areaManager = new AreaManager(game);

  // NPC spawning, behavior, and dialog
  game.npcManager = new NPCManager(game);

  // Grid-based A* pathfinding (8-directional, tap-to-move)
  game.pathfinding = new GridPathfinding(game);

  // Collision detection (spatial hash, portals, social zones)
  game.collision = new CollisionSystem(game);

  // Seasonal limited-time content (Christmas, Halloween, Easter, Tribal)
  game.seasonal = new SeasonalContent(game);

  // Island Creator Suite (HSL paint, furniture, grid, undo/redo)
  game.islandEditor = new IslandEditor(game);
  game.islandEditorUI = new IslandEditorUI(game);
}

/**
 * Wire avatar systems for player appearance and expression.
 *
 * @param {Game} game - The game instance
 */
function wireAvatarModules(game) {
  // Player avatar rendering and state
  game.avatar = new Avatar(game);

  // Avatar customization UI (colors, bases)
  game.customizer = new Customizer(game);

  // Gesture/emote system
  game.gestures = new Gestures(game);

  // Preset avatar configurations
  game.presets = new Presets();
}

/**
 * Wire social interaction modules.
 *
 * @param {Game} game - The game instance
 */
function wireSocialModules(game) {
  // Chat system (area, whisper, party, system channels)
  game.chat = new Chat(game);

  // Right-click radial menu on players
  game.radialMenu = new RadialMenu(game);

  // Friend list, requests, status
  game.friends = new Friends(game);

  // Trade window UI
  game.tradeWindow = new TradeWindow(game);
}

/**
 * Wire economy modules for currency, shop, inventory, and trading.
 *
 * @param {Game} game - The game instance
 */
function wireEconomyModules(game) {
  // Currency wallets (silver, gold)
  game.currency = new Currency(game);

  // Shop/catalog browsing and purchasing
  game.catalog = new Catalog(game);

  // Player inventory management
  game.inventory = new Inventory(game);

  // Trade engine (validation, fairness, confirmation)
  game.tradeEngine = new TradeEngine(game);
}

/**
 * Register all available mini-games with the hub.
 *
 * @param {Game} game - The game instance
 */
function wireMinigameModules(game) {
  // Mini-game hub (lobby, matchmaking, scoring)
  game.minigameHub = new MinigameHub(game);

  // Register: Star Catcher (1-4 players)
  game.minigameHub.register('starcatcher', StarCatcher, {
    minPlayers: 1,
    maxPlayers: 4,
    description: 'Catch falling stars before they fade!',
    icon: '⭐'
  });

  // Register: Memory Match (1-2 players)
  game.minigameHub.register('memorymatch', MemoryMatch, {
    minPlayers: 1,
    maxPlayers: 2,
    description: 'Match pairs of starlight cards.',
    icon: '🃏'
  });

  // Register: Rhythm Dance (1-4 players)
  game.minigameHub.register('rhythmdance', RhythmDance, {
    minPlayers: 1,
    maxPlayers: 4,
    description: 'Dance to the rhythm of the cosmos.',
    icon: '💃'
  });

  // Register: Trivia (1-4 players)
  game.minigameHub.register('trivia', Trivia, {
    minPlayers: 1,
    maxPlayers: 4,
    description: 'Test your knowledge of the starlight world.',
    icon: '🧠'
  });
}

/**
 * Wire event and reward systems.
 *
 * @param {Game} game - The game instance
 */
function wireEventModules(game) {
  // Treasure chest spawning and loot
  game.chestManager = new ChestManager(game);

  // Power-up items (speed, invisibility, magnet)
  game.powerUps = new PowerUps(game);

  // Event calendar (holidays, seasonal events)
  game.eventCalendar = new EventCalendar(game);
}

/**
 * Wire safety and moderation systems.
 *
 * @param {Game} game - The game instance
 */
function wireSafetyModules(game) {
  // Chat filter (profanity, PII)
  game.filter = new Filter();

  // Rate limiter (messages, actions)
  game.rateLimit = new RateLimit();

  // Spam detection algorithm
  game.spamDetector = new SpamDetector();

  // Player report system
  game.report = new Report(game);

  // Moderation tools
  game.moderation = new Moderation(game);

  // Child safety mode (restricted chat, safe names)
  game.childSafety = new ChildSafety(game);

  // AI-assisted moderation (sentiment analysis, reputation)
  game.aiModeration = new AIModeration(game);
}

/**
 * Wire game feel mechanics — signature social interactions.
 *
 * @param {Game} game - The game instance
 */
function wireGameFeelModules(game) {
  // Fart mechanic (social emote with particles + audio)
  game.fartMechanic = new FartMechanic(game);

  // Uppercut ejection (physics arc + re-entry portal)
  game.uppercutEjection = new UppercutEjection(game);

  // Screen effects (flash, shake, hitstop, slowMo, floating text)
  game.screenEffects = new ScreenEffects(game);
}

/**
 * Attempt to establish a network connection.
 * Falls back gracefully to offline single-player mode.
 *
 * @param {Game} game - The game instance
 */
function wireNetworkModule(game) {
  try {
    game.socket = new SocketClient(game);
    game.socket.connect();
  } catch (err) {
    console.log('[Net] Offline mode — no server connection available');
    game.socket = null;
  }
}

// ============================================================
// Initialization Orchestration
// ============================================================

/**
 * Bootstrap all game modules in dependency order.
 * Engine -> World -> Avatar -> Social -> Economy -> Minigames -> Events -> Safety -> GameFeel -> Network
 */
function initializeGame() {
  wireEngineModules(game);
  wireWorldModules(game);
  wireAvatarModules(game);
  wireSocialModules(game);
  wireEconomyModules(game);
  wireMinigameModules(game);
  wireEventModules(game);
  wireSafetyModules(game);
  wireGameFeelModules(game);
  wireNetworkModule(game);

  // Kick off game initialization
  game.init();

  console.log('🌟 Starlight Inn v3.5 — All modules wired and initialized');
}

// ============================================================
// Global Event Handlers
// ============================================================

/**
 * Handle page visibility changes to pause/resume the game loop.
 * Saves battery and prevents desync when tab is hidden.
 */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.stop();
    console.log('[Game] Paused — tab hidden');
  } else {
    game.start();
    console.log('[Game] Resumed — tab visible');
  }
});

/**
 * Prevent default context menu on canvas to allow custom right-click radial menu.
 */
document.getElementById('game-canvas').addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

/**
 * Handle window resize to update canvas scaling and UI layout.
 */
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (game.renderer) {
      game.renderer.resize();
    }
    if (game.camera) {
      game.camera.updateBounds();
    }
    if (game.debugConsole) {
      game.debugConsole.onResize();
    }
  }, 150);
});

/**
 * Handle keyboard shortcuts globally (only when not typing in input).
 */
document.addEventListener('keydown', (event) => {
  // Skip if user is typing in an input/textarea
  const activeTag = document.activeElement?.tagName;
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
    // Allow Escape to close panels even while typing
    if (event.key === 'Escape') {
      game.chat?.close();
      game.inventory?.close();
      game.catalog?.close();
    }
    return;
  }

  // Global shortcut: Escape closes all panels
  if (event.key === 'Escape') {
    game.chat?.close();
    game.inventory?.close();
    game.catalog?.close();
    game.friends?.close();
    game.tradeWindow?.close();
    game.debugConsole?.hide();
    return;
  }

  // Debug console toggle: backtick/tilde
  if (event.key === '`' || event.key === '~') {
    game.debugConsole?.toggle();
    return;
  }

  // Chat shortcuts
  if (event.key === 'Enter' || event.key === 't' || event.key === 'T') {
    game.chat?.focus();
    return;
  }

  // Panel shortcuts
  const shortcuts = {
    'f': 'friends',
    'F': 'friends',
    'i': 'inventory',
    'I': 'inventory',
    'b': 'catalog',
    'B': 'catalog',
    'm': 'missions',
    'M': 'missions',
    'n': 'notifications',
    'N': 'notifications',
    'g': 'minigames',
    'G': 'minigames',
    'a': 'areaBrowser',
    'A': 'areaBrowser',
    ',': 'settings',
    '<': 'settings'
  };

  const panel = shortcuts[event.key];
  if (panel && game[panel]) {
    game[panel].toggle();
  }
});

/**
 * Handle online/offline status changes.
 */
window.addEventListener('online', () => {
  console.log('[Net] Connection restored');
  if (game.socket && !game.socket.connected) {
    game.socket.connect();
  }
});

window.addEventListener('offline', () => {
  console.log('[Net] Connection lost — entering offline mode');
  game.socket?.disconnect();
});

// ============================================================
// Boot Sequence
// ============================================================

/**
 * Initialize the game when DOM is ready.
 * Uses requestIdleCallback for non-critical module loading if available.
 */
function boot() {
  try {
    initializeGame();

    // Post-init: set up service worker for offline support (if supported)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        // Service worker registration would go here
        // navigator.serviceWorker.register('/sw.js');
      });
    }
  } catch (error) {
    console.error('[Boot] Fatal initialization error:', error);
    // Display user-friendly error
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      const text = overlay.querySelector('.loading-text');
      const sub = overlay.querySelector('.loading-subtext');
      if (text) text.textContent = 'Something went wrong ✨';
      if (sub) sub.textContent = 'Please refresh the page to try again';
    }
  }
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Export for debugging and external integrations
window.StarlightInn = game;

console.log('🌟 Starlight Inn v3.5 initialized — AAA cozy-core social virtual world');
