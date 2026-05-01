/**
 * TheatreSystem.js — Starlight Inn v7.0 YouTube Theatre
 * Collaborative virtual theatre with YouTube iframe API, jukebox queue,
 * seat system, emotes, ambient screen glow, DJ controls, themes, and more.
 * @author Starlight Inn Team | v3.0.0 | MIT
 */
import WebRTCSync from './WebRTCSync.js';

const THEATRE_CONFIG = {
  SCREEN_WIDTH: 400, SCREEN_HEIGHT: 300,
  TV_FRAME_COLOR: '#1a1a2e', TV_FRAME_ACCENT: '#e94560',
  TV_BEZEL: 16, GLOW_COLOR: 'rgba(233,69,96,0.15)', GLOW_INTENSITY: 40,
  SEAT_ROWS: 4, SEAT_COLS: 5,
  SEAT_WIDTH: 48, SEAT_HEIGHT: 48,
  SEAT_GAP_X: 12, SEAT_GAP_Y: 16, SEAT_OFFSET_Y: 380,
  MAX_QUEUE_SIZE: 50, SKIP_VOTES_NEEDED: 3,
  SYNC_INTERVAL_MS: 2000, SEEK_THRESHOLD_S: 2.0,
  CHAT_MAX_MESSAGES: 100,
  YOUTUBE_API_BASE: 'https://www.googleapis.com/youtube/v3',
  DEFAULT_VOLUME: 70,
  CONTROLS_HIDE_DELAY_MS: 3000,
};

const EMOTE_DEFS = {
  clap:   { icon: '👏', sound: 'applause', duration: 1500 },
  boo:    { icon: '😒', sound: 'boo',      duration: 1200 },
  popcorn:{ icon: '🍿', sound: 'crunch',    duration: 2000 },
  laugh:  { icon: '😂', sound: 'laugh',     duration: 1800 },
  dance:  { icon: '💃', sound: 'music',     duration: 3000 },
};

const PLAYER_STATES = { UNSTARTED:-1, ENDED:0, PLAYING:1, PAUSED:2, BUFFERING:3, CUED:5 };
const THEMES = { default:'#0f0f1a', midnight:'#0a0a14', velvet:'#1a0a1a', ocean:'#0a1a2e', forest:'#0a1a0a' };

export class TheatreSystem
export default class TheatreSystem {
  constructor(options = {}) {
    this.opts = { ...THEATRE_CONFIG, ...options };
    this.player = null; this.playerReady = false;
    this.currentVideoId = null; this.currentTitle = '';
    this.isPlaying = false; this.isBuffering = false;
    this.playerVolume = this.opts.DEFAULT_VOLUME;
    this.lastReportedTime = 0; this.isFullscreen = false;
    this.queue = []; this.history = []; this.skipVotes = new Set(); this.currentIndex = -1;
    this.seats = this._initSeats(); this.mySeatId = null;
    this.seatOccupants = new Map();
    this.chatMessages = []; this.chatCallbacks = [];
    this.unreadCount = 0; this.isChatOpen = false;
    this.activeEmotes = []; this.emoteCallbacks = [];
    this.webrtc = null; this.roomId = null; this.isDJ = false;
    this.userId = this._generateUserId();
    this.userName = options.userName || 'Guest';
    this.userAvatar = options.userAvatar || null;
    this.hostId = null; this.syncTimer = null;
    this.stateCallbacks = []; this.queueCallbacks = [];
    this.videoEndCallbacks = []; this.joinCallbacks = []; this.leaveCallbacks = [];
    this.canvas = null; this.ctx = null; this.containerEl = null;
    this.screenGlowEl = null; this.youtubeContainer = null;
    this.uiLayer = null; this.controlsEl = null;
    this.queueEl = null; this.chatEl = null;
    this.progressEl = null; this.bufferingEl = null;
    this.resizeObserver = null;
    this._rafId = null; this._lastFrameTime = 0; this._glowPhase = 0;
    this._controlsHideTimer = null;
    this._theme = options.theme || 'default';
    this._atmosphereEnabled = true;
    this._repeatMode = false;
    this._totalWatchTime = 0;
    this._watchStartTime = null;
    this._connectionStatusEl = null;
    this._customEmotes = new Map();
    this._roomPassword = options.roomPassword || null;
    this._connectionStatusEl = null;
    this._onPlayerReady = this._onPlayerReady.bind(this);
    this._onPlayerStateChange = this._onPlayerStateChange.bind(this);
    this._onPlayerError = this._onPlayerError.bind(this);
    this._animate = this._animate.bind(this);
    this._handleSeatClick = this._handleSeatClick.bind(this);
    this._handleCanvasClick = this._handleCanvasClick.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onFullscreenChange = this._onFullscreenChange.bind(this);
    this._onSyncState = this._onSyncState.bind(this);
    this._onPeerJoin = this._onPeerJoin.bind(this);
    this._onPeerLeave = this._onPeerLeave.bind(this);
    this._onPeerMessage = this._onPeerMessage.bind(this);
    this._debug = options.debug || false;
    this._log('TheatreSystem instance created');
  }

