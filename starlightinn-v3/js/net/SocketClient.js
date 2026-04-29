/**
 * SocketClient — Starlight Inn v3.0 WebSocket Client
 * Thin Socket.IO wrapper handling authentication, presence,
 * room state, chat, trade, mini-games, auto-reconnect, and heartbeat.
 *
 * @module net/SocketClient
 * @version 3.0.0
 */

export class SocketClient {
  /**
   * Create a new SocketClient.
   * @param {Object} game - The root game controller/state object.
   */
  constructor(game) {
    this.game = game;
    /** @type {import('socket.io-client').Socket|null} */
    this.socket = null;
    this.connected = false;
    this.authenticated = false;
    this.reconnectAttempts = 0;
    this.maxReconnect = 5;
    this.reconnectDelay = 3000;
    this.lastPong = 0;
    this.heartbeatTimer = null;
    this.token = null;
    this.playerId = null;
  }

  /**
   * Establish a connection to the Socket.IO server and bind all events.
   * @param {string} [url=window.location.origin] - Server base URL.
   */
  connect(url = window.location.origin) {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: false, // we handle reconnect manually for finer UX
      timeout: 20000
    });

    // Core lifecycle --------------------------------------------------
    this.socket.on('connect', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('[SocketClient] Connected to Starlight Inn server');
      this.authenticate();
      this.startHeartbeat();
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      this.authenticated = false;
      this.stopHeartbeat();
      console.log('[SocketClient] Disconnected:', reason);
      this.attemptReconnect();
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[SocketClient] Connection error:', err.message);
    });

    // Auth events -----------------------------------------------------
    this.socket.on('auth_success', (data) => {
      this.authenticated = true;
      this.token = data.token;
      this.playerId = data.player.id;
      if (this.game && this.game.state && this.game.state.player) {
        this.game.state.player.id = data.player.id;
      }
      console.log('[SocketClient] Authenticated as', data.player.name);
    });

    this.socket.on('auth_error', (data) => {
      console.error('[SocketClient] Auth failed:', data.reason);
      this.authenticated = false;
    });

    // Area / presence events ------------------------------------------
    this.socket.on('area_state', (data) => {
      if (!this.game) return;
      if (this.game.state) {
        this.game.state.onlinePlayers = data.players || [];
        if (data.area) this.game.state.currentArea = data.area;
      }
      if (this.game.chat && data.messages) {
        this.game.chat.messages = data.messages;
      }
      if (this.game.chests && data.chests) {
        this.game.chests.sync(data.chests);
      }
    });

    this.socket.on('player_joined', (player) => {
      if (!this.game || !this.game.state) return;
      const list = this.game.state.onlinePlayers || [];
      if (!list.find(p => p.id === player.id)) {
        list.push(player);
      }
      if (this.game.chat && this.game.chat.system) {
        this.game.chat.system(`${player.name} has arrived!`);
      }
    });

    this.socket.on('player_left', (data) => {
      if (!this.game || !this.game.state) return;
      const list = this.game.state.onlinePlayers || [];
      this.game.state.onlinePlayers = list.filter(p => p.id !== data.id);
    });

    this.socket.on('player_moved', (data) => {
      if (!this.game || !this.game.state) return;
      const list = this.game.state.onlinePlayers || [];
      const player = list.find(p => p.id === data.id);
      if (player) {
        Object.assign(player, data);
      }
    });

    this.socket.on('player_gesture', (data) => {
      if (this.game && this.game.gestures && this.game.gestures.triggerRemote) {
        this.game.gestures.triggerRemote(data.id, data.gesture);
      }
    });

    this.socket.on('player_status', (data) => {
      if (!this.game || !this.game.state) return;
      const list = this.game.state.onlinePlayers || [];
      const player = list.find(p => p.id === data.id);
      if (player) player.status = data.status;
    });

    // Chat events -----------------------------------------------------
    this.socket.on('chat_message', (msg) => {
      if (this.game && this.game.chat && this.game.chat.receive) {
        this.game.chat.receive(msg.name, msg.text, 'area', msg.time);
      }
    });

    this.socket.on('chat_error', (data) => {
      if (this.game && this.game.chat && this.game.chat.system) {
        this.game.chat.system(`Chat blocked: ${data.reason}`, 'error');
      }
    });

    this.socket.on('whisper', (msg) => {
      if (this.game && this.game.chat && this.game.chat.receive) {
        this.game.chat.receive(msg.from, msg.text, 'whisper', msg.time);
      }
    });

    this.socket.on('whisper_sent', (msg) => {
      if (this.game && this.game.chat && this.game.chat.receive) {
        this.game.chat.receive('To ' + msg.to, msg.text, 'whisper', msg.time);
      }
    });

    this.socket.on('whisper_error', (data) => {
      if (this.game && this.game.chat && this.game.chat.system) {
        this.game.chat.system(`Whisper failed: ${data.reason}`, 'error');
      }
    });

    // Power-up events -------------------------------------------------
    this.socket.on('powerup_used', (data) => {
      if (this.game && this.game.powerUps && this.game.powerUps.renderRemoteEffect) {
        this.game.powerUps.renderRemoteEffect(data.id, data.powerup, data.target, data.x, data.y);
      }
    });

    // Trade events ----------------------------------------------------
    this.socket.on('trade_request', (data) => {
      if (this.game && this.game.ui && this.game.ui.showTradeRequest) {
        this.game.ui.showTradeRequest(data.from, data.fromId);
      }
    });

    this.socket.on('trade_request_sent', (data) => {
      if (this.game && this.game.chat && this.game.chat.system) {
        this.game.chat.system(`Trade request sent to ${data.to}`, 'info');
      }
    });

    this.socket.on('trade_started', (trade) => {
      if (this.game && this.game.trade && this.game.trade.show) {
        this.game.trade.show(trade);
      }
    });

    this.socket.on('trade_updated', (trade) => {
      if (this.game && this.game.trade && this.game.trade.update) {
        this.game.trade.update(trade);
      }
    });

    this.socket.on('trade_countdown', (data) => {
      if (this.game && this.game.trade && this.game.trade.startCountdown) {
        this.game.trade.startCountdown(data.tradeId, data.ms);
      }
    });

    this.socket.on('trade_confirm_ready', (data) => {
      if (this.game && this.game.trade && this.game.trade.enableConfirm) {
        this.game.trade.enableConfirm(data.tradeId);
      }
    });

    this.socket.on('trade_complete', (data) => {
      if (this.game && this.game.trade && this.game.trade.complete) {
        this.game.trade.complete(data);
      }
      if (this.game && this.game.chat && this.game.chat.system) {
        this.game.chat.system('Trade completed successfully!', 'success');
      }
    });

    this.socket.on('trade_error', (data) => {
      if (this.game && this.game.chat && this.game.chat.system) {
        this.game.chat.system(`Trade error: ${data.reason}`, 'error');
      }
    });

    this.socket.on('trade_declined', () => {
      if (this.game && this.game.chat && this.game.chat.system) {
        this.game.chat.system('Trade request was declined.', 'info');
      }
    });

    this.socket.on('trade_cancelled', (data) => {
      if (this.game && this.game.trade && this.game.trade.cancel) {
        this.game.trade.cancel(data.tradeId, data.reason);
      }
    });

    // Chest events ----------------------------------------------------
    this.socket.on('chest_claimed', (data) => {
      if (this.game && this.game.chests && this.game.chests.markClaimed) {
        this.game.chests.markClaimed(data.chestId, data.claimedBy);
      }
      if (data.claimedBy === this.playerId && this.game && this.game.fx) {
        this.game.fx.sparkle('chest-loot');
      }
    });

    this.socket.on('chest_spawned', (chest) => {
      if (this.game && this.game.chests && this.game.chests.addChest) {
        this.game.chests.addChest(chest);
      }
    });

    this.socket.on('chest_reward', (data) => {
      if (this.game && this.game.inventory && this.game.inventory.sync) {
        this.game.inventory.sync(data.inventory);
      }
      if (this.game && this.game.chat && this.game.chat.system) {
        const lootNames = (data.loot || []).map(l => `${l.qty}x ${l.name}`).join(', ');
        this.game.chat.system(`You opened a chest! Loot: ${lootNames}`, 'success');
      }
    });

    this.socket.on('chest_error', (data) => {
      if (this.game && this.game.chat && this.game.chat.system) {
        this.game.chat.system(`Chest failed: ${data.reason}`, 'error');
      }
    });

    // Mini-game events ------------------------------------------------
    this.socket.on('minigame_lobby', (data) => {
      if (this.game && this.game.minigame && this.game.minigame.updateLobby) {
        this.game.minigame.updateLobby(data);
      }
    });

    this.socket.on('minigame_error', (data) => {
      if (this.game && this.game.chat && this.game.chat.system) {
        this.game.chat.system(`Mini-game: ${data.reason}`, 'error');
      }
    });

    // Heartbeat -------------------------------------------------------
    this.socket.on('pong', (data) => {
      this.lastPong = Date.now();
      const rtt = data && data.serverTime ? this.lastPong - data.serverTime : 0;
      if (this.game && this.game.debug && this.game.debug.setPing) {
        this.game.debug.setPing(rtt);
      }
    });
  }

  /**
   * Emit the player's customization data for server-side auth.
   * Call automatically after connect.
   */
  authenticate() {
    if (!this.socket || !this.game || !this.game.state || !this.game.state.player) return;
    const p = this.game.state.player;
    this.socket.emit('auth', {
      name: p.name,
      charId: p.charId,
      skinColor: p.skinColor,
      hairColor: p.hairColor,
      outfitColor: p.outfitColor,
      accessories: p.accessories,
      expression: p.expression,
      inventory: p.inventory,
      stats: p.stats
    });
  }

  /**
   * Send a position update to the server.
   * @param {{x:number,y:number,facing?:string,moving?:boolean}} pos
   */
  move(pos) {
    if (this.connected && this.socket) this.socket.emit('move', pos);
  }

  /**
   * Send an area chat message.
   * @param {string} text
   */
  chat(text) {
    if (this.connected && this.socket) this.socket.emit('chat', { text });
  }

  /**
   * Send a private whisper to another player by name.
   * @param {string} to - Target player name.
   * @param {string} text
   */
  whisper(to, text) {
    if (this.connected && this.socket) this.socket.emit('whisper', { to, text });
  }

  /**
   * Trigger a gesture/emote for the local player.
   * @param {string} gesture - e.g. 'wave', 'dance', 'sit'.
   */
  gesture(gesture) {
    if (this.connected && this.socket) this.socket.emit('gesture', { gesture });
  }

  /**
   * Change the current area/room.
   * @param {string} areaId
   */
  joinArea(areaId) {
    if (this.connected && this.socket) this.socket.emit('join_area', areaId);
  }

  /**
   * Leave the current area (returns to no room until next join).
   */
  leaveArea() {
    if (this.connected && this.socket) this.socket.emit('leave_area');
  }

  /**
   * Use a power-up and optionally target a player.
   * @param {string} powerUp
   * @param {string|null} [target]
   */
  usePowerUp(powerUp, target = null) {
    if (this.connected && this.socket) this.socket.emit('powerup', { powerup: powerUp, target });
  }

  /**
   * Set presence status.
   * @param {string} status - One of: online, away, busy, dnd, invisible.
   */
  setStatus(status) {
    if (this.connected && this.socket) this.socket.emit('status', { status });
  }

  /**
   * Initiate a trade request with another player.
   * @param {string} targetName - Display name of the target player.
   */
  tradeInitiate(targetName) {
    if (this.connected && this.socket) this.socket.emit('trade_initiate', { target: targetName });
  }

  /**
   * Accept an incoming trade request.
   * @param {string} fromId - Socket id of the initiator.
   */
  tradeAccept(fromId) {
    if (this.connected && this.socket) this.socket.emit('trade_accept', { fromId });
  }

  /**
   * Decline an incoming trade request.
   * @param {string} fromId
   */
  tradeDecline(fromId) {
    if (this.connected && this.socket) this.socket.emit('trade_decline', { fromId });
  }

  /**
   * Update the items offered in an active trade.
   * @param {string} tradeId
   * @param {'initiator'|'target'} side
   * @param {Array<Object>} offer
   */
  tradeUpdate(tradeId, side, offer) {
    if (this.connected && this.socket) this.socket.emit('trade_update', { tradeId, side, offer });
  }

  /**
   * Lock the current side of a trade.
   * @param {string} tradeId
   */
  tradeLock(tradeId) {
    if (this.connected && this.socket) this.socket.emit('trade_lock', { tradeId });
  }

  /**
   * Unlock the current side of a trade.
   * @param {string} tradeId
   */
  tradeUnlock(tradeId) {
    if (this.connected && this.socket) this.socket.emit('trade_unlock', { tradeId });
  }

  /**
   * Confirm the trade after the countdown.
   * @param {string} tradeId
   */
  tradeConfirm(tradeId) {
    if (this.connected && this.socket) this.socket.emit('trade_confirm', { tradeId });
  }

  /**
   * Cancel an active trade.
   * @param {string} tradeId
   */
  tradeCancel(tradeId) {
    if (this.connected && this.socket) this.socket.emit('trade_cancel', { tradeId });
  }

  /**
   * Claim a treasure chest in the current area.
   * @param {string} chestId
   */
  claimChest(chestId) {
    if (this.connected && this.socket) this.socket.emit('claim_chest', { chestId });
  }

  /**
   * Join a mini-game lobby.
   * @param {string} gameType - e.g. 'fishing', 'cooking', 'darts'.
   */
  minigameJoin(gameType) {
    if (this.connected && this.socket) this.socket.emit('minigame_join', { gameType });
  }

  /**
   * Leave the current mini-game lobby.
   * @param {string} gameType
   */
  minigameLeave(gameType) {
    if (this.connected && this.socket) this.socket.emit('minigame_leave', { gameType });
  }

  /**
   * Report a score update during a mini-game.
   * @param {string} gameType
   * @param {number} score
   */
  minigameScore(gameType, score) {
    if (this.connected && this.socket) this.socket.emit('minigame_score', { gameType, score });
  }

  /**
   * Signal the start of a mini-game (host action).
   * @param {string} gameType
   */
  minigameStart(gameType) {
    if (this.connected && this.socket) this.socket.emit('minigame_start', { gameType });
  }

  /**
   * Signal the end of a mini-game (host action).
   * @param {string} gameType
   */
  minigameEnd(gameType) {
    if (this.connected && this.socket) this.socket.emit('minigame_end', { gameType });
  }

  /**
   * Start the client-side heartbeat loop.
   * @private
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit('ping');
      }
    }, 15000);
  }

  /**
   * Stop the client-side heartbeat loop.
   * @private
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Attempt to reconnect with exponential back-off.
   * @private
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnect) {
      console.error('[SocketClient] Max reconnect attempts reached.');
      if (this.game && this.game.chat && this.game.chat.system) {
        this.game.chat.system('Connection lost. Please refresh the page.', 'error');
      }
      return;
    }
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    console.log(`[SocketClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnect})`);
    setTimeout(() => this.connect(), delay);
  }

  /**
   * Gracefully disconnect from the server.
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.authenticated = false;
  }
}
