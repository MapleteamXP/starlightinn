/**
 * @fileoverview MinigameHub.js — Central lobby and framework for Starlight Inn mini-games.
 * Handles game registration, lobby creation, player matchmaking, countdown timers,
 * game lifecycle (start / end), results screens, and Silver/badge reward distribution.
 */

import { BaseMinigame } from './BaseMinigame.js';

/**
 * Default lobby configuration.
 * @type {Object}
 */
const LOBBY_DEFAULTS = {
  countdownSeconds: 30,
  autoStartWhenFull: true,
  minPlayersToStart: 1,
  resultsDisplaySeconds: 5
};

/**
 * Silver reward table keyed by final rank.
 * @type {Object<number, number>}
 */
const SILVER_REWARDS = {
  1: 200,
  2: 100,
  3: 50,
  4: 25
};

/**
 * Central hub that manages every mini-game in the Starlight Inn world.
 * Responsible for registration, lobby UI, matchmaking, launching games,
 * displaying results, and returning players to the world.
 */
export class MinigameHub {
  /**
   * @param {Object} game — The main Game singleton (holds W, H, ctx, player, economy, etc.).
   */
  constructor(game) {
    /** @type {Object} */
    this.game = game;

    /** @type {Map<string, Object>} Registered games: id → { class, config }. */
    this.games = new Map();

    /** @type {Object|null} Current lobby state. */
    this.lobby = null;

    /** @type {BaseMinigame|null} Active running game instance. */
    this.activeGame = null;

    /** @type {Object|null} Lobby countdown timer handle. */
    this._lobbyTimerHandle = null;

    /** @type {Object|null} Results screen timer handle. */
    this._resultsTimerHandle = null;

    /** @type {boolean} Whether the hub UI is currently visible. */
    this.uiVisible = false;

    /** @type {HTMLDivElement|null} Root DOM element for the hub overlay. */
    this.domRoot = null;

    /** @type {Array<function>} Cached event listener disposers. */
    this._listeners = [];

    /** @type {function} Bound click handler for the overlay canvas. */
    this._boundCanvasClick = this._onCanvasClick.bind(this);
    /** @type {function} Bound key handler for rhythm/dance games. */
    this._boundKeyDown = this._onKeyDown.bind(this);

    this._buildDom();
  }

  /**
   * Register a mini-game class so the hub can instantiate it later.
   * @param {string} id        — Unique game identifier (e.g. 'starcatcher').
   * @param {Function} gameClass — Class extending BaseMinigame.
   * @param {Object} [config={}] — Default configuration merged at creation time.
   */
  register(id, gameClass, config = {}) {
    if (!gameClass.prototype instanceof BaseMinigame) {
      console.warn(`[MinigameHub] ${id} does not extend BaseMinigame — registering anyway.`);
    }
    this.games.set(id, { class: gameClass, config });
  }

  /**
   * Return the catalogue of playable mini-games for UI listing.
   * @returns {Array<Object>} Each entry has id, name, emoji, minPlayers, maxPlayers, description.
   */
  getAvailableGames() {
    return [
      {
        id: 'starcatcher',
        name: 'Star Catcher',
        emoji: '\u2B50',
        minPlayers: 1,
        maxPlayers: 4,
        description: 'Catch falling stars before they drift away! Build combos for huge scores.',
        color: '#ffd700'
      },
      {
        id: 'memorymatch',
        name: 'Memory Match',
        emoji: '\uD83E\uDDE0',
        minPlayers: 1,
        maxPlayers: 2,
        description: 'Flip cozy cards and match the pairs. Fewer moves = higher score!',
        color: '#ff9ecd'
      },
      {
        id: 'rhythmdance',
        name: 'Rhythm Dance',
        emoji: '\uD83C\uDFB5',
        minPlayers: 1,
        maxPlayers: 4,
        description: 'Dance to the beat! Hit arrows in time for PERFECT combos.',
        color: '#9eafff'
      },
      {
        id: 'trivia',
        name: 'Trivia',
        emoji: '\u2753',
        minPlayers: 1,
        maxPlayers: 4,
        description: 'Test your knowledge of Starlight Inn lore. Speed earns bonus Silver!',
        color: '#90ee90'
      }
    ];
  }

