// ============================================================
// Starlight Engine — Inbox / Mail System
// ============================================================

const MAIL_MESSAGES = [
  { subject: 'Welcome!', body: 'Welcome to Starlight Inn! Enjoy your stay.', from: 'Innkeeper' },
  { subject: 'Daily Tip', body: 'Try visiting different rooms to find hidden treasures.', from: 'Alice' },
  { subject: 'Crafting Advice', body: 'You can craft rare items by combining basic furniture!', from: 'Charlie' },
  { subject: 'Friend Request', body: 'I saw you around the lobby. Let\'s be friends!', from: 'Diana' },
  { subject: 'Minigame Challenge', body: 'Can you beat my high score in Ring Uppercut?', from: 'Evan' },
  { subject: 'Room Decor', body: 'Your room looks amazing! Love the furniture choices.', from: 'Fiona' },
  { subject: 'Coin Bonus', body: 'Here are some bonus coins for being active!', from: 'System', reward: 50 },
  { subject: 'Pet Care', body: 'Remember to feed and play with your pet daily.', from: 'George' },
  { subject: 'Event Alert', body: 'A special event is happening soon. Don\'t miss it!', from: 'System' },
  { subject: 'Lucky Day', body: 'You found a lucky coin on the floor! Here it is.', from: 'System', reward: 25 },
];

export class InboxSystem {
  constructor(game) {
    this.game = game;
    this.messages = [];
    this.unreadCount = 0;
    this.load();
    // Send welcome mail if inbox is empty
    if (this.messages.length === 0) {
      this.receive({ subject: 'Welcome!', body: 'Welcome to Starlight Inn! Enjoy your stay and explore all the rooms.', from: 'Innkeeper', time: Date.now() });
    }
  }

  receive(msg) {
    const message = { id: Date.now() + Math.random(), read: false, time: Date.now(), ...msg };
    this.messages.unshift(message);
    if (this.messages.length > 50) this.messages.pop();
    this.unreadCount++;
    this.save();
    if (this.game?.uiManager) {
      this.game.uiManager.showNotification(`New mail from ${message.from}: ${message.subject}`, 'info');
    }
  }

  read(id) {
    const msg = this.messages.find(m => m.id === id);
    if (msg && !msg.read) {
      msg.read = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.save();
      if (msg.reward && this.game?.currencySystem) {
        this.game.currencySystem.add(msg.reward);
        this.game.uiManager?.showNotification(`Claimed \u2605${msg.reward} reward!`, 'success');
        msg.rewardClaimed = true;
        this.save();
      }
    }
  }

  delete(id) {
    this.messages = this.messages.filter(m => m.id !== id);
    this.unreadCount = this.messages.filter(m => !m.read).length;
    this.save();
  }

  getAll() {
    return this.messages;
  }

  getUnreadCount() {
    return this.unreadCount;
  }

  // Random mail from NPCs
  maybeReceiveRandom() {
    if (Math.random() < 0.15) {
      const template = MAIL_MESSAGES[Math.floor(Math.random() * MAIL_MESSAGES.length)];
      this.receive({ ...template });
    }
  }

  save() {
    try {
      localStorage.setItem('starlight_inbox', JSON.stringify({ messages: this.messages, unreadCount: this.unreadCount }));
    } catch (e) {}
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem('starlight_inbox'));
      if (data) {
        this.messages = data.messages || [];
        this.unreadCount = data.unreadCount || this.messages.filter(m => !m.read).length;
      }
    } catch (e) {}
  }
}
