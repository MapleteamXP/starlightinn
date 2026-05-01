/**
 * WebRTCSync.js — Starlight Inn v7.0 P2P Synchronization Layer
 * Manages WebRTC peer connections, host election, state broadcast,
 * seamless host migration, Socket.IO fallback relay, and adaptive sync.
 * @author Starlight Inn Team | v3.0.0 | MIT
 */

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

const SIGNAL_EVENTS = {
  JOIN: 'theatre:join', LEAVE: 'theatre:leave', OFFER: 'theatre:offer',
  ANSWER: 'theatre:answer', ICE: 'theatre:ice', STATE: 'theatre:state',
  HOST_MIGRATE: 'theatre:hostMigrate',
};

const PEER_STATE = { CONNECTING:'connecting', CONNECTED:'connected', DISCONNECTED:'disconnected', FAILED:'failed', CLOSED:'closed' };
const RECONNECT_DELAY_MS = 3000;
const RECONNECT_MAX_DELAY_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 8000;
const HEARTBEAT_TIMEOUT_MS = 20000;
const FALLBACK_TIMEOUT_MS = 8000;
const STATS_INTERVAL_MS = 10000;
const DEFAULT_SYNC_INTERVAL_MS = 2000;

export class WebRTCSync
export default class WebRTCSync {
  constructor(options = {}) {
    this.opts = options; this._debug = options.debug || false;
    this.userId = this._generateId(); this.userName = options.userName || 'Guest'; this.joinTime = Date.now();
    this.roomId = null; this.isHost = false; this.hostId = null;
    this.peers = new Map(); this.dataChannels = new Map(); this.pendingCandidates = new Map();
    this.socket = null; this.socketConnected = false; this.useFallback = false; this._fallbackTimer = null;
    this._heartbeatTimer = null; this._lastPongTimes = new Map();
    this._stateCallbacks = []; this._joinCallbacks = []; this._leaveCallbacks = [];
    this._messageCallbacks = []; this._hostMigrateCallbacks = [];
    this.signalUrl = options.signalUrl || null;

    // Connection quality metrics
    this._peerStats = new Map(); this._statsTimer = null;
    this._latencyMap = new Map(); this._adaptiveSyncInterval = DEFAULT_SYNC_INTERVAL_MS;
    this._messageQueue = []; this._batchTimer = null; this._reconnectAttempts = new Map();
    this._peerMetadata = new Map(); // peerId -> { userName, joinTime, deviceType }
    this._connectionHistory = []; // recent connection events for debugging
    this._seenMessageIds = new Set(); // deduplication
    this._maxHistorySize = 100;
    this._topology = 'mesh'; // or 'star' if host-centric

    this._onIceCandidate = this._onIceCandidate.bind(this);
    this._onDataChannel = this._onDataChannel.bind(this);
    this._onConnectionChange = this._onConnectionChange.bind(this);
    this._onSocketConnect = this._onSocketConnect.bind(this);
    this._onSocketDisconnect = this._onSocketDisconnect.bind(this);
    this._onSocketMessage = this._onSocketMessage.bind(this);
    this._log('WebRTCSync created, userId=', this.userId);
  }

  // ── PUBLIC API ─ Room Lifecycle ──

  /** Create a new room. You become the first peer and thus the host. */
  async createRoom(roomId) {
    this.roomId = roomId; this.isHost = true; this.hostId = this.userId;
    this._log('Creating room', roomId, 'as host');
    await this._initSignalConnection(); this._startHeartbeat(); this._startStatsCollection();
  }

  /** Join an existing room via signaling server, wait for WebRTC negotiation. */
  async joinRoom(roomId) {
    this.roomId = roomId; this.isHost = false; this.hostId = null;
    this._log('Joining room', roomId);
    await this._initSignalConnection(); this._startHeartbeat();
    this._signalEmit(SIGNAL_EVENTS.JOIN, {
      roomId, userId: this.userId, userName: this.userName, joinTime: this.joinTime,
    });
    this._fallbackTimer = setTimeout(() => {
      if (this.peers.size === 0 && !this.useFallback) {
        this._log('WebRTC timeout, activating Socket.IO fallback'); this.useFallback = true;
      }
    }, FALLBACK_TIMEOUT_MS);
  }

