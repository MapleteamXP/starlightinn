/**
 * Starlight Inn v8.0.0 — Massive Quality Upgrade
 * Auth, 100 hairstyles, sounds, pixel art, collisions, offline-first boot.
 *
 * @version 8.0.0
 * @description AAA cozy-core social virtual world with v8.0 quality upgrades.
 */

// ============================================================
// LOADING STATUS — per-module tracker
// ============================================================
const loadStatus = {
  total: 0,
  done: 0,
  failed: 0,
  modules: {},
  update(text) {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    const sub = overlay.querySelector('.loading-subtext');
    const fill = document.getElementById('loading-fill');
    if (sub) sub.textContent = text;
    if (fill && this.total > 0) {
      const pct = Math.min(100, Math.round(((this.done + this.failed) / this.total) * 100));
      fill.style.width = pct + '%';
    }
  },
  mark(name, ok) {
    this.modules[name] = ok ? 'ok' : 'fail';
    if (ok) this.done++; else this.failed++;
    const statusText = Object.entries(this.modules).map(([n, s]) => `${n}:${s==='ok'?'OK':'--'}`).join(' · ');
    this.update(statusText);
  },
  forceFade() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.transition = 'opacity 0.8s ease';
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.style.display = 'none'; }, 900);
    }
  }
};

// ============================================================
// OFFLINE MODE GUARD — 2-second max wait
// ============================================================
let offlineForced = false;
function forceOfflineSoon() {
  setTimeout(() => {
    if (!offlineForced) {
      offlineForced = true;
      loadStatus.update('Offline mode — continuing...');
      loadStatus.forceFade();
    }
  }, 2000);
}

// ============================================================
// MODULE LOADER — wraps every init in try/catch
// ============================================================
function safeInit(name, fn) {
  try {
    const result = fn();
    loadStatus.mark(name, true);
    return result;
  } catch (err) {
    console.warn(`[Init] ${name} failed — continuing without it:`, err);
    loadStatus.mark(name, false);
    return null;
  }
}

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
// ISOMETRIC ENGINE v6.0 — TILEMAP & MOVEMENT
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
// AVATAR SYSTEMS (existing + v8.0)
// ============================================================
import { Avatar } from './avatar/Avatar.js';
import { Customizer } from './avatar/Customizer.js';
import { Gestures } from './avatar/Gestures.js';
import { Presets } from './avatar/Presets.js';
import { AnimationEngine } from './avatar/AnimationEngine.js';
import { ShadowAnchor } from './avatar/ShadowAnchor.js';
// v8.0
import { ColorWheel } from './avatar/ColorWheel.js';
import { HairCatalog } from './avatar/HairCatalog.js';
import { AvatarPreview } from './avatar/AvatarPreview.js';
import { CharacterCreator } from './avatar/CharacterCreator.js';

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
// SOCIAL SYSTEMS (existing + v8.0)
// ============================================================
import { Chat } from './social/Chat.js';
import { RadialMenu } from './social/RadialMenu.js';
import { Friends } from './social/Friends.js';
import { TradeWindow } from './social/Trade.js';
// v8.0
import { FriendSystem } from './social/FriendSystem.js';

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
// v7.0 PROFILE
// ============================================================
import { AchievementSystem } from './profile/AchievementSystem.js';
import { BadgeSystem } from './profile/BadgeSystem.js';
import { ProfileStats } from './profile/ProfileStats.js';

// ============================================================
// v7.0 THEATRE
// ============================================================
import { TheatreSystem } from './theatre/TheatreSystem.js';
import { WebRTCSync } from './theatre/WebRTCSync.js';

// ============================================================
// v7.0 SECURITY
// ============================================================
import { ContentFirewall } from './security/ContentFirewall.js';
import { ChatModeration } from './security/ChatModeration.js';

// ============================================================
// v7.0 MONETIZATION
// ============================================================
import { BattlePass } from './monetization/BattlePass.js';
import Store from './monetization/Store.js';

// ============================================================
// v8.0 AUTH
// ============================================================
import { AuthSystem } from './auth/AuthSystem.js';

