import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
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
  createdAt: text('created_at').default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP').notNull()
});

export const wallets = sqliteTable('wallets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  balance: real('balance').default(0).notNull(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP').notNull()
});

export const lotteryRounds = sqliteTable('lottery_rounds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roundNumber: integer('round_number').notNull().unique(),
  status: text('status', { enum: ['open', 'closed', 'drawn', 'paused'] }).default('open').notNull(),
  maxTickets: integer('max_tickets').default(100).notNull(),
  ticketPrice: real('ticket_price').default(10).notNull(),
  startedAt: text('started_at').default('CURRENT_TIMESTAMP').notNull(),
  endsAt: text('ends_at'),
  winnerTicket: integer('winner_ticket'),
  winnerUserId: integer('winner_user_id'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP').notNull()
});

export const tickets = sqliteTable('tickets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roundId: integer('round_id').notNull().references(() => lotteryRounds.id),
  userId: integer('user_id').notNull().references(() => users.id),
  ticketNumber: integer('ticket_number').notNull(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP').notNull()
});

export const deposits = sqliteTable('deposits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  amount: real('amount').notNull(),
  screenshotPath: text('screenshot_path'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).default('pending').notNull(),
  adminNote: text('admin_note'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP').notNull()
});

export const withdrawals = sqliteTable('withdrawals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  amount: real('amount').notNull(),
  address: text('address').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).default('pending').notNull(),
  adminNote: text('admin_note'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP').notNull()
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  type: text('type', { enum: ['deposit', 'withdrawal', 'lottery_purchase', 'referral_bonus', 'admin_adjustment', 'lottery_win'] }).notNull(),
  amount: real('amount').notNull(),
  relatedId: integer('related_id'),
  description: text('description'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP').notNull()
});

export const referrals = sqliteTable('referrals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  referrerId: integer('referrer_id').notNull().references(() => users.id),
  referredUserId: integer('referred_user_id').notNull().references(() => users.id),
  rewardAmount: real('reward_amount').notNull(),
  status: text('status', { enum: ['pending', 'credited'] }).default('pending').notNull(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP').notNull()
});

export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  telegramId: integer('telegram_id').notNull().unique(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP').notNull()
});

export const supportTickets = sqliteTable('support_tickets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  message: text('message').notNull(),
  status: text('status').default('open').notNull(),
  adminReply: text('admin_reply'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP').notNull(),
  resolvedAt: text('resolved_at')
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP').notNull()
});

