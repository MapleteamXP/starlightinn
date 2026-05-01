/**
 * AuthSystem.js — Starlight Inn v8.0.0
 * Full authentication, registration, guest mode, and account persistence.
 * Works online (JWT + REST API) and offline (localStorage fallback).
 * Philosophy: never block the player. If the server is down, go guest/offline.
 */

export class AuthSystem {
  /**
   * @param {object} game — the global game object
   */
  constructor(game) {
    this.game = game;
    this.apiBase = game?.apiBase || this._detectApiBase();
    this.tokenKey = 'starlight_token';
    this.userKey = 'starlight_user';
    this.guestKey = 'starlight_guest';
    this.charKey = 'starlight_character';
    this.invKey = 'starlight_inventory';

    this._token = null;
    this._user = null;
    this._character = null;
    this._inventory = null;
    this._pendingRequests = [];
    this._isGuest = false;
    this._offline = false;
    this._listeners = new Map(); // event → Set<callback>

    // Simple client-side hash for password privacy (NOT true security — server must re-hash)
    this._salt = 'starlight-inn-v8-salt-0x9f3a';
  }

  /* ================================================================
     INTERNAL HELPERS
     ================================================================ */

  _detectApiBase() {
    try {
      const host = location.hostname;
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        return 'http://localhost:3000/api';
      }
    } catch (_) { /* ignore */ }
    return 'https://starlightinn-api.herokuapp.com/api';
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

  /**
   * Simple deterministic hash for client-side password obfuscation.
   * Never use this as sole security — server MUST bcrypt the password.
   */
  _hashPassword(raw) {
    let h = 0;
    const str = raw + this._salt;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
      h ^= (h >>> 16);
    }
    // Stretch with multiple rounds for basic obfuscation
    let out = '';
    let acc = Math.abs(h).toString(36);
    for (let r = 0; r < 250; r++) {
      let t = 0;
      for (let i = 0; i < acc.length; i++) {
        t = ((t << 5) - t + acc.charCodeAt(i)) | 0;
      }
      acc = Math.abs(t).toString(36) + acc;
    }
    // Final hex-like output
    for (let i = 0; i < acc.length && out.length < 64; i++) {
      out += acc.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return out.slice(0, 64);
  }

