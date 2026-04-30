/**
 * Starlight Inn v5.0 -- Main Entry Point
 * Premium polished cozy-core social virtual world web game
 *
 * Wires all engine, world, avatar, social, economy, minigame,
 * event, safety, audio, atmosphere, network, and isometric modules together.
 *
 * Features isometric rendering (v5.0), procedural area backgrounds, living avatars,
 * immersive audio, social atmosphere effects, scene transitions, and premium presentation.
 *
 * Isometric engine replaces the rendering pipeline -- all gameplay systems remain intact.
 *
 * @module main
 * @version 5.0.0
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
import DebugConsole from './engine/DebugConsole.js';

// ============================================================
// v4.0 Presentation Polish
// ============================================================

import LoadingScreen from './engine/LoadingScreen.js';
import SceneTransitions from './engine/SceneTransitions.js';
import ResponsiveLayout from './engine/ResponsiveLayout.js';
import TutorialOverlay from './engine/TutorialOverlay.js';
import PerformanceHUD from './engine/PerformanceHUD.js';

// ============================================================
// v5.0 Isometric Engine
// ============================================================

import { IsoMath } from './iso/IsoMath.js';
import { IsoRenderer } from './iso/IsoRenderer.js';
import { IsoCamera } from './iso/IsoCamera.js';
import { IsoDepthSorter } from './iso/IsoDepthSorter.js';
import { IsoTileset } from './iso/IsoTileset.js';
import { IsoFurniture } from './iso/IsoFurniture.js';
import { IsoAssetLoader } from './iso/IsoAssetLoader.js';
import { IsoAreaBackgrounds } from './iso/IsoAreaBackgrounds.js';
import { IsoAvatarRenderer } from './iso/IsoAvatarRenderer.js';
import { IsoWalkCycle } from './iso/IsoWalkCycle.js';
import { IsoIdleAnimation } from './iso/IsoIdleAnimation.js';

// ============================================================
// World Systems
// ============================================================

import { AreaManager } from './world/AreaManager.js';
import { NPCManager } from './world/NPC.js';
import GridPathfinding from './world/GridPathfinding.js';
import CollisionSystem from './world/CollisionSystem.js';
import SeasonalContent from './world/SeasonalContent.js';
import { IslandEditor } from './world/IslandEditor.js';
import { IslandEditorUI } from './world/IslandEditorUI.js';

// ============================================================
// v4.0 Area Visuals & Atmosphere
// ============================================================

import AreaBackgrounds from './world/AreaBackgrounds.js';
import ParallaxSystem from './world/ParallaxSystem.js';
import PropSystem from './world/PropSystem.js';
import DepthSorter from './world/DepthSorter.js';
import AtmosphereEngine from './world/AtmosphereEngine.js';

// ============================================================
// Avatar Systems
// ============================================================

import { Avatar } from './avatar/Avatar.js';
import { Customizer } from './avatar/Customizer.js';
import { Gestures } from './avatar/Gestures.js';
import { Presets } from './avatar/Presets.js';

// ============================================================
// v4.0 Living Avatar Animation
// ============================================================

import WalkCycle from './avatar/WalkCycle.js';
import IdleAnimation from './avatar/IdleAnimation.js';
import EmotionSystem from './avatar/EmotionSystem.js';
import AvatarEntryExit from './avatar/AvatarEntryExit.js';
import CharacterPreview from './avatar/CharacterPreview.js';

// ============================================================
// Social Systems
// ============================================================

import { Chat } from './social/Chat.js';
import { RadialMenu } from './social/RadialMenu.js';
import { Friends } from './social/Friends.js';
import { TradeWindow } from './social/Trade.js';

// ============================================================
// v4.0 Social Atmosphere
// ============================================================

import ChatBubbles from './social/ChatBubbles.js';
import Nameplates from './social/Nameplates.js';
import SocialAnimations from './social/SocialAnimations.js';
import PresenceIndicators from './social/PresenceIndicators.js';
import WelcomeFlow from './social/WelcomeFlow.js';

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
import AIModeration from './safety/AIModeration.js';

// ============================================================
// Game Feel Mechanics
// ============================================================

import { FartMechanic } from './FartMechanic.js';
import { UppercutEjection } from './UppercutEjection.js';
import { ScreenEffects } from './ScreenEffects.js';

// ============================================================
// v4.0 Audio Systems
// ============================================================

import SoundBank from './audio/SoundBank.js';
import AmbientAudio from './audio/AmbientAudio.js';
import FootstepSystem from './audio/FootstepSystem.js';
import UISounds from './audio/UISounds.js';
import AudioMixer from './audio/AudioMixer.js';

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
 * Wire engine core modules.
 * In v5.0, the isometric renderer and camera are initialized alongside
 * the legacy renderer which continues to handle UI overlay rendering.
 * @param {Game} game
 */
