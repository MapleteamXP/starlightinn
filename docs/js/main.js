/**
 * Starlight Inn v6.0 -- Main Entry Point
 * Premium polished cozy-core social virtual world web game
 *
 * Wires all engine, world, avatar, social, economy, minigame,
 * event, safety, audio, atmosphere, network, and isometric modules together.
 *
 * Features Habbo-grade isometric asset pipeline (v6.0):
 *   - Procedural pixel-art sprites with palette enforcement
 *   - Sprite-based Y-sort rendering with integer zoom
 *   - Full render orchestration (bg -> floor -> wall -> prop -> entity -> effect)
 *   - Grid-locked Habbo-style tile-by-tile movement
 *   - Lazy chunk loading for large worlds
 *   - 8 curated palettes for consistent visual identity
 *
 * All legacy v5.0 isometric math, areas, furniture, and social/economy/audio
 * systems remain intact and active.
 *
 * @module main
 * @version 6.0.0
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
// v6.0 Habbo-grade Asset Pipeline
// ============================================================

import { SpriteGenerator } from './sprites/SpriteGenerator.js';
import { SpriteSheet } from './sprites/SpriteSheet.js';
import { SpriteCache } from './sprites/SpriteCache.js';
import { PaletteManager } from './sprites/PaletteManager.js';
import { ColorTable } from './sprites/ColorTable.js';
import { PaletteValidator } from './sprites/PaletteValidator.js';
import { IsoTilemap } from './iso/IsoTilemap.js';
import { IsoChunk, ChunkManager } from './iso/IsoChunk.js';
import { IsoGrid } from './iso/IsoGrid.js';
import { IsoMovement } from './iso/IsoMovement.js';
import { YSortRenderer } from './iso/YSortRenderer.js';
import { PixelPerfectScaler } from './iso/PixelPerfectScaler.js';
import { RenderPipeline } from './iso/RenderPipeline.js';

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
 * In v6.0, the pixel-perfect scaler is initialized alongside legacy systems.
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
 * Wire v6.0 Habbo-grade sprite and palette pipeline.
 * Initializes SpriteGenerator, SpriteCache, PaletteManager, ColorTable, PaletteValidator.
 * @param {Game} game
 */
function wireV6SpritePipeline(game) {
  game.loadingScreen.setStage('Initializing v6.0 sprite pipeline...');
  game.loadingScreen.setProgress(14);

  game.paletteManager = new PaletteManager();
  game.spriteCache = new SpriteCache(512);
  game.spriteGenerator = new SpriteGenerator(game.paletteManager);
  game.colorTable = ColorTable;
  game.paletteValidator = PaletteValidator;
}

/**
 * Wire v6.0 Habbo-grade isometric world systems.
 * Initializes IsoTilemap, IsoChunk, IsoGrid, IsoMovement, YSortRenderer,
 * PixelPerfectScaler, and RenderPipeline.
 * @param {Game} game
 */
function wireV6IsoModules(game) {
  game.loadingScreen.setStage('Initializing v6.0 isometric world...');
  game.loadingScreen.setProgress(16);

  // Pixel-perfect integer scaler
  game.pixelPerfectScaler = new PixelPerfectScaler('game-canvas');

  // Isometric tilemap (default 64x64 world)
  game.isoTilemap = new IsoTilemap(64, 64, {
    tileW: game.isoMath.tileW,
    tileH: game.isoMath.tileH,
  });

  // Chunk manager for lazy loading
  game.chunkManager = new ChunkManager(game.isoTilemap, 16);

  // Grid overlay (highlighting, path visualization, interaction)
  game.isoGrid = new IsoGrid(game.isoMath, game.isoTilemap, 'game-canvas');

  // Grid-locked movement system for player
  game.isoMovement = new IsoMovement(game.isoMath, game.isoTilemap, game.state.player || { x: 32, y: 32 });
  game.isoMovement.onArrive((tile) => {
    game.isoGrid.clearPath();
    if (game.footstepSystem) game.footstepSystem.play();
  });
  game.isoMovement.onStep((tile) => {
    game.isoGrid.highlight(tile.x, tile.y);
  });

  // Y-sort renderer replaces IsoRenderer for world rendering in v6.0
  game.ySortRenderer = new YSortRenderer(
    game.isoMath,
    game.isoTilemap,
    game.spriteGenerator,
    game.spriteCache
  );

  // Register player entity in Y-sort renderer
  if (game.state.player) {
    game.ySortRenderer.addEntity(game.state.player);
  }

  // Full render pipeline orchestration
  game.renderPipeline = new RenderPipeline('game-canvas');
  game.renderPipeline.bindYSortRenderer(game.ySortRenderer, 'entity');
  game.renderPipeline.bindTilemapRenderer(game.ySortRenderer, 'floor');

  // Connect grid clicks to movement
  game.isoGrid.onClick((tx, ty, tile) => {
    if (tile && tile.walkable) {
      game.isoMovement.moveTo(tx, ty);
      game.isoGrid.setPath(game.isoTilemap.findPath(
        game.isoMovement.getCurrentTile().x,
        game.isoMovement.getCurrentTile().y,
        tx, ty
      ));
      game.uiSounds?.playButtonClick();
    }
  });
}

/**
 * Wire v5.0 isometric engine modules.
 * Creates the isometric rendering pipeline: math, camera, depth sorter,
 * and renderer. These remain alongside v6.0 systems for compatibility.
 * @param {Game} game
 */
