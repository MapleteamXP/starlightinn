/**
 * @file Chat.js
 * @description Multi-channel chat system for Starlight Inn v3.
 * Supports area, whisper, system, and minigame channels with localStorage persistence.
 */

const STORAGE_KEY = 'starlight_chat_history_v3';
const MAX_HISTORY = 100;
const RATE_LIMIT_MS = 800; // minimum ms between own messages
const MAX_MESSAGE_LEN = 240;

/** @type {string[]} Basic profanity list (client-side rudimentary filter). */
const PROFANITY_LIST = [
  'damn', 'hell', 'crap', 'stupid', 'idiot', 'loser', 'noob', 'trash', 'garbage',
  'hate', 'kill', 'die', 'suck', 'worst', 'dumb', 'ugly', 'fat', 'skinny'
];

const CHANNEL_STYLES = {
  area:    { label: 'Area',    color: '#E5E7EB', badgeBg: '#374151' },
  whisper: { label: 'Whisper', color: '#C084FC', badgeBg: '#6B21A8' },
  system:  { label: 'System',  color: '#FBBF24', badgeBg: '#B45309' },
  minigame:{ label: 'Game',    color: '#34D399', badgeBg: '#065F46' },
};

export class Chat {
  /**
   * @param {Object} game — The main game instance.
   */
  constructor(game) {
    this.game = game;

    this.channels = {
      area: [],
      whisper: [],
      system: [],
      minigame: [],
    };
    this.activeChannel = 'area';
    this.maxHistory = MAX_HISTORY;

    // Rate limiting
    this._lastSendTime = 0;
    this._sendCount = 0;
    this._sendWindowStart = Date.now();
    this._maxBurst = 5;
    this._burstWindowMs = 10000;

    // DOM refs (set in init)
    this._container = null;
    this._logEl = null;
    this._inputEl = null;
    this._channelTabs = null;
    this._isFocused = false;

    // Callbacks for external systems (networking)
    this.onBroadcast = null; // fn(channel, message, target)
  }

  /** Wire UI and load persisted history. */
  init() {
    this._bindDOM();
    this._loadHistory();
    this._attachListeners();
    this.render();
  }

  /** Attempt to find or create chat DOM elements. */
  _bindDOM() {
    this._container = document.getElementById('chat-panel');
    this._logEl = document.getElementById('chat-log');
    this._inputEl = document.getElementById('chat-input');
    this._channelTabs = document.getElementById('chat-tabs');

    // If elements missing, create lightweight overlay in body
    if (!this._container) {
      this._buildFallbackUI();
    }
  }

  /** Build minimal chat overlay when DOM IDs are absent. */
  _buildFallbackUI() {
    const panel = document.createElement('div');
    panel.id = 'chat-panel';
    panel.className = 'chat-panel';
    panel.innerHTML = `
      <div class="chat-tabs" id="chat-tabs"></div>
      <div class="chat-log" id="chat-log"></div>
      <div class="chat-compose">
        <input id="chat-input" type="text" maxlength="${MAX_MESSAGE_LEN}" placeholder="Say something..." autocomplete="off" />
        <button id="chat-send">Send</button>
      </div>
    `;
    document.body.appendChild(panel);

    // Inject minimal styles if not present
    if (!document.getElementById('chat-style')) {
      const style = document.createElement('style');
      style.id = 'chat-style';
      style.textContent = `
        .chat-panel { position:fixed; bottom:12px; left:12px; width:340px; height:240px; display:flex; flex-direction:column;
          background:rgba(17,24,39,0.92); border:1px solid rgba(255,255,255,0.08); border-radius:12px; font-family:sans-serif;
          z-index:50; overflow:hidden; backdrop-filter:blur(6px); }
        .chat-tabs { display:flex; gap:4px; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.06); }
        .chat-tab { padding:4px 10px; border-radius:6px; font-size:12px; cursor:pointer; color:#9CA3AF; background:transparent; border:none; }
        .chat-tab.active { background:rgba(255,255,255,0.08); color:#fff; font-weight:600; }
        .chat-tab .badge { display:inline-block; margin-left:4px; padding:1px 5px; border-radius:8px; font-size:10px; color:#fff; background:#EF4444; }
        .chat-log { flex:1; overflow-y:auto; padding:8px; font-size:13px; line-height:1.45; }
        .chat-entry { margin-bottom:4px; word-break:break-word; }
        .chat-compose { display:flex; gap:6px; padding:6px 8px; border-top:1px solid rgba(255,255,255,0.06); }
        #chat-input { flex:1; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:6px;
          color:#fff; padding:5px 8px; font-size:13px; outline:none; }
        #chat-input:focus { border-color:rgba(255,255,255,0.25); }
        #chat-send { background:#3B82F6; color:#fff; border:none; border-radius:6px; padding:5px 12px; font-size:12px; cursor:pointer; }
        .chat-system { color:#FBBF24; font-style:italic; }
        .chat-whisper { color:#C084FC; }
        .chat-minigame { color:#34D399; }
        .chat-area { color:#E5E7EB; }
        .chat-name { font-weight:700; margin-right:4px; }
        .chat-time { color:#6B7280; font-size:11px; margin-right:4px; }
      `;
      document.head.appendChild(style);
    }

    this._container = panel;
    this._logEl = document.getElementById('chat-log');
    this._inputEl = document.getElementById('chat-input');
    this._channelTabs = document.getElementById('chat-tabs');
  }

