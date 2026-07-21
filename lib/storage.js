import { and, eq, sql } from 'drizzle-orm';
import * as schema from '../schema.js';

export let db = null;

export function setDb(dbInstance) {
  db = dbInstance;
}

export async function getOrCreateUser(telegramId, profile, referralCode = null) {
  const existing = await db.select().from(schema.users).where(eq(schema.users.telegramId, telegramId)).limit(1);
  if (existing[0]) {
    return existing[0];
  }

  const generatedCode = `LU${Math.floor(100000 + Math.random() * 900000)}`;
  
  let referredById = null;
  if (referralCode) {
    const referredUser = await findUserByReferralCode(referralCode);
    if (referredUser) {
      referredById = referredUser.id;
    }
  }

  const inserted = await db.insert(schema.users).values({
    telegramId,
    username: profile.username || null,
    firstName: profile.firstName || null,
    lastName: profile.lastName || null,
    languageCode: profile.languageCode || null,
    referralCode: generatedCode,
    referredBy: referredById
  }).returning();

  const user = inserted[0];
  await db.insert(schema.wallets).values({ userId: user.id, balance: 0 }).run();

  if (referredById) {
    const referral = await recordReferral(referredById, user.id, 5);
    // Credit the referral reward immediately
    await updateWalletBalance(referredById, 5);
    await addTransaction(referredById, 'referral_bonus', 5, referral.id, `Referral bonus for user ${user.id}`);
    await creditReferral(referral.id);
  }

  return user;
}

export async function findUserByReferralCode(referralCode) {
  const users = await db.select().from(schema.users).where(eq(schema.users.referralCode, referralCode)).limit(1);
  return users[0] || null;
}

export async function getWallet(userId) {
  const wallet = (await db.select().from(schema.wallets).where(eq(schema.wallets.userId, userId)).limit(1))[0];
  if (wallet) {
    return wallet;
  }
  const inserted = await db.insert(schema.wallets).values({ userId, balance: 0 }).returning();
  return inserted[0];
}

export async function getUserById(id) {
  const users = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return users[0] || null;
}

export async function getUserByTelegramId(telegramId) {
  const users = await db.select().from(schema.users).where(eq(schema.users.telegramId, telegramId)).limit(1);
  return users[0] || null;
}

export async function getAllUsers() {
  return await db.select().from(schema.users);
}

export async function banUser(telegramId) {
  const user = await getUserByTelegramId(telegramId);
  if (!user) return null;
  await db.update(schema.users).set({ isBanned: true, updatedAt: new Date().toISOString() }).where(eq(schema.users.telegramId, telegramId)).run();
  return await getUserByTelegramId(telegramId);
}

export async function unbanUser(telegramId) {
  const user = await getUserByTelegramId(telegramId);
  if (!user) return null;
  await db.update(schema.users).set({ isBanned: false, updatedAt: new Date().toISOString() }).where(eq(schema.users.telegramId, telegramId)).run();
  return await getUserByTelegramId(telegramId);
}

export async function updateWalletBalance(userId, amount) {
  const wallet = await getWallet(userId);
  await db.update(schema.wallets).set({
    balance: sql`${schema.wallets.balance} + ${amount}`,
    updatedAt: new Date().toISOString()
  }).where(eq(schema.wallets.userId, userId)).run();
  return wallet;
}

export async function addTransaction(userId, type, amount, relatedId = null, description = null) {
  await db.insert(schema.transactions).values({ userId, type, amount, relatedId, description }).run();
}

export async function createDeposit(userId, amount, screenshotPath) {
  const result = await db.insert(schema.deposits).values({ userId, amount, screenshotPath, status: 'pending' }).returning();
  return result[0];
}

export async function updateDepositScreenshot(id, screenshotPath) {
  await db.update(schema.deposits).set({ screenshotPath, updatedAt: new Date().toISOString() }).where(eq(schema.deposits.id, id)).run();
}

export async function getDepositById(id) {
  const deposits = await db.select().from(schema.deposits).where(eq(schema.deposits.id, id)).limit(1);
  return deposits[0] || null;
}

export async function createWithdrawal(userId, amount, address) {
  const result = await db.insert(schema.withdrawals).values({ userId, amount, address, status: 'pending' }).returning();
  return result[0];
}

export async function getRoundById(roundId) {
  const rounds = await db.select().from(schema.lotteryRounds).where(eq(schema.lotteryRounds.id, roundId)).limit(1);
  return rounds[0] || null;
}

export async function getAllRounds() {
  return await db.select().from(schema.lotteryRounds).orderBy(sql`${schema.lotteryRounds.roundNumber} DESC`);
}