  /**
   * Create a lobby for a specific game and show the waiting UI.
   * @param {string} gameId      — Registered game identifier.
   * @param {number} [maxPlayers=4] — Maximum players allowed in this lobby.
   * @returns {boolean} True if the lobby was created successfully.
   */
  createLobby(gameId, maxPlayers = 4) {
    const meta = this.games.get(gameId);
    if (!meta) {
      console.error(`[MinigameHub] Game "${gameId}" is not registered.`);
      return false;
    }

    const available = this.getAvailableGames().find(g => g.id === gameId);
    const minPlayers = available ? available.minPlayers : 1;

    this.lobby = {
      gameId,
      maxPlayers,
      minPlayers,
      players: [],
      countdown: LOBBY_DEFAULTS.countdownSeconds,
      started: false
    };

    // Auto-add the local player immediately.
    this.joinLobby(gameId);
    this._showLobbyUI();
    this._startLobbyCountdown();
    return true;
  }

  /**
   * Add the local player (and optionally remote peers) to the current lobby.
   * @param {string} gameId — Must match the active lobby gameId.
   * @returns {boolean}
   */
  joinLobby(gameId) {
    if (!this.lobby || this.lobby.gameId !== gameId) return false;
    if (this.lobby.players.length >= this.lobby.maxPlayers) return false;

    const playerId = this.game.player?.id || 'player';
    if (this.lobby.players.some(p => p.id === playerId)) return true; // already in

    this.lobby.players.push({
      id: playerId,
      name: this.game.player?.name || 'You',
      ready: true
    });

    this._refreshLobbyUI();

    // Auto-start immediately when lobby is full.
    if (LOBBY_DEFAULTS.autoStartWhenFull &&
        this.lobby.players.length >= this.lobby.maxPlayers) {
      this._startGame(gameId);
    }

    return true;
  }

  /**
   * Remove the local player from the current lobby and tear down the waiting room.
   */
  leaveLobby() {
    if (this._lobbyTimerHandle) {
      clearInterval(this._lobbyTimerHandle);
      this._lobbyTimerHandle = null;
    }
    this.lobby = null;
    this._hideAllUI();
  }

  /**
   * Internal: start the 30-second lobby countdown. When it expires, the game auto-starts
   * if the minimum player count is met.
   */
  _startLobbyCountdown() {
    if (this._lobbyTimerHandle) clearInterval(this._lobbyTimerHandle);

    this._lobbyTimerHandle = setInterval(() => {
      if (!this.lobby || this.lobby.started) {
        clearInterval(this._lobbyTimerHandle);
        this._lobbyTimerHandle = null;
        return;
      }

      this.lobby.countdown--;
      this._refreshLobbyUI();

      if (this.lobby.countdown <= 0) {
        clearInterval(this._lobbyTimerHandle);
        this._lobbyTimerHandle = null;
        if (this.lobby.players.length >= this.lobby.minPlayers) {
          this._startGame(this.lobby.gameId);
        } else {
          this._showLobbyMessage('Not enough players... returning.');
          setTimeout(() => this.leaveLobby(), 2500);
        }
      }
    }, 1000);
  }