  async _api(path, options = {}) {
    const url = `${this.apiBase}${path}`;
    const opts = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(this._token ? { Authorization: `Bearer ${this._token}` } : {}),
        ...(options.headers || {})
      },
      signal: options.signal || null
    };
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      opts.body = JSON.stringify(options.body);
    } else if (options.body) {
      opts.body = options.body;
    }

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), options.timeout || 8000);
      if (!opts.signal) opts.signal = ctrl.signal;
      const res = await fetch(url, opts);
      clearTimeout(t);

      if (res.status === 204) return { success: true, data: null };

      const contentType = res.headers.get('content-type') || '';
      let data = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { message: text };
      }

      if (!res.ok) {
        const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return { success: true, data };
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out — server may be unavailable.');
      }
      throw err;
    }
  }

  _saveLocal() {
    try {
      if (this._token) localStorage.setItem(this.tokenKey, this._token);
      if (this._user) localStorage.setItem(this.userKey, JSON.stringify(this._user));
      if (this._character) localStorage.setItem(this.charKey, JSON.stringify(this._character));
      if (this._inventory) localStorage.setItem(this.invKey, JSON.stringify(this._inventory));
    } catch (e) {
      console.warn('[Auth] localStorage save failed:', e.message);
    }
  }

  _clearLocal() {
    try {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
      localStorage.removeItem(this.guestKey);
      localStorage.removeItem(this.charKey);
      localStorage.removeItem(this.invKey);
    } catch (e) {
      console.warn('[Auth] localStorage clear failed:', e.message);
    }
  }

  _loadLocal() {
    try {
      this._token = localStorage.getItem(this.tokenKey);
      const u = localStorage.getItem(this.userKey);
      if (u) this._user = JSON.parse(u);
      const c = localStorage.getItem(this.charKey);
      if (c) this._character = JSON.parse(c);
      const i = localStorage.getItem(this.invKey);
      if (i) this._inventory = JSON.parse(i);
    } catch (e) {
      console.warn('[Auth] localStorage load failed:', e.message);
      this._token = null;
      this._user = null;
    }
  }

  _validateUsername(name) {
    if (!name || typeof name !== 'string') return 'Username is required.';
    if (name.length < 3) return 'Username must be at least 3 characters.';
    if (name.length > 20) return 'Username must be at most 20 characters.';
    if (/[^a-zA-Z0-9_\-]/.test(name)) return 'Username may only contain letters, numbers, underscores, and hyphens.';
    if (/^[\-_]/.test(name)) return 'Username cannot start with a hyphen or underscore.';
    return null;
  }

  _validatePassword(pw) {
    if (!pw || typeof pw !== 'string') return 'Password is required.';
    if (pw.length < 6) return 'Password must be at least 6 characters.';
    return null;
  }

  _validateEmail(email) {
    if (!email) return null;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) return 'Please enter a valid email address.';
    return null;
  }

  /* ================================================================
     INITIALIZATION
     ================================================================ */

  async init() {
    this._loadLocal();
    console.log('[Auth] Initialized. Token exists:', !!this._token);
  }

  /* ================================================================
     REGISTRATION
     ================================================================ */

  /**
   * Register a new account.
   * @param {string} username
   * @param {string} password
   * @param {string|null} email
   * @returns {Promise<object>}
   */
  async register(username, password, email = null) {
    const uErr = this._validateUsername(username);
    if (uErr) throw new Error(uErr);
    const pErr = this._validatePassword(password);
    if (pErr) throw new Error(pErr);
    const eErr = this._validateEmail(email);
    if (eErr) throw new Error(eErr);

    const payload = {
      username: username.trim(),
      passwordHash: this._hashPassword(password), // server should re-hash with bcrypt
      email: email ? email.trim() : undefined
    };

    try {
      const res = await this._api('/auth/register', { method: 'POST', body: payload, timeout: 10000 });
      if (res?.data?.token) {
        this._token = res.data.token;
        this._user = res.data.user || { id: res.data.userId, username: payload.username };
        this._isGuest = false;
        this._offline = false;
        this._saveLocal();
        this._applyToGame();
        this._emit('login', { user: this._user, auto: false });
        console.log('[Auth] Registration success:', this._user.username);
        return { success: true, user: this._user, token: this._token };
      }
      throw new Error('Registration response missing token.');
    } catch (err) {
      console.error('[Auth] Register failed:', err.message);
      // If server is unreachable, offer offline guest as fallback
      if (err.message.includes('timed out') || err.message.includes('Failed to fetch')) {
        throw new Error('Server unavailable. Please try "Play as Guest" or check your connection.');
      }
      throw err;
    }
  }

  /* ================================================================
     LOGIN
     ================================================================ */

  /**
   * Log in with username and password.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<object>}
   */
  async login(username, password) {
    const uErr = this._validateUsername(username);
    if (uErr) throw new Error(uErr);
    const pErr = this._validatePassword(password);
    if (pErr) throw new Error(pErr);

    const payload = {
      username: username.trim(),
      passwordHash: this._hashPassword(password)
    };

    try {
      const res = await this._api('/auth/login', { method: 'POST', body: payload, timeout: 10000 });
      const data = res.data;

      if (!data?.token) throw new Error('Login response missing token.');

      this._token = data.token;
      this._user = data.user || { id: data.userId, username: payload.username };
      this._character = data.character || null;
      this._inventory = data.inventory || [];
      this._isGuest = false;
      this._offline = false;
      this._saveLocal();
      this._applyToGame();
      this._emit('login', { user: this._user, character: this._character, auto: false });
      console.log('[Auth] Login success:', this._user.username);
      return { success: true, user: this._user, character: this._character, inventory: this._inventory };
    } catch (err) {
      console.error('[Auth] Login failed:', err.message);
      if (err.status === 401) throw new Error('Invalid username or password.');
      if (err.status === 429) throw new Error('Too many attempts. Please wait a moment.');
      if (err.message.includes('timed out') || err.message.includes('Failed to fetch')) {
        throw new Error('Cannot reach server. Check your connection or play as Guest.');
      }
      throw err;
    }
  }

  /* ================================================================
     AUTO LOGIN
     ================================================================ */

  /**
   * On page load: if token exists, validate it and log the user in silently.
   * @returns {Promise<object|null>}
   */
  async autoLogin() {
    this._loadLocal();
    if (!this._token) {
      console.log('[Auth] No stored token — skipping auto-login');
      return { success: false, reason: 'no_token' };
    }

    try {
      const res = await this._api('/me', { method: 'GET', timeout: 6000 });
      if (res?.data) {
        this._user = res.data.user || this._user;
        this._character = res.data.character || this._character;
        this._inventory = res.data.inventory || this._inventory;
        this._isGuest = false;
        this._offline = false;
        this._saveLocal();
        this._applyToGame();
        this._emit('login', { user: this._user, character: this._character, auto: true });
        console.log('[Auth] Auto-login success:', this._user?.username);
        return { success: true, user: this._user, character: this._character };
      }
    } catch (err) {
      console.warn('[Auth] Auto-login failed:', err.message);
      // Token invalid or expired — clear it
      if (err.status === 401) {
        this._clearLocal();
        this._token = null;
        this._user = null;
        return { success: false, reason: 'token_invalid' };
      }
      // Server down — keep token for retry later, go offline
      this._offline = true;
      return { success: false, reason: 'offline', message: err.message };
    }
    return { success: false, reason: 'unknown' };
  }

  /* ================================================================
     GUEST MODE
     ================================================================ */

  /**
   * Create a guest session (no server required).
   * @returns {Promise<object>}
   */
  async guestLogin() {
    const existing = localStorage.getItem(this.guestKey);
    let guest = null;
    if (existing) {
      try { guest = JSON.parse(existing); } catch (_) {}
    }

    if (guest && guest.id && guest.name) {
      console.log('[Auth] Resuming guest session:', guest.name);
    } else {
      const rand = Math.floor(1000 + Math.random() * 8999);
      guest = {
        id: `guest_${Date.now()}_${rand}`,
        name: `Guest${rand}`,
        username: `Guest${rand}`,
        x: 400,
        y: 300,
        room: 'lobby',
        colors: { skin: '#ffdbac', hair: '#4a3000', shirt: '#6fa3ef', pants: '#334455' },
        hair: 1,
        outfit: 1,
        isGuest: true,
        createdAt: new Date().toISOString()
      };
      console.log('[Auth] New guest session:', guest.name);
    }

    this._user = guest;
    this._character = guest;
    this._inventory = [];
    this._token = null;
    this._isGuest = true;
    this._offline = true;

    try {
      localStorage.setItem(this.guestKey, JSON.stringify(guest));
    } catch (e) {
      console.warn('[Auth] Guest save failed:', e.message);
    }

    this._applyToGame();
    this._emit('login', { user: this._user, auto: false, guest: true });
    return { success: true, user: guest };
  }

  /**
   * Convert guest to full account.
   * @param {string} username
   * @param {string} password
   * @param {string|null} email
   * @returns {Promise<object>}
   */
  async upgradeGuest(username, password, email = null) {
    if (!this._isGuest || !this._user) {
      throw new Error('You are not currently in guest mode.');
    }
    // Register new account with server
    const result = await this.register(username, password, email);
    if (result.success) {
      // Migrate guest character data
      const charData = this._character || this._user;
      if (charData) {
        try {
          await this.saveCharacter(charData);
        } catch (e) {
          console.warn('[Auth] Character migration failed:', e.message);
        }
      }
      // Clear guest key
      try { localStorage.removeItem(this.guestKey); } catch (_) {}
      this._isGuest = false;
      this._offline = false;
      this._emit('upgraded', { user: this._user });
      console.log('[Auth] Guest upgraded to:', username);
    }
    return result;
  }

  /* ================================================================
     LOGOUT
     ================================================================ */

  /**
   * Log out completely. Clear all state and return to landing.
   */
  async logout() {
    const wasUser = this._user;
    // Notify server if online
    if (this._token && !this._offline) {
      try {
        await this._api('/auth/logout', { method: 'POST', timeout: 4000 });
      } catch (e) {
        console.warn('[Auth] Server logout failed (ignored):', e.message);
      }
    }

    this._clearLocal();
    this._token = null;
    this._user = null;
    this._character = null;
    this._inventory = null;
    this._isGuest = false;
    this._offline = false;

    // Reset game.me
    if (this.game) {
      this.game.me = { id: null, name: 'Guest', x: 0, y: 0, room: 'lobby', colors: {}, hair: 0, outfit: 0 };
      this.game.worldStarted = false;
    }

    this._emit('logout', { wasUser });
    console.log('[Auth] Logged out');

    // Return to landing screen
    if (this.game && typeof this.game.showLanding === 'function') {
      this.game.showLanding();
    } else {
      // Hard reload as last resort
      try { location.reload(); } catch (_) {}
    }
  }

  /* ================================================================
     STATE QUERIES
     ================================================================ */

  isLoggedIn() {
    return !!this._token && !!this._user && !this._isGuest;
  }

  isGuest() {
    return this._isGuest;
  }

  isOffline() {
    return this._offline;
  }

  getToken() {
    return this._token;
  }

  getUser() {
    return this._user;
  }

  getUserId() {
    return this._user?.id || null;
  }

  getUsername() {
    return this._user?.username || this._user?.name || 'Guest';
  }

  /* ================================================================
     CHARACTER PERSISTENCE
     ================================================================ */

  /**
   * Save character data to server (or localStorage if offline).
   * @param {object} data — { name, colors, hair, outfit, ... }
   * @returns {Promise<object>}
   */
  async saveCharacter(data) {
    if (!data || typeof data !== 'object') throw new Error('Character data required.');

    this._character = { ...(this._character || {}), ...data, updatedAt: new Date().toISOString() };

    if (this._offline || this._isGuest) {
      try {
        localStorage.setItem(this.charKey, JSON.stringify(this._character));
      } catch (e) {
        console.warn('[Auth] Character local save failed:', e.message);
      }
      this._applyToGame();
      return { success: true, source: 'local' };
    }

    try {
      const res = await this._api('/me/character', { method: 'POST', body: this._character, timeout: 8000 });
      this._saveLocal();
      this._applyToGame();
      this._emit('characterSaved', this._character);
      return { success: true, data: res.data };
    } catch (err) {
      console.warn('[Auth] Server character save failed:', err.message);
      // Fallback to localStorage
      try { localStorage.setItem(this.charKey, JSON.stringify(this._character)); } catch (_) {}
      return { success: false, error: err.message, source: 'local_fallback' };
    }
  }

  /**
   * Load character from server (or localStorage if offline).
   * @returns {Promise<object>}
   */
  async loadCharacter() {
    if (this._offline || this._isGuest) {
      const local = localStorage.getItem(this.charKey);
      if (local) {
        try {
          this._character = JSON.parse(local);
          this._applyToGame();
          return { success: true, data: this._character, source: 'local' };
        } catch (e) {
          console.warn('[Auth] Local character parse failed:', e.message);
        }
      }
      return { success: false, data: null };
    }

    try {
      const res = await this._api('/me/character', { method: 'GET', timeout: 8000 });
      if (res?.data) {
        this._character = res.data;
        this._saveLocal();
        this._applyToGame();
        this._emit('characterLoaded', this._character);
        return { success: true, data: this._character, source: 'server' };
      }
    } catch (err) {
      console.warn('[Auth] Server character load failed:', err.message);
    }

    // Fallback to localStorage
    const local = localStorage.getItem(this.charKey);
    if (local) {
      try {
        this._character = JSON.parse(local);
        this._applyToGame();
        return { success: true, data: this._character, source: 'local_fallback' };
      } catch (_) {}
    }
    return { success: false, data: null };
  }

  /* ================================================================
     INVENTORY PERSISTENCE
     ================================================================ */

  /**
   * Save inventory to server (or localStorage if offline).
   * @param {Array} items
   * @returns {Promise<object>}
   */
  async saveInventory(items) {
    if (!Array.isArray(items)) throw new Error('Inventory must be an array.');
    this._inventory = items;

    if (this._offline || this._isGuest) {
      try { localStorage.setItem(this.invKey, JSON.stringify(items)); } catch (e) {}
      return { success: true, source: 'local' };
    }

    try {
      const res = await this._api('/me/inventory', { method: 'POST', body: { items }, timeout: 8000 });
      this._saveLocal();
      return { success: true, data: res.data };
    } catch (err) {
      console.warn('[Auth] Inventory save failed:', err.message);
      try { localStorage.setItem(this.invKey, JSON.stringify(items)); } catch (_) {}
      return { success: false, error: err.message };
    }
  }

  /**
   * Load inventory from server (or localStorage).
   * @returns {Promise<object>}
   */
  async loadInventory() {
    if (this._offline || this._isGuest) {
      const local = localStorage.getItem(this.invKey);
      if (local) {
        try {
          this._inventory = JSON.parse(local);
          return { success: true, data: this._inventory };
        } catch (_) {}
      }
      return { success: true, data: [] };
    }

    try {
      const res = await this._api('/me/inventory', { method: 'GET', timeout: 8000 });
      this._inventory = res?.data?.items || [];
      this._saveLocal();
      return { success: true, data: this._inventory };
    } catch (err) {
      console.warn('[Auth] Inventory load failed:', err.message);
      const local = localStorage.getItem(this.invKey);
      if (local) {
        try { this._inventory = JSON.parse(local); return { success: true, data: this._inventory }; } catch (_) {}
      }
      return { success: true, data: [] };
    }
  }

  /* ================================================================
     PROFILE / SETTINGS
     ================================================================ */

  /**
   * Fetch full profile from server.
   * @returns {Promise<object>}
   */
  async fetchProfile() {
    if (this._offline || this._isGuest) {
      return {
        success: true,
        data: {
          user: this._user,
          character: this._character,
          inventory: this._inventory || []
        },
        source: 'local'
      };
    }

    try {
      const res = await this._api('/me', { method: 'GET', timeout: 8000 });
      if (res?.data) {
        this._user = res.data.user || this._user;
        this._character = res.data.character || this._character;
        this._inventory = res.data.inventory || this._inventory;
        this._saveLocal();
        this._applyToGame();
        return { success: true, data: res.data, source: 'server' };
      }
    } catch (err) {
      console.warn('[Auth] fetchProfile failed:', err.message);
    }
    return {
      success: true,
      data: { user: this._user, character: this._character, inventory: this._inventory || [] },
      source: 'local_fallback'
    };
  }

  /**
   * Update profile fields (displayName, bio, etc.).
   * @param {object} fields
   * @returns {Promise<object>}
   */
  async updateProfile(fields) {
    if (!fields || typeof fields !== 'object') throw new Error('Profile fields required.');

    // Merge into local user
    if (this._user) {
      Object.assign(this._user, fields, { updatedAt: new Date().toISOString() });
    }

    if (this._offline || this._isGuest) {
      this._saveLocal();
      return { success: true, source: 'local' };
    }

    try {
      const res = await this._api('/me', { method: 'PATCH', body: fields, timeout: 8000 });
      this._saveLocal();
      this._emit('profileUpdated', this._user);
      return { success: true, data: res.data };
    } catch (err) {
      console.warn('[Auth] Profile update failed:', err.message);
      this._saveLocal();
      return { success: false, error: err.message };
    }
  }

  /**
   * Change password.
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<object>}
   */
  async changePassword(currentPassword, newPassword) {
    const nErr = this._validatePassword(newPassword);
    if (nErr) throw new Error(nErr);

    if (this._offline || this._isGuest) {
      throw new Error('Cannot change password while offline or in guest mode.');
    }

    try {
      const res = await this._api('/auth/change-password', {
        method: 'POST',
        body: {
          currentHash: this._hashPassword(currentPassword),
          newHash: this._hashPassword(newPassword)
        },
        timeout: 8000
      });
      return { success: true, data: res.data };
    } catch (err) {
      console.error('[Auth] Change password failed:', err.message);
      throw err;
    }
  }

  /* ================================================================
     TOKEN UTILITIES
     ================================================================ */

  /**
   * Decode JWT payload (no verification — server verifies).
   * @returns {object|null}
   */
  decodeToken() {
    if (!this._token) return null;
    try {
      const parts = this._token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload;
    } catch (e) {
      console.warn('[Auth] Token decode failed:', e.message);
      return null;
    }
  }

  /**
   * Check if token is expired.
   * @returns {boolean}
   */
  isTokenExpired() {
    const payload = this.decodeToken();
    if (!payload?.exp) return false;
    return Date.now() >= payload.exp * 1000;
  }

  /**
   * Refresh token if server supports it.
   * @returns {Promise<object>}
   */
  async refreshToken() {
    if (!this._token) throw new Error('No token to refresh.');
    if (this._offline || this._isGuest) throw new Error('Cannot refresh token while offline.');

    try {
      const res = await this._api('/auth/refresh', { method: 'POST', timeout: 8000 });
      if (res?.data?.token) {
        this._token = res.data.token;
        this._saveLocal();
        return { success: true, token: this._token };
      }
      throw new Error('Refresh response missing token.');
    } catch (err) {
      console.error('[Auth] Token refresh failed:', err.message);
      throw err;
    }
  }

  /* ================================================================
     INTERNAL: SYNC GAME.ME
     ================================================================ */

  _applyToGame() {
    if (!this.game) return;
    const char = this._character || this._user || {};
    this.game.me = {
      id: char.id || this._user?.id || this.game.me?.id || null,
      name: char.name || char.username || this._user?.username || this.game.me?.name || 'Guest',
      username: char.username || this._user?.username || this.game.me?.username || 'Guest',
      x: char.x ?? this.game.me?.x ?? 400,
      y: char.y ?? this.game.me?.y ?? 300,
      room: char.room || this.game.me?.room || 'lobby',
      colors: char.colors || this.game.me?.colors || { skin: '#ffdbac', hair: '#4a3000', shirt: '#6fa3ef', pants: '#334455' },
      hair: char.hair ?? this.game.me?.hair ?? 1,
      outfit: char.outfit ?? this.game.me?.outfit ?? 1,
      isGuest: this._isGuest,
      isLoggedIn: this.isLoggedIn()
    };
  }

  /* ================================================================
     PASSWORD RESET FLOW
     ================================================================ */

  /**
   * Request password reset email.
   * @param {string} email
   * @returns {Promise<object>}
   */
  async requestPasswordReset(email) {
    const eErr = this._validateEmail(email);
    if (eErr) throw new Error(eErr);

    try {
      const res = await this._api('/auth/reset-password', {
        method: 'POST',
        body: { email: email.trim() },
        timeout: 10000
      });
      return { success: true, data: res.data };
    } catch (err) {
      console.error('[Auth] Password reset request failed:', err.message);
      throw err;
    }
  }

  /**
   * Reset password with token from email.
   * @param {string} token
   * @param {string} newPassword
   * @returns {Promise<object>}
   */
  async resetPassword(token, newPassword) {
    const nErr = this._validatePassword(newPassword);
    if (nErr) throw new Error(nErr);
    if (!token) throw new Error('Reset token required.');

    try {
      const res = await this._api('/auth/reset-password/confirm', {
        method: 'POST',
        body: { token, newHash: this._hashPassword(newPassword) },
        timeout: 10000
      });
      return { success: true, data: res.data };
    } catch (err) {
      console.error('[Auth] Password reset failed:', err.message);
      throw err;
    }
  }

  /* ================================================================
     ACCOUNT DELETION
     ================================================================ */

  /**
   * Permanently delete account.
   * @param {string} password — confirmation
   * @returns {Promise<object>}
   */
  async deleteAccount(password) {
    if (this._isGuest) {
      this._clearLocal();
      this._token = null;
      this._user = null;
      return { success: true };
    }

    try {
      const res = await this._api('/me', {
        method: 'DELETE',
        body: { passwordHash: this._hashPassword(password) },
        timeout: 10000
      });
      this._clearLocal();
      this._token = null;
      this._user = null;
      return { success: true, data: res.data };
    } catch (err) {
      console.error('[Auth] Account deletion failed:', err.message);
      throw err;
    }
  }

  /* ================================================================
     STATISTICS / LEADERBOARD
     ================================================================ */

  /**
   * Get public user profile by username.
   * @param {string} username
   * @returns {Promise<object>}
   */
  async getPublicProfile(username) {
    try {
      const res = await this._api(`/users/${encodeURIComponent(username)}`, { method: 'GET', timeout: 8000 });
      return { success: true, data: res.data };
    } catch (err) {
      console.warn('[Auth] getPublicProfile failed:', err.message);
      throw err;
    }
  }

  /**
   * Search for users by partial username.
   * @param {string} query
   * @returns {Promise<object>}
   */
  async searchUsers(query) {
    if (!query || query.length < 2) throw new Error('Search query must be at least 2 characters.');
    try {
      const res = await this._api(`/users/search?q=${encodeURIComponent(query)}`, { method: 'GET', timeout: 8000 });
      return { success: true, data: res.data };
    } catch (err) {
      console.warn('[Auth] searchUsers failed:', err.message);
      throw err;
    }
  }

  /* ================================================================
     ADMIN / MODERATOR UTILITIES
     ================================================================ */

  /**
   * Check if current user has a specific role.
   * @param {string} role — 'admin', 'moderator', 'vip'
   * @returns {boolean}
   */
  hasRole(role) {
    const roles = this._user?.roles || [];
    return roles.includes(role);
  }

  /**
   * Get all roles for current user.
   * @returns {string[]}
   */
  getRoles() {
    return this._user?.roles || [];
  }

  /* ================================================================
     DEBUG / DEV HELPERS
     ================================================================ */

  toJSON() {
    return {
      version: '8.0.0',
      isLoggedIn: this.isLoggedIn(),
      isGuest: this.isGuest(),
      isOffline: this.isOffline(),
      user: this._user,
      character: this._character,
      inventoryCount: (this._inventory || []).length,
      tokenPresent: !!this._token,
      tokenExpired: this.isTokenExpired()
    };
  }

  inspect() {
    console.table(this.toJSON());
  }

  /* ================================================================
     SESSION & DEVICE MANAGEMENT
     ================================================================ */

  /**
   * List active sessions/devices for the current user.
   * @returns {Promise<object>}
   */
  async getSessions() {
    if (this._offline || this._isGuest) throw new Error('Sessions unavailable in offline/guest mode.');
    try {
      const data = await this._api('/auth/sessions', { method: 'GET', timeout: 8000 });
      return { success: true, data: data?.sessions || data?.data || [] };
    } catch (err) {
      console.error('[Auth] getSessions failed:', err.message);
      throw err;
    }
  }

  /**
   * Revoke a specific session by its ID.
   * @param {string} sessionId
   * @returns {Promise<object>}
   */
  async revokeSession(sessionId) {
    if (this._offline || this._isGuest) throw new Error('Session revocation unavailable.');
    if (!sessionId) throw new Error('sessionId required.');
    try {
      const data = await this._api('/auth/sessions/' + encodeURIComponent(sessionId), { method: 'DELETE', timeout: 8000 });
      return { success: true, data };
    } catch (err) {
      console.error('[Auth] revokeSession failed:', err.message);
      throw err;
    }
  }

  /**
   * Revoke all sessions except the current one.
   * @returns {Promise<object>}
   */
  async revokeOtherSessions() {
    if (this._offline || this._isGuest) throw new Error('Session revocation unavailable.');
    try {
      const data = await this._api('/auth/sessions', { method: 'DELETE', timeout: 8000 });
      return { success: true, data };
    } catch (err) {
      console.error('[Auth] revokeOtherSessions failed:', err.message);
      throw err;
    }
  }

  /* ================================================================
     CLIENT-SIDE RATE LIMITING
     ================================================================ */

  _rateLimitCheck(action) {
    const key = `starlight_rl_${action}`;
    try {
      const raw = localStorage.getItem(key);
      const now = Date.now();
      const cfg = { login: { max: 5, window: 300000 }, register: { max: 3, window: 600000 }, reset: { max: 3, window: 600000 } }[action];
      if (!cfg) return true;
      let entries = raw ? JSON.parse(raw) : [];
      entries = entries.filter((t) => now - t < cfg.window);
      if (entries.length >= cfg.max) return false;
      entries.push(now);
      localStorage.setItem(key, JSON.stringify(entries));
      return true;
    } catch (e) {
      return true;
    }
  }

  _rateLimitRemaining(action) {
    const key = `starlight_rl_${action}`;
    try {
      const raw = localStorage.getItem(key);
      const now = Date.now();
      const cfg = { login: { max: 5, window: 300000 }, register: { max: 3, window: 600000 }, reset: { max: 3, window: 600000 } }[action];
      if (!cfg) return 999;
      let entries = raw ? JSON.parse(raw) : [];
      entries = entries.filter((t) => now - t < cfg.window);
      return Math.max(0, cfg.max - entries.length);
    } catch (e) {
      return 999;
    }
  }

  /* ================================================================
     EMAIL VERIFICATION
     ================================================================ */

  /**
   * Request a verification email be sent.
   * @returns {Promise<object>}
   */
  async requestEmailVerification() {
    if (this._offline || this._isGuest) throw new Error('Email verification requires an online account.');
    try {
      const data = await this._api('/auth/verify-email', { method: 'POST', timeout: 10000 });
      return { success: true, data };
    } catch (err) {
      console.error('[Auth] requestEmailVerification failed:', err.message);
      throw err;
    }
  }

  /**
   * Confirm email with token from email link.
   * @param {string} token
   * @returns {Promise<object>}
   */
  async confirmEmail(token) {
    if (!token) throw new Error('Verification token required.');
    try {
      const data = await this._api('/auth/verify-email/confirm', { method: 'POST', body: { token }, timeout: 10000 });
      if (this._user) this._user.emailVerified = true;
      return { success: true, data };
    } catch (err) {
      console.error('[Auth] confirmEmail failed:', err.message);
      throw err;
    }
  }

  /* ================================================================
     ACTIVITY & SECURITY LOG
     ================================================================ */

  /**
   * Get recent security events (logins, password changes, etc.).
   * @returns {Promise<object>}
   */
  async getSecurityLog() {
    if (this._offline || this._isGuest) return { success: true, data: [], source: 'local' };
    try {
      const data = await this._api('/auth/security-log', { method: 'GET', timeout: 8000 });
      return { success: true, data: data?.events || data?.data || [] };
    } catch (err) {
      console.warn('[Auth] getSecurityLog failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get login streak / daily activity for gamification.
   * @returns {Promise<object>}
   */
  async getActivityStreak() {
    if (this._offline || this._isGuest) {
      const cached = localStorage.getItem('starlight_streak');
      if (cached) {
        try { return { success: true, data: JSON.parse(cached), source: 'local' }; } catch (_) {}
      }
      return { success: true, data: { streak: 0, lastLogin: null, totalLogins: 0 } };
    }
    try {
      const data = await this._api('/me/streak', { method: 'GET', timeout: 8000 });
      try { localStorage.setItem('starlight_streak', JSON.stringify(data?.data || data)); } catch (_) {}
      return { success: true, data: data?.data || data };
    } catch (err) {
      console.warn('[Auth] getActivityStreak failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /* ================================================================
     NOTIFICATION PREFERENCES
     ================================================================ */

  /**
   * Save notification preferences.
   * @param {object} prefs — { friendRequests, whispers, mentions, newsletter }
   * @returns {Promise<object>}
   */
  async saveNotificationPrefs(prefs) {
    if (!prefs || typeof prefs !== 'object') throw new Error('Preferences object required.');
    try {
      localStorage.setItem('starlight_notif_prefs', JSON.stringify(prefs));
    } catch (e) {}
    if (this._offline || this._isGuest) return { success: true, source: 'local' };
    try {
      const data = await this._api('/me/notifications', { method: 'PUT', body: prefs, timeout: 8000 });
      return { success: true, data };
    } catch (err) {
      console.warn('[Auth] saveNotificationPrefs failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Load notification preferences.
   * @returns {Promise<object>}
   */
  async loadNotificationPrefs() {
    try {
      const raw = localStorage.getItem('starlight_notif_prefs');
      if (raw) return { success: true, data: JSON.parse(raw), source: 'local' };
    } catch (_) {}
    const defaults = { friendRequests: true, whispers: true, mentions: true, newsletter: false };
    return { success: true, data: defaults, source: 'default' };
  }

  /* ================================================================
     BETA / FEATURE FLAGS
     ================================================================ */

  /**
   * Get feature flags for the current user (A/B testing, beta access).
   * @returns {Promise<object>}
   */
  async getFeatureFlags() {
    if (this._offline || this._isGuest) {
      return { success: true, data: { beta: false, darkMode: true, newUi: false, voiceChat: false } };
    }
    try {
      const data = await this._api('/me/flags', { method: 'GET', timeout: 8000 });
      return { success: true, data: data?.flags || data?.data || {} };
    } catch (err) {
      console.warn('[Auth] getFeatureFlags failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /* ================================================================
     ACCOUNT RECOVERY — SECURITY QUESTIONS (legacy backup)
     ================================================================ */

  /**
   * Set security questions for account recovery.
   * @param {Array} questions — [{ question, answerHash }]
   * @returns {Promise<object>}
   */
  async setSecurityQuestions(questions) {
    if (!Array.isArray(questions) || questions.length < 2) throw new Error('At least 2 security questions required.');
    const payload = questions.map((q) => ({ question: q.question, answerHash: this._hashPassword(q.answer || '') }));
    if (this._offline || this._isGuest) throw new Error('Security questions require an online account.');
    try {
      const data = await this._api('/auth/security-questions', { method: 'PUT', body: { questions: payload }, timeout: 10000 });
      return { success: true, data };
    } catch (err) {
      console.error('[Auth] setSecurityQuestions failed:', err.message);
      throw err;
    }
  }

  /**
   * Recover account via security questions.
   * @param {string} username
   * @param {Array} answers — [{ question, answer }]
   * @returns {Promise<object>}
   */
  async recoverWithQuestions(username, answers) {
    if (!username || !Array.isArray(answers)) throw new Error('Username and answers required.');
    const payload = {
      username: username.trim(),
      answers: answers.map((a) => ({ question: a.question, answerHash: this._hashPassword(a.answer || '') }))
    };
    try {
      const data = await this._api('/auth/recover', { method: 'POST', body: payload, timeout: 10000 });
      if (data?.token) {
        this._token = data.token;
        this._user = data.user;
        this._saveLocal();
      }
      return { success: true, data };
    } catch (err) {
      console.error('[Auth] recoverWithQuestions failed:', err.message);
      throw err;
    }
  }
}

/* ================================================================
   DEFAULT EXPORT
   ================================================================ */
export default AuthSystem;
