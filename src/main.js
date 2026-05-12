// ============================================================
// Starlight Engine v2.0 — Entry Point
// ============================================================

import { Game } from './engine/Game.js';
import { RingUppercut } from './minigames/RingUppercut.js';
import { MemoryMatch } from './minigames/MemoryMatch.js';
import { TilePuzzle } from './minigames/TilePuzzle.js';
import { SimonSays } from './minigames/SimonSays.js';
import { FishingGame } from './minigames/FishingGame.js';

function createUI() {
  const overlay = document.getElementById('uiOverlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div id="topBar">
      <div id="logo">&#10022; STARLIGHT INN</div>
      <div id="topBarRight">
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
          <div class="currency-badge" id="currencyDisplay">1,000</div>
          <div style="font-size:10px;color:var(--habbo-text-dim);font-weight:700;" id="levelDisplay">Lv. 1 Newcomer</div>
          <div id="challengeBadge" style="font-size:9px;color:var(--habbo-accent);font-weight:700;display:none;"></div>
        </div>
        <button class="top-btn" id="btnNavigator">&#127757; Navigator</button>
        <button class="top-btn" id="btnCatalog">&#128722; Catalog</button>
        <button class="top-btn" id="btnInventory">&#127890; Inventory</button>
        <button class="top-btn" id="btnSettings">&#9881;&#65039; Settings</button>
        <button class="top-btn" id="btnCustomize">&#128100; Me</button>
        <button class="top-btn" id="btnChatHistory">&#128172; Chat</button>
        <button class="top-btn" id="btnFriends">&#128101; Friends</button>
        <button class="top-btn" id="btnPet">&#128054; Pet</button>
        <button class="top-btn" id="btnAchievements">&#127942; Goals</button>
        <button class="top-btn" id="btnLeaderboard">&#128200; Scores</button>
        <button class="top-btn" id="btnCrafting">&#128295; Craft</button>
        <button class="top-btn" id="btnStats">&#128202; Stats</button>
        <button class="top-btn" id="btnShortcuts">&#9000;&#65039; Keys</button>
        <button class="top-btn" id="btnChallenges">&#128170; Quests</button>
        <button class="top-btn" id="btnActiveQuest">&#128220; Mission</button>
        <button class="top-btn" id="btnNotifications">&#128276; Alerts</button>
        <button class="top-btn" id="btnInbox">&#128231; Mail</button>
        <button class="top-btn" id="btnClubs">&#127942; Clubs</button>
        <button class="top-btn" id="btnCollection">&#127912; Collection</button>
      </div>
    </div>
    <div id="roomInfo">
      <h2 id="roomName">Lobby</h2>
      <p id="roomDesc">Welcome to Starlight Inn!</p>
      <button id="btnLikeRoom" style="margin-top:6px;padding:4px 12px;background:rgba(0,0,0,0.3);border:1px solid var(--habbo-panel-border);border-radius:12px;color:white;font-family:inherit;font-size:11px;cursor:pointer;transition:all 0.15s;">❤️ Like Room</button>
      <button id="btnRateRoom" style="margin-top:6px;margin-left:6px;padding:4px 12px;background:rgba(0,0,0,0.3);border:1px solid var(--habbo-panel-border);border-radius:12px;color:white;font-family:inherit;font-size:11px;cursor:pointer;transition:all 0.15s;">⭐ Rate Room</button>
    </div>
    <div id="minimap"><canvas id="minimapCanvas" width="140" height="140"></canvas></div>
    <div id="chatBar">
      <input type="text" id="chatInput" placeholder="Click here to chat..." maxlength="120" autocomplete="off">
      <button id="chatEmojiBtn" title="Emoji" style="padding:0 8px;font-size:16px;background:transparent;border:none;color:var(--habbo-text);cursor:pointer;">&#128512;</button>
      <button id="chatColorBtn" title="Message Color"></button>
      <button id="chatSend">Send</button>
    </div>
    <div id="emojiPicker" style="display:none;position:absolute;bottom:56px;left:50%;transform:translateX(-50%);background:var(--habbo-panel);border:1px solid var(--habbo-panel-border);border-radius:8px;padding:8px;z-index:200;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
      <div style="display:grid;grid-template-columns:repeat(8, 28px);gap:4px;" id="emojiGrid"></div>
    </div>
    <div id="typingIndicatorBar">You are typing...</div>
    <div id="toolbar">
      <button class="tool-btn" id="toolChat" title="Chat (Enter)"><span class="icon">&#128172;</span><span>Chat</span></button>
      <button class="tool-btn" id="toolWalk" title="Walk (Click tiles)"><span class="icon">&#128694;</span><span>Walk</span></button>
      <button class="tool-btn" id="toolPlace" title="Place Furniture"><span class="icon">&#128230;</span><span>Place</span></button>
      <button class="tool-btn" id="toolPick" title="Pick Up"><span class="icon">&#9995;</span><span>Pick</span></button>
      <button class="tool-btn" id="toolRotate" title="Rotate (R)"><span class="icon">&#128260;</span><span>Rotate</span></button>
      <button class="tool-btn" id="toolDance" title="Dance (D)"><span class="icon">&#128131;</span><span>Dance</span></button>
      <button class="tool-btn" id="toolWave" title="Wave (W)"><span class="icon">&#128075;</span><span>Wave</span></button>
      <button class="tool-btn" id="toolMinimap" title="Toggle Map (M)"><span class="icon">&#128506;&#65039;</span><span>Map</span></button>
      <button class="tool-btn" id="toolMinigame" title="Minigames"><span class="icon">&#127918;</span><span>Games</span></button>
    </div>
    <div id="notificationArea"></div>
    <div id="emoteWheel" style="display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:200px;height:200px;z-index:300;pointer-events:none;">
      <div id="emoteWheelInner" style="position:relative;width:100%;height:100%;"></div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    createUI();
    window.game = new Game();
    window.RingUppercut = RingUppercut;
    window.MemoryMatch = MemoryMatch;
    window.TilePuzzle = TilePuzzle;
    window.SimonSays = SimonSays;
    window.FishingGame = FishingGame;
  } catch (err) {
    console.error('Failed to initialize game:', err);
    const loading = document.getElementById('loadingScreen');
    if (loading) loading.innerHTML = `<h1 style="color:#e74c3c">Error</h1><p>${err.message}</p>`;
  }
});

window.addEventListener('contextmenu', e => { if (e.target.tagName === 'CANVAS') e.preventDefault(); });
