// ============================================================
// Starlight Engine — Random Events
// ============================================================

const EVENT_TYPES = [
  { id: 'double_coins', name: '\u{1F4B0} Coin Rush', desc: 'Double coins from all sources for 2 minutes!', duration: 120 },
  { id: 'treasure_rush', name: '\u{1F4E6} Treasure Rush', desc: 'Treasure chests spawn 3x faster!', duration: 90 },
  { id: 'happy_hour', name: '\u{1F389} Happy Hour', desc: 'NPCs are extra chatty and friendly!', duration: 60 },
  { id: 'lucky_find', name: '\u{1F340} Lucky Find', desc: 'A random furniture item appeared in your inventory!', duration: 0 },
  { id: 'dance_party', name: '\u{1F483} Dance Party', desc: 'Everyone is dancing! Double XP for 90 seconds!', duration: 90 },
];

const SCHEDULED_EVENTS = [
  { id: 'morning_bonus', name: '🌅 Morning Bonus', desc: 'Log in between 6-10 AM for 2x XP!', startHour: 6, endHour: 10, reward: { xp: 50, coins: 100 } },
  { id: 'lunch_rush', name: '🍕 Lunch Rush', desc: '12-2 PM: All catalog items 20% off!', startHour: 12, endHour: 14, reward: { discount: 0.8 } },
  { id: 'night_owl', name: '🦉 Night Owl', desc: '10 PM-2 AM: Rare items spawn in treasure chests!', startHour: 22, endHour: 26, reward: { rareLoot: true } },
  { id: 'weekend_fiesta', name: '🎉 Weekend Fiesta', desc: 'Sat-Sun: Double coins all day!', dayCheck: [0, 6], reward: { coins: 200 } },
];

function isScheduledEventActive(evt) {
  const now = new Date();
  const hour = now.getHours();
  if (evt.dayCheck) {
    return evt.dayCheck.includes(now.getDay());
  }
  if (evt.startHour > evt.endHour) {
    return hour >= evt.startHour || hour < (evt.endHour % 24);
  }
  return hour >= evt.startHour && hour < evt.endHour;
}

export class EventSystem {
  constructor(game) {
    this.game = game;
    this.activeEvent = null;
    this.eventTimer = 0;
    this.nextEventIn = 120 + Math.random() * 180;
    this.doubleCoins = false;
    this.treasureRush = false;
    this.happyHour = false;
    this.danceParty = false;
    this.activeScheduled = [];
    this.scheduledCheckTimer = 0;
    this.claimedScheduled = new Set();
    this.loadClaimed();
  }

  loadClaimed() {
    try {
      const data = JSON.parse(localStorage.getItem('starlight_scheduled_claimed'));
      if (data) this.claimedScheduled = new Set(data);
    } catch (e) {}
  }

  saveClaimed() {
    try { localStorage.setItem('starlight_scheduled_claimed', JSON.stringify(Array.from(this.claimedScheduled))); } catch (e) {}
  }

  update(dt) {
    if (this.activeEvent) {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0) this._endEvent();
      return;
    }
    this.nextEventIn -= dt;
    if (this.nextEventIn <= 0) this._triggerEvent();

    this.scheduledCheckTimer += dt;
    if (this.scheduledCheckTimer >= 30) {
      this.scheduledCheckTimer = 0;
      this._checkScheduledEvents();
    }
  }

  _checkScheduledEvents() {
    const prev = this.activeScheduled.map(e => e.id);
    this.activeScheduled = SCHEDULED_EVENTS.filter(isScheduledEventActive);
    this.activeScheduled.forEach(evt => {
      const todayKey = `${evt.id}_${new Date().toDateString()}`;
      if (!this.claimedScheduled.has(todayKey)) {
        this.claimedScheduled.add(todayKey);
        this.saveClaimed();
        this._grantScheduledReward(evt);
      }
    });
  }

  _grantScheduledReward(evt) {
    if (!this.game) return;
    this.game.uiManager.showNotification(`${evt.name} is active! ${evt.desc}`, 'success');
    if (evt.reward.xp) this.game.progressionSystem.addXP(evt.reward.xp);
    if (evt.reward.coins) this.game.currencySystem.add(evt.reward.coins);
    if (evt.reward.discount) this.game.uiManager.showNotification('Discount applied to catalog!', 'info');
  }

  getScheduledEvents() {
    return SCHEDULED_EVENTS.filter(isScheduledEventActive);
  }

  _triggerEvent() {
    const event = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    this.activeEvent = event;
    this.eventTimer = event.duration;
    this.game.uiManager.showNotification(`${event.name}: ${event.desc}`, 'success');
    this.game.soundManager.play('win');

    switch (event.id) {
      case 'double_coins': this.doubleCoins = true; break;
      case 'treasure_rush': this.treasureRush = true; break;
      case 'happy_hour': this.happyHour = true; break;
      case 'dance_party':
        this.danceParty = true;
        if (this.game.room) {
          this.game.room.avatars.forEach(a => { a.isDancing = true; a.say('\u{1F483}', '#fffde7', 'emote'); });
        }
        break;
      case 'lucky_find':
        const items = ['plant','lamp','chair','vase','rug','barrel'];
        const item = items[Math.floor(Math.random() * items.length)];
        this.game.inventorySystem.add(item, 1);
        this.game.uiManager.showNotification(`You found a ${item}! Check your inventory.`, 'success');
        this.activeEvent = null;
        this.nextEventIn = 120 + Math.random() * 180;
        break;
    }
  }

  _endEvent() {
    if (!this.activeEvent) return;
    this.game.uiManager.showNotification(`${this.activeEvent.name} has ended.`, 'info');
    this.doubleCoins = false;
    this.treasureRush = false;
    this.happyHour = false;
    this.danceParty = false;
    if (this.game.room) this.game.room.avatars.forEach(a => { if (!a.isNPC) a.isDancing = false; });
    this.activeEvent = null;
    this.nextEventIn = 180 + Math.random() * 300;
  }

  getCoinMultiplier() {
    return this.doubleCoins ? 2 : 1;
  }

  getTreasureInterval() {
    return this.treasureRush ? 15 : 45;
  }

  getXPMultiplier() {
    return this.danceParty ? 2 : 1;
  }
}
