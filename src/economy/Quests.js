// ============================================================
// Starlight Engine — NPC Quest System
// ============================================================

const QUEST_TEMPLATES = [
  { id: 'place_3', name: 'Interior Designer', desc: 'Place 3 furniture items in any room.', target: 'place', amount: 3, reward: 75 },
  { id: 'visit_2', name: 'Room Explorer', desc: 'Visit 2 different public rooms.', target: 'visit', amount: 2, reward: 50 },
  { id: 'talk_npc', name: 'Social Butterfly', desc: 'Talk to 2 NPCs.', target: 'talk', amount: 2, reward: 40 },
  { id: 'find_treasure', name: 'Treasure Hunter', desc: 'Find 2 treasure chests.', target: 'treasure', amount: 2, reward: 100 },
  { id: 'win_minigame', name: 'Game Master', desc: 'Win any minigame once.', target: 'win', amount: 1, reward: 150 },
  { id: 'craft_1', name: 'Crafty Creator', desc: 'Craft 1 item at the workshop.', target: 'craft', amount: 1, reward: 60 },
];

export class QuestSystem {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.completed = [];
    this.dailyQuestTimer = 0;
    this.load();
    if (!this.active) this._offerNewQuest();
  }

  _offerNewQuest() {
    const template = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];
    this.active = { ...template, progress: 0, claimed: false };
    this.save();
    if (this.game?.uiManager) {
      this.game.uiManager.showNotification(`New Quest: ${this.active.name} — ${this.active.desc}`, 'info');
    }
  }

  track(type, amount = 1) {
    if (!this.active || this.active.claimed) return;
    if (this.active.target === type) {
      this.active.progress += amount;
      if (this.active.progress >= this.active.amount) {
        this.active.progress = this.active.amount;
        this.game.uiManager?.showNotification(`Quest complete: ${this.active.name}! Claim your reward.`, 'success');
        this.game.soundManager?.play('quest');
      }
      this.save();
    }
  }

  claim() {
    if (!this.active || this.active.claimed) return false;
    if (this.active.progress < this.active.amount) return false;
    this.game.currencySystem.add(this.active.reward);
    this.game.progressionSystem.addXP(25);
    this.game.uiManager?.showNotification(`Claimed \u2605${this.active.reward} for ${this.active.name}!`, 'success');
    this.game.soundManager?.play('win');
    this.active.claimed = true;
    this.completed.push(this.active);
    this.active = null;
    this.save();
    // Offer new quest after a delay
    setTimeout(() => this._offerNewQuest(), 5000);
    return true;
  }

  getActive() { return this.active; }
  getCompleted() { return this.completed; }

  save() {
    try {
      localStorage.setItem('starlight_quests', JSON.stringify({ active: this.active, completed: this.completed }));
    } catch (e) {}
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem('starlight_quests'));
      if (data) {
        this.active = data.active || null;
        this.completed = data.completed || [];
      }
    } catch (e) {}
  }
}