function wireEngineModules(game) {
  game.loadingScreen = new LoadingScreen();
  game.loadingScreen.show();
  game.loadingScreen.setStage('Loading engine...');
  game.loadingScreen.setProgress(5);

  // Legacy renderer retained for UI overlays, landing, char select, HUD
  game.renderer = new Renderer(game);
  // Legacy camera retained for fallback / non-iso screens
  game.camera = new Camera(game);

  game.input = new Input(game);
  game.audio = new Audio();
  game.assets = new Assets();
  game.debugConsole = new DebugConsole(game);
  game.sceneTransitions = new SceneTransitions(game);
  game.responsiveLayout = new ResponsiveLayout(game);
  game.tutorialOverlay = new TutorialOverlay(game);
  game.performanceHUD = new PerformanceHUD(game);
}

/**
 * Wire v5.0 isometric asset modules.
 * Initializes the isometric tileset, furniture catalog, and asset loader
 * that the isometric renderer depends on.
 * @param {Game} game
 */
function wireIsoAssets(game) {
  game.loadingScreen.setStage('Loading isometric assets...');
  game.loadingScreen.setProgress(12);

  game.isoTileset = new IsoTileset(game);
  game.isoFurniture = new IsoFurniture(game);
  game.isoAssetLoader = new IsoAssetLoader(game);
}

/**
 * Wire v5.0 isometric engine modules.
 * Creates the isometric rendering pipeline: math, camera, depth sorter,
 * and renderer. These replace the legacy rendering pipeline for the
 * main game world view.
 * @param {Game} game
 */
function wireIsoEngineModules(game) {
  game.loadingScreen.setStage('Initializing isometric engine...');
  game.loadingScreen.setProgress(15);

  // Isometric math foundation
  game.isoMath = new IsoMath({ tileW: 64, tileH: 32, tileD: 16 });

  // Isometric camera (replaces legacy camera for world view)
  game.isoCamera = new IsoCamera(game, game.isoMath);

  // Depth sorting for proper isometric layering
  game.isoDepthSorter = new IsoDepthSorter(game.isoMath);

  // Area backgrounds with isometric layouts (14 areas)
  game.isoAreaBackgrounds = new IsoAreaBackgrounds(game);

  // Isometric rendering engine (replaces legacy renderer for world)
  game.isoRenderer = new IsoRenderer(
    game,
    game.isoMath,
    game.isoCamera,
    game.isoDepthSorter,
    game.isoTileset,
    game.isoFurniture,
    game.isoAssetLoader,
    game.isoAreaBackgrounds
  );
}

/**
 * Wire world systems.
 * In v5.0, area background loading goes through IsoAreaBackgrounds
 * but AreaManager is still initialized for gameplay logic.
 * @param {Game} game
 */
function wireWorldModules(game) {
  game.loadingScreen.setStage('Building world...');
  game.loadingScreen.setProgress(20);

  game.areaManager = new AreaManager(game);
  game.npcManager = new NPCManager(game);
  game.pathfinding = new GridPathfinding(game);
  game.collision = new CollisionSystem(game);
  game.seasonal = new SeasonalContent(game);
  game.islandEditor = new IslandEditor(game);
  game.islandEditorUI = new IslandEditorUI(game);

  // v4.0 systems kept alongside isometric
  game.areaBackgrounds = new AreaBackgrounds(game);
  game.parallax = new ParallaxSystem(game);
  game.propSystem = new PropSystem(game);
  game.depthSorter = new DepthSorter(game);
  game.atmosphere = new AtmosphereEngine(game);

  // v5.0: Load initial area layout into isometric backgrounds
  const initialArea = game.state.area || 'lobby';
  game.isoAreaBackgrounds.loadArea(initialArea);
}

