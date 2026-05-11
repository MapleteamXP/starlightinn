// ============================================================
// Starlight Engine — Chat Manager
// ============================================================

import { ContentFilter } from '../security/Filter.js';

export class ChatManager {
  constructor(game) {
    this.game = game;
    this.history = [];
    this.filter = new ContentFilter();
    this.lastChatTime = 0;
    this.chatColor = '#fffde7';
  }

  send(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Rate limit
    if (this.filter.isRateLimited(this.lastChatTime, 1000)) {
      if (this.game.uiManager) this.game.uiManager.showNotification('Please wait before chatting again', 'error');
      return;
    }
    this.lastChatTime = Date.now();

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Commands
    if (trimmed.startsWith('/')) {
      const parts = trimmed.slice(1).split(' ');
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1).join(' ');
      const player = this.game.player;
      switch (cmd) {
        case 'wave':
          player.isWaving = true; player.waveTimer = 0;
          player.say('*waves*', this.chatColor, 'emote');
          this.addHistory('You', '*waves*', timeStr, 'emote');
          return;
        case 'dance':
          player.isDancing = !player.isDancing;
          player.say(player.isDancing ? '*starts dancing*' : '*stops dancing*', this.chatColor, 'emote');
          this.addHistory('You', player.isDancing ? '*starts dancing*' : '*stops dancing*', timeStr, 'emote');
          return;
        case 'sit':
          player.isSitting = true;
          player.say('*sits down*', this.chatColor, 'emote');
          this.addHistory('You', '*sits down*', timeStr, 'emote');
          return;
        case 'stand':
          player.isSitting = false;
          player.say('*stands up*', this.chatColor, 'emote');
          this.addHistory('You', '*stands up*', timeStr, 'emote');
          return;
        case 'me':
          if (args) {
            player.say(`*${args}*`, this.chatColor, 'emote');
            this.addHistory('You', `*${args}*`, timeStr, 'emote');
          } else {
            if (this.game.uiManager) this.game.uiManager.showNotification('Usage: /me <action>', 'error');
          }
          return;
        case 'whisper':
        case 'w':
          if (args) {
            player.say(args, this.chatColor, 'whisper');
            this.addHistory('You', args, timeStr, 'whisper');
          } else {
            if (this.game.uiManager) this.game.uiManager.showNotification('Usage: /whisper <message>', 'error');
          }
          return;
        case 'shout':
        case 's':
          if (args) {
            player.say(args.toUpperCase(), this.chatColor, 'shout');
            this.addHistory('You', args.toUpperCase(), timeStr, 'shout');
          } else {
            if (this.game.uiManager) this.game.uiManager.showNotification('Usage: /shout <message>', 'error');
          }
          return;
        case 'clear':
          this.history = [];
          this.renderHistory();
          return;
        case 'help':
          this.showHelp();
          return;
        case 'rooms':
          if (this.game.uiManager) this.game.uiManager.togglePanel('navigatorPanel');
          return;
        case 'catalog':
          if (this.game.uiManager) this.game.uiManager.togglePanel('catalogPanel');
          return;
        case 'inventory':
          if (this.game.uiManager) this.game.uiManager.togglePanel('inventoryPanel');
          return;
        case 'customize':
          if (this.game.uiManager) {
            this.game.uiManager.togglePanel('customizePanel');
            this.game.renderCustomizePanel();
          }
          return;
        default:
          if (this.game.uiManager) this.game.uiManager.showNotification(`Unknown command: /${cmd}. Type /help for commands.`, 'error');
          return;
      }
    }

    // Normal chat
    const safeMode = this.game.settings && this.game.settings.safeMode;
    const filtered = this.filter.filter(trimmed, safeMode);
    this.game.player.say(filtered, this.chatColor, 'normal');
    this.addHistory('You', filtered, timeStr, 'normal');

    // NPC replies
    if (Math.random() < 0.4 && this.game.room) {
      setTimeout(() => {
        const npcs = this.game.room.avatars.filter(a => a.isNPC && !a.chatBubble);
        if (npcs.length > 0) {
          const npc = npcs[Math.floor(Math.random() * npcs.length)];
          const replies = ['Nice!', 'Haha', 'Cool', 'I agree', 'Interesting!', 'Wow!', 'Hey there!', 'lol', 'True!', 'Same'];
          npc.say(replies[Math.floor(Math.random() * replies.length)], '#fffde7', 'normal');
        }
      }, 500 + Math.random() * 1500);
    }
  }

  addHistory(name, text, time, type) {
    this.history.push({ name, text, time, type });
    if (this.history.length > 50) this.history.shift();
    this.renderHistory();
  }

  renderHistory() {
    const container = document.getElementById('chatHistory');
    if (!container) return;
    container.innerHTML = '';
    if (this.history.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:var(--habbo-text-dim);padding:20px;font-size:12px;">No messages yet. Start chatting!</div>';
      return;
    }
    this.history.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'chat-msg' + (msg.type === 'whisper' ? ' whisper' : '') + (msg.type === 'shout' ? ' shout' : '');
      const nameColor = msg.name === 'You' ? 'var(--habbo-accent)' : '#a0d8e0';
      div.innerHTML = `<span class="msg-name" style="color:${nameColor}">${msg.name}</span><span class="msg-time">${msg.time}</span><div class="msg-text">${msg.text}</div>`;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  }

  renderBubbles() {
    document.querySelectorAll('.chat-bubble').forEach(el => el.remove());
    document.querySelectorAll('.typing-indicator').forEach(el => el.remove());
    if (!this.game.room || !this.game.settings.showChat) return;
    this.game.room.avatars.forEach(avatar => {
      if (!avatar.chatBubble) return;
      const sp = avatar.screenPos;
      const screenX = sp.x + this.game.camera.x;
      const screenY = sp.y + this.game.camera.y - 14;
      if (screenX < -100 || screenX > this.game.width + 100 || screenY < -50 || screenY > this.game.height + 50) return;
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble' + (avatar.chatType === 'whisper' ? ' whisper' : '') + (avatar.chatType === 'shout' ? ' shout' : '');
      bubble.textContent = avatar.chatBubble;
      bubble.style.left = screenX + 'px';
      bubble.style.top = screenY + 'px';
      if (avatar.chatColor && avatar.chatType !== 'whisper' && avatar.chatType !== 'shout') {
        bubble.style.backgroundColor = avatar.chatColor;
        bubble.style.borderColor = this.darkenColor(avatar.chatColor, 20);
      }
      document.body.appendChild(bubble);
    });
  }

  darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
    const B = Math.max((num & 0x0000FF) - amt, 0);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  showHelp() {
    const helpText = `Commands:
/wave - Wave gesture
/dance - Toggle dance
/sit - Sit down
/stand - Stand up
/me <action> - Emote
/whisper <msg> - Whisper
/shout <msg> - Shout
/clear - Clear history
/rooms - Room navigator
/catalog - Furniture catalog
/inventory - Your inventory
/customize - Avatar customization`;
    if (this.game.uiManager) this.game.uiManager.showNotification(helpText, 'info');
  }

  updateTypingIndicator(visible, text = '') {
    const bar = document.getElementById('typingIndicatorBar');
    if (!bar) return;
    bar.classList.toggle('visible', visible);
    bar.textContent = visible ? (text || 'You are typing...') : '';
  }
}
