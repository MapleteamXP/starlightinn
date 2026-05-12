// ============================================================
// Starlight Engine — Room Bot System
// ============================================================

const BOT_TEMPLATES = [
  {
    id: 'shop_bot',
    name: 'Vendor Bot',
    emoji: '🤖',
    greeting: 'Welcome! I sell rare items. What would you like?',
    dialog: [
      { text: 'Buy rare lamp (★500)', action: 'buy', item: 'lamp', price: 500 },
      { text: 'Buy crystal ball (★450)', action: 'buy', item: 'crystal_ball', price: 450 },
      { text: 'Just browsing', action: 'close' }
    ]
  },
  {
    id: 'guide_bot',
    name: 'Guide Bot',
    emoji: '📖',
    greeting: 'Hello! Need help navigating the inn?',
    dialog: [
      { text: 'How do I earn coins?', action: 'chat', response: 'Play minigames, find treasures, or complete daily challenges!' },
      { text: 'How do I customize my room?', action: 'chat', response: 'Open the navigator, go to My Room, and use the catalog!' },
      { text: 'Tell me a joke', action: 'chat', response: 'Why did the avatar sit on the lamp? To lighten up! 💡' },
      { text: 'Goodbye', action: 'close' }
    ]
  },
  {
    id: 'quest_bot',
    name: 'Quest Giver',
    emoji: '📜',
    greeting: 'Greetings adventurer! I have a task for you.',
    dialog: [
      { text: 'Accept daily task', action: 'quest', reward: 100 },
      { text: 'Maybe later', action: 'close' }
    ]
  },
  {
    id: 'fortune_bot',
    name: 'Mystic Bot',
    emoji: '🔮',
    greeting: 'The stars align for you today...',
    dialog: [
      { text: 'Read my fortune (★50)', action: 'fortune', price: 50 },
      { text: 'Not today', action: 'close' }
    ]
  }
];

export class RoomBotSystem {
  constructor(game) {
    this.game = game;
    this.bots = [];
  }

  spawn(type, x, y) {
    const template = BOT_TEMPLATES.find(b => b.id === type);
    if (!template) return null;
    const bot = {
      ...template,
      x, y,
      id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      animOffset: Math.random() * Math.PI * 2
    };
    this.bots.push(bot);
    return bot;
  }

  remove(botId) {
    this.bots = this.bots.filter(b => b.id !== botId);
  }

  getBotAt(x, y) {
    return this.bots.find(b => Math.round(b.x) === x && Math.round(b.y) === y);
  }

  draw(ctx, camera) {
    this.bots.forEach(bot => {
      const sp = this.game.isoToScreen(bot.x, bot.y);
      const x = sp.x + camera.x;
      const y = sp.y + camera.y - 10;
      const bob = Math.sin(Date.now() / 400 + bot.animOffset) * 2;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.ellipse(x, y + 8, 10, 4, 0, 0, Math.PI * 2); ctx.fill();

      // Bot body
      ctx.fillStyle = 'rgba(100,180,255,0.9)';
      ctx.beginPath(); ctx.arc(x, y + bob, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      ctx.stroke();

      // Emoji face
      ctx.font = '14px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bot.emoji, x, y + bob);

      // Name tag
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const nameW = ctx.measureText(bot.name).width + 8;
      ctx.beginPath(); ctx.roundRect(x - nameW/2, y - 28, nameW, 14, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px Nunito, sans-serif';
      ctx.fillText(bot.name, x, y - 20);
    });
  }

  handleDialog(bot) {
    if (!bot || !bot.dialog) return;
    const items = bot.dialog.map(d => ({
      text: d.text,
      action: () => {
        if (d.action === 'close') return;
        if (d.action === 'buy' && this.game) {
          if (this.game.currencySystem.spend(d.price)) {
            this.game.inventorySystem.add(d.item, 1);
            this.game.uiManager.showNotification(`Bought ${d.item}!`, 'success');
            this.game.soundManager.play('buy');
          } else {
            this.game.uiManager.showNotification('Not enough coins!', 'error');
          }
        }
        if (d.action === 'chat' && this.game) {
          this.game.uiManager.showNotification(d.response, 'info');
        }
        if (d.action === 'quest' && this.game) {
          this.game.questSystem.track('win');
          this.game.currencySystem.add(d.reward);
          this.game.uiManager.showNotification(`Quest complete! +★${d.reward}`, 'success');
        }
        if (d.action === 'fortune' && this.game) {
          if (this.game.currencySystem.spend(d.price)) {
            const fortunes = ['Great fortune awaits!', 'Beware of Mondays.', 'A friend will bring joy.', 'Wealth is coming your way.', 'Take a risk today!'];
            this.game.uiManager.showNotification(`🔮 ${fortunes[Math.floor(Math.random() * fortunes.length)]}`, 'success');
          } else {
            this.game.uiManager.showNotification('Not enough coins!', 'error');
          }
        }
      }
    }));
    return items;
  }
}