// ============================================================
// v8.0 AUDIO
// ============================================================
import { SoundManager } from './audio/SoundManager.js';
import { MusicPlayer } from './audio/MusicPlayer.js';
import { AudioUI } from './audio/AudioUI.js';

// ============================================================
// v8.0 PIXEL EMOJI
// ============================================================
import { PixelEmoji } from './sprites/PixelEmoji.js';

// ============================================================
// v8.0 COLLISION
// ============================================================
import { CollisionSystemV8 } from './collision/CollisionSystem.js';
import { HitBox, HITBOX_PRESETS } from './collision/HitBox.js';

// ============================================================
// v8.0 UI
// ============================================================
import { PixelIcon } from './ui/PixelIcon.js';

// ============================================================
// NETWORK
// ============================================================
import { SocketClient } from './net/SocketClient.js';

// ============================================================
// GAME INSTANCE
// ============================================================
const game = new Game('game-canvas');

// Count total modules for loading bar
loadStatus.total = 45;

function init() {
  console.log('[Starlight Inn v8.0.0] Initializing v8.0 massive quality upgrade...');
  loadStatus.update('Wiring engine...');

  // Core engine
  safeInit('Renderer', () => { game.renderer = new Renderer(game); });
  safeInit('Camera', () => { game.camera = new Camera(game); });
  safeInit('Input', () => { game.input = new Input(game); });
  safeInit('Audio', () => { game.audio = new Audio(); });
  safeInit('Assets', () => { game.assets = new Assets(); });
  safeInit('DebugConsole', () => { game.debugConsole = new DebugConsole(game); });

  // Isometric engine
  safeInit('IsoRenderer', () => { game.isoRenderer = new IsoRenderer(game); });
  safeInit('IsoCamera', () => { game.isoCamera = new IsoCamera(game); });
  safeInit('IsoDepthSorter', () => { game.isoDepthSorter = new IsoDepthSorter(game); });
  safeInit('IsoTileset', () => { game.isoTileset = new IsoTileset(game); });
  safeInit('IsoFurniture', () => { game.isoFurniture = new IsoFurniture(game); });
  safeInit('IsoAssetLoader', () => { game.isoAssetLoader = new IsoAssetLoader(game); });
  safeInit('IsoAreaBackgrounds', () => { game.isoAreaBackgrounds = new IsoAreaBackgrounds(game); });
  safeInit('IsoAvatarRenderer', () => { game.isoAvatarRenderer = new IsoAvatarRenderer(game); });
  safeInit('IsoWalkCycle', () => { game.isoWalkCycle = new IsoWalkCycle(game); });
  safeInit('IsoIdleAnimation', () => { game.isoIdleAnimation = new IsoIdleAnimation(game); });

  // v6.0 Tilemap pipeline
  safeInit('IsoTilemap', () => { game.isoTilemap = new IsoTilemap(game); });
  safeInit('IsoChunk', () => { game.isoChunk = new IsoChunk(game); });
  safeInit('IsoGrid', () => { game.isoGrid = new IsoGrid(game); });
  safeInit('IsoMovement', () => { game.isoMovement = new IsoMovement(game); });
  safeInit('YSortRenderer', () => { game.ySortRenderer = new YSortRenderer(game); });
  safeInit('PixelPerfectScaler', () => { game.pixelPerfectScaler = new PixelPerfectScaler(game); });
  safeInit('RenderPipeline', () => { game.renderPipeline = new RenderPipeline(game); });

  // Sprite pipeline
  safeInit('SpriteGenerator', () => { game.spriteGenerator = new SpriteGenerator(game); });
  safeInit('SpriteSheet', () => { game.spriteSheet = new SpriteSheet(game); });
  safeInit('SpriteCache', () => { game.spriteCache = new SpriteCache(game); });
  safeInit('PaletteManager', () => { game.paletteManager = new PaletteManager(game); });
  safeInit('ColorTable', () => { game.colorTable = new ColorTable(game); });
  safeInit('PaletteValidator', () => { game.paletteValidator = new PaletteValidator(game); });

  // Asset catalogs
  safeInit('FurnitureCatalog', () => { game.furnitureCatalog = new FurnitureCatalog(game); });
  safeInit('ClothingCatalog', () => { game.clothingCatalog = new ClothingCatalog(game); });
  safeInit('RareEggs', () => { game.rareEggs = new RareEggs(game); });
  safeInit('AnimationCatalog', () => { game.animationCatalog = new AnimationCatalog(game); });

  // Avatar (existing)
  safeInit('Avatar', () => { game.avatar = new Avatar(game); });
  safeInit('Customizer', () => { game.customizer = new Customizer(game); });
  safeInit('Gestures', () => { game.gestures = new Gestures(game); });
  safeInit('Presets', () => { game.presets = new Presets(); });
  safeInit('AnimationEngine', () => { game.animationEngine = new AnimationEngine(game); });
  safeInit('ShadowAnchor', () => { game.shadowAnchor = new ShadowAnchor(game); });

  // v8.0 Avatar upgrades
  safeInit('ColorWheel', () => { game.colorWheel = ColorWheel; }); // class export
  safeInit('HairCatalog', () => { game.hairCatalog = HairCatalog; }); // class export
  safeInit('AvatarPreview', () => { game.avatarPreview = AvatarPreview; }); // class export
  safeInit('CharacterCreator', () => { game.characterCreator = new CharacterCreator(game); });

  // World
  safeInit('AreaManager', () => { game.areaManager = new AreaManager(game); });
  safeInit('NPCManager', () => { game.npcManager = new NPCManager(game); });
  safeInit('AreaData', () => { game.areaData = new AreaData(game); });
  safeInit('Pathfinding', () => { game.pathfinding = new GridPathfinding(game); });
  safeInit('Collision', () => { game.collision = new CollisionSystem(game); });
  safeInit('SeasonalContent', () => { game.seasonal = new SeasonalContent(game); });
  safeInit('IslandEditor', () => { game.islandEditor = new IslandEditor(game); });
  safeInit('IslandEditorUI', () => { game.islandEditorUI = new IslandEditorUI(game); });

  // Social (existing)
  safeInit('Chat', () => { game.chat = new Chat(game); });
  safeInit('RadialMenu', () => { game.radialMenu = new RadialMenu(game); });
  safeInit('Friends', () => { game.friends = new Friends(game); });
  safeInit('TradeWindow', () => { game.tradeWindow = new TradeWindow(game); });

  // v8.0 Social upgrades
  safeInit('FriendSystem', () => { game.friendSystem = new FriendSystem(game); });

  // Economy
  safeInit('Currency', () => { game.currency = new Currency(game); });
  safeInit('Catalog', () => { game.catalog = new Catalog(game); });
  safeInit('Inventory', () => { game.inventory = new Inventory(game); });
  safeInit('TradeEngine', () => { game.tradeEngine = new TradeEngine(game); });

  // Minigames
  safeInit('MinigameHub', () => {
    game.minigameHub = new MinigameHub(game);
    game.minigameHub.register('starcatcher', StarCatcher, { minPlayers: 1, maxPlayers: 4, description: 'Catch falling stars!', icon: 'star' });
    game.minigameHub.register('memorymatch', MemoryMatch, { minPlayers: 1, maxPlayers: 2, description: 'Match pairs of starlight cards.', icon: 'card' });
    game.minigameHub.register('rhythmdance', RhythmDance, { minPlayers: 1, maxPlayers: 4, description: 'Dance to the rhythm of the cosmos.', icon: 'dance' });
    game.minigameHub.register('trivia', Trivia, { minPlayers: 1, maxPlayers: 4, description: 'Test your knowledge of the starlight world.', icon: 'brain' });
  });

  // Events
  safeInit('ChestManager', () => { game.chestManager = new ChestManager(game); });
  safeInit('PowerUps', () => { game.powerUps = new PowerUps(game); });
  safeInit('EventCalendar', () => { game.eventCalendar = new EventCalendar(game); });

  // Safety
  safeInit('Filter', () => { game.filter = new Filter(); });
  safeInit('RateLimit', () => { game.rateLimit = new RateLimit(); });
  safeInit('SpamDetector', () => { game.spamDetector = new SpamDetector(); });
  safeInit('Report', () => { game.report = new Report(game); });
  safeInit('Moderation', () => { game.moderation = new Moderation(game); });
  safeInit('ChildSafety', () => { game.childSafety = new ChildSafety(game); });
  safeInit('AIModeration', () => { game.aiModeration = new AIModeration(game); });

  // Security
  safeInit('ContentFirewall', () => { game.contentFirewall = new ContentFirewall(game); });
  safeInit('ChatModeration', () => { game.chatModeration = new ChatModeration(game); });

  // Game Feel
  safeInit('FartMechanic', () => { game.fartMechanic = new FartMechanic(game); });
  safeInit('UppercutEjection', () => { game.uppercutEjection = new UppercutEjection(game); });
  safeInit('ScreenEffects', () => { game.screenEffects = new ScreenEffects(game); });

  // Profile
  safeInit('AchievementSystem', () => { game.achievementSystem = new AchievementSystem(game); });
  safeInit('BadgeSystem', () => { game.badgeSystem = new BadgeSystem(game); });
  safeInit('ProfileStats', () => { game.profileStats = new ProfileStats(game); });

  // Theatre
  safeInit('TheatreSystem', () => { game.theatreSystem = new TheatreSystem(game); });
  safeInit('WebRTCSync', () => { game.webrtcSync = new WebRTCSync(game); });

  // Monetization
  safeInit('BattlePass', () => { game.battlePass = new BattlePass(game); });
  safeInit('Store', () => { game.store = new Store(game); });

  // v8.0 Auth
  safeInit('AuthSystem', () => { game.auth = new AuthSystem(game); });

  // v8.0 Audio
  safeInit('SoundManager', () => { game.soundManager = new SoundManager(); });
  safeInit('MusicPlayer', () => { game.musicPlayer = new MusicPlayer(); });
  safeInit('AudioUI', () => { game.audioUI = new AudioUI(game, game.soundManager, game.musicPlayer); });

  // v8.0 Pixel Emoji
  safeInit('PixelEmoji', () => { game.pixelEmoji = new PixelEmoji(18); });

  // v8.0 Collision
  safeInit('CollisionSystemV8', () => { game.collisionV8 = new CollisionSystemV8(64); });
  safeInit('HitBox', () => { game.hitBox = HitBox; game.hitBoxPresets = HITBOX_PRESETS; });

  // v8.0 UI
  safeInit('PixelIcon', () => { game.pixelIcon = new PixelIcon(20); });

  // Network (offline fallback within safeInit)
  safeInit('Network', () => {
    game.socket = new SocketClient(game);
    game.socket.connect();
  });

  // Initialize world
  safeInit('GameInit', () => {
    game.init();
    game.spriteGenerator?.generateAll?.();
    game.paletteManager?.initPalettes?.();
  });

  console.log('[Starlight Inn v8.0.0] All modules wired — OK:', loadStatus.done, 'Failed:', loadStatus.failed);
}

