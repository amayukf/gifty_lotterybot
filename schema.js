import { sqliteTable as table, integer, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = table('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  telegramId: integer('telegram_id').notNull().unique(),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  languageCode: text('language_code'),
  isAdmin: integer('is_admin', { mode: 'boolean' }).default(false).notNull(),
  isBanned: integer('is_banned', { mode: 'boolean' }).default(false).notNull(),
  referralCode: text('referral_code').unique(),
  referredBy: integer('referred_by'),
  sceneState: text('scene_state'),
  depositId: integer('deposit_id'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

export const wallets = table('wallets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  balance: real('balance').default(0).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

export const lotteryRounds = table('lottery_rounds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roundNumber: integer('round_number').notNull().unique(),
  status: text('status').default('open').notNull(),
  maxTickets: integer('max_tickets').default(100).notNull(),
  ticketPrice: real('ticket_price').default(10).notNull(),
  startedAt: text('started_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  endsAt: text('ends_at'),
  winnerTicket: integer('winner_ticket'),
  winnerUserId: integer('winner_user_id'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

export const tickets = table('tickets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roundId: integer('round_id').notNull(),
  userId: integer('user_id').notNull(),
  ticketNumber: integer('ticket_number').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

export const deposits = table('deposits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  amount: real('amount').notNull(),
  screenshotPath: text('screenshot_path'),
  status: text('status').default('pending').notNull(),
  adminNote: text('admin_note'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

export const withdrawals = table('withdrawals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  amount: real('amount').notNull(),
  address: text('address').notNull(),
  status: text('status').default('pending').notNull(),
  adminNote: text('admin_note'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

export const transactions = table('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  type: text('type').notNull(),
  amount: real('amount').notNull(),
  relatedId: integer('related_id'),
  description: text('description'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

export const referrals = table('referrals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  referrerId: integer('referrer_id').notNull(),
  referredUserId: integer('referred_user_id').notNull(),
  rewardAmount: real('reward_amount').notNull(),
  status: text('status').default('pending').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

export const admins = table('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  telegramId: integer('telegram_id').notNull().unique(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});

export const settings = table('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull()
});
