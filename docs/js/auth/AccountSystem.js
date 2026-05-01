/**
 * AccountSystem.js — Starlight Inn v8.1.0
 * Complete client-side account management for GitHub Pages (no backend).
 *
 * Features:
 *   • Registration / Login / Logout / Guest mode
 *   • Encrypted localStorage persistence (XOR + btoa)
 *   • Password hashing (djb2 variant)
 *   • Character creation & save
 *   • Inventory with equip/unequip
 *   • Currency (silver, gold, diamonds)
 *   • Friends list, block list, pending requests
 *   • Achievements, badges, stats
 *   • Settings & preferences
 *   • Auto-login session recovery
 *   • Rate-limiting & lockout for brute-force protection
 *   • Import / Export account data (JSON)
 *   • Account deletion
 *
 * @version 8.1.0
 */

class AccountSystem {
  /**
   * @param {object} game — reference to the Game instance
   */
  constructor(game) {
    this.game = game;
    this.currentUser = null;
    this.isLoggedIn = false;
    this.accounts = this._loadAccounts();
    this._loginAttempts = {};      // username -> { count, lockedUntil }
    this._maxAttempts = 5;
    this._lockoutMs = 5 * 60 * 1000; // 5 minutes
    this._guestCounter = this._loadGuestCounter();
  }

  // ============================================================
  // CRYPTO & STORAGE
  // ============================================================