  /**
   * Internal: transition from lobby to active game. Hides world UI, shows canvas,
   * instantiates the game, wires input, and kicks off the countdown.
   * @param {string} gameId
   */
  _startGame(gameId) {
    if (!this.lobby) return;
    this.lobby.started = true;

    const meta = this.games.get(gameId);
    if (!meta) {
      console.error(`[MinigameHub] Cannot start unregistered game "${gameId}".`);
      return;
    }

    // Hide world / lobby UI.
    this._hideAllUI();
    this._hideWorldUI();

    // Show the dedicated mini-game canvas.
    this._showGameCanvas();

    // Instantiate the game.
    this.activeGame = new meta.class(this.game, meta.config);

    // Pre-seed scores for every lobby player so rankings work even with 0 points.
    for (const p of this.lobby.players) {
      this.activeGame.scores.set(p.id, 0);
    }

    // Wire input listeners.
    this._attachInputListeners();

    // Begin countdown → play.
    this.activeGame.start();
  }

  /**
   * Called by a mini-game when it ends. Shows the results screen, awards Silver,
   * and returns players to the world after a short delay.
   * @param {Array<{playerId: string, score: number, rank: number}>} results
   */
  endGame(results) {
    this._detachInputListeners();
    this._showResultsUI(results);

    // Award Silver directly through the hub (fallback if game didn't).
    for (const entry of results) {
      const silver = SILVER_REWARDS[entry.rank] ?? 10;
      if (this.game.economy && typeof this.game.economy.addSilver === 'function') {
        this.game.economy.addSilver(entry.playerId, silver);
      }
    }

    // Return to world after N seconds.
    if (this._resultsTimerHandle) clearTimeout(this._resultsTimerHandle);
    this._resultsTimerHandle = setTimeout(() => {
      this._returnToWorld();
    }, LOBBY_DEFAULTS.resultsDisplaySeconds * 1000);
  }

  /**
   * Tear down the active game, restore world UI, and clear lobby state.
   */
  _returnToWorld() {
    if (this.activeGame) {
      this.activeGame.dispose();
      this.activeGame = null;
    }
    this.lobby = null;
    this._hideGameCanvas();
    this._showWorldUI();
    this._hideAllUI();
  }

  // ---------------------------------------------------------------------------
  // Input wiring
  // ---------------------------------------------------------------------------

  /** Attach canvas click and keyboard listeners. */
  _attachInputListeners() {
    const canvas = this.game.canvas;
    if (canvas) {
      canvas.addEventListener('click', this._boundCanvasClick);
      canvas.addEventListener('touchstart', this._boundCanvasClick, { passive: false });
    }
    window.addEventListener('keydown', this._boundKeyDown);
  }

  /** Remove canvas click and keyboard listeners. */
  _detachInputListeners() {
    const canvas = this.game.canvas;
    if (canvas) {
      canvas.removeEventListener('click', this._boundCanvasClick);
      canvas.removeEventListener('touchstart', this._boundCanvasClick);
    }
    window.removeEventListener('keydown', this._boundKeyDown);
  }

  /**
   * Route click / touch events to the active game.
   * @param {MouseEvent|TouchEvent} evt
   */
  _onCanvasClick(evt) {
    if (!this.activeGame || this.activeGame.state !== 'playing') return;

    let clientX, clientY;
    if (evt.changedTouches && evt.changedTouches.length > 0) {
      clientX = evt.changedTouches[0].clientX;
      clientY = evt.changedTouches[0].clientY;
      evt.preventDefault();
    } else {
      clientX = evt.clientX;
      clientY = evt.clientY;
    }

    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = this.game.W / rect.width;
    const scaleY = this.game.H / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    if (typeof this.activeGame.onClick === 'function') {
      this.activeGame.onClick(x, y);
    }
  }

  /**
   * Route keyboard events to the active game (primarily for RhythmDance).
   * @param {KeyboardEvent} evt
   */
  _onKeyDown(evt) {
    if (!this.activeGame || this.activeGame.state !== 'playing') return;

    const keyMap = {
      ArrowLeft: 'left',
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowRight: 'right',
      a: 'left',
      w: 'up',
      s: 'down',
      d: 'right'
    };

    const direction = keyMap[evt.key];
    if (direction && typeof this.activeGame.onKey === 'function') {
      evt.preventDefault();
      this.activeGame.onKey(direction);
    }
  }

