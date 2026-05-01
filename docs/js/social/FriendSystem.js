/**
 * FriendSystem.js — v8.0 Working Friends
 * Add, remove, accept requests, online status.
 */
export class FriendSystem {
  constructor(game) {
    this.game = game;
    this.friends = [];
    this.requests = [];
    this.blocked = [];
    this.statusMap = new Map();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem('starlight_friends_v8');
      if (raw) {
        const data = JSON.parse(raw);
        this.friends = data.friends || [];
        this.requests = data.requests || [];
        this.blocked = data.blocked || [];
      }
    } catch (e) {}
  }

  save() {
    localStorage.setItem('starlight_friends_v8', JSON.stringify({
      friends: this.friends,
      requests: this.requests,
      blocked: this.blocked
    }));
  }

  sendRequest(targetName) {
    if (this.blocked.includes(targetName)) return { ok: false, error: 'Unblock first' };
    if (this.friends.find(f => f.name === targetName)) return { ok: false, error: 'Already friends' };
    if (this.requests.find(r => r.from === targetName)) return { ok: false, error: 'Request pending' };
    this.requests.push({ from: targetName, at: Date.now() });
    this.save();
    return { ok: true };
  }

  acceptRequest(fromName) {
    const idx = this.requests.findIndex(r => r.from === fromName);
    if (idx === -1) return { ok: false, error: 'No request' };
    this.requests.splice(idx, 1);
    if (!this.friends.find(f => f.name === fromName)) {
      this.friends.push({ name: fromName, since: Date.now(), online: false });
    }
    this.save();
    return { ok: true };
  }

  removeFriend(name) {
    this.friends = this.friends.filter(f => f.name !== name);
    this.save();
    return { ok: true };
  }

  block(name) {
    if (!this.blocked.includes(name)) this.blocked.push(name);
    this.removeFriend(name);
    this.save();
    return { ok: true };
  }

  unblock(name) {
    this.blocked = this.blocked.filter(b => b !== name);
    this.save();
    return { ok: true };
  }

  setOnlineStatus(name, online) {
    const f = this.friends.find(x => x.name === name);
    if (f) f.online = online;
  }

  getOnlineCount() {
    return this.friends.filter(f => f.online).length;
  }

  getAll() { return [...this.friends]; }
  getRequests() { return [...this.requests]; }
  getBlocked() { return [...this.blocked]; }
}
