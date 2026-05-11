// ============================================================
// Starlight Engine — Main Game
// ============================================================

import {
  TILE_W, TILE_H, WALL_H, AVATAR_H,
  isoToScreen, screenToIso, lerp, clamp, dist, randInt, randChoice, roundRect
} from './Core.js';
import {
  getAvatarAsset, getFurnitureAsset, getTilePattern, getWallPattern,
  createAvatarCanvas, clearAvatarCache, createSceneryCanvas
} from '../assets/Generator.js';
import { FURNITURE_CATALOG, ROOM_TEMPLATES, ROOM_THEMES, CATALOG_CATEGORIES } from '../world/Data.js';
import { Furniture } from '../world/Furniture.js';
import { Avatar } from '../world/Avatar.js';
import { Room } from '../world/Room.js';
import { ChatManager } from '../social/Chat.js';
import { NPCManager } from '../social/NPC.js';
import { CurrencySystem } from '../economy/Currency.js';
import { InventorySystem } from '../economy/Inventory.js';
import { UIManager } from '../ui/UIManager.js';
import { ContentFilter } from '../security/Filter.js';
import { RingUppercut } from '../minigames/RingUppercut.js';
import { MemoryMatch } from '../minigames/MemoryMatch.js';
import { TilePuzzle } from '../minigames/TilePuzzle.js';
import { SoundManager } from '../audio/SoundManager.js';
import { DailyRewardSystem } from '../economy/DailyRewards.js';
import { AchievementSystem } from '../economy/Achievements.js';
import { CraftingSystem, CRAFTING_RECIPES } from '../economy/Crafting.js';
import { FriendSystem } from '../social/Friends.js';
import { LeaderboardSystem } from '../social/Leaderboard.js';
import { StatsSystem } from '../social/Stats.js';
import { EventSystem } from '../world/Events.js';
import { ChallengeSystem } from '../economy/Challenges.js';
import { TutorialSystem } from '../ui/Tutorial.js';
import { PetSystem } from '../world/Pet.js';

