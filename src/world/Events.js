// ============================================================
// Starlight Engine — Random Events
// ============================================================

const EVENT_TYPES = [
  { id: 'double_coins', name: '💰 Coin Rush', desc: 'Double coins from all sources for 2 minutes!', duration: 120 },
  { id: 'treasure_rush', name: '📦 Treasure Rush', desc: 'Treasure chests spawn 3x faster!', duration: 90 },
  { id: 'happy_hour', name: '🎉 Happy Hour', desc: 'NPCs are extra chatty and friendly!', duration: 60 },
  { id: 'lucky_find', name: '🍀 Lucky Find', desc: 'A random furniture item appeared in your inventory!', duration: 0 },
];

export class EventSystem {
  constructor(game) {
    this.game = game;
    this.activeEvent = null;
    this.eventTimer = 0;
    this.nextEventIn = 120 + Math.random() * 180;
    this.doubleCoins = false;
    this.treasureRush = false;
    this.happyHour = false;
  }

  update(dt) {
    if (this.activeEvent) {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0) this._endEvent();
      return;
    }
    this.nextEventIn -= dt;
    if (this.nextEventIn <= 0) this._triggerEvent();
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
    this.activeEvent = null;
    this.nextEventIn = 180 + Math.random() * 300;
  }

  getCoinMultiplier() {
    return this.doubleCoins ? 2 : 1;
  }

  getTreasureInterval() {
    return this.treasureRush ? 15 : 45;
  }
}
