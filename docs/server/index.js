/**
 * Starlight Inn v7.0 - Main Server
 * Express + SQLite + Socket.IO + JWT Authentication
 * ~2000 lines of production-grade backend code
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { db, runAsync, getAsync, allAsync } = require('./db');

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const NODE_ENV = process.env.NODE_ENV || 'development';

// =============================================================================
// EXPRESS APP SETUP
// =============================================================================

const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
if (process.env.ENABLE_REQUEST_LOGGING === 'true' || NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${new Date().toISOString()} | ${req.method} ${req.path} | ${res.statusCode} | ${duration}ms | ${req.ip}`);
    });
    next();
  });
}

// Attach user IP for rate limiting and tracking
app.use((req, res, next) => {
  req.clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  next();
});

// =============================================================================
// RATE LIMITING
// =============================================================================

const rateLimiter = new RateLimiterMemory({
  keyPrefix: 'rl_global',
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10) / 1000
});

const strictRateLimiter = new RateLimiterMemory({
  keyPrefix: 'rl_strict',
  points: 20,
  duration: 60
});

const authRateLimiter = new RateLimiterMemory({
  keyPrefix: 'rl_auth',
  points: 10,
  duration: 300
});

async function rateLimitMiddleware(req, res, next) {
  try {
    await rateLimiter.consume(req.clientIp, 1);
    next();
  } catch {
    return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
  }
}

async function strictRateLimitMiddleware(req, res, next) {
  try {
    await strictRateLimiter.consume(req.clientIp, 1);
    next();
  } catch {
    return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
  }
}

async function authRateLimitMiddleware(req, res, next) {
  try {
    await authRateLimiter.consume(req.clientIp, 1);
    next();
  } catch {
    return res.status(429).json({ success: false, error: 'Too many authentication attempts. Please try again later.' });
  }
}

app.use(rateLimitMiddleware);

// =============================================================================
// JWT MIDDLEWARE
// =============================================================================

function generateTokens(user) {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    displayName: user.display_name
  };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
  return { accessToken, refreshToken };
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const session = await getAsync('SELECT * FROM sessions WHERE token = ? AND is_active = 1 AND expires_at > datetime("now")', [token]);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Session expired or revoked' });
    }

    const user = await getAsync('SELECT id, username, email, display_name, role, status, coins, gems, xp, level, muted_until, banned_until FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    if (user.banned_until && new Date(user.banned_until) > new Date()) {
      return res.status(403).json({ success: false, error: 'Account is banned' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(403).json({ success: false, error: 'Invalid token' });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  return requireRole(['admin', 'moderator'])(req, res, next);
}

// =============================================================================
// SOCKET.IO SETUP
// =============================================================================

const io = new Server(httpServer, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// In-memory state for real-time features
const connectedUsers = new Map();      // socketId -> { userId, username, roomId }
const playerPositions = new Map();     // roomId -> Map(userId -> {x, y, direction})
const activeRooms = new Map();         // roomId -> Set(socketIds)
const activeTrades = new Map();        // tradeId -> tradeData
const socketToUser = new Map();        // socketId -> userId

// Socket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getAsync('SELECT id, username, display_name, role, muted_until, banned_until FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return next(new Error('User not found'));
    }
    if (user.banned_until && new Date(user.banned_until) > new Date()) {
      return next(new Error('Account banned'));
    }
    socket.userId = user.id;
    socket.username = user.display_name || user.username;
    socket.userRole = user.role;
    socket.mutedUntil = user.muted_until;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id} (user: ${socket.username})`);
  connectedUsers.set(socket.id, { userId: socket.userId, username: socket.username, roomId: null });
  socketToUser.set(socket.id, socket.userId);

  // Update user status
  runAsync('UPDATE users SET status = ?, last_online = datetime("now") WHERE id = ?', ['online', socket.userId]).catch(() => {});

  // Broadcast user online status to friends
  broadcastToFriends(socket.userId, 'friend_status', { userId: socket.userId, status: 'online' });

  // Join room
  socket.on('join_room', async (roomId) => {
    try {
      const room = await getAsync('SELECT * FROM rooms WHERE room_key = ? AND enabled = 1', [roomId]);
      if (!room) {
        socket.emit('error', { message: 'Room not found or disabled' });
        return;
      }

      // Leave previous room
      const prevData = connectedUsers.get(socket.id);
      if (prevData && prevData.roomId) {
        socket.leave(prevData.roomId);
        activeRooms.get(prevData.roomId)?.delete(socket.id);
        playerPositions.get(prevData.roomId)?.delete(socket.userId);
        socket.to(prevData.roomId).emit('player_left', { userId: socket.userId, username: socket.username });
      }

      // Join new room
      socket.join(roomId);
      if (!activeRooms.has(roomId)) activeRooms.set(roomId, new Set());
      activeRooms.get(roomId).add(socket.id);

      if (!playerPositions.has(roomId)) playerPositions.set(roomId, new Map());
      playerPositions.get(roomId).set(socket.userId, { x: 400, y: 300, direction: 'down', username: socket.username });

      connectedUsers.set(socket.id, { ...prevData, roomId });

      // Update room occupancy
      await runAsync('UPDATE rooms SET current_occupancy = ? WHERE room_key = ?', [activeRooms.get(roomId).size, roomId]);

      // Send current room state
      const roomPlayers = [];
      for (const [uid, pos] of playerPositions.get(roomId)) {
        roomPlayers.push({ userId: uid, ...pos });
      }

      socket.emit('room_joined', { roomId, players: roomPlayers });
      socket.to(roomId).emit('player_joined', { userId: socket.userId, username: socket.username, x: 400, y: 300, direction: 'down' });

      console.log(`User ${socket.username} joined room ${roomId}`);
    } catch (err) {
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Player movement
  socket.on('player_move', (data) => {
    const userData = connectedUsers.get(socket.id);
    if (!userData || !userData.roomId) return;

    const { x, y, direction } = data;
    if (typeof x !== 'number' || typeof y !== 'number') return;

    const roomId = userData.roomId;
    playerPositions.get(roomId)?.set(socket.userId, { x, y, direction, username: socket.username });

    socket.to(roomId).emit('player_moved', {
      userId: socket.userId,
      username: socket.username,
      x,
      y,
      direction
    });
  });

  // Chat message
  socket.on('chat_message', async (data) => {
    try {
      const userData = connectedUsers.get(socket.id);
      if (!userData || !userData.roomId) return;

      // Check mute
      if (socket.mutedUntil && new Date(socket.mutedUntil) > new Date()) {
        socket.emit('chat_error', { message: 'You are muted until ' + socket.mutedUntil });
        return;
      }

      let { message, messageType = 'text' } = data;
      if (!message || typeof message !== 'string') return;
      message = message.trim();
      if (message.length === 0 || message.length > 500) {
        socket.emit('chat_error', { message: 'Message must be between 1 and 500 characters' });
        return;
      }

      // Basic profanity filter flagging
      const flaggedWords = ['spam', 'scam', 'hack', 'exploit', 'cheat'];
      const lowerMsg = message.toLowerCase();
      const flagged = flaggedWords.some(w => lowerMsg.includes(w)) ? 1 : 0;

      // Store in database
      await runAsync(
        'INSERT INTO chat_history (room_id, user_id, username, message, message_type, flagged) VALUES (?, ?, ?, ?, ?, ?)',
        [userData.roomId, socket.userId, socket.username, message, messageType, flagged]
      );

      const chatData = {
        id: Date.now(),
        userId: socket.userId,
        username: socket.username,
        message,
        messageType,
        roomId: userData.roomId,
        timestamp: new Date().toISOString()
      };

      io.to(userData.roomId).emit('chat_message', chatData);

      // If flagged, notify moderators
      if (flagged) {
        io.to('moderators').emit('flagged_message', { ...chatData, reason: 'Contains flagged keywords' });
      }
    } catch (err) {
      socket.emit('chat_error', { message: 'Failed to send message' });
    }
  });

  // Friend request via socket
  socket.on('friend_request', async (data) => {
    try {
      const { targetUserId } = data;
      if (!targetUserId || targetUserId === socket.userId) return;

      const existing = await getAsync(
        'SELECT * FROM friends WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)',
        [socket.userId, targetUserId, targetUserId, socket.userId]
      );
      if (existing) {
        socket.emit('friend_error', { message: 'Friend request already exists' });
        return;
      }

      await runAsync(
        'INSERT INTO friends (requester_id, addressee_id, status) VALUES (?, ?, ?)',
        [socket.userId, targetUserId, 'pending']
      );

      const requestData = {
        requesterId: socket.userId,
        requesterName: socket.username,
        status: 'pending',
        timestamp: new Date().toISOString()
      };

      socket.emit('friend_request_sent', requestData);

      // Notify target user if online
      for (const [sid, info] of connectedUsers) {
        if (info.userId === targetUserId) {
          io.to(sid).emit('friend_request_received', requestData);
        }
      }
    } catch (err) {
      socket.emit('friend_error', { message: 'Failed to send friend request' });
    }
  });

  // Trade events via socket
  socket.on('trade_update', async (data) => {
    try {
      const { tradeId, action, items } = data;
      const trade = await getAsync('SELECT * FROM trades WHERE id = ? AND status = ?', [tradeId, 'pending']);
      if (!trade) {
        socket.emit('trade_error', { message: 'Trade not found or expired' });
        return;
      }

      const isInitiator = trade.initiator_id === socket.userId;
      const isRecipient = trade.recipient_id === socket.userId;
      if (!isInitiator && !isRecipient) {
        socket.emit('trade_error', { message: 'Not authorized for this trade' });
        return;
      }

      if (action === 'update_items') {
        const column = isInitiator ? 'initiator_items' : 'recipient_items';
        const confirmColumn = isInitiator ? 'initiator_confirmed' : 'recipient_confirmed';
        await runAsync(`UPDATE trades SET ${column} = ?, ${confirmColumn} = 0, updated_at = datetime("now") WHERE id = ?`, [JSON.stringify(items), tradeId]);

        const otherId = isInitiator ? trade.recipient_id : trade.initiator_id;
        for (const [sid, info] of connectedUsers) {
          if (info.userId === otherId) {
            io.to(sid).emit('trade_items_updated', { tradeId, items, fromInitiator: isInitiator });
          }
        }
      } else if (action === 'confirm') {
        const column = isInitiator ? 'initiator_confirmed' : 'recipient_confirmed';
        await runAsync(`UPDATE trades SET ${column} = 1, updated_at = datetime("now") WHERE id = ?`, [tradeId]);

        const updated = await getAsync('SELECT * FROM trades WHERE id = ?', [tradeId]);
        if (updated.initiator_confirmed && updated.recipient_confirmed) {
          // Both confirmed - finalize trade (simplified)
          await runAsync('UPDATE trades SET status = ? WHERE id = ?', ['accepted', tradeId]);
          io.to(`trade_${tradeId}`).emit('trade_completed', { tradeId });
        } else {
          const otherId = isInitiator ? trade.recipient_id : trade.initiator_id;
          for (const [sid, info] of connectedUsers) {
            if (info.userId === otherId) {
              io.to(sid).emit('trade_confirmed', { tradeId, byInitiator: isInitiator });
            }
          }
        }
      } else if (action === 'cancel') {
        await runAsync('UPDATE trades SET status = ? WHERE id = ?', ['cancelled', tradeId]);
        io.to(`trade_${tradeId}`).emit('trade_cancelled', { tradeId, cancelledBy: socket.userId });
      }
    } catch (err) {
      socket.emit('trade_error', { message: 'Trade action failed' });
    }
  });

  // Join trade room for updates
  socket.on('join_trade', (tradeId) => {
    socket.join(`trade_${tradeId}`);
  });

  // Leave trade room
  socket.on('leave_trade', (tradeId) => {
    socket.leave(`trade_${tradeId}`);
  });

  // Moderator join special room
  socket.on('join_moderator', () => {
    if (socket.userRole === 'moderator' || socket.userRole === 'admin') {
      socket.join('moderators');
      socket.emit('moderator_joined', { success: true });
    }
  });

  // Ping/pong for health
  socket.on('ping_server', () => {
    socket.emit('pong_server', { timestamp: Date.now() });
  });

  // Disconnect
  socket.on('disconnect', async (reason) => {
    console.log(`Socket disconnected: ${socket.id} (reason: ${reason})`);
    const userData = connectedUsers.get(socket.id);

    if (userData && userData.roomId) {
      activeRooms.get(userData.roomId)?.delete(socket.id);
      playerPositions.get(userData.roomId)?.delete(socket.userId);
      socket.to(userData.roomId).emit('player_left', { userId: socket.userId, username: socket.username });

      await runAsync('UPDATE rooms SET current_occupancy = ? WHERE room_key = ?', 
        [activeRooms.get(userData.roomId)?.size || 0, userData.roomId]).catch(() => {});
    }

    connectedUsers.delete(socket.id);
    socketToUser.delete(socket.id);

    await runAsync('UPDATE users SET status = ?, last_online = datetime("now") WHERE id = ?', 
      ['offline', socket.userId]).catch(() => {});

    broadcastToFriends(socket.userId, 'friend_status', { userId: socket.userId, status: 'offline' });
  });
});

function broadcastToFriends(userId, event, data) {
  getAsync(
    'SELECT addressee_id as friend_id FROM friends WHERE requester_id = ? AND status = ? UNION SELECT requester_id as friend_id FROM friends WHERE addressee_id = ? AND status = ?',
    [userId, 'accepted', userId, 'accepted']
  ).then(rows => {
    if (!rows || !rows.length) return;
    for (const row of rows) {
      for (const [sid, info] of connectedUsers) {
        if (info.userId === row.friend_id) {
          io.to(sid).emit(event, data);
        }
      }
    }
  }).catch(() => {});
}

// =============================================================================
// AUTH ROUTES
// =============================================================================

app.post('/api/auth/register', authRateLimitMiddleware, async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'Username, email, and password are required' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ success: false, error: 'Username must be 3-20 characters' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ success: false, error: 'Username can only contain letters, numbers, and underscores' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    // Check existing
    const existing = await getAsync('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Username or email already taken' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await runAsync(
      'INSERT INTO users (username, display_name, email, password_hash, coins, gems) VALUES (?, ?, ?, ?, ?, ?)',
      [username, displayName || username, email, passwordHash, 100, 10]
    );

    const userId = result.lastID;

    // Grant starter items
    const starterItems = [
      { item_id: 'starter_hat', item_type: 'clothing', item_name: 'Starter Hat', equipped: 1 },
      { item_id: 'starter_shirt', item_type: 'clothing', item_name: 'Starter Shirt', equipped: 1 },
      { item_id: 'emote_wave', item_type: 'emote', item_name: 'Wave Emote', equipped: 0 }
    ];
    for (const item of starterItems) {
      await runAsync(
        'INSERT OR IGNORE INTO inventory (user_id, item_id, item_type, item_name, equipped) VALUES (?, ?, ?, ?, ?)',
        [userId, item.item_id, item.item_type, item.item_name, item.equipped]
      );
    }

    // Create initial achievements
    const achievements = await allAsync('SELECT id FROM achievements');
    for (const ach of achievements) {
      await runAsync(
        'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
        [userId, ach.id]
      );
    }

    const user = await getAsync('SELECT id, username, display_name, email, role, coins, gems, xp, level FROM users WHERE id = ?', [userId]);
    const { accessToken, refreshToken } = generateTokens(user);

    // Store session
    await runAsync(
      'INSERT INTO sessions (user_id, token, refresh_token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, datetime("now", "+7 days"))',
      [userId, accessToken, refreshToken, req.clientIp, req.headers['user-agent'] || '']
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          email: user.email,
          role: user.role,
          coins: user.coins,
          gems: user.gems,
          xp: user.xp,
          level: user.level
        },
        tokens: { accessToken, refreshToken }
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/login', authRateLimitMiddleware, async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ success: false, error: 'Username/email and password are required' });
    }

    const user = await getAsync(
      'SELECT id, username, display_name, email, password_hash, role, coins, gems, xp, level, banned_until, ban_reason FROM users WHERE username = ? OR email = ?',
      [usernameOrEmail, usernameOrEmail]
    );

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (user.banned_until && new Date(user.banned_until) > new Date()) {
      return res.status(403).json({ 
        success: false, 
        error: 'Account banned', 
        bannedUntil: user.banned_until,
        reason: user.ban_reason 
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    await runAsync(
      'INSERT INTO sessions (user_id, token, refresh_token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, datetime("now", "+7 days"))',
      [user.id, accessToken, refreshToken, req.clientIp, req.headers['user-agent'] || '']
    );

    // Update last online
    await runAsync('UPDATE users SET last_online = datetime("now") WHERE id = ?', [user.id]);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          email: user.email,
          role: user.role,
          coins: user.coins,
          gems: user.gems,
          xp: user.xp,
          level: user.level
        },
        tokens: { accessToken, refreshToken }
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') {
      return res.status(403).json({ success: false, error: 'Invalid refresh token' });
    }

    const session = await getAsync(
      'SELECT * FROM sessions WHERE refresh_token = ? AND is_active = 1',
      [refreshToken]
    );
    if (!session) {
      return res.status(403).json({ success: false, error: 'Refresh token revoked' });
    }

    const user = await getAsync('SELECT id, username, display_name, email, role FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return res.status(403).json({ success: false, error: 'User not found' });
    }

    const tokens = generateTokens(user);

    // Revoke old session and create new
    await runAsync('UPDATE sessions SET is_active = 0 WHERE id = ?', [session.id]);
    await runAsync(
      'INSERT INTO sessions (user_id, token, refresh_token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, datetime("now", "+7 days"))',
      [user.id, tokens.accessToken, tokens.refreshToken, req.clientIp, req.headers['user-agent'] || '']
    );

    res.json({
      success: true,
      data: { tokens }
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Refresh token expired. Please log in again.', code: 'REFRESH_EXPIRED' });
    }
    res.status(403).json({ success: false, error: 'Invalid refresh token' });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    await runAsync('UPDATE sessions SET is_active = 0 WHERE token = ?', [req.token]);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await getAsync(
      'SELECT id, username, display_name, email, role, status, avatar_url, coins, gems, xp, level, battle_pass_tier, battle_pass_purchased, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: { user } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user data' });
  }
});


// =============================================================================
// USER ROUTES
// =============================================================================

app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const user = await getAsync(
      'SELECT id, username, display_name, avatar_url, role, status, last_online, coins, gems, xp, level, created_at FROM users WHERE id = ?',
      [targetId]
    );
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check friendship status with requester
    const friendship = await getAsync(
      'SELECT status FROM friends WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)',
      [req.user.id, targetId, targetId, req.user.id]
    );

    res.json({
      success: true,
      data: {
        user,
        friendship: friendship ? friendship.status : null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (targetId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Cannot modify another user\'s profile' });
    }

    const allowedFields = ['display_name', 'avatar_url', 'profile_data'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'display_name' && (req.body[field].length < 1 || req.body[field].length > 30)) {
          return res.status(400).json({ success: false, error: 'Display name must be 1-30 characters' });
        }
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    values.push(targetId);
    await runAsync(`UPDATE users SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`, values);

    const user = await getAsync('SELECT id, username, display_name, avatar_url, role, coins, gems, xp, level FROM users WHERE id = ?', [targetId]);
    res.json({ success: true, data: { user } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

app.get('/api/users/:id/inventory', authenticateToken, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const isSelf = targetId === req.user.id;

    const items = await allAsync(
      'SELECT id, item_id, item_type, item_name, quantity, equipped, rarity, metadata, acquired_at FROM inventory WHERE user_id = ? ORDER BY item_type, rarity DESC, acquired_at DESC',
      [targetId]
    );

    // If viewing another user, only show equipped clothing/badges/pets
    const filteredItems = isSelf ? items : items.filter(i => 
      i.equipped === 1 && ['clothing', 'badge', 'pet'].includes(i.item_type)
    );

    res.json({ success: true, data: { items: filteredItems, total: items.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch inventory' });
  }
});

app.get('/api/users/:id/friends', authenticateToken, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const friends = await allAsync(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.status, u.last_online, f.status as friendship_status
       FROM friends f
       JOIN users u ON (f.requester_id = u.id OR f.addressee_id = u.id) AND u.id != ?
       WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'`,
      [targetId, targetId, targetId]
    );
    res.json({ success: true, data: { friends } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch friends' });
  }
});

// =============================================================================
// INVENTORY ROUTES
// =============================================================================

app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const { type, equipped } = req.query;
    let sql = 'SELECT * FROM inventory WHERE user_id = ?';
    const params = [req.user.id];

    if (type) {
      sql += ' AND item_type = ?';
      params.push(type);
    }
    if (equipped !== undefined) {
      sql += ' AND equipped = ?';
      params.push(equipped === 'true' || equipped === '1' ? 1 : 0);
    }

    sql += ' ORDER BY item_type, rarity DESC, acquired_at DESC';
    const items = await allAsync(sql, params);
    res.json({ success: true, data: { items, count: items.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch inventory' });
  }
});

app.post('/api/inventory/add', authenticateToken, strictRateLimitMiddleware, async (req, res) => {
  try {
    const { itemId, quantity = 1, metadata = {} } = req.body;
    if (!itemId) {
      return res.status(400).json({ success: false, error: 'itemId is required' });
    }

    // Validate item exists in definitions
    const def = await getAsync('SELECT * FROM item_definitions WHERE item_key = ?', [itemId]);
    if (!def) {
      return res.status(404).json({ success: false, error: 'Item does not exist' });
    }

    const existing = await getAsync('SELECT id, quantity FROM inventory WHERE user_id = ? AND item_id = ?', [req.user.id, itemId]);
    if (existing) {
      if (!def.stackable) {
        return res.status(400).json({ success: false, error: 'This item cannot be stacked' });
      }
      await runAsync('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [quantity, existing.id]);
    } else {
      await runAsync(
        'INSERT INTO inventory (user_id, item_id, item_type, item_name, quantity, rarity, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, itemId, def.item_type, def.name, quantity, def.rarity, JSON.stringify(metadata)]
      );
    }

    // Update achievement progress for collector
    await updateAchievementProgress(req.user.id, 'collector_10', 1);

    const items = await allAsync('SELECT * FROM inventory WHERE user_id = ?', [req.user.id]);
    res.json({ success: true, data: { items, added: { itemId, quantity } } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add item' });
  }
});

app.post('/api/inventory/remove', authenticateToken, strictRateLimitMiddleware, async (req, res) => {
  try {
    const { itemId, quantity = 1 } = req.body;
    if (!itemId) {
      return res.status(400).json({ success: false, error: 'itemId is required' });
    }

    const existing = await getAsync('SELECT id, quantity FROM inventory WHERE user_id = ? AND item_id = ?', [req.user.id, itemId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Item not found in inventory' });
    }

    if (existing.quantity <= quantity) {
      await runAsync('DELETE FROM inventory WHERE id = ?', [existing.id]);
    } else {
      await runAsync('UPDATE inventory SET quantity = quantity - ? WHERE id = ?', [quantity, existing.id]);
    }

    res.json({ success: true, data: { removed: { itemId, quantity } } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to remove item' });
  }
});

app.post('/api/inventory/equip', authenticateToken, async (req, res) => {
  try {
    const { itemId, equip = true } = req.body;
    if (!itemId) {
      return res.status(400).json({ success: false, error: 'itemId is required' });
    }

    const item = await getAsync('SELECT * FROM inventory WHERE user_id = ? AND item_id = ?', [req.user.id, itemId]);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    // Unequip other items of same type if equipping
    if (equip) {
      await runAsync('UPDATE inventory SET equipped = 0 WHERE user_id = ? AND item_type = ? AND id != ?', [req.user.id, item.item_type, item.id]);
    }

    await runAsync('UPDATE inventory SET equipped = ? WHERE id = ?', [equip ? 1 : 0, item.id]);

    // Update room decorator achievement
    if (equip && item.item_type === 'furniture') {
      const equippedFurniture = await getAsync(
        'SELECT COUNT(*) as count FROM inventory WHERE user_id = ? AND item_type = ? AND equipped = 1',
        [req.user.id, 'furniture']
      );
      await updateAchievementProgress(req.user.id, 'room_decorator', equippedFurniture.count);
    }

    const updatedItem = await getAsync('SELECT * FROM inventory WHERE id = ?', [item.id]);
    res.json({ success: true, data: { item: updatedItem } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to equip item' });
  }
});

// =============================================================================
// FRIEND ROUTES
// =============================================================================

app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    const status = req.query.status || 'accepted';
    let sql;
    let params;

    if (status === 'pending') {
      sql = `SELECT f.id, f.requester_id, f.addressee_id, f.status, f.created_at,
              u.id as user_id, u.username, u.display_name, u.avatar_url, u.status as user_status
             FROM friends f
             JOIN users u ON f.requester_id = u.id
             WHERE f.addressee_id = ? AND f.status = 'pending'`;
      params = [req.user.id];
    } else if (status === 'sent') {
      sql = `SELECT f.id, f.requester_id, f.addressee_id, f.status, f.created_at,
              u.id as user_id, u.username, u.display_name, u.avatar_url, u.status as user_status
             FROM friends f
             JOIN users u ON f.addressee_id = u.id
             WHERE f.requester_id = ? AND f.status = 'pending'`;
      params = [req.user.id];
    } else {
      sql = `SELECT f.id, f.requester_id, f.addressee_id, f.status, f.created_at,
              u.id as user_id, u.username, u.display_name, u.avatar_url, u.status as user_status, u.last_online
             FROM friends f
             JOIN users u ON (f.requester_id = u.id OR f.addressee_id = u.id) AND u.id != ?
             WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'`;
      params = [req.user.id, req.user.id, req.user.id];
    }

    const friends = await allAsync(sql, params);
    res.json({ success: true, data: { friends, count: friends.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch friends' });
  }
});

app.post('/api/friends/request', authenticateToken, strictRateLimitMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || userId === req.user.id) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const target = await getAsync('SELECT id FROM users WHERE id = ?', [userId]);
    if (!target) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const existing = await getAsync(
      'SELECT * FROM friends WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)',
      [req.user.id, userId, userId, req.user.id]
    );
    if (existing) {
      return res.status(409).json({ success: false, error: 'Friend request already exists or you are already friends' });
    }

    await runAsync(
      'INSERT INTO friends (requester_id, addressee_id, status) VALUES (?, ?, ?)',
      [req.user.id, userId, 'pending']
    );

    // Notify via socket if online
    for (const [sid, info] of connectedUsers) {
      if (info.userId === userId) {
        io.to(sid).emit('friend_request_received', {
          requesterId: req.user.id,
          requesterName: req.user.display_name || req.user.username,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({ success: true, data: { message: 'Friend request sent' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to send friend request' });
  }
});

app.post('/api/friends/accept', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ success: false, error: 'requestId is required' });
    }

    const request = await getAsync(
      'SELECT * FROM friends WHERE id = ? AND addressee_id = ? AND status = ?',
      [requestId, req.user.id, 'pending']
    );
    if (!request) {
      return res.status(404).json({ success: false, error: 'Friend request not found' });
    }

    await runAsync(
      "UPDATE friends SET status = 'accepted', updated_at = datetime('now') WHERE id = ?",
      [requestId]
    );

    // Update achievement
    await updateAchievementProgress(req.user.id, 'friend_first', 1);
    await updateAchievementProgress(request.requester_id, 'friend_first', 1);

    // Notify requester
    for (const [sid, info] of connectedUsers) {
      if (info.userId === request.requester_id) {
        io.to(sid).emit('friend_request_accepted', {
          friendId: req.user.id,
          friendName: req.user.display_name || req.user.username,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({ success: true, data: { message: 'Friend request accepted' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to accept friend request' });
  }
});

app.post('/api/friends/decline', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.body;
    await runAsync(
      'DELETE FROM friends WHERE id = ? AND addressee_id = ? AND status = ?',
      [requestId, req.user.id, 'pending']
    );
    res.json({ success: true, data: { message: 'Friend request declined' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to decline friend request' });
  }
});

app.delete('/api/friends/:id', authenticateToken, async (req, res) => {
  try {
    const friendId = parseInt(req.params.id, 10);
    const result = await runAsync(
      'DELETE FROM friends WHERE id = ? AND (requester_id = ? OR addressee_id = ?)',
      [friendId, req.user.id, req.user.id]
    );
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Friendship not found' });
    }
    res.json({ success: true, data: { message: 'Friend removed' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to remove friend' });
  }
});

// =============================================================================
// TRADE ROUTES
// =============================================================================

app.post('/api/trades/create', authenticateToken, strictRateLimitMiddleware, async (req, res) => {
  try {
    const { recipientId, myItems = [] } = req.body;
    if (!recipientId || recipientId === req.user.id) {
      return res.status(400).json({ success: false, error: 'Invalid recipient' });
    }

    const recipient = await getAsync('SELECT id FROM users WHERE id = ?', [recipientId]);
    if (!recipient) {
      return res.status(404).json({ success: false, error: 'Recipient not found' });
    }

    // Verify all items belong to user
    for (const item of myItems) {
      const owned = await getAsync('SELECT id FROM inventory WHERE user_id = ? AND item_id = ?', [req.user.id, item.itemId]);
      if (!owned) {
        return res.status(400).json({ success: false, error: `You do not own item: ${item.itemId}` });
      }
    }

    const result = await runAsync(
      `INSERT INTO trades (initiator_id, recipient_id, initiator_items, status, expires_at)
       VALUES (?, ?, ?, 'pending', datetime('now', '+10 minutes'))`,
      [req.user.id, recipientId, JSON.stringify(myItems)]
    );

    const trade = await getAsync('SELECT * FROM trades WHERE id = ?', [result.lastID]);

    // Notify recipient via socket
    for (const [sid, info] of connectedUsers) {
      if (info.userId === recipientId) {
        io.to(sid).emit('trade_invite', {
          tradeId: trade.id,
          initiatorId: req.user.id,
          initiatorName: req.user.display_name || req.user.username,
          expiresAt: trade.expires_at
        });
      }
    }

    res.json({ success: true, data: { trade } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create trade' });
  }
});

app.post('/api/trades/accept', authenticateToken, async (req, res) => {
  try {
    const { tradeId, myItems = [] } = req.body;
    const trade = await getAsync(
      'SELECT * FROM trades WHERE id = ? AND recipient_id = ? AND status = ?',
      [tradeId, req.user.id, 'pending']
    );
    if (!trade) {
      return res.status(404).json({ success: false, error: 'Trade not found or expired' });
    }

    if (new Date(trade.expires_at) < new Date()) {
      await runAsync("UPDATE trades SET status = 'expired' WHERE id = ?", [tradeId]);
      return res.status(410).json({ success: false, error: 'Trade has expired' });
    }

    // Verify recipient's items
    for (const item of myItems) {
      const owned = await getAsync('SELECT id FROM inventory WHERE user_id = ? AND item_id = ?', [req.user.id, item.itemId]);
      if (!owned) {
        return res.status(400).json({ success: false, error: `You do not own item: ${item.itemId}` });
      }
    }

    // Simple trade execution: swap items
    const initiatorItems = JSON.parse(trade.initiator_items || '[]');

    // Transfer initiator items to recipient
    for (const item of initiatorItems) {
      await transferItem(trade.initiator_id, req.user.id, item.itemId, item.quantity || 1);
    }
    // Transfer recipient items to initiator
    for (const item of myItems) {
      await transferItem(req.user.id, trade.initiator_id, item.itemId, item.quantity || 1);
    }

    await runAsync(
      "UPDATE trades SET status = 'accepted', recipient_items = ?, updated_at = datetime('now') WHERE id = ?",
      [JSON.stringify(myItems), tradeId]
    );

    // Update trade achievement
    await updateAchievementProgress(req.user.id, 'trade_first', 1);
    await updateAchievementProgress(trade.initiator_id, 'trade_first', 1);

    io.to(`trade_${tradeId}`).emit('trade_completed', { tradeId, status: 'accepted' });

    res.json({ success: true, data: { message: 'Trade accepted and completed' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to accept trade' });
  }
});

app.post('/api/trades/cancel', authenticateToken, async (req, res) => {
  try {
    const { tradeId } = req.body;
    const trade = await getAsync(
      'SELECT * FROM trades WHERE id = ? AND (initiator_id = ? OR recipient_id = ?) AND status = ?',
      [tradeId, req.user.id, req.user.id, 'pending']
    );
    if (!trade) {
      return res.status(404).json({ success: false, error: 'Trade not found' });
    }

    await runAsync("UPDATE trades SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?", [tradeId]);
    io.to(`trade_${tradeId}`).emit('trade_cancelled', { tradeId, cancelledBy: req.user.id });

    res.json({ success: true, data: { message: 'Trade cancelled' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to cancel trade' });
  }
});

app.get('/api/trades/active', authenticateToken, async (req, res) => {
  try {
    const trades = await allAsync(
      `SELECT t.*,
        u1.username as initiator_username, u1.display_name as initiator_display_name,
        u2.username as recipient_username, u2.display_name as recipient_display_name
       FROM trades t
       JOIN users u1 ON t.initiator_id = u1.id
       JOIN users u2 ON t.recipient_id = u2.id
       WHERE (t.initiator_id = ? OR t.recipient_id = ?) AND t.status = 'pending' AND t.expires_at > datetime('now')`,
      [req.user.id, req.user.id]
    );
    res.json({ success: true, data: { trades, count: trades.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch trades' });
  }
});

async function transferItem(fromUserId, toUserId, itemId, quantity) {
  const fromItem = await getAsync('SELECT id, quantity FROM inventory WHERE user_id = ? AND item_id = ?', [fromUserId, itemId]);
  if (!fromItem || fromItem.quantity < quantity) {
    throw new Error('Insufficient items');
  }

  if (fromItem.quantity <= quantity) {
    await runAsync('DELETE FROM inventory WHERE id = ?', [fromItem.id]);
  } else {
    await runAsync('UPDATE inventory SET quantity = quantity - ? WHERE id = ?', [quantity, fromItem.id]);
  }

  const def = await getAsync('SELECT * FROM item_definitions WHERE item_key = ?', [itemId]);
  const toItem = await getAsync('SELECT id, quantity FROM inventory WHERE user_id = ? AND item_id = ?', [toUserId, itemId]);

  if (toItem && def && def.stackable) {
    await runAsync('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [quantity, toItem.id]);
  } else {
    await runAsync(
      'INSERT INTO inventory (user_id, item_id, item_type, item_name, quantity, rarity) VALUES (?, ?, ?, ?, ?, ?)',
      [toUserId, itemId, def?.item_type || 'unknown', def?.name || itemId, quantity, def?.rarity || 'common']
    );
  }
}


// =============================================================================
// CHAT ROUTES
// =============================================================================

app.get('/api/chat/history/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);

    const messages = await allAsync(
      `SELECT id, room_id, user_id, username, message, message_type, created_at, flagged
       FROM chat_history
       WHERE room_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [roomId, limit, offset]
    );

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // chronological order
        roomId,
        limit,
        offset
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch chat history' });
  }
});

app.post('/api/chat/send', authenticateToken, strictRateLimitMiddleware, async (req, res) => {
  try {
    const { roomId, message, messageType = 'text' } = req.body;
    if (!roomId || !message) {
      return res.status(400).json({ success: false, error: 'roomId and message are required' });
    }

    const trimmed = message.trim();
    if (trimmed.length === 0 || trimmed.length > 500) {
      return res.status(400).json({ success: false, error: 'Message must be 1-500 characters' });
    }

    // Check mute
    if (req.user.muted_until && new Date(req.user.muted_until) > new Date()) {
      return res.status(403).json({ success: false, error: 'You are muted', mutedUntil: req.user.muted_until });
    }

    const flaggedWords = ['spam', 'scam', 'hack', 'exploit', 'cheat'];
    const lowerMsg = trimmed.toLowerCase();
    const flagged = flaggedWords.some(w => lowerMsg.includes(w)) ? 1 : 0;

    const result = await runAsync(
      'INSERT INTO chat_history (room_id, user_id, username, message, message_type, flagged) VALUES (?, ?, ?, ?, ?, ?)',
      [roomId, req.user.id, req.user.display_name || req.user.username, trimmed, messageType, flagged]
    );

    // Update chat achievement
    await updateAchievementProgress(req.user.id, 'chat_100', 1);

    res.json({
      success: true,
      data: {
        message: {
          id: result.lastID,
          roomId,
          userId: req.user.id,
          username: req.user.display_name || req.user.username,
          message: trimmed,
          messageType,
          createdAt: new Date().toISOString()
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// =============================================================================
// ACHIEVEMENT ROUTES
// =============================================================================

app.get('/api/achievements', authenticateToken, async (req, res) => {
  try {
    const achievements = await allAsync(
      `SELECT a.*, COALESCE(ua.current_progress, 0) as current_progress,
        COALESCE(ua.completed, 0) as completed,
        COALESCE(ua.claimed, 0) as claimed,
        ua.completed_at
       FROM achievements a
       LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
       ORDER BY a.category, a.id`,
      [req.user.id]
    );
    res.json({ success: true, data: { achievements } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch achievements' });
  }
});

app.post('/api/achievements/progress', authenticateToken, async (req, res) => {
  try {
    const { achievementKey, amount = 1 } = req.body;
    if (!achievementKey) {
      return res.status(400).json({ success: false, error: 'achievementKey is required' });
    }

    const updated = await updateAchievementProgress(req.user.id, achievementKey, amount);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update progress' });
  }
});

app.post('/api/achievements/claim', authenticateToken, async (req, res) => {
  try {
    const { achievementId } = req.body;
    if (!achievementId) {
      return res.status(400).json({ success: false, error: 'achievementId is required' });
    }

    const ua = await getAsync(
      `SELECT ua.*, a.xp_reward, a.coin_reward, a.gem_reward, a.item_reward
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_id = a.id
       WHERE ua.id = ? AND ua.user_id = ? AND ua.completed = 1 AND ua.claimed = 0`,
      [achievementId, req.user.id]
    );
    if (!ua) {
      return res.status(404).json({ success: false, error: 'Achievement not found, not completed, or already claimed' });
    }

    // Grant rewards
    await runAsync(
      'UPDATE users SET xp = xp + ?, coins = coins + ?, gems = gems + ? WHERE id = ?',
      [ua.xp_reward, ua.coin_reward, ua.gem_reward, req.user.id]
    );

    if (ua.item_reward) {
      const def = await getAsync('SELECT * FROM item_definitions WHERE item_key = ?', [ua.item_reward]);
      if (def) {
        await runAsync(
          'INSERT OR IGNORE INTO inventory (user_id, item_id, item_type, item_name, rarity) VALUES (?, ?, ?, ?, ?)',
          [req.user.id, ua.item_reward, def.item_type, def.name, def.rarity]
        );
      }
    }

    await runAsync('UPDATE user_achievements SET claimed = 1 WHERE id = ?', [ua.id]);

    res.json({
      success: true,
      data: {
        message: 'Achievement claimed',
        rewards: {
          xp: ua.xp_reward,
          coins: ua.coin_reward,
          gems: ua.gem_reward,
          item: ua.item_reward
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to claim achievement' });
  }
});

async function updateAchievementProgress(userId, achievementKey, amount) {
  const achievement = await getAsync('SELECT * FROM achievements WHERE achievement_key = ?', [achievementKey]);
  if (!achievement) return null;

  let ua = await getAsync(
    'SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?',
    [userId, achievement.id]
  );
  if (!ua) {
    const result = await runAsync(
      'INSERT INTO user_achievements (user_id, achievement_id, current_progress) VALUES (?, ?, ?)',
      [userId, achievement.id, amount]
    );
    ua = { id: result.lastID, current_progress: amount, completed: 0 };
  } else {
    await runAsync(
      'UPDATE user_achievements SET current_progress = current_progress + ? WHERE id = ?',
      [amount, ua.id]
    );
    ua.current_progress += amount;
  }

  if (ua.current_progress >= achievement.target_progress && !ua.completed) {
    await runAsync(
      "UPDATE user_achievements SET completed = 1, completed_at = datetime('now') WHERE id = ?",
      [ua.id]
    );
    ua.completed = 1;

    // Notify via socket if user is online
    for (const [sid, info] of connectedUsers) {
      if (info.userId === userId) {
        io.to(sid).emit('achievement_unlocked', {
          achievementKey,
          name: achievement.name,
          xpReward: achievement.xp_reward,
          coinReward: achievement.coin_reward
        });
      }
    }
  }

  return { achievement, currentProgress: ua.current_progress, completed: ua.completed };
}

// =============================================================================
// BATTLE PASS ROUTES
// =============================================================================

app.get('/api/battlepass', authenticateToken, async (req, res) => {
  try {
    const season = await getAsync('SELECT * FROM battle_pass_seasons WHERE is_active = 1 ORDER BY season_number DESC LIMIT 1');
    if (!season) {
      return res.json({ success: true, data: { season: null, message: 'No active battle pass season' } });
    }

    const userProgress = await getAsync(
      'SELECT * FROM user_battle_pass WHERE user_id = ? AND season_id = ?',
      [req.user.id, season.id]
    );

    const tiers = await allAsync(
      'SELECT * FROM battle_pass_tiers WHERE season_id = ? ORDER BY tier_number',
      [season.id]
    );

    res.json({
      success: true,
      data: {
        season,
        progress: userProgress || { current_tier: 0, current_xp: 0, purchased: 0 },
        tiers
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch battle pass' });
  }
});

app.post('/api/battlepass/progress', authenticateToken, async (req, res) => {
  try {
    const { xpAmount } = req.body;
    if (!xpAmount || xpAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid xpAmount required' });
    }

    const season = await getAsync('SELECT * FROM battle_pass_seasons WHERE is_active = 1 ORDER BY season_number DESC LIMIT 1');
    if (!season) {
      return res.status(400).json({ success: false, error: 'No active battle pass season' });
    }

    let progress = await getAsync(
      'SELECT * FROM user_battle_pass WHERE user_id = ? AND season_id = ?',
      [req.user.id, season.id]
    );

    if (!progress) {
      const result = await runAsync(
        'INSERT INTO user_battle_pass (user_id, season_id, current_xp) VALUES (?, ?, ?)',
        [req.user.id, season.id, xpAmount]
      );
      progress = { id: result.lastID, current_tier: 0, current_xp: xpAmount };
    } else {
      await runAsync(
        'UPDATE user_battle_pass SET current_xp = current_xp + ? WHERE id = ?',
        [xpAmount, progress.id]
      );
      progress.current_xp += xpAmount;
    }

    // Check for tier ups
    let tierUps = 0;
    while (true) {
      const nextTier = await getAsync(
        'SELECT * FROM battle_pass_tiers WHERE season_id = ? AND tier_number = ?',
        [season.id, progress.current_tier + 1]
      );
      if (!nextTier || progress.current_xp < nextTier.xp_required) break;

      progress.current_tier += 1;
      progress.current_xp -= nextTier.xp_required;
      tierUps += 1;

      // Notify tier up
      for (const [sid, info] of connectedUsers) {
        if (info.userId === req.user.id) {
          io.to(sid).emit('battle_pass_tier_up', {
            tier: progress.current_tier,
            seasonId: season.id,
            freeReward: nextTier.free_reward_item,
            premiumReward: nextTier.premium_reward_item
          });
        }
      }
    }

    await runAsync(
      'UPDATE user_battle_pass SET current_tier = ?, current_xp = ? WHERE id = ?',
      [progress.current_tier, progress.current_xp, progress.id]
    );

    res.json({
      success: true,
      data: {
        seasonId: season.id,
        currentTier: progress.current_tier,
        currentXp: progress.current_xp,
        tierUps
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update battle pass progress' });
  }
});

app.post('/api/battlepass/purchase', authenticateToken, async (req, res) => {
  try {
    const season = await getAsync('SELECT * FROM battle_pass_seasons WHERE is_active = 1 ORDER BY season_number DESC LIMIT 1');
    if (!season) {
      return res.status(400).json({ success: false, error: 'No active battle pass season' });
    }

    let progress = await getAsync(
      'SELECT * FROM user_battle_pass WHERE user_id = ? AND season_id = ?',
      [req.user.id, season.id]
    );

    if (progress && progress.purchased) {
      return res.status(400).json({ success: false, error: 'Battle pass already purchased' });
    }

    const user = await getAsync('SELECT gems FROM users WHERE id = ?', [req.user.id]);
    if (user.gems < 500) {
      return res.status(400).json({ success: false, error: 'Insufficient gems (500 required)' });
    }

    await runAsync('UPDATE users SET gems = gems - 500 WHERE id = ?', [req.user.id]);

    if (!progress) {
      await runAsync(
        'INSERT INTO user_battle_pass (user_id, season_id, purchased) VALUES (?, ?, 1)',
        [req.user.id, season.id]
      );
    } else {
      await runAsync('UPDATE user_battle_pass SET purchased = 1 WHERE id = ?', [progress.id]);
    }

    await updateAchievementProgress(req.user.id, 'battle_pass_1', 1);

    res.json({ success: true, data: { message: 'Battle pass purchased successfully' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to purchase battle pass' });
  }
});

// =============================================================================
// ADMIN ROUTES
// =============================================================================

app.get('/api/admin/reports', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status = 'open', limit = 50, offset = 0 } = req.query;
    const reports = await allAsync(
      `SELECT r.*,
        reporter.username as reporter_username,
        reported.username as reported_username,
        moderator.username as moderator_username
       FROM reports r
       JOIN users reporter ON r.reporter_id = reporter.id
       JOIN users reported ON r.reported_id = reported.id
       LEFT JOIN users moderator ON r.moderator_id = moderator.id
       WHERE r.status = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [status, parseInt(limit), parseInt(offset)]
    );
    res.json({ success: true, data: { reports, count: reports.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch reports' });
  }
});

app.post('/api/admin/reports/:id/resolve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    const { resolution, action } = req.body;

    await runAsync(
      'UPDATE reports SET status = ?, resolution = ?, moderator_id = ?, resolved_at = datetime("now") WHERE id = ?',
      ['resolved', resolution || 'Resolved by moderator', req.user.id, reportId]
    );

    // If action requested (mute/ban), get the report details
    if (action === 'mute' || action === 'ban') {
      const report = await getAsync('SELECT * FROM reports WHERE id = ?', [reportId]);
      if (report) {
        if (action === 'mute') {
          await runAsync(
            'UPDATE users SET muted_until = datetime("now", "+24 hours") WHERE id = ?',
            [report.reported_id]
          );
        }
      }
    }

    res.json({ success: true, data: { message: 'Report resolved' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to resolve report' });
  }
});

app.post('/api/admin/mute', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, durationHours = 24, reason } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    await runAsync(
      'UPDATE users SET muted_until = datetime("now", ?) WHERE id = ?',
      [`+${durationHours} hours`, userId]
    );

    // Notify user if online
    for (const [sid, info] of connectedUsers) {
      if (info.userId === userId) {
        io.to(sid).emit('muted', { durationHours, reason, until: new Date(Date.now() + durationHours * 3600000).toISOString() });
      }
    }

    res.json({ success: true, data: { message: `User muted for ${durationHours} hours` } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mute user' });
  }
});

app.post('/api/admin/ban', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, durationHours, reason } = req.body;
    if (!userId || !reason) {
      return res.status(400).json({ success: false, error: 'userId and reason are required' });
    }

    const banType = durationHours ? 'temporary' : 'permanent';
    const expiresAt = durationHours ? `datetime("now", "+${durationHours} hours")` : null;

    await runAsync(
      'UPDATE users SET banned_until = ?, ban_reason = ? WHERE id = ?',
      [expiresAt ? `datetime("now", "+${durationHours} hours")` : null, reason, userId]
    );

    const result = await runAsync(
      `INSERT INTO bans (user_id, moderator_id, ban_type, reason, duration_hours, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, req.user.id, banType, reason, durationHours || 0, expiresAt ? `datetime("now", "+${durationHours} hours")` : null]
    );

    // Disconnect banned user if online
    for (const [sid, info] of connectedUsers) {
      if (info.userId === userId) {
        io.to(sid).emit('banned', { reason, durationHours, banType });
        setTimeout(() => {
          const socket = io.sockets.sockets.get(sid);
          if (socket) socket.disconnect(true);
        }, 2000);
      }
    }

    res.json({ success: true, data: { message: `User ${banType === 'permanent' ? 'permanently' : 'temporarily'} banned` } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to ban user' });
  }
});

app.post('/api/admin/unban', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    await runAsync('UPDATE users SET banned_until = NULL, ban_reason = NULL WHERE id = ?', [userId]);
    await runAsync(
      'UPDATE bans SET is_active = 0, unbanned_at = datetime("now"), unbanned_by = ? WHERE user_id = ? AND is_active = 1',
      [req.user.id, userId]
    );

    res.json({ success: true, data: { message: 'User unbanned' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to unban user' });
  }
});

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { search, role, status, limit = 50, offset = 0 } = req.query;
    let sql = `SELECT id, username, display_name, email, role, status, last_online, created_at, coins, gems, xp, level, muted_until, banned_until
               FROM users WHERE 1=1`;
    const params = [];

    if (search) {
      sql += ' AND (username LIKE ? OR display_name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const users = await allAsync(sql, params);

    const totalResult = await getAsync(
      'SELECT COUNT(*) as total FROM users WHERE 1=1',
      []
    );

    res.json({ success: true, data: { users, total: totalResult?.total || 0, limit, offset } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await getAsync('SELECT COUNT(*) as count FROM users');
    const onlineUsers = await getAsync("SELECT COUNT(*) as count FROM users WHERE status = 'online'");
    const totalTrades = await getAsync('SELECT COUNT(*) as count FROM trades');
    const activeTrades = await getAsync("SELECT COUNT(*) as count FROM trades WHERE status = 'pending'");
    const totalReports = await getAsync('SELECT COUNT(*) as count FROM reports');
    const openReports = await getAsync("SELECT COUNT(*) as count FROM reports WHERE status = 'open'");
    const activeBans = await getAsync("SELECT COUNT(*) as count FROM bans WHERE is_active = 1");
    const totalChat = await getAsync('SELECT COUNT(*) as count FROM chat_history');

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers.count,
        onlineUsers: onlineUsers.count,
        totalTrades: totalTrades.count,
        activeTrades: activeTrades.count,
        totalReports: totalReports.count,
        openReports: openReports.count,
        activeBans: activeBans.count,
        totalChatMessages: totalChat.count
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});


// =============================================================================
// ROOM ROUTES
// =============================================================================

app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const { type } = req.query;
    let sql = 'SELECT * FROM rooms WHERE enabled = 1';
    const params = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY type, name';
    const rooms = await allAsync(sql, params);

    // Add real-time occupancy from memory
    const roomsWithOccupancy = rooms.map(room => ({
      ...room,
      live_occupancy: activeRooms.get(room.room_key)?.size || 0
    }));

    res.json({ success: true, data: { rooms: roomsWithOccupancy } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch rooms' });
  }
});

app.get('/api/rooms/:roomId', authenticateToken, async (req, res) => {
  try {
    const room = await getAsync('SELECT * FROM rooms WHERE room_key = ? AND enabled = 1', [req.params.roomId]);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Get players in room
    const players = [];
    const roomPositions = playerPositions.get(req.params.roomId);
    if (roomPositions) {
      for (const [userId, pos] of roomPositions) {
        players.push({ userId, ...pos });
      }
    }

    res.json({
      success: true,
      data: {
        room: {
          ...room,
          live_occupancy: players.length
        },
        players
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch room' });
  }
});

// =============================================================================
// REPORT ROUTES (User-facing)
// =============================================================================

app.post('/api/reports', authenticateToken, strictRateLimitMiddleware, async (req, res) => {
  try {
    const { reportedId, reportType, reason, evidence } = req.body;
    if (!reportedId || !reportType || !reason) {
      return res.status(400).json({ success: false, error: 'reportedId, reportType, and reason are required' });
    }

    const validTypes = ['spam', 'harassment', 'cheating', 'inappropriate', 'scam', 'other'];
    if (!validTypes.includes(reportType)) {
      return res.status(400).json({ success: false, error: 'Invalid report type' });
    }

    const reported = await getAsync('SELECT id FROM users WHERE id = ?', [reportedId]);
    if (!reported) {
      return res.status(404).json({ success: false, error: 'Reported user not found' });
    }

    const result = await runAsync(
      'INSERT INTO reports (reporter_id, reported_id, report_type, reason, evidence) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, reportedId, reportType, reason, evidence || '']
    );

    res.json({ success: true, data: { reportId: result.lastID, message: 'Report submitted successfully' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to submit report' });
  }
});

app.get('/api/reports/my', authenticateToken, async (req, res) => {
  try {
    const reports = await allAsync(
      `SELECT r.*, u.username as reported_username
       FROM reports r
       JOIN users u ON r.reported_id = u.id
       WHERE r.reporter_id = ?
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: { reports } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch reports' });
  }
});

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/health', async (req, res) => {
  try {
    await getAsync('SELECT 1');
    const memoryUsage = process.memoryUsage();

    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '7.0.0',
        environment: NODE_ENV,
        database: 'connected',
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024)
        },
        connections: {
          socketConnections: connectedUsers.size,
          activeRooms: activeRooms.size
        }
      }
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      details: err.message
    });
  }
});

// =============================================================================
// LEADERBOARD ROUTES
// =============================================================================

app.get('/api/leaderboard/xp', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const players = await allAsync(
      'SELECT id, username, display_name, avatar_url, xp, level FROM users ORDER BY xp DESC LIMIT ?',
      [limit]
    );
    res.json({ success: true, data: { players, type: 'xp' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

app.get('/api/leaderboard/coins', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const players = await allAsync(
      'SELECT id, username, display_name, avatar_url, coins FROM users ORDER BY coins DESC LIMIT ?',
      [limit]
    );
    res.json({ success: true, data: { players, type: 'coins' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

// =============================================================================
// ITEM SHOP / CATALOG ROUTES
// =============================================================================

app.get('/api/shop/items', authenticateToken, async (req, res) => {
  try {
    const { type, rarity } = req.query;
    let sql = 'SELECT * FROM item_definitions WHERE 1=1';
    const params = [];

    if (type) {
      sql += ' AND item_type = ?';
      params.push(type);
    }
    if (rarity) {
      sql += ' AND rarity = ?';
      params.push(rarity);
    }

    sql += ' ORDER BY item_type, rarity DESC, name';
    const items = await allAsync(sql, params);
    res.json({ success: true, data: { items } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch shop items' });
  }
});

app.post('/api/shop/purchase', authenticateToken, strictRateLimitMiddleware, async (req, res) => {
  try {
    const { itemKey } = req.body;
    if (!itemKey) {
      return res.status(400).json({ success: false, error: 'itemKey is required' });
    }

    const item = await getAsync('SELECT * FROM item_definitions WHERE item_key = ?', [itemKey]);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const user = await getAsync('SELECT coins, gems FROM users WHERE id = ?', [req.user.id]);
    if (item.price_coins > 0 && user.coins < item.price_coins) {
      return res.status(400).json({ success: false, error: 'Insufficient coins' });
    }
    if (item.price_gems > 0 && user.gems < item.price_gems) {
      return res.status(400).json({ success: false, error: 'Insufficient gems' });
    }

    await runAsync(
      'UPDATE users SET coins = coins - ?, gems = gems - ? WHERE id = ?',
      [item.price_coins, item.price_gems, req.user.id]
    );

    await runAsync(
      'INSERT OR IGNORE INTO inventory (user_id, item_id, item_type, item_name, rarity) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, itemKey, item.item_type, item.name, item.rarity]
    );

    await updateAchievementProgress(req.user.id, 'collector_10', 1);

    res.json({
      success: true,
      data: {
        message: 'Purchase successful',
        item: { key: itemKey, name: item.name, type: item.item_type }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Purchase failed' });
  }
});

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

app.get('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await allAsync(
      'SELECT id, ip_address, user_agent, created_at, last_active, is_active FROM sessions WHERE user_id = ? ORDER BY last_active DESC',
      [req.user.id]
    );
    res.json({ success: true, data: { sessions } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
});

app.delete('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    const result = await runAsync(
      'UPDATE sessions SET is_active = 0 WHERE id = ? AND user_id = ?',
      [sessionId, req.user.id]
    );
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({ success: true, data: { message: 'Session revoked' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to revoke session' });
  }
});

// =============================================================================
// NOTIFICATIONS (In-memory + stored)
// =============================================================================

const notifications = new Map(); // userId -> Array of notifications

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const userNotifs = notifications.get(req.user.id) || [];
    res.json({ success: true, data: { notifications: userNotifs } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const notifId = req.params.id;
    const userNotifs = notifications.get(req.user.id) || [];
    const filtered = userNotifs.filter(n => n.id !== notifId);
    notifications.set(req.user.id, filtered);
    res.json({ success: true, data: { message: 'Notification dismissed' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to dismiss notification' });
  }
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found', path: req.path });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
    stack: NODE_ENV === 'development' ? err.stack : undefined
  });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

const cleanupInterval = setInterval(async () => {
  try {
    // Clean up expired sessions
    await runAsync('DELETE FROM sessions WHERE expires_at < datetime("now", "-7 days")');
    // Clean up expired trades
    await runAsync('UPDATE trades SET status = \'expired\' WHERE status = \'pending\' AND expires_at < datetime("now")');
    // Clean up old chat history (>30 days)
    await runAsync('DELETE FROM chat_history WHERE created_at < datetime("now", "-30 days")');
    // Update room occupancy from actual socket state
    for (const [roomKey, sockets] of activeRooms) {
      await runAsync('UPDATE rooms SET current_occupancy = ? WHERE room_key = ?', [sockets.size, roomKey]);
    }
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}, 60000); // Run every minute

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nSIGTERM received. Starting graceful shutdown...');
  clearInterval(cleanupInterval);
  httpServer.close(() => {
    console.log('HTTP server closed.');
    db.close((err) => {
      if (err) console.error('Database close error:', err);
      else console.log('Database connection closed.');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received. Starting graceful shutdown...');
  clearInterval(cleanupInterval);
  httpServer.close(() => {
    console.log('HTTP server closed.');
    db.close((err) => {
      if (err) console.error('Database close error:', err);
      else console.log('Database connection closed.');
      process.exit(0);
    });
  });
});

// Unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
httpServer.listen(PORT, () => {
  console.log('========================================');
  console.log(' Starlight Inn v7.0 Server ');
  console.log('========================================');
  console.log(` Environment: ${NODE_ENV}`);
  console.log(` HTTP Port:   ${PORT}`);
  console.log(` CORS Origin: ${CORS_ORIGIN}`);
  console.log(` Database:    ${process.env.DB_PATH || './data/starlightinn.db'}`);
  console.log(` Rate Limit:  ${process.env.RATE_LIMIT_MAX_REQUESTS || 100}/min`);
  console.log('========================================');
});

// =============================================================================
// EXPORTS (for testing)
// =============================================================================

module.exports = { app, httpServer, io, db };
