// ============================================================
// Starlight Engine v2.0 — Entry Point
// ============================================================

import { Game } from './engine/Game.js';
import { RingUppercut } from './minigames/RingUppercut.js';
import { MemoryMatch } from './minigames/MemoryMatch.js';
import { TilePuzzle } from './minigames/TilePuzzle.js';

function createUI() {
  const overlay = document.getElementById('uiOverlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div id="topBar">
      <div id="logo">&#10022; STARLIGHT INN</div>
      <div id="topBarRight">
        <div class="currency-badge" id="currencyDisplay">1,000</div>
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
        <button class="top-btn" id="btnNotifications">&#128276; Alerts</button>
      </div>
    </div>
    <div id="roomInfo">
      <h2 id="roomName">Lobby</h2>
      <p id="roomDesc">Welcome to Starlight Inn!</p>
    </div>
    <div id="minimap"><canvas id="minimapCanvas" width="140" height="140"></canvas></div>
    <div id="chatBar">
      <input type="text" id="chatInput" placeholder="Click here to chat..." maxlength="120" autocomplete="off">
      <button id="chatColorBtn" title="Message Color"></button>
      <button id="chatSend">Send</button>
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
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    createUI();
    window.game = new Game();
    window.RingUppercut = RingUppercut;
    window.MemoryMatch = MemoryMatch;
    window.TilePuzzle = TilePuzzle;
  } catch (err) {
    console.error('Failed to initialize game:', err);
    const loading = document.getElementById('loadingScreen');
    if (loading) loading.innerHTML = `<h1 style="color:#e74c3c">Error</h1><p>${err.message}</p>`;
  }
});

window.addEventListener('contextmenu', e => { if (e.target.tagName === 'CANVAS') e.preventDefault(); });