function wireIsoEngineModules(game) {
  game.loadingScreen.setStage('Initializing isometric engine...');
  game.loadingScreen.setProgress(18);

  // Isometric math foundation
  game.isoMath = new IsoMath({ tileW: 64, tileH: 32, tileD: 16 });

  // Isometric camera (replaces legacy camera for world view)
  game.isoCamera = new IsoCamera(game, game.isoMath);

  // Depth sorting for proper isometric layering
  game.isoDepthSorter = new IsoDepthSorter(game.isoMath);

  // Area backgrounds with isometric layouts (14 areas)
  game.isoAreaBackgrounds = new IsoAreaBackgrounds(game);

  // Isometric rendering engine (kept alongside v6.0 YSortRenderer for fallback)
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
 * @param {Game} game
 */
function wireWorldModules(game) {
  game.loadingScreen.setStage('Building world...');
  game.loadingScreen.setProgress(25);

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

  // v6.0: Initialize tilemap from area data if available
  const areaData = game.areaManager?.getArea?.(initialArea);
  if (areaData && areaData.tilemap) {
    game.isoTilemap = IsoTilemap.deserialize(areaData.tilemap);
  }
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
 * v6.0 Isometric-aware game loop render override.
 * Routes to the v6.0 RenderPipeline for game world, legacy renderer for UI/HUD.
 * @param {Game} game
 */
function setupV6GameLoop(game) {
  // Store reference to original render
  const originalRender = game.render.bind(game);

  /**
   * v6.0 render function. Uses RenderPipeline (with YSortRenderer) for game world,
   * legacy renderer for menus, landing, character select, and HUD overlays.
   */
  game.render = function() {
    if (this.state.screen === 'game') {
      // v6.0: Full render pipeline (bg -> floor -> wall -> prop -> entity -> effect)
      if (this.renderPipeline) {
        this.pixelPerfectScaler?.apply(this.ctx);
        this.renderPipeline.render(this.ctx);
      } else if (this.isoRenderer) {
        // Fallback to v5.0 renderer
        this.isoRenderer.render();
      }

      // v6.0: Grid overlay (highlighting, path, selection)
      if (this.isoGrid) {
        this.isoGrid.draw(this.isoCamera ? {
          x: this.isoCamera.x || 0,
          y: this.isoCamera.y || 0,
        } : { x: 0, y: 0 });
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
   * v6.0 update function. Extends base update with v6.0 isometric systems.
   */
  const originalUpdate = game.update.bind(game);
  game.update = function(dt) {
    // Call original update (input, player movement, camera follow, particles, etc.)
    originalUpdate(dt);

    // Update isometric camera (pan/zoom interpolation, shake)
    if (this.isoCamera) {
      this.isoCamera.update(dt);
    }

    // v6.0: Update grid-locked movement
    if (this.isoMovement) {
      this.isoMovement.update(dt);
    }

    // v6.0: Load chunks around player
    if (this.chunkManager && this.state.player) {
      this.chunkManager.loadAround(this.state.player.x || 32, this.state.player.y || 32);
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
   * Override setArea to also update v6.0 systems.
   */
  const originalSetArea = game.setArea.bind(game);
  game.setArea = function(areaId) {
    // Update isometric area backgrounds (14 areas available)
    if (this.isoAreaBackgrounds) {
      this.isoAreaBackgrounds.loadArea(areaId);
    }

    // v6.0: Reset tilemap and chunks for new area
    if (this.chunkManager) {
      this.chunkManager.invalidateAll();
    }
    if (this.ySortRenderer) {
      this.ySortRenderer.invalidateCache();
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
 * v6.0 adds sprite pipeline and new isometric world systems between
 * v5.0 engine and world modules.
 */
function initializeGame() {
  // Phase 1: Core engine
  wireEngineModules(game);

  // Phase 2: v5.0 Isometric assets (tileset, furniture, asset loader)
  wireIsoAssets(game);

  // Phase 3: v5.0 Isometric engine (math, camera, depth sorter, renderer)
  wireIsoEngineModules(game);

  // Phase 4: v6.0 Habbo-grade sprite pipeline
  wireV6SpritePipeline(game);

  // Phase 5: v6.0 Isometric world (tilemap, chunks, grid, movement, render)
  wireV6IsoModules(game);

  // Phase 6: World systems (legacy + isometric area backgrounds)
  wireWorldModules(game);

  // Phase 7: Avatar systems (legacy)
  wireAvatarModules(game);

  // Phase 8: v5.0 Isometric avatar modules
  wireIsoAvatarModules(game);

  // Phase 9: Social, economy, minigames, events, safety, game feel, audio
  wireSocialModules(game);
  wireEconomyModules(game);
  wireMinigameModules(game);
  wireEventModules(game);
  wireSafetyModules(game);
  wireGameFeelModules(game);
  wireAudioModules(game);
  wireNetworkModule(game);

  // Phase 10: v6.0 game loop integration
  setupV6GameLoop(game);

  // Phase 11: Finalize
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

  console.log('\u{1F31F} Starlight Inn v6.0 -- All modules wired and initialized (Habbo-grade asset pipeline active)');
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
    // v6.0: Pixel-perfect scaler resize
    game.pixelPerfectScaler?.resize();
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
  // v6.0: Zoom shortcuts
  if (event.key === '=' || event.key === '+') {
    game.pixelPerfectScaler?.zoomIn();
    return;
  }
  if (event.key === '-' || event.key === '_') {
    game.pixelPerfectScaler?.zoomOut();
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
      alert('Starlight Inn v6.0\nA premium cozy-core social virtual world.\nNow with Habbo-grade isometric asset pipeline!\nGather, explore, and play together under the stars. \u{1F31F}');
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
console.log('\u{1F31F} Starlight Inn v6.0 initialized -- Habbo-grade isometric cozy-core social virtual world');