// ============================================================
// LANDING PAGE HANDLERS
// ============================================================

function wireLandingHandlers() {
  const btnPlay = document.getElementById('btn-play');
  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      game.soundManager?.play('click');
      btnPlay.style.transform = 'scale(0.95)';
      setTimeout(() => {
        btnPlay.style.transform = '';
        if (game.characterCreator) {
          game.characterCreator.show();
          game.setScreen('charselect');
        } else {
          game.setScreen('charselect');
        }
      }, 150);
    });
  }

  const btnGuest = document.getElementById('btn-guest');
  if (btnGuest) {
    btnGuest.addEventListener('click', () => {
      game.soundManager?.play('click');
      game.auth?.playOffline?.();
      if (game.characterCreator) {
        game.characterCreator.show();
        game.setScreen('charselect');
      } else {
        game.setScreen('charselect');
      }
    });
  }

  const btnSettings = document.getElementById('btn-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      game.soundManager?.play('click');
      const panel = document.getElementById('settings-panel');
      if (panel) panel.classList.add('active');
    });
  }

  const btnAbout = document.getElementById('btn-about');
  if (btnAbout) {
    btnAbout.addEventListener('click', () => {
      game.soundManager?.play('click');
      alert('Starlight Inn v8.0.0\nA premium Habbo-style isometric social MMO.\n\nv8.0 upgrades: auth, 100 hairstyles, sounds, pixel art, collisions! 🌟');
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
  if (btnBack) btnBack.addEventListener('click', () => {
    game.soundManager?.play('back');
    game.setScreen('landing');
  });

  const btnContinue = document.getElementById('btn-continue');
  if (btnContinue) {
    btnContinue.addEventListener('click', () => {
      game.soundManager?.play('success');
      const nameInput = document.getElementById('char-name-input');
      if (nameInput && nameInput.value.trim()) game.state.player.name = nameInput.value.trim();
      game.setScreen('game');
      game.start();
    });
  }

  const btnRandom = document.getElementById('btn-randomize');
  if (btnRandom && game.customizer) {
    btnRandom.addEventListener('click', () => {
      game.soundManager?.play('dice');
      game.customizer.randomize();
    });
  }
}

// ============================================================
// GLOBAL EVENTS
// ============================================================

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.stop?.();
    console.log('[Game] Paused');
  } else {
    game.start?.();
    console.log('[Game] Resumed');
  }
});

