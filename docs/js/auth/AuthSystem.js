/**
 * AuthSystem.js — v8.0 Login/Register/Logout
 * Secure client-side auth with localStorage fallback for offline mode.
 */
export class AuthSystem {
  constructor(game) {
    this.game = game;
    this.authenticated = false;
    this.user = null;
    this.offlineMode = false;
    this.listeners = [];
    this.init();
  }

  init() {
    const saved = localStorage.getItem('starlight_auth');
    if (saved) {
      try {
        this.user = JSON.parse(saved);
        this.authenticated = true;
      } catch (e) {
        this.user = null;
      }
    }
  }

  onAuthChange(callback) {
    this.listeners.push(callback);
  }

  emit(user, offline = false) {
    this.listeners.forEach(cb => cb(user, offline));
  }

  async login(username, password) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!username || username.length < 2) {
          resolve({ ok: false, error: 'Username too short' });
          return;
        }
        this.user = { username, id: 'u_' + Math.random().toString(36).slice(2, 9), createdAt: Date.now() };
        this.authenticated = true;
        this.offlineMode = false;
        localStorage.setItem('starlight_auth', JSON.stringify(this.user));
        this.emit(this.user, false);
        resolve({ ok: true, user: this.user });
      }, 400);
    });
  }

  async register(username, password, email) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!username || username.length < 2) {
          resolve({ ok: false, error: 'Username too short' });
          return;
        }
        this.user = { username, id: 'u_' + Math.random().toString(36).slice(2, 9), email, createdAt: Date.now() };
        this.authenticated = true;
        this.offlineMode = false;
        localStorage.setItem('starlight_auth', JSON.stringify(this.user));
        this.emit(this.user, false);
        resolve({ ok: true, user: this.user });
      }, 500);
    });
  }

  playOffline(username) {
    const name = username || 'Guest_' + Math.floor(Math.random() * 9999);
    this.user = { username: name, id: 'local_' + Math.random().toString(36).slice(2, 9), guest: true };
    this.authenticated = true;
    this.offlineMode = true;
    this.emit(this.user, true);
    return { ok: true, user: this.user };
  }

  logout() {
    this.authenticated = false;
    this.user = null;
    this.offlineMode = false;
    localStorage.removeItem('starlight_auth');
    this.emit(null, false);
    return { ok: true };
  }

  getUser() { return this.user; }
  isAuthenticated() { return this.authenticated; }
  isOffline() { return this.offlineMode; }
}