  // ---------------------------------------------------------------------------
  // DOM / UI helpers
  // ---------------------------------------------------------------------------

  /** Build the persistent overlay DOM structure used by lobby and results. */
  _buildDom() {
    const root = document.createElement('div');
    root.id = 'minigame-hub-overlay';
    root.style.cssText = `
      position: fixed; inset: 0; display: none; flex-direction: column;
      align-items: center; justify-content: center; z-index: 9999;
      background: rgba(18, 16, 32, 0.92); font-family: "Segoe UI", sans-serif;
      color: #fff; pointer-events: auto; user-select: none;
    `;
    document.body.appendChild(root);
    this.domRoot = root;
  }

  /** Hide the hub overlay entirely. */
  _hideAllUI() {
    if (this.domRoot) this.domRoot.style.display = 'none';
    this.uiVisible = false;
  }

  /** Show the hub overlay. */
  _showOverlay() {
    if (this.domRoot) {
      this.domRoot.style.display = 'flex';
      this.domRoot.innerHTML = '';
    }
    this.uiVisible = true;
  }

  /** Render the lobby UI with player list and countdown. */
  _showLobbyUI() {
    this._showOverlay();
    const lobby = this.lobby;
    const gameInfo = this.getAvailableGames().find(g => g.id === lobby.gameId);
    const color = gameInfo ? gameInfo.color : '#fff';

    this.domRoot.innerHTML = `
      <div style="text-align:center; max-width:480px; width:90%;">
        <div style="font-size:3.5rem; margin-bottom:0.2em;">${gameInfo ? gameInfo.emoji : '\u2B50'}</div>
        <h1 style="margin:0 0 0.2em; font-size:1.8rem; color:${color};">${gameInfo ? gameInfo.name : 'Mini-Game'}</h1>
        <p style="margin:0 0 1.5em; opacity:0.8; font-size:0.95rem;">${gameInfo ? gameInfo.description : ''}</p>

        <div id="hub-lobby-players" style="margin-bottom:1.5em;"></div>

        <div style="font-size:1.3rem; margin-bottom:1em; letter-spacing:1px;">
          Starting in <span id="hub-lobby-timer" style="color:${color}; font-weight:bold;">${lobby.countdown}</span>s
        </div>

        <button id="hub-btn-leave"
          style="padding:0.6em 1.4em; font-size:1rem; border:none; border-radius:999px;
                 background:#ff6b6b; color:#fff; cursor:pointer; transition:transform 0.15s;">
          Leave Lobby
        </button>
      </div>
    `;

    this._refreshLobbyUI();

    const leaveBtn = this.domRoot.querySelector('#hub-btn-leave');
    leaveBtn.addEventListener('click', () => this.leaveLobby());
    this._listeners.push(() => leaveBtn.removeEventListener('click', () => this.leaveLobby()));
  }

  /** Refresh only the dynamic parts of the lobby UI (player list + timer). */
  _refreshLobbyUI() {
    if (!this.domRoot || !this.lobby) return;
    const container = this.domRoot.querySelector('#hub-lobby-players');
    const timerSpan = this.domRoot.querySelector('#hub-lobby-timer');
    if (!container) return;

    const dots = Array.from({ length: this.lobby.maxPlayers }, (_, i) => {
      const filled = i < this.lobby.players.length;
      return `<span style="display:inline-block; width:14px; height:14px; border-radius:50%;
        margin:0 4px; background:${filled ? '#90ee90' : 'rgba(255,255,255,0.25)'};"></span>`;
    }).join('');

    const names = this.lobby.players.map(p =>
      `<div style="display:inline-block; margin:4px; padding:0.35em 0.9em; border-radius:999px;
        background:rgba(255,255,255,0.08); font-size:0.9rem;">${p.name}</div>`
    ).join('');

    container.innerHTML = `
      <div style="margin-bottom:0.5em;">${dots}</div>
      <div>${names}</div>
      <div style="margin-top:0.6em; font-size:0.8rem; opacity:0.6;">
        ${this.lobby.players.length} / ${this.lobby.maxPlayers} players
      </div>
    `;

    if (timerSpan) timerSpan.textContent = this.lobby.countdown;
  }

