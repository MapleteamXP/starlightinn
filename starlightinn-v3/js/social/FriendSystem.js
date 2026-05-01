/**
 * FriendSystem.js — Starlight Inn v8.0.0
 * Full friend management with real-time status, whisper chat, profiles,
 * blocking, and localStorage offline cache. Works with WebSocket + REST.
 * Graceful degradation: if server or WebSocket fail, runs from cache.
 */

export class FriendSystem {
  /**
   * @param {object} game — global game object (provides auth, net, ui)
   */
  constructor(game) {
    this.game = game;
    this.apiBase = game?.apiBase || this._detectApiBase();
    this.wsUrl = game?.wsUrl || this._detectWsUrl();

    // Data stores
    this._friends = new Map();      // userId → friend object
    this._requests = new Map();     // userId → { from, to, status, createdAt }
    this._blocked = new Set();      // userId strings
    this._messages = new Map();     // userId → [ { from, text, ts } ]
    this._presence = new Map();     // userId → 'online' | 'offline' | 'away' | 'in-game'
    this._profiles = new Map();     // userId → { badges, room, bio, joinedAt }

    // WebSocket
    this._ws = null;
    this._wsReady = false;
    this._wsReconnectMs = 3000;
    this._wsMaxReconnectMs = 30000;
    this._wsReconnectAttempts = 0;
    this._wsTimer = null;

    // UI state
    this._panelOpen = false;
    this._panelEl = null;
    this._selectedFriendId = null;

    // Event listeners
    this._listeners = new Map();

    // Cache keys
    this._cacheKey = 'starlight_friends_cache';
    this._requestsKey = 'starlight_friends_requests';
    this._blockedKey = 'starlight_friends_blocked';
    this._messagesKey = 'starlight_friends_messages';
  }

  /* ================================================================
     INTERNAL HELPERS
     ================================================================ */

  _detectApiBase() {
    try {
      const host = location.hostname;
      if (host.includes('localhost') || host.includes('127.0.0.1')) return 'http://localhost:3000/api';
    } catch (_) {}
    return 'https://starlightinn-api.herokuapp.com/api';
  }

  _detectWsUrl() {
    try {
      const host = location.hostname;
      if (host.includes('localhost') || host.includes('127.0.0.1')) return 'ws://localhost:3000/ws';
    } catch (_) {}
    return 'wss://starlightinn-api.herokuapp.com/ws';
  }

  _token() {
    return this.game?.auth?.getToken?.() || null;
  }

  _myId() {
    return this.game?.auth?.getUserId?.() || this.game?.me?.id || 'me';
  }

  _myName() {
    return this.game?.auth?.getUsername?.() || this.game?.me?.name || 'Me';
  }

  _emit(event, data) {
    const set = this._listeners.get(event);
    if (set) set.forEach((cb) => { try { cb(data); } catch (e) { console.warn(e); } });
  }

