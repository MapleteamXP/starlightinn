/**
 * @file Friends.js
 * @description Friend list, requests, presence, and blocking for Starlight Inn v3.
 * Persists to localStorage. Renders an in-game friend list overlay.
 */

const STORAGE_KEY = 'starlight_friends_v3';

/** Presence status enum values. */
export const PRESENCE = {
  ONLINE:  'online',
  AWAY:    'away',
  BUSY:    'busy',
  OFFLINE: 'offline',
};

/** Color dot per presence status. */
const STATUS_DOT = {
  online:  '#22C55E',
  away:    '#EAB308',
  busy:    '#EF4444',
  offline: '#9CA3AF',
};

export class Friends {
  /**
   * @param {Object} game — The main game instance.
   */
  constructor(game) {
    this.game = game;
    this.list = [];       // { id, name, status, location, addedAt }
    this.requests = [];   // { id, name, sentAt }
    this.blocked = new Set(); // player ids
    this.storageKey = STORAGE_KEY;

    // UI refs
    this._panelEl = null;
    this._listEl = null;
    this._requestEl = null;
    this._visible = false;

    // Presence polling timer
    this._presenceTimer = null;
  }

  /** Initialize and load persisted data. */
  init() {
    this.load();
    this._buildUI();
    this._attachListeners();
    this._startPresencePoll();
  }

  /**
   * Send a friend request to another player.
   * @param {string} playerId
   * @param {string} playerName
   */
  addFriend(playerId, playerName) {
    if (!playerId || !playerName) return;
    if (this.isFriend(playerId)) {
      this.game.chat && this.game.chat.system(`${playerName} is already your friend.`);
      return;
    }
    if (this.isBlocked(playerId)) {
      this.game.chat && this.game.chat.system('You have blocked this player.');
      return;
    }

    // Avoid duplicate outgoing request
    const existing = this.requests.find((r) => r.id === playerId && r.direction === 'out');
    if (existing) {
      this.game.chat && this.game.chat.system('Friend request already pending.');
      return;
    }

    const request = {
      id: playerId,
      name: playerName,
      sentAt: Date.now(),
      direction: 'out',
    };
    this.requests.push(request);
    this.save();

    this.game.chat && this.game.chat.system(`Friend request sent to ${playerName}.`);
    this.game.emit && this.game.emit('friendRequest', { toId: playerId, toName: playerName });
    this.renderFriendList();
  }

  /**
   * Receive a friend request from another player.
   * @param {string} playerId
   * @param {string} playerName
   */
  receiveRequest(playerId, playerName) {
    if (this.isBlocked(playerId)) return;
    const request = {
      id: playerId,
      name: playerName,
      sentAt: Date.now(),
      direction: 'in',
    };
    this.requests.push(request);
    this.save();

    this.game.chat && this.game.chat.system(`${playerName} wants to be your friend!`);
    this.renderFriendList();
  }

  /**
   * Accept an incoming friend request.
   * @param {string} requestId — player id of the requester
   */
  acceptRequest(requestId) {
    const idx = this.requests.findIndex((r) => r.id === requestId && r.direction === 'in');
    if (idx < 0) return;

    const req = this.requests[idx];
    this.requests.splice(idx, 1);

    const friend = {
      id: req.id,
      name: req.name,
      status: PRESENCE.OFFLINE,
      location: null,
      addedAt: Date.now(),
    };
    this.list.push(friend);
    this.save();

    this.game.chat && this.game.chat.system(`You and ${req.name} are now friends!`);
    this.game.emit && this.game.emit('friendAccept', { friendId: req.id });
    this.renderFriendList();
  }

  /**
   * Decline an incoming friend request.
   * @param {string} requestId
   */
  declineRequest(requestId) {
    const idx = this.requests.findIndex((r) => r.id === requestId && r.direction === 'in');
    if (idx < 0) return;
    const req = this.requests[idx];
    this.requests.splice(idx, 1);
    this.save();

    this.game.chat && this.game.chat.system(`Declined friend request from ${req.name}.`);
    this.renderFriendList();
  }

  /**
   * Remove a friend from the list.
   * @param {string} playerId
   */
  removeFriend(playerId) {
    const idx = this.list.findIndex((f) => f.id === playerId);
    if (idx < 0) return;
    const name = this.list[idx].name;
    this.list.splice(idx, 1);
    this.save();

    this.game.chat && this.game.chat.system(`${name} removed from friends.`);
    this.renderFriendList();
  }

  /**
   * Block a player (prevents friend requests, whispers, invites).
   * @param {string} playerId
   */
  blockPlayer(playerId) {
    this.blocked.add(playerId);
    // Remove from friends if present
    this.removeFriend(playerId);
    // Cancel any pending requests
    this.requests = this.requests.filter((r) => r.id !== playerId);
    this.save();
    this.renderFriendList();
  }