  /** Attach event listeners to UI. */
  _attachListeners() {
    // Channel tab clicks
    if (this._channelTabs) {
      this._channelTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.chat-tab');
        if (!tab) return;
        const ch = tab.dataset.channel;
        if (ch) this.setChannel(ch);
      });
    }

    // Input handlers
    if (this._inputEl) {
      this._inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const msg = this._inputEl.value.trim();
          if (msg) {
            this.send(msg, this.activeChannel);
            this._inputEl.value = '';
          }
        }
        if (e.key === 'Escape') {
          this._inputEl.blur();
        }
      });
      this._inputEl.addEventListener('focus', () => { this._isFocused = true; });
      this._inputEl.addEventListener('blur', () => { this._isFocused = false; });
    }

    // Send button
    const btn = document.getElementById('chat-send');
    if (btn) {
      btn.addEventListener('click', () => {
        const msg = this._inputEl.value.trim();
        if (msg) {
          this.send(msg, this.activeChannel);
          this._inputEl.value = '';
        }
      });
    }
  }

  /**
   * Send a message from the local player.
   * @param {string} message
   * @param {string} channel — 'area' | 'whisper' | 'system' | 'minigame'
   * @param {string|null} target — target player id for whispers
   */
  send(message, channel = 'area', target = null) {
    // Validate
    if (!message || !message.trim()) return false;
    if (message.length > MAX_MESSAGE_LEN) {
      this.system('Your message is too long. Max 240 characters.');
      return false;
    }

    // Rate limit
    const now = Date.now();
    if (now - this._lastSendTime < RATE_LIMIT_MS) {
      this.system('You are sending messages too fast.');
      return false;
    }
    if (now - this._sendWindowStart > this._burstWindowMs) {
      this._sendWindowStart = now;
      this._sendCount = 0;
    }
    if (this._sendCount >= this._maxBurst) {
      this.system('Slow down! You have sent too many messages recently.');
      return false;
    }

    // Profanity
    const filtered = this.filterMessage(message);

    this._lastSendTime = now;
    this._sendCount++;

    const playerName = this.game.player ? this.game.player.name : 'You';

    // Whisper routing
    if (channel === 'whisper') {
      if (!target) {
        this.system('Select a player to whisper to.');
        return false;
      }
      this.whisper(target, filtered);
      return true;
    }

    // Push to local history
    this.receive(playerName, filtered, channel, false);

    // Broadcast hook for networked play
    if (this.onBroadcast) {
      this.onBroadcast(channel, filtered, target);
    }

    this.game.emit && this.game.emit('chatSend', { channel, message: filtered, target });
    return true;
  }

  /**
   * Receive a message (from network or local system).
   * @param {string} name — sender name
   * @param {string} message
   * @param {string} channel
   * @param {boolean} [isSystem=false]
   */
  receive(name, message, channel, isSystem = false) {
    if (!this.channels[channel]) return;

    const entry = {
      name,
      message,
      channel,
      time: Date.now(),
      system: isSystem,
    };

    this.channels[channel].push(entry);
    if (this.channels[channel].length > this.maxHistory) {
      this.channels[channel].shift();
    }

    // Save every 20 messages to avoid thrashing localStorage
    if (this.channels[channel].length % 20 === 0) {
      this._saveHistory();
    }

    this.render();

    // Auto-scroll if user is at bottom or message is in active channel
    if (channel === this.activeChannel) {
      this.scrollToBottom();
    }
  }

  /**
   * Send a whisper to a specific player.
   * @param {Object|string} toPlayer — player object or id
   * @param {string} message
   */
  whisper(toPlayer, message) {
    const targetId = typeof toPlayer === 'object' ? toPlayer.id : toPlayer;
    const targetName = typeof toPlayer === 'object' ? toPlayer.name : toPlayer;

    if (message && message.trim()) {
      const filtered = this.filterMessage(message);
      this.receive(targetName, `→ ${filtered}`, 'whisper', false);
    } else {
      // Empty message just sets whisper channel
      this.setChannel('whisper');
    }

    this.game.emit && this.game.emit('chatWhisper', { targetId, targetName, message });
  }

  /**
   * Emit a system message.
   * @param {string} message
   */
  system(message) {
    this.receive('System', message, 'system', true);
  }

  /**
   * Switch active channel.
   * @param {string} channel
   */
  setChannel(channel) {
    if (!this.channels[channel]) return;
    this.activeChannel = channel;
    this.render();
    this.scrollToBottom();
  }

  /** Clear the currently active channel's history. */
  clear() {
    this.channels[this.activeChannel] = [];
    this.render();
  }

  /** Scroll chat log to bottom. */
  scrollToBottom() {
    if (this._logEl) {
      this._logEl.scrollTop = this._logEl.scrollHeight;
    }
  }

  /** Render the chat panel UI. */
  render() {
    if (!this._logEl || !this._channelTabs) return;

    // 1) Render tabs
    this._renderTabs();

    // 2) Render messages for active channel
    const entries = this.channels[this.activeChannel];
    const html = entries.map((entry) => this._renderEntry(entry)).join('');
    this._logEl.innerHTML = html || '<div class="chat-placeholder" style="color:#6B7280;font-size:12px;text-align:center;margin-top:40px;">No messages yet. Say hello!</div>';
  }

  /** Render channel tabs with unread badges. */
  _renderTabs() {
    const tabs = Object.keys(this.channels).map((ch) => {
      const style = CHANNEL_STYLES[ch];
      const isActive = ch === this.activeChannel;
      const unread = ch !== this.activeChannel ? this.channels[ch].length : 0; // Simplified
      const badge = unread > 0 ? `<span class="badge">${unread > 99 ? '99+' : unread}</span>` : '';
      return `<button class="chat-tab ${isActive ? 'active' : ''}" data-channel="${ch}">${style.label}${badge}</button>`;
    }).join('');
    this._channelTabs.innerHTML = tabs;
  }

  /**
   * Render a single chat entry as HTML.
   * @param {Object} entry
   * @returns {string}
   */
  _renderEntry(entry) {
    const timeStr = this._formatTime(entry.time);
    const style = CHANNEL_STYLES[entry.channel] || CHANNEL_STYLES.area;
    let cssClass = 'chat-area';
    if (entry.system) cssClass = 'chat-system';
    else if (entry.channel === 'whisper') cssClass = 'chat-whisper';
    else if (entry.channel === 'minigame') cssClass = 'chat-minigame';

    const nameSpan = entry.system
      ? ''
      : `<span class="chat-name" style="color:${style.color}">${this._escapeHtml(entry.name)}:</span>`;

    return `<div class="chat-entry ${cssClass}">
      <span class="chat-time">${timeStr}</span>
      ${nameSpan}
      <span>${this._escapeHtml(entry.message)}</span>
    </div>`;
  }

  /** Format a timestamp to HH:MM. */
  _formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  /** Escape HTML to prevent XSS. */
  _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Basic profanity filter: replaces bad words with asterisks.
   * @param {string} message
   * @returns {string}
   */
  filterMessage(message) {
    let filtered = message;
    for (const word of PROFANITY_LIST) {
      const re = new RegExp(`\\b${word}\\b`, 'gi');
      filtered = filtered.replace(re, '*'.repeat(word.length));
    }
    return filtered;
  }

  /** Persist chat history to localStorage (best-effort). */
  _saveHistory() {
    try {
      const payload = {
        channels: this.channels,
        activeChannel: this.activeChannel,
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      // localStorage may be full or unavailable
    }
  }

  /** Load chat history from localStorage. */
  _loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.channels) {
        for (const ch of Object.keys(data.channels)) {
          if (this.channels[ch]) {
            this.channels[ch] = data.channels[ch].slice(-this.maxHistory);
          }
        }
      }
      if (data.activeChannel && this.channels[data.activeChannel]) {
        this.activeChannel = data.activeChannel;
      }
    } catch (e) {
      // Ignore corrupted storage
    }
  }

  /**
   * Check if chat input is currently focused.
   * Useful to disable game hotkeys while typing.
   * @returns {boolean}
   */
  isTyping() {
    return this._isFocused;
  }

  /**
   * External hook: receive a message from the server.
   * @param {Object} packet — { name, message, channel, system?, fromId? }
   */
  onServerMessage(packet) {
    const ch = packet.channel || 'area';
    this.receive(packet.name, packet.message, ch, !!packet.system);
  }

  /** Focus the chat input. */
  focus() {
    if (this._inputEl) this._inputEl.focus();
  }

  /** Unload and cleanup. */
  destroy() {
    this._saveHistory();
  }
}
