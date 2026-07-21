import { and, eq, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../db/schema.js';

export class StorageService {
  constructor(private db: LibSQLDatabase) {}

  async getOrCreateUser(telegramId: number, profile: { username?: string; firstName?: string; lastName?: string; languageCode?: string }, referralCode?: string) {
    const existing = await this.db.select().from(schema.users).where(eq(schema.users.telegramId, telegramId)).limit(1);
    if (existing[0]) {
      return existing[0];
    }

    const generatedCode = `LU${Math.floor(100000 + Math.random() * 900000)}`;
    const inserted = await this.db.insert(schema.users).values({
      telegramId,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      languageCode: profile.languageCode,
      referralCode: generatedCode,
      referredBy: referralCode ? (await this.findUserByReferralCode(referralCode))?.id : undefined
    }).returning();

    const user = inserted[0];
    await this.db.insert(schema.wallets).values({ userId: user.id, balance: 0 });

    if (referralCode && user.referredBy) {
      const referral = await this.recordReferral(user.referredBy, user.id, 5);
      // Credit the referral reward immediately
      await this.updateWalletBalance(user.referredBy, 5);
      await this.addTransaction(user.referredBy, 'referral_bonus', 5, referral.id, `Referral bonus for user ${user.id}`);
      await this.creditReferral(referral.id);
    }

    return user;
  }

  async findUserByReferralCode(referralCode: string) {
    const users = await this.db.select().from(schema.users).where(eq(schema.users.referralCode, referralCode)).limit(1);
    return users[0];
  }

  async getWallet(userId: number) {
    const wallet = (await this.db.select().from(schema.wallets).where(eq(schema.wallets.userId, userId)).limit(1))[0];
    if (wallet) {
      return wallet;
    }
    const inserted = await this.db.insert(schema.wallets).values({ userId, balance: 0 }).returning();
    return inserted[0];
  }

  async getUserById(id: number) {
    const users = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return users[0];
  }

  async getUserByTelegramId(telegramId: number) {
    const users = await this.db.select().from(schema.users).where(eq(schema.users.telegramId, telegramId)).limit(1);
    return users[0];
  }

  async getAllUsers() {
    return this.db.select().from(schema.users);
  }

  async banUser(telegramId: number) {
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) return null;
    await this.db.update(schema.users).set({ isBanned: true, updatedAt: new Date().toISOString() }).where(eq(schema.users.telegramId, telegramId));
    return await this.getUserByTelegramId(telegramId);
  }

  async unbanUser(telegramId: number) {
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) return null;
    await this.db.update(schema.users).set({ isBanned: false, updatedAt: new Date().toISOString() }).where(eq(schema.users.telegramId, telegramId));
    return await this.getUserByTelegramId(telegramId);
  }

  async updateWalletBalance(userId: number, amount: number) {
    const wallet = await this.getWallet(userId);
    await this.db.update(schema.wallets).set({
      balance: sql`${schema.wallets.balance} + ${amount}`,
      updatedAt: new Date().toISOString()
    }).where(eq(schema.wallets.userId, userId));
    return wallet;
  }

  async addTransaction(userId: number, type: 'deposit' | 'withdrawal' | 'lottery_purchase' | 'referral_bonus' | 'admin_adjustment' | 'lottery_win', amount: number, relatedId?: number, description?: string) {
    await this.db.insert(schema.transactions).values({ userId, type, amount, relatedId, description });
  }

  async createDeposit(userId: number, amount: number, screenshotPath: string) {
    const result = await this.db.insert(schema.deposits).values({ userId, amount, screenshotPath, status: 'pending' }).returning();
    return result[0];
  }

  async updateDepositScreenshot(id: number, screenshotPath: string) {
    await this.db.update(schema.deposits).set({ screenshotPath, updatedAt: new Date().toISOString() }).where(eq(schema.deposits.id, id));
  }

  async getDepositById(id: number) {
    const deposits = await this.db.select().from(schema.deposits).where(eq(schema.deposits.id, id)).limit(1);
    return deposits[0];
  }

  async createWithdrawal(userId: number, amount: number, address: string) {
    const result = await this.db.insert(schema.withdrawals).values({ userId, amount, address, status: 'pending' }).returning();
    return result[0];
  }

  async getRoundById(roundId: number) {
    const rounds = await this.db.select().from(schema.lotteryRounds).where(eq(schema.lotteryRounds.id, roundId)).limit(1);
    return rounds[0];
  }

  async getAllRounds() {
    return this.db.select().from(schema.lotteryRounds).orderBy(sql`${schema.lotteryRounds.roundNumber} DESC`);
  }

  async updateRound(roundId: number, updates: { ticketPrice?: number; maxTickets?: number; endsAt?: string; status?: 'open' | 'closed' | 'drawn' | 'paused' }) {
    await this.db.update(schema.lotteryRounds).set({
      ...(updates.ticketPrice !== undefined ? { ticketPrice: updates.ticketPrice } : {}),
      ...(updates.maxTickets !== undefined ? { maxTickets: updates.maxTickets } : {}),
      ...(updates.endsAt !== undefined ? { endsAt: updates.endsAt } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      updatedAt: new Date().toISOString()
    }).where(eq(schema.lotteryRounds.id, roundId));
    return this.getRoundById(roundId);
  }

  async pauseRound(roundId: number) {
    return this.updateRound(roundId, { status: 'paused' });
  }

  async resumeRound(roundId: number) {
    return this.updateRound(roundId, { status: 'open' });
  }

  async getSetting(key: string) {
    const rows = await this.db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
    return rows[0]?.value;
  }

  async setSetting(key: string, value: string) {
    const existing = await this.getSetting(key);
    if (existing === undefined) {
      await this.db.insert(schema.settings).values({ key, value });
    } else {
      await this.db.update(schema.settings).set({ value, updatedAt: new Date().toISOString() }).where(eq(schema.settings.key, key));
    }
    return value;
  }

  async getAnalytics() {
    const totalUsers = Number((await this.db.select({ total: sql`COUNT(*)` }).from(schema.users))[0]?.total ?? 0);
    const totalBannedUsers = Number((await this.db.select({ total: sql`COUNT(*)` }).from(schema.users).where(eq(schema.users.isBanned, true)))[0]?.total ?? 0);
    const totalDeposits = Number((await this.db.select({ total: sql`COALESCE(SUM(amount), 0)` }).from(schema.deposits).where(eq(schema.deposits.status, 'approved')))[0]?.total ?? 0);
    const totalWithdrawals = Number((await this.db.select({ total: sql`COALESCE(SUM(amount), 0)` }).from(schema.withdrawals).where(eq(schema.withdrawals.status, 'approved')))[0]?.total ?? 0);
    const totalTickets = Number((await this.db.select({ total: sql`COUNT(*)` }).from(schema.tickets))[0]?.total ?? 0);
    const totalBalance = Number((await this.db.select({ total: sql`COALESCE(SUM(balance), 0)` }).from(schema.wallets))[0]?.total ?? 0);
    const activeRound = await this.getActiveRound();
    return { totalUsers, totalBannedUsers, totalDeposits, totalWithdrawals, totalTickets, totalBalance, activeRound };
  }

  async listPendingDeposits() {
    return this.db.select().from(schema.deposits).where(eq(schema.deposits.status, 'pending'));
  }

  async listPendingWithdrawals() {
    return this.db.select().from(schema.withdrawals).where(eq(schema.withdrawals.status, 'pending'));
  }

  async approveDeposit(id: number, adminNote?: string) {
    const deposit = await this.getDepositById(id);
    if (!deposit || deposit.status !== 'pending') {
      return deposit;
    }

    await this.db.update(schema.deposits).set({ status: 'approved', adminNote, updatedAt: new Date().toISOString() }).where(eq(schema.deposits.id, id));
    await this.updateWalletBalance(deposit.userId, deposit.amount);
    await this.addTransaction(deposit.userId, 'deposit', deposit.amount, deposit.id, 'Deposit approved');
    return await this.getDepositById(id);
  }

  async rejectDeposit(id: number, adminNote?: string) {
    const deposit = await this.getDepositById(id);
    if (!deposit || deposit.status !== 'pending') {
      return deposit;
    }
    await this.db.update(schema.deposits).set({ status: 'rejected', adminNote, updatedAt: new Date().toISOString() }).where(eq(schema.deposits.id, id));
    return await this.getDepositById(id);
  }

  async approveWithdrawal(id: number, adminNote?: string) {
    const withdrawal = await this.db.select().from(schema.withdrawals).where(eq(schema.withdrawals.id, id)).limit(1);
    const current = withdrawal[0];
    if (!current || current.status !== 'pending') {
      return current;
    }

    await this.updateWalletBalance(current.userId, -current.amount);
    await this.addTransaction(current.userId, 'withdrawal', -current.amount, current.id, 'Withdrawal approved');
    await this.db.update(schema.withdrawals).set({ status: 'approved', adminNote, updatedAt: new Date().toISOString() }).where(eq(schema.withdrawals.id, id));
    return await this.db.select().from(schema.withdrawals).where(eq(schema.withdrawals.id, id)).limit(1).then((rows) => rows[0]);
  }

  async rejectWithdrawal(id: number, adminNote?: string) {
    const withdrawal = await this.db.select().from(schema.withdrawals).where(eq(schema.withdrawals.id, id)).limit(1);
    const current = withdrawal[0];
    if (!current || current.status !== 'pending') {
      return current;
    }
    await this.db.update(schema.withdrawals).set({ status: 'rejected', adminNote, updatedAt: new Date().toISOString() }).where(eq(schema.withdrawals.id, id));
    return await this.db.select().from(schema.withdrawals).where(eq(schema.withdrawals.id, id)).limit(1).then((rows) => rows[0]);
  }

  async getActiveRound() {
    const rounds = await this.db.select().from(schema.lotteryRounds).where(eq(schema.lotteryRounds.status, 'open')).limit(1);
    return rounds[0];
  }

  async createRound(roundNumber: number, maxTickets: number, ticketPrice: number, endsAt?: string) {
    const activeRound = await this.getActiveRound();
    if (activeRound) {
      await this.updateRound(activeRound.id, { status: 'closed' });
    }
    // Get the next round number (max round number + 1, or 1 if no rounds exist)
    const lastRound = await this.getLastRound();
    const nextRoundNumber = lastRound ? lastRound.roundNumber + 1 : 1;
    const result = await this.db.insert(schema.lotteryRounds).values({ roundNumber: nextRoundNumber, maxTickets, ticketPrice, status: 'open', endsAt }).returning();
    return result[0];
  }

  async buyTicket(roundId: number, userId: number, ticketNumber: number) {
    const result = await this.db.insert(schema.tickets).values({ roundId, userId, ticketNumber }).returning();
    return result[0];
  }

  async getTicketsForRound(roundId: number) {
    return this.db.select().from(schema.tickets).where(eq(schema.tickets.roundId, roundId));
  }

  async getUserTickets(userId: number, roundId?: number) {
    if (roundId) {
      return this.db.select().from(schema.tickets).where(and(eq(schema.tickets.userId, userId), eq(schema.tickets.roundId, roundId)));
    }
    return this.db.select().from(schema.tickets).where(eq(schema.tickets.userId, userId));
  }

  async markRoundAsDrawn(roundId: number, winnerTicket: number, winnerUserId: number) {
    await this.db.update(schema.lotteryRounds).set({ status: 'drawn', winnerTicket, winnerUserId, updatedAt: new Date().toISOString() }).where(eq(schema.lotteryRounds.id, roundId));
  }

  async getTransactions(userId: number) {
    return this.db.select().from(schema.transactions).where(eq(schema.transactions.userId, userId)).orderBy(sql`${schema.transactions.createdAt} DESC`);
  }

  async recordReferral(referrerId: number, referredUserId: number, rewardAmount: number) {
    const result = await this.db.insert(schema.referrals).values({ referrerId, referredUserId, rewardAmount, status: 'pending' }).returning();
    return result[0];
  }

  async getLastRound() {
    const rounds = await this.db.select().from(schema.lotteryRounds).orderBy(sql`${schema.lotteryRounds.roundNumber} DESC`).limit(1);
    return rounds[0];
  }

  async creditReferral(referralId: number) {
    await this.db.update(schema.referrals).set({ status: 'credited' }).where(eq(schema.referrals.id, referralId));
  }

  async createSupportTicket(userId: number, message: string) {
    const result = await this.db.insert(schema.supportTickets).values({ userId, message, status: 'open' }).returning();
    return result[0];
  }

  async getSupportTicketById(id: number) {
    const tickets = await this.db.select().from(schema.supportTickets).where(eq(schema.supportTickets.id, id)).limit(1);
    return tickets[0] || null;
  }

  async resolveSupportTicket(id: number, adminReply?: string) {
    await this.db.update(schema.supportTickets)
      .set({ 
        status: 'resolved', 
        adminReply: adminReply || null, 
        resolvedAt: new Date().toISOString() 
      })
      .where(eq(schema.supportTickets.id, id));
    return this.getSupportTicketById(id);
  }

  async exportTransactionsCSV(): Promise<string> {
    const transactions = await this.db.select().from(schema.transactions).orderBy(sql`${schema.transactions.createdAt} DESC`);
    const headers = ['id', 'user_id', 'type', 'amount', 'round_id', 'description', 'created_at'];
    const rows = transactions.map(t => [
      t.id, t.userId, t.type, t.amount, t.relatedId || '', `"${(t.description || '').replace(/"/g, '""')}"`, t.createdAt
    ].join(','));
    return [headers.join(','), ...rows].join('\n');
  }
}