document.getElementById('game-canvas')?.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('resize', () => {
  game.renderer?.resize?.();
  game.camera?.updateBounds?.();
});

document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    if (e.key === 'Escape') {
      game.chat?.close?.();
      game.inventory?.close?.();
      game.catalog?.close?.();
    }
    return;
  }
  if (e.key === 'Escape') {
    game.chat?.close?.(); game.inventory?.close?.(); game.catalog?.close?.();
    game.friends?.close?.(); game.tradeWindow?.close?.(); game.debugConsole?.hide?.();
    return;
  }
  if (e.key === '`' || e.key === '~') {
    game.debugConsole?.toggle?.();
    return;
  }
  if (e.key === 'Enter' || e.key === 't' || e.key === 'T') {
    game.chat?.focus?.();
    return;
  }
  const shortcuts = { f: 'friends', F: 'friends', i: 'inventory', I: 'inventory', b: 'catalog', B: 'catalog', g: 'minigames', G: 'minigames', s: 'store', S: 'store', a: 'areaBrowser', A: 'areaBrowser' };
  const panel = shortcuts[e.key];
  if (panel && game[panel]?.toggle) game[panel].toggle();
});

window.addEventListener('online', () => {
  console.log('[Net] Online');
  if (game.socket && !game.socket.connected) game.socket.connect?.();
});

