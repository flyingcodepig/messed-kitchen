import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'data'), { recursive: true });

export const db = new DatabaseSync(join(root, 'data', 'kitchen.db'));

export const DEFAULT_AVATARS = [
  '/avatars/carrot.png',
  '/avatars/cabbage.png',
  '/avatars/chili.png',
  '/avatars/tomato.png',
  '/avatars/broccoli.png',
  '/avatars/eggplant.png',
  '/avatars/corn.png'
];

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  verify_token TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kitchens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  kitchen_id INTEGER NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (kitchen_id, user_id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kitchen_id INTEGER NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  creator_id INTEGER NOT NULL REFERENCES users(id),
  buyer_id INTEGER REFERENCES users(id),
  group_photo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  dish_name TEXT NOT NULL,
  dish_desc TEXT NOT NULL DEFAULT '',
  dish_photo TEXT,
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS dish_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS shopping_state (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  purchased INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  buyer_id INTEGER REFERENCES users(id),
  stocked INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, name, unit)
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kitchen_id INTEGER NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  quantity REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (kitchen_id, name, unit)
);

CREATE TABLE IF NOT EXISTS payments (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  paid INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  from_user INTEGER NOT NULL REFERENCES users(id),
  to_user INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, from_user)
);

CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kitchen_id INTEGER NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
  creator_id INTEGER NOT NULL REFERENCES users(id),
  dish_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  acceptor_id INTEGER REFERENCES users(id),
  event_id INTEGER REFERENCES events(id),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
`);

function addColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
addColumn('events', 'buyer_id', 'INTEGER REFERENCES users(id)');
addColumn('events', 'group_photo', 'TEXT');
addColumn('participants', 'dish_photo', 'TEXT');
addColumn('users', 'avatar', 'TEXT');
addColumn('users', 'points', 'INTEGER NOT NULL DEFAULT 0');

const noAvatar = db.prepare('SELECT id FROM users WHERE avatar IS NULL').all();
const pick = db.prepare('UPDATE users SET avatar = ? WHERE id = ?');
for (const u of noAvatar) {
  pick.run(DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)], u.id);
}