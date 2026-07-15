import { createClient } from '@libsql/client';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { pathToFileURL } from 'node:url';
import { createDatabase } from './index.js';

export async function ensureSchema(db: LibSQLDatabase<any>) {
  const client = createClient({ url: process.env.DB_PATH?.startsWith('file:') || process.env.DB_PATH?.startsWith('libsql:') ? process.env.DB_PATH : `file:${process.env.DB_PATH ?? 'data/lucky100.sqlite'}` });
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id INTEGER NOT NULL UNIQUE, username TEXT, first_name TEXT, last_name TEXT, language_code TEXT, is_admin INTEGER DEFAULT 0 NOT NULL, is_banned INTEGER DEFAULT 0 NOT NULL, referral_code TEXT UNIQUE, referred_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS wallets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), balance REAL DEFAULT 0 NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS lottery_rounds (id INTEGER PRIMARY KEY AUTOINCREMENT, round_number INTEGER NOT NULL UNIQUE, status TEXT DEFAULT 'open' NOT NULL, max_tickets INTEGER DEFAULT 100 NOT NULL, ticket_price REAL DEFAULT 10 NOT NULL, started_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, ends_at TEXT, winner_ticket INTEGER, winner_user_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, round_id INTEGER NOT NULL REFERENCES lottery_rounds(id), user_id INTEGER NOT NULL REFERENCES users(id), ticket_number INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS deposits (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), amount REAL NOT NULL, screenshot_path TEXT, status TEXT DEFAULT 'pending' NOT NULL, admin_note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS withdrawals (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), amount REAL NOT NULL, address TEXT NOT NULL, status TEXT DEFAULT 'pending' NOT NULL, admin_note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), type TEXT NOT NULL, amount REAL NOT NULL, related_id INTEGER, description TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS referrals (id INTEGER PRIMARY KEY AUTOINCREMENT, referrer_id INTEGER NOT NULL REFERENCES users(id), referred_user_id INTEGER NOT NULL REFERENCES users(id), reward_amount REAL NOT NULL, status TEXT DEFAULT 'pending' NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id INTEGER NOT NULL UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)`
  ];

  for (const statement of statements) {
    await client.execute({ sql: statement, args: [] });
  }

  const userInfo = await client.execute({ sql: "SELECT name FROM pragma_table_info('users')", args: [] });
  if (!userInfo.rows.some((row: any) => row.name === 'is_banned')) {
    await client.execute({ sql: 'ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0 NOT NULL', args: [] });
  }

  const defaultSettings = [
    ['current_round', '1'],
    ['default_ticket_price', '10'],
    ['default_max_tickets', '100'],
    ['default_prize_percentage', '70'],
    ['default_fee_percentage', '10']
  ];
  for (const [key, value] of defaultSettings) {
    const existing = await client.execute({ sql: 'SELECT key FROM settings WHERE key = ?', args: [key] });
    if (!existing.rows.length) {
      await client.execute({ sql: 'INSERT INTO settings (key, value) VALUES (?, ?)', args: [key, value] });
    }
  }

  // Only insert initial round if there are no rounds at all
  const allRounds = await client.execute({ sql: 'SELECT id FROM lottery_rounds', args: [] });
    if (!allRounds.rows.length) {
      await client.execute({ sql: 'INSERT INTO lottery_rounds (round_number, status, max_tickets, ticket_price) VALUES (?, ?, ?, ?)', args: [1, 'open', 100, 10] });
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = createDatabase();
  await ensureSchema(db);
  console.log('Database schema is ready.');
}
