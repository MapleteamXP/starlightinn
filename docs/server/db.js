/**
 * Starlight Inn v7.0 - Database Module
 * SQLite3 with WAL mode, migrations, seed data, and utility functions
 * ~600 lines
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

require('dotenv').config();

const DB_DIR = path.dirname(process.env.DB_PATH || './data/starlightinn.db');
const DB_PATH = process.env.DB_PATH || './data/starlightinn.db';

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database at', DB_PATH);
});

// Enable WAL mode for better concurrency
db.run('PRAGMA journal_mode = WAL;', (err) => {
  if (err) {
    console.error('Failed to enable WAL mode:', err.message);
  } else {
    console.log('WAL mode enabled for SQLite');
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON;', (err) => {
  if (err) {
    console.error('Failed to enable foreign keys:', err.message);
  }
});

// =============================================================================
// TABLE SCHEMAS
// =============================================================================

const TABLES = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      display_name TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      role TEXT DEFAULT 'player' CHECK(role IN ('player', 'moderator', 'admin')),
      status TEXT DEFAULT 'offline' CHECK(status IN ('online', 'offline', 'away', 'in_game')),
      last_online DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      coins INTEGER DEFAULT 0,
      gems INTEGER DEFAULT 0,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      battle_pass_tier INTEGER DEFAULT 0,
      battle_pass_purchased INTEGER DEFAULT 0,
      battle_pass_xp INTEGER DEFAULT 0,
      muted_until DATETIME,
      banned_until DATETIME,
      ban_reason TEXT,
      profile_data TEXT DEFAULT '{}'  -- JSON string for extensibility
    )
  `,

  inventory: `
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL CHECK(item_type IN ('furniture', 'clothing', 'badge', 'consumable', 'currency', 'emote', 'pet')),
      item_name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      equipped INTEGER DEFAULT 0,
      rarity TEXT DEFAULT 'common' CHECK(rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
      metadata TEXT DEFAULT '{}',
      acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, item_id)
    )
  `,

  friends: `
    CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      addressee_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'blocked')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(requester_id, addressee_id)
    )
  `,

  trades: `
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      initiator_id INTEGER NOT NULL,
      recipient_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
      initiator_items TEXT DEFAULT '[]',  -- JSON array of item objects
      recipient_items TEXT DEFAULT '[]',
      initiator_confirmed INTEGER DEFAULT 0,
      recipient_confirmed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME DEFAULT (datetime('now', '+10 minutes')),
      FOREIGN KEY (initiator_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  chat_history: `
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      message_type TEXT DEFAULT 'text' CHECK(message_type IN ('text', 'emote', 'system', 'trade', 'friend')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      moderated INTEGER DEFAULT 0,
      flagged INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  achievements: `
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      achievement_key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      icon_url TEXT DEFAULT '',
      xp_reward INTEGER DEFAULT 0,
      coin_reward INTEGER DEFAULT 0,
      gem_reward INTEGER DEFAULT 0,
      item_reward TEXT DEFAULT '',
      target_progress INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  user_achievements: `
    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      current_progress INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      claimed INTEGER DEFAULT 0,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
      UNIQUE(user_id, achievement_id)
    )
  `,

  rooms: `
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      max_capacity INTEGER DEFAULT 50,
      current_occupancy INTEGER DEFAULT 0,
      type TEXT DEFAULT 'public' CHECK(type IN ('public', 'private', 'premium', 'event')),
      owner_id INTEGER,
      layout_data TEXT DEFAULT '{}',
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `,

  reports: `
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      reported_id INTEGER NOT NULL,
      report_type TEXT NOT NULL CHECK(report_type IN ('spam', 'harassment', 'cheating', 'inappropriate', 'scam', 'other')),
      reason TEXT NOT NULL,
      evidence TEXT DEFAULT '',
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'investigating', 'resolved', 'dismissed')),
      moderator_id INTEGER,
      resolution TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reported_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `,

  bans: `
    CREATE TABLE IF NOT EXISTS bans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      moderator_id INTEGER NOT NULL,
      ban_type TEXT DEFAULT 'temporary' CHECK(ban_type IN ('temporary', 'permanent')),
      reason TEXT NOT NULL,
      duration_hours INTEGER DEFAULT 24,
      banned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      unbanned_at DATETIME,
      unbanned_by INTEGER,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (unbanned_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `,

  sessions: `
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      refresh_token TEXT UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  battle_pass_seasons: `
    CREATE TABLE IF NOT EXISTS battle_pass_seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_number INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      total_tiers INTEGER DEFAULT 100,
      is_active INTEGER DEFAULT 0
    )
  `,

  battle_pass_tiers: `
    CREATE TABLE IF NOT EXISTS battle_pass_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL,
      tier_number INTEGER NOT NULL,
      xp_required INTEGER NOT NULL,
      free_reward_item TEXT,
      premium_reward_item TEXT,
      FOREIGN KEY (season_id) REFERENCES battle_pass_seasons(id) ON DELETE CASCADE,
      UNIQUE(season_id, tier_number)
    )
  `,

  user_battle_pass: `
    CREATE TABLE IF NOT EXISTS user_battle_pass (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      season_id INTEGER NOT NULL,
      current_tier INTEGER DEFAULT 0,
      current_xp INTEGER DEFAULT 0,
      purchased INTEGER DEFAULT 0,
      claimed_rewards TEXT DEFAULT '[]',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (season_id) REFERENCES battle_pass_seasons(id) ON DELETE CASCADE,
      UNIQUE(user_id, season_id)
    )
  `,

  item_definitions: `
    CREATE TABLE IF NOT EXISTS item_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      item_type TEXT NOT NULL,
      rarity TEXT DEFAULT 'common',
      price_coins INTEGER DEFAULT 0,
      price_gems INTEGER DEFAULT 0,
      tradable INTEGER DEFAULT 1,
      stackable INTEGER DEFAULT 1,
      icon_url TEXT DEFAULT '',
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
};

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
  'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
  'CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_inventory_equipped ON inventory(user_id, equipped)',
  'CREATE INDEX IF NOT EXISTS idx_friends_requester ON friends(requester_id)',
  'CREATE INDEX IF NOT EXISTS idx_friends_addressee ON friends(addressee_id)',
  'CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status)',
  'CREATE INDEX IF NOT EXISTS idx_trades_initiator ON trades(initiator_id)',
  'CREATE INDEX IF NOT EXISTS idx_trades_recipient ON trades(recipient_id)',
  'CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)',
  'CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_history(room_id)',
  'CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_history(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_history(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)',
  'CREATE INDEX IF NOT EXISTS idx_bans_user ON bans(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_bans_active ON bans(is_active)',
  'CREATE INDEX IF NOT EXISTS idx_rooms_key ON rooms(room_key)'
];

// =============================================================================
// MIGRATIONS
// =============================================================================

const MIGRATIONS = [
  {
    version: 1,
    name: 'Initial schema',
    up: async () => {
      for (const [name, sql] of Object.entries(TABLES)) {
        await runAsync(sql);
        console.log(`  Table created: ${name}`);
      }
      for (const sql of INDEXES) {
        await runAsync(sql);
      }
    }
  },
  {
    version: 2,
    name: 'Add battle pass tables',
    up: async () => {
      await runAsync(TABLES.battle_pass_seasons);
      await runAsync(TABLES.battle_pass_tiers);
      await runAsync(TABLES.user_battle_pass);
    }
  },
  {
    version: 3,
    name: 'Add item definitions table',
    up: async () => {
      await runAsync(TABLES.item_definitions);
    }
  }
];

// =============================================================================
// SEED DATA
// =============================================================================

const SEED_DATA = {
  async seedItemDefinitions() {
    const items = [
      { item_key: 'starter_hat', name: 'Starter Hat', description: 'A simple hat for new adventurers', item_type: 'clothing', rarity: 'common', price_coins: 0, icon_url: '/items/starter_hat.png' },
      { item_key: 'starter_shirt', name: 'Starter Shirt', description: 'Basic adventuring gear', item_type: 'clothing', rarity: 'common', price_coins: 0, icon_url: '/items/starter_shirt.png' },
      { item_key: 'wooden_chair', name: 'Wooden Chair', description: 'A sturdy wooden chair for your room', item_type: 'furniture', rarity: 'common', price_coins: 50, icon_url: '/items/wooden_chair.png' },
      { item_key: 'oak_table', name: 'Oak Table', description: 'A handcrafted oak table', item_type: 'furniture', rarity: 'uncommon', price_coins: 150, icon_url: '/items/oak_table.png' },
      { item_key: 'crystal_lamp', name: 'Crystal Lamp', description: 'Emits a soft magical glow', item_type: 'furniture', rarity: 'rare', price_coins: 500, icon_url: '/items/crystal_lamp.png' },
      { item_key: 'gold_badge', name: 'Gold Badge', description: 'A badge of honor', item_type: 'badge', rarity: 'legendary', price_gems: 100, icon_url: '/items/gold_badge.png' },
      { item_key: 'health_potion', name: 'Health Potion', description: 'Restores vitality', item_type: 'consumable', rarity: 'common', price_coins: 25, stackable: 1, icon_url: '/items/health_potion.png' },
      { item_key: 'starlight_pet', name: 'Starlight Companion', description: 'A small glowing creature', item_type: 'pet', rarity: 'epic', price_gems: 250, icon_url: '/items/starlight_pet.png' },
      { item_key: 'emote_wave', name: 'Wave Emote', description: 'Friendly greeting', item_type: 'emote', rarity: 'common', price_coins: 100, icon_url: '/items/emote_wave.png' },
      { item_key: 'emote_dance', name: 'Dance Emote', description: 'Show off your moves', item_type: 'emote', rarity: 'uncommon', price_coins: 250, icon_url: '/items/emote_dance.png' }
    ];
    const stmt = db.prepare(`INSERT OR IGNORE INTO item_definitions 
      (item_key, name, description, item_type, rarity, price_coins, price_gems, stackable, icon_url) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const item of items) {
      stmt.run(item.item_key, item.name, item.description, item.item_type, item.rarity, item.price_coins, item.price_gems, item.stackable, item.icon_url);
    }
    stmt.finalize();
    console.log(`  Seeded ${items.length} item definitions`);
  },

  async seedAchievements() {
    const achievements = [
      { achievement_key: 'first_login', name: 'First Steps', description: 'Log in for the first time', category: 'general', xp_reward: 10, coin_reward: 50, target_progress: 1 },
      { achievement_key: 'friend_first', name: 'Making Friends', description: 'Add your first friend', category: 'social', xp_reward: 25, coin_reward: 100, target_progress: 1 },
      { achievement_key: 'chat_100', name: 'Chatterbox', description: 'Send 100 chat messages', category: 'social', xp_reward: 50, coin_reward: 200, target_progress: 100 },
      { achievement_key: 'trade_first', name: 'Trader', description: 'Complete your first trade', category: 'economy', xp_reward: 30, coin_reward: 150, target_progress: 1 },
      { achievement_key: 'level_10', name: 'Rising Star', description: 'Reach level 10', category: 'progression', xp_reward: 100, gem_reward: 10, target_progress: 10 },
      { achievement_key: 'level_50', name: 'Seasoned Adventurer', description: 'Reach level 50', category: 'progression', xp_reward: 500, gem_reward: 50, target_progress: 50 },
      { achievement_key: 'collector_10', name: 'Collector', description: 'Own 10 different items', category: 'economy', xp_reward: 40, coin_reward: 200, target_progress: 10 },
      { achievement_key: 'room_decorator', name: 'Interior Designer', description: 'Place 5 furniture items in your room', category: 'creative', xp_reward: 35, coin_reward: 150, target_progress: 5 },
      { achievement_key: 'battle_pass_1', name: 'Pass Holder', description: 'Purchase a battle pass', category: 'progression', xp_reward: 50, gem_reward: 5, target_progress: 1 },
      { achievement_key: 'report_helpful', name: 'Community Guardian', description: 'Submit a report that leads to action', category: 'general', xp_reward: 20, coin_reward: 100, target_progress: 1 }
    ];
    const stmt = db.prepare(`INSERT OR IGNORE INTO achievements 
      (achievement_key, name, description, category, xp_reward, coin_reward, gem_reward, target_progress) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const ach of achievements) {
      stmt.run(ach.achievement_key, ach.name, ach.description, ach.category, ach.xp_reward, ach.coin_reward, ach.gem_reward, ach.target_progress);
    }
    stmt.finalize();
    console.log(`  Seeded ${achievements.length} achievements`);
  },

  async seedRooms() {
    const rooms = [
      { room_key: 'lobby', name: 'Grand Lobby', description: 'The main gathering place for all adventurers', max_capacity: 100, type: 'public' },
      { room_key: 'market', name: 'Marketplace', description: 'Trade items and meet merchants', max_capacity: 75, type: 'public' },
      { room_key: 'tavern', name: 'Starlight Tavern', description: 'Relax, chat, and make friends', max_capacity: 60, type: 'public' },
      { room_key: 'arena', name: 'Battle Arena', description: 'Competitive events and challenges', max_capacity: 50, type: 'public' },
      { room_key: 'gardens', name: 'Moonlit Gardens', description: 'A peaceful outdoor space', max_capacity: 40, type: 'public' },
      { room_key: 'premium_lounge', name: 'Premium Lounge', description: 'Exclusive area for premium members', max_capacity: 30, type: 'premium' },
      { room_key: 'event_hall', name: 'Event Hall', description: 'Special events and seasonal activities', max_capacity: 200, type: 'event' }
    ];
    const stmt = db.prepare(`INSERT OR IGNORE INTO rooms 
      (room_key, name, description, max_capacity, type) 
      VALUES (?, ?, ?, ?, ?)`);
    for (const room of rooms) {
      stmt.run(room.room_key, room.name, room.description, room.max_capacity, room.type);
    }
    stmt.finalize();
    console.log(`  Seeded ${rooms.length} rooms`);
  },

  async seedUsers() {
    const adminPassword = await bcrypt.hash(process.env.ADMIN_DEFAULT_PASSWORD || 'admin123', 12);
    const testPassword = await bcrypt.hash('test123', 12);

    const users = [
      { username: process.env.ADMIN_DEFAULT_USERNAME || 'admin', email: 'admin@starlightinn.game', password_hash: adminPassword, display_name: 'Game Master', role: 'admin', coins: 999999, gems: 9999, level: 100 },
      { username: 'testplayer1', email: 'test1@starlightinn.game', password_hash: testPassword, display_name: 'Test Player One', role: 'player', coins: 1000, gems: 50, level: 5 },
      { username: 'testplayer2', email: 'test2@starlightinn.game', password_hash: testPassword, display_name: 'Test Player Two', role: 'player', coins: 500, gems: 20, level: 3 },
      { username: 'moderator_jane', email: 'mod@starlightinn.game', password_hash: testPassword, display_name: 'Moderator Jane', role: 'moderator', coins: 5000, gems: 200, level: 50 }
    ];
    const stmt = db.prepare(`INSERT OR IGNORE INTO users 
      (username, display_name, email, password_hash, role, coins, gems, level) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const user of users) {
      stmt.run(user.username, user.display_name, user.email, user.password_hash, user.role, user.coins, user.gems, user.level);
    }
    stmt.finalize();
    console.log(`  Seeded ${users.length} users`);
  },

  async seedStarterInventory() {
    const starterItems = [
      { username: 'testplayer1', item_id: 'starter_hat', item_type: 'clothing', item_name: 'Starter Hat', equipped: 1 },
      { username: 'testplayer1', item_id: 'starter_shirt', item_type: 'clothing', item_name: 'Starter Shirt', equipped: 1 },
      { username: 'testplayer1', item_id: 'emote_wave', item_type: 'emote', item_name: 'Wave Emote', equipped: 0 },
      { username: 'testplayer2', item_id: 'starter_hat', item_type: 'clothing', item_name: 'Starter Hat', equipped: 1 },
      { username: 'testplayer2', item_id: 'emote_dance', item_type: 'emote', item_name: 'Dance Emote', equipped: 0 }
    ];
    const userStmt = db.prepare('SELECT id FROM users WHERE username = ?');
    const invStmt = db.prepare(`INSERT OR IGNORE INTO inventory 
      (user_id, item_id, item_type, item_name, equipped) 
      VALUES (?, ?, ?, ?, ?)`);
    for (const item of starterItems) {
      userStmt.get(item.username, (err, row) => {
        if (!err && row) {
          invStmt.run(row.id, item.item_id, item.item_type, item.item_name, item.equipped);
        }
      });
    }
    userStmt.finalize();
    invStmt.finalize();
    console.log(`  Seeded starter inventory`);
  },

  async seedBattlePass() {
    const season = { season_number: 1, name: 'Season of Starlight', start_date: '2024-01-01', end_date: '2024-12-31', total_tiers: 100, is_active: 1 };
    await runAsync(`INSERT OR IGNORE INTO battle_pass_seasons 
      (season_number, name, start_date, end_date, total_tiers, is_active) 
      VALUES (?, ?, ?, ?, ?, ?)`, 
      [season.season_number, season.name, season.start_date, season.end_date, season.total_tiers, season.is_active]);

    const tiers = [];
    for (let i = 1; i <= 100; i++) {
      const xpReq = i * 100;
      const freeReward = i % 10 === 0 ? `tier_${i}_free_reward` : (i <= 5 ? `tier_${i}_free_reward` : null);
      const premiumReward = `tier_${i}_premium_reward`;
      tiers.push({ tier_number: i, xp_required: xpReq, free_reward: freeReward, premium_reward: premiumReward });
    }
    const stmt = db.prepare(`INSERT OR IGNORE INTO battle_pass_tiers 
      (season_id, tier_number, xp_required, free_reward_item, premium_reward_item) 
      VALUES ((SELECT id FROM battle_pass_seasons WHERE season_number = 1), ?, ?, ?, ?)`);
    for (const tier of tiers) {
      stmt.run(tier.tier_number, tier.xp_required, tier.free_reward, tier.premium_reward);
    }
    stmt.finalize();
    console.log(`  Seeded battle pass season 1 with ${tiers.length} tiers`);
  }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// =============================================================================
// MIGRATION SYSTEM
// =============================================================================

async function initializeMigrationsTable() {
  await runAsync(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

async function getCurrentVersion() {
  try {
    const row = await getAsync('SELECT MAX(version) as version FROM schema_migrations');
    return row ? row.version || 0 : 0;
  } catch {
    return 0;
  }
}

async function applyMigrations() {
  await initializeMigrationsTable();
  const currentVersion = await getCurrentVersion();
  console.log(`Current schema version: ${currentVersion}`);

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      console.log(`Applying migration ${migration.version}: ${migration.name}`);
      try {
        await migration.up();
        await runAsync('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', 
          [migration.version, migration.name]);
        console.log(`  Migration ${migration.version} applied successfully`);
      } catch (err) {
        console.error(`  Migration ${migration.version} failed:`, err.message);
        throw err;
      }
    }
  }
}

// =============================================================================
// MAIN INITIALIZATION
// =============================================================================

async function initializeDatabase(options = {}) {
  console.log('\n========================================');
  console.log('Starlight Inn v7.0 - Database Initialization');
  console.log('========================================\n');

  if (options.reset) {
    console.log('Resetting database...');
    for (const table of Object.keys(TABLES).reverse()) {
      await runAsync(`DROP TABLE IF EXISTS ${table}`);
    }
    await runAsync('DROP TABLE IF EXISTS schema_migrations');
    await runAsync('DROP TABLE IF EXISTS user_achievements');
    await runAsync('DROP TABLE IF EXISTS item_definitions');
    console.log('All tables dropped.');
  }

  await applyMigrations();

  if (options.seed) {
    console.log('\nSeeding database...');
    await SEED_DATA.seedItemDefinitions();
    await SEED_DATA.seedAchievements();
    await SEED_DATA.seedRooms();
    await SEED_DATA.seedUsers();
    await SEED_DATA.seedStarterInventory();
    await SEED_DATA.seedBattlePass();
    console.log('Seeding complete.');
  }

  console.log('\nDatabase initialization complete.');
  console.log('========================================\n');
}

// =============================================================================
// CLI HANDLING
// =============================================================================

const args = process.argv.slice(2);
if (args.includes('--migrate')) {
  initializeDatabase({ seed: false }).then(() => db.close());
} else if (args.includes('--reset')) {
  initializeDatabase({ reset: true, seed: true }).then(() => db.close());
} else if (args.includes('--seed') || require.main === module) {
  initializeDatabase({ seed: true }).then(() => {
    // Don't close when imported as module
    if (require.main === module && !args.includes('--seed')) {
      db.close();
    }
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  db,
  runAsync,
  getAsync,
  allAsync,
  initializeDatabase,
  SEED_DATA
};