  /** Render the post-game results screen. */
  _showResultsUI(results) {
    this._showOverlay();
    const gameInfo = this.getAvailableGames().find(g => g.id === this.lobby?.gameId);
    const color = gameInfo ? gameInfo.color : '#ffd700';

    const rows = results.map((r, i) => {
      const medal = r.rank === 1 ? '\uD83E\uDD47'
        : r.rank === 2 ? '\uD83E\uDD48'
        : r.rank === 3 ? '\uD83E\uDD49' : '\u2726';
      const silver = SILVER_REWARDS[r.rank] ?? 10;
      return `
        <div style="display:flex; align-items:center; justify-content:space-between;
          padding:0.7em 1em; margin:0.4em 0; border-radius:12px;
          background:${r.rank === 1 ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.05)'};
          border: 1px solid ${r.rank === 1 ? 'rgba(255,215,0,0.3)' : 'transparent'};">
          <div style="display:flex; align-items:center; gap:0.6em;">
            <span style="font-size:1.4rem;">${medal}</span>
            <span style="font-weight:600;">${r.rank}. ${r.playerId === 'player' ? 'You' : r.playerId}</span>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:bold; font-size:1.1rem;">${r.score.toLocaleString()} pts</div>
            <div style="font-size:0.75rem; opacity:0.7;">+${silver} Silver</div>
          </div>
        </div>
      `;
    }).join('');

    this.domRoot.innerHTML = `
      <div style="text-align:center; max-width:420px; width:90%;">
        <div style="font-size:3rem; margin-bottom:0.2em;">${gameInfo ? gameInfo.emoji : '\u2B50'}</div>
        <h1 style="margin:0 0 0.3em; font-size:1.6rem; color:${color};">Results</h1>
        <div style="margin-bottom:1.5em;">${rows}</div>
        <p style="opacity:0.6; font-size:0.85rem;">Returning to Starlight Inn in ${LOBBY_DEFAULTS.resultsDisplaySeconds}s...</p>
      </div>
    `;
  }

  /** Show a temporary message inside the overlay (e.g. "Not enough players"). */
  _showLobbyMessage(text) {
    if (!this.domRoot) return;
    this.domRoot.innerHTML = `
      <div style="text-align:center; font-size:1.2rem; opacity:0.9;">
        <p>${text}</p>
      </div>
    `;
  }

  /** Hide the main world UI layer (chat, hud, etc.). */
  _hideWorldUI() {
    const worldUI = document.getElementById('world-ui');
    if (worldUI) worldUI.style.display = 'none';
  }

  /** Restore the main world UI layer. */
  _showWorldUI() {
    const worldUI = document.getElementById('world-ui');
    if (worldUI) worldUI.style.display = '';
  }

  /** Ensure the game canvas is visible and sized correctly. */
  _showGameCanvas() {
    const canvas = this.game.canvas;
    if (canvas) {
      canvas.style.display = 'block';
      canvas.style.zIndex = '9000';
    }
  }

  /** Hide the game canvas so the world renderer can take over. */
  _hideGameCanvas() {
    const canvas = this.game.canvas;
    if (canvas) {
      canvas.style.display = '';
      canvas.style.zIndex = '';
    }
  }

  /**
   * Utility: convert a hex colour to an rgba string with given alpha.
   * @param {string} hex — e.g. '#ff6b6b' or '#f0a'
   * @param {number} alpha — 0..1
   * @returns {string}
   */
  hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
}