/**
 * Wire legacy avatar modules.
 * @param {Game} game
 */
function wireAvatarModules(game) {
  game.loadingScreen.setStage('Creating avatars...');
  game.loadingScreen.setProgress(35);

  game.avatar = new Avatar(game);
  game.customizer = new Customizer(game);
  game.gestures = new Gestures(game);
  game.presets = new Presets();
  game.walkCycle = new WalkCycle(game);
  game.idleAnimation = new IdleAnimation(game);
  game.emotionSystem = new EmotionSystem(game);
  game.avatarEntryExit = new AvatarEntryExit(game);
  game.characterPreview = new CharacterPreview(game);
}

/**
 * Wire v5.0 isometric avatar modules.
 * Initializes the isometric avatar renderer, walk cycle, and idle animation.
 * These connect to the existing Avatar system for customization data.
 * @param {Game} game
 */
function wireIsoAvatarModules(game) {
  game.loadingScreen.setStage('Initializing isometric avatars...');
  game.loadingScreen.setProgress(40);

  // Isometric avatar renderer
  game.isoAvatarRenderer = new IsoAvatarRenderer(game, game.isoMath, game.isoAssetLoader);

  // Isometric walk cycle animation
  game.isoWalkCycle = new IsoWalkCycle(game, game.isoAvatarRenderer);

  // Isometric idle animation system
  game.isoIdleAnimation = new IsoIdleAnimation(game, game.isoAvatarRenderer);

  // Connect to existing avatar system
  if (game.avatar) {
    game.avatar.isoRenderer = game.isoAvatarRenderer;
  }
}

function wireSocialModules(game) {
  game.loadingScreen.setStage('Setting up social...');
  game.loadingScreen.setProgress(50);

  game.chat = new Chat(game);
  game.radialMenu = new RadialMenu(game);
  game.friends = new Friends(game);
  game.tradeWindow = new TradeWindow(game);
  game.chatBubbles = new ChatBubbles(game);
  game.nameplates = new Nameplates(game);
  game.socialAnimations = new SocialAnimations(game);
  game.presenceIndicators = new PresenceIndicators(game);
  game.welcomeFlow = new WelcomeFlow(game);
}

function wireEconomyModules(game) {
  game.loadingScreen.setStage('Loading economy...');
  game.loadingScreen.setProgress(60);

  game.currency = new Currency(game);
  game.catalog = new Catalog(game);
  game.inventory = new Inventory(game);
  game.tradeEngine = new TradeEngine(game);
}

function wireMinigameModules(game) {
  game.loadingScreen.setStage('Loading mini-games...');
  game.loadingScreen.setProgress(70);

  game.minigameHub = new MinigameHub(game);
  game.minigameHub.register('starcatcher', StarCatcher, { minPlayers: 1, maxPlayers: 4, description: 'Catch falling stars before they fade!', icon: '\u2B50' });
  game.minigameHub.register('memorymatch', MemoryMatch, { minPlayers: 1, maxPlayers: 2, description: 'Match pairs of starlight cards.', icon: '\u1F0DF' });
  game.minigameHub.register('rhythmdance', RhythmDance, { minPlayers: 1, maxPlayers: 4, description: 'Dance to the rhythm of the cosmos.', icon: '\u1F483' });
  game.minigameHub.register('trivia', Trivia, { minPlayers: 1, maxPlayers: 4, description: 'Test your knowledge of the starlight world.', icon: '\u1F9E0' });
}