window.addEventListener('offline', () => {
  console.log('[Net] Offline');
  game.socket?.disconnect?.();
});

// ============================================================
// BOOT — guaranteed fade + offline fallback
// ============================================================

function boot() {
  // Start the 2-second safety timer immediately
  forceOfflineSoon();

  try {
    init();
    wireLandingHandlers();
    wireCharSelectHandlers();

    // Replace text emojis with pixel emojis on chat panel
    if (game.pixelEmoji) {
      const chatPanel = document.getElementById('chat-panel');
      if (chatPanel) {
        const mo = new MutationObserver(() => game.pixelEmoji.replaceInElement(chatPanel));
        mo.observe(chatPanel, { childList: true, subtree: true });
      }
    }

    // Inject pixel icons into HUD buttons
    if (game.pixelIcon) {
      game.pixelIcon.injectButton('btn-area-browser', 'map');
      game.pixelIcon.injectButton('btn-friends', 'friends');
      game.pixelIcon.injectButton('btn-inventory', 'bag');
      game.pixelIcon.injectButton('btn-catalog', 'shop');
      game.pixelIcon.injectButton('btn-minigames', 'game');
      game.pixelIcon.injectButton('btn-notifications', 'bell');
      game.pixelIcon.injectButton('btn-settings-game', 'settings');
    }

    // Start area music if available
    if (game.musicPlayer) {
      game.musicPlayer.playArea('starlight_hub');
    }

  } catch (err) {
    console.error('[Boot] Fatal error:', err);
  } finally {
    // ALWAYS fade the loading screen — no matter what
    setTimeout(() => {
      loadStatus.forceFade();
      offlineForced = true;
    }, 1500);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

window.StarlightInn = game;
console.log('🌟 Starlight Inn v8.0.0 — Massive quality upgrade ready');