  /**
   * Unblock a previously blocked player.
   * @param {string} playerId
   */
  unblockPlayer(playerId) {
    this.blocked.delete(playerId);
    this.save();
    this.renderFriendList();
  }

  /**
   * Check if a player is a friend.
   * @param {string} playerId
   * @returns {boolean}
   */
  isFriend(playerId) {
    return this.list.some((f) => f.id === playerId);
  }

  /**
   * Check if a player is blocked.
   * @param {string} playerId
   * @returns {boolean}
   */
  isBlocked(playerId) {
    return this.blocked.has(playerId);
  }

  /**
   * Update a friend's presence status.
   * @param {string} playerId
   * @param {string} status — 'online' | 'away' | 'busy' | 'offline'
   * @param {string|null} location — area name
   */
  updatePresence(playerId, status, location = null) {
    const friend = this.list.find((f) => f.id === playerId);
    if (!friend) return;
    friend.status = status;
    if (location !== undefined) friend.location = location;
    this.renderFriendList();
  }

  /** @returns {Array} All online friends. */
  getOnlineFriends() {
    return this.list.filter((f) => f.status === PRESENCE.ONLINE);
  }

  /** @returns {Array} Friends currently in a given area. */
  getFriendsInArea(areaId) {
    return this.list.filter((f) => f.location === areaId);
  }

  /** Toggle friend list panel visibility. */
  toggle() {
    this._visible = !this._visible;
    if (this._panelEl) {
      this._panelEl.style.display = this._visible ? 'flex' : 'none';
    }
    if (this._visible) this.renderFriendList();
  }

  /** Show the friend list panel. */
  show() {
    this._visible = true;
    if (this._panelEl) this._panelEl.style.display = 'flex';
    this.renderFriendList();
  }

  /** Hide the friend list panel. */
  hide() {
    this._visible = false;
    if (this._panelEl) this._panelEl.style.display = 'none';
  }