  on(event, callback) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const set = this._listeners.get(event);
    if (set) set.delete(callback);
  }

  async _api(path, options = {}) {
    const url = `${this.apiBase}${path}`;
    const opts = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(this._token() ? { Authorization: `Bearer ${this._token()}` } : {}),
        ...(options.headers || {})
      }
    };
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      opts.body = JSON.stringify(options.body);
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), options.timeout || 8000);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) {
        const txt = await res.text();
        let data;
        try { data = JSON.parse(txt); } catch (_) { data = { message: txt }; }
        const err = new Error(data?.message || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return await res.json();
      return { ok: true };
    } catch (err) {
      clearTimeout(t);
      if (err.name === 'AbortError') throw new Error('Request timed out.');
      throw err;
    }
  }

  _saveCache() {
    try {
      const friends = Array.from(this._friends.values());
      localStorage.setItem(this._cacheKey, JSON.stringify(friends));
      const reqs = Array.from(this._requests.values());
      localStorage.setItem(this._requestsKey, JSON.stringify(reqs));
      localStorage.setItem(this._blockedKey, JSON.stringify(Array.from(this._blocked)));
      const msgs = {};
      this._messages.forEach((v, k) => { msgs[k] = v; });
      localStorage.setItem(this._messagesKey, JSON.stringify(msgs));
    } catch (e) {
      console.warn('[Friends] Cache save failed:', e.message);
    }
  }

  _loadCache() {
    try {
      const f = localStorage.getItem(this._cacheKey);
      if (f) {
        const arr = JSON.parse(f);
        this._friends.clear();
        arr.forEach((x) => { if (x?.id) this._friends.set(x.id, x); });
      }
      const r = localStorage.getItem(this._requestsKey);
      if (r) {
        const arr = JSON.parse(r);
        this._requests.clear();
        arr.forEach((x) => { if (x?.id) this._requests.set(x.id, x); });
      }
      const b = localStorage.getItem(this._blockedKey);
      if (b) this._blocked = new Set(JSON.parse(b));
      const m = localStorage.getItem(this._messagesKey);
      if (m) {
        const obj = JSON.parse(m);
        this._messages.clear();
        Object.keys(obj).forEach((k) => this._messages.set(k, obj[k]));
      }
    } catch (e) {
      console.warn('[Friends] Cache load failed:', e.message);
    }
  }

  _isBlocked(userId) {
    return this._blocked.has(userId);
  }

  /* ================================================================
     WEBSOCKET (REAL-TIME PRESENCE)
     ================================================================ */

  _connectWebSocket() {
    if (this._ws || !this._token()) return;
    try {
      this._ws = new WebSocket(`${this.wsUrl}?token=${encodeURIComponent(this._token())}`);
      this._ws.onopen = () => {
        console.log('[Friends] WebSocket connected');
        this._wsReady = true;
        this._wsReconnectAttempts = 0;
        this._emit('connected', {});
        // Sync friends list on connect
        this.getFriends().catch((e) => console.warn(e));
      };
      this._ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          this._handleWsMessage(msg);
        } catch (e) {
          console.warn('[Friends] WS parse error:', e.message);
        }
      };
      this._ws.onclose = () => {
        console.warn('[Friends] WebSocket closed');
        this._wsReady = false;
        this._ws = null;
        this._scheduleReconnect();
      };
      this._ws.onerror = (err) => {
        console.warn('[Friends] WebSocket error:', err);
        this._wsReady = false;
      };
    } catch (e) {
      console.warn('[Friends] WS connect error:', e.message);
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this._wsTimer) clearTimeout(this._wsTimer);
    const delay = Math.min(this._wsReconnectMs * Math.pow(2, this._wsReconnectAttempts), this._wsMaxReconnectMs);
    this._wsReconnectAttempts++;
    this._wsTimer = setTimeout(() => {
      console.log(`[Friends] Reconnecting in ${delay}ms (attempt ${this._wsReconnectAttempts})`);
      this._connectWebSocket();
    }, delay);
  }

  _disconnectWebSocket() {
    if (this._wsTimer) clearTimeout(this._wsTimer);
    if (this._ws) {
      try { this._ws.close(); } catch (_) {}
      this._ws = null;
    }
    this._wsReady = false;
  }

  _handleWsMessage(msg) {
    switch (msg.type) {
      case 'presence': {
        const { userId, status, room } = msg;
        this._presence.set(userId, status);
        if (this._friends.has(userId)) {
          const f = this._friends.get(userId);
          f.status = status;
          f.room = room || f.room;
          this._friends.set(userId, f);
          this._emit('presence', { userId, status, room });
          this._updateFriendRow(userId);
        }
        break;
      }
      case 'friendRequest': {
        const req = msg.request;
        if (req && req.from && !this._isBlocked(req.from.id)) {
          this._requests.set(req.from.id, { ...req, status: 'pending' });
          this._emit('request', req);
          this._renderPendingBadge();
          this._saveCache();
          if (this.game?.ui?.toast) this.game.ui.toast(`${req.from.username} sent a friend request!`, 'info');
        }
        break;
      }
      case 'friendAccepted': {
        const who = msg.user;
        if (who) {
          this._friends.set(who.id, { id: who.id, username: who.username, avatar: who.avatar, status: 'online', room: who.room || 'unknown' });
          this._requests.delete(who.id);
          this._emit('accepted', who);
          this._saveCache();
          if (this.game?.ui?.toast) this.game.ui.toast(`${who.username} accepted your request!`, 'success');
        }
        break;
      }
      case 'whisper': {
        const { fromId, fromName, text, ts } = msg;
        if (this._isBlocked(fromId)) break;
        const arr = this._messages.get(fromId) || [];
        arr.push({ from: fromId, fromName, text, ts: ts || Date.now(), self: false });
        if (arr.length > 200) arr.splice(0, arr.length - 200);
        this._messages.set(fromId, arr);
        this._saveCache();
        this._emit('whisper', { fromId, fromName, text });
        if (this._selectedFriendId !== fromId && this.game?.ui?.toast) {
          this.game.ui.toast(`💬 ${fromName}: ${text.slice(0, 40)}${text.length > 40 ? '…' : ''}`, 'info');
        }
        this._updateChatWindow();
        break;
      }
      case 'friendRemoved': {
        const { userId } = msg;
        this._friends.delete(userId);
        this._presence.delete(userId);
        this._emit('removed', { userId });
        this._saveCache();
        break;
      }
      default:
        break;
    }
  }

  _wsSend(obj) {
    if (this._ws && this._wsReady && this._ws.readyState === WebSocket.OPEN) {
      try {
        this._ws.send(JSON.stringify(obj));
        return true;
      } catch (e) {
        console.warn('[Friends] WS send failed:', e.message);
      }
    }
    return false;
  }

  /* ================================================================
     INITIALIZATION
     ================================================================ */

  async init() {
    this._loadCache();
    this._connectWebSocket();
    // Fetch current friends from server
    try {
      await this.getFriends();
    } catch (e) {
      console.warn('[Friends] Initial getFriends failed:', e.message);
    }
    // Build UI if game.ui exists
    try {
      this._buildPanel();
    } catch (e) {
      console.warn('[Friends] UI build failed:', e.message);
    }
    console.log('[Friends] Initialized. Friends:', this._friends.size, 'Requests:', this._requests.size);
  }

  /* ================================================================
     FRIEND REQUESTS
     ================================================================ */

  /**
   * Send a friend request by username.
   * @param {string} username
   * @returns {Promise<object>}
   */
  async sendRequest(username) {
    if (!username || typeof username !== 'string') throw new Error('Username required.');
    const u = username.trim();
    if (u.toLowerCase() === this._myName().toLowerCase()) throw new Error('You cannot friend yourself.');
    if (this.isFriend(u)) throw new Error('Already friends with this user.');

    // Try WebSocket first (faster), fallback to REST
    const wsOk = this._wsSend({ type: 'friendRequest', targetUsername: u });
    if (wsOk) {
      return { success: true, sent: true, via: 'websocket' };
    }

    try {
      const data = await this._api('/friends/request', { method: 'POST', body: { username: u } });
      this._emit('requestSent', { username: u });
      return { success: true, data };
    } catch (err) {
      console.error('[Friends] sendRequest failed:', err.message);
      throw err;
    }
  }

  /**
   * Accept an incoming friend request.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async acceptRequest(userId) {
    if (!userId) throw new Error('userId required.');
    const req = this._requests.get(userId);
    if (!req) throw new Error('No pending request from this user.');

    const wsOk = this._wsSend({ type: 'friendAccept', targetId: userId });
    if (wsOk) {
      this._friends.set(userId, { id: userId, username: req.from?.username || req.username || 'User', status: 'online' });
      this._requests.delete(userId);
      this._saveCache();
      this._render();
      return { success: true, via: 'websocket' };
    }

    try {
      const data = await this._api('/friends/accept', { method: 'POST', body: { userId } });
      this._friends.set(userId, { id: userId, username: req.from?.username || req.username || 'User', status: 'online' });
      this._requests.delete(userId);
      this._saveCache();
      this._emit('accepted', { id: userId });
      this._render();
      return { success: true, data };
    } catch (err) {
      console.error('[Friends] acceptRequest failed:', err.message);
      throw err;
    }
  }

  /**
   * Decline / reject a friend request.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async declineRequest(userId) {
    if (!userId) throw new Error('userId required.');
    if (!this._requests.has(userId)) throw new Error('No pending request from this user.');

    this._wsSend({ type: 'friendDecline', targetId: userId });

    try {
      await this._api('/friends/decline', { method: 'POST', body: { userId } });
    } catch (e) {
      console.warn('[Friends] declineRequest server error (ignored):', e.message);
    }
    this._requests.delete(userId);
    this._saveCache();
    this._emit('declined', { userId });
    this._render();
    return { success: true };
  }

  /**
   * Cancel an outgoing friend request.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async cancelRequest(userId) {
    if (!userId) throw new Error('userId required.');
    this._wsSend({ type: 'friendCancel', targetId: userId });
    try {
      await this._api('/friends/cancel', { method: 'POST', body: { userId } });
    } catch (e) {
      console.warn('[Friends] cancelRequest server error (ignored):', e.message);
    }
    this._requests.delete(userId);
    this._saveCache();
    this._render();
    return { success: true };
  }

  /* ================================================================
     FRIEND LIST
     ================================================================ */

  /**
   * Fetch friend list from server and merge with cache.
   * @returns {Promise<Array>}
   */
  async getFriends() {
    try {
      const data = await this._api('/friends', { method: 'GET' });
      const list = data?.friends || data?.data?.friends || [];
      if (Array.isArray(list)) {
        this._friends.clear();
        list.forEach((f) => {
          if (f?.id && !this._isBlocked(f.id)) {
            this._friends.set(f.id, { ...f, status: f.status || 'offline' });
            this._presence.set(f.id, f.status || 'offline');
          }
        });
        this._saveCache();
      }
    } catch (err) {
      console.warn('[Friends] getFriends server error:', err.message);
    }
    return Array.from(this._friends.values());
  }

  /**
   * Get only online friends.
   * @returns {Array}
   */
  getOnlineFriends() {
    return Array.from(this._friends.values()).filter((f) => f.status === 'online' || this._presence.get(f.id) === 'online');
  }

  /**
   * Get total friend count.
   * @returns {number}
   */
  getFriendCount() {
    return this._friends.size;
  }

  /**
   * Get online friend count.
   * @returns {number}
   */
  getOnlineCount() {
    return this.getOnlineFriends().length;
  }

  /**
   * Check if a username is already a friend.
   * @param {string} username
   * @returns {boolean}
   */
  isFriend(username) {
    if (!username) return false;
    const u = username.toLowerCase();
    for (const f of this._friends.values()) {
      if ((f.username || f.name || '').toLowerCase() === u) return true;
    }
    return false;
  }

  /**
   * Check if a userId is a friend.
   * @param {string} userId
   * @returns {boolean}
   */
  isFriendById(userId) {
    return this._friends.has(userId);
  }

  /**
   * Get pending (incoming) friend requests.
   * @returns {Array}
   */
  getPendingRequests() {
    return Array.from(this._requests.values()).filter((r) => r.status === 'pending' || !r.status);
  }

  /**
   * Get outgoing friend requests.
   * @returns {Array}
   */
  getOutgoingRequests() {
    return Array.from(this._requests.values()).filter((r) => r.status === 'outgoing');
  }

  /**
   * Remove a friend.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async removeFriend(userId) {
    if (!userId) throw new Error('userId required.');
    if (!this._friends.has(userId)) throw new Error('Not friends with this user.');

    this._wsSend({ type: 'friendRemove', targetId: userId });
    try {
      await this._api('/friends/remove', { method: 'POST', body: { userId } });
    } catch (e) {
      console.warn('[Friends] removeFriend server error (ignored):', e.message);
    }
    this._friends.delete(userId);
    this._presence.delete(userId);
    this._messages.delete(userId);
    this._saveCache();
    this._emit('removed', { userId });
    this._render();
    return { success: true };
  }

  /* ================================================================
     BLOCKING
     ================================================================ */

  /**
   * Block a user. Removes them from friends and prevents future requests.
   * @param {string} userId
   * @param {string} username — for display purposes
   * @returns {Promise<object>}
   */
  async blockUser(userId, username = 'User') {
    if (!userId) throw new Error('userId required.');
    this._blocked.add(userId);
    // Remove from friends if present
    if (this._friends.has(userId)) {
      await this.removeFriend(userId);
    }
    this._requests.delete(userId);
    try {
      await this._api('/friends/block', { method: 'POST', body: { userId } });
    } catch (e) {
      console.warn('[Friends] blockUser server error (ignored):', e.message);
    }
    this._saveCache();
    this._emit('blocked', { userId, username });
    this._render();
    return { success: true };
  }

  /**
   * Unblock a user.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async unblockUser(userId) {
    if (!userId) throw new Error('userId required.');
    this._blocked.delete(userId);
    try {
      await this._api('/friends/unblock', { method: 'POST', body: { userId } });
    } catch (e) {
      console.warn('[Friends] unblockUser server error (ignored):', e.message);
    }
    this._saveCache();
    this._emit('unblocked', { userId });
    this._render();
    return { success: true };
  }

  /**
   * Get blocked users list.
   * @returns {Array}
   */
  getBlockedUsers() {
    return Array.from(this._blocked);
  }

  /**
   * Check if user is blocked.
   * @param {string} userId
   * @returns {boolean}
   */
  isBlocked(userId) {
    return this._blocked.has(userId);
  }

  /* ================================================================
     WHISPER / PRIVATE CHAT
     ================================================================ */

  /**
   * Send a private message to a friend.
   * @param {string} userId
   * @param {string} message
   * @returns {Promise<object>}
   */
  async whisper(userId, message) {
    if (!userId) throw new Error('userId required.');
    if (!message || !message.trim()) throw new Error('Message cannot be empty.');
    if (this._isBlocked(userId)) throw new Error('You have blocked this user.');

    const text = message.trim();
    const ts = Date.now();

    // Store locally immediately (optimistic)
    const arr = this._messages.get(userId) || [];
    arr.push({ from: this._myId(), fromName: this._myName(), text, ts, self: true });
    if (arr.length > 200) arr.splice(0, arr.length - 200);
    this._messages.set(userId, arr);
    this._saveCache();
    this._updateChatWindow();

    // Send via WebSocket
    const wsOk = this._wsSend({ type: 'whisper', targetId: userId, text, ts });
    if (wsOk) return { success: true, via: 'websocket' };

    // Fallback REST
    try {
      const data = await this._api('/friends/whisper', { method: 'POST', body: { to: userId, text } });
      return { success: true, data };
    } catch (err) {
      console.error('[Friends] whisper failed:', err.message);
      // Message stays in local history even if server fails
      throw err;
    }
  }

  /**
   * Get message history with a friend.
   * @param {string} userId
   * @returns {Array}
   */
  getMessages(userId) {
    return this._messages.get(userId) || [];
  }

  /**
   * Clear message history with a friend.
   * @param {string} userId
   */
  clearMessages(userId) {
    this._messages.delete(userId);
    this._saveCache();
  }

  /* ================================================================
     FRIEND PROFILE / SEARCH
     ================================================================ */

  /**
   * Fetch a friend's public profile.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async getFriendProfile(userId) {
    if (!userId) throw new Error('userId required.');
    // Return cached profile first
    if (this._profiles.has(userId)) {
      return { success: true, data: this._profiles.get(userId) };
    }
    try {
      const data = await this._api(`/users/${encodeURIComponent(userId)}/profile`, { method: 'GET' });
      if (data?.profile || data?.data) {
        const prof = data.profile || data.data;
        this._profiles.set(userId, prof);
        return { success: true, data: prof };
      }
    } catch (err) {
      console.warn('[Friends] getFriendProfile failed:', err.message);
    }
    // Fallback to minimal friend data
    const f = this._friends.get(userId);
    if (f) return { success: true, data: f, source: 'cache' };
    return { success: false, data: null };
  }

  /**
   * Search for users by username (partial match).
   * @param {string} query
   * @returns {Promise<object>}
   */
  async searchUsers(query) {
    if (!query || query.length < 2) throw new Error('Search query must be at least 2 characters.');
    try {
      const data = await this._api(`/users/search?q=${encodeURIComponent(query.trim())}`, { method: 'GET' });
      return { success: true, data: data?.users || data?.data?.users || [] };
    } catch (err) {
      console.warn('[Friends] searchUsers failed:', err.message);
      throw err;
    }
  }

  /* ================================================================
     UI — FRIEND PANEL (slides in from right)
     ================================================================ */

  _buildPanel() {
    if (this._panelEl) return;
    const el = document.createElement('div');
    el.id = 'friend-panel';
    el.style.cssText = `
      position:fixed; top:0; right:-340px; width:320px; height:100vh;
      background: linear-gradient(180deg,#1e1035 0%,#2d1b4e 100%);
      color:#ffe4b5; font-family:'Segoe UI',sans-serif; z-index:99980;
      display:flex; flex-direction:column; transition:right 0.35s cubic-bezier(0.4,0,0.2,1);
      box-shadow:-4px 0 20px rgba(0,0,0,0.4); border-left:1px solid rgba(255,215,0,0.15);
    `;
    el.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1rem; border-bottom:1px solid rgba(255,255,255,0.08);">
        <span style="font-weight:700; font-size:1.05rem;">👥 Friends</span>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span id="friend-online-badge" style="background:rgba(0,200,100,0.2); color:#00ff88; font-size:0.7rem; padding:2px 8px; border-radius:10px; font-weight:600;">0 online</span>
          <button id="friend-close" style="background:none; border:none; color:#ffe4b5; font-size:1.3rem; cursor:pointer; line-height:1;">×</button>
        </div>
      </div>
      <div style="padding:0.6rem 1rem; border-bottom:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex; gap:0.4rem;">
          <input id="friend-search-input" type="text" placeholder="Search users..." style="flex:1; padding:0.45rem 0.7rem; border-radius:6px; border:none; background:rgba(255,255,255,0.08); color:#fff; font-size:0.85rem; outline:none;">
          <button id="friend-add-btn" style="padding:0.45rem 0.7rem; border-radius:6px; border:none; background:#ffd700; color:#1a0b2e; font-weight:700; font-size:0.8rem; cursor:pointer;">+ Add</button>
        </div>
      </div>
      <div id="friend-pending-area" style="display:none; padding:0.5rem 1rem; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(255,215,0,0.04);">
        <div style="font-size:0.75rem; opacity:0.6; margin-bottom:0.3rem;">Pending Requests</div>
        <div id="friend-pending-list"></div>
      </div>
      <div id="friend-list-area" style="flex:1; overflow-y:auto; padding:0.5rem 0;">
        <div id="friend-list" style="display:flex; flex-direction:column; gap:2px;"></div>
      </div>
      <div id="friend-chat-area" style="display:none; height:200px; border-top:1px solid rgba(255,255,255,0.08); flex-direction:column;">
        <div style="display:flex; align-items:center; justify-content:space-between; padding:0.4rem 0.75rem; border-bottom:1px solid rgba(255,255,255,0.06);">
          <span id="friend-chat-title" style="font-size:0.8rem; font-weight:600;">Chat</span>
          <button id="friend-chat-close" style="background:none; border:none; color:#ffe4b5; font-size:0.9rem; cursor:pointer;">✕</button>
        </div>
        <div id="friend-chat-messages" style="flex:1; overflow-y:auto; padding:0.5rem 0.75rem; font-size:0.8rem; display:flex; flex-direction:column; gap:0.3rem;"></div>
        <div style="display:flex; gap:0.3rem; padding:0.4rem 0.75rem; border-top:1px solid rgba(255,255,255,0.06);">
          <input id="friend-chat-input" type="text" placeholder="Type a message..." maxlength="300" style="flex:1; padding:0.4rem 0.6rem; border-radius:5px; border:none; background:rgba(255,255,255,0.08); color:#fff; font-size:0.8rem; outline:none;">
          <button id="friend-chat-send" style="padding:0.4rem 0.7rem; border-radius:5px; border:none; background:#ffd700; color:#1a0b2e; font-weight:700; font-size:0.75rem; cursor:pointer;">Send</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    this._panelEl = el;

    // Wire events
    document.getElementById('friend-close')?.addEventListener('click', () => this.togglePanel(false));
    document.getElementById('friend-add-btn')?.addEventListener('click', () => this._onAddFriend());
    document.getElementById('friend-search-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._onAddFriend();
    });
    document.getElementById('friend-chat-close')?.addEventListener('click', () => this._closeChat());
    document.getElementById('friend-chat-send')?.addEventListener('click', () => this._onSendChat());
    document.getElementById('friend-chat-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._onSendChat();
    });
  }

  _onAddFriend() {
    const input = document.getElementById('friend-search-input');
    const u = input?.value?.trim();
    if (!u) return;
    this.sendRequest(u).then(() => {
      if (this.game?.ui?.toast) this.game.ui.toast(`Friend request sent to ${u}`, 'success');
      input.value = '';
    }).catch((err) => {
      if (this.game?.ui?.toast) this.game.ui.toast(err.message, 'error');
    });
  }

  _onSendChat() {
    const input = document.getElementById('friend-chat-input');
    const text = input?.value?.trim();
    if (!text || !this._selectedFriendId) return;
    this.whisper(this._selectedFriendId, text).then(() => {
      input.value = '';
    }).catch((err) => {
      if (this.game?.ui?.toast) this.game.ui.toast(err.message, 'error');
    });
  }

  /* ================================================================
     UI — RENDER
     ================================================================ */

  _render() {
    this._renderFriendList();
    this._renderPendingBadge();
    this._updateOnlineBadge();
  }

  _renderFriendList() {
    const container = document.getElementById('friend-list');
    if (!container) return;
    const friends = Array.from(this._friends.values()).sort((a, b) => {
      const aOn = (a.status || this._presence.get(a.id)) === 'online' ? 1 : 0;
      const bOn = (b.status || this._presence.get(b.id)) === 'online' ? 1 : 0;
      return bOn - aOn || (a.username || a.name || '').localeCompare(b.username || b.name || '');
    });

    if (friends.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:2rem 1rem; opacity:0.4; font-size:0.85rem;">
          No friends yet.<br>Use the search above to add some!
        </div>
      `;
      return;
    }

    container.innerHTML = friends.map((f) => {
      const status = f.status || this._presence.get(f.id) || 'offline';
      const statusColor = status === 'online' ? '#00ff88' : status === 'away' ? '#ffaa00' : '#888';
      const statusText = status === 'online' ? 'Online' : status === 'away' ? 'Away' : 'Offline';
      const room = f.room || 'Unknown room';
      const hasChat = (this._messages.get(f.id)?.length || 0) > 0;
      return `
        <div class="friend-row" data-id="${f.id}" style="display:flex; align-items:center; gap:0.6rem; padding:0.5rem 1rem; cursor:pointer; transition:background 0.15s; border-radius:6px;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='transparent'">
          <div style="position:relative; flex-shrink:0;">
            <div style="width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg,#6fa3ef,#ffd700); display:flex; align-items:center; justify-content:center; font-size:0.9rem; font-weight:700; color:#1a0b2e;">${(f.username || f.name || 'U').charAt(0).toUpperCase()}</div>
            <div style="position:absolute; bottom:0; right:0; width:10px; height:10px; border-radius:50%; background:${statusColor}; border:2px solid #2d1b4e;"></div>
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:0.85rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${f.username || f.name || 'User'}</div>
            <div style="font-size:0.7rem; opacity:0.5;">${statusText} • ${room}</div>
          </div>
          <div style="display:flex; gap:0.2rem; flex-shrink:0;">
            <button class="friend-btn-chat" data-id="${f.id}" style="background:rgba(255,255,255,0.08); border:none; color:#ffe4b5; border-radius:5px; padding:0.25rem 0.45rem; font-size:0.75rem; cursor:pointer; ${hasChat ? 'background:rgba(255,215,0,0.15);' : ''}">💬</button>
            <button class="friend-btn-menu" data-id="${f.id}" style="background:rgba(255,255,255,0.08); border:none; color:#ffe4b5; border-radius:5px; padding:0.25rem 0.45rem; font-size:0.75rem; cursor:pointer;">⋯</button>
          </div>
        </div>
      `;
    }).join('');

    // Wire row clicks
    container.querySelectorAll('.friend-row').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.friend-btn-chat') || e.target.closest('.friend-btn-menu')) return;
        this._openProfile(row.dataset.id);
      });
    });
    container.querySelectorAll('.friend-btn-chat').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this._openChat(btn.dataset.id); });
    });
    container.querySelectorAll('.friend-btn-menu').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this._showFriendMenu(btn.dataset.id, btn); });
    });
  }

  _renderPendingBadge() {
    const pending = this.getPendingRequests();
    const area = document.getElementById('friend-pending-area');
    const list = document.getElementById('friend-pending-list');
    if (!area || !list) return;

    if (pending.length === 0) {
      area.style.display = 'none';
      return;
    }
    area.style.display = 'block';
    list.innerHTML = pending.map((r) => {
      const from = r.from || {};
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:0.3rem 0; font-size:0.8rem;">
          <span>${from.username || from.name || 'User'}</span>
          <div style="display:flex; gap:0.3rem;">
            <button class="req-accept" data-id="${from.id}" style="background:#00aa55; border:none; color:#fff; border-radius:4px; padding:0.2rem 0.5rem; font-size:0.7rem; cursor:pointer;">Accept</button>
            <button class="req-decline" data-id="${from.id}" style="background:#aa3333; border:none; color:#fff; border-radius:4px; padding:0.2rem 0.5rem; font-size:0.7rem; cursor:pointer;">Decline</button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.req-accept').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.acceptRequest(btn.dataset.id).catch((e) => {
          if (this.game?.ui?.toast) this.game.ui.toast(e.message, 'error');
        });
      });
    });
    list.querySelectorAll('.req-decline').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.declineRequest(btn.dataset.id).catch(() => {});
      });
    });
  }

  _updateOnlineBadge() {
    const badge = document.getElementById('friend-online-badge');
    if (badge) badge.textContent = `${this.getOnlineCount()} online`;
  }

  _updateFriendRow(userId) {
    // Re-render whole list for simplicity; could optimize to single row
    this._renderFriendList();
    this._updateOnlineBadge();
  }

  _updateChatWindow() {
    if (!this._selectedFriendId) return;
    const msgArea = document.getElementById('friend-chat-messages');
    if (!msgArea) return;
    const msgs = this._messages.get(this._selectedFriendId) || [];
    msgArea.innerHTML = msgs.map((m) => {
      const isSelf = m.self || m.from === this._myId();
      const align = isSelf ? 'flex-end' : 'flex-start';
      const bg = isSelf ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.06)';
      const time = new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <div style="display:flex; justify-content:${align};">
          <div style="max-width:85%; background:${bg}; padding:0.35rem 0.55rem; border-radius:8px; font-size:0.78rem; line-height:1.3;">
            <div style="opacity:0.5; font-size:0.65rem; margin-bottom:1px;">${isSelf ? 'You' : (m.fromName || 'Friend')} • ${time}</div>
            <div>${this._escapeHtml(m.text)}</div>
          </div>
        </div>
      `;
    }).join('');
    msgArea.scrollTop = msgArea.scrollHeight;
  }

  _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ================================================================
     UI — PROFILE & CHAT & MENU
     ================================================================ */

  _openProfile(userId) {
    const f = this._friends.get(userId);
    if (!f) return;
    this.getFriendProfile(userId).then((res) => {
      const prof = res.data || f;
      const html = `
        <div style="position:fixed; inset:0; z-index:99990; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.5);">
          <div style="background: linear-gradient(180deg,#2d1b4e 0%,#1e1035 100%); border:1px solid rgba(255,215,0,0.2); border-radius:12px; padding:1.5rem; width:300px; color:#ffe4b5;">
            <div style="display:flex; align-items:center; gap:0.8rem; margin-bottom:1rem;">
              <div style="width:56px; height:56px; border-radius:50%; background:linear-gradient(135deg,#6fa3ef,#ffd700); display:flex; align-items:center; justify-content:center; font-size:1.4rem; font-weight:700; color:#1a0b2e;">${(prof.username || prof.name || 'U').charAt(0).toUpperCase()}</div>
              <div>
                <div style="font-weight:700; font-size:1.1rem;">${prof.username || prof.name || 'User'}</div>
                <div style="font-size:0.75rem; opacity:0.5;">${prof.room || 'Unknown room'}</div>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
              <button id="prof-chat" style="padding:0.6rem; border-radius:8px; border:none; background:#ffd700; color:#1a0b2e; font-weight:700; cursor:pointer;">💬 Chat</button>
              <button id="prof-remove" style="padding:0.6rem; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:transparent; color:#ff6b6b; font-weight:600; cursor:pointer;">Remove Friend</button>
              <button id="prof-block" style="padding:0.6rem; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:transparent; color:#ffe4b5; font-weight:600; cursor:pointer;">Block User</button>
              <button id="prof-close" style="padding:0.6rem; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:transparent; color:#ffe4b5; font-weight:600; cursor:pointer;">Close</button>
            </div>
          </div>
        </div>
      `;
      const modal = document.createElement('div');
      modal.innerHTML = html;
      document.body.appendChild(modal);

      modal.querySelector('#prof-close')?.addEventListener('click', () => modal.remove());
      modal.querySelector('#prof-chat')?.addEventListener('click', () => { modal.remove(); this._openChat(userId); });
      modal.querySelector('#prof-remove')?.addEventListener('click', () => {
        this.removeFriend(userId).then(() => {
          if (this.game?.ui?.toast) this.game.ui.toast('Friend removed', 'info');
          modal.remove();
        });
      });
      modal.querySelector('#prof-block')?.addEventListener('click', () => {
        this.blockUser(userId, prof.username).then(() => {
          if (this.game?.ui?.toast) this.game.ui.toast('User blocked', 'info');
          modal.remove();
        });
      });
    }).catch((e) => console.warn(e));
  }

  _openChat(userId) {
    this._selectedFriendId = userId;
    const chatArea = document.getElementById('friend-chat-area');
    const chatTitle = document.getElementById('friend-chat-title');
    const f = this._friends.get(userId);
    if (chatTitle) chatTitle.textContent = f?.username || f?.name || 'Chat';
    if (chatArea) chatArea.style.display = 'flex';
    this._updateChatWindow();
  }

  _closeChat() {
    this._selectedFriendId = null;
    const chatArea = document.getElementById('friend-chat-area');
    if (chatArea) chatArea.style.display = 'none';
  }

  _showFriendMenu(userId, anchorEl) {
    const existing = document.getElementById('friend-menu-popup');
    if (existing) existing.remove();
    const f = this._friends.get(userId);
    if (!f) return;
    const menu = document.createElement('div');
    menu.id = 'friend-menu-popup';
    menu.style.cssText = `
      position:absolute; z-index:99995;
      background:#2d1b4e; border:1px solid rgba(255,255,255,0.1); border-radius:8px;
      padding:0.3rem 0; min-width:140px; color:#ffe4b5; font-size:0.8rem;
    `;
    const rect = anchorEl.getBoundingClientRect();
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    menu.innerHTML = `
      <div class="fmenu-item" data-action="chat" style="padding:0.4rem 0.8rem; cursor:pointer; hover-bg">💬 Chat</div>
      <div class="fmenu-item" data-action="profile" style="padding:0.4rem 0.8rem; cursor:pointer;">👤 Profile</div>
      <div style="height:1px; background:rgba(255,255,255,0.1); margin:0.2rem 0;"></div>
      <div class="fmenu-item" data-action="remove" style="padding:0.4rem 0.8rem; cursor:pointer; color:#ff6b6b;">Remove</div>
      <div class="fmenu-item" data-action="block" style="padding:0.4rem 0.8rem; cursor:pointer; color:#ff6b6b;">Block</div>
    `;
    document.body.appendChild(menu);

    menu.querySelectorAll('.fmenu-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        const action = item.dataset.action;
        if (action === 'chat') this._openChat(userId);
        if (action === 'profile') this._openProfile(userId);
        if (action === 'remove') {
          this.removeFriend(userId).then(() => {
            if (this.game?.ui?.toast) this.game.ui.toast('Friend removed', 'info');
          });
        }
        if (action === 'block') {
          this.blockUser(userId, f.username).then(() => {
            if (this.game?.ui?.toast) this.game.ui.toast('User blocked', 'info');
          });
        }
      });
    });

    const closeMenu = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closeMenu); } };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
  }

  /* ================================================================
     PANEL TOGGLE
     ================================================================ */

  togglePanel(forceState = null) {
    if (!this._panelEl) this._buildPanel();
    const open = forceState !== null ? forceState : !this._panelOpen;
    this._panelOpen = open;
    if (this._panelEl) this._panelEl.style.right = open ? '0' : '-340px';
    if (open) this._render();
  }

  isPanelOpen() {
    return this._panelOpen;
  }

  /* ================================================================
     DISPOSAL
     ================================================================ */

  dispose() {
    this._disconnectWebSocket();
    if (this._panelEl) {
      this._panelEl.remove();
      this._panelEl = null;
    }
    this._listeners.clear();
  }

  /* ================================================================
     DEBUG
     ================================================================ */

  inspect() {
    console.log('[FriendSystem]', {
      friends: this._friends.size,
      online: this.getOnlineCount(),
      requests: this._requests.size,
      blocked: this._blocked.size,
      wsReady: this._wsReady,
      panelOpen: this._panelOpen
    });
  }
}

export default FriendSystem;