class Particle {
  constructor(x, y, color, life, vx, vy) {
    this.x = x; this.y = y; this.color = color;
    this.life = life; this.maxLife = life;
    this.vx = vx || (Math.random() - 0.5) * 1.5;
    this.vy = vy || -(Math.random() * 1.5 + 0.5);
    this.size = Math.random() * 3 + 1;
  }
  update(dt) {
    this.x += this.vx; this.y += this.vy;
    this.life -= dt; this.vy += 0.03;
  }
  draw(ctx) {
    const alpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.camera = { x: 0, y: 0 };
    this.targetCamera = { x: 0, y: 0 };
    this.room = null;
    this.player = null;
    this.particles = [];
    this.settings = { showMinimap: true, showNames: true, showChat: true, npcCount: 3, camSpeed: 5, sound: false, safeMode: false };
    this.ownedThemes = ['classic'];
    this.currentTheme = 'classic';
    this.loadThemes();
    this.chatColor = '#fffde7';
    this.lastTime = 0;
    this.hoverTile = null;
    this.mouse = { x: 0, y: 0 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.keys = {};
    this.selectedTool = 'walk';
    this.selectedInventoryItem = null;
    this.placementRotation = 0;
    this.catalogCategory = 'all';
    this.customize = { skinColor: '#F5CBA7', hairColor: '#5D4037', hairStyle: 'short', shirtColor: '#3498DB', pantsColor: '#2C3E50', shoeColor: '#555555', hatType: 'none', glassesType: 'none' };

    this.currencySystem = new CurrencySystem(1000);
    this.inventorySystem = new InventorySystem();
    this.chatManager = new ChatManager(this);
    this.npcManager = new NPCManager(this);
    this.uiManager = new UIManager(this);
    this.contentFilter = new ContentFilter();
    this.soundManager = new SoundManager(this.settings.sound);

    this.minigame = null;
    this.treasures = [];
    this.treasureTimer = 0;
    this.dailyRewards = new DailyRewardSystem(this);
    this.friendSystem = new FriendSystem(this);
    this.petSystem = new PetSystem(this);
    this.achievementSystem = new AchievementSystem(this);
    this.leaderboardSystem = new LeaderboardSystem();
    this.craftingSystem = new CraftingSystem(this.inventorySystem);
    this.statsSystem = new StatsSystem();
    this.eventSystem = new EventSystem(this);
    this.challengeSystem = new ChallengeSystem(this);
    this.tutorialSystem = new TutorialSystem();
    this.photoMode = false;

    this.setupInput();
    this.setupUI();

    this.loadRoom(ROOM_TEMPLATES[0], false);
    this.loadAvatarFromStorage();
    this.applyAvatarToPlayer();
    this.spawnNPCs(this.settings.npcCount);
    this.achievementSystem.visitRoom(ROOM_TEMPLATES[0].id);
    this.challengeSystem.track('visit');
    this.applyThemeToMyRoom();

    // Check daily rewards
    setTimeout(() => this.checkDailyRewards(), 1200);

    // Starter inventory only if empty
    const inv = this.inventorySystem.getAll();
    if (Object.keys(inv).length === 0) {
      this.inventorySystem.add('chair', 2);
      this.inventorySystem.add('plant', 3);
      this.inventorySystem.add('lamp', 1);
      this.inventorySystem.add('table', 1);
      this.inventorySystem.add('rug', 1);
    }

    this.hasRendered = false;
    this.autoSaveInterval = setInterval(() => this.saveAllData(), 60000);
    requestAnimationFrame(t => this.loop(t));

    // Show tutorial for first-time players
    setTimeout(() => {
      if (this.tutorialSystem.shouldShow()) {
        this.tutorialSystem.show(this.uiManager);
      }
    }, 1500);
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
  }

  loadRoom(template, animate = true) {
    if (animate) {
      this._doRoomTransition(() => this._loadRoomImpl(template));
      return;
    }
    this._loadRoomImpl(template);
  }

  _doRoomTransition(callback) {
    let overlay = document.getElementById('roomTransition');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'roomTransition';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#0a3d44;z-index:500;opacity:0;pointer-events:none;transition:opacity 0.35s ease;';
      document.body.appendChild(overlay);
    }
    overlay.style.pointerEvents = 'auto';
    overlay.style.opacity = '1';
    setTimeout(() => {
      callback();
      setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
      }, 80);
    }, 350);
  }

  _loadRoomImpl(template) {
    const oldPlayer = this.player;
    this.room = new Room(template);
    if (oldPlayer) {
      this.player = oldPlayer;
      this.player.x = Math.floor(this.room.width / 2);
      this.player.y = Math.floor(this.room.height / 2);
      this.player.path = [];
      this.player.isWalking = false;
      this.player.isDancing = false;
    } else {
      const c = this.customize;
      this.player = new Avatar('You', Math.floor(this.room.width / 2), Math.floor(this.room.height / 2), {
        skinColor: c.skinColor, hairColor: c.hairColor, hairStyle: c.hairStyle,
        shirtColor: c.shirtColor, pantsColor: c.pantsColor, shoeColor: c.shoeColor,
        hatType: c.hatType, glassesType: c.glassesType
      });
    }
    this.player.game = this;
    this.room.avatars.push(this.player);

    this.npcManager.npcs.forEach(n => {
      n.path = [];
      n.isWalking = false;
      n.game = this;
      this.room.avatars.push(n);
    });

    const roomName = document.getElementById('roomName');
    const roomDesc = document.getElementById('roomDesc');
    if (roomName) roomName.textContent = this.room.name;
    if (roomDesc) roomDesc.textContent = this.room.description;

    if (this.room.id === 'myroom') this.loadMyRoom();

    const center = isoToScreen(this.room.width / 2, this.room.height / 2);
    this.targetCamera = { x: this.width / 2 - center.x, y: this.height / 2 - center.y + 90 };
    this.camera = { ...this.targetCamera };
  }

  spawnNPCs(count) {
    if (!this.room) return;
    this.room.avatars = this.room.avatars.filter(a => !a.isNPC);
    const npcs = this.npcManager.spawn(count, this.room, this.player);
    npcs.forEach(n => this.room.avatars.push(n));
  }

  spawnParticles(x, y, color, count = 8) {
    const sp = isoToScreen(x, y);
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(sp.x + this.camera.x, sp.y + this.camera.y - 20, color, 1.0 + Math.random() * 0.5));
    }
  }

  spawnFootstep(x, y) {
    const sp = isoToScreen(x, y);
    for (let i = 0; i < 3; i++) {
      const p = new Particle(sp.x + this.camera.x + (Math.random() - 0.5) * 10, sp.y + this.camera.y + 4, 'rgba(200,200,200,0.4)', 0.4 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5, -Math.random() * 0.3);
      p.size = 2 + Math.random() * 2;
      this.particles.push(p);
    }
    this.soundManager.play('step');
  }

  setupInput() {
    this.canvas.addEventListener('dragover', e => { e.preventDefault(); this.dragHighlight = this.hoverTile; });
    this.canvas.addEventListener('dragleave', e => { this.dragHighlight = null; });
    this.canvas.addEventListener('drop', e => {
      e.preventDefault();
      const type = e.dataTransfer.getData('itemType');
      if (!type || !this.inventorySystem.has(type)) return;
      const worldX = e.clientX - this.camera.x, worldY = e.clientY - this.camera.y;
      const iso = screenToIso(worldX, worldY + TILE_H / 2);
      const tx = Math.floor(iso.x), ty = Math.floor(iso.y);
      if (this.room.placeFurniture(type, tx, ty)) {
        this.inventorySystem.remove(type, 1);
        this.spawnParticles(tx, ty, '#2ecc71', 10);
        this.uiManager.showNotification(`Placed ${type}!`);
        this.soundManager.play('place');
        this.achievementSystem.track('place');
        this.challengeSystem.track('place');
        this.statsSystem.inc('furniturePlaced');
      } else {
        this.uiManager.showNotification('Cannot place there!', 'error');
        this.soundManager.play('error');
      }
      this.dragHighlight = null;
    });

    this.canvas.addEventListener('mousedown', e => { this.isDragging = true; this.dragStart = { x: e.clientX, y: e.clientY }; });
    this.canvas.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (this.isDragging) {
        const dx = e.clientX - this.dragStart.x, dy = e.clientY - this.dragStart.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          this.camera.x += dx; this.camera.y += dy;
          this.dragStart = { x: e.clientX, y: e.clientY };
        }
      }
    });
    this.canvas.addEventListener('mouseup', e => {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStart.x, dy = e.clientY - this.dragStart.y;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) this.handleClick(e.clientX, e.clientY);
      }
      this.isDragging = false;
    });
    this.canvas.addEventListener('wheel', e => { e.preventDefault(); }, { passive: false });

    window.addEventListener('keydown', e => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.target.tagName === 'INPUT') return;

      if (this.minigame && this.minigame.state === 'playing') {
        if (e.code === 'Space') {
          e.preventDefault();
          if (this.minigame.attemptAttack) this.minigame.attemptAttack();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'enter': document.getElementById('chatInput')?.focus(); break;
        case 'w': this.player.isWaving = true; this.player.waveTimer = 0; this.player.say('Hey!'); break;
        case 'd': this.player.isDancing = !this.player.isDancing; this.uiManager.showNotification(this.player.isDancing ? 'Dancing!' : 'Stopped dancing'); break;
        case 'r': this.placementRotation = (this.placementRotation + 1) % 4; this.uiManager.showNotification(`Rotation: ${this.placementRotation * 90}°`); break;
        case 'm': this.toggleMinimap(); break;
        case 'p': this.togglePhotoMode(); break;
        case 's':
          if (this.photoMode) { this.takeScreenshot(); e.preventDefault(); }
          break;
        case 'n':
          this.uiManager.togglePanel('galleryPanel');
          this.uiManager.renderGallery();
          break;
        case 'escape':
          if (this.photoMode) { this.togglePhotoMode(); }
          else { this.uiManager.closeAllPanels(); }
          break;
      }
      if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(e.key.toLowerCase())) {
        e.preventDefault(); this.handleMovementKey(e.key);
      }
    });
    window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
  }

  handleMovementKey(key) {
    if (!this.player || this.player.isWalking || this.minigame) return;
    let dx = 0, dy = 0;
    const k = key.toLowerCase();
    if (k === 'arrowup' || k === 'w') { dx = 0; dy = -1; }
    else if (k === 'arrowdown' || k === 's') { dx = 0; dy = 1; }
    else if (k === 'arrowleft' || k === 'a') { dx = -1; dy = 0; }
    else if (k === 'arrowright' || k === 'd') { dx = 1; dy = 0; }
    if (dx !== 0 || dy !== 0) {
      const tx = Math.round(this.player.x) + dx, ty = Math.round(this.player.y) + dy;
      if (this.room.isWalkable(tx, ty, this.player)) { this.player.moveTo(tx, ty, this.room); this.statsSystem.inc('stepsWalked'); }
    }
  }

  handleClick(sx, sy) {
    if (this.minigame) return;
    const worldX = sx - this.camera.x, worldY = sy - this.camera.y;
    const iso = screenToIso(worldX, worldY + TILE_H / 2);
    const tx = Math.floor(iso.x), ty = Math.floor(iso.y);
    if (tx < 0 || ty < 0 || tx >= this.room.width || ty >= this.room.height) return;
    if (this.selectedTool === 'walk') {
      // Check treasure first
      const treasure = this.treasures.find(t => Math.floor(t.x) === tx && Math.floor(t.y) === ty);
      if (treasure) {
        this.currencySystem.add(treasure.coins * this.eventSystem.getCoinMultiplier());
        this.spawnParticles(tx, ty, '#f4d03f', 12);
        this.uiManager.showNotification(`Found ★${treasure.coins} in a treasure chest!`, 'success');
        this.soundManager.play('buy');
        this.statsSystem.inc('treasureChestsFound');
        this.challengeSystem.track('treasure');
        this.treasures = this.treasures.filter(t => t !== treasure);
        this.achievementSystem.track('walk');
        return;
      }
      // Check NPC click
      const npc = this.room.avatars.find(a => a.isNPC && Math.round(a.x) === tx && Math.round(a.y) === ty);
      if (npc) {
        this.uiManager.showNPCProfile(npc, () => {
          this.player.moveTo(tx, ty, this.room);
          this.achievementSystem.track('walk');
          this.statsSystem.inc('stepsWalked');
        });
        return;
      }
      if (this.room.isWalkable(tx, ty)) {
        this.player.moveTo(tx, ty, this.room);
        this.achievementSystem.track('walk');
        this.challengeSystem.track('walk');
        this.statsSystem.inc('stepsWalked');
        this.spawnParticles(tx, ty, 'rgba(244,208,63,0.6)', 5);
      }
    } else if (this.selectedTool === 'place' && this.selectedInventoryItem) {
      if (this.room.placeFurniture(this.selectedInventoryItem, tx, ty)) {
        this.inventorySystem.remove(this.selectedInventoryItem, 1);
        this.spawnParticles(tx, ty, '#2ecc71', 10);
        this.uiManager.showNotification(`Placed ${this.selectedInventoryItem}!`);
        if (this.room.id === 'myroom') this.saveMyRoom();
        if (!this.inventorySystem.has(this.selectedInventoryItem)) {
          this.selectedInventoryItem = null;
          this.selectedTool = 'walk';
          this.uiManager.updateToolButtons(this.selectedTool);
        }
      } else {
        this.uiManager.showNotification('Cannot place there!', 'error');
        this.soundManager.play('error');
      }
    } else if (this.selectedTool === 'pick') {
      const removed = this.room.removeFurnitureAt(tx, ty);
      if (removed) {
        this.inventorySystem.add(removed, 1);
        this.spawnParticles(tx, ty, '#e74c3c', 8);
        this.uiManager.showNotification(`Picked up ${removed}`);
        this.soundManager.play('place');
        if (this.room.id === 'myroom') this.saveMyRoom();
      }
    }
  }

  setupUI() {
    this.uiManager.createPanels();

    document.getElementById('btnNavigator')?.addEventListener('click', () => this.uiManager.togglePanel('navigatorPanel'));
    document.getElementById('btnCatalog')?.addEventListener('click', () => this.uiManager.togglePanel('catalogPanel'));
    document.getElementById('btnInventory')?.addEventListener('click', () => this.uiManager.togglePanel('inventoryPanel'));
    document.getElementById('btnSettings')?.addEventListener('click', () => this.uiManager.togglePanel('settingsPanel'));
    document.getElementById('btnCustomize')?.addEventListener('click', () => { this.uiManager.togglePanel('customizePanel'); this.renderCustomizePanel(); });
    document.getElementById('btnChatHistory')?.addEventListener('click', () => this.uiManager.togglePanel('chatPanel'));
    document.getElementById('btnFriends')?.addEventListener('click', () => { this.uiManager.togglePanel('friendsPanel'); this.renderFriendsPanel(); });
    document.getElementById('btnPet')?.addEventListener('click', () => { this.uiManager.togglePanel('petPanel'); this.renderPetPanel(); });
    document.getElementById('btnAchievements')?.addEventListener('click', () => { this.uiManager.togglePanel('achievementsPanel'); this.renderAchievementsPanel(); });
    document.getElementById('btnLeaderboard')?.addEventListener('click', () => { this.uiManager.togglePanel('leaderboardPanel'); this.renderLeaderboardPanel(); });
    document.getElementById('btnCrafting')?.addEventListener('click', () => { this.uiManager.togglePanel('craftingPanel'); this.renderCraftingPanel(); });
    document.getElementById('btnStats')?.addEventListener('click', () => { this.uiManager.togglePanel('statsPanel'); this.renderStatsPanel(); });
    document.getElementById('btnShortcuts')?.addEventListener('click', () => { this.uiManager.togglePanel('shortcutsPanel'); this.renderShortcutsPanel(); });
    document.getElementById('btnChallenges')?.addEventListener('click', () => { this.uiManager.togglePanel('challengesPanel'); this.renderChallengesPanel(); });
    document.getElementById('btnNotifications')?.addEventListener('click', () => { this.uiManager.togglePanel('notificationsPanel'); this.uiManager.renderNotificationHistory(); });

    document.getElementById('hairStyleSelect')?.addEventListener('change', e => { this.customize.hairStyle = e.target.value; this.renderCustomizePanel(); });
    document.getElementById('hatSelect')?.addEventListener('change', e => { this.customize.hatType = e.target.value; this.renderCustomizePanel(); });
    document.getElementById('glassesSelect')?.addEventListener('change', e => { this.customize.glassesType = e.target.value; this.renderCustomizePanel(); });

    document.getElementById('btnSaveLook')?.addEventListener('click', () => { this.applyAvatarToPlayer(); this.saveAvatarToStorage(); this.uiManager.showNotification('Look saved!'); });
    document.getElementById('btnRandomLook')?.addEventListener('click', () => {
      const rand = arr => arr[Math.floor(Math.random() * arr.length)];
      this.customize.skinColor = rand(['#F5CBA7','#E0AC69','#8D5524','#C68642','#FFDBAC','#AA7C58']);
      this.customize.hairColor = rand(['#090806','#2C1608','#71635A','#B7A69E','#D6C4C2','#B55239','#A52A2A','#DC143C','#4B0082','#228B22']);
      this.customize.hairStyle = rand(['short','spiky','long','mohawk','bald','curly','bob']);
      this.customize.shirtColor = rand(['#E74C3C','#3498DB','#2ECC71','#F1C40F','#9B59B6','#E67E22','#1ABC9C','#34495E']);
      this.customize.pantsColor = rand(['#2C3E50','#34495E','#1ABC9C','#8E44AD','#D35400','#7F8C8D']);
      this.customize.shoeColor = rand(['#555555','#333333','#8B4513','#000000']);
      this.customize.hatType = rand(['none','none','none','cap','beanie','crown','wizard']);
      this.customize.glassesType = rand(['none','none','none','shades','round']);
      this.renderCustomizePanel();
    });

    document.querySelectorAll('.panel-close').forEach(btn => {
      btn.addEventListener('click', () => { document.getElementById(btn.dataset.panel)?.classList.remove('open'); });
    });

    document.getElementById('toolChat')?.addEventListener('click', () => document.getElementById('chatInput')?.focus());
    document.getElementById('toolWalk')?.addEventListener('click', () => this.setTool('walk'));
    document.getElementById('toolPlace')?.addEventListener('click', () => {
      if (Object.keys(this.inventorySystem.getAll()).length === 0) { this.uiManager.showNotification('Inventory is empty! Buy items from the catalog.', 'error'); return; }
      this.setTool('place'); this.uiManager.togglePanel('inventoryPanel');
    });
    document.getElementById('toolPick')?.addEventListener('click', () => this.setTool('pick'));
    document.getElementById('toolRotate')?.addEventListener('click', () => { this.placementRotation = (this.placementRotation + 1) % 4; this.uiManager.showNotification(`Rotation: ${this.placementRotation * 90}°`); });
    document.getElementById('toolDance')?.addEventListener('click', () => { this.player.isDancing = !this.player.isDancing; this.uiManager.showNotification(this.player.isDancing ? 'Dancing!' : 'Stopped dancing'); });
    document.getElementById('toolWave')?.addEventListener('click', () => { this.player.isWaving = true; this.player.waveTimer = 0; this.player.say('Hey!'); });
    document.getElementById('toolMinimap')?.addEventListener('click', () => this.toggleMinimap());
    document.getElementById('toolMinigame')?.addEventListener('click', () => {
      this.uiManager.togglePanel('minigamePanel');
      this.renderMinigamePanel();
    });

    const sendChat = () => {
      const input = document.getElementById('chatInput');
      const text = input?.value.trim();
      if (!text) return;
      input.value = '';
      input.blur();
      this.chatManager.updateTypingIndicator(false);
      this.chatManager.send(text);
    this.soundManager.play('chat');
    this.achievementSystem.track('chat');
    this.challengeSystem.track('chat');
    };
    document.getElementById('chatSend')?.addEventListener('click', sendChat);
    document.getElementById('chatInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
      if (e.key === 'Escape') { e.target.blur(); this.chatManager.updateTypingIndicator(false); }
    });
    document.getElementById('chatInput')?.addEventListener('input', () => {
      this.chatManager.updateTypingIndicator(true);
      clearTimeout(this._typingTimer);
      this._typingTimer = setTimeout(() => this.chatManager.updateTypingIndicator(false), 1500);
    });

    const colorBtn = document.getElementById('chatColorBtn');
    const colorPopover = document.getElementById('chatColorPopover');
    if (colorBtn) {
      colorBtn.style.backgroundColor = this.chatColor;
      colorBtn.addEventListener('click', e => { e.stopPropagation(); colorPopover?.classList.toggle('open'); });
    }
    colorPopover?.querySelectorAll('.chat-color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        this.chatColor = swatch.dataset.color;
        this.chatManager.chatColor = this.chatColor;
        if (colorBtn) colorBtn.style.backgroundColor = this.chatColor;
        colorPopover.querySelectorAll('.chat-color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        colorPopover.classList.remove('open');
      });
    });

    // Global button click sounds (delegate for dynamic elements)
    document.addEventListener('click', e => {
      if (e.target.closest('button, .top-btn, .tool-btn, .room-item, .catalog-item, .inv-item, .color-swatch')) {
        this.soundManager.play('click');
      }
    });
    document.addEventListener('click', e => {
      if (colorPopover && !colorPopover.contains(e.target) && e.target !== colorBtn) colorPopover.classList.remove('open');
    });

    document.getElementById('settingMinimap')?.addEventListener('change', e => { this.settings.showMinimap = e.target.checked; document.getElementById('minimap')?.classList.toggle('open', this.settings.showMinimap); });
    document.getElementById('settingNames')?.addEventListener('change', e => { this.settings.showNames = e.target.checked; });
    document.getElementById('settingChat')?.addEventListener('change', e => { this.settings.showChat = e.target.checked; });
    document.getElementById('settingNPCs')?.addEventListener('change', e => {
      this.settings.npcCount = parseInt(e.target.value);
      this.spawnNPCs(this.settings.npcCount);
    });
    document.getElementById('settingCamSpeed')?.addEventListener('input', e => { this.settings.camSpeed = parseInt(e.target.value); });
    document.getElementById('settingSound')?.addEventListener('change', e => { this.settings.sound = e.target.checked; });
    document.getElementById('settingSound')?.addEventListener('change', e => { this.settings.sound = e.target.checked; this.soundManager.setEnabled(e.target.checked); this.uiManager.showNotification(e.target.checked ? 'Sound enabled' : 'Sound muted'); });
    document.getElementById('settingSafeMode')?.addEventListener('change', e => { this.settings.safeMode = e.target.checked; this.uiManager.showNotification(e.target.checked ? 'Safe Mode enabled' : 'Safe Mode disabled'); });
    document.getElementById('btnExportSave')?.addEventListener('click', () => this.exportSave());
    document.getElementById('btnImportSave')?.addEventListener('click', () => document.getElementById('importFileInput')?.click());
    document.getElementById('importFileInput')?.addEventListener('change', e => this.importSave(e));

    document.getElementById('minimap')?.classList.toggle('open', this.settings.showMinimap);

    this.renderNavigator();
    this.renderCatalog();
    this.renderInventory();
    this.renderMinigamePanel();
    this.uiManager.updateCurrency(this.currencySystem.get());
    this.uiManager.updateToolButtons(this.selectedTool);
  }

  setTool(tool) { this.selectedTool = tool; this.uiManager.updateToolButtons(this.selectedTool); }
  toggleMinimap() { this.settings.showMinimap = !this.settings.showMinimap; document.getElementById('minimap')?.classList.toggle('open', this.settings.showMinimap); const cb = document.getElementById('settingMinimap'); if (cb) cb.checked = this.settings.showMinimap; }
  takeScreenshot() {
    try {
      const dataUrl = this.canvas.toDataURL('image/png');
      let gallery = [];
      try { gallery = JSON.parse(localStorage.getItem('starlight_gallery')) || []; } catch (e) {}
      gallery.unshift({ data: dataUrl, date: Date.now() });
      if (gallery.length > 10) gallery = gallery.slice(0, 10);
      localStorage.setItem('starlight_gallery', JSON.stringify(gallery));
      this.uiManager.showNotification('Screenshot saved! Press N to view gallery.', 'success');
      this.soundManager.play('click');
    } catch (e) {}
  }

  togglePhotoMode() {
    this.photoMode = !this.photoMode;
    const ui = document.getElementById('uiOverlay');
    const bars = document.getElementById('topBar');
    const toolbar = document.getElementById('toolbar');
    const chat = document.getElementById('chatBar');
    const roomInfo = document.getElementById('roomInfo');
    const notif = document.getElementById('notificationArea');
    const els = [bars, toolbar, chat, roomInfo, notif];
    if (this.photoMode) {
      this.uiManager.closeAllPanels();
      els.forEach(el => { if (el) el.style.opacity = '0'; });
      this.uiManager.showNotification('Photo Mode — Press P or ESC to exit', 'info');
    } else {
      els.forEach(el => { if (el) el.style.opacity = '1'; });
    }
  }

  loadThemes() {
    try {
      const data = JSON.parse(localStorage.getItem('starlight_themes'));
      if (data) {
        this.ownedThemes = data.owned || ['classic'];
        this.currentTheme = data.current || 'classic';
      }
    } catch (e) {}
  }

  saveThemes() {
    try { localStorage.setItem('starlight_themes', JSON.stringify({ owned: this.ownedThemes, current: this.currentTheme })); } catch (e) {}
  }

  applyThemeToMyRoom() {
    const theme = ROOM_THEMES.find(t => t.id === this.currentTheme);
    if (!theme) return;
    // Apply to the My Room template so next load uses it
    const myRoomTemplate = ROOM_TEMPLATES.find(r => r.id === 'myroom');
    if (myRoomTemplate) {
      myRoomTemplate.floor = theme.floor;
      myRoomTemplate.wall = theme.wall;
    }
    // If currently in My Room, apply live
    if (this.room && this.room.id === 'myroom') {
      this.room.floorType = theme.floor;
      this.room.wallColor = theme.wall;
      this.saveMyRoom();
    }
  }

  renderNavigator() {
    this.uiManager.renderNavigator(ROOM_TEMPLATES, room => {
      this.loadRoom(room);
      this.achievementSystem.visitRoom(room.id);
      this.statsSystem.inc('roomsVisited');
      this.uiManager.showNotification(`Entered ${room.name}`);
      this.uiManager.closeAllPanels();
    });
    this.uiManager.renderThemes(ROOM_THEMES, this.ownedThemes, this.currentTheme, this.currencySystem.get(),
      theme => {
        if (this.currencySystem.spend(theme.price)) {
          this.ownedThemes.push(theme.id);
          this.currentTheme = theme.id;
          this.saveThemes();
          this.applyThemeToMyRoom();
          this.uiManager.showNotification(`Purchased ${theme.name}!`, 'success');
          this.uiManager.updateCurrency(this.currencySystem.get());
          this.renderNavigator();
          this.achievementSystem.track('buy');
        } else {
          this.uiManager.showNotification('Not enough StarCoins!', 'error');
          this.soundManager.play('error');
        }
      },
      theme => {
        this.currentTheme = theme.id;
        this.saveThemes();
        this.applyThemeToMyRoom();
        this.uiManager.showNotification(`Applied ${theme.name}!`);
        this.renderNavigator();
      }
    );
  }

  renderCatalog() {
    const items = this.catalogCategory === 'all' ? FURNITURE_CATALOG : FURNITURE_CATALOG.filter(i => i.category === this.catalogCategory);
    this.uiManager.renderCatalog(items, CATALOG_CATEGORIES, this.catalogCategory, this.currencySystem.get(),
      item => {
        if (this.currencySystem.spend(item.price)) {
          this.inventorySystem.add(item.id, 1);
          this.uiManager.updateCurrency(this.currencySystem.get());
          this.uiManager.showNotification(`Purchased ${item.name}!`);
          this.soundManager.play('buy');
          this.achievementSystem.track('buy');
          this.statsSystem.inc('furnitureBought');
        this.challengeSystem.track('buy');
          this.statsSystem.inc('totalCoinsSpent', item.price);
          this.renderCatalog();
        } else {
          this.uiManager.showNotification('Not enough StarCoins!', 'error');
          this.soundManager.play('error');
        }
      },
      catId => { this.catalogCategory = catId; this.renderCatalog(); }
    );
  }

  renderInventory() {
    this.uiManager.renderInventory(this.inventorySystem.getAll(), this.selectedInventoryItem,
      type => {
        this.selectedInventoryItem = type;
        this.selectedTool = 'place';
        this.uiManager.updateToolButtons(this.selectedTool);
        this.renderInventory();
        this.uiManager.showNotification(`Selected ${type} — click a tile to place`);
      },
      type => {
        const item = FURNITURE_CATALOG.find(i => i.id === type);
        const sellPrice = item ? Math.floor(item.price * 0.5) : 10;
        this.inventorySystem.remove(type, 1);
        this.currencySystem.add(sellPrice);
        this.uiManager.showNotification(`Sold ${type} for ★${sellPrice}`, 'success');
        this.soundManager.play('buy');
        this.renderInventory();
      }
    );
  }

  loadAvatarFromStorage() {
    try {
      const data = JSON.parse(localStorage.getItem('starlight_avatar'));
      if (data) Object.assign(this.customize, data);
    } catch (e) {}
  }

  saveAvatarToStorage() {
    try { localStorage.setItem('starlight_avatar', JSON.stringify(this.customize)); } catch (e) {}
  }

  applyAvatarToPlayer() {
    if (!this.player) return;
    const c = this.customize;
    this.player.skinColor = c.skinColor;
    this.player.hairColor = c.hairColor;
    this.player.hairStyle = c.hairStyle;
    this.player.shirtColor = c.shirtColor;
    this.player.pantsColor = c.pantsColor;
    this.player.shoeColor = c.shoeColor;
    this.player.hatType = c.hatType;
    this.player.glassesType = c.glassesType;
    clearAvatarCache(this.player.assetKey);
  }

  renderCustomizePanel() {
    this.uiManager.renderCustomizePanel(this.customize, (key, val) => {
      this.customize[key] = val;
      this.renderCustomizePanel();
    }, () => {
      this.applyAvatarToPlayer();
      this.saveAvatarToStorage();
      this.uiManager.showNotification('Look saved!');
      this.achievementSystem.track('customize');
    this.challengeSystem.track('customize');
    }, () => {
      const rand = arr => arr[Math.floor(Math.random() * arr.length)];
      this.customize.skinColor = rand(['#F5CBA7','#E0AC69','#8D5524','#C68642','#FFDBAC','#AA7C58']);
      this.customize.hairColor = rand(['#090806','#2C1608','#71635A','#B7A69E','#D6C4C2','#B55239','#A52A2A','#DC143C','#4B0082','#228B22']);
      this.customize.hairStyle = rand(['short','spiky','long','mohawk','bald','curly','bob']);
      this.customize.shirtColor = rand(['#E74C3C','#3498DB','#2ECC71','#F1C40F','#9B59B6','#E67E22','#1ABC9C','#34495E']);
      this.customize.pantsColor = rand(['#2C3E50','#34495E','#1ABC9C','#8E44AD','#D35400','#7F8C8D']);
      this.customize.shoeColor = rand(['#555555','#333333','#8B4513','#000000']);
      this.customize.hatType = rand(['none','none','none','cap','beanie','crown','wizard']);
      this.customize.glassesType = rand(['none','none','none','shades','round']);
      this.renderCustomizePanel();
    });
  }

  renderColorPresets(containerId, colors, current, key) {
    this.uiManager.renderColorPresets(containerId, colors, current, key, (k, v) => {
      this.customize[k] = v;
      this.renderCustomizePanel();
    });
  }

  exportSave() {
    const data = {
      currency: this.currencySystem.get(),
      inventory: this.inventorySystem.getAll(),
      avatar: this.customize,
      themes: { owned: this.ownedThemes, current: this.currentTheme },
      achievements: { progress: this.achievementSystem.progress, claimed: Array.from(this.achievementSystem.claimed), totalEarned: this.achievementSystem.totalEarned, visitedRooms: Array.from(this.achievementSystem.visitedRooms) },
      friends: this.friendSystem.friends,
      pet: this.petSystem.pet,
      daily: { streak: this.dailyRewards.streak, lastClaim: this.dailyRewards.lastClaim },
      leaderboard: this.leaderboardSystem.scores,
      myroom: localStorage.getItem('starlight_myroom'),
      version: '2.1'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `starlight-inn-save-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.uiManager.showNotification('Save exported!', 'success');
  }

  importSave(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.currency !== undefined) { this.currencySystem.amount = data.currency; this.currencySystem.save(); }
        if (data.inventory) { this.inventorySystem.items = data.inventory; this.inventorySystem.save(); }
        if (data.avatar) { this.customize = data.avatar; this.saveAvatarToStorage(); this.applyAvatarToPlayer(); }
        if (data.themes) { this.ownedThemes = data.themes.owned || ['classic']; this.currentTheme = data.themes.current || 'classic'; this.saveThemes(); this.applyThemeToMyRoom(); }
        if (data.achievements) { this.achievementSystem.progress = data.achievements.progress || {}; this.achievementSystem.claimed = new Set(data.achievements.claimed || []); this.achievementSystem.totalEarned = data.achievements.totalEarned || 0; this.achievementSystem.visitedRooms = new Set(data.achievements.visitedRooms || []); this.achievementSystem.save(); }
        if (data.friends) { this.friendSystem.friends = data.friends; this.friendSystem.save(); }
        if (data.pet) { this.petSystem.pet = data.pet; this.petSystem.save(); }
        if (data.daily) { this.dailyRewards.streak = data.daily.streak || 0; this.dailyRewards.lastClaim = data.daily.lastClaim || 0; this.dailyRewards.save(); }
        if (data.leaderboard) { this.leaderboardSystem.scores = data.leaderboard; this.leaderboardSystem.save(); }
        if (data.myroom) { localStorage.setItem('starlight_myroom', data.myroom); }
        this.uiManager.showNotification('Save imported! Reloading...', 'success');
        setTimeout(() => location.reload(), 1200);
      } catch (err) {
        this.uiManager.showNotification('Invalid save file!', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  saveAllData() {
    this.currencySystem.save();
    this.inventorySystem.save();
    this.saveAvatarToStorage();
    this.saveThemes();
    this.saveMyRoom();
    this.achievementSystem.save();
    this.friendSystem.save();
    this.petSystem.save();
    this.leaderboardSystem.save();
  }

  saveMyRoom() {
    if (!this.room || this.room.id !== 'myroom') return;
    try {
      const data = {
        furniture: this.room.furniture.map(f => ({ type: f.type, x: f.x, y: f.y, z: f.z })),
        floor: this.room.floorType,
        wall: this.room.wallColor
      };
      localStorage.setItem('starlight_myroom', JSON.stringify(data));
    } catch (e) {}
  }

  loadMyRoom() {
    try {
      const data = JSON.parse(localStorage.getItem('starlight_myroom'));
      if (data && this.room && this.room.id === 'myroom') {
        this.room.furniture = (data.furniture || []).map(f => new Furniture(f.type, f.x, f.y, f.z));
        if (data.floor) this.room.floorType = data.floor;
        if (data.wall) this.room.wallColor = data.wall;
      }
    } catch (e) {}
  }

  renderFriendsPanel() {
    this.uiManager.renderFriends(this.friendSystem.friends, (friendId, itemType) => {
      if (this.friendSystem.giftFriend(friendId, itemType)) {
        this.uiManager.showNotification('Gift sent! Friendship increased!', 'success');
        this.renderFriendsPanel();
        this.renderInventory();
      } else {
        this.uiManager.showNotification('Cannot send gift!', 'error');
      }
    });
  }

  renderPetPanel() {
    this.uiManager.renderPetPanel(this.petSystem,
      type => {
        if (type) {
          this.petSystem.adopt(type);
          this.uiManager.showNotification(`You adopted a ${type}!`, 'success');
        } else {
          this.petSystem.release();
          this.uiManager.showNotification('Pet released.', 'info');
        }
        this.renderPetPanel();
      },
      () => {
        if (this.petSystem.feed()) {
          this.uiManager.showNotification('Pet fed! Yum!', 'success');
          this.renderPetPanel();
        }
      },
      () => {
        if (this.petSystem.play()) {
          this.uiManager.showNotification('Pet played! So happy!', 'success');
          this.renderPetPanel();
        }
      },
      () => {
        if (this.petSystem.rest()) {
          this.uiManager.showNotification('Pet is resting...', 'info');
          this.renderPetPanel();
        }
      }
    );
  }

  renderAchievementsPanel() {
    this.uiManager.renderAchievements(this.achievementSystem.getList());
  }

  renderLeaderboardPanel() {
    const games = [
      { id: 'ringuppercut', name: 'Ring Uppercut' },
      { id: 'memorymatch', name: 'Memory Match' },
      { id: 'tilepuzzle', name: 'Tile Puzzle' }
    ];
    this.uiManager.renderLeaderboard(games, id => this.leaderboardSystem.getTop(id));
  }

  renderStatsPanel() {
    this.uiManager.renderStats(this.statsSystem.getStats());
  }

  renderChallengesPanel() {
    this.uiManager.renderChallenges(this.challengeSystem.getList());
  }

  renderShortcutsPanel() {
    this.uiManager.renderShortcuts([
      { key: 'W / A / S / D', action: 'Walk around' },
      { key: 'Arrows', action: 'Walk around' },
      { key: 'Enter', action: 'Focus chat input' },
      { key: 'W', action: 'Wave (when not typing)' },
      { key: 'D', action: 'Toggle dance' },
      { key: 'R', action: 'Rotate placement' },
      { key: 'M', action: 'Toggle minimap' },
      { key: 'P', action: 'Toggle photo mode' },
      { key: 'ESC', action: 'Close panels / exit photo mode' },
      { key: 'Space', action: 'Punch in minigames' },
      { key: 'Click + Drag', action: 'Pan camera' },
      { key: 'Right-click item', action: 'Sell from inventory' },
    ]);
  }

  renderCraftingPanel() {
    this.uiManager.renderCrafting(this.craftingSystem.getAvailableRecipes(), id => {
      const recipe = CRAFTING_RECIPES.find(r => r.id === id);
      if (recipe && this.craftingSystem.craft(recipe)) {
        this.uiManager.showNotification(`Crafted ${recipe.name}!`, 'success');
        this.soundManager.play('buy');
        this.renderCraftingPanel();
        this.renderInventory();
        this.achievementSystem.track('place');
      } else {
        this.uiManager.showNotification('Missing ingredients!', 'error');
        this.soundManager.play('error');
      }
    });
  }

  renderMinigamePanel() {
    const games = [
      { name: 'Ring Uppercut', desc: 'Time your punches in the boxing ring!', reward: '200-500', class: RingUppercut },
      { name: 'Memory Match', desc: 'Flip cards and find matching pairs!', reward: '250', class: MemoryMatch },
      { name: 'Tile Puzzle', desc: 'Slide tiles to solve the puzzle!', reward: '300', class: TilePuzzle }
    ];
    this.uiManager.renderMinigamePanel(games, g => {
      this.startMinigame(g.class);
      this.uiManager.closeAllPanels();
    });
  }

  checkDailyRewards() {
    if (this.dailyRewards.canClaim()) {
      this.uiManager.showDailyRewardPanel(this.dailyRewards, () => {
        const reward = this.dailyRewards.claim();
        if (reward) {
          this.uiManager.showNotification(`Day ${reward.day} reward: ★${reward.coins}${reward.item ? ' + ' + reward.item : ''}!`, 'success');
          this.renderInventory();
          this.uiManager.updateCurrency(this.currencySystem.get());
        }
      });
    }
  }

  renderCustomizePreview() {
    const canvas = document.getElementById('previewCanvas');
    if (!canvas) return;
    const c = this.customize;
    const img = createAvatarCanvas(c.skinColor, c.hairColor, c.hairStyle, c.shirtColor, c.pantsColor, c.shoeColor, c.hatType, c.glassesType);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 22, 20, 44, 64);
  }

  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;
    this.update(dt);
    if (!this.hasRendered) {
      this.hasRendered = true;
      const loading = document.getElementById('loadingScreen');
      if (loading) loading.classList.add('hidden');
    }
    this.render();
    this.chatManager.renderBubbles();
    requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    if (this.minigame) {
      this.minigame.update(dt);
      if (this.minigame.state === 'ended') {
        if (this.keys['escape']) {
          this.endMinigame();
        }
      }
      return;
    }

    if (this.player) {
      const psp = isoToScreen(this.player.x, this.player.y);
      const camSpeed = this.settings.camSpeed / 100;
      this.targetCamera = { x: this.width / 2 - psp.x, y: this.height / 2 - psp.y + 90 };
      this.camera.x = lerp(this.camera.x, this.targetCamera.x, camSpeed);
      this.camera.y = lerp(this.camera.y, this.targetCamera.y, camSpeed);
    }
    // Clamp camera to room bounds
    if (this.room) {
      const pad = 80;
      const leftX = isoToScreen(0, this.room.height).x;
      const rightX = isoToScreen(this.room.width, 0).x;
      const topY = isoToScreen(0, 0).y - WALL_H;
      const bottomY = isoToScreen(this.room.width, this.room.height).y;
      const minX = pad - rightX;
      const maxX = this.width - pad - leftX;
      const minY = pad - bottomY;
      const maxY = this.height - pad - topY;
      this.camera.x = clamp(this.camera.x, minX, maxX);
      this.camera.y = clamp(this.camera.y, minY, maxY);
    }
    if (this.room) {
      this.room.avatars.forEach(a => a.update(dt, this.room));
      this.npcManager.update(dt, this.room);
      this.friendSystem.update(dt);
      this.petSystem.tick(dt);
      this.statsSystem.tick(dt);
      this.eventSystem.update(dt);
      this.challengeSystem._refreshIfNeeded();
      // Treasure spawning
      const treasureInterval = this.eventSystem ? this.eventSystem.getTreasureInterval() : 45;
      this.treasureTimer += dt;
      if (this.treasureTimer > treasureInterval && this.treasures.length < 3) {
        this.treasureTimer = 0;
        for (let i = 0; i < 20; i++) {
          const tx = Math.floor(Math.random() * this.room.width);
          const ty = Math.floor(Math.random() * this.room.height);
          if (this.room.isWalkable(tx, ty)) {
            this.treasures.push({ x: tx, y: ty, coins: 25 + Math.floor(Math.random() * 76), life: 30 });
            break;
          }
        }
      }
      for (let i = this.treasures.length - 1; i >= 0; i--) {
        this.treasures[i].life -= dt;
        if (this.treasures[i].life <= 0) this.treasures.splice(i, 1);
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }
    const worldX = this.mouse.x - this.camera.x, worldY = this.mouse.y - this.camera.y;
    const iso = screenToIso(worldX, worldY + TILE_H / 2);
    this.hoverTile = { x: Math.floor(iso.x), y: Math.floor(iso.y) };
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    if (this.minigame) {
      this.minigame.render(ctx);
      return;
    }

    if (!this.room) return;
    ctx.save(); ctx.translate(this.camera.x, this.camera.y);

    for (let y = 0; y < this.room.height; y++) {
      for (let x = 0; x < this.room.width; x++) {
        const tile = this.room.map[y]?.[x];
        if (!tile) continue;
        const sp = isoToScreen(x, y);
        const tileImg = getTilePattern(this.room.floorType);
        ctx.drawImage(tileImg, sp.x - TILE_W / 2 - 1, sp.y - 1);
        if (!this.room.map[y - 1]?.[x] && y > 0) {
          const wallImg = getWallPattern(this.room.wallColor);
          ctx.drawImage(wallImg, sp.x - TILE_W / 2 - 1, sp.y - WALL_H - TILE_H / 2 - 1);
        }
        if (!this.room.map[y]?.[x - 1] && x > 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.beginPath();
          ctx.moveTo(sp.x - TILE_W / 2, sp.y); ctx.lineTo(sp.x, sp.y - TILE_H / 2);
          ctx.lineTo(sp.x, sp.y - TILE_H / 2 - WALL_H); ctx.lineTo(sp.x - TILE_W / 2, sp.y - WALL_H);
          ctx.closePath(); ctx.fill();
        }
      }
    }

    if (this.room.scenery) {
      this.room.scenery.forEach(s => {
        const sp = isoToScreen(s.x, s.y);
        // createSceneryCanvas is in Generator
        const img = createSceneryCanvas(s.type);
        if (img) ctx.drawImage(img, sp.x - img.width / 2, sp.y - img.height + TILE_H);
      });
    }

    this.renderAmbience(ctx);

    // Render treasures
    this.treasures.forEach(t => {
      const sp = isoToScreen(t.x, t.y);
      const bob = Math.sin(Date.now() / 300) * 3;
      ctx.font = '20px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📦', sp.x, sp.y + bob - 8);
      ctx.fillStyle = 'rgba(244,208,63,0.8)';
      ctx.font = 'bold 9px Nunito, sans-serif';
      ctx.fillText(`★${t.coins}`, sp.x, sp.y + bob + 10);
    });

    const renderList = [];
    this.room.furniture.forEach(f => { renderList.push({ type: 'furniture', obj: f, zIndex: this.getZIndex(f.x, f.y, f.z + 0.5) }); });
    this.room.avatars.forEach(a => { renderList.push({ type: 'avatar', obj: a, zIndex: this.getZIndex(a.x, a.y, a.z + 1) }); });
    renderList.sort((a, b) => a.zIndex - b.zIndex);
    renderList.forEach(item => {
      if (item.type === 'furniture') this.drawFurniture(ctx, item.obj);
      else if (item.type === 'avatar') this.drawAvatar(ctx, item.obj);
    });

    if (this.hoverTile && this.hoverTile.x >= 0 && this.hoverTile.y >= 0 &&
        this.hoverTile.x < this.room.width && this.hoverTile.y < this.room.height &&
        this.room.map[this.hoverTile.y]?.[this.hoverTile.x]) {
      const hsp = isoToScreen(this.hoverTile.x, this.hoverTile.y);
      ctx.strokeStyle = 'rgba(244, 208, 63, 0.8)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hsp.x, hsp.y); ctx.lineTo(hsp.x + TILE_W / 2, hsp.y + TILE_H / 2);
      ctx.lineTo(hsp.x, hsp.y + TILE_H); ctx.lineTo(hsp.x - TILE_W / 2, hsp.y + TILE_H / 2);
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = 'rgba(244, 208, 63, 0.12)'; ctx.fill();

      if (this.dragHighlight && this.dragHighlight.x === this.hoverTile.x && this.dragHighlight.y === this.hoverTile.y) {
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.8)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hsp.x, hsp.y); ctx.lineTo(hsp.x + TILE_W / 2, hsp.y + TILE_H / 2);
        ctx.lineTo(hsp.x, hsp.y + TILE_H); ctx.lineTo(hsp.x - TILE_W / 2, hsp.y + TILE_H / 2);
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle = 'rgba(46, 204, 113, 0.15)'; ctx.fill();
      }

      if (this.selectedTool === 'place' && this.selectedInventoryItem) {
        const cat = FURNITURE_CATALOG.find(c => c.id === this.selectedInventoryItem);
        if (cat) {
          ctx.globalAlpha = 0.55;
          const img = getFurnitureAsset(this.selectedInventoryItem);
          const fsp = isoToScreen(this.hoverTile.x, this.hoverTile.y);
          ctx.drawImage(img, fsp.x - img.width / 2, fsp.y - img.height + TILE_H);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(46, 204, 113, 0.6)'; ctx.lineWidth = 1.5;
          for (let dx = 0; dx < cat.footprint[0]; dx++) {
            for (let dy = 0; dy < cat.footprint[1]; dy++) {
              const tsp = isoToScreen(this.hoverTile.x + dx, this.hoverTile.y + dy);
              ctx.beginPath();
              ctx.moveTo(tsp.x, tsp.y); ctx.lineTo(tsp.x + TILE_W / 2, tsp.y + TILE_H / 2);
              ctx.lineTo(tsp.x, tsp.y + TILE_H); ctx.lineTo(tsp.x - TILE_W / 2, tsp.y + TILE_H / 2);
              ctx.closePath(); ctx.stroke();
            }
          }
        }
      }
    }

    ctx.restore();
    this.particles.forEach(p => p.draw(ctx));
    if (this.player && this.petSystem) {
      this.petSystem.draw(ctx, this.player.x, this.player.y, this.camera);
    }
    this.renderMinimap();
  }

  getZIndex(x, y, z) { return (x + y) * 100 + z * 10; }

  renderAmbience(ctx) {
    const rid = this.room.id;
    const time = Date.now();
    if (rid === 'beach') {
      const seagullX = ((time / 20) % (this.room.width * TILE_W + 200)) - 100;
      const seagullY = -this.room.height * TILE_H / 2 - 40 + Math.sin(time / 800) * 15;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(seagullX, seagullY);
      ctx.lineTo(seagullX + 8, seagullY + 4);
      ctx.lineTo(seagullX + 16, seagullY);
      ctx.lineTo(seagullX + 8, seagullY + 2);
      ctx.closePath();
      ctx.fill();
    } else if (rid === 'pool') {
      ctx.fillStyle = `rgba(255,255,255,${0.03 + Math.sin(time/300)*0.02})`;
      for (let y = 0; y < this.room.height; y++) {
        for (let x = 0; x < this.room.width; x++) {
          if (this.room.map[y]?.[x]) {
            const sp = isoToScreen(x, y);
            if ((x+y)%2===0) ctx.fillRect(sp.x - TILE_W/2, sp.y - TILE_H/2, TILE_W, TILE_H);
          }
        }
      }
    } else if (rid === 'club') {
      ctx.fillStyle = `rgba(244, 0, 255, ${0.03 + Math.sin(time/400)*0.02})`;
      ctx.fillRect(-this.width, -this.height, this.width*3, this.height*3);
    } else if (rid === 'cinema') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-this.width, -this.height, this.width*3, this.height*3);
    } else if (rid === 'forest') {
      for (let i = 0; i < 5; i++) {
        const lx = ((time/30 + i*73) % (this.room.width * TILE_W + 100)) - 50;
        const ly = ((time/20 + i*47) % (this.room.height * TILE_H + 100)) - 50;
        ctx.fillStyle = ['#E67E22','#F1C40F','#C0392B','#27AE60'][i%4];
        ctx.beginPath();
        ctx.ellipse(lx, ly, 3, 2, time/500 + i, 0, Math.PI*2);
        ctx.fill();
      }
    }

    // Weather effects
    if (rid === 'garden' || rid === 'forest') {
      ctx.strokeStyle = 'rgba(180,210,255,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const rx = ((time / 15 + i * 137) % (this.width + 100)) - 50;
        const ry = ((time / 8 + i * 89) % (this.height + 100)) - 50;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 3, ry + 12);
        ctx.stroke();
      }
    } else if (rid === 'spa' || rid === 'cinema') {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let i = 0; i < 20; i++) {
        const rx = ((time / 40 + i * 213) % (this.width + 80)) - 40;
        const ry = ((time / 30 + i * 157) % (this.height + 80)) - 40;
        ctx.beginPath();
        ctx.arc(rx, ry, 2 + Math.sin(time / 400 + i) * 1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (rid === 'beach') {
      ctx.fillStyle = 'rgba(255,250,200,0.08)';
      for (let i = 0; i < 15; i++) {
        const rx = ((time / 50 + i * 301) % (this.width + 60)) - 30;
        const ry = ((time / 35 + i * 197) % (this.height + 60)) - 30;
        ctx.beginPath();
        ctx.arc(rx, ry, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawFurniture(ctx, f) {
    const sp = isoToScreen(f.x, f.y);
    const img = getFurnitureAsset(f.type);
    const time = Date.now();
    ctx.drawImage(img, sp.x - img.width / 2, sp.y - img.height + TILE_H - f.z * (TILE_H / 2));

    // Animated overlays
    if (f.type === 'lamp' || f.type === 'chandelier') {
      ctx.fillStyle = `rgba(255,255,200,${0.15 + Math.sin(time/300)*0.08})`;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y - 20, 18, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.type === 'fountain') {
      ctx.fillStyle = `rgba(135,206,235,${0.3 + Math.sin(time/250)*0.15})`;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y - 35, 4 + Math.sin(time/200)*2, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.type === 'neon_sign') {
      ctx.shadowColor = '#ff00ff';
      ctx.shadowBlur = 8 + Math.sin(time/150)*4;
      ctx.fillStyle = `rgba(255,0,255,${0.4 + Math.sin(time/200)*0.2})`;
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OPEN', sp.x, sp.y - 25);
      ctx.shadowBlur = 0;
    } else if (f.type === 'fireplace') {
      ctx.fillStyle = `rgba(231,76,60,${0.25 + Math.sin(time/180)*0.1})`;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y - 15, 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.type === 'tv') {
      ctx.fillStyle = `rgba(102,204,255,${0.2 + Math.sin(time/400)*0.1})`;
      ctx.fillRect(sp.x - 10, sp.y - 30, 20, 14);
    }
  }

  drawAvatar(ctx, avatar) {
    const sp = avatar.screenPos;
    const img = getAvatarAsset(avatar.assetKey);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    const shadowSp = isoToScreen(avatar.x, avatar.y);
    ctx.ellipse(shadowSp.x, shadowSp.y + TILE_H / 2 - 2, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    if (avatar.isSitting) {
      const sitY = sp.y + 12;
      if (avatar.facing === 'nw') {
        ctx.translate(sp.x, sitY); ctx.scale(-1, 1);
        ctx.drawImage(img, -img.width / 2, 0);
      } else { ctx.drawImage(img, sp.x - img.width / 2, sitY); }
    } else {
      if (avatar.facing === 'nw') {
        ctx.translate(sp.x, sp.y); ctx.scale(-1, 1);
        ctx.drawImage(img, -img.width / 2, 0);
      } else { ctx.drawImage(img, sp.x - img.width / 2, sp.y); }
    }
    ctx.restore();
    // Walking leg animation (drawn over cached static legs)
    if (avatar.isWalking && !avatar.isSitting) {
      const legY = sp.y + 42;
      const swing = [ -4, 0, 4, 0 ][avatar.animFrame % 4];
      ctx.strokeStyle = avatar.pantsColor; ctx.lineWidth = 4; ctx.lineCap = 'round';
      // Left leg
      ctx.beginPath(); ctx.moveTo(sp.x - 4, legY); ctx.lineTo(sp.x - 5 - swing, legY + 16 + Math.abs(swing) * 0.3); ctx.stroke();
      // Right leg
      ctx.beginPath(); ctx.moveTo(sp.x + 4, legY); ctx.lineTo(sp.x + 5 + swing, legY + 16 + Math.abs(swing) * 0.3); ctx.stroke();
      // Shoes
      ctx.fillStyle = avatar.shoeColor || '#333';
      ctx.beginPath(); ctx.ellipse(sp.x - 5 - swing, legY + 17 + Math.abs(swing) * 0.3, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sp.x + 5 + swing, legY + 17 + Math.abs(swing) * 0.3, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (avatar.isWaving) {
      ctx.strokeStyle = avatar.skinColor; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      const waveAngle = Math.sin(avatar.waveTimer * 8) * 0.8;
      ctx.beginPath();
      if (avatar.facing === 'se') { ctx.moveTo(sp.x + 12, sp.y + 28); ctx.lineTo(sp.x + 22, sp.y + 18 + waveAngle * 8); }
      else { ctx.moveTo(sp.x - 12, sp.y + 28); ctx.lineTo(sp.x - 22, sp.y + 18 + waveAngle * 8); }
      ctx.stroke();
    }
    if (this.settings.showNames && (!this.settings.safeMode || !avatar.isNPC)) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, sp.x - 32, sp.y - 16, 64, 16, 5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Nunito, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(avatar.name, sp.x, sp.y - 8);
      if (avatar.isNPC) { ctx.fillStyle = 'var(--habbo-accent)'; ctx.beginPath(); ctx.arc(sp.x + 22, sp.y - 12, 3, 0, Math.PI * 2); ctx.fill(); }
      // Player badge
      if (!avatar.isNPC && this.achievementSystem) {
        const badge = this.achievementSystem.getList().find(a => a.unlocked);
        if (badge) {
          ctx.font = 'bold 7px Nunito, sans-serif';
          ctx.fillStyle = 'var(--habbo-accent)';
          ctx.fillText(badge.icon, sp.x + 36, sp.y - 8);
        }
      }
    }
  }

  renderMinimap() {
    if (!this.settings.showMinimap || !this.room) return;
    const mmCanvas = document.getElementById('minimapCanvas');
    if (!mmCanvas) return;
    const mmCtx = mmCanvas.getContext('2d');
    const w = mmCanvas.width, h = mmCanvas.height;
    mmCtx.clearRect(0, 0, w, h);
    const scaleX = w / this.room.width, scaleY = h / this.room.height;
    const scale = Math.min(scaleX, scaleY) * 0.85;
    const offX = (w - this.room.width * scale) / 2, offY = (h - this.room.height * scale) / 2;
    mmCtx.fillStyle = 'rgba(7, 58, 66, 0.8)'; mmCtx.fillRect(0, 0, w, h);
    for (let y = 0; y < this.room.height; y++) {
      for (let x = 0; x < this.room.width; x++) {
        if (this.room.map[y]?.[x]) { mmCtx.fillStyle = 'rgba(26, 154, 170, 0.5)'; mmCtx.fillRect(offX + x * scale, offY + y * scale, scale - 1, scale - 1); }
      }
    }
    mmCtx.fillStyle = 'rgba(244, 208, 63, 0.7)';
    this.room.furniture.forEach(f => { mmCtx.fillRect(offX + f.x * scale, offY + f.y * scale, scale * f.footprint[0] - 1, scale * f.footprint[1] - 1); });
    this.room.avatars.forEach(a => {
      mmCtx.fillStyle = a.isNPC ? '#e74c3c' : '#2ecc71';
      mmCtx.beginPath(); mmCtx.arc(offX + a.x * scale + scale / 2, offY + a.y * scale + scale / 2, scale / 3, 0, Math.PI * 2); mmCtx.fill();
    });
  }

  startMinigame(MinigameClass) {
    this.uiManager.closeAllPanels();
    this.minigame = new MinigameClass(this);
    this.minigame.start();
    this.achievementSystem.track('minigame');
    this.challengeSystem.track('win');
    this.statsSystem.inc('minigamesPlayed');
  }

  endMinigame() {
    if (this.minigame && this.minigame.result === 'win') {
      this.achievementSystem.track('win');
      this.statsSystem.inc('minigamesWon');
    }
    this.minigame = null;
  }
}