  /**
   * Render the friend list into the panel.
   * @param {HTMLElement} [container] — optional external container
   */
  renderFriendList(container) {
    const target = container || this._listEl;
    if (!target) return;

    // Sort: online first, then away, busy, offline
    const sorted = [...this.list].sort((a, b) => {
      const order = { online: 0, away: 1, busy: 2, offline: 3 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });

    const html = sorted.map((f) => {
      const dotColor = STATUS_DOT[f.status] || STATUS_DOT.offline;
      const statusLabel = f.status.charAt(0).toUpperCase() + f.status.slice(1);
      const locLabel = f.location ? ` — ${f.location}` : '';
      return `
        <div class="friend-row" data-id="${f.id}">
          <span class="friend-dot" style="background:${dotColor}"></span>
          <span class="friend-name">${this._escapeHtml(f.name)}</span>
          <span class="friend-meta">${statusLabel}${locLabel}</span>
          <div class="friend-actions">
            <button class="btn-whisper" title="Whisper">💬</button>
            <button class="btn-visit" title="Visit area">🌐</button>
            <button class="btn-remove" title="Remove">❌</button>
          </div>
        </div>
      `;
    }).join('');

    target.innerHTML = html || '<div class="friend-empty">No friends yet. Say hello!</div>';

    // Wire inline actions
    target.querySelectorAll('.friend-row').forEach((row) => {
      const id = row.dataset.id;
      const friend = this.list.find((f) => f.id === id);
      if (!friend) return;

      row.querySelector('.btn-whisper').addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.chat && this.game.chat.whisper(friend, '');
      });
      row.querySelector('.btn-visit').addEventListener('click', (e) => {
        e.stopPropagation();
        if (friend.location) {
          this.game.emit && this.game.emit('visitArea', friend.location);
        }
      });
      row.querySelector('.btn-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFriend(id);
      });
    });

    // Render pending requests
    this._renderRequests();
  }

  /** Render incoming friend requests sub-panel. */
  _renderRequests() {
    if (!this._requestEl) return;
    const incoming = this.requests.filter((r) => r.direction === 'in');
    if (incoming.length === 0) {
      this._requestEl.innerHTML = '';
      this._requestEl.style.display = 'none';
      return;
    }

    this._requestEl.style.display = 'block';
    const html = incoming.map((r) => `
      <div class="request-row" data-id="${r.id}">
        <span class="request-name">${this._escapeHtml(r.name)}</span>
        <button class="btn-accept">Accept</button>
        <button class="btn-decline">Decline</button>
      </div>
    `).join('');

    this._requestEl.innerHTML = `<div class="request-header">Friend Requests</div>` + html;

    this._requestEl.querySelectorAll('.request-row').forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('.btn-accept').addEventListener('click', () => this.acceptRequest(id));
      row.querySelector('.btn-decline').addEventListener('click', () => this.declineRequest(id));
    });
  }

  /** Build the friend list UI panel. */
  _buildUI() {
    let panel = document.getElementById('friend-panel');
    if (panel) {
      this._panelEl = panel;
      this._listEl = document.getElementById('friend-list');
      this._requestEl = document.getElementById('friend-requests');
      return;
    }

    panel = document.createElement('div');
    panel.id = 'friend-panel';
    panel.className = 'friend-panel';
    panel.innerHTML = `
      <div class="friend-header">
        <span>Friends</span>
        <button class="friend-close">✕</button>
      </div>
      <div class="friend-requests" id="friend-requests"></div>
      <div class="friend-list" id="friend-list"></div>
    `;
    document.body.appendChild(panel);

    if (!document.getElementById('friend-style')) {
      const style = document.createElement('style');
      style.id = 'friend-style';
      style.textContent = `
        .friend-panel { position:fixed; top:60px; right:12px; width:260px; max-height:400px; display:none; flex-direction:column;
          background:rgba(17,24,39,0.95); border:1px solid rgba(255,255,255,0.08); border-radius:12px; z-index:60;
          font-family:sans-serif; font-size:13px; overflow:hidden; backdrop-filter:blur(6px); }
        .friend-header { display:flex; justify-content:space-between; align-items:center; padding:8px 10px;
          border-bottom:1px solid rgba(255,255,255,0.06); color:#E5E7EB; font-weight:600; }
        .friend-close { background:none; border:none; color:#9CA3AF; cursor:pointer; font-size:14px; }
        .friend-requests { padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.06); }
        .request-header { font-size:11px; color:#9CA3AF; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px; }
        .request-row { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
        .request-name { flex:1; color:#E5E7EB; }
        .btn-accept, .btn-decline { font-size:11px; padding:2px 8px; border:none; border-radius:4px; cursor:pointer; }
        .btn-accept { background:#10B981; color:#fff; }
        .btn-decline { background:#374151; color:#9CA3AF; }
        .friend-list { flex:1; overflow-y:auto; padding:6px 8px; }
        .friend-row { display:flex; align-items:center; gap:6px; padding:5px 6px; border-radius:6px; cursor:pointer; }
        .friend-row:hover { background:rgba(255,255,255,0.04); }
        .friend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .friend-name { color:#E5E7EB; flex:1; font-weight:500; }
        .friend-meta { color:#6B7280; font-size:11px; }
        .friend-actions { display:flex; gap:4px; opacity:0; transition:opacity .15s; }
        .friend-row:hover .friend-actions { opacity:1; }
        .friend-actions button { background:rgba(255,255,255,0.06); border:none; border-radius:4px; color:#E5E7EB; cursor:pointer; font-size:12px; padding:2px 6px; }
        .friend-actions button:hover { background:rgba(255,255,255,0.12); }
        .friend-empty { color:#6B7280; font-size:12px; text-align:center; padding:16px 0; }
      `;
      document.head.appendChild(style);
    }

    this._panelEl = panel;
    this._listEl = document.getElementById('friend-list');
    this._requestEl = document.getElementById('friend-requests');
  }

  _attachListeners() {
    if (!this._panelEl) return;
    const closeBtn = this._panelEl.querySelector('.friend-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hide());

    // Keyboard shortcut (Shift+F)
    document.addEventListener('keydown', (e) => {
      if (e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /** Simulate presence polling (replace with real websocket in production). */
  _startPresencePoll() {
    if (this._presenceTimer) clearInterval(this._presenceTimer);
    this._presenceTimer = setInterval(() => {
      // In a real build, this would query the server for friend statuses
      this.game.emit && this.game.emit('pollPresence', { friendIds: this.list.map((f) => f.id) });
    }, 30000); // every 30s
  }

  /** Persist to localStorage. */
  save() {
    try {
      const payload = {
        list: this.list,
        requests: this.requests,
        blocked: Array.from(this.blocked),
        savedAt: Date.now(),
      };
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch (e) {
      // storage full / unavailable
    }
  }

  /** Load from localStorage. */
  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.list)) this.list = data.list;
      if (Array.isArray(data.requests)) this.requests = data.requests;
      if (Array.isArray(data.blocked)) this.blocked = new Set(data.blocked);
    } catch (e) {
      // ignore corrupted data
    }
  }

  /** Utility: escape HTML. */
  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Cleanup timers. */
  destroy() {
    if (this._presenceTimer) clearInterval(this._presenceTimer);
    this.save();
  }
}