function wireEventModules(game) {
  game.loadingScreen.setStage('Loading events...');
  game.loadingScreen.setProgress(75);

  game.chestManager = new ChestManager(game);
  game.powerUps = new PowerUps(game);
  game.eventCalendar = new EventCalendar(game);
}

function wireSafetyModules(game) {
  game.loadingScreen.setStage('Setting up safety...');
  game.loadingScreen.setProgress(80);

  game.filter = new Filter();
  game.rateLimit = new RateLimit();
  game.spamDetector = new SpamDetector();
  game.report = new Report(game);
  game.moderation = new Moderation(game);
  game.childSafety = new ChildSafety(game);
  game.aiModeration = new AIModeration(game);
}

function wireGameFeelModules(game) {
  game.loadingScreen.setStage('Loading interactions...');
  game.loadingScreen.setProgress(85);

  game.fartMechanic = new FartMechanic(game);
  game.uppercutEjection = new UppercutEjection(game);
  game.screenEffects = new ScreenEffects(game);
}

function wireAudioModules(game) {
  game.loadingScreen.setStage('Initializing audio...');
  game.loadingScreen.setProgress(88);

  game.audioMixer = new AudioMixer(game);
  game.soundBank = new SoundBank(game);
  game.ambientAudio = new AmbientAudio(game);
  game.footstepSystem = new FootstepSystem(game);
  game.uiSounds = new UISounds(game);
}

function wireNetworkModule(game) {
  game.loadingScreen.setStage('Connecting...');
  game.loadingScreen.setProgress(95);

  try {
    game.socket = new SocketClient(game);
    game.socket.connect();
  } catch (err) {
    console.log('[Net] Offline mode -- no server connection available');
    game.socket = null;
  }
}

/**
 * v5.0 Isometric-aware game loop render override.
 * When in the game screen, uses IsoRenderer for the isometric world.
 * Legacy renderer handles UI overlays and non-game screens.
 * @param {Game} game
 */
