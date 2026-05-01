/**
 * Starlight Inn v7.0 -- Habbo-Grade Isometric Social MMO
 * Full-Stack Entry Point with All Systems Integrated
 *
 * @version 7.0.0
 * @description Habbo-style isometric pixel-art world with hundreds of assets,
 * battle pass, YouTube theatre, achievements, security, and Stripe monetization.
 */

// ============================================================
// ENGINE CORE
// ============================================================
import { Game } from './engine/Game.js';
import { Renderer } from './engine/Renderer.js';
import { Camera } from './engine/Camera.js';
import { Input } from './engine/Input.js';
import { Assets } from './engine/Assets.js';
import { Audio } from './engine/Audio.js';
import DebugConsole from './engine/DebugConsole.js';

// ============================================================
// ISOMETRIC ENGINE v5.0 / v6.0
// ============================================================
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
// ISOMETRIC ENGINE v6.0 -- TILEMAP & MOVEMENT
// ============================================================
import IsoTilemap from './iso/IsoTilemap.js';
import IsoChunk from './iso/IsoChunk.js';
import IsoGrid from './iso/IsoGrid.js';
import IsoMovement from './iso/IsoMovement.js';
import YSortRenderer from './iso/YSortRenderer.js';
import PixelPerfectScaler from './iso/PixelPerfectScaler.js';
import RenderPipeline from './iso/RenderPipeline.js';

// ============================================================
// SPRITE PIPELINE v6.0
// ============================================================
import SpriteGenerator from './sprites/SpriteGenerator.js';
import SpriteSheet from './sprites/SpriteSheet.js';
import SpriteCache from './sprites/SpriteCache.js';
import PaletteManager from './sprites/PaletteManager.js';
import ColorTable from './sprites/ColorTable.js';
import PaletteValidator from './sprites/PaletteValidator.js';

// ============================================================
// ASSET CATALOGS v7.0
// ============================================================
import { FurnitureCatalog } from './assets/FurnitureCatalog.js';
import { ClothingCatalog } from './assets/ClothingCatalog.js';
import { RareEggs } from './assets/RareEggs.js';
import { AnimationCatalog } from './assets/AnimationCatalog.js';

// ============================================================
// AVATAR SYSTEMS
// ============================================================
import { Avatar } from './avatar/Avatar.js';
import { Customizer } from './avatar/Customizer.js';
import { Gestures } from './avatar/Gestures.js';
import { Presets } from './avatar/Presets.js';
import { AnimationEngine } from './avatar/AnimationEngine.js';
import { ShadowAnchor } from './avatar/ShadowAnchor.js';

// ============================================================
// WORLD SYSTEMS
// ============================================================
import { AreaManager } from './world/AreaManager.js';
import { NPC, NPCManager } from './world/NPC.js';
import { AreaData } from './world/AreaData.js';
import GridPathfinding from './world/GridPathfinding.js';
import CollisionSystem from './world/CollisionSystem.js';
import SeasonalContent from './world/SeasonalContent.js';
import { IslandEditor } from './world/IslandEditor.js';
import { IslandEditorUI } from './world/IslandEditorUI.js';

// ============================================================
// SOCIAL SYSTEMS
// ============================================================
import { Chat } from './social/Chat.js';
import { RadialMenu } from './social/RadialMenu.js';
import { Friends } from './social/Friends.js';
import { TradeWindow } from './social/Trade.js';

// ============================================================
// ECONOMY SYSTEMS
// ============================================================
import { Currency } from './economy/Currency.js';
import { Catalog } from './economy/Catalog.js';
import { Inventory } from './economy/Inventory.js';
import { TradeEngine } from './economy/TradeEngine.js';

// ============================================================
// MINIGAMES
// ============================================================
import { MinigameHub } from './minigames/MinigameHub.js';
import { StarCatcher } from './minigames/StarCatcher.js';
import { MemoryMatch } from './minigames/MemoryMatch.js';
import { RhythmDance } from './minigames/RhythmDance.js';
import { Trivia } from './minigames/Trivia.js';

// ============================================================
// EVENTS
// ============================================================
import { ChestManager } from './events/ChestManager.js';
import { PowerUps } from './events/PowerUps.js';
import { EventCalendar } from './events/EventCalendar.js';

// ============================================================
// SAFETY & MODERATION
// ============================================================
import Filter from './safety/Filter.js';
import RateLimit from './safety/RateLimit.js';
import SpamDetector from './safety/SpamDetector.js';
import Report from './safety/Report.js';
import Moderation from './safety/Moderation.js';
import ChildSafety from './safety/ChildSafety.js';
import AIModeration from './safety/AIModeration.js';

// ============================================================
// GAME FEEL
// ============================================================
import { FartMechanic } from './FartMechanic.js';
import { UppercutEjection } from './UppercutEjection.js';
import { ScreenEffects } from './ScreenEffects.js';

// ============================================================
// v7.0 PROFILE -- ACHIEVEMENTS, BADGES, STATS
// ============================================================
import { AchievementSystem } from './profile/AchievementSystem.js';
import { BadgeSystem } from './profile/BadgeSystem.js';
import { ProfileStats } from './profile/ProfileStats.js';