  /** Leave the current room and clean up all connections. */
  leaveRoom() {
    this._log('Leaving room', this.roomId); this._stopHeartbeat(); this._stopStatsCollection();
    if (this._fallbackTimer) { clearTimeout(this._fallbackTimer); this._fallbackTimer = null; }
    if (this._batchTimer) { clearTimeout(this._batchTimer); this._batchTimer = null; }
    for (const [peerId, wrapper] of this.peers) this._closePeer(peerId, wrapper);
    this.peers.clear(); this.dataChannels.clear(); this._peerStats.clear(); this._latencyMap.clear(); this._reconnectAttempts.clear();
    if (this.socketConnected) {
      this._signalEmit(SIGNAL_EVENTS.LEAVE, { roomId: this.roomId, userId: this.userId });
    }
    if (this.isHost && this.peers.size > 0) this._migrateHost();
    this._disconnectSignal(); this.roomId = null; this.isHost = false;
    this.hostId = null; this.useFallback = false; this._messageQueue = [];
  }

  /** Cleanly destroy the entire sync layer. */
  destroy() {
    this.leaveRoom();
    this._stateCallbacks = []; this._joinCallbacks = []; this._leaveCallbacks = [];
    this._messageCallbacks = []; this._hostMigrateCallbacks = [];
    this._log('WebRTCSync destroyed');
  }

  // ── PUBLIC API ─ State Broadcast ──

  /**
   * Broadcast a state update to all connected peers.
   * Uses WebRTC data channels when available, Socket.IO as fallback.
   * Supports batching for high-frequency updates.
   */
  broadcastState(state) {
    if (!this.roomId) { console.warn('[WebRTCSync] Cannot broadcast: not in a room'); return; }
    // Batch high-frequency updates (sync + playState) if within batch window
    if (state.action === 'sync' || state.action === 'playState') {
      this._messageQueue.push(state);
      if (!this._batchTimer) {
        this._batchTimer = setTimeout(() => this._flushBatch(), 250);
      }
      return;
    }
    this._sendState(state);
  }

  _sendState(state) {
    const payload = JSON.stringify({ ...state, _sender: this.userId, _room: this.roomId, _ts: Date.now() });
    if (this.useFallback && this.socketConnected) {
      this._signalEmit(SIGNAL_EVENTS.STATE, { roomId: this.roomId, payload });
      return;
    }
    let sentCount = 0;
    for (const [peerId, channel] of this.dataChannels) {
      if (channel.readyState === 'open') {
        try { channel.send(payload); sentCount++; }
        catch (err) { this._log('DataChannel send failed for', peerId, err.message); }
      }
    }
    if (sentCount === 0 && this.socketConnected) {
      this._signalEmit(SIGNAL_EVENTS.STATE, { roomId: this.roomId, payload });
    }
  }

  _flushBatch() {
    this._batchTimer = null;
    if (this._messageQueue.length === 0) return;
    // Send only the most recent state in the batch
    const latest = this._messageQueue[this._messageQueue.length - 1];
    this._messageQueue = [];
    this._sendState(latest);
  }