  // ── PUBLIC API ─ Initialization ──
  async mount(container) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new TypeError('TheatreSystem.mount() requires a valid HTMLElement');
    }
    this.containerEl = container;
    this._injectStyles();
    this._buildDOM(); this._initCanvas(); this._initYouTubePlayer();
    this._bindEvents(); this._startAnimationLoop();
    this.webrtc = new WebRTCSync({ debug: this._debug });
    this.webrtc.onStateUpdate(this._onSyncState);
    this.webrtc.onPeerJoin(this._onPeerJoin);
    this.webrtc.onPeerLeave(this._onPeerLeave);
    this.webrtc.onPeerMessage(this._onPeerMessage);
    this._log('Theatre mounted'); return this;
  }

  destroy() {
    this._stopAnimationLoop(); this._unbindEvents(); this.leaveRoom();
    if (this.webrtc) { this.webrtc.destroy(); this.webrtc = null; }
    if (this.player && this.player.destroy) { this.player.destroy(); this.player = null; }
    this.resizeObserver?.disconnect();
    if (this.containerEl && this.uiLayer) this.containerEl.innerHTML = '';
    this._removeStyles();
    this._log('Theatre destroyed');
  }

  // ── PUBLIC API ─ YouTube Video Control ──
  loadVideo(videoId, autoplay = true, startTime = 0) {
    if (!videoId || typeof videoId !== 'string') {
      console.warn('[Theatre] loadVideo: invalid videoId', videoId); return;
    }
    this.currentVideoId = videoId; this.skipVotes.clear();
    if (this.playerReady && this.player) {
      this.player.loadVideoById({ videoId, startSeconds: startTime });
      if (!autoplay) setTimeout(() => this.player.pauseVideo(), 500);
    } else {
      this._pendingLoad = { videoId, autoplay, startTime };
    }
    this._fetchVideoMeta(videoId).then(meta => {
      this.currentTitle = meta?.title || 'Unknown Video';
      this._notifyQueueChange();
      this._preloadNextVideo();
    });
    this._log('Loading video', videoId);
  }
  play() { if (this.playerReady && this.player) this.player.playVideo(); }
  pause() { if (this.playerReady && this.player) this.player.pauseVideo(); }
  seek(timeSeconds) {
    if (this.playerReady && this.player) this.player.seekTo(timeSeconds, true);
    this._broadcastState({ action: 'seek', time: timeSeconds });
  }
  togglePlay() { this.isPlaying ? this.pause() : this.play(); }
  setVolume(vol) {
    this.playerVolume = Math.max(0, Math.min(100, vol | 0));
    if (this.playerReady && this.player) this.player.setVolume(this.playerVolume);
    this._updateVolumeUI();
  }
  toggleMute() {
    if (!this.playerReady) return;
    if (this.player.isMuted && this.player.isMuted()) { this.player.unMute(); this._updateMuteIcon(false); }
    else { this.player.mute(); this._updateMuteIcon(true); }
  }
  _updateMuteIcon(isMuted) {
    const btn = this.controlsEl?.querySelector('.theatre-mute');
    if (!btn) return; btn.textContent = isMuted ? '🔇' : '🔊';
  }
  toggleFullscreen() {
    if (!this.containerEl) return;
    if (!document.fullscreenElement) this.containerEl.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  setPlaybackQuality(quality) {
    if (this.playerReady && this.player?.setPlaybackQuality) {
      this.player.setPlaybackQuality(quality);
    }
  }

  // ── PUBLIC API ─ Queue Management ──
  addToQueue(video) {
    if (!video || !video.videoId) throw new TypeError('addToQueue requires videoId');
    const entry = {
      videoId: video.videoId, title: video.title || 'Unknown',
      duration: video.duration || 0,
      requestedBy: video.requestedBy || this.userName,
      thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/default.jpg`,
      addedAt: Date.now(),
    };
    this.queue.push(entry);
    if (this.queue.length > this.opts.MAX_QUEUE_SIZE) this.queue.shift();
    this._notifyQueueChange();
    this._broadcastState({ action: 'queueAdd', entry });
    if (!this.currentVideoId && this.currentIndex === -1) this._playNextInQueue();
    return this.queue.length;
  }
  removeFromQueue(index) {
    if (index < 0 || index >= this.queue.length) return;
    const removed = this.queue.splice(index, 1)[0];
    if (index < this.currentIndex) this.currentIndex--;
    this._notifyQueueChange();
    this._broadcastState({ action: 'queueRemove', index, removed });
  }
  clearQueue() {
    if (!this.isDJ) { console.warn('[Theatre] Only DJ can clear queue'); return; }
    this.queue = []; this.currentIndex = -1;
    this._notifyQueueChange();
    this._broadcastState({ action: 'queueClear' });
  }
  reorderQueue(fromIndex, toIndex) {
    if (!this.isDJ) { console.warn('[Theatre] Only DJ can reorder'); return; }
    if (fromIndex < 0 || fromIndex >= this.queue.length) return;
    if (toIndex < 0 || toIndex >= this.queue.length) return;
    const [item] = this.queue.splice(fromIndex, 1);
    this.queue.splice(toIndex, 0, item);
    this._notifyQueueChange();
    this._broadcastState({ action: 'queueReorder', fromIndex, toIndex });
  }
  shuffleQueue() {
    if (!this.isDJ) { console.warn('[Theatre] Only DJ can shuffle'); return; }
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.currentIndex = -1;
    this._notifyQueueChange();
    this._broadcastState({ action: 'queueShuffle' });
    this._appendSystemChat('Queue shuffled!');
  }

  // ── PUBLIC API ─ Skip / Voting ──
  voteSkip() {
    if (!this.currentVideoId) return;
    this.skipVotes.add(this.userId);
    this._broadcastState({ action: 'voteSkip', userId: this.userId });
    this._checkSkipVotes();
  }
  forceSkip() {
    if (!this.isDJ) { console.warn('[Theatre] Only DJ can force skip'); return; }
    this._skipCurrent();
  }

  // ── PUBLIC API ─ Search ──
  async searchYouTube(query, apiKey = null) {
    if (!query || !query.trim()) return [];
    const q = encodeURIComponent(query.trim());
    if (apiKey) {
      try {
        const url = `${this.opts.YOUTUBE_API_BASE}/search?part=snippet&q=${q}&type=video&maxResults=10&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.items) {
          return data.items.map(item => ({
            videoId: item.id.videoId, title: item.snippet.title, duration: 0,
            thumbnail: item.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${item.id.videoId}/mqdefault.jpg`,
          }));
        }
      } catch (err) {
        console.warn('[Theatre] YouTube API search failed, using mock fallback', err);
      }
    }
    return this._mockSearchResults(query);
  }

  // ── PUBLIC API ─ Room / Sync ──
  async createRoom(roomId) {
    this.roomId = roomId;
    await this.webrtc.createRoom(roomId);
    this.hostId = this.userId; this.isDJ = true; this._startSyncLoop();
    this._broadcastState({
      action: 'roomInfo', userId: this.userId, userName: this.userName,
      currentVideoId: this.currentVideoId, currentTime: this._getCurrentTime(),
      isPlaying: this.isPlaying, queue: this.queue,
    });
    this._log('Created room', roomId, 'as host');
  }
  async joinRoom(roomId) {
    this.roomId = roomId;
    await this.webrtc.joinRoom(roomId); this.isDJ = false;
    this.webrtc.broadcastState({ action: 'requestState', fromUserId: this.userId });
    this._log('Joined room', roomId);
  }
  leaveRoom() {
    this._stopSyncLoop();
    if (this.webrtc) this.webrtc.leaveRoom();
    this.roomId = null; this.hostId = null; this.isDJ = false;
    this._log('Left room');
  }

  // ── PUBLIC API ─ Seat System ──
  sitInSeat(seatIndex) {
    if (seatIndex < 0 || seatIndex >= this.seats.length) return false;
    const seat = this.seats[seatIndex];
    if (seat.occupied && seat.occupantId !== this.userId) return false;
    if (this.mySeatId !== null) {
      const oldSeat = this.seats[this.mySeatId];
      oldSeat.occupied = false; oldSeat.occupantId = null;
    }
    seat.occupied = true; seat.occupantId = this.userId; this.mySeatId = seatIndex;
    this.seatOccupants.set(seatIndex, { userId: this.userId, name: this.userName, avatar: this.userAvatar });
    this._broadcastState({ action: 'seatUpdate', seatIndex, userId: this.userId, userName: this.userName, avatar: this.userAvatar });
    this._renderSeats(); return true;
  }
  standUp() {
    if (this.mySeatId === null) return;
    const seat = this.seats[this.mySeatId];
    seat.occupied = false; seat.occupantId = null;
    this.seatOccupants.delete(this.mySeatId); this.mySeatId = null;
    this._broadcastState({ action: 'seatLeave', seatIndex: this.mySeatId, userId: this.userId });
    this._renderSeats();
  }

  // ── PUBLIC API ─ Chat & Emotes ──
  sendChat(text) {
    if (!text || !text.trim()) return;
    const msg = {
      id: this._generateMessageId(), userId: this.userId, userName: this.userName,
      avatar: this.userAvatar, text: text.trim(), timestamp: Date.now(), type: 'chat',
    };
    this._appendChatMessage(msg);
    this._broadcastState({ action: 'chat', message: msg });
  }
  sendWhisper(targetUserId, text) {
    if (!text || !text.trim() || !targetUserId) return;
    const msg = {
      id: this._generateMessageId(), userId: this.userId, userName: this.userName,
      avatar: this.userAvatar, text: text.trim(), timestamp: Date.now(), type: 'whisper', targetUserId,
    };
    this._appendChatMessage(msg);
    this._broadcastState({ action: 'whisper', message: msg });
  }
  sendEmote(emoteType) {
    const def = EMOTE_DEFS[emoteType]; if (!def) return;
    const emote = {
      id: this._generateMessageId(), type: emoteType, icon: def.icon,
      userId: this.userId, userName: this.userName, timestamp: Date.now(),
      duration: def.duration, x: 0, y: 0, opacity: 1, scale: 0.5,
    };
    this.activeEmotes.push(emote);
    this._broadcastState({ action: 'emote', emote });
    this._playEmoteSound(def.sound);
  }

  // ── PUBLIC API ─ Theme & Atmosphere ──
  setTheme(themeName) {
    if (!THEMES[themeName]) return;
    this._theme = themeName;
    this.containerEl?.style.setProperty('--theatre-bg', THEMES[themeName]);
    this._broadcastState({ action: 'themeChange', theme: themeName });
  }
  toggleAtmosphere() {
    this._atmosphereEnabled = !this._atmosphereEnabled;
    this.containerEl?.classList.toggle('theatre-atmosphere-off', !this._atmosphereEnabled);
  }

  // ── PUBLIC API ─ Playback Modes ──
  toggleRepeat() {
    this._repeatMode = !this._repeatMode;
    this._appendSystemChat(this._repeatMode ? 'Repeat mode: ON' : 'Repeat mode: OFF');
    this._broadcastState({ action: 'repeatMode', enabled: this._repeatMode });
  }

  // ── PUBLIC API ─ DJ Controls ──
  handoffDJ(targetUserId) {
    if (!this.isDJ) { console.warn('[Theatre] Only DJ can handoff'); return; }
    this.isDJ = false; this._stopSyncLoop();
    this._broadcastState({ action: 'hostMigration', newHostId: targetUserId });
    this._appendSystemChat(`DJ controls handed off`);
  }

  // ── PUBLIC API ─ Custom Emotes ──
  registerCustomEmote(name, icon, duration = 2000) {
    this._customEmotes.set(name, { icon, duration });
  }
  sendCustomEmote(name) {
    const def = this._customEmotes.get(name); if (!def) return;
    const emote = {
      id: this._generateMessageId(), type: 'custom', name, icon: def.icon,
      userId: this.userId, userName: this.userName, timestamp: Date.now(),
      duration: def.duration, x: 0, y: 0, opacity: 1, scale: 0.5,
    };
    this.activeEmotes.push(emote);
    this._broadcastState({ action: 'emote', emote });
  }

  // ── PUBLIC API ─ Room Security ──
  setRoomPassword(password) {
    if (!this.isDJ) { console.warn('[Theatre] Only DJ can set password'); return; }
    this._roomPassword = password;
    this._broadcastState({ action: 'passwordSet', hasPassword: !!password });
  }

  // ── PUBLIC API ─ Statistics ──
  getStats() {
    return {
      totalWatchTime: this._totalWatchTime,
      videosWatched: this.history.length,
      currentQueueSize: this.queue.length,
      totalQueueDuration: this._getTotalQueueDuration(),
      seatOccupancy: this.seats.filter(s => s.occupied).length,
      chatMessageCount: this.chatMessages.length,
      peerCount: this.webrtc?.getPeerCount() || 0,
      isHost: this.isHost(),
      currentTheme: this._theme,
      repeatMode: this._repeatMode,
    };
  }
  _getTotalQueueDuration() {
    return this.queue.reduce((sum, item) => sum + (item.duration || 0), 0);
  }

  // ── PUBLIC API ─ Reset ──
  resetStats() {
    this._totalWatchTime = 0;
    this.history = [];
    this._appendSystemChat('Statistics reset');
  }

  // ── PUBLIC API ─ Queue Import/Export ──
  exportQueue() {
    return JSON.stringify(this.queue.map(e => ({ videoId: e.videoId, title: e.title, duration: e.duration })));
  }
  importQueue(jsonString) {
    if (!this.isDJ) { console.warn('[Theatre] Only DJ can import queue'); return; }
    try {
      const items = JSON.parse(jsonString);
      if (Array.isArray(items)) {
        items.forEach(item => this.addToQueue(item));
        this._appendSystemChat(`Imported ${items.length} videos to queue`);
      }
    } catch (e) { console.warn('[Theatre] Failed to import queue', e); }
  }

  // ── PUBLIC API ─ Snapshot ──
  async captureSnapshot() {
    if (!this.canvas) return null;
    return this.canvas.toDataURL('image/png');
  }

  // ── PUBLIC API ─ Connection Status ──
  _renderConnectionStatus() {
    if (!this.containerEl) return;
    let statusEl = this.containerEl.querySelector('.theatre-connection-status');
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.className = 'theatre-connection-status';
      this.containerEl.appendChild(statusEl);
    }
    const peerCount = this.webrtc?.getPeerCount() || 0;
    const signalStrength = this.webrtc?.getSignalStrength?.(this.hostId) || 'unknown';
    const isFallback = this.webrtc?.useFallback || false;
    const strengthEmoji = { excellent: '🟢', good: '🟡', fair: '🟠', poor: '🔴', unknown: '⚪' };
    statusEl.textContent = `${strengthEmoji[signalStrength] || '⚪'} ${peerCount} peers ${isFallback ? '(relay)' : '(P2P)'}`;
    statusEl.title = `Signal: ${signalStrength} | Peers: ${peerCount} | Mode: ${isFallback ? 'Socket.IO relay' : 'WebRTC P2P'}`;
  }

  // ── INTERNAL ─ Watch Time Tracking ──
  _startWatchTimer() {
    if (this._watchStartTime) return;
    this._watchStartTime = Date.now();
  }
  _stopWatchTimer() {
    if (!this._watchStartTime) return;
    this._totalWatchTime += Date.now() - this._watchStartTime;
    this._watchStartTime = null;
  }

  // ── INTERNAL ─ Video Preload ──
  _preloadNextVideo() {
    const nextIndex = this.currentIndex + 1;
    if (nextIndex < this.queue.length) {
      const next = this.queue[nextIndex];
      // Preload thumbnail for next video
      const img = new Image();
      img.src = next.thumbnail;
      this._log('Preloading next video thumbnail', next.videoId);
    }
  }

  // ── INTERNAL ─ Custom Emote Rendering ──
  _drawCustomEmotes(ctx) {
    for (const emote of this.activeEmotes) {
      if (emote.type === 'custom') {
        ctx.save(); ctx.globalAlpha = emote.opacity;
        ctx.font = `${28 * emote.scale}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(emote.icon, emote.x, emote.y); ctx.restore();
      }
    }
  }

  // ── PUBLIC API ─ Help ──
  showShortcutsHelp() {
    const help = [
      'Space: Play/Pause', 'Arrow Right: +5s', 'Arrow Left: -5s',
      'Arrow Up: Volume +', 'Arrow Down: Volume -',
      'F: Fullscreen', 'M: Mute', 'Q: Toggle Queue', 'C: Toggle Chat',
    ];
    this._appendSystemChat('Keyboard shortcuts: ' + help.join(' | '));
  }

  // ── PUBLIC API ─ Callback Registration ──
  onVideoEnd(cb) { this.videoEndCallbacks.push(cb); }
  onQueueChange(cb) { this.queueCallbacks.push(cb); }
  onStateUpdate(cb) { this.stateCallbacks.push(cb); }
  onPeerJoin(cb) { this.joinCallbacks.push(cb); }
  onPeerLeave(cb) { this.leaveCallbacks.push(cb); }
  onChatMessage(cb) { this.chatCallbacks.push(cb); }
  onEmote(cb) { this.emoteCallbacks.push(cb); }

  // ── PUBLIC API ─ Getters ──
  getQueue() { return [...this.queue]; }
  getHistory() { return [...this.history]; }
  getCurrentVideo() { return this.currentIndex >= 0 ? this.queue[this.currentIndex] : null; }
  getCurrentTime() { return this._getCurrentTime(); }
  getDuration() { return this.playerReady && this.player?.getDuration ? this.player.getDuration() : 0; }
  getSeats() { return this.seats.map(s => ({ ...s })); }
  getMySeat() { return this.mySeatId; }
  getChatMessages() { return [...this.chatMessages]; }
  getUnreadCount() { return this.unreadCount; }
  isHost() { return this.hostId === this.userId; }
  getRoomId() { return this.roomId; }
  getUserId() { return this.userId; }
  getTheme() { return this._theme; }

  // ── INTERNAL ─ YouTube Player ──
  _initYouTubePlayer() {
    if (window.YT && window.YT.Player) { this._createPlayer(); return; }
    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api'; tag.src = 'https://www.youtube.com/iframe_api';
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript.parentNode.insertBefore(tag, firstScript);
    }
    window.onYouTubeIframeAPIReady = () => this._createPlayer();
  }
  _createPlayer() {
    if (!this.youtubeContainer) return;
    this.player = new window.YT.Player(this.youtubeContainer, {
      width: this.opts.SCREEN_WIDTH, height: this.opts.SCREEN_HEIGHT,
      videoId: this.currentVideoId || '',
      playerVars: {
        autoplay: 0, controls: 0, disablekb: 1, enablejsapi: 1,
        iv_load_policy: 3, modestbranding: 1, rel: 0, showinfo: 0,
        fs: 0, playsinline: 1, origin: window.location.origin,
      },
      events: { onReady: this._onPlayerReady, onStateChange: this._onPlayerStateChange, onError: this._onPlayerError },
    });
  }
  _onPlayerReady(event) {
    this.playerReady = true; this.player.setVolume(this.playerVolume);
    this._log('Player ready');
    if (this._pendingLoad) {
      const { videoId, autoplay, startTime } = this._pendingLoad;
      this.loadVideo(videoId, autoplay, startTime); this._pendingLoad = null;
    }
  }
  _onPlayerStateChange(event) {
    const state = event.data, wasPlaying = this.isPlaying;
    this.isPlaying = (state === PLAYER_STATES.PLAYING);
    this.isBuffering = (state === PLAYER_STATES.BUFFERING);
    switch (state) {
      case PLAYER_STATES.PLAYING: this._log('State: PLAYING'); this._startWatchTimer(); break;
      case PLAYER_STATES.PAUSED:  this._log('State: PAUSED'); this._stopWatchTimer(); break;
      case PLAYER_STATES.ENDED:   this._log('State: ENDED'); this._stopWatchTimer(); this._handleVideoEnd(); break;
      case PLAYER_STATES.BUFFERING: this._log('State: BUFFERING'); this._showBuffering(); break;
      case PLAYER_STATES.UNSTARTED: this._log('State: UNSTARTED'); break;
    }
    if (this.isBuffering) this._showBuffering(); else this._hideBuffering();
    if (wasPlaying !== this.isPlaying) {
      this._updatePlayButtonUI();
      if (this.isDJ) this._broadcastState({ action: 'playState', isPlaying: this.isPlaying, currentTime: this._getCurrentTime(), videoId: this.currentVideoId });
    }
  }
  _onPlayerError(event) {
    console.error('[Theatre] Player error', event.data);
    this._appendSystemChat(`Video error (${event.data}). Skipping...`);
    this._skipCurrent();
  }
  _getCurrentTime() {
    if (this.playerReady && this.player?.getCurrentTime) return this.player.getCurrentTime() || 0;
    return this.lastReportedTime;
  }
  _handleVideoEnd() {
    this.videoEndCallbacks.forEach(cb => { try { cb(this.currentVideoId); } catch (e) {} });
    this._playNextInQueue();
  }
  _playNextInQueue() {
    const nextIndex = this.currentIndex + 1;
    if (nextIndex < this.queue.length) {
      this.currentIndex = nextIndex;
      const entry = this.queue[nextIndex];
      this.loadVideo(entry.videoId, true, 0);
      this._appendSystemChat(`Now playing: ${entry.title}`);
    } else {
      this.currentIndex = -1; this.currentVideoId = null; this.isPlaying = false;
      this._appendSystemChat('Queue ended. Add more videos!');
    }
    this.skipVotes.clear(); this._notifyQueueChange();
  }
  _skipCurrent() {
    if (!this.currentVideoId) return;
    const skipped = this.currentIndex >= 0 ? this.queue[this.currentIndex] : null;
    if (skipped) this.history.push(skipped);
    this._playNextInQueue();
    this._broadcastState({ action: 'skip', skippedVideoId: skipped?.videoId });
  }

  // ── INTERNAL ─ Buffering UI ──
  _showBuffering() {
    if (this.bufferingEl) this.bufferingEl.hidden = false;
  }
  _hideBuffering() {
    if (this.bufferingEl) this.bufferingEl.hidden = true;
  }

  // ── INTERNAL ─ Sync / WebRTC ──
  _startSyncLoop() {
    if (this.syncTimer) return;
    this.syncTimer = setInterval(() => {
      if (this.isDJ && this.isPlaying && this.currentVideoId) {
        this._broadcastState({ action: 'sync', videoId: this.currentVideoId, currentTime: this._getCurrentTime(), isPlaying: this.isPlaying, queue: this.queue, currentIndex: this.currentIndex });
      }
    }, this.opts.SYNC_INTERVAL_MS);
  }
  _stopSyncLoop() { if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null; } }
  _broadcastState(state) {
    if (!this.webrtc || !this.roomId) return;
    this.webrtc.broadcastState({ ...state, fromUserId: this.userId, fromUserName: this.userName, timestamp: Date.now() });
  }
  _onSyncState(state) {
    if (!state || state.fromUserId === this.userId) return;
    if (state.fromUserId !== this.hostId && state.action !== 'hostMigration') return;
    switch (state.action) {
      case 'sync': case 'playState': this._applyHostState(state); break;
      case 'seek': this._smoothSeek(state.time); break;
      case 'queueAdd':
        if (!this.queue.find(q => q.videoId === state.entry?.videoId)) { this.queue.push(state.entry); this._notifyQueueChange(); }
        break;
      case 'queueRemove': this.removeFromQueue(state.index); break;
      case 'queueClear': this.queue = []; this.currentIndex = -1; this._notifyQueueChange(); break;
      case 'queueReorder': this.reorderQueue(state.fromIndex, state.toIndex); break;
      case 'queueShuffle': this.shuffleQueue(); break;
      case 'skip': this._skipCurrent(); break;
      case 'repeatMode': this._repeatMode = state.enabled; this._appendSystemChat(this._repeatMode ? 'DJ enabled repeat mode' : 'DJ disabled repeat mode'); break;
      case 'voteSkip': this.skipVotes.add(state.userId); this._checkSkipVotes(); break;
      case 'chat': this._appendChatMessage(state.message); break;
      case 'whisper': if (state.message?.targetUserId === this.userId || state.message?.userId === this.userId) this._appendChatMessage(state.message); break;
      case 'emote': this._spawnEmote(state.emote); break;
      case 'seatUpdate': this._updatePeerSeat(state); break;
      case 'seatLeave': this._clearPeerSeat(state.seatIndex); break;
      case 'themeChange': this.setTheme(state.theme); break;
      case 'roomInfo':
        this.hostId = state.fromUserId;
        if (state.currentVideoId && state.currentVideoId !== this.currentVideoId) this.loadVideo(state.currentVideoId, state.isPlaying, state.currentTime || 0);
        if (state.queue?.length) { this.queue = state.queue; this.currentIndex = state.currentIndex ?? -1; this._notifyQueueChange(); }
        break;
      case 'hostMigration':
        this.hostId = state.newHostId;
        if (this.userId === state.newHostId) { this.isDJ = true; this._startSyncLoop(); this._appendSystemChat('You are now the DJ!'); }
        break;
      case 'requestState':
        if (this.isDJ) this._broadcastState({ action: 'roomInfo', currentVideoId: this.currentVideoId, currentTime: this._getCurrentTime(), isPlaying: this.isPlaying, queue: this.queue, currentIndex: this.currentIndex });
        break;
    }
    this.stateCallbacks.forEach(cb => { try { cb(state); } catch (e) {} });
  }
  _applyHostState(state) {
    if (!this.playerReady) return;
    if (state.videoId && state.videoId !== this.currentVideoId) { this.loadVideo(state.videoId, state.isPlaying, state.currentTime || 0); return; }
    if (state.isPlaying && !this.isPlaying) this.play();
    else if (!state.isPlaying && this.isPlaying) this.pause();
    if (typeof state.currentTime === 'number' && Math.abs(this._getCurrentTime() - state.currentTime) > this.opts.SEEK_THRESHOLD_S) this._smoothSeek(state.currentTime);
  }
  _smoothSeek(targetTime) { if (!this.playerReady) return; this.player.seekTo(targetTime, true); }
  _onPeerJoin(peerId) { this._appendSystemChat('A guest has joined the theatre'); this.joinCallbacks.forEach(cb => { try { cb(peerId); } catch (e) {} }); }
  _onPeerLeave(peerId) {
    for (let i = 0; i < this.seats.length; i++) { const occ = this.seatOccupants.get(i); if (occ && occ.userId === peerId) this._clearPeerSeat(i); }
    this._appendSystemChat('A guest has left the theatre');
    this.leaveCallbacks.forEach(cb => { try { cb(peerId); } catch (e) {} });
  }
  _onPeerMessage(peerId, message) { /* routed via _onSyncState */ }

  // ── INTERNAL ─ Seat Helpers ──
  _initSeats() {
    const seats = [], total = this.opts.SEAT_ROWS * this.opts.SEAT_COLS;
    for (let i = 0; i < total; i++) {
      const row = Math.floor(i / this.opts.SEAT_COLS), col = i % this.opts.SEAT_COLS;
      const x = 60 + col * (this.opts.SEAT_WIDTH + this.opts.SEAT_GAP_X);
      const y = this.opts.SEAT_OFFSET_Y + row * (this.opts.SEAT_HEIGHT + this.opts.SEAT_GAP_Y);
      seats.push({ id: i, row, col, x, y, occupied: false, occupantId: null });
    }
    return seats;
  }
  _updatePeerSeat(state) {
    const { seatIndex, userId, userName, avatar } = state;
    if (seatIndex < 0 || seatIndex >= this.seats.length) return;
    const seat = this.seats[seatIndex]; seat.occupied = true; seat.occupantId = userId;
    this.seatOccupants.set(seatIndex, { userId, name: userName, avatar });
    this._renderSeats();
  }
  _clearPeerSeat(seatIndex) {
    if (seatIndex < 0 || seatIndex >= this.seats.length) return;
    const seat = this.seats[seatIndex]; seat.occupied = false; seat.occupantId = null;
    this.seatOccupants.delete(seatIndex); this._renderSeats();
  }
  _handleSeatClick(seatIndex) { if (this.mySeatId === seatIndex) this.standUp(); else this.sitInSeat(seatIndex); }

  // ── INTERNAL ─ Canvas & Rendering ──
  _injectStyles() {
    if (document.getElementById('theatre-styles')) return;
    const style = document.createElement('style');
    style.id = 'theatre-styles';
    style.textContent = `
      .theatre-container { position: relative; width: 100%; height: 100%; background: var(--theatre-bg, #0f0f1a); overflow: hidden; border-radius: 12px; }
      .theatre-container.theatre-fullscreen-active { border-radius: 0; }
      .theatre-container.theatre-atmosphere-off .theatre-screen-glow { display: none; }
      .theatre-container.theatre-atmosphere-off canvas { filter: none !important; }
      .theatre-chat-msg.whisper { background: rgba(100,100,255,0.1); border-left: 2px solid #6464ff; }
      .theatre-progress-bar.hidden { opacity: 0; pointer-events: none; }
      .theatre-controls.hidden { opacity: 0; pointer-events: none; }
      .theatre-queue-item.current .theatre-queue-title { color: #e94560; }
      .theatre-screen-glow { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); width: 440px; height: 340px; border-radius: 20px; pointer-events: none; opacity: 0; transition: opacity 0.5s ease; }
      .theatre-container:has(.theatre-youtube-wrap iframe) .theatre-screen-glow { opacity: 1; box-shadow: 0 0 60px rgba(233,69,96,0.2), 0 0 120px rgba(233,69,96,0.1); }
      .theatre-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
      .theatre-youtube-wrap { position: absolute; top: 40px; left: 50%; transform: translateX(-50%); width: 400px; height: 300px; z-index: 2; }
      .theatre-controls { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.6); padding: 8px 16px; border-radius: 24px; z-index: 10; opacity: 1; transition: opacity 0.3s; }
      .theatre-controls.hidden { opacity: 0; pointer-events: none; }
      .theatre-btn { background: rgba(255,255,255,0.1); border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
      .theatre-btn:hover { background: rgba(255,255,255,0.25); }
      .theatre-volume { width: 80px; accent-color: #e94560; }
      .theatre-time { color: #ccc; font-size: 12px; font-family: monospace; min-width: 90px; text-align: center; }
      .theatre-queue-panel, .theatre-chat-panel { position: absolute; right: 12px; background: rgba(15,15,26,0.95); border: 1px solid #2a2a3e; border-radius: 8px; width: 280px; max-height: 400px; overflow-y: auto; z-index: 20; padding: 12px; color: #ddd; }
      .theatre-queue-panel { top: 12px; } .theatre-chat-panel { bottom: 60px; }
      .theatre-queue-panel h3, .theatre-chat-panel h3 { margin: 0 0 8px; font-size: 14px; color: #e94560; }
      .theatre-queue-list, .theatre-chat-list { list-style: none; padding: 0; margin: 0; max-height: 280px; overflow-y: auto; font-size: 12px; }
      .theatre-queue-item { display: flex; align-items: center; gap: 8px; padding: 6px; border-radius: 4px; cursor: pointer; }
      .theatre-queue-item.current { background: rgba(233,69,96,0.15); }
      .theatre-queue-item:hover { background: rgba(255,255,255,0.05); }
      .theatre-queue-title { font-weight: 600; color: #fff; }
      .theatre-queue-meta { color: #888; font-size: 10px; }
      .theatre-search-input { background: rgba(255,255,255,0.1); border: 1px solid #3a3a5a; border-radius: 4px; color: #fff; padding: 6px; width: 180px; font-size: 12px; }
      .theatre-chat-input { background: rgba(255,255,255,0.1); border: 1px solid #3a3a5a; border-radius: 4px; color: #fff; padding: 6px; width: 180px; font-size: 12px; }
      .theatre-chat-msg { padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .theatre-chat-msg.system { color: #e94560; font-style: italic; }
      .theatre-chat-msg.mine { background: rgba(233,69,96,0.1); border-radius: 4px; padding: 4px; }
      .theatre-chat-name { color: #e94560; font-weight: 600; font-size: 11px; }
      .theatre-chat-time { color: #666; font-size: 10px; margin-left: 4px; }
      .theatre-emote-bar { display: flex; gap: 6px; margin-top: 8px; justify-content: center; }
      .theatre-emote-bar button { background: rgba(255,255,255,0.1); border: none; border-radius: 4px; cursor: pointer; font-size: 16px; padding: 4px 8px; }
      .theatre-emote-bar button:hover { background: rgba(255,255,255,0.2); }
      .theatre-toggle-queue, .theatre-toggle-chat { position: absolute; right: 12px; width: 36px; height: 36px; border-radius: 50%; background: rgba(0,0,0,0.5); border: 1px solid #3a3a5a; color: #fff; cursor: pointer; z-index: 15; font-size: 16px; }
      .theatre-toggle-queue { top: 12px; } .theatre-toggle-chat { top: 56px; }
      .theatre-toggle-chat[data-badge]::after { content: attr(data-badge); position: absolute; top: -4px; right: -4px; background: #e94560; color: #fff; font-size: 10px; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
      .theatre-search-item { display: flex; gap: 8px; padding: 6px; cursor: pointer; border-radius: 4px; }
      .theatre-connection-status { position: absolute; top: 12px; left: 12px; background: rgba(0,0,0,0.6); color: #ccc; padding: 4px 10px; border-radius: 12px; font-size: 11px; z-index: 25; }
      .theatre-chat-msg.whisper { background: rgba(100,100,255,0.1); border-left: 2px solid #6464ff; }
      .theatre-search-item img { border-radius: 4px; }
      .theatre-progress-bar { position: absolute; bottom: 52px; left: 50%; transform: translateX(-50%); width: 400px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; cursor: pointer; z-index: 10; }
      .theatre-progress-fill { height: 100%; background: #e94560; border-radius: 2px; width: 0%; transition: width 0.1s linear; }
      .theatre-buffering { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #e94560; font-size: 14px; z-index: 15; background: rgba(0,0,0,0.7); padding: 8px 16px; border-radius: 20px; }
      .theatre-seat-tooltip { position: absolute; background: rgba(0,0,0,0.8); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 11px; pointer-events: none; z-index: 30; white-space: nowrap; }
    `;
    document.head.appendChild(style);
  }
  _removeStyles() { const s = document.getElementById('theatre-styles'); if (s) s.remove(); }

  _buildDOM() {
    const c = this.containerEl;
    c.classList.add('theatre-container');
    c.innerHTML = `
      <div class="theatre-screen-glow"></div>
      <canvas class="theatre-canvas" width="600" height="600"></canvas>
      <div class="theatre-youtube-wrap"><div class="theatre-youtube-player"></div></div>
      <div class="theatre-progress-bar"><div class="theatre-progress-fill"></div></div>
      <div class="theatre-buffering" hidden>⏳ Buffering...</div>
      <div class="theatre-ui-layer">
        <div class="theatre-controls">
          <button class="theatre-btn theatre-playpause" title="Play/Pause (Space)"><span class="icon-play">▶</span><span class="icon-pause" hidden>⏸</span></button>
          <button class="theatre-btn theatre-skip" title="Vote Skip">⏭</button>
          <button class="theatre-btn theatre-mute" title="Mute (M)">🔊</button>
          <input type="range" class="theatre-volume" min="0" max="100" value="${this.playerVolume}"/>
          <span class="theatre-time">0:00 / 0:00</span>
          <button class="theatre-btn theatre-fullscreen" title="Fullscreen (F)">⛶</button>
        </div>
        <div class="theatre-queue-panel" hidden>
          <h3>Queue</h3><ul class="theatre-queue-list"></ul>
          <div class="theatre-queue-add"><input type="text" class="theatre-search-input" placeholder="Search YouTube..."/><button class="theatre-btn theatre-search-btn">🔍</button></div>
          <div class="theatre-search-results" hidden></div>
        </div>
        <div class="theatre-chat-panel" hidden>
          <h3>Theatre Chat</h3><ul class="theatre-chat-list"></ul>
          <div class="theatre-chat-input-wrap"><input type="text" class="theatre-chat-input" placeholder="Say something..."/><button class="theatre-btn theatre-chat-send">Send</button></div>
          <div class="theatre-emote-bar">
            <button data-emote="clap" title="Clap">👏</button><button data-emote="boo" title="Boo">😒</button>
            <button data-emote="popcorn" title="Popcorn">🍿</button><button data-emote="laugh" title="Laugh">😂</button>
            <button data-emote="dance" title="Dance">💃</button>
          </div>
        </div>
      </div>
      <button class="theatre-toggle-queue" title="Toggle Queue">📋</button>
      <button class="theatre-toggle-chat" title="Toggle Chat">💬</button>
    `;
    this.canvas = c.querySelector('.theatre-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.screenGlowEl = c.querySelector('.theatre-screen-glow');
    this.youtubeContainer = c.querySelector('.theatre-youtube-player');
    this.uiLayer = c.querySelector('.theatre-ui-layer');
    this.controlsEl = c.querySelector('.theatre-controls');
    this.queueEl = c.querySelector('.theatre-queue-panel');
    this.chatEl = c.querySelector('.theatre-chat-panel');
    this.progressEl = c.querySelector('.theatre-progress-bar');
    this.bufferingEl = c.querySelector('.theatre-buffering');
  }
  _initCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr; this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr); this._renderFrame();
  }
  _bindEvents() {
    this.canvas.addEventListener('click', this._handleCanvasClick);
    this.canvas.addEventListener('mousemove', this._handleCanvasMouseMove);
    this.canvas.addEventListener('mouseleave', () => this._hideSeatTooltip());
    this.resizeObserver = new ResizeObserver(this._onResize);
    this.resizeObserver.observe(this.containerEl);
    document.addEventListener('fullscreenchange', this._onFullscreenChange);
    this.controlsEl.querySelector('.theatre-playpause').addEventListener('click', () => this.togglePlay());
    this.controlsEl.querySelector('.theatre-skip').addEventListener('click', () => this.voteSkip());
    this.controlsEl.querySelector('.theatre-mute').addEventListener('click', () => this.toggleMute());
    this.controlsEl.querySelector('.theatre-fullscreen').addEventListener('click', () => this.toggleFullscreen());
    this.controlsEl.querySelector('.theatre-volume').addEventListener('input', e => this.setVolume(e.target.value));
    this.containerEl.querySelector('.theatre-toggle-queue').addEventListener('click', () => { this.queueEl.hidden = !this.queueEl.hidden; });
    this.containerEl.querySelector('.theatre-toggle-chat').addEventListener('click', () => {
      this.chatEl.hidden = !this.chatEl.hidden; this.isChatOpen = !this.chatEl.hidden;
      if (this.isChatOpen) { this.unreadCount = 0; this._updateChatBadge(); }
    });
    const searchInput = this.queueEl.querySelector('.theatre-search-input');
    const searchBtn = this.queueEl.querySelector('.theatre-search-btn');
    const searchHandler = async () => { const results = await this.searchYouTube(searchInput.value, this.opts.YOUTUBE_API_KEY); this._renderSearchResults(results); };
    searchBtn.addEventListener('click', searchHandler);
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchHandler(); });
    const chatInput = this.chatEl.querySelector('.theatre-chat-input');
    this.chatEl.querySelector('.theatre-chat-send').addEventListener('click', () => { this.sendChat(chatInput.value); chatInput.value = ''; });
    chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') { this.sendChat(chatInput.value); chatInput.value = ''; } });
    this.chatEl.querySelectorAll('.theatre-emote-bar button').forEach(btn => { btn.addEventListener('click', () => this.sendEmote(btn.dataset.emote)); });
    // Progress bar scrubbing
    this.progressEl.addEventListener('click', (e) => {
      const rect = this.progressEl.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      const dur = this.getDuration();
      if (dur > 0) this.seek(pct * dur);
    });
    // Auto-hide controls on inactivity
    this.containerEl.addEventListener('mousemove', () => this._showControls());
    this.containerEl.addEventListener('click', () => this._showControls());
    document.addEventListener('keydown', this._onKeydown = (e) => {
      if (e.target.matches('input, textarea')) return;
      switch (e.code) {
        case 'Space': e.preventDefault(); this.togglePlay(); break;
        case 'ArrowRight': this.seek(this._getCurrentTime() + 5); break;
        case 'ArrowLeft': this.seek(Math.max(0, this._getCurrentTime() - 5)); break;
        case 'ArrowUp': this.setVolume(this.playerVolume + 5); break;
        case 'ArrowDown': this.setVolume(this.playerVolume - 5); break;
        case 'KeyF': this.toggleFullscreen(); break;
        case 'KeyM': this.toggleMute(); break;
        case 'KeyQ': this.queueEl.hidden = !this.queueEl.hidden; break;
        case 'KeyC': this.chatEl.hidden = !this.chatEl.hidden; this.isChatOpen = !this.chatEl.hidden; if (this.isChatOpen) { this.unreadCount = 0; this._updateChatBadge(); } break;
      }
    });
  }
  _unbindEvents() {
    this.canvas?.removeEventListener('click', this._handleCanvasClick);
    this.canvas?.removeEventListener('mousemove', this._handleCanvasMouseMove);
    this.resizeObserver?.disconnect();
    document.removeEventListener('fullscreenchange', this._onFullscreenChange);
    document.removeEventListener('keydown', this._onKeydown);
  }
  _onResize() {
    const rect = this.containerEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr; this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this._renderFrame();
  }
  _onFullscreenChange() {
    this.isFullscreen = !!document.fullscreenElement;
    this.containerEl.classList.toggle('theatre-fullscreen-active', this.isFullscreen);
    setTimeout(() => this._onResize(), 100);
  }
  _startAnimationLoop() { this._lastFrameTime = performance.now(); this._rafId = requestAnimationFrame(this._animate); }
  _stopAnimationLoop() { if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; } }
  _animate(now) {
    const dt = now - this._lastFrameTime; this._lastFrameTime = now;
    this._glowPhase += dt * 0.002;
    this._updateEmotes(dt); this._updateTimeDisplay(); this._updateProgressBar(); this._renderFrame();
    this._rafId = requestAnimationFrame(this._animate);
  }
  _renderFrame() {
    const ctx = this.ctx;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = THEMES[this._theme] || '#0f0f1a'; ctx.fillRect(0, 0, w, h);
    if (this.isPlaying && this._atmosphereEnabled) {
      const glowAlpha = 0.08 + Math.sin(this._glowPhase) * 0.04;
      ctx.save();
      ctx.shadowColor = this.opts.TV_FRAME_ACCENT;
      ctx.shadowBlur = this.opts.GLOW_INTENSITY + Math.sin(this._glowPhase * 1.3) * 10;
      ctx.fillStyle = `rgba(233,69,96,${glowAlpha})`;
      const gx = (w - this.opts.SCREEN_WIDTH) / 2 - this.opts.TV_BEZEL;
      const gy = 40 - this.opts.TV_BEZEL;
      ctx.fillRect(gx, gy, this.opts.SCREEN_WIDTH + this.opts.TV_BEZEL * 2, this.opts.SCREEN_HEIGHT + this.opts.TV_BEZEL * 2);
      ctx.restore();
    }
    const fx = (w - this.opts.SCREEN_WIDTH) / 2, fy = 40;
    this._drawTVFrame(ctx, fx, fy, this.opts.SCREEN_WIDTH, this.opts.SCREEN_HEIGHT);
    this._positionYouTubePlayer(fx, fy);
    this._drawSeats(ctx); this._drawEmotes(ctx); this._drawCustomEmotes(ctx); this._drawAmbientParticles(ctx, w, h);
    this._renderConnectionStatus();
  }
  _drawTVFrame(ctx, x, y, sw, sh) {
    const b = this.opts.TV_BEZEL;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
    ctx.fillStyle = this.opts.TV_FRAME_COLOR;
    this._roundRect(ctx, x - b, y - b, sw + b * 2, sh + b * 2, 12); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = this.opts.TV_FRAME_ACCENT; ctx.lineWidth = 2;
    this._roundRect(ctx, x - b + 4, y - b + 4, sw + b * 2 - 8, sh + b * 2 - 8, 10); ctx.stroke();
    if (!this.currentVideoId) {
      ctx.fillStyle = '#050510'; ctx.fillRect(x, y, sw, sh);
      ctx.fillStyle = '#333'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Starlight Inn Theatre', x + sw / 2, y + sh / 2 - 10);
      ctx.font = '12px sans-serif'; ctx.fillStyle = '#666';
      ctx.fillText('Add a video to start the show', x + sw / 2, y + sh / 2 + 12);
    }
    const legW = 8, legH = 30;
    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(x + sw * 0.25 - legW / 2, y + sh + b, legW, legH);
    ctx.fillRect(x + sw * 0.75 - legW / 2, y + sh + b, legW, legH);
    ctx.fillStyle = '#1a1a2e'; const baseW = sw * 0.6, baseH = 6;
    this._roundRect(ctx, x + (sw - baseW) / 2, y + sh + b + legH, baseW, baseH, 3); ctx.fill();
    ctx.fillStyle = this.isPlaying ? '#0f0' : (this.isBuffering ? '#ff0' : '#f00');
    ctx.beginPath(); ctx.arc(x + sw - 12, y + sh - 12, 3, 0, Math.PI * 2); ctx.fill();
  }
  _positionYouTubePlayer(fx, fy) {
    if (!this.youtubeContainer) return;
    const iframe = this.youtubeContainer.querySelector('iframe');
    if (iframe) { iframe.style.position = 'absolute'; iframe.style.left = fx + 'px'; iframe.style.top = fy + 'px'; iframe.style.width = this.opts.SCREEN_WIDTH + 'px'; iframe.style.height = this.opts.SCREEN_HEIGHT + 'px'; iframe.style.borderRadius = '4px'; }
  }
  _drawSeats(ctx) {
    for (const seat of this.seats) {
      const { x, y, occupied, id } = seat; const isMine = (id === this.mySeatId);
      ctx.save();
      ctx.fillStyle = occupied ? (isMine ? '#e94560' : '#4a4a6a') : '#2a2a3e';
      this._roundRect(ctx, x, y, this.opts.SEAT_WIDTH, this.opts.SEAT_HEIGHT, 8); ctx.fill();
      ctx.strokeStyle = occupied ? (isMine ? '#ff6b81' : '#6a6a8a') : '#3a3a5a'; ctx.lineWidth = 2;
      this._roundRect(ctx, x, y, this.opts.SEAT_WIDTH, this.opts.SEAT_HEIGHT, 8); ctx.stroke();
      if (occupied) {
        const occ = this.seatOccupants.get(id);
        ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(occ?.avatar ? '👤' : (isMine ? '🙂' : '👤'), x + this.opts.SEAT_WIDTH / 2, y + this.opts.SEAT_HEIGHT / 2 - 4);
        ctx.font = '9px sans-serif'; ctx.fillStyle = isMine ? '#ffccd5' : '#aaa';
        const name = occ?.name || (isMine ? this.userName : 'Guest');
        ctx.fillText(name.length > 8 ? name.slice(0, 7) + '…' : name, x + this.opts.SEAT_WIDTH / 2, y + this.opts.SEAT_HEIGHT - 6);
      } else {
        ctx.fillStyle = '#444'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${id + 1}`, x + this.opts.SEAT_WIDTH / 2, y + this.opts.SEAT_HEIGHT / 2);
      }
      ctx.restore();
    }
  }
  _drawEmotes(ctx) {
    for (const emote of this.activeEmotes) {
      ctx.save(); ctx.globalAlpha = emote.opacity;
      ctx.font = `${24 * emote.scale}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(emote.icon, emote.x, emote.y); ctx.restore();
    }
  }
  _updateEmotes(dt) {
    for (let i = this.activeEmotes.length - 1; i >= 0; i--) {
      const em = this.activeEmotes[i]; em.elapsed = (em.elapsed || 0) + dt;
      const progress = Math.min(em.elapsed / em.duration, 1);
      em.y -= dt * 0.04;
      if (progress > 0.7) em.opacity = 1 - (progress - 0.7) / 0.3;
      if (progress < 0.15) em.scale = 0.5 + (progress / 0.15) * 0.5;
      if (progress >= 1) this.activeEmotes.splice(i, 1);
    }
  }
  _spawnEmote(emoteData) {
    const emote = { ...emoteData, x: 100 + Math.random() * 400, y: 200 + Math.random() * 150, elapsed: 0, opacity: 1, scale: 0.5 };
    this.activeEmotes.push(emote);
    this.emoteCallbacks.forEach(cb => { try { cb(emote); } catch (e) {} });
  }
  _drawAmbientParticles(ctx, w, h) {
    if (!this._atmosphereEnabled) return;
    const t = performance.now() * 0.001; ctx.save(); ctx.fillStyle = 'rgba(255,200,150,0.03)';
    for (let i = 0; i < 20; i++) {
      const px = ((i * 137.5 + t * 10) % w);
      const py = ((i * 73.3 + Math.sin(t + i) * 30 + 400) % (h - 200)) + 200;
      const size = 1 + Math.sin(t * 2 + i) * 1;
      ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  _handleCanvasClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left), my = (e.clientY - rect.top);
    for (const seat of this.seats) {
      if (mx >= seat.x && mx <= seat.x + this.opts.SEAT_WIDTH && my >= seat.y && my <= seat.y + this.opts.SEAT_HEIGHT) {
        this._handleSeatClick(seat.id); return;
      }
    }
  }
  _handleCanvasMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left), my = (e.clientY - rect.top);
    for (const seat of this.seats) {
      if (mx >= seat.x && mx <= seat.x + this.opts.SEAT_WIDTH && my >= seat.y && my <= seat.y + this.opts.SEAT_HEIGHT) {
        const occ = this.seatOccupants.get(seat.id);
        const label = occ ? `${occ.name} (Seat ${seat.id + 1})` : `Seat ${seat.id + 1} — Click to sit`;
        this._showSeatTooltip(e.clientX, e.clientY, label); return;
      }
    }
    this._hideSeatTooltip();
  }
  _showSeatTooltip(x, y, text) {
    let tip = this.containerEl.querySelector('.theatre-seat-tooltip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'theatre-seat-tooltip'; this.containerEl.appendChild(tip); }
    tip.textContent = text; tip.style.left = (x + 12) + 'px'; tip.style.top = (y - 24) + 'px'; tip.hidden = false;
  }
  _hideSeatTooltip() {
    const tip = this.containerEl.querySelector('.theatre-seat-tooltip');
    if (tip) tip.hidden = true;
  }
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  // ── INTERNAL ─ Controls Auto-Hide ──
  _showControls() {
    this.controlsEl?.classList.remove('hidden');
    this.progressEl?.classList.remove('hidden');
    if (this._controlsHideTimer) clearTimeout(this._controlsHideTimer);
    this._controlsHideTimer = setTimeout(() => {
      if (this.isPlaying && !this.isChatOpen && this.queueEl?.hidden) {
        this.controlsEl?.classList.add('hidden');
        this.progressEl?.classList.add('hidden');
      }
    }, this.opts.CONTROLS_HIDE_DELAY_MS);
  }

  // ── INTERNAL ─ UI Updates ──
  _updatePlayButtonUI() {
    const btn = this.controlsEl?.querySelector('.theatre-playpause'); if (!btn) return;
    btn.querySelector('.icon-play').hidden = this.isPlaying;
    btn.querySelector('.icon-pause').hidden = !this.isPlaying;
  }
  _updateVolumeUI() { const slider = this.controlsEl?.querySelector('.theatre-volume'); if (slider) slider.value = this.playerVolume; }
  _updateTimeDisplay() {
    if (!this.controlsEl) return;
    const timeEl = this.controlsEl.querySelector('.theatre-time');
    if (!timeEl || !this.playerReady) return;
    timeEl.textContent = `${this._fmtTime(this._getCurrentTime())} / ${this._fmtTime(this.getDuration())}`;
  }
  _updateProgressBar() {
    if (!this.progressEl) return;
    const fill = this.progressEl.querySelector('.theatre-progress-fill');
    const dur = this.getDuration(), cur = this._getCurrentTime();
    if (dur > 0) fill.style.width = (cur / dur * 100) + '%';
  }
  _updateChatBadge() {
    const btn = this.containerEl?.querySelector('.theatre-toggle-chat');
    if (!btn) return; btn.dataset.badge = this.unreadCount > 0 ? String(this.unreadCount) : '';
  }
  _renderSeats() { if (!this._rafId) this._renderFrame(); }
  _renderSearchResults(results) {
    const container = this.queueEl.querySelector('.theatre-search-results');
    if (!results.length) { container.hidden = true; return; }
    container.innerHTML = results.map(r => `
      <div class="theatre-search-item" data-videoid="${r.videoId}">
        <img src="${r.thumbnail}" alt="" loading="lazy" width="80" height="60"/>
        <div class="theatre-search-info"><div class="theatre-search-title">${this._escapeHtml(r.title)}</div><button class="theatre-btn theatre-add-btn">+ Add</button></div>
      </div>
    `).join(''); container.hidden = false;
    container.querySelectorAll('.theatre-add-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => { this.addToQueue(results[idx]); container.hidden = true; });
    });
  }
  _renderQueue() {
    const list = this.queueEl?.querySelector('.theatre-queue-list'); if (!list) return;
    list.innerHTML = this.queue.map((entry, idx) => {
      const isCurrent = idx === this.currentIndex;
      const dur = this._fmtTime(entry.duration || 0);
      return `<li class="theatre-queue-item ${isCurrent ? 'current' : ''}" data-index="${idx}">
        <img src="${entry.thumbnail}" alt="" loading="lazy" width="40" height="30"/>
        <div class="theatre-queue-info"><div class="theatre-queue-title">${this._escapeHtml(entry.title)}</div><div class="theatre-queue-meta">${dur} · by ${this._escapeHtml(entry.requestedBy)}</div></div>
        ${this.isDJ ? `<button class="theatre-btn theatre-remove-btn" data-index="${idx}">×</button>` : ''}
      </li>`;
    }).join('');
    if (this.isDJ) list.querySelectorAll('.theatre-remove-btn').forEach(btn => { btn.addEventListener('click', () => this.removeFromQueue(Number(btn.dataset.index))); });
    // Click any queue item to play it (DJ only)
    list.querySelectorAll('.theatre-queue-item').forEach((item, idx) => {
      item.addEventListener('dblclick', () => {
        if (this.isDJ) {
          this.currentIndex = idx;
          this.loadVideo(this.queue[idx].videoId, true, 0);
          this._appendSystemChat(`DJ started: ${this.queue[idx].title}`);
        }
      });
    });
  }

  // ── INTERNAL ─ Chat Helpers ──
  _appendChatMessage(msg) {
    this.chatMessages.push(msg);
    if (this.chatMessages.length > this.opts.CHAT_MAX_MESSAGES) this.chatMessages.shift();
    this._renderChat();
    if (!this.isChatOpen) { this.unreadCount++; this._updateChatBadge(); }
    this.chatCallbacks.forEach(cb => { try { cb(msg); } catch (e) {} });
  }
  _appendSystemChat(text) {
    this._appendChatMessage({ id: this._generateMessageId(), userId: 'system', userName: 'Theatre', text, timestamp: Date.now(), type: 'system' });
  }
  _renderChat() {
    const list = this.chatEl?.querySelector('.theatre-chat-list'); if (!list) return;
    list.innerHTML = this.chatMessages.map(m => {
      const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isSystem = m.type === 'system'; const isMe = m.userId === this.userId;
      const isWhisper = m.type === 'whisper';
      return `<li class="theatre-chat-msg ${isSystem ? 'system' : ''} ${isMe ? 'mine' : ''} ${isWhisper ? 'whisper' : ''}">
        ${!isSystem ? `<span class="theatre-chat-name">${this._escapeHtml(m.userName)}${isWhisper ? ' (whisper)' : ''}</span>` : ''}
        <span class="theatre-chat-time">${time}</span><span class="theatre-chat-text">${this._escapeHtml(m.text)}</span>
      </li>`;
    }).join('');
    list.scrollTop = list.scrollHeight;
  }

  // ── INTERNAL ─ Skip Logic ──
  _checkSkipVotes() {
    const count = this.skipVotes.size;
    if (count >= this.opts.SKIP_VOTES_NEEDED) { this._appendSystemChat(`Skip vote passed (${count} votes)! Skipping...`); this._skipCurrent(); }
    else this._appendSystemChat(`Skip vote: ${count}/${this.opts.SKIP_VOTES_NEEDED}`);
  }

  // ── INTERNAL ─ Notifications ──
  _notifyQueueChange() { this._renderQueue(); this.queueCallbacks.forEach(cb => { try { cb([...this.queue], this.currentIndex); } catch (e) {} }); }

  // ── INTERNAL ─ Mock Data & Utilities ──
  _mockSearchResults(query) {
    const demos = [
      { videoId: 'jfKfPfyJRdk', title: 'Lofi Girl - Study Beats', duration: 0, thumbnail: '' },
      { videoId: '5qap5aO4i9A', title: 'Lofi Hip Hop Radio', duration: 0, thumbnail: '' },
      { videoId: 'rUxyKA_-grg', title: 'Relaxing Jazz Music', duration: 0, thumbnail: '' },
      { videoId: 'LXb3EKWsInQ', title: 'Nature Documentary HD', duration: 0, thumbnail: '' },
      { videoId: 'b1Fo_M_tj6w', title: 'Classic Cartoons Compilation', duration: 0, thumbnail: '' },
      { videoId: 'M7lc1UVf-VE', title: 'YouTube Developers Intro', duration: 0, thumbnail: '' },
    ];
    const lowerQ = query.toLowerCase();
    return demos.filter(d => d.title.toLowerCase().includes(lowerQ) || lowerQ.length < 3).map(d => ({ ...d, thumbnail: d.thumbnail || `https://i.ytimg.com/vi/${d.videoId}/mqdefault.jpg` }));
  }
  async _fetchVideoMeta(videoId) {
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (res.ok) { const data = await res.json(); return { title: data.title, author: data.author_name }; }
    } catch (e) {}
    return { title: 'Unknown Video', author: '' };
  }
  _generateUserId() { return 'u_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4); }
  _generateMessageId() { return 'm_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
  _fmtTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60), h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  _escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
  _playEmoteSound(soundName) { /* Stub: integrate with AudioSystem */ }
  _log(...args) { if (this._debug) console.log('[Theatre]', ...args); }
}