// ============================================================
// v7.0 THEATRE -- YOUTUBE SYNC
// ============================================================
import { TheatreSystem } from './theatre/TheatreSystem.js';
import { WebRTCSync } from './theatre/WebRTCSync.js';

// ============================================================
// v7.0 SECURITY -- FIREWALL
// ============================================================
import { ContentFirewall } from './security/ContentFirewall.js';
import { ChatModeration } from './security/ChatModeration.js';

// ============================================================
// v7.0 MONETIZATION -- BATTLE PASS & STORE
// ============================================================
import { BattlePass } from './monetization/BattlePass.js';
import Store from './monetization/Store.js';

// ============================================================
// NETWORK
// ============================================================
import { SocketClient } from './net/SocketClient.js';

// ============================================================
// GAME INITIALIZATION
// ============================================================

const game = new Game('game-canvas');

function init() {
  console.log('[Starlight Inn v7.0.0] Initializing Habbo-grade MMO world...');

  // Core engine
  game.renderer = new Renderer(game);
  game.camera = new Camera(game);
  game.input = new Input(game);
  game.audio = new Audio();
  game.assets = new Assets();
  game.debugConsole = new DebugConsole(game);

  // Isometric engine
  game.isoRenderer = new IsoRenderer(game);
  game.isoCamera = new IsoCamera(game);
  game.isoDepthSorter = new IsoDepthSorter(game);
  game.isoTileset = new IsoTileset(game);
  game.isoFurniture = new IsoFurniture(game);
  game.isoAssetLoader = new IsoAssetLoader(game);
  game.isoAreaBackgrounds = new IsoAreaBackgrounds(game);
  game.isoAvatarRenderer = new IsoAvatarRenderer(game);
  game.isoWalkCycle = new IsoWalkCycle(game);
  game.isoIdleAnimation = new IsoIdleAnimation(game);

  // v6.0 Tilemap pipeline
  game.isoTilemap = new IsoTilemap(game);
  game.isoChunk = new IsoChunk(game);
  game.isoGrid = new IsoGrid(game);
  game.isoMovement = new IsoMovement(game);
  game.ySortRenderer = new YSortRenderer(game);
  game.pixelPerfectScaler = new PixelPerfectScaler(game);
  game.renderPipeline = new RenderPipeline(game);

  // Sprite pipeline
  game.spriteGenerator = new SpriteGenerator(game);
  game.spriteSheet = new SpriteSheet(game);
  game.spriteCache = new SpriteCache(game);
  game.paletteManager = new PaletteManager(game);
  game.colorTable = new ColorTable(game);
  game.paletteValidator = new PaletteValidator(game);

  // v7.0 Asset catalogs (93 furniture, 48 clothing, 20 eggs, 16 animations)
  game.furnitureCatalog = new FurnitureCatalog(game);
  game.clothingCatalog = new ClothingCatalog(game);
  game.rareEggs = new RareEggs(game);
  game.animationCatalog = new AnimationCatalog(game);

  // Avatar
  game.avatar = new Avatar(game);
  game.customizer = new Customizer(game);
  game.gestures = new Gestures(game);
  game.presets = new Presets();
  game.animationEngine = new AnimationEngine(game);
  game.shadowAnchor = new ShadowAnchor(game);

  // World
  game.areaManager = new AreaManager(game);
  game.npcManager = new NPCManager(game);
  game.areaData = new AreaData(game);
  game.pathfinding = new GridPathfinding(game);
  game.collision = new CollisionSystem(game);
  game.seasonal = new SeasonalContent(game);
  game.islandEditor = new IslandEditor(game);
  game.islandEditorUI = new IslandEditorUI(game);

  // Social
  game.chat = new Chat(game);
  game.radialMenu = new RadialMenu(game);
  game.friends = new Friends(game);
  game.tradeWindow = new TradeWindow(game);

  // Economy
  game.currency = new Currency(game);
  game.catalog = new Catalog(game);
  game.inventory = new Inventory(game);
  game.tradeEngine = new TradeEngine(game);

  // Minigames
  game.minigameHub = new MinigameHub(game);
  game.minigameHub.register('starcatcher', StarCatcher, { minPlayers: 1, maxPlayers: 4, description: 'Catch falling stars!', icon: '⭐' });
  game.minigameHub.register('memorymatch', MemoryMatch, { minPlayers: 1, maxPlayers: 2, description: 'Match pairs of starlight cards.', icon: '🃏' });
  game.minigameHub.register('rhythmdance', RhythmDance, { minPlayers: 1, maxPlayers: 4, description: 'Dance to the rhythm of the cosmos.', icon: '💃' });
  game.minigameHub.register('trivia', Trivia, { minPlayers: 1, maxPlayers: 4, description: 'Test your knowledge of the starlight world.', icon: '🧠' });

  // Events
  game.chestManager = new ChestManager(game);
  game.powerUps = new PowerUps(game);
  game.eventCalendar = new EventCalendar(game);

  // Safety
  game.filter = new Filter();
  game.rateLimit = new RateLimit();
  game.spamDetector = new SpamDetector();
  game.report = new Report(game);
  game.moderation = new Moderation(game);
  game.childSafety = new ChildSafety(game);
  game.aiModeration = new AIModeration(game);

  // v7.0 Security -- Content Firewall
  game.contentFirewall = new ContentFirewall(game);
  game.chatModeration = new ChatModeration(game);

  // Game Feel
  game.fartMechanic = new FartMechanic(game);
  game.uppercutEjection = new UppercutEjection(game);
  game.screenEffects = new ScreenEffects(game);

  // v7.0 Profile -- Achievements, Badges, Stats
  game.achievementSystem = new AchievementSystem(game);
  game.badgeSystem = new BadgeSystem(game);
  game.profileStats = new ProfileStats(game);

  // v7.0 Theatre -- YouTube Sync
  game.theatreSystem = new TheatreSystem(game);
  game.webrtcSync = new WebRTCSync(game);

  // v7.0 Monetization -- Battle Pass & Store
  game.battlePass = new BattlePass(game);
  game.store = new Store(game);

  // Network (offline fallback)
  try {
    game.socket = new SocketClient(game);
    game.socket.connect();
  } catch (err) {
    console.log('[Net] Offline mode -- no server');
    game.socket = null;
  }

  // Initialize world
  game.init();

  // v7.0 -- Generate assets after init
  game.spriteGenerator?.generateAll();
  game.paletteManager?.initPalettes();

  console.log('[Starlight Inn v7.0.0] Habbo MMO world initialized!');
  console.log('[v7.0] Features: 93 furniture, 48 clothing, 20 eggs, 45 achievements, 20 badges, YouTube theatre, battle pass, security firewall');
}