export async function updateRound(roundId, updates) {
  const setObj = { updatedAt: new Date().toISOString() };
  if (updates.ticketPrice !== undefined) setObj.ticketPrice = updates.ticketPrice;
  if (updates.maxTickets !== undefined) setObj.maxTickets = updates.maxTickets;
  if (updates.endsAt !== undefined) setObj.endsAt = updates.endsAt;
  if (updates.status !== undefined) setObj.status = updates.status;

  await db.update(schema.lotteryRounds).set(setObj).where(eq(schema.lotteryRounds.id, roundId)).run();
  return await getRoundById(roundId);
}

export async function pauseRound(roundId) {
  return await updateRound(roundId, { status: 'paused' });
}

export async function resumeRound(roundId) {
  return await updateRound(roundId, { status: 'open' });
}

export async function getSetting(key) {
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
  return rows[0] ? rows[0].value : null;
}

export async function setSetting(key, value) {
  const existing = await getSetting(key);
  if (existing === null) {
    await db.insert(schema.settings).values({ key, value }).run();
  } else {
    await db.update(schema.settings).set({ value, updatedAt: new Date().toISOString() }).where(eq(schema.settings.key, key)).run();
  }
  return value;
}

export async function getAnalytics() {
  const totalUsers = Number((await db.select({ total: sql`COUNT(*)` }).from(schema.users))[0]?.total ?? 0);
  const totalBannedUsers = Number((await db.select({ total: sql`COUNT(*)` }).from(schema.users).where(eq(schema.users.isBanned, true)))[0]?.total ?? 0);
  const totalDeposits = Number((await db.select({ total: sql`COALESCE(SUM(amount), 0)` }).from(schema.deposits).where(eq(schema.deposits.status, 'approved')))[0]?.total ?? 0);
  const totalWithdrawals = Number((await db.select({ total: sql`COALESCE(SUM(amount), 0)` }).from(schema.withdrawals).where(eq(schema.withdrawals.status, 'approved')))[0]?.total ?? 0);
  const totalTickets = Number((await db.select({ total: sql`COUNT(*)` }).from(schema.tickets))[0]?.total ?? 0);
  const totalBalance = Number((await db.select({ total: sql`COALESCE(SUM(balance), 0)` }).from(schema.wallets))[0]?.total ?? 0);
  const activeRound = await getActiveRound();
  return { totalUsers, totalBannedUsers, totalDeposits, totalWithdrawals, totalTickets, totalBalance, activeRound };
}

export async function listPendingDeposits() {
  return await db.select().from(schema.deposits).where(eq(schema.deposits.status, 'pending'));
}

export async function listPendingWithdrawals() {
  return await db.select().from(schema.withdrawals).where(eq(schema.withdrawals.status, 'pending'));
}

export async function approveDeposit(id, adminNote = null) {
  const deposit = await getDepositById(id);
  if (!deposit || deposit.status !== 'pending') {
    return deposit;
  }

  await db.update(schema.deposits).set({ status: 'approved', adminNote, updatedAt: new Date().toISOString() }).where(eq(schema.deposits.id, id)).run();
  await updateWalletBalance(deposit.userId, deposit.amount);
  await addTransaction(deposit.userId, 'deposit', deposit.amount, deposit.id, 'Deposit approved');
  return await getDepositById(id);
}

export async function rejectDeposit(id, adminNote = null) {
  const deposit = await getDepositById(id);
  if (!deposit || deposit.status !== 'pending') {
    return deposit;
  }
  await db.update(schema.deposits).set({ status: 'rejected', adminNote, updatedAt: new Date().toISOString() }).where(eq(schema.deposits.id, id)).run();
  return await getDepositById(id);
}

export async function approveWithdrawal(id, adminNote = null) {
  const withdrawal = await db.select().from(schema.withdrawals).where(eq(schema.withdrawals.id, id)).limit(1);
  const current = withdrawal[0];
  if (!current || current.status !== 'pending') {
     return current || null;
  }

  await updateWalletBalance(current.userId, -current.amount);
  await addTransaction(current.userId, 'withdrawal', -current.amount, current.id, 'Withdrawal approved');
  await db.update(schema.withdrawals).set({ status: 'approved', adminNote, updatedAt: new Date().toISOString() }).where(eq(schema.withdrawals.id, id)).run();
  return (await db.select().from(schema.withdrawals).where(eq(schema.withdrawals.id, id)).limit(1))[0] || null;
}

