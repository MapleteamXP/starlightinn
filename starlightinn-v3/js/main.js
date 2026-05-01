/**
 * Starlight Inn v8.0.0 — Main Entry Point
 * Bulletproof initialization with graceful degradation.
 * Philosophy: if a module fails, stub it — the game must NEVER get stuck.
 */

(function (global) {
  'use strict';

  /* ================================================================
     1. GLOBALS & CONFIG
     ================================================================ */
  const VERSION = '8.0.0';
  const BUILD_DATE = '2025-07-22';
  const API_BASE = (() => {
    try {
      const host = location.hostname;
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        return 'http://localhost:3000/api';
      }
    } catch (_) { /* ignore */ }
    return 'https://starlightinn-api.herokuapp.com/api';
  })();

  const WS_URL = (() => {
    try {
      const host = location.hostname;
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        return 'ws://localhost:3000/ws';
      }
    } catch (_) { /* ignore */ }
    return 'wss://starlightinn-api.herokuapp.com/ws';
  })();

  /* ================================================================
     2. STUB FACTORY — never let a missing module stop the game
     ================================================================ */
  function createStub(name, methods = []) {
    const stub = {};
    const defaultMethods = [
      'init', 'update', 'render', 'dispose', 'connect', 'disconnect',
      'login', 'logout', 'register', 'autoLogin', 'isLoggedIn',
      'save', 'load', 'send', 'receive', 'join', 'leave', 'say',
      'addFriend', 'removeFriend', 'getFriends', 'whisper',
      'play', 'pause', 'stop', 'setVolume', 'mute', 'unmute'
    ];
    const allMethods = [...new Set([...defaultMethods, ...methods])];
    allMethods.forEach((m) => {
      stub[m] = (...args) => {
        console.warn(`[Stub:${name}] ${m}(${args.length} args) — module unavailable`);
        return Promise.resolve(null);
      };
    });
    stub._isStub = true;
    stub._moduleName = name;
    console.warn(`[Stub] ${name} created with ${allMethods.length} no-op methods`);
    return stub;
  }

  /* ================================================================
     3. LOADING SCREEN MANAGER
     ================================================================ */
  const LoadingScreen = {
    el: null,
    textEl: null,
    progressEl: null,
    dots: 0,
    timer: null,

    init() {
      this.el = document.getElementById('loading-screen');
      this.textEl = document.getElementById('loading-text');
      this.progressEl = document.getElementById('loading-progress');
      if (!this.el) {
        // Build fallback loading screen if HTML lacks one
        this.el = document.createElement('div');
        this.el.id = 'loading-screen';
        this.el.style.cssText = `
          position:fixed; inset:0; z-index:99999;
          background: linear-gradient(135deg,#1a0b2e 0%,#2d1b4e 100%);
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          color:#ffe4b5; font-family:'Segoe UI',sans-serif; transition:opacity 0.8s ease;
        `;
        this.el.innerHTML = `
          <div style="font-size:2.2rem; font-weight:700; margin-bottom:0.5rem;">✨ Starlight Inn ✨</div>
          <div id="loading-text" style="font-size:1rem; opacity:0.85;">Initializing...</div>
          <div id="loading-progress" style="width:240px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin-top:1rem;overflow:hidden;">
            <div style="width:0%;height:100%;background:#ffd700;border-radius:2px;transition:width 0.4s ease;"></div>
          </div>
          <div id="loading-version" style="margin-top:0.75rem;font-size:0.75rem;opacity:0.5;">v${VERSION}</div>
        `;
        document.body.appendChild(this.el);
        this.textEl = document.getElementById('loading-text');
        this.progressEl = document.getElementById('loading-progress');
      }
    },

    set(msg, pct = null) {
      if (this.textEl) this.textEl.textContent = msg;
      if (pct !== null && this.progressEl) {
        const bar = this.progressEl.querySelector('div');
        if (bar) bar.style.width = pct + '%';
      }
      console.log(`[Loading] ${msg}${pct !== null ? ` (${pct}%)` : ''}`);
    },

    animateDots() {
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        this.dots = (this.dots + 1) % 4;
        const base = (this.textEl?.textContent || 'Loading').replace(/[.]{0,3}$/, '');
        if (this.textEl) this.textEl.textContent = base + '.'.repeat(this.dots);
      }, 500);
    },

    stopDots() {
      clearInterval(this.timer);
    },

    hide(delay = 800) {
      this.stopDots();
      this.set('Ready!', 100);
      setTimeout(() => {
        if (this.el) {
          this.el.style.opacity = '0';
          setTimeout(() => { if (this.el) this.el.style.display = 'none'; }, 800);
        }
      }, delay);
    },

    showError(msg, subtext = '') {
      this.stopDots();
      const html = `
        <div style="text-align:center;max-width:420px;padding:0 1rem;">
          <div style="font-size:3rem;margin-bottom:0.5rem;">⚠️</div>
          <div style="font-size:1.2rem;font-weight:600;color:#ff6b6b;margin-bottom:0.5rem;">${msg}</div>
          ${subtext ? `<div style="font-size:0.9rem;opacity:0.7;margin-bottom:1.5rem;">${subtext}</div>` : ''}
          <button id="retry-btn" style="padding:0.6rem 1.4rem;background:#ffd700;color:#1a0b2e;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:1rem;">Retry</button>
          <button id="offline-btn" style="margin-left:0.5rem;padding:0.6rem 1.4rem;background:transparent;color:#ffe4b5;border:1px solid rgba(255,255,255,0.3);border-radius:6px;font-weight:600;cursor:pointer;font-size:1rem;">Play Offline</button>
        </div>
      `;
      if (this.el) this.el.innerHTML = html;

      setTimeout(() => {
        const retry = document.getElementById('retry-btn');
        const offline = document.getElementById('offline-btn');
        if (retry) retry.addEventListener('click', () => location.reload());
        if (offline) offline.addEventListener('click', () => {
          game.offlineMode = true;
          LoadingScreen.hide(200);
          showLandingScreen();
        });
      }, 50);
    }
  };

  /* ================================================================
     4. LANDING SCREEN
     ================================================================ */
  function showLandingScreen() {
    let landing = document.getElementById('landing-screen');
    if (!landing) {
      landing = document.createElement('div');
      landing.id = 'landing-screen';
      landing.style.cssText = `
        position:fixed; inset:0; z-index:99990;
        background: linear-gradient(180deg,#1a0b2e 0%,#2d1b4e 50%,#1a0b2e 100%);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        color:#ffe4b5; font-family:'Segoe UI',sans-serif;
      `;
      document.body.appendChild(landing);
    }
    landing.style.display = 'flex';
    landing.innerHTML = `
      <div style="text-align:center; animation:fadeIn 1s ease;">
        <h1 style="font-size:3rem; margin:0 0 0.25rem; text-shadow:0 0 20px rgba(255,215,0,0.4);">✨ Starlight Inn ✨</h1>
        <p style="font-size:1.1rem; opacity:0.7; margin-bottom:2rem;">A cozy place to meet, chat, and play — v${VERSION}</p>

        <div id="auth-forms" style="display:flex; flex-direction:column; gap:0.75rem; width:320px;">
          <input id="login-user" type="text" placeholder="Username" maxlength="20" style="padding:0.7rem 1rem; border-radius:8px; border:none; font-size:1rem; outline:none; background:rgba(255,255,255,0.1); color:#fff;">
          <input id="login-pass" type="password" placeholder="Password" style="padding:0.7rem 1rem; border-radius:8px; border:none; font-size:1rem; outline:none; background:rgba(255,255,255,0.1); color:#fff;">
          <button id="btn-login" style="padding:0.75rem; border-radius:8px; border:none; background:#ffd700; color:#1a0b2e; font-weight:700; font-size:1rem; cursor:pointer; transition:transform 0.15s;">Login</button>
          <button id="btn-register" style="padding:0.75rem; border-radius:8px; border:1px solid rgba(255,255,255,0.25); background:transparent; color:#ffe4b5; font-weight:600; font-size:1rem; cursor:pointer;">Create Account</button>
          <div style="display:flex; align-items:center; gap:0.75rem; margin:0.5rem 0;">
            <div style="flex:1; height:1px; background:rgba(255,255,255,0.15);"></div>
            <span style="font-size:0.8rem; opacity:0.5;">or</span>
            <div style="flex:1; height:1px; background:rgba(255,255,255,0.15);"></div>
          </div>
          <button id="btn-guest" style="padding:0.75rem; border-radius:8px; border:1px dashed rgba(255,255,255,0.3); background:transparent; color:#ffe4b5; font-weight:600; font-size:1rem; cursor:pointer;">🎮 Play as Guest</button>
        </div>

        <div id="register-form" style="display:none; flex-direction:column; gap:0.75rem; width:320px;">
          <input id="reg-user" type="text" placeholder="Username (3-20 chars)" maxlength="20" style="padding:0.7rem 1rem; border-radius:8px; border:none; font-size:1rem; outline:none; background:rgba(255,255,255,0.1); color:#fff;">
          <input id="reg-pass" type="password" placeholder="Password (6+ chars)" style="padding:0.7rem 1rem; border-radius:8px; border:none; font-size:1rem; outline:none; background:rgba(255,255,255,0.1); color:#fff;">
          <input id="reg-email" type="email" placeholder="Email (optional)" style="padding:0.7rem 1rem; border-radius:8px; border:none; font-size:1rem; outline:none; background:rgba(255,255,255,0.1); color:#fff;">
          <button id="btn-reg-submit" style="padding:0.75rem; border-radius:8px; border:none; background:#ffd700; color:#1a0b2e; font-weight:700; font-size:1rem; cursor:pointer;">Register</button>
          <button id="btn-reg-back" style="padding:0.75rem; border-radius:8px; border:1px solid rgba(255,255,255,0.25); background:transparent; color:#ffe4b5; font-weight:600; font-size:1rem; cursor:pointer;">Back to Login</button>
        </div>

        <p id="landing-status" style="margin-top:1rem; font-size:0.85rem; min-height:1.2rem; color:#ff6b6b;"></p>
      </div>
      <style>
        @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        #landing-screen button:hover { transform:scale(1.03); }
        #landing-screen input::placeholder { color:rgba(255,255,255,0.4); }
      </style>
    `;

    // Wire buttons
    setTimeout(() => {
      const status = document.getElementById('landing-status');

      document.getElementById('btn-register')?.addEventListener('click', () => {
        document.getElementById('auth-forms').style.display = 'none';
        document.getElementById('register-form').style.display = 'flex';
      });
      document.getElementById('btn-reg-back')?.addEventListener('click', () => {
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('auth-forms').style.display = 'flex';
      });

      document.getElementById('btn-login')?.addEventListener('click', async () => {
        const u = document.getElementById('login-user').value.trim();
        const p = document.getElementById('login-pass').value;
        if (!u || !p) { status.textContent = 'Please enter username and password.'; return; }
        status.textContent = 'Logging in...';
        status.style.color = '#ffd700';
        try {
          await game.auth.login(u, p);
          enterWorld();
        } catch (err) {
          status.textContent = err.message || 'Login failed.';
          status.style.color = '#ff6b6b';
        }
      });

      document.getElementById('btn-reg-submit')?.addEventListener('click', async () => {
        const u = document.getElementById('reg-user').value.trim();
        const p = document.getElementById('reg-pass').value;
        const e = document.getElementById('reg-email').value.trim();
        if (u.length < 3 || u.length > 20) { status.textContent = 'Username must be 3-20 characters.'; return; }
        if (p.length < 6) { status.textContent = 'Password must be at least 6 characters.'; return; }
        status.textContent = 'Creating account...';
        status.style.color = '#ffd700';
        try {
          await game.auth.register(u, p, e || null);
          enterWorld();
        } catch (err) {
          status.textContent = err.message || 'Registration failed.';
          status.style.color = '#ff6b6b';
        }
      });

      document.getElementById('btn-guest')?.addEventListener('click', async () => {
        status.textContent = 'Entering as guest...';
        status.style.color = '#ffd700';
        try {
          await game.auth.guestLogin();
          enterWorld();
        } catch (err) {
          console.warn('[Guest] Fallback to manual guest', err);
          game.auth._forceGuestMode();
          enterWorld();
        }
      });
    }, 50);
  }

  function enterWorld() {
    const landing = document.getElementById('landing-screen');
    if (landing) {
      landing.style.transition = 'opacity 0.6s ease';
      landing.style.opacity = '0';
      setTimeout(() => { landing.style.display = 'none'; }, 600);
    }
    game.worldStarted = true;
    try {
      if (game.world && typeof game.world.start === 'function') game.world.start();
    } catch (err) {
      console.warn('[World] start() failed:', err.message);
    }
    try {
      if (game.ui && typeof game.ui.showHud === 'function') game.ui.showHud();
    } catch (err) {
      console.warn('[UI] showHud() failed:', err.message);
    }
    console.log('[Game] Entered world. Welcome to Starlight Inn v' + VERSION);
  }

  /* ================================================================
     5. OFFLINE MODE SWITCH
     ================================================================ */
  let offlineSwitchTimer = null;
  function startOfflineTimer() {
    offlineSwitchTimer = setTimeout(() => {
      if (!game.serverAvailable && !game.worldStarted) {
        console.warn('[Net] Server unreachable after 3s — switching to offline mode');
        game.offlineMode = true;
        LoadingScreen.hide(200);
        showLandingScreen();
      }
    }, 3000);
  }

  /* ================================================================
     6. BULLETPROOF MODULE LOADER
     ================================================================ */
  async function loadModule(name, importFn, stubMethods = []) {
    LoadingScreen.set(`Loading ${name}...`);
    try {
      const mod = await importFn();
      console.log(`[Init] ${name} OK`);
      return mod?.default || mod || createStub(name, stubMethods);
    } catch (err) {
      console.warn(`[Init] ${name} failed:`, err.message);
      return createStub(name, stubMethods);
    }
  }

  /* ================================================================
     7. CORE GAME OBJECT
     ================================================================ */
  const game = {
    version: VERSION,
    buildDate: BUILD_DATE,
    apiBase: API_BASE,
    wsUrl: WS_URL,
    offlineMode: false,
    serverAvailable: false,
    worldStarted: false,
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,

    // Stub placeholders
    auth: null,
    world: null,
    renderer: null,
    ui: null,
    input: null,
    audio: null,
    net: null,
    inventory: null,
    friends: null,
    chat: null,
    sprites: null,
    particles: null,
    settings: null,
    minimap: null,
    trade: null,
    emotes: null,
    quests: null,
    shop: null,

    // Character / session
    me: { id: null, name: 'Guest', x: 0, y: 0, room: 'lobby', colors: {}, hair: 0, outfit: 0 },
    players: new Map(),
    rooms: new Map()
  };

  global.game = game;
  global.Starlight = game;

  /* ================================================================
     8. SERVER PING (check availability)
     ================================================================ */
  async function pingServer() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(`${API_BASE}/health`, { method: 'GET', signal: ctrl.signal, mode: 'cors' });
      clearTimeout(t);
      game.serverAvailable = res.ok;
      return res.ok;
    } catch (_) {
      game.serverAvailable = false;
      return false;
    }
  }

  /* ================================================================
     9. MAIN INITIALIZATION SEQUENCE
     ================================================================ */
  async function initGame() {
    LoadingScreen.init();
    LoadingScreen.animateDots();
    LoadingScreen.set('Checking server...', 5);

    // Phase 0 — server probe + offline fallback timer
    const serverOk = await pingServer();
    console.log(`[Net] Server ${serverOk ? 'reachable' : 'unreachable'}`);
    if (!serverOk) startOfflineTimer();

    const totalPhases = 14;
    let phase = 0;
    const pct = () => Math.min(100, Math.round((phase / totalPhases) * 100));

    // Phase 1 — Canvas / Renderer
    phase++;
    LoadingScreen.set('Setting up canvas...', pct());
    try {
      game.canvas = document.getElementById('game-canvas') || document.createElement('canvas');
      if (!game.canvas.id) { game.canvas.id = 'game-canvas'; document.body.appendChild(game.canvas); }
      game.ctx = game.canvas.getContext('2d');
      const resize = () => {
        game.width = window.innerWidth;
        game.height = window.innerHeight;
        game.canvas.width = game.width;
        game.canvas.height = game.height;
      };
      resize();
      window.addEventListener('resize', resize);
      console.log('[Init] Canvas OK');
    } catch (err) {
      console.warn('[Init] Canvas setup failed:', err.message);
    }

    // Phase 2 — Settings
    phase++;
    LoadingScreen.set('Loading settings...', pct());
    try {
      const { SettingsManager } = await import('./engine/SettingsManager.js');
      game.settings = new SettingsManager(game);
      game.settings.load();
      console.log('[Init] Settings OK');
    } catch (err) {
      console.warn('[Init] Settings failed:', err.message);
      game.settings = createStub('Settings', ['get', 'set', 'load', 'save']);
    }

    // Phase 3 — Input
    phase++;
    LoadingScreen.set('Initializing input...', pct());
    try {
      const { InputManager } = await import('./engine/InputManager.js');
      game.input = new InputManager(game);
      console.log('[Init] Input OK');
    } catch (err) {
      console.warn('[Init] Input failed:', err.message);
      game.input = createStub('Input', ['on', 'off', 'keyDown', 'keyUp', 'mouseDown']);
    }

    // Phase 4 — Audio
    phase++;
    LoadingScreen.set('Loading audio engine...', pct());
    try {
      const { AudioEngine } = await import('./engine/AudioEngine.js');
      game.audio = new AudioEngine(game);
      console.log('[Init] Audio OK');
    } catch (err) {
      console.warn('[Init] Audio failed:', err.message);
      game.audio = createStub('Audio', ['play', 'stop', 'setVolume', 'mute', 'unmute']);
    }

    // Phase 5 — Sprites / Assets
    phase++;
    LoadingScreen.set('Loading sprites...', pct());
    try {
      const { SpriteManager } = await import('./engine/SpriteManager.js');
      game.sprites = new SpriteManager(game);
      await game.sprites.loadEssential();
      console.log('[Init] Sprites OK');
    } catch (err) {
      console.warn('[Init] Sprites failed:', err.message);
      game.sprites = createStub('Sprites', ['load', 'get', 'draw']);
    }

    // Phase 6 — Particle FX
    phase++;
    LoadingScreen.set('Loading particles...', pct());
    try {
      const { ParticleSystem } = await import('./engine/ParticleSystem.js');
      game.particles = new ParticleSystem(game);
      console.log('[Init] Particles OK');
    } catch (err) {
      console.warn('[Init] Particles failed:', err.message);
      game.particles = createStub('Particles', ['emit', 'update', 'render']);
    }

    // Phase 7 — Renderer
    phase++;
    LoadingScreen.set('Initializing renderer...', pct());
    try {
      const { Renderer } = await import('./engine/Renderer.js');
      game.renderer = new Renderer(game);
      console.log('[Init] Renderer OK');
    } catch (err) {
      console.warn('[Init] Renderer failed:', err.message);
      game.renderer = createStub('Renderer', ['render', 'clear', 'drawText', 'drawRect']);
    }

    // Phase 8 — World / Rooms
    phase++;
    LoadingScreen.set('Building world...', pct());
    try {
      const { World } = await import('./engine/World.js');
      game.world = new World(game);
      console.log('[Init] World OK');
    } catch (err) {
      console.warn('[Init] World failed:', err.message);
      game.world = createStub('World', ['start', 'update', 'joinRoom', 'leaveRoom']);
    }

    // Phase 9 — Network
    phase++;
    LoadingScreen.set('Connecting to server...', pct());
    try {
      const { NetworkManager } = await import('./net/NetworkManager.js');
      game.net = new NetworkManager(game);
      await game.net.connect();
      game.serverAvailable = true;
      clearTimeout(offlineSwitchTimer);
      console.log('[Init] Network OK');
    } catch (err) {
      console.warn('[Init] Network failed:', err.message);
      game.net = createStub('Network', ['connect', 'disconnect', 'send', 'on']);
      game.serverAvailable = false;
    }

    // Phase 10 — Auth System
    phase++;
    LoadingScreen.set('Loading auth system...', pct());
    try {
      const { AuthSystem } = await import('./auth/AuthSystem.js');
      game.auth = new AuthSystem(game);
      await game.auth.init();
      console.log('[Init] AuthSystem OK');
    } catch (err) {
      console.warn('[Init] AuthSystem failed:', err.message);
      game.auth = createStub('Auth', ['login', 'logout', 'register', 'autoLogin', 'isLoggedIn', 'guestLogin', 'getToken', 'getUser']);
      // Inject minimal guest capability into stub
      game.auth.guestLogin = async () => {
        const guestName = 'Guest' + Math.floor(1000 + Math.random() * 8999);
        game.me = { id: 'guest_' + Date.now(), name: guestName, x: 400, y: 300, room: 'lobby', colors: {}, hair: 0, outfit: 0, isGuest: true };
        try { localStorage.setItem('starlight_guest', JSON.stringify(game.me)); } catch (_) {}
        return { user: game.me };
      };
      game.auth._forceGuestMode = () => game.auth.guestLogin();
    }

    // Phase 11 — UI
    phase++;
    LoadingScreen.set('Building UI...', pct());
    try {
      const { UIManager } = await import('./ui/UIManager.js');
      game.ui = new UIManager(game);
      console.log('[Init] UI OK');
    } catch (err) {
      console.warn('[Init] UI failed:', err.message);
      game.ui = createStub('UI', ['showHud', 'hideHud', 'showModal', 'hideModal', 'toast']);
    }

    // Phase 12 — Inventory
    phase++;
    LoadingScreen.set('Loading inventory...', pct());
    try {
      const { InventoryManager } = await import('./game/InventoryManager.js');
      game.inventory = new InventoryManager(game);
      console.log('[Init] Inventory OK');
    } catch (err) {
      console.warn('[Init] Inventory failed:', err.message);
      game.inventory = createStub('Inventory', ['add', 'remove', 'has', 'getAll']);
    }

    // Phase 13 — Chat
    phase++;
    LoadingScreen.set('Loading chat...', pct());
    try {
      const { ChatSystem } = await import('./social/ChatSystem.js');
      game.chat = new ChatSystem(game);
      console.log('[Init] Chat OK');
    } catch (err) {
      console.warn('[Init] Chat failed:', err.message);
      game.chat = createStub('Chat', ['say', 'whisper', 'joinChannel', 'leaveChannel']);
    }

    // Phase 14 — Friend System
    phase++;
    LoadingScreen.set('Loading friend system...', pct());
    try {
      const { FriendSystem } = await import('./social/FriendSystem.js');
      game.friends = new FriendSystem(game);
      await game.friends.init();
      console.log('[Init] FriendSystem OK');
    } catch (err) {
      console.warn('[Init] FriendSystem failed:', err.message);
      game.friends = createStub('Friends', ['sendRequest', 'acceptRequest', 'declineRequest', 'removeFriend', 'getFriends', 'getOnlineFriends', 'whisper', 'isFriend', 'getPendingRequests']);
    }

    // Phase 15 — Optional modules (best effort)
    LoadingScreen.set('Loading extras...', 95);
    const optional = [
      { name: 'Minimap', path: './ui/Minimap.js', key: 'minimap' },
      { name: 'Trade', path: './game/TradeSystem.js', key: 'trade' },
      { name: 'Emotes', path: './game/EmoteSystem.js', key: 'emotes' },
      { name: 'Quests', path: './game/QuestSystem.js', key: 'quests' },
      { name: 'Shop', path: './game/ShopSystem.js', key: 'shop' }
    ];
    for (const opt of optional) {
      try {
        const mod = await import(opt.path);
        const Ctor = mod?.default || mod?.[Object.keys(mod)[0]];
        if (Ctor && typeof Ctor === 'function') {
          game[opt.key] = new Ctor(game);
          console.log(`[Init] ${opt.name} OK`);
        }
      } catch (err) {
        console.warn(`[Init] ${opt.name} skipped:`, err.message);
      }
    }

    // Final phase — attempt auto-login or show landing
    LoadingScreen.set('Finalizing...', 100);
    let autoLoginResult = null;
    try {
      if (game.auth && !game.auth._isStub && typeof game.auth.autoLogin === 'function') {
        autoLoginResult = await game.auth.autoLogin();
      }
    } catch (err) {
      console.warn('[Init] autoLogin failed:', err.message);
    }

    LoadingScreen.hide(400);

    if (autoLoginResult && autoLoginResult.success) {
      console.log('[Init] Auto-login success — entering world');
      enterWorld();
    } else {
      console.log('[Init] No valid session — showing landing screen');
      showLandingScreen();
    }

    // Global error handlers
    window.addEventListener('error', (e) => {
      console.error('[Global Error]', e.message, e.filename, e.lineno);
      if (game.ui && game.ui.toast) game.ui.toast('Something went wrong — check console', 'error');
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('[Global Rejection]', e.reason);
      if (game.ui && game.ui.toast) game.ui.toast('An async error occurred', 'error');
    });

    console.log(`%c✨ Starlight Inn v${VERSION} initialized ✨`, 'color:#ffd700; font-weight:bold; font-size:14px;');
    console.log(`%cServer: ${game.serverAvailable ? 'online' : 'offline'} | Mode: ${game.offlineMode ? 'offline' : 'online'}`, 'color:#aaa;');
  }

  /* ================================================================
     10. KICKOFF — wait for DOM ready
     ================================================================ */
  function bootstrap() {
    console.log('[Bootstrap] Starting Starlight Inn v' + VERSION);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initGame);
    } else {
      initGame();
    }
  }

  // Expose bootstraps
  game.bootstrap = bootstrap;
  game.showLanding = showLandingScreen;
  game.enterWorld = enterWorld;

  // Auto-start
  bootstrap();

})(typeof window !== 'undefined' ? window : globalThis);