// ============================================================
// LANDING PAGE HANDLERS
// ============================================================

function wireLandingHandlers() {
  const btnPlay = document.getElementById('btn-play');
  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      btnPlay.style.transform = 'scale(0.95)';
      setTimeout(() => {
        btnPlay.style.transform = '';
        game.setScreen('charselect');
      }, 150);
    });
  }
  const btnSettings = document.getElementById('btn-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      const panel = document.getElementById('settings-panel');
      if (panel) panel.classList.add('active');
    });
  }
  const btnAbout = document.getElementById('btn-about');
  if (btnAbout) {
    btnAbout.addEventListener('click', () => {
      alert('Starlight Inn v7.0.0\nA premium Habbo-style isometric social MMO.\nGather, explore, trade, and play together! 🌟');
    });
  }
  const settingsPanel = document.getElementById('settings-panel');
  if (settingsPanel) {
    const closeBtn = settingsPanel.querySelector('.panel-close');
    if (closeBtn) closeBtn.addEventListener('click', () => settingsPanel.classList.remove('active'));
  }
}

function wireCharSelectHandlers() {
  const btnBack = document.getElementById('btn-back');
  if (btnBack) btnBack.addEventListener('click', () => game.setScreen('landing'));

  const btnContinue = document.getElementById('btn-continue');
  if (btnContinue) {
    btnContinue.addEventListener('click', () => {
      const nameInput = document.getElementById('char-name-input');
      if (nameInput && nameInput.value.trim()) game.state.player.name = nameInput.value.trim();
      game.setScreen('game');
      game.start();
    });
  }
  const btnRandom = document.getElementById('btn-randomize');
  if (btnRandom && game.customizer) btnRandom.addEventListener('click', () => game.customizer.randomize());
}

// ============================================================
// GLOBAL EVENTS
// ============================================================

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.stop();
    console.log('[Game] Paused');
  } else {
    game.start();
    console.log('[Game] Resumed');
  }
});

document.getElementById('game-canvas').addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('resize', () => {
  game.renderer?.resize();
  game.camera?.updateBounds();
});

document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    if (e.key === 'Escape') {
      game.chat?.close();
      game.inventory?.close();
      game.catalog?.close();
    }
    return;
  }
  if (e.key === 'Escape') {
    game.chat?.close();
    game.inventory?.close();
    game.catalog?.close();
    game.friends?.close();
    game.tradeWindow?.close();
    game.debugConsole?.hide();
    return;
  }
  if (e.key === '`' || e.key === '~') {
    game.debugConsole?.toggle();
    return;
  }
  if (e.key === 'Enter' || e.key === 't' || e.key === 'T') {
    game.chat?.focus();
    return;
  }
  const shortcuts = { f: 'friends', F: 'friends', i: 'inventory', I: 'inventory', b: 'catalog', B: 'catalog', g: 'minigames', G: 'minigames', s: 'store', S: 'store' };
  const panel = shortcuts[e.key];
  if (panel && game[panel]) game[panel].toggle();
});

// ============================================================
// BOOT
// ============================================================

function boot() {
  try {
    init();
    wireLandingHandlers();
    wireCharSelectHandlers();
  } catch (err) {
    console.error('[Boot] Fatal error:', err);
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      const text = overlay.querySelector('.loading-text');
      if (text) text.textContent = 'Something went wrong ✨';
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

window.StarlightInn = game;
console.log('🌟 Starlight Inn v7.0.0 -- Habbo-grade isometric MMO ready');