export async function rejectWithdrawal(id, adminNote = null) {
  const withdrawal = await db.select().from(schema.withdrawals).where(eq(schema.withdrawals.id, id)).limit(1);
  const current = withdrawal[0];
  if (!current || current.status !== 'pending') {
    return current || null;
  }
  await db.update(schema.withdrawals).set({ status: 'rejected', adminNote, updatedAt: new Date().toISOString() }).where(eq(schema.withdrawals.id, id)).run();
  return (await db.select().from(schema.withdrawals).where(eq(schema.withdrawals.id, id)).limit(1))[0] || null;
}

export async function getActiveRound() {
  const rounds = await db.select().from(schema.lotteryRounds).where(eq(schema.lotteryRounds.status, 'open')).limit(1);
  return rounds[0] || null;
}

export async function createRound(roundNumber, maxTickets, ticketPrice, endsAt = null) {
  const activeRound = await getActiveRound();
  if (activeRound) {
    await updateRound(activeRound.id, { status: 'closed' });
  }
  const lastRound = await getLastRound();
  const nextRoundNumber = lastRound ? lastRound.roundNumber + 1 : 1;
  const result = await db.insert(schema.lotteryRounds).values({ roundNumber: nextRoundNumber, maxTickets, ticketPrice, status: 'open', endsAt }).returning();
  return result[0];
}

export async function buyTicket(roundId, userId, ticketNumber) {
  const result = await db.insert(schema.tickets).values({ roundId, userId, ticketNumber }).returning();
  return result[0];
}

export async function getTicketsForRound(roundId) {
  return await db.select().from(schema.tickets).where(eq(schema.tickets.roundId, roundId));
}

export async function getUserTickets(userId, roundId = null) {
  if (roundId) {
    return await db.select().from(schema.tickets).where(and(eq(schema.tickets.userId, userId), eq(schema.tickets.roundId, roundId)));
  }
  return await db.select().from(schema.tickets).where(eq(schema.tickets.userId, userId));
}

export async function markRoundAsDrawn(roundId, winningTicketNumber, winnerId) {
  await db.update(schema.lotteryRounds)
    .set({ status: 'drawn', winnerTicket: winningTicketNumber, winnerUserId: winnerId, updatedAt: new Date().toISOString() })
    .where(eq(schema.lotteryRounds.id, roundId))
    .run();
}

export async function getTransactions(userId) {
  return await db.select().from(schema.transactions).where(eq(schema.transactions.userId, userId)).orderBy(sql`${schema.transactions.createdAt} DESC`);
}

export async function recordReferral(referrerId, referredUserId, rewardAmount) {
  const result = await db.insert(schema.referrals).values({ referrerId, referredUserId, rewardAmount, status: 'pending' }).returning();
  return result[0];
}

export async function getLastRound() {
  const rounds = await db.select().from(schema.lotteryRounds).orderBy(sql`${schema.lotteryRounds.roundNumber} DESC`).limit(1);
  return rounds[0] || null;
}

export async function creditReferral(referralId) {
  await db.update(schema.referrals).set({ status: 'credited' }).where(eq(schema.referrals.id, referralId)).run();
}

// Scene State handlers
export async function setUserScene(telegramId, sceneState, depositId = null) {
  await db.update(schema.users)
    .set({ sceneState, depositId, updatedAt: new Date().toISOString() })
    .where(eq(schema.users.telegramId, telegramId))
    .run();
}

export async function clearUserScene(telegramId) {
  await db.update(schema.users)
    .set({ sceneState: null, depositId: null, updatedAt: new Date().toISOString() })
    .where(eq(schema.users.telegramId, telegramId))
    .run();
}

export async function createSupportTicket(userId, message) {
  const result = await db.insert(schema.supportTickets).values({ userId, message, status: 'open' }).returning();
  return result[0];
}

export async function getSupportTicketById(id) {
  const tickets = await db.select().from(schema.supportTickets).where(eq(schema.supportTickets.id, id)).limit(1);
  return tickets[0] || null;
}

export async function resolveSupportTicket(id, adminReply = null) {
  await db.update(schema.supportTickets)
    .set({ 
      status: 'resolved', 
      adminReply, 
      resolvedAt: new Date().toISOString() 
    })
    .where(eq(schema.supportTickets.id, id))
    .run();
  return await getSupportTicketById(id);
}

export async function exportTransactionsCSV() {
  const transactions = await db.select().from(schema.transactions).orderBy(sql`${schema.transactions.createdAt} DESC`);
  const headers = ['id', 'user_id', 'type', 'amount', 'related_id', 'description', 'created_at'];
  const rows = transactions.map(t => [
    t.id, t.userId, t.type, t.amount, t.relatedId || '', `"${(t.description || '').replace(/"/g, '""')}"`, t.createdAt
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

