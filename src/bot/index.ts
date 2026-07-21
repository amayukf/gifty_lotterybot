import { Context, Markup, Telegraf } from 'telegraf';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../db/schema.js';
import { config, isAdmin } from '../core/config.js';
import { StorageService } from '../services/storage.js';

export function createBotHandlers(bot: Telegraf, db: LibSQLDatabase) {
  const storage = new StorageService(db);
  const scenes = new Map<number, { state: string; depositId?: number; ticketId?: number }>();

  const ensureRound = async () => {
    const existingRound = await storage.getActiveRound();
    if (existingRound) {
      return existingRound;
    }

    const endsAt = new Date(Date.now() + config.ROUND_DURATION_MINUTES * 60_000).toISOString();
    return storage.createRound(1, config.MAX_TICKETS, config.TICKET_PRICE, endsAt);
  };

  void ensureRound();
  setInterval(() => {
    void checkExpiredRounds();
  }, 60_000);

  async function ensureUser(ctx: Context) {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      return null;
    }

    const payload = (ctx as typeof ctx & { startPayload?: string }).startPayload;
    const referralCode = payload?.startsWith('ref_') ? payload.replace('ref_', '') : undefined;

    const user = await storage.getOrCreateUser(telegramId, {
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
      languageCode: ctx.from?.language_code
    }, referralCode);

    if (user?.isBanned) {
      await ctx.reply('🚫 You are banned from using this bot. Contact admin for help.');
      return null;
    }

    return user;
  }

  bot.start(async (ctx) => {
    const user = await ensureUser(ctx);
    const name = ctx.from?.first_name ?? 'player';
    const message = user
      ? `🎉 Welcome to Lucky100, ${name}!\n\n🎟️ Play the lottery\n💰 Manage your wallet\n💳 Deposit or withdraw funds easily\n\n📢 Your referral link: https://t.me/${(await ctx.telegram.getMe()).username}?start=ref_${user.referralCode}\nShare it with friends to earn rewards!`
      : '🎉 Welcome to Lucky100!';
    await ctx.reply(message, Markup.keyboard([['🎟️ Play', '💰 Wallet'], ['💳 Deposit', '💸 Withdraw'], ['📜 History', '💬 Support', '❓ Help']]).resize());
  });

  // Map emoji buttons to commands
  bot.hears('🎟️ Play', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const round = await ensureRound();
    if (!round) {
      await ctx.reply('No active round available.');
      return;
    }

    const tickets = await storage.getTicketsForRound(round.id);
    const takenNumbers = new Set(tickets.map(t => t.ticketNumber));
    const availableNumbers: number[] = [];
    const maxTicketNumber = 100;
    for (let i = 1; i <= maxTicketNumber; i++) {
      if (!takenNumbers.has(i)) availableNumbers.push(i);
    }
    const remaining = availableNumbers.length;
    
    // Show available numbers in a readable way
    let availableText = '';
    if (remaining <= 20) {
      availableText = `\nAvailable numbers: ${availableNumbers.join(', ')}`;
    } else {
      availableText = `\n${remaining} numbers available (choose 1-100)`;
    }
    
    await ctx.reply(`🎟️ Round #${round.roundNumber}\n🎫 Price: ${round.ticketPrice}\n📊 Tickets remaining: ${remaining}/${round.maxTickets}${availableText}\n\nReply with your chosen ticket number!`);
    scenes.set(ctx.from!.id, { state: 'buy_ticket' });
  });

  bot.hears('💰 Wallet', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const wallet = await storage.getWallet(user.id);
    await ctx.reply(`💰 Your Wallet\nBalance: ${wallet?.balance ?? 0}`);
  });

  bot.hears('💳 Deposit', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    await ctx.reply('💳 To make a deposit:\n1. Send the deposit amount (e.g., 50)\n2. Then upload a screenshot of your payment');
    scenes.set(ctx.from!.id, { state: 'deposit_amount' });
  });

  bot.hears('💸 Withdraw', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    await ctx.reply('💸 To withdraw:\nSend your request like this:\n[amount] [wallet address]\nExample: 20 USDTTRC20');
    scenes.set(ctx.from!.id, { state: 'withdraw_request' });
  });

  bot.hears('📜 History', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const transactions = await storage.getTransactions(user.id);
    if (!transactions.length) {
      await ctx.reply('📜 No transaction history yet.');
      return;
    }
    const typeEmojis: Record<string, string> = {
      'deposit': '💳',
      'withdrawal': '💸',
      'lottery_purchase': '🎟️',
      'referral_bonus': '👥',
      'admin_adjustment': '⚙️',
      'lottery_win': '🎉'
    };
    const lines = transactions.slice(0, 10).map((entry) => `${typeEmojis[entry.type] ?? '🔹'} ${entry.type}: ${entry.amount} (${entry.description ?? 'n/a'})`).join('\n');
    await ctx.reply(`📜 Recent transactions:\n${lines}`);
  });

  bot.hears('❓ Help', async (ctx) => {
    const isAdminUser = ctx.from ? isAdmin(ctx.from.id) : false;
    const adminLine = isAdminUser ? '\n/admin - Admin dashboard' : '';
    await ctx.reply(`🎯 Lucky100 Guide:\n/play - Join the lottery round\n/wallet - Check your balance\n/deposit - Deposit funds\n/withdraw - Request a withdrawal\n/history - See your transactions\n/referral - Get your referral link\n/support - Contact support${adminLine}`);
  });

  bot.command('help', async (ctx) => {
    const isAdminUser = ctx.from ? isAdmin(ctx.from.id) : false;
    const adminLine = isAdminUser ? '\n/admin - Admin dashboard' : '';
    await ctx.reply(`🎯 Lucky100 Guide:\n/play - Join the lottery round\n/wallet - Check your balance\n/deposit - Deposit funds\n/withdraw - Request a withdrawal\n/history - See your transactions\n/referral - Get your referral link\n/support - Contact support${adminLine}`);
  });

  bot.hears('💬 Support', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    await ctx.reply('💬 Please send your message or question below. Our support team will reply directly to this chat.\n\nSend /cancel to discard.');
    scenes.set(ctx.from!.id, { state: 'support_message' });
  });

  bot.command('support', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    await ctx.reply('💬 Please send your message or question below. Our support team will reply directly to this chat.\n\nSend /cancel to discard.');
    scenes.set(ctx.from!.id, { state: 'support_message' });
  });

  bot.command('wallet', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const wallet = await storage.getWallet(user.id);
    await ctx.reply(`💰 Your Wallet\nBalance: ${wallet?.balance ?? 0}`);
  });

  bot.command('deposit', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    await ctx.reply('💳 To make a deposit:\n1. Send the deposit amount (e.g., 50)\n2. Then upload a screenshot of your payment');
    scenes.set(ctx.from!.id, { state: 'deposit_amount' });
  });

  bot.command('withdraw', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    await ctx.reply('💸 To withdraw:\nSend your request like this:\n[amount] [wallet address]\nExample: 20 USDTTRC20');
    scenes.set(ctx.from!.id, { state: 'withdraw_request' });
  });

  bot.command('play', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const round = await ensureRound();
    if (!round) {
      await ctx.reply('No active round available.');
      return;
    }

    const tickets = await storage.getTicketsForRound(round.id);
    await ctx.reply(`🎟️ Round #${round.roundNumber}\n🎫 Price: ${round.ticketPrice}\n📊 Tickets sold: ${tickets.length}\n\nReply with a number between 1 and 100 to purchase your ticket!`);
    scenes.set(ctx.from!.id, { state: 'buy_ticket' });
  });

  bot.command('referral', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const botUsername = (await ctx.telegram.getMe()).username;
    await ctx.reply(`👥 Your Referral Link:\nhttps://t.me/${botUsername}?start=ref_${user.referralCode}\n\nShare this with friends! When they join, you get a reward!`);
  });

  bot.command('history', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const transactions = await storage.getTransactions(user.id);
    if (!transactions.length) {
      await ctx.reply('📜 No transaction history yet.');
      return;
    }
    const typeEmojis: Record<string, string> = {
      'deposit': '💳',
      'withdrawal': '💸',
      'lottery_purchase': '🎟️',
      'referral_bonus': '👥',
      'admin_adjustment': '⚙️',
      'lottery_win': '🎉'
    };
    const lines = transactions.slice(0, 10).map((entry) => `${typeEmojis[entry.type] ?? '🔹'} ${entry.type}: ${entry.amount} (${entry.description ?? 'n/a'})`).join('\n');
    await ctx.reply(`📜 Recent transactions:\n${lines}`);
  });

  async function finalizeRound(roundId: number) {
    const round = await storage.getActiveRound();
    if (!round || round.id !== roundId) {
      return;
    }

    const tickets = await storage.getTicketsForRound(round.id);
    if (!tickets.length) {
      await storage.markRoundAsDrawn(round.id, 0, 0);
      return;
    }

    // Pre-draw notification
    const uniqueBuyerIds = [...new Set(tickets.map(t => t.userId))];
    const uniqueBuyers = await Promise.all(uniqueBuyerIds.map(id => storage.getUserById(id)));
    for (const buyer of uniqueBuyers) {
      if (buyer) {
        try {
          await bot.telegram.sendMessage(buyer.telegramId, `🔔 Lottery round #${round.roundNumber} is now drawing... Best of luck!`);
        } catch (err) {
          console.error(`Failed to send pre-draw message to user ${buyer.telegramId}:`, err);
        }
      }
    }

    // Artificial 10-second suspense delay
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const winningIndex = Math.floor(Math.random() * tickets.length);
    const winner = tickets[winningIndex];
    if (winner) {
      await storage.markRoundAsDrawn(round.id, winner.ticketNumber, winner.userId);
      
      // Calculate prize amount
      const totalTickets = tickets.length;
      const totalPot = totalTickets * round.ticketPrice;
      const prizePercentage = Number(await storage.getSetting('default_prize_percentage') || 70);
      const prizeAmount = totalPot * (prizePercentage / 100);
      
      // Credit the winner's wallet
      await storage.updateWalletBalance(winner.userId, prizeAmount);
      await storage.addTransaction(winner.userId, 'lottery_win', prizeAmount, round.id, `Won round #${round.roundNumber} with ticket ${winner.ticketNumber}`);
      
      // Notify everyone
      for (const buyer of uniqueBuyers) {
        if (buyer) {
          try {
            if (buyer.id === winner.userId) {
              await bot.telegram.sendMessage(buyer.telegramId, `🎉 Lottery round #${round.roundNumber} has been drawn!\nYou won with ticket ${winner.ticketNumber}!\n\nPrize of ${prizeAmount} has been credited to your wallet!`);
            } else {
              await bot.telegram.sendMessage(buyer.telegramId, `ℹ️ Lottery round #${round.roundNumber} has been drawn.\nThe winning ticket was ${winner.ticketNumber}.\n\nBetter luck next time!`);
            }
          } catch (err) {
            console.error(`Failed to send post-draw message to user ${buyer.telegramId}:`, err);
          }
        }
      }
    }
  }

  async function maybeDrawRound(roundId: number) {
    const round = await storage.getActiveRound();
    if (!round || round.id !== roundId) {
      return;
    }

    const tickets = await storage.getTicketsForRound(round.id);
    if (tickets.length >= round.maxTickets) {
      await finalizeRound(round.id);
    }
  }

  async function checkExpiredRounds() {
    const round = await storage.getActiveRound();
    if (!round?.endsAt) {
      return;
    }
    if (new Date(round.endsAt).getTime() <= Date.now()) {
      await finalizeRound(round.id);
    }
  }

  bot.command('admin', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }

    const pendingDeposits = await storage.listPendingDeposits();
    const pendingWithdrawals = await storage.listPendingWithdrawals();
    const rounds = await storage.getAllRounds();
    const analytics = await storage.getAnalytics();

    const buttons = [
      [Markup.button.callback('Manage Deposits', 'admin:show_deposits'), Markup.button.callback('Manage Withdrawals', 'admin:show_withdrawals')],
      [Markup.button.callback('Rounds', 'admin:show_rounds'), Markup.button.callback('Force Draw', 'admin:force_draw')],
      [Markup.button.callback('Broadcast', 'admin:broadcast'), Markup.button.callback('Ban/Unban', 'admin:ban_unban')],
      [Markup.button.callback('Settings', 'admin:settings'), Markup.button.callback('Analytics', 'admin:analytics')]
    ];

    await ctx.reply(
      `Admin dashboard\nPending deposits: ${pendingDeposits.length}\nPending withdrawals: ${pendingWithdrawals.length}\nRounds: ${rounds.length}\nTotal users: ${analytics.totalUsers}\nBanned users: ${analytics.totalBannedUsers}`,
      Markup.inlineKeyboard(buttons)
    );
  });

  bot.command('view_deposit', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const id = Number(ctx.message.text.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await ctx.reply('Usage: /view_deposit <deposit_id>');
      return;
    }
    const deposit = await storage.getDepositById(id);
    if (!deposit) {
      await ctx.reply('Deposit not found.');
      return;
    }
    if (deposit.screenshotPath && deposit.screenshotPath !== 'pending-upload') {
      await bot.telegram.sendPhoto(ctx.from.id, deposit.screenshotPath, {
        caption: `Deposit ${deposit.id}\nAmount: ${deposit.amount}\nStatus: ${deposit.status}`
      });
    } else {
      await ctx.reply('No screenshot attached for this deposit yet.');
    }
  });

  bot.command('approve_deposit', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const id = Number(ctx.message.text.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await ctx.reply('Usage: /approve_deposit <deposit_id>');
      return;
    }
    const deposit = await storage.approveDeposit(id);
    await ctx.reply(`Deposit ${id} approved.`);
    if (deposit) {
      const user = await storage.getUserById(deposit.userId);
      if (user) {
        await bot.telegram.sendMessage(user.telegramId, `✅ Your deposit of ${deposit.amount} has been approved and added to your wallet.`);
      }
    }
  });

  bot.command('reject_deposit', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const id = Number(ctx.message.text.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await ctx.reply('Usage: /reject_deposit <deposit_id>');
      return;
    }
    const deposit = await storage.rejectDeposit(id);
    await ctx.reply(`Deposit ${id} rejected.`);
    if (deposit) {
      const user = await storage.getUserById(deposit.userId);
      if (user) {
        await bot.telegram.sendMessage(user.telegramId, `❌ Your deposit of ${deposit.amount} has been rejected. Please try again or contact admin.`);
      }
    }
  });

  bot.command('approve_withdrawal', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const id = Number(ctx.message.text.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await ctx.reply('Usage: /approve_withdrawal <withdrawal_id>');
      return;
    }
    const withdrawal = await storage.approveWithdrawal(id);
    if (!withdrawal) {
      await ctx.reply(`Unable to approve withdrawal ${id}. It may be already processed or the user has insufficient balance.`);
      return;
    }
    await ctx.reply(`Withdrawal ${id} approved.`);
    const user = await storage.getUserById(withdrawal.userId);
    if (user) {
      await bot.telegram.sendMessage(user.telegramId, `✅ Your withdrawal request for ${withdrawal.amount} has been approved. Please check your receiving wallet.`);
    }
  });

  bot.command('broadcast', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const message = ctx.message.text.replace('/broadcast', '').trim();
    if (!message) {
      await ctx.reply('Usage: /broadcast <message>');
      return;
    }
    const users = await storage.getAllUsers();
    for (const user of users) {
      if (!user.isBanned) {
        try {
          await bot.telegram.sendMessage(user.telegramId, `📣 Admin broadcast:\n${message}`);
        } catch {
          // ignore failed sends
        }
      }
    }
    await ctx.reply('Broadcast sent.');
  });

  bot.command('ban', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const telegramId = Number(ctx.message.text.split(/\s+/)[1]);
    if (!Number.isFinite(telegramId)) {
      await ctx.reply('Usage: /ban <telegram_id>');
      return;
    }
    const user = await storage.banUser(telegramId);
    if (!user) {
      await ctx.reply('User not found.');
      return;
    }
    await ctx.reply(`User ${telegramId} banned.`);
    await bot.telegram.sendMessage(telegramId, '🚫 You have been banned from using this bot. Contact admin for support.').catch(() => undefined);
  });

  bot.command('unban', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const telegramId = Number(ctx.message.text.split(/\s+/)[1]);
    if (!Number.isFinite(telegramId)) {
      await ctx.reply('Usage: /unban <telegram_id>');
      return;
    }
    const user = await storage.unbanUser(telegramId);
    if (!user) {
      await ctx.reply('User not found.');
      return;
    }
    await ctx.reply(`User ${telegramId} unbanned.`);
    await bot.telegram.sendMessage(telegramId, '✅ You have been unbanned. You may use the bot again.').catch(() => undefined);
  });

  bot.command('rounds', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const rounds = await storage.getAllRounds();
    if (!rounds.length) {
      await ctx.reply('No lottery rounds found.');
      return;
    }
    const lines = rounds.map((round) => `#${round.roundNumber} (${round.status}) price: ${round.ticketPrice} tickets: ${round.maxTickets} ends: ${round.endsAt ?? 'n/a'}`).join('\n');
    await ctx.reply(`Lottery rounds:\n${lines}`);
  });

  bot.command('create_round', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const parts = ctx.message.text.split(/\s+/).slice(1);
    if (parts.length < 3) {
      await ctx.reply('Usage: /create_round <round_number> <max_tickets> <ticket_price> [ends_at_iso]');
      return;
    }
    const [roundNumberText, maxTicketsText, ticketPriceText, ...endsAtParts] = parts;
    const roundNumber = Number(roundNumberText);
    const maxTickets = Number(maxTicketsText);
    const ticketPrice = Number(ticketPriceText);
    const endsAt = endsAtParts.join(' ') || undefined;
    if (!Number.isFinite(roundNumber) || !Number.isFinite(maxTickets) || !Number.isFinite(ticketPrice)) {
      await ctx.reply('Invalid numbers.');
      return;
    }
    const round = await storage.createRound(roundNumber, maxTickets, ticketPrice, endsAt);
    await ctx.reply(`Round #${round.roundNumber} created with price ${round.ticketPrice} and max tickets ${round.maxTickets}.`);
  });

  bot.command('edit_round', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const parts = ctx.message.text.split(/\s+/).slice(1);
    if (parts.length < 3) {
      await ctx.reply('Usage: /edit_round <round_id> <max_tickets> <ticket_price> [ends_at_iso]');
      return;
    }
    const [roundIdText, maxTicketsText, ticketPriceText, ...endsAtParts] = parts;
    const roundId = Number(roundIdText);
    const maxTickets = Number(maxTicketsText);
    const ticketPrice = Number(ticketPriceText);
    const endsAt = endsAtParts.join(' ') || undefined;
    if (!Number.isFinite(roundId) || !Number.isFinite(maxTickets) || !Number.isFinite(ticketPrice)) {
      await ctx.reply('Invalid numbers.');
      return;
    }
    const round = await storage.updateRound(roundId, { maxTickets, ticketPrice, endsAt });
    if (!round) {
      await ctx.reply('Round not found.');
      return;
    }
    await ctx.reply(`Round #${round.roundNumber} updated.`);
  });

  bot.command('pause_round', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const id = Number(ctx.message.text.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await ctx.reply('Usage: /pause_round <round_id>');
      return;
    }
    const round = await storage.pauseRound(id);
    if (!round) {
      await ctx.reply('Round not found.');
      return;
    }
    await ctx.reply(`Round #${round.roundNumber} paused.`);
  });

  bot.command('credit', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const parts = ctx.message.text.split(/\s+/);
    if (parts.length < 3) {
      await ctx.reply('Usage: /credit <user_id> <amount>');
      return;
    }
    const userId = Number(parts[1]);
    const amount = Number(parts[2]);
    if (!Number.isFinite(userId) || !Number.isFinite(amount) || amount <= 0) {
      await ctx.reply('Invalid user ID or amount.');
      return;
    }
    
    await storage.updateWalletBalance(userId, amount);
    await storage.addTransaction(userId, 'admin_adjustment', amount, undefined, 'Admin credited balance');
    
    await ctx.reply(`Successfully credited ${amount} ETB to user ${userId}.`);
    const targetUser = await storage.getUserById(userId);
    if (targetUser) {
      try {
        await bot.telegram.sendMessage(targetUser.telegramId, `💰 Your wallet has been credited with ${amount} ETB by an admin.`);
      } catch (err) {
        // ignore
      }
    }
  });

  bot.command('debit', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const parts = ctx.message.text.split(/\s+/);
    if (parts.length < 3) {
      await ctx.reply('Usage: /debit <user_id> <amount>');
      return;
    }
    const userId = Number(parts[1]);
    const amount = Number(parts[2]);
    if (!Number.isFinite(userId) || !Number.isFinite(amount) || amount <= 0) {
      await ctx.reply('Invalid user ID or amount.');
      return;
    }
    
    await storage.updateWalletBalance(userId, -amount);
    await storage.addTransaction(userId, 'admin_adjustment', -amount, undefined, 'Admin debited balance');
    
    await ctx.reply(`Successfully debited ${amount} ETB from user ${userId}.`);
    const targetUser = await storage.getUserById(userId);
    if (targetUser) {
      try {
        await bot.telegram.sendMessage(targetUser.telegramId, `📉 Your wallet has been debited ${amount} ETB by an admin.`);
      } catch (err) {
        // ignore
      }
    }
  });

  bot.command('export', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const csvContent = await storage.exportTransactionsCSV();
    await ctx.replyWithDocument({
      source: Buffer.from(csvContent, 'utf-8'),
      filename: `transactions_export_${Date.now()}.csv`
    }, { caption: 'Here is the CSV export of all transactions.' });
  });

  bot.command('resume_round', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const id = Number(ctx.message.text.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await ctx.reply('Usage: /resume_round <round_id>');
      return;
    }
    const round = await storage.resumeRound(id);
    if (!round) {
      await ctx.reply('Round not found.');
      return;
    }
    await ctx.reply(`Round #${round.roundNumber} resumed.`);
  });

  bot.command('force_draw', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const id = Number(ctx.message.text.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await ctx.reply('Usage: /force_draw <round_id>');
      return;
    }
    const round = await storage.getRoundById(id);
    if (!round) {
      await ctx.reply('Round not found.');
      return;
    }
    const tickets = await storage.getTicketsForRound(round.id);
    if (!tickets.length) {
      await storage.markRoundAsDrawn(round.id, 0, 0);
      await ctx.reply(`Round #${round.roundNumber} closed with no tickets.`);
      return;
    }
    const winner = tickets[Math.floor(Math.random() * tickets.length)];
    await storage.markRoundAsDrawn(round.id, winner.ticketNumber, winner.userId);
    
    // Calculate prize amount
    const totalTickets = tickets.length;
    const totalPot = totalTickets * round.ticketPrice;
    const prizePercentage = Number(await storage.getSetting('default_prize_percentage') || 70);
    const prizeAmount = totalPot * (prizePercentage / 100);
    
    // Credit the winner's wallet
    await storage.updateWalletBalance(winner.userId, prizeAmount);
    await storage.addTransaction(winner.userId, 'lottery_win', prizeAmount, round.id, `Won round #${round.roundNumber} with ticket ${winner.ticketNumber}`);
    
    try {
      await bot.telegram.sendMessage(winner.userId, `🎉 Round #${round.roundNumber} has been force-drawn. You won ticket ${winner.ticketNumber}! Prize of ${prizeAmount} has been credited to your wallet!`);
    } catch (err) {
      console.error(`Failed to send win message to user ${winner.userId}:`, err);
    }
    await ctx.reply(`Round #${round.roundNumber} force-drawn. Winner ticket ${winner.ticketNumber}, prize ${prizeAmount}.`);
  });

  bot.command('settings', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const args = ctx.message.text.split(/\s+/).slice(1);
    if (!args.length) {
      const defaultTicketPrice = await storage.getSetting('default_ticket_price');
      const defaultMaxTickets = await storage.getSetting('default_max_tickets');
      const defaultPrizePercentage = await storage.getSetting('default_prize_percentage');
      const defaultFeePercentage = await storage.getSetting('default_fee_percentage');
      await ctx.reply(`Settings:\nTicket price: ${defaultTicketPrice}\nMax tickets: ${defaultMaxTickets}\nPrize %: ${defaultPrizePercentage}\nFee %: ${defaultFeePercentage}`);
      return;
    }
    const [key, value] = args;
    if (!key || value === undefined) {
      await ctx.reply('Usage: /settings <key> <value>');
      return;
    }
    // Key aliases for user friendliness
    const keyAliases: Record<string, string> = {
      'ticketprice': 'default_ticket_price',
      'ticket_price': 'default_ticket_price',
      'maxtickets': 'default_max_tickets',
      'max_tickets': 'default_max_tickets',
      'prizepercentage': 'default_prize_percentage',
      'prize_percentage': 'default_prize_percentage',
      'feepercentage': 'default_fee_percentage',
      'fee_percentage': 'default_fee_percentage'
    };
    const actualKey = keyAliases[key.toLowerCase()] || key.toLowerCase();
    await storage.setSetting(actualKey, value);
    
    // If we changed ticket price or max tickets, apply to the active round too!
    const activeRound = await storage.getActiveRound();
    if (activeRound) {
      if (actualKey === 'default_ticket_price') {
        await storage.updateRound(activeRound.id, { ticketPrice: Number(value) });
      }
      if (actualKey === 'default_max_tickets') {
        await storage.updateRound(activeRound.id, { maxTickets: Number(value) });
      }
    }
    
    await ctx.reply(`Setting ${actualKey} updated to ${value}.`);
  });

  bot.command('analytics', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const analytics = await storage.getAnalytics();
    await ctx.reply(`Analytics:\nUsers: ${analytics.totalUsers}\nBanned: ${analytics.totalBannedUsers}\nApproved deposits: ${analytics.totalDeposits}\nApproved withdrawals: ${analytics.totalWithdrawals}\nTickets sold: ${analytics.totalTickets}\nTotal balance: ${analytics.totalBalance}\nActive round: ${analytics.activeRound?.roundNumber ?? 'none'} (${analytics.activeRound?.status ?? 'n/a'})`);
  });

  bot.command('reject_withdrawal', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.reply('Access denied.');
      return;
    }
    const id = Number(ctx.message.text.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await ctx.reply('Usage: /reject_withdrawal <withdrawal_id>');
      return;
    }
    const withdrawal = await storage.rejectWithdrawal(id);
    await ctx.reply(`Withdrawal ${id} rejected.`);
    if (withdrawal) {
      const user = await storage.getUserById(withdrawal.userId);
      if (user) {
        await bot.telegram.sendMessage(user.telegramId, `❌ Your withdrawal request for ${withdrawal.amount} has been rejected. Please contact admin if you need help.`);
      }
    }
  });

  // Handle admin dashboard callback queries
  bot.action('admin:show_deposits', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCbQuery('Access denied.');
      return;
    }

    const pendingDeposits = await storage.listPendingDeposits();
    if (!pendingDeposits.length) {
      await ctx.editMessageText('No pending deposits.');
      return;
    }

    for (const deposit of pendingDeposits) {
      const buttons = Markup.inlineKeyboard([
        [
          Markup.button.callback('View', `admin:deposit:view:${deposit.id}`),
          Markup.button.callback('Approve', `admin:deposit:approve:${deposit.id}`),
          Markup.button.callback('Reject', `admin:deposit:reject:${deposit.id}`)
        ]
      ]);

      if (deposit.screenshotPath && deposit.screenshotPath !== 'pending-upload') {
        await bot.telegram.sendPhoto(ctx.from.id, deposit.screenshotPath, {
          caption: `Deposit #${deposit.id}\nUser ID: ${deposit.userId}\nAmount: ${deposit.amount}\nStatus: ${deposit.status}`,
          ...buttons
        });
      } else {
        await ctx.reply(`Deposit #${deposit.id}\nUser ID: ${deposit.userId}\nAmount: ${deposit.amount}\nStatus: ${deposit.status}\nNo screenshot attached.`, buttons);
      }
    }

    await ctx.answerCbQuery('Showing pending deposits.');
  });

  bot.action('admin:show_withdrawals', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCbQuery('Access denied.');
      return;
    }

    const pendingWithdrawals = await storage.listPendingWithdrawals();
    if (!pendingWithdrawals.length) {
      await ctx.editMessageText('No pending withdrawals.');
      return;
    }

    for (const withdrawal of pendingWithdrawals) {
      const buttons = Markup.inlineKeyboard([
        [
          Markup.button.callback('Approve', `admin:withdrawal:approve:${withdrawal.id}`),
          Markup.button.callback('Reject', `admin:withdrawal:reject:${withdrawal.id}`)
        ]
      ]);

      await ctx.reply(`Withdrawal #${withdrawal.id}\nUser ID: ${withdrawal.userId}\nAmount: ${withdrawal.amount}\nAddress: ${withdrawal.address}\nStatus: ${withdrawal.status}`, buttons);
    }

    await ctx.answerCbQuery('Showing pending withdrawals.');
  });

  bot.action('admin:show_rounds', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCbQuery('Access denied.');
      return;
    }

    const rounds = await storage.getAllRounds();
    if (!rounds.length) {
      await ctx.editMessageText('No rounds found.');
      return;
    }

    const lines = rounds.map(r => `#${r.roundNumber} | ${r.status} | Price: ${r.ticketPrice} | Max Tickets: ${r.maxTickets}`).join('\n');
    await ctx.editMessageText(`Rounds:\n${lines}`);
    await ctx.answerCbQuery('Showing rounds.');
  });

  bot.action('admin:force_draw', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCbQuery('Access denied.');
      return;
    }

    await ctx.editMessageText('Use /force_draw <round_id> to force-draw a round.');
    await ctx.answerCbQuery();
  });

  bot.action('admin:broadcast', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCbQuery('Access denied.');
      return;
    }

    await ctx.editMessageText('Use /broadcast <message> to send a broadcast.');
    await ctx.answerCbQuery();
  });

  bot.action('admin:ban_unban', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCbQuery('Access denied.');
      return;
    }

    await ctx.editMessageText('Use /ban <telegram_id> or /unban <telegram_id>.');
    await ctx.answerCbQuery();
  });

  bot.action('admin:settings', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCbQuery('Access denied.');
      return;
    }

    const defaultTicketPrice = await storage.getSetting('default_ticket_price');
    const defaultMaxTickets = await storage.getSetting('default_max_tickets');
    const defaultPrizePercentage = await storage.getSetting('default_prize_percentage');
    const defaultFeePercentage = await storage.getSetting('default_fee_percentage');
    await ctx.editMessageText(`Settings:\nTicket price: ${defaultTicketPrice}\nMax tickets: ${defaultMaxTickets}\nPrize %: ${defaultPrizePercentage}\nFee %: ${defaultFeePercentage}\n\nUse /settings <key> <value> to change.`);
    await ctx.answerCbQuery();
  });

  bot.action('admin:analytics', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCbQuery('Access denied.');
      return;
    }

    const analytics = await storage.getAnalytics();
    await ctx.editMessageText(`Analytics:\nUsers: ${analytics.totalUsers}\nBanned: ${analytics.totalBannedUsers}\nApproved deposits: ${analytics.totalDeposits}\nApproved withdrawals: ${analytics.totalWithdrawals}\nTickets sold: ${analytics.totalTickets}\nTotal balance: ${analytics.totalBalance}\nActive round: ${analytics.activeRound?.roundNumber ?? 'none'} (${analytics.activeRound?.status ?? 'n/a'})`);
    await ctx.answerCbQuery();
  });

  bot.action(/^admin:support:(reply|resolve):(\d+)$/, async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCbQuery('Access denied.');
      return;
    }

    const [, action, rawId] = ctx.match;
    const ticketId = Number(rawId);

    if (action === 'reply') {
      await ctx.answerCbQuery();
      await ctx.reply(`Please type your reply to Ticket #${ticketId} (or send /cancel):`);
      scenes.set(ctx.from.id, { state: 'admin_reply_support', ticketId });
      return;
    }

    if (action === 'resolve') {
      const ticket = await storage.resolveSupportTicket(ticketId);
      await ctx.answerCbQuery('Ticket resolved.');
      try {
        await ctx.editMessageText(`Ticket #${ticketId} has been resolved.`);
      } catch {
        // ignore
      }
      if (ticket) {
        const targetUser = await storage.getUserById(ticket.userId);
        if (targetUser) {
          try {
            await bot.telegram.sendMessage(targetUser.telegramId, `✅ Your support request (Ticket #${ticketId}) has been marked as resolved.`);
          } catch {
            // ignore
          }
        }
      }
      return;
    }
  });

  // Handle existing deposit/withdrawal callbacks
  bot.action(/^admin:(deposit|withdrawal):(view|approve|reject):(\d+)$/, async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await ctx.answerCbQuery('Access denied.');
      return;
    }

    const [, type, action, rawId] = ctx.match;
    const id = Number(rawId);

    if (type === 'deposit') {
      if (action === 'view') {
        const deposit = await storage.getDepositById(id);
        if (!deposit) {
          await ctx.answerCbQuery('Deposit not found.');
          return;
        }
        if (deposit.screenshotPath && deposit.screenshotPath !== 'pending-upload') {
          await ctx.answerCbQuery(`Viewing deposit #${id}`);
          await bot.telegram.sendPhoto(ctx.from.id, deposit.screenshotPath, {
            caption: `Deposit #${deposit.id}\nAmount: ${deposit.amount}\nStatus: ${deposit.status}`
          });
        } else {
          await ctx.answerCbQuery('No screenshot attached.');
        }
        return;
      }

      const editResponse = async (message: string) => {
        try {
          await ctx.editMessageCaption(message);
        } catch {
          await ctx.editMessageText(message);
        }
      };

      if (action === 'approve') {
        const deposit = await storage.approveDeposit(id);
        await ctx.answerCbQuery(`Deposit #${id} approved.`);
        await editResponse(`Deposit #${id} approved.`);
        if (deposit) {
          const user = await storage.getUserById(deposit.userId);
          if (user) {
            try {
              await bot.telegram.sendMessage(user.telegramId, `✅ Your deposit of ${deposit.amount} has been approved and added to your wallet.`);
            } catch (err) {
              console.error(`Failed to send deposit approve message to user ${user.telegramId}:`, err);
            }
          }
        }
        return;
      }

      if (action === 'reject') {
        const deposit = await storage.rejectDeposit(id);
        await ctx.answerCbQuery(`Deposit #${id} rejected.`);
        await editResponse(`Deposit #${id} rejected.`);
        if (deposit) {
          const user = await storage.getUserById(deposit.userId);
          if (user) {
            try {
              await bot.telegram.sendMessage(user.telegramId, `❌ Your deposit of ${deposit.amount} has been rejected. Please try again or contact admin.`);
            } catch (err) {
              console.error(`Failed to send deposit reject message to user ${user.telegramId}:`, err);
            }
          }
        }
        return;
      }
    }

    if (type === 'withdrawal') {
      if (action === 'approve') {
        const withdrawal = await storage.approveWithdrawal(id);
        await ctx.answerCbQuery(`Withdrawal #${id} approved.`);
        await ctx.editMessageText(`Withdrawal #${id} approved.`);
        if (withdrawal) {
          const user = await storage.getUserById(withdrawal.userId);
          if (user) {
            try {
              await bot.telegram.sendMessage(user.telegramId, `✅ Your withdrawal request for ${withdrawal.amount} has been approved. Please check your receiving wallet.`);
            } catch (err) {
              console.error(`Failed to send withdrawal approve message to user ${user.telegramId}:`, err);
            }
          }
        }
        return;
      }

      if (action === 'reject') {
        const withdrawal = await storage.rejectWithdrawal(id);
        await ctx.answerCbQuery(`Withdrawal #${id} rejected.`);
        await ctx.editMessageText(`Withdrawal #${id} rejected.`);
        if (withdrawal) {
          const user = await storage.getUserById(withdrawal.userId);
          if (user) {
            try {
              await bot.telegram.sendMessage(user.telegramId, `❌ Your withdrawal request for ${withdrawal.amount} has been rejected. Please contact admin if you need help.`);
            } catch (err) {
              console.error(`Failed to send withdrawal reject message to user ${user.telegramId}:`, err);
            }
          }
        }
        return;
      }
    }
  });

  bot.on('text', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user || !ctx.from) return;

    if (ctx.message.text === '/cancel') {
      scenes.delete(ctx.from.id);
      await ctx.reply('Command canceled.', Markup.keyboard([['🎟️ Play', '💰 Wallet'], ['💳 Deposit', '💸 Withdraw'], ['📜 History', '💬 Support', '❓ Help']]).resize());
      return;
    }

    const state = scenes.get(ctx.from.id);
    if (!state) {
      return;
    }

    if (state.state === 'support_message') {
      const userMsg = ctx.message.text;
      const ticket = await storage.createSupportTicket(user.id, userMsg);
      
      const walletInfo = await storage.getWallet(user.id);
      const caption = `⚠️ New Support Request #${ticket.id}\nFrom: ${ctx.from.first_name || 'User'} (${ctx.from.username ? '@' + ctx.from.username : 'no username'} / ID: ${ctx.from.id})\nWallet Balance: ${walletInfo?.balance ?? 0} ETB\n\nMessage: ${userMsg}`;
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('Reply', `admin:support:reply:${ticket.id}`),
          Markup.button.callback('Resolve', `admin:support:resolve:${ticket.id}`)
        ]
      ]);

      const adminIdsStr = config.ADMIN_TELEGRAM_IDS || '';
      for (const adminId of adminIdsStr.split(',').map((value) => Number(value.trim())).filter(Boolean)) {
        try {
          await bot.telegram.sendMessage(adminId, caption, keyboard);
        } catch (err) {
          console.error(`Failed to send support notification to admin ${adminId}:`, err);
        }
      }

      await ctx.reply('Thank you! Your help request has been sent to our support team.', Markup.keyboard([['🎟️ Play', '💰 Wallet'], ['💳 Deposit', '💸 Withdraw'], ['📜 History', '💬 Support', '❓ Help']]).resize());
      scenes.delete(ctx.from.id);
      return;
    }

    if (state.state === 'admin_reply_support') {
      const replyMsg = ctx.message.text;
      const ticketId = state.ticketId;
      if (!ticketId) {
        await ctx.reply('Error: Ticket ID not found in session.');
        scenes.delete(ctx.from.id);
        return;
      }

      const ticket = await storage.getSupportTicketById(ticketId);
      if (!ticket) {
        await ctx.reply('Error: Ticket not found.');
        scenes.delete(ctx.from.id);
        return;
      }

      const targetUser = await storage.getUserById(ticket.userId);
      if (!targetUser) {
        await ctx.reply('Error: User not found for this ticket.');
        scenes.delete(ctx.from.id);
        return;
      }

      await storage.resolveSupportTicket(ticketId, replyMsg);

      try {
        await bot.telegram.sendMessage(targetUser.telegramId, `✉️ Support Update (Ticket #${ticketId}):\n\n${replyMsg}`);
        await ctx.reply(`Reply sent to user ${targetUser.firstName || targetUser.telegramId}.`);
      } catch (err) {
        await ctx.reply(`Failed to send reply to user: ${(err as Error).message}`);
      }

      scenes.delete(ctx.from.id);
      return;
    }

    if (state.state === 'deposit_amount') {
      const amount = Number(ctx.message.text);
      if (!Number.isFinite(amount) || amount <= 0) {
        await ctx.reply('Please send a valid positive number.');
        return;
      }
      await ctx.reply('Please upload a screenshot of the payment proof.');
      const deposit = await storage.createDeposit(user.id, amount, 'pending-upload');
      scenes.set(ctx.from.id, { state: 'deposit_screenshot', depositId: deposit.id });
      return;
    }

    if (state.state === 'deposit_screenshot') {
      const message = ctx.message as typeof ctx.message & { photo?: Array<{ file_id: string }> };
      if (!message.photo?.length) {
        await ctx.reply('Please send a photo to confirm the deposit.');
        return;
      }
      const depositId = state.depositId;
      if (depositId) {
        await storage.updateDepositScreenshot(depositId, message.photo[0].file_id);
        const deposit = await storage.getDepositById(depositId);
        const walletInfo = await storage.getWallet(user.id);
        const caption = `New deposit request\nUser: ${ctx.from?.username ?? ctx.from?.first_name ?? 'Unknown'}\nAmount: ${deposit?.amount ?? 'n/a'}\nDeposit ID: ${depositId}\nWallet Balance: ${walletInfo?.balance ?? 0} ETB`;
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('Approve', `admin:deposit:approve:${depositId}`), Markup.button.callback('Reject', `admin:deposit:reject:${depositId}`)]
        ]);
        for (const adminId of config.ADMIN_TELEGRAM_IDS.split(',').map((value) => Number(value.trim())).filter(Boolean)) {
          try {
            await bot.telegram.sendPhoto(adminId, message.photo[0].file_id, { caption, ...keyboard });
          } catch (err) {
            console.error(`Failed to send deposit notification to admin ${adminId}:`, err);
          }
        }
      }
      await ctx.reply('Deposit request submitted for admin approval.');
      scenes.delete(ctx.from.id);
      return;
    }

    if (state.state === 'withdraw_request') {
      const parts = ctx.message.text.split(/\s+/);
      if (parts.length < 2) {
        await ctx.reply('Please send amount and wallet address.');
        return;
      }
      const amount = Number(parts[0]);
      const address = parts.slice(1).join(' ');
      if (!Number.isFinite(amount) || amount <= 0) {
        await ctx.reply('Please send a valid amount.');
        return;
      }
      const withdrawal = await storage.createWithdrawal(user.id, amount, address);
      const walletInfo = await storage.getWallet(user.id);
      
      // Notify admins about new withdrawal request
      const caption = `New withdrawal request\nUser: ${ctx.from?.username ?? ctx.from?.first_name ?? 'Unknown'}\nAmount: ${amount}\nAddress: ${address}\nWithdrawal ID: ${withdrawal.id}\nWallet Balance: ${walletInfo?.balance ?? 0} ETB`;
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Approve', `admin:withdrawal:approve:${withdrawal.id}`), Markup.button.callback('Reject', `admin:withdrawal:reject:${withdrawal.id}`)]
      ]);
      for (const adminId of config.ADMIN_TELEGRAM_IDS.split(',').map((value) => Number(value.trim())).filter(Boolean)) {
        try {
          await bot.telegram.sendMessage(adminId, caption, keyboard);
        } catch (err) {
          console.error(`Failed to send withdrawal notification to admin ${adminId}:`, err);
        }
      }
      
      await ctx.reply('Withdrawal request submitted for admin approval.');
      scenes.delete(ctx.from.id);
      return;
    }

    if (state.state === 'buy_ticket') {
      const round = await ensureRound();
      if (!round) {
        await ctx.reply('No active round available.');
        scenes.delete(ctx.from.id);
        return;
      }
      const ticketNumber = Number(ctx.message.text);
      if (!Number.isInteger(ticketNumber) || ticketNumber < 1 || ticketNumber > 100) {
        await ctx.reply('Choose a ticket number between 1 and 100.');
        return;
      }
      const tickets = await storage.getTicketsForRound(round.id);
      const existing = tickets.find((entry) => entry.ticketNumber === ticketNumber);
      if (existing) {
        await ctx.reply('That ticket number is already taken.');
        return;
      }
      const wallet = await storage.getWallet(user.id);
      if (!wallet || wallet.balance < round.ticketPrice) {
        await ctx.reply('Insufficient balance. Please deposit funds first.');
        scenes.delete(ctx.from.id);
        return;
      }
      await storage.buyTicket(round.id, user.id, ticketNumber);
      await storage.updateWalletBalance(user.id, -round.ticketPrice);
      await storage.addTransaction(user.id, 'lottery_purchase', round.ticketPrice, round.id, `Ticket ${ticketNumber}`);
      await ctx.reply(`Ticket ${ticketNumber} purchased successfully.`);
      scenes.delete(ctx.from.id);
      await maybeDrawRound(round.id);
      return;
    }
  });

  bot.on('photo', async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user || !ctx.from) return;
    const state = scenes.get(ctx.from.id);
    if (state?.state === 'deposit_screenshot') {
      const photo = ctx.message.photo?.[ctx.message.photo.length - 1];
      if (!photo) {
        await ctx.reply('Please send a photo to confirm the deposit.');
        return;
      }
      const depositId = state.depositId;
      if (depositId) {
        await storage.updateDepositScreenshot(depositId, photo.file_id);
        const deposit = await storage.getDepositById(depositId);
        const caption = `New deposit request\nUser: ${ctx.from?.username ?? ctx.from?.first_name ?? 'Unknown'}\nAmount: ${deposit?.amount ?? 'n/a'}\nDeposit ID: ${depositId}`;
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('Approve', `admin:deposit:approve:${depositId}`), Markup.button.callback('Reject', `admin:deposit:reject:${depositId}`)]
        ]);
        for (const adminId of config.ADMIN_TELEGRAM_IDS.split(',').map((value) => Number(value.trim())).filter(Boolean)) {
          await bot.telegram.sendPhoto(adminId, photo.file_id, { caption, ...keyboard });
        }
      }
      await ctx.reply('Deposit proof received. Admin review pending.');
      scenes.delete(ctx.from.id);
    }
  });
}