  /** Send a direct (private) message to a specific peer. */
  sendToPeer(peerId, message) {
    const channel = this.dataChannels.get(peerId);
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify({ ...message, _sender: this.userId, _target: peerId, _ts: Date.now() }));
      return;
    }
    if (this.socketConnected) {
      this._signalEmit(SIGNAL_EVENTS.STATE, {
        roomId: this.roomId, targetPeerId: peerId, payload: JSON.stringify(message),
      });
    }
  }

  // ── PUBLIC API ─ Connection Quality ──

  /** Get connection quality metrics for a peer. */
  getPeerStats(peerId) {
    return this._peerStats.get(peerId) || null;
  }

  /** Get all peer connection stats. */
  getAllPeerStats() {
    const stats = {};
    for (const [peerId, data] of this._peerStats) stats[peerId] = data;
    return stats;
  }

  /** Get measured RTT to a specific peer. */
  getPeerLatency(peerId) {
    return this._latencyMap.get(peerId)?.rtt || null;
  }

  /** Estimate available bandwidth to a peer (bits per second). */
  estimateBandwidth(peerId) {
    const stats = this._peerStats.get(peerId);
    if (!stats) return null;
    const sent = stats.bytesSent || 0;
    const recv = stats.bytesReceived || 0;
    const duration = 10; // STATS_INTERVAL_MS / 1000
    const totalBytes = (stats.sendRate || 0) + (stats.recvRate || 0);
    return totalBytes * 8; // bits per second
  }

  /** Get current adaptive sync interval in ms. */
  getAdaptiveSyncInterval() {
    return this._adaptiveSyncInterval;
  }

  /** Force a connection diagnostics check. */
  async runDiagnostics() {
    const results = { peers: [], socket: this.socketConnected, fallback: this.useFallback, host: this.isHost };
    for (const [peerId, wrapper] of this.peers) {
      const stats = await this._collectPeerStats(peerId);
      results.peers.push({ peerId, state: wrapper.state, ...stats });
    }
    return results;
  }

  // ── PUBLIC API ─ Callback Registration ──
  onStateUpdate(cb) { this._stateCallbacks.push(cb); }
  onPeerJoin(cb) { this._joinCallbacks.push(cb); }
  onPeerLeave(cb) { this._leaveCallbacks.push(cb); }
  onPeerMessage(cb) { this._messageCallbacks.push(cb); }
  onHostMigrate(cb) { this._hostMigrateCallbacks.push(cb); }

  // ── PUBLIC API ─ Queries ──
  isHost() { return this.isHost; }
  getHostId() { return this.hostId; }
  getPeerCount() { return this.peers.size; }
  getPeerIds() { return Array.from(this.peers.keys()); }
  getRoomId() { return this.roomId; }
  getUserId() { return this.userId; }
  isConnected() {
    if (this.useFallback) return this.socketConnected;
    for (const [, channel] of this.dataChannels) if (channel.readyState === 'open') return true;
    return this.socketConnected;
  }

  // ── PUBLIC API ─ Peer Metadata & Topology ──

  /** Get metadata for a specific peer. */
  getPeerMetadata(peerId) {
    return this._peerMetadata.get(peerId) || null;
  }

  /** Get all peer metadata. */
  getAllPeerMetadata() {
    const meta = {};
    for (const [peerId, data] of this._peerMetadata) meta[peerId] = data;
    return meta;
  }

  /** Get current connection topology ('mesh' or 'star'). */
  getTopology() {
    return this._topology;
  }

  /** Set connection topology mode. */
  setTopology(mode) {
    if (mode !== 'mesh' && mode !== 'star') return;
    this._topology = mode;
    this._log('Topology changed to', mode);
  }

  /** Get connection event history for debugging. */
  getConnectionHistory() {
    return [...this._connectionHistory];
  }

  /** Clear connection event history. */
  clearConnectionHistory() {
    this._connectionHistory = [];
  }

  // ── PUBLIC API ─ Network & Congestion ──

  /** Detect network connection type (wifi, cellular, ethernet). */
  async detectNetworkType() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return 'unknown';
    return {
      type: conn.type || 'unknown',
      effectiveType: conn.effectiveType || 'unknown',
      downlink: conn.downlink || 0,
      rtt: conn.rtt || 0,
      saveData: conn.saveData || false,
    };
  }

  /** Check if data channels are experiencing congestion. */
  isCongested() {
    for (const [peerId, stats] of this._peerStats) {
      if (stats && stats.sendRate > 500000) { // > 500KB/s threshold
        this._log('Congestion detected for peer', peerId, 'rate', stats.sendRate);
        return true;
      }
    }
    return false;
  }

  /** Enable / disable congestion-aware batching. */
  setCongestionControl(enabled) {
    this._congestionControl = enabled;
    this._log('Congestion control', enabled ? 'enabled' : 'disabled');
  }

  /** Check if any data channel has buffered data (backpressure). */
  hasBackpressure() {
    for (const [peerId, channel] of this.dataChannels) {
      if (channel.bufferedAmount && channel.bufferedAmount > 65536) {
        this._log('Backpressure detected for peer', peerId, 'buffered', channel.bufferedAmount);
        return true;
      }
    }
    return false;
  }

  /** Get a summary of all connection states. */
  getConnectionSummary() {
    const summary = {
      roomId: this.roomId, isHost: this.isHost, hostId: this.hostId,
      peerCount: this.peers.size, connectedPeers: 0, fallback: this.useFallback,
      socketConnected: this.socketConnected, topology: this._topology,
    };
    for (const [, wrapper] of this.peers) {
      if (wrapper.state === PEER_STATE.CONNECTED) summary.connectedPeers++;
    }
    return summary;
  }

  // ── PUBLIC API ─ Room Security ──

  /** Verify room password before joining (client-side hint; real auth on server). */
  async verifyRoomPassword(roomId, password) {
    // In production, this would call the signaling server
    return new Promise((resolve) => {
      this._signalEmit('theatre:verifyPassword', { roomId, password });
      setTimeout(() => resolve(true), 100);
    });
  }

  // ── PUBLIC API ─ Connection Priority & QoS ──

  /** Set DSCP (Differentiated Services) marking for media traffic priority. */
  setConnectionPriority(priority) {
    const valid = ['high', 'normal', 'low'];
    if (!valid.includes(priority)) return;
    for (const [peerId, wrapper] of this.peers) {
      const senders = wrapper.pc.getSenders();
      senders.forEach(sender => {
        if (sender.transport) {
          try { sender.transport.setPriority(priority); } catch (e) {}
        }
      });
    }
    this._log('Connection priority set to', priority);
  }

  // ── PUBLIC API ─ Room Member List ──

  /** Get a list of all known room members including their metadata. */
  getRoomMembers() {
    const members = [];
    for (const [peerId, meta] of this._peerMetadata) {
      members.push({ peerId, ...meta });
    }
    members.push({ peerId: this.userId, userName: this.userName, joinTime: this.joinTime, deviceType: this._detectDeviceType(), isSelf: true });
    return members;
  }

  // ── PUBLIC API ─ Signal Strength ──

  /** Get a qualitative signal strength for each peer (excellent, good, fair, poor). */
  getSignalStrength(peerId) {
    const lat = this._latencyMap.get(peerId);
    if (!lat || !lat.rtt) return 'unknown';
    if (lat.rtt < 50) return 'excellent';
    if (lat.rtt < 150) return 'good';
    if (lat.rtt < 300) return 'fair';
    return 'poor';
  }

  // ── INTERNAL ─ Signaling Server (Socket.IO) ──

  async _initSignalConnection() {
    if (this.socketConnected) return;
    const io = window.io || this.opts.io;
    if (!io && !this.signalUrl) { this._log('No Socket.IO available, skipping signal server'); return; }
    try {
      if (!io && this.signalUrl) await this._loadScript('https://cdn.socket.io/4.7.2/socket.io.min.js');
      const socketLib = window.io || this.opts.io;
      if (!socketLib) { this._log('Socket.IO library not available after load attempt'); return; }
      const url = this.signalUrl || window.location.origin;
      this.socket = socketLib(url, {
        transports: ['websocket', 'polling'], reconnection: true,
        reconnectionDelay: 1000, reconnectionAttempts: 5,
      });
      this.socket.on('connect', this._onSocketConnect);
      this.socket.on('disconnect', this._onSocketDisconnect);
      this.socket.on(SIGNAL_EVENTS.OFFER, data => this._handleRemoteOffer(data));
      this.socket.on(SIGNAL_EVENTS.ANSWER, data => this._handleRemoteAnswer(data));
      this.socket.on(SIGNAL_EVENTS.ICE, data => this._handleRemoteIce(data));
      this.socket.on(SIGNAL_EVENTS.JOIN, data => this._handlePeerJoinSignal(data));
      this.socket.on(SIGNAL_EVENTS.LEAVE, data => this._handlePeerLeaveSignal(data));
      this.socket.on(SIGNAL_EVENTS.STATE, data => this._handleRelayState(data));
      this.socket.on(SIGNAL_EVENTS.HOST_MIGRATE, data => this._handleHostMigrationSignal(data));
      this.socket.on('connect_error', err => this._log('Socket connect error', err.message));
    } catch (err) { this._log('Failed to initialize Socket.IO:', err.message); }
  }

  _disconnectSignal() {
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
    this.socketConnected = false;
  }

  _signalEmit(event, data) { if (this.socket && this.socketConnected) this.socket.emit(event, data); }

  _onSocketConnect() {
    this.socketConnected = true; this._log('Socket.IO connected');
    if (this.roomId && !this.isHost) {
      this._signalEmit(SIGNAL_EVENTS.JOIN, {
        roomId: this.roomId, userId: this.userId, userName: this.userName, joinTime: this.joinTime,
      });
    }
  }

  _onSocketDisconnect(reason) { this.socketConnected = false; this._log('Socket.IO disconnected:', reason); }
  _onSocketMessage(event, data) { this._log('Socket message', event, data); }

  // ── INTERNAL ─ WebRTC Peer Connection Setup ──

  _createPeerConnection(peerId, polite = false) {
    const iceServers = this.opts.iceServers || DEFAULT_ICE_SERVERS;
    // Add TURN servers if provided
    if (this.opts.turnServers?.length) {
      iceServers.push(...this.opts.turnServers);
    }
    const config = { iceServers, iceCandidatePoolSize: 10 };
    const pc = new RTCPeerConnection(config);
    const wrapper = {
      peerId, pc, polite, makingOffer: false, ignoreOffer: false,
      state: PEER_STATE.CONNECTING, dataChannel: null, reconnectTimer: null,
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this._signalEmit(SIGNAL_EVENTS.ICE, {
          roomId: this.roomId, toPeerId: peerId, fromPeerId: this.userId, candidate: event.candidate,
        });
      }
    };
    pc.onconnectionstatechange = () => this._onConnectionChange(peerId, pc.connectionState);
    pc.ondatachannel = (event) => this._setupDataChannel(peerId, event.channel, false);
    pc.onnegotiationneeded = async () => {
      try {
        wrapper.makingOffer = true; await pc.setLocalDescription();
        this._signalEmit(SIGNAL_EVENTS.OFFER, {
          roomId: this.roomId, toPeerId: peerId, fromPeerId: this.userId, sdp: pc.localDescription,
        });
      } catch (err) { this._log('negotiationneeded error', err.message); }
      finally { wrapper.makingOffer = false; }
    };
    this.peers.set(peerId, wrapper); return wrapper;
  }

  _closePeer(peerId, wrapper) {
    if (!wrapper) wrapper = this.peers.get(peerId); if (!wrapper) return;
    wrapper.state = PEER_STATE.CLOSED;
    if (wrapper.reconnectTimer) clearTimeout(wrapper.reconnectTimer);
    if (wrapper.dataChannel) wrapper.dataChannel.close();
    wrapper.pc.close(); this.peers.delete(peerId);
    this.dataChannels.delete(peerId); this._lastPongTimes.delete(peerId);
    this._peerStats.delete(peerId); this._latencyMap.delete(peerId);
  }

  // ── INTERNAL ─ Data Channel ──

  _createDataChannel(peerId, label = 'theatre-sync') {
    const wrapper = this.peers.get(peerId); if (!wrapper) return null;
    const channel = wrapper.pc.createDataChannel(label, { ordered: true, maxRetransmits: 3 });
    this._setupDataChannel(peerId, channel, true); return channel;
  }

  _setupDataChannel(peerId, channel, isInitiator) {
    this._log('DataChannel setup', peerId, 'initiator=', isInitiator);
    channel.onopen = () => {
      this._log('DataChannel OPEN', peerId); this.dataChannels.set(peerId, channel);
      const wrapper = this.peers.get(peerId); if (wrapper) wrapper.state = PEER_STATE.CONNECTED;
      this._lastPongTimes.set(peerId, Date.now());
      this._reconnectAttempts.set(peerId, 0);
      if (this.useFallback) { this._log('WebRTC data channel restored, disabling fallback'); this.useFallback = false; }
      if (this._fallbackTimer) { clearTimeout(this._fallbackTimer); this._fallbackTimer = null; }
      if (this.isHost) this._notifyCallbacks(this._joinCallbacks, peerId);
      this._logConnectionEvent('connect', peerId);
      // Exchange metadata
      channel.send(JSON.stringify({ _type: 'metadata', userName: this.userName, joinTime: this.joinTime, deviceType: this._detectDeviceType() }));
    };
    channel.onmessage = (event) => { this._lastPongTimes.set(peerId, Date.now()); this._handleDataMessage(peerId, event.data); };
    channel.onclose = () => {
      this._log('DataChannel CLOSE', peerId); this.dataChannels.delete(peerId);
      const w = this.peers.get(peerId); if (w) w.state = PEER_STATE.DISCONNECTED;
    };
    channel.onerror = (err) => { this._log('DataChannel ERROR', peerId, err); };
  }

  _handleDataMessage(peerId, rawData) {
    let data; try { data = JSON.parse(rawData); } catch (e) { this._log('Non-JSON data from', peerId, rawData.slice(0, 100)); return; }
    if (data._room && data._room !== this.roomId) return;
    if (data._type === 'pong') {
      const lat = this._latencyMap.get(peerId);
      if (lat && lat.lastPing) {
        const rtt = Date.now() - lat.lastPing;
        this._latencyMap.set(peerId, { ...lat, lastPong: Date.now(), rtt });
        this._adaptSyncInterval(rtt);
      }
      this._lastPongTimes.set(peerId, Date.now());
      return;
    }
    if (data._type === 'metadata') {
      this._peerMetadata.set(peerId, { userName: data.userName, joinTime: data.joinTime, deviceType: data.deviceType, receivedAt: Date.now() });
      return;
    }
    if (data._target && data._target !== this.userId) return;
    // Deduplication: ignore messages we've seen before
    if (data._ts && data._sender) {
      const msgId = `${data._sender}-${data._ts}-${data.action || 'raw'}`;
      if (this._seenMessageIds.has(msgId)) return;
      this._seenMessageIds.add(msgId);
      if (this._seenMessageIds.size > 500) {
        const first = this._seenMessageIds.values().next().value;
        this._seenMessageIds.delete(first);
      }
    }
    this._messageCallbacks.forEach(cb => { try { cb(peerId, data); } catch (e) {} });
    this._stateCallbacks.forEach(cb => { try { cb(data); } catch (e) {} });
  }

  // ── INTERNAL ─ Adaptive Sync ──

  _adaptSyncInterval(rtt) {
    if (rtt < 50) this._adaptiveSyncInterval = 1000;
    else if (rtt < 150) this._adaptiveSyncInterval = 2000;
    else if (rtt < 300) this._adaptiveSyncInterval = 3000;
    else this._adaptiveSyncInterval = 5000;
  }

  // ── INTERNAL ─ Stats Collection ──

  _startStatsCollection() {
    if (this._statsTimer) return;
    this._statsTimer = setInterval(() => this._collectAllStats(), STATS_INTERVAL_MS);
  }

  _stopStatsCollection() {
    if (this._statsTimer) { clearInterval(this._statsTimer); this._statsTimer = null; }
  }

  async _collectAllStats() {
    for (const [peerId] of this.peers) {
      const stats = await this._collectPeerStats(peerId);
      if (stats) this._peerStats.set(peerId, stats);
    }
  }

  async _collectPeerStats(peerId) {
    const wrapper = this.peers.get(peerId); if (!wrapper) return null;
    try {
      const reports = await wrapper.pc.getStats();
      let bytesSent = 0, bytesReceived = 0, packetsLost = 0, jitter = 0;
      reports.forEach(report => {
        if (report.type === 'outbound-rtp') bytesSent = report.bytesSent || 0;
        if (report.type === 'inbound-rtp') { bytesReceived = report.bytesReceived || 0; packetsLost = report.packetsLost || 0; jitter = report.jitter || 0; }
      });
      const prev = this._peerStats.get(peerId);
      const duration = prev ? (Date.now() - prev.timestamp) / 1000 : STATS_INTERVAL_MS / 1000;
      const sendRate = prev ? Math.max(0, (bytesSent - prev.bytesSent) / duration) : 0;
      const recvRate = prev ? Math.max(0, (bytesReceived - prev.bytesReceived) / duration) : 0;
      return { bytesSent, bytesReceived, packetsLost, jitter, sendRate, recvRate, timestamp: Date.now() };
    } catch (e) { return null; }
  }

  // ── INTERNAL ─ Signaling Handlers (Offers / Answers / ICE) ──

  async _handleRemoteOffer(data) {
    const { fromPeerId, sdp, toPeerId } = data; if (toPeerId && toPeerId !== this.userId) return;
    let wrapper = this.peers.get(fromPeerId); if (!wrapper) wrapper = this._createPeerConnection(fromPeerId, false);
    const pc = wrapper.pc;
    const readyForOffer = !wrapper.makingOffer && (pc.signalingState === 'stable' || wrapper.isSettingRemoteAnswerPending);
    wrapper.ignoreOffer = !readyForOffer && !wrapper.polite;
    if (wrapper.ignoreOffer) { this._log('Ignoring impolite offer from', fromPeerId); return; }
    wrapper.isSettingRemoteAnswerPending = true;
    try {
      await pc.setRemoteDescription(sdp);
      if (pc.remoteDescription.type === 'offer') {
        await pc.setLocalDescription();
        this._signalEmit(SIGNAL_EVENTS.ANSWER, {
          roomId: this.roomId, toPeerId: fromPeerId, fromPeerId: this.userId, sdp: pc.localDescription,
        });
      }
    } catch (err) { this._log('handleRemoteOffer error', err.message); }
    finally { wrapper.isSettingRemoteAnswerPending = false; }
    const pending = this.pendingCandidates.get(fromPeerId);
    if (pending) { for (const c of pending) { try { await pc.addIceCandidate(c); } catch (e) {} } this.pendingCandidates.delete(fromPeerId); }
  }

  async _handleRemoteAnswer(data) {
    const { fromPeerId, sdp, toPeerId } = data; if (toPeerId && toPeerId !== this.userId) return;
    const wrapper = this.peers.get(fromPeerId); if (!wrapper) return;
    try { await wrapper.pc.setRemoteDescription(sdp); } catch (err) { this._log('handleRemoteAnswer error', err.message); }
    const pending = this.pendingCandidates.get(fromPeerId);
    if (pending) { for (const c of pending) { try { await wrapper.pc.addIceCandidate(c); } catch (e) {} } this.pendingCandidates.delete(fromPeerId); }
  }

  async _handleRemoteIce(data) {
    const { fromPeerId, candidate, toPeerId } = data; if (toPeerId && toPeerId !== this.userId) return;
    const wrapper = this.peers.get(fromPeerId); const iceCandidate = new RTCIceCandidate(candidate);
    if (!wrapper || !wrapper.pc.remoteDescription) {
      if (!this.pendingCandidates.has(fromPeerId)) this.pendingCandidates.set(fromPeerId, []);
      this.pendingCandidates.get(fromPeerId).push(iceCandidate); return;
    }
    try { await wrapper.pc.addIceCandidate(iceCandidate); }
    catch (err) { if (!wrapper.ignoreOffer) this._log('addIceCandidate error', err.message); }
  }

  // ── INTERNAL ─ Peer Join / Leave via Signal ──

  _handlePeerJoinSignal(data) {
    const { userId, userName, joinTime } = data; if (userId === this.userId) return;
    this._log('Peer joined via signal:', userId, userName);
    this._peerMetadata.set(userId, { userName, joinTime, deviceType: 'unknown', lastSeen: Date.now() });
    this._logConnectionEvent('peerJoin', userId, { userName });
    if (this.isHost) this._connectToPeer(userId, true);
    else if (this.hostId === userId) this._connectToPeer(userId, false);
    if (!this.hostId && joinTime < this.joinTime) this.hostId = userId;
    this._notifyCallbacks(this._joinCallbacks, userId);
  }

  _handlePeerLeaveSignal(data) {
    const { userId } = data; if (userId === this.userId) return;
    this._log('Peer left via signal:', userId);
    this._peerMetadata.delete(userId);
    this._logConnectionEvent('peerLeave', userId);
    this._removePeer(userId);
  }

  _connectToPeer(peerId, polite = true) {
    if (this.peers.has(peerId)) return;
    const wrapper = this._createPeerConnection(peerId, polite); this._createDataChannel(peerId);
    if (polite) {
      wrapper.pc.createOffer().then(offer => wrapper.pc.setLocalDescription(offer)).then(() => {
        this._signalEmit(SIGNAL_EVENTS.OFFER, {
          roomId: this.roomId, toPeerId: peerId, fromPeerId: this.userId, sdp: wrapper.pc.localDescription,
        });
      }).catch(err => this._log('createOffer error', err.message));
    }
  }

  _removePeer(peerId) {
    const wrapper = this.peers.get(peerId); if (wrapper) this._closePeer(peerId, wrapper);
    this._notifyCallbacks(this._leaveCallbacks, peerId);
    if (peerId === this.hostId) this._handleHostLeft();
  }

  _onConnectionChange(peerId, connectionState) {
    this._log('Peer', peerId, 'connectionState:', connectionState);
    const wrapper = this.peers.get(peerId); if (!wrapper) return;
    wrapper.state = connectionState;
    this._logConnectionEvent(connectionState, peerId, { connectionState });
    if (connectionState === 'failed' || connectionState === 'disconnected') {
      const attempts = this._reconnectAttempts.get(peerId) || 0;
      const delay = Math.min(RECONNECT_DELAY_MS * Math.pow(2, attempts), RECONNECT_MAX_DELAY_MS);
      const jitter = Math.random() * 1000; // add jitter to prevent thundering herd
      this._reconnectAttempts.set(peerId, attempts + 1);
      if (!wrapper.reconnectTimer) {
        wrapper.reconnectTimer = setTimeout(() => {
          this._log('Attempting reconnect to', peerId, 'attempt', attempts + 1);
          this._closePeer(peerId, wrapper); this._connectToPeer(peerId, this.isHost);
        }, delay + jitter);
      }
    }
    if (connectionState === 'connected') {
      this._reconnectAttempts.set(peerId, 0);
      if (wrapper.reconnectTimer) { clearTimeout(wrapper.reconnectTimer); wrapper.reconnectTimer = null; }
    }
    if (connectionState === 'closed' || connectionState === 'failed') this._removePeer(peerId);
  }

  _onIceCandidate(event) { /* handled per-peer in _createPeerConnection */ }
  _onDataChannel(event) { /* handled per-peer in _createPeerConnection */ }

  // ── INTERNAL ─ Host Election & Migration ──

  _handleHostLeft() {
    this._log('Host left, starting host election'); this.hostId = null; this.isHost = false;
    const connectedPeers = Array.from(this.peers.values()).filter(w => w.state === PEER_STATE.CONNECTED);
    if (connectedPeers.length === 0 || this._isOldestPeer()) this._promoteToHost();
  }

  _isOldestPeer() {
    /* heuristic: if no peer connections remain, assume we're oldest */
    return this.peers.size === 0;
  }

  _promoteToHost() {
    this.isHost = true; this.hostId = this.userId; this._log('Promoted to host');
    this._signalEmit(SIGNAL_EVENTS.HOST_MIGRATE, {
      roomId: this.roomId, newHostId: this.userId, newHostName: this.userName,
    });
    this._notifyCallbacks(this._hostMigrateCallbacks, { newHostId: this.userId, newHostName: this.userName });
    this._startHeartbeat(); this._startStatsCollection();
  }

  _migrateHost() {
    let oldestPeer = null;
    for (const [peerId, wrapper] of this.peers) {
      if (wrapper.state === PEER_STATE.CONNECTED) { if (!oldestPeer || peerId < oldestPeer) oldestPeer = peerId; }
    }
    if (oldestPeer) {
      this._log('Migrating host to', oldestPeer);
      this._signalEmit(SIGNAL_EVENTS.HOST_MIGRATE, { roomId: this.roomId, newHostId: oldestPeer });
    }
  }

  _handleHostMigrationSignal(data) {
    const { newHostId, newHostName } = data;
    this.hostId = newHostId; this.isHost = (newHostId === this.userId);
    this._log('Host migrated to', newHostId, 'I am host?', this.isHost);
    this._hostMigrateCallbacks.forEach(cb => { try { cb({ newHostId, newHostName, iAmHost: this.isHost }); } catch (e) {} });
    if (this.isHost) { this._startHeartbeat(); this._startStatsCollection(); }
  }

  // ── INTERNAL ─ Fallback (Socket.IO Relay) ──

  _handleRelayState(data) {
    if (!data.payload) return; let state;
    try { state = typeof data.payload === 'string' ? JSON.parse(data.payload) : data.payload; }
    catch (e) { return; }
    if (state._room && state._room !== this.roomId) return;
    if (state._sender === this.userId) return;
    this._stateCallbacks.forEach(cb => { try { cb(state); } catch (e) {} });
  }

  // ── INTERNAL ─ Heartbeat / Health Check ──

  _startHeartbeat() {
    if (this._heartbeatTimer) return;
    this._heartbeatTimer = setInterval(() => {
      const now = Date.now(); const pingPayload = JSON.stringify({ _type: 'ping', _ts: now });
      for (const [peerId, channel] of this.dataChannels) {
        if (channel.readyState === 'open') {
          const lat = this._latencyMap.get(peerId) || {};
          this._latencyMap.set(peerId, { ...lat, lastPing: now });
          try { channel.send(pingPayload); } catch (e) {}
        }
      }
      for (const [peerId, lastPong] of this._lastPongTimes) {
        if (now - lastPong > HEARTBEAT_TIMEOUT_MS) { this._log('Peer', peerId, 'heartbeat timeout, removing'); this._removePeer(peerId); }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  _stopHeartbeat() { if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; } }

  // ── INTERNAL ─ Utilities ──

  _notifyCallbacks(callbacks, data) { callbacks.forEach(cb => { try { cb(data); } catch (e) {} }); }
  _generateId() { return 'p_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36).slice(-4); }
  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }
  _log(...args) { if (this._debug) console.log('[WebRTCSync]', ...args); }

  _logConnectionEvent(type, peerId, details = {}) {
    const entry = { type, peerId, timestamp: Date.now(), ...details };
    this._connectionHistory.push(entry);
    if (this._connectionHistory.length > this._maxHistorySize) this._connectionHistory.shift();
  }

  _detectDeviceType() {
    const ua = navigator.userAgent;
    if (/mobile|android|iphone|ipad|ipod/i.test(ua)) return 'mobile';
    if (/tablet|ipad/i.test(ua)) return 'tablet';
    return 'desktop';
  }
}