function setupIsoGameLoop(game) {
  // Store reference to original render
  const originalRender = game.render.bind(game);

  /**
   * v5.0 render function. Routes to isometric renderer for the game world,
   * legacy renderer for menus, landing, character select, and overlays.
   */
  game.render = function() {
    if (this.state.screen === 'game') {
      // Isometric world rendering
      if (this.isoRenderer) {
        this.isoRenderer.render();
      }

      // UI overlay (HUD, chat, panels) rendered via legacy renderer
      if (this.renderer) {
        this.renderer.renderHUD(this.ctx);
      }

      // Debug overlay
      if (this.debug) {
        this.renderDebugOverlay();
      }
    } else {
      // Non-game screens use legacy renderer
      if (this.renderer) {
        this.renderer.clear();
        switch (this.state.screen) {
          case 'landing':
            this.renderer.renderLanding();
            break;
          case 'charselect':
            this.renderer.renderCharSelect();
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
      }
    }
  };

  /**
   * v5.0 update function. Extends base update with isometric systems.
   */
  const originalUpdate = game.update.bind(game);
  game.update = function(dt) {
    // Call original update (input, player movement, camera follow, particles, etc.)
    originalUpdate(dt);

    // Update isometric camera (pan/zoom interpolation, shake)
    if (this.isoCamera) {
      this.isoCamera.update(dt);
    }

    // Update isometric walk cycle animation
    if (this.isoWalkCycle && this.state.player) {
      this.isoWalkCycle.update(dt, this.state.player.moving, this.state.player.facing);
    }

    // Update isometric idle animation
    if (this.isoIdleAnimation) {
      this.isoIdleAnimation.update(dt);
    }

    // Update isometric avatar renderer
    if (this.isoAvatarRenderer) {
      this.isoAvatarRenderer.update(dt);
    }

    // Update atmosphere engine
    if (this.atmosphere) {
      this.atmosphere.update(dt);
    }
  };

  /**
   * Override setArea to also update isometric area backgrounds.
   */
  const originalSetArea = game.setArea.bind(game);
  game.setArea = function(areaId) {
    // Update isometric area backgrounds (14 areas available)
    if (this.isoAreaBackgrounds) {
      this.isoAreaBackgrounds.loadArea(areaId);
    }

    // Invalidate isometric renderer cache on area change
    if (this.isoRenderer) {
      this.isoRenderer.invalidateCache();
    }

    // Call original for area manager, audio, etc.
    originalSetArea(areaId);
  };
}

/**
 * Initialize all game modules in the correct order.
 * v5.0 adds isometric initialization between engine and world modules.
 */
function initializeGame() {
  // Phase 1: Core engine
  wireEngineModules(game);

  // Phase 2: v5.0 Isometric assets (tileset, furniture, asset loader)
  wireIsoAssets(game);

  // Phase 3: v5.0 Isometric engine (math, camera, depth sorter, renderer)
  wireIsoEngineModules(game);

  // Phase 4: World systems (legacy + isometric area backgrounds)
  wireWorldModules(game);

  // Phase 5: Avatar systems (legacy)
  wireAvatarModules(game);

  // Phase 6: v5.0 Isometric avatar modules
  wireIsoAvatarModules(game);

  // Phase 7: Social, economy, minigames, events, safety, game feel, audio
  wireSocialModules(game);
  wireEconomyModules(game);
  wireMinigameModules(game);
  wireEventModules(game);
  wireSafetyModules(game);
  wireGameFeelModules(game);
  wireAudioModules(game);
  wireNetworkModule(game);

  // Phase 8: v5.0 game loop integration
  setupIsoGameLoop(game);

  // Phase 9: Finalize
  game.loadingScreen.setStage('Entering Starlight Inn...');
  game.loadingScreen.setProgress(100);
  game.init();

  setTimeout(() => {
    game.loadingScreen.hide();
    game.welcomeFlow?.showWelcome();
    if (!game.tutorialOverlay?.isCompleted()) {
      setTimeout(() => game.tutorialOverlay?.startTutorial(), 500);
    }
  }, 600);

  console.log('\u{1F31F} Starlight Inn v5.0 -- All modules wired and initialized (isometric engine active)');
}

// ============================================================
// Global Event Handlers
// ============================================================

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.stop();
    game.audioMixer?.muteAll();
    console.log('[Game] Paused -- tab hidden');
  } else {
    game.start();
    game.audioMixer?.unmuteAll();
    console.log('[Game] Resumed -- tab visible');
  }
});

document.getElementById('game-canvas').addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    // Legacy renderer resize (UI overlay)
    game.renderer?.resize();
    // Isometric renderer resize
    game.isoRenderer?.resize();
    // Both cameras
    game.camera?.updateBounds();
    game.isoCamera?.updateBounds();
    game.debugConsole?.onResize();
    game.responsiveLayout?.onResize();
    game.nameplates?.onResize();
    game.chatBubbles?.onResize();
  }, 150);
});

document.addEventListener('keydown', (event) => {
  const activeTag = document.activeElement?.tagName;
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
    if (event.key === 'Escape') {
      game.chat?.close();
      game.inventory?.close();
      game.catalog?.close();
    }
    return;
  }
  if (event.key === 'Escape') {
    game.chat?.close();
    game.inventory?.close();
    game.catalog?.close();
    game.friends?.close();
    game.tradeWindow?.close();
    game.debugConsole?.hide();
    game.tutorialOverlay?.dismiss();
    return;
  }
  if (event.key === '`' || event.key === '~') {
    game.debugConsole?.toggle();
    game.performanceHUD?.toggle();
    return;
  }
  if (game.welcomeFlow?.isShowing() && event.key !== 'Enter') {
    game.welcomeFlow.dismiss();
    return;
  }
  if (event.key === 'Enter' || event.key === 't' || event.key === 'T') {
    game.chat?.focus();
    return;
  }
  const shortcuts = {
    'f': 'friends', 'F': 'friends',
    'i': 'inventory', 'I': 'inventory',
    'b': 'catalog', 'B': 'catalog',
    'm': 'missions', 'M': 'missions',
    'n': 'notifications', 'N': 'notifications',
    'g': 'minigames', 'G': 'minigames',
    'a': 'areaBrowser', 'A': 'areaBrowser',
    ',': 'settings', '<': 'settings'
  };
  const panel = shortcuts[event.key];
  if (panel && game[panel]) {
    game[panel].toggle();
    game.uiSounds?.playButtonClick();
  }
});

