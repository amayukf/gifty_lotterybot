import 'dotenv/config';
import { Telegraf } from 'telegraf';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { createDatabase } from './db/index.js';
import { createBotHandlers } from './bot/index.js';
import { ensureSchema } from './db/migrate.js';

const token = process.env.BOT_TOKEN;

if (!token) {
  throw new Error('BOT_TOKEN is required');
}

const bot = new Telegraf(token);
const db = createDatabase() as unknown as LibSQLDatabase;

await ensureSchema(db);
createBotHandlers(bot, db);

bot.launch().catch((error) => {
  console.error('Failed to start bot', error);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
