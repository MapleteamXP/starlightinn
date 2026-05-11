// ============================================================
// Starlight Engine — Friend List & User Presence (Simulated)
// ============================================================

import { randChoice, randInt } from '../engine/Core.js';

const BOT_NAMES = ['Astro','Luna','Nova','Zephyr','Pixel','Echo','Jazz','Coco','Milo','Ruby'];
const BOT_STATUSES = ['online','online','online','away','offline'];

export class FriendSystem {
  constructor(game) {
    this.game = game;
    this.friends = [];
    this.load();
    this._ensureBots();
    this._tick = 0;
  }

  _ensureBots() {
    if (this.friends.length === 0) {
      // Seed initial friends
      const shuffled = [...BOT_NAMES].sort(() => Math.random() - 0.5);
      for (let i = 0; i < 5; i++) {
        this.friends.push({
          id: 'bot_' + i,
          name: shuffled[i],
          status: randChoice(BOT_STATUSES),
          room: randChoice(['Lobby','Beach','Club','Arcade']),
          friendship: randInt(10, 80),
          lastUpdate: Date.now()
        });
      }
      this.save();
    }
  }

  update(dt) {
    this._tick += dt;
    if (this._tick < 8) return;
    this._tick = 0;
    // Randomly update bot statuses
    this.friends.forEach(f => {
      if (f.id.startsWith('bot_') && Math.random() < 0.3) {
        f.status = randChoice(BOT_STATUSES);
        f.room = randChoice(['Lobby','Beach','Club','Arcade','Garden','Library','My Room']);
        f.lastUpdate = Date.now();
      }
    });
  }

  addFriend(name) {
    const id = 'friend_' + Date.now();
    this.friends.push({ id, name, status: 'online', room: 'Lobby', friendship: 10, lastUpdate: Date.now() });
    this.save();
    return id;
  }

  removeFriend(id) {
    this.friends = this.friends.filter(f => f.id !== id);
    this.save();
  }

  giftFriend(id, itemType) {
    const f = this.friends.find(x => x.id === id);
    if (!f) return false;
    if (!this.game.inventorySystem.has(itemType)) return false;
    this.game.inventorySystem.remove(itemType, 1);
    f.friendship = Math.min(100, f.friendship + 15);
    f.lastUpdate = Date.now();
    this.save();
    return true;
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem('starlight_friends'));
      if (data && Array.isArray(data)) this.friends = data;
    } catch (e) {}
  }

  save() {
    try { localStorage.setItem('starlight_friends', JSON.stringify(this.friends)); } catch (e) {}
  }
}