  /**
   * Simple djb2-derived hash for passwords. NOT cryptographically secure,
   * but sufficient for client-side demo / GitHub Pages usage.
   * @param {string} password
   * @returns {string} hex hash
   */
  _hashPassword(password) {
    if (!password || typeof password !== 'string') return '';
    let hash = 5381;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) + hash) + char; // hash * 33 + char
      hash = hash & 0xFFFFFFFF; // keep 32-bit
    }
    // Mix in length to reduce collision chance
    hash = (hash ^ password.length) >>> 0;
    return hash.toString(16).padStart(8, '0');
  }

  /**
   * XOR cipher + base64 for localStorage obfuscation.
   * Prevents casual snooping; not a substitute for real encryption.
   * @param {string} data
   * @returns {string} base64 ciphertext
   */
  _encrypt(data) {
    if (typeof data !== 'string') data = String(data);
    const key = 'starlight_key_2024_v81';
    let result = '';
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    try {
      return btoa(result);
    } catch (e) {
      // Fallback for Unicode that btoa can't handle
      return btoa(unescape(encodeURIComponent(result)));
    }
  }

  /**
   * Decrypt data from _encrypt.
   * @param {string} data — base64 ciphertext
   * @returns {string} plaintext
   */
  _decrypt(data) {
    if (!data || typeof data !== 'string') return '';
    const key = 'starlight_key_2024_v81';
    let encoded = '';
    try {
      encoded = atob(data);
    } catch (e) {
      try {
        encoded = decodeURIComponent(escape(atob(data)));
      } catch (e2) {
        return '';
      }
    }
    let result = '';
    for (let i = 0; i < encoded.length; i++) {
      result += String.fromCharCode(encoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  }

  /**
   * Load all accounts from encrypted localStorage.
   * @returns {object} accounts map keyed by lowercase username
   */
  _loadAccounts() {
    try {
      const data = localStorage.getItem('starlight_accounts_v81');
      if (!data) {
        // Try legacy v8.0 key for migration
        const legacy = localStorage.getItem('starlight_accounts');
        if (legacy) {
          const legacyKey = 'starlight_key_2024';
          let encoded = atob(legacy);
          let result = '';
          for (let i = 0; i < encoded.length; i++) {
            result += String.fromCharCode(encoded.charCodeAt(i) ^ legacyKey.charCodeAt(i % legacyKey.length));
          }
          const parsed = JSON.parse(result);
          if (parsed && typeof parsed === 'object') {
            this._saveAccounts(parsed);
            localStorage.removeItem('starlight_accounts');
            return parsed;
          }
        }
        return {};
      }
      const decrypted = this._decrypt(data);
      if (!decrypted) return {};
      const parsed = JSON.parse(decrypted);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (e) {
      console.warn('[AccountSystem] Failed to load accounts:', e);
      return {};
    }
  }

  /**
   * Save all accounts to encrypted localStorage.
   * @param {object} [accountsOverride] — optional accounts object to save instead of this.accounts
   */
  _saveAccounts(accountsOverride) {
    try {
      const toSave = accountsOverride || this.accounts;
      localStorage.setItem('starlight_accounts_v81', this._encrypt(JSON.stringify(toSave)));
    } catch (e) {
      console.error('[AccountSystem] Failed to save accounts:', e);
    }
  }

  /**
   * Load guest counter for unique guest names.
   * @returns {number}
   */
  _loadGuestCounter() {
    try {
      const raw = localStorage.getItem('starlight_guest_counter');
      return raw ? parseInt(raw, 10) || 0 : 0;
    } catch (e) { return 0; }
  }

  /**
   * Save guest counter.
   */
  _saveGuestCounter() {
    localStorage.setItem('starlight_guest_counter', String(this._guestCounter));
  }

  // ============================================================
  // RATE LIMITING & LOCKOUT
  // ============================================================

  /**
   * Check if username is currently locked out due to failed attempts.
   * @param {string} username
   * @returns {object} { locked: boolean, remainingSeconds?: number }
   */
  _checkLockout(username) {
    const key = username.toLowerCase();
    const record = this._loginAttempts[key];
    if (!record) return { locked: false };
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
      const remaining = Math.ceil((record.lockedUntil - Date.now()) / 1000);
      return { locked: true, remainingSeconds: remaining };
    }
    return { locked: false };
  }

  /**
   * Record a failed login attempt. Locks account after _maxAttempts.
   * @param {string} username
   */
  _recordFailedAttempt(username) {
    const key = username.toLowerCase();
    if (!this._loginAttempts[key]) {
      this._loginAttempts[key] = { count: 0, lockedUntil: 0 };
    }
    this._loginAttempts[key].count++;
    if (this._loginAttempts[key].count >= this._maxAttempts) {
      this._loginAttempts[key].lockedUntil = Date.now() + this._lockoutMs;
      this._loginAttempts[key].count = 0;
    }
  }

  /**
   * Clear failed attempts on successful login.
   * @param {string} username
   */
  _clearAttempts(username) {
    delete this._loginAttempts[username.toLowerCase()];
  }

  // ============================================================
  // REGISTRATION
  // ============================================================

  /**
   * Validate username format.
   * @param {string} username
   * @returns {string|null} error message or null if valid
   */
  _validateUsername(username) {
    if (!username || typeof username !== 'string') return 'Username is required';
    const trimmed = username.trim();
    if (trimmed.length < 3) return 'Username must be at least 3 characters';
    if (trimmed.length > 20) return 'Username must be 20 characters or less';
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    if (/^[0-9]/.test(trimmed)) return 'Username cannot start with a number';
    if (/[_]{2,}/.test(trimmed)) return 'Username cannot contain consecutive underscores';
    const lower = trimmed.toLowerCase();
    const reserved = ['admin', 'administrator', 'mod', 'moderator', 'system', 'guest', 'support', 'help', 'starlight', 'inn', 'official', 'staff'];
    if (reserved.includes(lower)) return 'That username is reserved';
    return null;
  }

  /**
   * Validate password strength.
   * @param {string} password
   * @returns {string|null} error message or null if valid
   */
  _validatePassword(password) {
    if (!password || typeof password !== 'string') return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password.length > 128) return 'Password must be 128 characters or less';
    if (password.toLowerCase().includes('password')) return 'Password cannot contain "password"';
    if (password.toLowerCase().includes('123456')) return 'Password too common';
    return null;
  }

  /**
   * Register a new account.
   * @param {string} username
   * @param {string} password
   * @param {string} confirm — password confirmation
   * @returns {object} { success: boolean, user?: object, error?: string }
   */
  register(username, password, confirm) {
    // Validation
    const userErr = this._validateUsername(username);
    if (userErr) return { success: false, error: userErr };

    const passErr = this._validatePassword(password);
    if (passErr) return { success: false, error: passErr };

    if (password !== confirm) {
      return { success: false, error: 'Passwords do not match' };
    }

    const lower = username.toLowerCase();
    if (this.accounts[lower]) {
      return { success: false, error: 'Username already taken' };
    }

    // Create default character
    const character = {
      name: username,
      skinColor: '#FFCC80',
      hairColor: '#5D4037',
      shirtColor: '#1976D2',
      pantsColor: '#424242',
      shoeColor: '#8D6E63',
      eyeColor: '#3E2723',
      hairStyle: 'bob_short',
      faceExpression: 'neutral',
      outfit: {
        shirt: 'shirt_tshirt',
        pants: 'pants_jeans',
        shoes: 'shoes_sneakers',
        hat: null,
        accessory: null
      }
    };

    // Default inventory
    const inventory = [
      { id: 'chair_wooden', type: 'furniture', name: 'Wooden Chair', rarity: 'common', acquired: new Date().toISOString() },
      { id: 'lamp_table', type: 'furniture', name: 'Table Lamp', rarity: 'common', acquired: new Date().toISOString() },
      { id: 'shirt_tshirt', type: 'clothing', name: 'T-Shirt', rarity: 'common', equipped: true, acquired: new Date().toISOString() },
      { id: 'pants_jeans', type: 'clothing', name: 'Jeans', rarity: 'common', equipped: true, acquired: new Date().toISOString() },
      { id: 'shoes_sneakers', type: 'clothing', name: 'Sneakers', rarity: 'common', equipped: true, acquired: new Date().toISOString() },
      { id: 'badge_new_star', type: 'badge', name: 'New Star', rarity: 'special', acquired: new Date().toISOString() }
    ];

    // Default stats
    const stats = {
      playtime: 0,
      messagesSent: 0,
      friends: 0,
      trades: 0,
      roomsVisited: 1,
      itemsCollected: 4,
      minigamesPlayed: 0,
      minigamesWon: 0,
      loginStreak: 1,
      lastLoginDate: new Date().toISOString().split('T')[0]
    };

    // Default currency
    const currency = { silver: 500, gold: 0, diamonds: 0 };

    // Default settings
    const settings = {
      musicVolume: 0.5,
      sfxVolume: 0.7,
      chatFontSize: 'medium',
      showChatTimestamps: false,
      showNotifications: true,
      reducedMotion: false,
      colorblindMode: 'none',
      language: 'en'
    };

    // Default room layout
    const roomLayout = {
      furniture: [
        { id: 'chair_wooden', x: 2, y: 3, rotation: 0 },
        { id: 'lamp_table', x: 5, y: 2, rotation: 0 }
      ],
      wallpaper: 'wallpaper_default',
      floor: 'floor_default',
      lighting: 'default'
    };

    const user = {
      username: username,
      displayName: username,
      passwordHash: this._hashPassword(password),
      createdAt: new Date().toISOString(),
      lastLogin: null,
      lastLoginIp: null,
      character,
      inventory,
      stats,
      achievements: [],
      badges: ['badge_new_star'],
      currency,
      friends: [],
      pendingRequests: [],
      blocked: [],
      settings,
      roomLayout,
      tradeHistory: [],
      chatHistory: [],
      notificationQueue: [],
      tutorialCompleted: false,
      tutorialStep: 0,
      isGuest: false,
      isAdmin: false,
      isMod: false,
      dataVersion: '8.1.0'
    };

    this.accounts[lower] = user;
    this._saveAccounts();

    console.log('[AccountSystem] Registered new user:', username);

    // Auto-login after registration
    return this.login(username, password);
  }

  // ============================================================
  // LOGIN / LOGOUT / AUTO-LOGIN
  // ============================================================

  /**
   * Log in an existing user.
   * @param {string} username
   * @param {string} password
   * @returns {object} { success: boolean, user?: object, error?: string }
   */
  login(username, password) {
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }

    const lower = username.toLowerCase();

    // Check lockout
    const lockout = this._checkLockout(lower);
    if (lockout.locked) {
      const mins = Math.ceil(lockout.remainingSeconds / 60);
      return { success: false, error: `Account locked. Try again in ${mins} minute${mins > 1 ? 's' : ''}.` };
    }

    const account = this.accounts[lower];
    if (!account) {
      this._recordFailedAttempt(lower);
      return { success: false, error: 'Username not found' };
    }

    if (account.passwordHash !== this._hashPassword(password)) {
      this._recordFailedAttempt(lower);
      return { success: false, error: 'Incorrect password' };
    }

    // Success
    this._clearAttempts(lower);
    this.currentUser = account;
    this.isLoggedIn = true;

    const now = new Date().toISOString();
    account.lastLogin = now;

    // Update login streak
    const today = now.split('T')[0];
    const lastDate = account.stats?.lastLoginDate;
    if (lastDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      if (lastDate === yesterdayStr) {
        account.stats.loginStreak = (account.stats.loginStreak || 0) + 1;
      } else if (lastDate !== today) {
        account.stats.loginStreak = 1;
      }
    }
    account.stats.lastLoginDate = today;

    // Update playtime tracking start
    this._sessionStart = Date.now();

    this._saveAccounts();

    // Save encrypted session token
    localStorage.setItem('starlight_session_v81', this._encrypt(lower));

    console.log('[AccountSystem] Logged in as', account.username);

    return { success: true, user: account };
  }

  /**
   * Attempt to restore session from localStorage.
   * @returns {object} { success: boolean, user?: object }
   */
  autoLogin() {
    try {
      // Try v8.1 session first
      let session = localStorage.getItem('starlight_session_v81');
      // Fallback to legacy v8.0
      if (!session) session = localStorage.getItem('starlight_session');
      if (!session) return { success: false };

      let username = '';
      try {
        username = this._decrypt(session);
      } catch (e) {
        // Legacy decrypt for older sessions
        const key = 'starlight_key_2024';
        let encoded = atob(session);
        let result = '';
        for (let i = 0; i < encoded.length; i++) {
          result += String.fromCharCode(encoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        username = result;
      }

      const account = this.accounts[username.toLowerCase()];
      if (!account) {
        localStorage.removeItem('starlight_session_v81');
        localStorage.removeItem('starlight_session');
        return { success: false };
      }

      this.currentUser = account;
      this.isLoggedIn = true;
      this._sessionStart = Date.now();

      // Update last login
      account.lastLogin = new Date().toISOString();
      this._saveAccounts();

      console.log('[AccountSystem] Auto-logged in as', account.username);
      return { success: true, user: account };
    } catch (e) {
      console.warn('[AccountSystem] Auto-login failed:', e);
      return { success: false };
    }
  }

  /**
   * Log out the current user and clear session.
   */
  logout() {
    if (this.currentUser && !this.currentUser.isGuest) {
      // Update playtime before logout
      if (this._sessionStart) {
        const elapsed = Math.floor((Date.now() - this._sessionStart) / 1000);
        this.currentUser.stats.playtime += elapsed;
        this._saveAccounts();
      }
    }
    this.currentUser = null;
    this.isLoggedIn = false;
    this._sessionStart = null;
    localStorage.removeItem('starlight_session_v81');
    localStorage.removeItem('starlight_session');
    console.log('[AccountSystem] Logged out');
  }

  /**
   * Create a temporary guest account (no persistence).
   * @returns {object} { success: boolean, user: object }
   */
  guestMode() {
    this._guestCounter++;
    this._saveGuestCounter();
    const guestNum = this._guestCounter + Math.floor(Math.random() * 1000);
    const guestUser = {
      username: `Guest_${guestNum}`,
      displayName: 'Guest',
      isGuest: true,
      character: {
        name: 'Guest',
        skinColor: '#FFCC80',
        hairColor: '#5D4037',
        shirtColor: '#1976D2',
        pantsColor: '#424242',
        shoeColor: '#8D6E63',
        eyeColor: '#3E2723',
        hairStyle: 'bob_short',
        faceExpression: 'neutral',
        outfit: {
          shirt: 'shirt_tshirt',
          pants: 'pants_jeans',
          shoes: 'shoes_sneakers',
          hat: null,
          accessory: null
        }
      },
      inventory: [],
      currency: { silver: 100, gold: 0, diamonds: 0 },
      stats: { playtime: 0, messagesSent: 0, friends: 0, trades: 0, roomsVisited: 1 },
      achievements: [],
      badges: [],
      friends: [],
      pendingRequests: [],
      blocked: [],
      settings: {
        musicVolume: 0.5,
        sfxVolume: 0.7,
        chatFontSize: 'medium',
        showChatTimestamps: false,
        showNotifications: true,
        reducedMotion: false,
        colorblindMode: 'none',
        language: 'en'
      },
      tutorialCompleted: false,
      tutorialStep: 0,
      dataVersion: '8.1.0'
    };
    this.currentUser = guestUser;
    this.isLoggedIn = true;
    this._sessionStart = Date.now();
    console.log('[AccountSystem] Guest mode:', guestUser.username);
    return { success: true, user: guestUser };
  }

  // ============================================================
  // CHARACTER
  // ============================================================

  /**
   * Save character data to current user.
   * @param {object} characterData — partial or full character object
   */
  saveCharacter(characterData) {
    if (!this.currentUser || this.currentUser.isGuest) return;
    if (!characterData || typeof characterData !== 'object') return;
    this.currentUser.character = { ...this.currentUser.character, ...characterData };
    const lower = this.currentUser.username.toLowerCase();
    if (this.accounts[lower]) {
      this.accounts[lower].character = this.currentUser.character;
      this._saveAccounts();
    }
  }

  /**
   * Reset character to defaults.
   */
  resetCharacter() {
    if (!this.currentUser || this.currentUser.isGuest) return;
    const defaults = {
      name: this.currentUser.username,
      skinColor: '#FFCC80',
      hairColor: '#5D4037',
      shirtColor: '#1976D2',
      pantsColor: '#424242',
      shoeColor: '#8D6E63',
      eyeColor: '#3E2723',
      hairStyle: 'bob_short',
      faceExpression: 'neutral',
      outfit: { shirt: 'shirt_tshirt', pants: 'pants_jeans', shoes: 'shoes_sneakers', hat: null, accessory: null }
    };
    this.currentUser.character = defaults;
    const lower = this.currentUser.username.toLowerCase();
    if (this.accounts[lower]) {
      this.accounts[lower].character = defaults;
      this._saveAccounts();
    }
  }

  // ============================================================
  // INVENTORY
  // ============================================================

  /**
   * Add an item to the current user's inventory.
   * @param {object} item — { id, type, name, rarity?, ... }
   */
  addItem(item) {
    if (!this.currentUser || !item) return;
    const enriched = {
      ...item,
      acquired: item.acquired || new Date().toISOString(),
      uid: item.uid || `${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    };
    this.currentUser.inventory.push(enriched);
    this.currentUser.stats.itemsCollected = (this.currentUser.stats.itemsCollected || 0) + 1;
    if (!this.currentUser.isGuest) {
      const lower = this.currentUser.username.toLowerCase();
      if (this.accounts[lower]) {
        this.accounts[lower].inventory = this.currentUser.inventory;
        this.accounts[lower].stats = this.currentUser.stats;
        this._saveAccounts();
      }
    }
  }

  /**
   * Remove an item by its unique uid.
   * @param {string} uid
   * @returns {boolean} success
   */
  removeItem(uid) {
    if (!this.currentUser || !uid) return false;
    const before = this.currentUser.inventory.length;
    this.currentUser.inventory = this.currentUser.inventory.filter(i => i.uid !== uid && i.id !== uid);
    const removed = before > this.currentUser.inventory.length;
    if (removed && !this.currentUser.isGuest) {
      const lower = this.currentUser.username.toLowerCase();
      if (this.accounts[lower]) {
        this.accounts[lower].inventory = this.currentUser.inventory;
        this._saveAccounts();
      }
    }
    return removed;
  }

  /**
   * Equip/unequip a clothing item.
   * @param {string} itemId
   * @param {boolean} [equip=true]
   * @returns {boolean} success
   */
  setEquipped(itemId, equip = true) {
    if (!this.currentUser || !itemId) return false;
    let changed = false;
    this.currentUser.inventory = this.currentUser.inventory.map(item => {
      if (item.id === itemId && item.type === 'clothing') {
        changed = true;
        return { ...item, equipped: equip };
      }
      if (equip && item.type === 'clothing' && item.id !== itemId && item.equipped) {
        // Unequip other items of same slot if applicable
        const slot = this._getItemSlot(item.id);
        const newSlot = this._getItemSlot(itemId);
        if (slot && slot === newSlot) {
          return { ...item, equipped: false };
        }
      }
      return item;
    });
    if (changed && !this.currentUser.isGuest) {
      const lower = this.currentUser.username.toLowerCase();
      if (this.accounts[lower]) {
        this.accounts[lower].inventory = this.currentUser.inventory;
        this._saveAccounts();
      }
    }
    return changed;
  }

  /**
   * Guess the equipment slot from item id.
   * @param {string} itemId
   * @returns {string|null}
   */
  _getItemSlot(itemId) {
    if (!itemId) return null;
    if (itemId.startsWith('shirt') || itemId.startsWith('top')) return 'shirt';
    if (itemId.startsWith('pants') || itemId.startsWith('bottom')) return 'pants';
    if (itemId.startsWith('shoes')) return 'shoes';
    if (itemId.startsWith('hat') || itemId.startsWith('head')) return 'hat';
    if (itemId.startsWith('acc')) return 'accessory';
    return null;
  }

  // ============================================================
  // CURRENCY
  // ============================================================

  /**
   * Add currency to current user.
   * @param {string} type — 'silver' | 'gold' | 'diamonds'
   * @param {number} amount — must be positive
   * @returns {boolean} success
   */
  addCurrency(type, amount) {
    if (!this.currentUser || !amount || amount <= 0) return false;
    const valid = ['silver', 'gold', 'diamonds'];
    if (!valid.includes(type)) return false;
    this.currentUser.currency[type] = (this.currentUser.currency[type] || 0) + amount;
    if (!this.currentUser.isGuest) {
      const lower = this.currentUser.username.toLowerCase();
      if (this.accounts[lower]) {
        this.accounts[lower].currency = this.currentUser.currency;
        this._saveAccounts();
      }
    }
    return true;
  }

  /**
   * Remove currency from current user.
   * @param {string} type — 'silver' | 'gold' | 'diamonds'
   * @param {number} amount
   * @returns {boolean} success (false if insufficient funds)
   */
  removeCurrency(type, amount) {
    if (!this.currentUser || !amount || amount <= 0) return false;
    const valid = ['silver', 'gold', 'diamonds'];
    if (!valid.includes(type)) return false;
    if ((this.currentUser.currency[type] || 0) < amount) return false;
    this.currentUser.currency[type] -= amount;
    if (!this.currentUser.isGuest) {
      const lower = this.currentUser.username.toLowerCase();
      if (this.accounts[lower]) {
        this.accounts[lower].currency = this.currentUser.currency;
        this._saveAccounts();
      }
    }
    return true;
  }

  /**
   * Check if user can afford a cost.
   * @param {object} cost — { silver?, gold?, diamonds? }
   * @returns {boolean}
   */
  canAfford(cost) {
    if (!this.currentUser || !cost) return false;
    const c = this.currentUser.currency;
    if (cost.silver && (c.silver || 0) < cost.silver) return false;
    if (cost.gold && (c.gold || 0) < cost.gold) return false;
    if (cost.diamonds && (c.diamonds || 0) < cost.diamonds) return false;
    return true;
  }

  /**
   * Spend currency if user can afford it.
   * @param {object} cost — { silver?, gold?, diamonds? }
   * @returns {boolean} success
   */
  spend(cost) {
    if (!this.canAfford(cost)) return false;
    if (cost.silver) this.removeCurrency('silver', cost.silver);
    if (cost.gold) this.removeCurrency('gold', cost.gold);
    if (cost.diamonds) this.removeCurrency('diamonds', cost.diamonds);
    return true;
  }

  // ============================================================
  // FRIENDS & SOCIAL
  // ============================================================

  /**
   * Send a friend request.
   * @param {string} targetUsername
   * @returns {object} { success: boolean, error?: string }
   */
  sendFriendRequest(targetUsername) {
    if (!this.currentUser || this.currentUser.isGuest) {
      return { success: false, error: 'Login required' };
    }
    const target = targetUsername?.toLowerCase();
    const self = this.currentUser.username.toLowerCase();
    if (target === self) return { success: false, error: 'Cannot friend yourself' };
    if (!this.accounts[target]) return { success: false, error: 'User not found' };
    if (this.currentUser.blocked.includes(target)) {
      return { success: false, error: 'Unblock user first' };
    }
    if (this.currentUser.friends.includes(target)) {
      return { success: false, error: 'Already friends' };
    }
    if (this.currentUser.pendingRequests.includes(target)) {
      return { success: false, error: 'Request already pending' };
    }

    this.currentUser.pendingRequests.push(target);
    // Also add to target's pending (simulate two-way)
    if (this.accounts[target].pendingRequests.indexOf(self) === -1) {
      this.accounts[target].pendingRequests.push(self);
    }
    this._saveAccounts();
    return { success: true };
  }

  /**
   * Accept a pending friend request.
   * @param {string} targetUsername
   * @returns {boolean} success
   */
  acceptFriendRequest(targetUsername) {
    if (!this.currentUser || this.currentUser.isGuest) return false;
    const target = targetUsername?.toLowerCase();
    const self = this.currentUser.username.toLowerCase();
    if (!this.currentUser.pendingRequests.includes(target)) return false;

    this.currentUser.pendingRequests = this.currentUser.pendingRequests.filter(u => u !== target);
    if (!this.currentUser.friends.includes(target)) {
      this.currentUser.friends.push(target);
    }
    // Two-way
    if (this.accounts[target]) {
      this.accounts[target].pendingRequests = this.accounts[target].pendingRequests.filter(u => u !== self);
      if (!this.accounts[target].friends.includes(self)) {
        this.accounts[target].friends.push(self);
      }
    }
    this.currentUser.stats.friends = this.currentUser.friends.length;
    this._saveAccounts();
    return true;
  }

  /**
   * Remove a friend.
   * @param {string} targetUsername
   * @returns {boolean} success
   */
  removeFriend(targetUsername) {
    if (!this.currentUser || this.currentUser.isGuest) return false;
    const target = targetUsername?.toLowerCase();
    const self = this.currentUser.username.toLowerCase();
    this.currentUser.friends = this.currentUser.friends.filter(u => u !== target);
    if (this.accounts[target]) {
      this.accounts[target].friends = this.accounts[target].friends.filter(u => u !== self);
    }
    this.currentUser.stats.friends = this.currentUser.friends.length;
    this._saveAccounts();
    return true;
  }

  /**
   * Block a user.
   * @param {string} targetUsername
   * @returns {boolean} success
   */
  blockUser(targetUsername) {
    if (!this.currentUser || this.currentUser.isGuest) return false;
    const target = targetUsername?.toLowerCase();
    if (target === this.currentUser.username.toLowerCase()) return false;
    if (!this.accounts[target]) return false;
    if (!this.currentUser.blocked.includes(target)) {
      this.currentUser.blocked.push(target);
    }
    // Remove from friends and pending
    this.currentUser.friends = this.currentUser.friends.filter(u => u !== target);
    this.currentUser.pendingRequests = this.currentUser.pendingRequests.filter(u => u !== target);
    this.currentUser.stats.friends = this.currentUser.friends.length;
    this._saveAccounts();
    return true;
  }

  /**
   * Unblock a user.
   * @param {string} targetUsername
   * @returns {boolean} success
   */
  unblockUser(targetUsername) {
    if (!this.currentUser || this.currentUser.isGuest) return false;
    const target = targetUsername?.toLowerCase();
    const before = this.currentUser.blocked.length;
    this.currentUser.blocked = this.currentUser.blocked.filter(u => u !== target);
    if (this.currentUser.blocked.length < before) {
      this._saveAccounts();
      return true;
    }
    return false;
  }

  /**
   * Get resolved friend objects for the current user.
   * @returns {Array<object>}
   */
  getFriendProfiles() {
    if (!this.currentUser) return [];
    return this.currentUser.friends
      .map(name => this.accounts[name])
      .filter(Boolean)
      .map(acc => ({
        username: acc.username,
        displayName: acc.displayName || acc.username,
        character: acc.character,
        lastLogin: acc.lastLogin,
        isOnline: false // client-side; server would set this
      }));
  }

  // ============================================================
  // ACHIEVEMENTS & BADGES
  // ============================================================

  /**
   * Grant an achievement if not already earned.
   * @param {string} achievementId
   * @param {string} name
   * @param {string} description
   * @returns {boolean} was newly granted
   */
  grantAchievement(achievementId, name, description) {
    if (!this.currentUser || this.currentUser.isGuest) return false;
    const exists = this.currentUser.achievements.find(a => a.id === achievementId);
    if (exists) return false;
    this.currentUser.achievements.push({
      id: achievementId,
      name: name || achievementId,
      description: description || '',
      unlockedAt: new Date().toISOString()
    });
    const lower = this.currentUser.username.toLowerCase();
    if (this.accounts[lower]) {
      this.accounts[lower].achievements = this.currentUser.achievements;
      this._saveAccounts();
    }
    return true;
  }

  /**
   * Grant a badge if not already owned.
   * @param {string} badgeId
   * @returns {boolean} was newly granted
   */
  grantBadge(badgeId) {
    if (!this.currentUser || this.currentUser.isGuest) return false;
    if (this.currentUser.badges.includes(badgeId)) return false;
    this.currentUser.badges.push(badgeId);
    const lower = this.currentUser.username.toLowerCase();
    if (this.accounts[lower]) {
      this.accounts[lower].badges = this.currentUser.badges;
      this._saveAccounts();
    }
    return true;
  }

  /**
   * Check if user has an achievement.
   * @param {string} achievementId
   * @returns {boolean}
   */
  hasAchievement(achievementId) {
    if (!this.currentUser) return false;
    return this.currentUser.achievements.some(a => a.id === achievementId);
  }

  /**
   * Check if user has a badge.
   * @param {string} badgeId
   * @returns {boolean}
   */
  hasBadge(badgeId) {
    if (!this.currentUser) return false;
    return this.currentUser.badges.includes(badgeId);
  }

  // ============================================================
  // STATS
  // ============================================================

  /**
   * Increment a stat counter.
   * @param {string} statName — key in stats object
   * @param {number} [amount=1]
   */
  incrementStat(statName, amount = 1) {
    if (!this.currentUser || !statName) return;
    this.currentUser.stats[statName] = (this.currentUser.stats[statName] || 0) + amount;
    if (!this.currentUser.isGuest) {
      const lower = this.currentUser.username.toLowerCase();
      if (this.accounts[lower]) {
        this.accounts[lower].stats = this.currentUser.stats;
        this._saveAccounts();
      }
    }
  }

  /**
   * Get current session playtime in seconds.
   * @returns {number}
   */
  getSessionPlaytime() {
    if (!this._sessionStart) return 0;
    return Math.floor((Date.now() - this._sessionStart) / 1000);
  }

  /**
   * Get total playtime (session + saved).
   * @returns {number} seconds
   */
  getTotalPlaytime() {
    const saved = this.currentUser?.stats?.playtime || 0;
    return saved + this.getSessionPlaytime();
  }

  // ============================================================
  // SETTINGS
  // ============================================================

  /**
   * Update a user setting.
   * @param {string} key
   * @param {*} value
   */
  setSetting(key, value) {
    if (!this.currentUser) return;
    if (!this.currentUser.settings) this.currentUser.settings = {};
    this.currentUser.settings[key] = value;
    if (!this.currentUser.isGuest) {
      const lower = this.currentUser.username.toLowerCase();
      if (this.accounts[lower]) {
        this.accounts[lower].settings = this.currentUser.settings;
        this._saveAccounts();
      }
    }
  }

  /**
   * Get a user setting with optional default.
   * @param {string} key
   * @param {*} defaultValue
   * @returns {*}
   */
  getSetting(key, defaultValue) {
    if (!this.currentUser || !this.currentUser.settings) return defaultValue;
    return this.currentUser.settings[key] !== undefined ? this.currentUser.settings[key] : defaultValue;
  }

  // ============================================================
  // ROOM LAYOUT
  // ============================================================

  /**
   * Save room layout.
   * @param {object} layout
   */
  saveRoomLayout(layout) {
    if (!this.currentUser || this.currentUser.isGuest) return;
    this.currentUser.roomLayout = { ...this.currentUser.roomLayout, ...layout };
    const lower = this.currentUser.username.toLowerCase();
    if (this.accounts[lower]) {
      this.accounts[lower].roomLayout = this.currentUser.roomLayout;
      this._saveAccounts();
    }
  }

  /**
   * Get room layout.
   * @returns {object|null}
   */
  getRoomLayout() {
    return this.currentUser?.roomLayout || null;
  }

  // ============================================================
  // TUTORIAL
  // ============================================================

  /**
   * Advance or complete tutorial.
   * @param {number} [step]
   * @param {boolean} [completed]
   */
  updateTutorial(step, completed) {
    if (!this.currentUser) return;
    if (step !== undefined) this.currentUser.tutorialStep = step;
    if (completed !== undefined) this.currentUser.tutorialCompleted = completed;
    if (!this.currentUser.isGuest) {
      const lower = this.currentUser.username.toLowerCase();
      if (this.accounts[lower]) {
        this.accounts[lower].tutorialStep = this.currentUser.tutorialStep;
        this.accounts[lower].tutorialCompleted = this.currentUser.tutorialCompleted;
        this._saveAccounts();
      }
    }
  }

  // ============================================================
  // ACCOUNT MANAGEMENT
  // ============================================================

  /**
   * Change the current user's password.
   * @param {string} oldPassword
   * @param {string} newPassword
   * @param {string} confirmPassword
   * @returns {object} { success: boolean, error?: string }
   */
  changePassword(oldPassword, newPassword, confirmPassword) {
    if (!this.currentUser || this.currentUser.isGuest) {
      return { success: false, error: 'Not logged in' };
    }
    if (this.currentUser.passwordHash !== this._hashPassword(oldPassword)) {
      return { success: false, error: 'Current password is incorrect' };
    }
    const passErr = this._validatePassword(newPassword);
    if (passErr) return { success: false, error: passErr };
    if (newPassword !== confirmPassword) {
      return { success: false, error: 'New passwords do not match' };
    }
    this.currentUser.passwordHash = this._hashPassword(newPassword);
    const lower = this.currentUser.username.toLowerCase();
    if (this.accounts[lower]) {
      this.accounts[lower].passwordHash = this.currentUser.passwordHash;
      this._saveAccounts();
    }
    return { success: true };
  }

  /**
   * Change display name.
   * @param {string} newDisplayName
   * @returns {object} { success: boolean, error?: string }
   */
  changeDisplayName(newDisplayName) {
    if (!this.currentUser || this.currentUser.isGuest) {
      return { success: false, error: 'Not logged in' };
    }
    const trimmed = newDisplayName?.trim();
    if (!trimmed || trimmed.length < 1 || trimmed.length > 30) {
      return { success: false, error: 'Display name must be 1-30 characters' };
    }
    this.currentUser.displayName = trimmed;
    this.currentUser.character.name = trimmed;
    const lower = this.currentUser.username.toLowerCase();
    if (this.accounts[lower]) {
      this.accounts[lower].displayName = trimmed;
      this.accounts[lower].character.name = trimmed;
      this._saveAccounts();
    }
    return { success: true };
  }

  /**
   * Delete the current account (irreversible).
   * @param {string} password — must match current password
   * @returns {object} { success: boolean, error?: string }
   */
  deleteAccount(password) {
    if (!this.currentUser || this.currentUser.isGuest) {
      return { success: false, error: 'Not logged in' };
    }
    const lower = this.currentUser.username.toLowerCase();
    if (this.accounts[lower]?.passwordHash !== this._hashPassword(password)) {
      return { success: false, error: 'Password is incorrect' };
    }
    delete this.accounts[lower];
    this._saveAccounts();
    this.logout();
    return { success: true };
  }

  // ============================================================
  // IMPORT / EXPORT
  // ============================================================

  /**
   * Export current account data as an encrypted JSON string.
   * @returns {string|null} encrypted blob or null if not logged in
   */
  exportAccount() {
    if (!this.currentUser || this.currentUser.isGuest) return null;
    const lower = this.currentUser.username.toLowerCase();
    const account = this.accounts[lower];
    if (!account) return null;
    // Strip password hash for export safety
    const safe = { ...account };
    delete safe.passwordHash;
    safe.exportedAt = new Date().toISOString();
    return this._encrypt(JSON.stringify(safe));
  }

  /**
   * Import account data (overwrites matching username).
   * @param {string} encryptedBlob
   * @returns {object} { success: boolean, error?: string }
   */
  importAccount(encryptedBlob) {
    try {
      const decrypted = this._decrypt(encryptedBlob);
      const data = JSON.parse(decrypted);
      if (!data || !data.username) return { success: false, error: 'Invalid export data' };
      const lower = data.username.toLowerCase();
      // Preserve password hash if account exists
      const existing = this.accounts[lower];
      if (existing) {
        data.passwordHash = existing.passwordHash;
      } else {
        data.passwordHash = ''; // Cannot login without setting password
      }
      data.importedAt = new Date().toISOString();
      this.accounts[lower] = data;
      this._saveAccounts();
      return { success: true, username: data.username };
    } catch (e) {
      console.error('[AccountSystem] Import failed:', e);
      return { success: false, error: 'Failed to parse import data' };
    }
  }

  // ============================================================
  // ADMIN / UTILITY
  // ============================================================

  /**
   * List all registered usernames (admin/debug).
   * @returns {Array<string>}
   */
  listUsernames() {
    return Object.keys(this.accounts);
  }

  /**
   * Check if a username exists.
   * @param {string} username
   * @returns {boolean}
   */
  userExists(username) {
    return !!this.accounts[username?.toLowerCase()];
  }

  /**
   * Get total number of registered accounts.
   * @returns {number}
   */
  getAccountCount() {
    return Object.keys(this.accounts).length;
  }

  /**
   * Wipe all localStorage account data (nuclear option).
   */
  wipeAllData() {
    localStorage.removeItem('starlight_accounts_v81');
    localStorage.removeItem('starlight_accounts');
    localStorage.removeItem('starlight_session_v81');
    localStorage.removeItem('starlight_session');
    localStorage.removeItem('starlight_guest_counter');
    this.accounts = {};
    this.currentUser = null;
    this.isLoggedIn = false;
    console.warn('[AccountSystem] ALL DATA WIPED');
  }

  // ============================================================
  // GETTERS
  // ============================================================

  getUser() { return this.currentUser; }
  getInventory() { return this.currentUser?.inventory || []; }
  getCharacter() { return this.currentUser?.character || null; }
  getCurrency() { return this.currentUser?.currency || { silver: 0, gold: 0, diamonds: 0 }; }
  getStats() { return this.currentUser?.stats || {}; }
  getAchievements() { return this.currentUser?.achievements || []; }
  getBadges() { return this.currentUser?.badges || []; }
  getFriends() { return this.currentUser?.friends || []; }
  getBlocked() { return this.currentUser?.blocked || []; }
  getPendingRequests() { return this.currentUser?.pendingRequests || []; }
  isGuest() { return !!this.currentUser?.isGuest; }
  isAdmin() { return !!this.currentUser?.isAdmin; }
  isMod() { return !!this.currentUser?.isMod; }
  getUsername() { return this.currentUser?.username || null; }
  getDisplayName() { return this.currentUser?.displayName || this.currentUser?.username || 'Guest'; }

  /**
   * Full profile snapshot for UI panels.
   * @returns {object|null}
   */
  getProfile() {
    if (!this.currentUser) return null;
    return {
      username: this.currentUser.username,
      displayName: this.currentUser.displayName,
      isGuest: this.currentUser.isGuest,
      isAdmin: this.currentUser.isAdmin,
      isMod: this.currentUser.isMod,
      createdAt: this.currentUser.createdAt,
      lastLogin: this.currentUser.lastLogin,
      character: this.currentUser.character,
      currency: this.currentUser.currency,
      stats: this.currentUser.stats,
      achievements: this.currentUser.achievements,
      badges: this.currentUser.badges,
      friends: this.currentUser.friends.length,
      inventory: this.currentUser.inventory.length,
      playtime: this.getTotalPlaytime(),
      tutorialCompleted: this.currentUser.tutorialCompleted
    };
  }
}

export { AccountSystem };