window.addEventListener('online', () => {
  console.log('[Net] Connection restored');
  game.uiSounds?.playNotification('medium');
  if (game.socket && !game.socket.connected) game.socket.connect();
});

window.addEventListener('offline', () => {
  console.log('[Net] Connection lost -- entering offline mode');
  game.uiSounds?.playError();
  game.socket?.disconnect();
});

// ============================================================
// Boot Sequence
// ============================================================

function boot() {
  try {
    initializeGame();

    // Hide loading overlay once game is ready
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }

    // Post-init: set up service worker for offline support (if supported)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => { /* navigator.serviceWorker.register('/sw.js'); */ });
    }
  } catch (error) {
    console.error('[Boot] Fatal initialization error:', error);
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      const text = overlay.querySelector('.loading-text');
      const sub = overlay.querySelector('.loading-subtext');
      if (text) text.textContent = 'Something went wrong \u2728';
      if (sub) sub.textContent = 'Please refresh the page to try again';
      // Hide overlay so user can still interact with landing screen
      overlay.classList.add('hidden');
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { boot(); wireLandingHandlers(); wireCharSelectHandlers(); });
} else {
  boot();
  wireLandingHandlers();
  wireCharSelectHandlers();
}

// ============================================================
// Landing Page & Character Select Handlers
// ============================================================

function wireLandingHandlers() {
  const btnPlay = document.getElementById('btn-play');
  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      console.log('[UI] Enter World clicked');
      btnPlay.style.transform = 'scale(0.95)';
      game.uiSounds?.playButtonClick();
      setTimeout(() => {
        btnPlay.style.transform = '';
        game.setScreen('charselect');
      }, 150);
    });
  }
  const btnSettings = document.getElementById('btn-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      console.log('[UI] Settings clicked');
      game.uiSounds?.playButtonClick();
      const panel = document.getElementById('settings-panel');
      if (panel) panel.classList.add('active');
    });
  }
  const btnAbout = document.getElementById('btn-about');
  if (btnAbout) {
    btnAbout.addEventListener('click', () => {
      game.uiSounds?.playButtonClick();
      alert('Starlight Inn v5.0\nA premium cozy-core social virtual world.\nNow with isometric rendering!\nGather, explore, and play together under the stars. \u{1F31F}');
    });
  }
  const settingsPanel = document.getElementById('settings-panel');
  if (settingsPanel) {
    const closeBtn = settingsPanel.querySelector('.panel-close');
    if (closeBtn) closeBtn.addEventListener('click', () => settingsPanel.classList.remove('active'));
  }
  console.log('[UI] Landing handlers wired');
}

function wireCharSelectHandlers() {
  const btnBack = document.getElementById('btn-back');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      console.log('[UI] Back clicked');
      game.uiSounds?.playButtonClick();
      game.setScreen('landing');
    });
  }
  const btnContinue = document.getElementById('btn-continue');
  if (btnContinue) {
    btnContinue.addEventListener('click', () => {
      console.log('[UI] Continue clicked');
      game.uiSounds?.playButtonClick();
      const nameInput = document.getElementById('char-name-input');
      if (nameInput && nameInput.value.trim()) game.state.player.name = nameInput.value.trim();
      game.setScreen('game');
      game.start();
    });
  }
  const btnRandom = document.getElementById('btn-randomize');
  if (btnRandom && game.customizer) {
    btnRandom.addEventListener('click', () => {
      console.log('[UI] Randomize clicked');
      game.uiSounds?.playButtonClick();
      game.customizer.randomize();
    });
  }
  console.log('[UI] Character select handlers wired');
}

// ============================================================
// Exports
// ============================================================

window.StarlightInn = game;
console.log('\u{1F31F} Starlight Inn v5.0 initialized -- Isometric cozy-core social virtual world');
