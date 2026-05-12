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
      { text: 'Buy disco ball (★400)', action: 'buy', item: 'disco_ball', price: 400 },
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
  },
  {
    id: 'banker_bot',
    name: 'Banker Bot',
    emoji: '🏦',
    greeting: 'Greetings! Manage your StarCoins here.',
    dialog: [
      { text: 'Deposit 100 (save for later)', action: 'bank', deposit: 100 },
      { text: 'Withdraw 100', action: 'bank', withdraw: 100 },
      { text: 'Check balance', action: 'chat', response: 'Use the currency display in the top bar!' },
      { text: 'Goodbye', action: 'close' }
    ]
  },
  {
    id: 'stylist_bot',
    name: 'Stylist Bot',
    emoji: '✂️',
    greeting: 'Want a fresh look? I can help!',
    dialog: [
      { text: 'Randomize my outfit (free)', action: 'style', random: true },
      { text: 'Give me a tip', action: 'chat', response: 'Match your hat color to your shoes for extra style points!' },
      { text: 'No thanks', action: 'close' }
    ]
  },
  {
    id: 'game_host_bot',
    name: 'Game Host',
    emoji: '🎲',
    greeting: 'Feeling lucky? Play a quick game!',
    dialog: [
      { text: 'Roll dice (★10)', action: 'game', type: 'dice', price: 10 },
      { text: 'Coin flip (★10)', action: 'game', type: 'coin', price: 10 },
      { text: 'Maybe later', action: 'close' }
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

  serialize() {
    return this.bots.map(b => ({ type: b.id, x: b.x, y: b.y }));
  }

  deserialize(data) {
    this.bots = [];
    if (!data || !Array.isArray(data)) return;
    data.forEach(b => { if (b.type && typeof b.x === 'number' && typeof b.y === 'number') this.spawn(b.type, b.x, b.y); });
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
        if (d.action === 'bank' && this.game) {
          if (d.deposit) {
            this.game.uiManager.showNotification('StarCoins are safely stored in your account!', 'success');
          } else if (d.withdraw) {
            this.game.uiManager.showNotification('Withdrawal processed!', 'success');
          }
        }
        if (d.action === 'style' && this.game) {
          if (d.random) {
            const rand = arr => arr[Math.floor(Math.random() * arr.length)];
            this.game.customize.hairColor = rand(['#090806','#2C1608','#71635A','#B7A69E','#D6C4C2','#B55239','#A52A2A','#DC143C','#4B0082','#228B22']);
            this.game.customize.shirtColor = rand(['#E74C3C','#3498DB','#2ECC71','#F1C40F','#9B59B6','#E67E22','#1ABC9C','#34495E']);
            this.game.customize.pantsColor = rand(['#2C3E50','#34495E','#1ABC9C','#8E44AD','#D35400','#7F8C8D']);
            this.game.applyAvatarToPlayer();
            this.game.saveAvatarToStorage();
            this.game.uiManager.showNotification('Fresh new look! ✨', 'success');
          }
        }
        if (d.action === 'game' && this.game) {
          if (this.game.currencySystem.spend(d.price)) {
            if (d.type === 'dice') {
              const roll = Math.floor(Math.random() * 6) + 1;
              const win = roll >= 4;
              if (win) this.game.currencySystem.add(d.price * 2);
              this.game.uiManager.showNotification(`🎲 Rolled ${roll}! ${win ? 'You won!' : 'Better luck next time!'}`, win ? 'success' : 'info');
            } else if (d.type === 'coin') {
              const flip = Math.random() < 0.5 ? 'Heads' : 'Tails';
              const win = flip === 'Heads';
              if (win) this.game.currencySystem.add(d.price * 2);
              this.game.uiManager.showNotification(`🪙 ${flip}! ${win ? 'You won!' : 'Better luck next time!'}`, win ? 'success' : 'info');
            }
          } else {
            this.game.uiManager.showNotification('Not enough coins!', 'error');
          }
        }
      }
    }));
    return items;
  }
}
