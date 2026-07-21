import { api } from '../lib/api.js';
import * as storage from '../lib/storage.js';
import * as scheduler from '../lib/scheduler.js';
import { config, isAdmin } from '../lib/config.js';
import { generateTicketGrid } from '../lib/keyboard.js';

export default async function (message, workerOrigin = '') {
  if (!message || !message.from || !message.chat) {
    return;
  }

  const telegramId = message.from.id;
  const chatId = message.chat.id;

  // 1. Run lazy-draw check first
  await scheduler.checkExpiredRounds();

  // 2. Get or create user
  const text = message.text || '';
  let referralCode = null;
  if (text.startsWith('/start')) {
    const parts = text.split(/\s+/);
    if (parts[1] && parts[1].startsWith('ref_')) {
      referralCode = parts[1].replace('ref_', '');
    }
  }

  const user = await storage.getOrCreateUser(telegramId, {
    username: message.from.username,
    firstName: message.from.first_name,
    lastName: message.from.lastName,
    languageCode: message.from.language_code
  }, referralCode);

  if (!user) {
    return;
  }

  if (user.isBanned) {
    await api.sendMessage({
      chat_id: chatId,
      text: '🚫 You are banned from using this bot. Contact admin for help.'
    });
    return;
  }

  // Define main reply keyboard
  const keyboardRows = [
    [{ text: '🎟️ Play' }, { text: '💰 Wallet' }],
    [{ text: '💳 Deposit' }, { text: '💸 Withdraw' }],
    [{ text: '📜 History' }, { text: '💬 Support' }, { text: '❓ Help' }]
  ];
  if (isAdmin(telegramId)) {
    keyboardRows.push([{ text: '⚙️ Admin Panel' }]);
  }
  const mainKeyboard = {
    keyboard: keyboardRows,
    resize_keyboard: true
  };

  // 3. Process commands / global keyboard overrides if any
  const normalizedText = text.trim();

  if (normalizedText === '/cancel') {
    await storage.clearUserScene(telegramId);
    await api.sendMessage({
      chat_id: chatId,
      text: 'Command canceled.',
      reply_markup: mainKeyboard
    });
    return;
  }

  if (normalizedText.startsWith('/start')) {
    const name = message.from.first_name || 'player';
    const me = await api.getMe();
    const botUsername = me.username;
    
    // Clear user scene on start
    await storage.clearUserScene(telegramId);

    const welcomeMsg = `🎉 Welcome to Lucky100, ${name}!\n\n🎟️ Play the lottery\n💰 Manage your wallet\n💳 Deposit or withdraw funds easily\n\n📢 Your referral link: https://t.me/${botUsername}?start=ref_${user.referralCode}\nShare it with friends to earn rewards!`;
    
    await api.sendMessage({
      chat_id: chatId,
      text: welcomeMsg,
      reply_markup: mainKeyboard
    });
    return;
  }

  if (normalizedText === '🎟️ Play' || normalizedText.startsWith('/play')) {
    const round = await scheduler.ensureRound();
    if (!round) {
      await api.sendMessage({ chat_id: chatId, text: 'No active round available.' });
      return;
    }

    const tickets = await storage.getTicketsForRound(round.id);
    const takenNumbers = new Set(tickets.map(t => t.ticketNumber));

    await storage.setUserScene(telegramId, 'buy_ticket');
    
    const replyMarkup = generateTicketGrid(round, takenNumbers);

    await api.sendMessage({
      chat_id: chatId,
      text: `🎟️ Round #${round.roundNumber}\n🎫 Price: ${round.ticketPrice} ETB\n📊 Tickets sold: ${tickets.length}\n\nSelect a number from the grid below to purchase (or type it):`,
      reply_markup: replyMarkup
    });
    return;
  }

  if (normalizedText === '💰 Wallet' || normalizedText.startsWith('/wallet')) {
    await storage.clearUserScene(telegramId);
    const wallet = await storage.getWallet(user.id);
    await api.sendMessage({
      chat_id: chatId,
      text: `💰 Your Wallet\nBalance: ${wallet?.balance ?? 0} ETB`
    });
    return;
  }

  if (normalizedText === '💳 Deposit' || normalizedText.startsWith('/deposit')) {
    await storage.setUserScene(telegramId, 'deposit_amount');
    await api.sendMessage({
      chat_id: chatId,
      text: '💳 To make a deposit:\n1. Send the deposit amount (e.g., 50)\n2. Then upload a screenshot of your payment'
    });
    return;
  }

  if (normalizedText === '💸 Withdraw' || normalizedText.startsWith('/withdraw')) {
    const wallet = await storage.getWallet(user.id);
    if (!wallet || wallet.balance <= 0) {
      await api.sendMessage({ chat_id: chatId, text: '❌ You do not have sufficient balance to make a withdrawal.' });
      return;
    }

    await storage.setUserScene(telegramId, 'withdraw_request');
    await api.sendMessage({
      chat_id: chatId,
      text: '💸 To withdraw:\nSend your request like this:\n[amount] [bank account or Telebirr number]\nExample: 500 Telebirr 0912345678'
    });
    return;
  }

  if (normalizedText === '📜 History' || normalizedText.startsWith('/history')) {
    await storage.clearUserScene(telegramId);
    const transactions = await storage.getTransactions(user.id);
    if (!transactions.length) {
      await api.sendMessage({ chat_id: chatId, text: '📜 No transaction history yet.' });
      return;
    }
    const typeEmojis = {
      'deposit': '💳',
      'withdrawal': '💸',
      'lottery_purchase': '🎟️',
      'referral_bonus': '👥',
      'admin_adjustment': '⚙️',
      'lottery_win': '🎉'
    };
    const lines = transactions.slice(0, 10).map((entry) => {
      const emoji = typeEmojis[entry.type] || '🔹';
      return `${emoji} ${entry.type}: ${entry.amount} (${entry.description || 'n/a'})`;
    }).join('\n');
    await api.sendMessage({
      chat_id: chatId,
      text: `📜 Recent transactions:\n${lines}`
    });
    return;
  }

  if (normalizedText === '❓ Help' || normalizedText.startsWith('/help')) {
    await storage.clearUserScene(telegramId);
    const isUserAdmin = isAdmin(telegramId);
    const adminLine = isUserAdmin ? '\n/admin - Admin dashboard' : '';
    await api.sendMessage({
      chat_id: chatId,
      text: `🎯 Lucky100 Guide:\n/play - Join the lottery round\n/wallet - Check your balance\n/deposit - Deposit funds\n/withdraw - Request a withdrawal\n/history - See your transactions\n/referral - Get your referral link\n/support - Contact support${adminLine}`
    });
    return;
  }

  if (normalizedText === '💬 Support' || normalizedText.startsWith('/support')) {
    await storage.setUserScene(telegramId, 'support_message');
    await api.sendMessage({
      chat_id: chatId,
      text: '💬 Please send your message or question below. Our support team will reply directly to this chat.\n\nSend /cancel to discard.'
    });
    return;
  }

  if (normalizedText.startsWith('/referral')) {
    await storage.clearUserScene(telegramId);
    const me = await api.getMe();
    await api.sendMessage({
      chat_id: chatId,
      text: `👥 Your Referral Link:\nhttps://t.me/${me.username}?start=ref_${user.referralCode}\n\nShare this with friends! When they join, you get a reward!`
    });
    return;
  }

  // --- ADMIN COMMANDS ---
  if (normalizedText === '⚙️ Admin Panel' || normalizedText.startsWith('/admin')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    await storage.clearUserScene(telegramId);

    const pendingDeposits = await storage.listPendingDeposits();
    const pendingWithdrawals = await storage.listPendingWithdrawals();
    const rounds = await storage.getAllRounds();
    const analytics = await storage.getAnalytics();

    const buttons = [
      [
        { text: '📊 Launch Dashboard', web_app: { url: workerOrigin + '/admin/dashboard' } }
      ],
      [
        { text: 'Manage Deposits', callback_data: 'admin:show_deposits' },
        { text: 'Manage Withdrawals', callback_data: 'admin:show_withdrawals' }
      ],
      [
        { text: 'Rounds', callback_data: 'admin:show_rounds' },
        { text: 'Force Draw', callback_data: 'admin:force_draw' }
      ],
      [
        { text: 'Broadcast', callback_data: 'admin:broadcast' },
        { text: 'Ban/Unban', callback_data: 'admin:ban_unban' }
      ],
      [
        { text: 'Settings', callback_data: 'admin:settings' },
        { text: 'Analytics', callback_data: 'admin:analytics' }
      ]
    ];

    await api.sendMessage({
      chat_id: chatId,
      text: `Admin dashboard\nPending deposits: ${pendingDeposits.length}\nPending withdrawals: ${pendingWithdrawals.length}\nRounds: ${rounds.length}\nTotal users: ${analytics.totalUsers}\nBanned users: ${analytics.totalBannedUsers}`,
      reply_markup: { inline_keyboard: buttons }
    });
    return;
  }

  if (normalizedText.startsWith('/credit')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const parts = normalizedText.split(/\s+/);
    if (parts.length < 3) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /credit <user_id> <amount>' });
      return;
    }
    const targetUserId = Number(parts[1]);
    const amount = Number(parts[2]);
    if (!Number.isFinite(targetUserId) || !Number.isFinite(amount) || amount <= 0) {
      await api.sendMessage({ chat_id: chatId, text: 'Invalid user ID or amount.' });
      return;
    }

    await storage.updateWalletBalance(targetUserId, amount);
    await storage.addTransaction(targetUserId, 'admin_adjustment', amount, undefined, 'Admin credited balance');

    await api.sendMessage({ chat_id: chatId, text: `Successfully credited ${amount} ETB to user ${targetUserId}.` });
    const targetUser = await storage.getUserById(targetUserId);
    if (targetUser) {
      try {
        await api.sendMessage({ chat_id: targetUser.telegramId, text: `💰 Your wallet has been credited with ${amount} ETB by an admin.` });
      } catch (err) {
        // ignore
      }
    }
    return;
  }

  if (normalizedText.startsWith('/debit')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const parts = normalizedText.split(/\s+/);
    if (parts.length < 3) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /debit <user_id> <amount>' });
      return;
    }
    const targetUserId = Number(parts[1]);
    const amount = Number(parts[2]);
    if (!Number.isFinite(targetUserId) || !Number.isFinite(amount) || amount <= 0) {
      await api.sendMessage({ chat_id: chatId, text: 'Invalid user ID or amount.' });
      return;
    }

    await storage.updateWalletBalance(targetUserId, -amount);
    await storage.addTransaction(targetUserId, 'admin_adjustment', -amount, undefined, 'Admin debited balance');

    await api.sendMessage({ chat_id: chatId, text: `Successfully debited ${amount} ETB from user ${targetUserId}.` });
    const targetUser = await storage.getUserById(targetUserId);
    if (targetUser) {
      try {
        await api.sendMessage({ chat_id: targetUser.telegramId, text: `📉 Your wallet has been debited ${amount} ETB by an admin.` });
      } catch (err) {
        // ignore
      }
    }
    return;
  }

  if (normalizedText.startsWith('/view_deposit')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const id = Number(normalizedText.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /view_deposit <deposit_id>' });
      return;
    }
    const deposit = await storage.getDepositById(id);
    if (!deposit) {
      await api.sendMessage({ chat_id: chatId, text: 'Deposit not found.' });
      return;
    }
    if (deposit.screenshotPath && deposit.screenshotPath !== 'pending-upload') {
      await api.sendPhoto({
        chat_id: chatId,
        photo: deposit.screenshotPath,
        caption: `Deposit ${deposit.id}\nAmount: ${deposit.amount}\nStatus: ${deposit.status}`
      });
    } else {
      await api.sendMessage({ chat_id: chatId, text: 'No screenshot attached for this deposit yet.' });
    }
    return;
  }

  if (normalizedText.startsWith('/approve_deposit')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const id = Number(normalizedText.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /approve_deposit <deposit_id>' });
      return;
    }
    const deposit = await storage.approveDeposit(id);
    await api.sendMessage({ chat_id: chatId, text: `Deposit ${id} approved.` });
    if (deposit) {
      const targetUser = await storage.getUserById(deposit.userId);
      if (targetUser) {
        try {
          await api.sendMessage({
            chat_id: targetUser.telegramId,
            text: `✅ Your deposit of ${deposit.amount} has been approved and added to your wallet.`
          });
        } catch (err) {
          console.error(`Failed to notify user ${targetUser.telegramId} of deposit approval`, err);
        }
      }
    }
    return;
  }

  if (normalizedText.startsWith('/reject_deposit')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const id = Number(normalizedText.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /reject_deposit <deposit_id>' });
      return;
    }
    const deposit = await storage.rejectDeposit(id);
    await api.sendMessage({ chat_id: chatId, text: `Deposit ${id} rejected.` });
    if (deposit) {
      const targetUser = await storage.getUserById(deposit.userId);
      if (targetUser) {
        try {
          await api.sendMessage({
            chat_id: targetUser.telegramId,
            text: `❌ Your deposit of ${deposit.amount} has been rejected. Please try again or contact admin.`
          });
        } catch (err) {
          console.error(`Failed to notify user ${targetUser.telegramId} of deposit rejection`, err);
        }
      }
    }
    return;
  }

  if (normalizedText.startsWith('/approve_withdrawal')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const id = Number(normalizedText.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /approve_withdrawal <withdrawal_id>' });
      return;
    }
    const withdrawal = await storage.approveWithdrawal(id);
    if (!withdrawal) {
      await api.sendMessage({
        chat_id: chatId,
        text: `Unable to approve withdrawal ${id}. It may already be processed or the user has insufficient balance.`
      });
      return;
    }
    await api.sendMessage({ chat_id: chatId, text: `Withdrawal ${id} approved.` });
    const targetUser = await storage.getUserById(withdrawal.userId);
    if (targetUser) {
      try {
        await api.sendMessage({
          chat_id: targetUser.telegramId,
          text: `✅ Your withdrawal request for ${withdrawal.amount} has been approved. Please check your receiving wallet.`
        });
      } catch (err) {
        console.error(`Failed to notify user ${targetUser.telegramId} of withdrawal approval`, err);
      }
    }
    return;
  }

  if (normalizedText.startsWith('/reject_withdrawal')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const id = Number(normalizedText.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /reject_withdrawal <withdrawal_id>' });
      return;
    }
    const withdrawal = await storage.rejectWithdrawal(id);
    await api.sendMessage({ chat_id: chatId, text: `Withdrawal ${id} rejected.` });
    if (withdrawal) {
      const targetUser = await storage.getUserById(withdrawal.userId);
      if (targetUser) {
        try {
          await api.sendMessage({
            chat_id: targetUser.telegramId,
            text: `❌ Your withdrawal request for ${withdrawal.amount} has been rejected. Please contact admin if you need help.`
          });
        } catch (err) {
          console.error(`Failed to notify user ${targetUser.telegramId} of withdrawal rejection`, err);
        }
      }
    }
    return;
  }

  if (normalizedText.startsWith('/broadcast')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const messageContent = normalizedText.replace('/broadcast', '').trim();
    if (!messageContent) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /broadcast <message>' });
      return;
    }
    const users = await storage.getAllUsers();
    for (const u of users) {
      if (!u.isBanned) {
        try {
          await api.sendMessage({
            chat_id: u.telegramId,
            text: `📣 Admin broadcast:\n${messageContent}`
          });
        } catch {
          // ignore failed sends
        }
      }
    }
    await api.sendMessage({ chat_id: chatId, text: 'Broadcast sent.' });
    return;
  }

  if (normalizedText.startsWith('/ban')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const targetTelegramId = Number(normalizedText.split(/\s+/)[1]);
    if (!Number.isFinite(targetTelegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /ban <telegram_id>' });
      return;
    }
    const targetUser = await storage.banUser(targetTelegramId);
    if (!targetUser) {
      await api.sendMessage({ chat_id: chatId, text: 'User not found.' });
      return;
    }
    await api.sendMessage({ chat_id: chatId, text: `User ${targetTelegramId} banned.` });
    try {
      await api.sendMessage({
        chat_id: targetTelegramId,
        text: '🚫 You have been banned from using this bot. Contact admin for support.'
      });
    } catch {
      // ignore
    }
    return;
  }

  if (normalizedText.startsWith('/unban')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const targetTelegramId = Number(normalizedText.split(/\s+/)[1]);
    if (!Number.isFinite(targetTelegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /unban <telegram_id>' });
      return;
    }
    const targetUser = await storage.unbanUser(targetTelegramId);
    if (!targetUser) {
      await api.sendMessage({ chat_id: chatId, text: 'User not found.' });
      return;
    }
    await api.sendMessage({ chat_id: chatId, text: `User ${targetTelegramId} unbanned.` });
    try {
      await api.sendMessage({
        chat_id: targetTelegramId,
        text: '✅ You have been unbanned. You may use the bot again.'
      });
    } catch {
      // ignore
    }
    return;
  }

  if (normalizedText.startsWith('/rounds')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const rounds = await storage.getAllRounds();
    if (!rounds.length) {
      await api.sendMessage({ chat_id: chatId, text: 'No lottery rounds found.' });
      return;
    }
    const lines = rounds.map((round) => `#${round.roundNumber} (${round.status}) price: ${round.ticketPrice} tickets: ${round.maxTickets} ends: ${round.endsAt ?? 'n/a'}`).join('\n');
    await api.sendMessage({ chat_id: chatId, text: `Lottery rounds:\n${lines}` });
    return;
  }

  if (normalizedText.startsWith('/create_round')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const parts = normalizedText.split(/\s+/).slice(1);
    if (parts.length < 3) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /create_round <round_number> <max_tickets> <ticket_price> [ends_at_iso]' });
      return;
    }
    const [roundNumberText, maxTicketsText, ticketPriceText, ...endsAtParts] = parts;
    const roundNumber = Number(roundNumberText);
    const maxTickets = Number(maxTicketsText);
    const ticketPrice = Number(ticketPriceText);
    const endsAt = endsAtParts.join(' ') || null;
    if (!Number.isFinite(roundNumber) || !Number.isFinite(maxTickets) || !Number.isFinite(ticketPrice)) {
      await api.sendMessage({ chat_id: chatId, text: 'Invalid numbers.' });
      return;
    }
    const round = await storage.createRound(roundNumber, maxTickets, ticketPrice, endsAt);
    await api.sendMessage({
      chat_id: chatId,
      text: `Round #${round.roundNumber} created with price ${round.ticketPrice} and max tickets ${round.maxTickets}.`
    });
    return;
  }

  if (normalizedText.startsWith('/edit_round')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const parts = normalizedText.split(/\s+/).slice(1);
    if (parts.length < 3) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /edit_round <round_id> <max_tickets> <ticket_price> [ends_at_iso]' });
      return;
    }
    const [roundIdText, maxTicketsText, ticketPriceText, ...endsAtParts] = parts;
    const roundId = Number(roundIdText);
    const maxTickets = Number(maxTicketsText);
    const ticketPrice = Number(ticketPriceText);
    const endsAt = endsAtParts.join(' ') || null;
    if (!Number.isFinite(roundId) || !Number.isFinite(maxTickets) || !Number.isFinite(ticketPrice)) {
      await api.sendMessage({ chat_id: chatId, text: 'Invalid numbers.' });
      return;
    }
    const round = await storage.updateRound(roundId, { maxTickets, ticketPrice, endsAt });
    if (!round) {
      await api.sendMessage({ chat_id: chatId, text: 'Round not found.' });
      return;
    }
    await api.sendMessage({ chat_id: chatId, text: `Round #${round.roundNumber} updated.` });
    return;
  }

  if (normalizedText.startsWith('/pause_round')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const id = Number(normalizedText.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /pause_round <round_id>' });
      return;
    }
    const round = await storage.pauseRound(id);
    if (!round) {
      await api.sendMessage({ chat_id: chatId, text: 'Round not found.' });
      return;
    }
    await api.sendMessage({ chat_id: chatId, text: `Round #${round.roundNumber} paused.` });
    return;
  }

  if (normalizedText.startsWith('/resume_round')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const id = Number(normalizedText.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /resume_round <round_id>' });
      return;
    }
    const round = await storage.resumeRound(id);
    if (!round) {
      await api.sendMessage({ chat_id: chatId, text: 'Round not found.' });
      return;
    }
    await api.sendMessage({ chat_id: chatId, text: `Round #${round.roundNumber} resumed.` });
    return;
  }

  if (normalizedText.startsWith('/force_draw')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const id = Number(normalizedText.split(/\s+/)[1]);
    if (!Number.isFinite(id)) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /force_draw <round_id>' });
      return;
    }
    
    await scheduler.finalizeRound(id);
    
    await api.sendMessage({
      chat_id: chatId,
      text: `Round #${id} drawn (or finalized if no rounds). Check logs/wallet for verification.`
    });
    return;
  }

  if (normalizedText.startsWith('/settings')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const args = normalizedText.split(/\s+/).slice(1);
    if (!args.length) {
      const defaultTicketPrice = await storage.getSetting('default_ticket_price');
      const defaultMaxTickets = await storage.getSetting('default_max_tickets');
      const defaultPrizePercentage = await storage.getSetting('default_prize_percentage');
      const defaultFeePercentage = await storage.getSetting('default_fee_percentage');
      await api.sendMessage({
        chat_id: chatId,
        text: `Settings:\nTicket price: ${defaultTicketPrice}\nMax tickets: ${defaultMaxTickets}\nPrize %: ${defaultPrizePercentage}\nFee %: ${defaultFeePercentage}`
      });
      return;
    }
    const value = args[args.length - 1];
    const key = args.slice(0, -1).join('_').toLowerCase();
    if (!key || value === undefined) {
      await api.sendMessage({ chat_id: chatId, text: 'Usage: /settings <key> <value>' });
      return;
    }
    const keyAliases = {
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
    
    const activeRound = await storage.getActiveRound();
    if (activeRound) {
      if (actualKey === 'default_ticket_price') {
        await storage.updateRound(activeRound.id, { ticketPrice: Number(value) });
      }
      if (actualKey === 'default_max_tickets') {
        await storage.updateRound(activeRound.id, { maxTickets: Number(value) });
      }
    }
    
    await api.sendMessage({
      chat_id: chatId,
      text: `Setting ${actualKey} updated to ${value}.`
    });
    return;
  }

  if (normalizedText.startsWith('/analytics')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const analytics = await storage.getAnalytics();
    await api.sendMessage({
      chat_id: chatId,
      text: `Analytics:\nUsers: ${analytics.totalUsers}\nBanned: ${analytics.totalBannedUsers}\nApproved deposits: ${analytics.totalDeposits}\nApproved withdrawals: ${analytics.totalWithdrawals}\nTickets sold: ${analytics.totalTickets}\nTotal balance: ${analytics.totalBalance}\nActive round: ${analytics.activeRound?.roundNumber ?? 'none'} (${analytics.activeRound?.status ?? 'n/a'})`
    });
    return;
  }

  if (normalizedText.startsWith('/export')) {
    if (!isAdmin(telegramId)) {
      await api.sendMessage({ chat_id: chatId, text: 'Access denied.' });
      return;
    }
    const csvContent = await storage.exportTransactionsCSV();
    
    // Convert string to Blob using global Blob class available in Workers
    const blob = new Blob([csvContent], { type: 'text/csv' });
    // In FormData, attach the blog as the file parameter
    await api.sendDocument({
      chat_id: chatId,
      document: blob,
      caption: 'Here is the CSV export of all transactions.'
    });
    return;
  }

  // --- 4. Scene Handler Logic ---
  const currentSceneState = user.sceneState;

  if (currentSceneState === 'support_message') {
    const ticket = await storage.createSupportTicket(user.id, normalizedText);
    const walletInfo = await storage.getWallet(user.id);
    
    // Notify admins
    const caption = `⚠️ New Support Request #${ticket.id}\nFrom: ${message.from.first_name || 'User'} (${message.from.username ? '@' + message.from.username : 'no username'} / ID: ${message.from.id})\nWallet Balance: ${walletInfo?.balance ?? 0} ETB\n\nMessage: ${normalizedText}`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: 'Reply', callback_data: `admin:support:reply:${ticket.id}` },
          { text: 'Resolve', callback_data: `admin:support:resolve:${ticket.id}` }
        ]
      ]
    };
    for (const val of config.ADMIN_TELEGRAM_IDS.split(',').map((v) => Number(v.trim())).filter(Boolean)) {
      try {
        await api.sendMessage({ chat_id: val, text: caption, reply_markup: keyboard });
      } catch (err) {
        console.error(`Failed to send support notification to admin ${val}`, err);
      }
    }
    
    await storage.clearUserScene(telegramId);
    await api.sendMessage({
      chat_id: chatId,
      text: 'Thank you! Your help request has been sent to our support team.',
      reply_markup: mainKeyboard
    });
    return;
  }

  if (currentSceneState === 'admin_reply_support') {
    const ticketId = user.depositId; // Reused depositId to store ticketId
    if (!ticketId) {
      await api.sendMessage({ chat_id: chatId, text: 'Error: Ticket ID not found in session.' });
      await storage.clearUserScene(telegramId);
      return;
    }

    const ticket = await storage.getSupportTicketById(ticketId);
    if (!ticket) {
      await api.sendMessage({ chat_id: chatId, text: 'Error: Ticket not found.' });
      await storage.clearUserScene(telegramId);
      return;
    }

    const targetUser = await storage.getUserById(ticket.userId);
    if (!targetUser) {
      await api.sendMessage({ chat_id: chatId, text: 'Error: User not found for this ticket.' });
      await storage.clearUserScene(telegramId);
      return;
    }

    await storage.resolveSupportTicket(ticketId, normalizedText);

    try {
      await api.sendMessage({
        chat_id: targetUser.telegramId,
        text: `✉️ Support Update (Ticket #${ticketId}):\n\n${normalizedText}`
      });
      await api.sendMessage({
        chat_id: chatId,
        text: `Reply sent to user ${targetUser.firstName || targetUser.telegramId}.`
      });
    } catch (err) {
      await api.sendMessage({
        chat_id: chatId,
        text: `Failed to send reply to user: ${err.message}`
      });
    }

    await storage.clearUserScene(telegramId);
    return;
  }

  if (currentSceneState === 'deposit_amount') {
    const amount = Number(normalizedText);
    if (!Number.isFinite(amount) || amount <= 0) {
      await api.sendMessage({ chat_id: chatId, text: 'Please send a valid positive number.' });
      return;
    }
    const deposit = await storage.createDeposit(user.id, amount, 'pending-upload');
    await storage.setUserScene(telegramId, 'deposit_screenshot', deposit.id);
    await api.sendMessage({ chat_id: chatId, text: 'Please upload a screenshot of the payment proof.' });
    return;
  }

  if (currentSceneState === 'deposit_screenshot') {
    if (!message.photo || !message.photo.length) {
      await api.sendMessage({ chat_id: chatId, text: 'Please send a photo to confirm the deposit.' });
      return;
    }

    const photo = message.photo[message.photo.length - 1];
    const depositId = Number(user.sceneData);
    
    if (depositId) {
      await storage.updateDepositScreenshot(depositId, photo.file_id);
    }
    
    await storage.clearUserScene(telegramId);
    
    await api.sendMessage({
      chat_id: chatId,
      text: '✅ Your deposit request and payment proof have been sent to admins for verification. Please wait for approval.'
    });

    // Notify admins directly in chat
    const caption = `💳 New deposit request pending approval\nUser: ${message.from.username ? '@' + message.from.username : message.from.first_name || 'Unknown'}\nDeposit ID: ${depositId}`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: 'Approve', callback_data: `admin:deposit:approve:${depositId}` },
          { text: 'Reject', callback_data: `admin:deposit:reject:${depositId}` }
        ]
      ]
    };
    for (const val of config.ADMIN_TELEGRAM_IDS.split(',').map((v) => Number(v.trim())).filter(Boolean)) {
      try {
        await api.sendPhoto({ chat_id: val, photo: photo.file_id, caption, reply_markup: keyboard });
      } catch (err) { }
    }
    return;
  }

  if (currentSceneState === 'withdraw_request') {
    const parts = normalizedText.split(/\s+/);
    if (parts.length < 2) {
      await api.sendMessage({ chat_id: chatId, text: 'Please send amount and bank/Telebirr address.' });
      return;
    }
    const amount = Number(parts[0]);
    const address = parts.slice(1).join(' ');
    if (!Number.isFinite(amount) || amount <= 0) {
      await api.sendMessage({ chat_id: chatId, text: 'Please send a valid amount.' });
      return;
    }
    
    const walletInfo = await storage.getWallet(user.id);
    if (!walletInfo || walletInfo.balance < amount) {
      await api.sendMessage({ chat_id: chatId, text: `❌ Insufficient balance. You only have ${walletInfo?.balance ?? 0} ETB.` });
      return;
    }

    const withdrawal = await storage.createWithdrawal(user.id, amount, address);
    
    // Notify admins
    const caption = `New withdrawal request\nUser: ${message.from.username || message.from.first_name || 'Unknown'}\nAmount: ${amount}\nAddress: ${address}\nWithdrawal ID: ${withdrawal.id}\nWallet Balance: ${walletInfo?.balance ?? 0} ETB`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: 'Approve', callback_data: `admin:withdrawal:approve:${withdrawal.id}` },
          { text: 'Reject', callback_data: `admin:withdrawal:reject:${withdrawal.id}` }
        ]
      ]
    };
    for (const val of config.ADMIN_TELEGRAM_IDS.split(',').map((v) => Number(v.trim())).filter(Boolean)) {
      try {
        await api.sendMessage({ chat_id: val, text: caption, reply_markup: keyboard });
      } catch (err) {
        console.error(`Failed to send withdrawal notification to admin ${val}`, err);
      }
    }
    
    await storage.clearUserScene(telegramId);
    await api.sendMessage({
      chat_id: chatId,
      text: 'Withdrawal request submitted for admin approval.'
    });
    return;
  }

  if (currentSceneState === 'buy_ticket') {
    const round = await scheduler.ensureRound();
    if (!round) {
      await api.sendMessage({ chat_id: chatId, text: 'No active round available.' });
      await storage.clearUserScene(telegramId);
      return;
    }
    const ticketNumber = Number(normalizedText);
    if (!Number.isInteger(ticketNumber) || ticketNumber < 1 || ticketNumber > round.maxTickets) {
      await api.sendMessage({ chat_id: chatId, text: `Choose a ticket number between 1 and ${round.maxTickets}.` });
      return;
    }
    const tickets = await storage.getTicketsForRound(round.id);
    const existing = tickets.find((entry) => entry.ticketNumber === ticketNumber);
    if (existing) {
      await api.sendMessage({ chat_id: chatId, text: 'That ticket number is already taken.' });
      return;
    }
    const wallet = await storage.getWallet(user.id);
    if (!wallet || wallet.balance < round.ticketPrice) {
      await api.sendMessage({ chat_id: chatId, text: 'Insufficient balance. Please deposit funds first.' });
      await storage.clearUserScene(telegramId);
      return;
    }
    
    await storage.buyTicket(round.id, user.id, ticketNumber);
    await storage.updateWalletBalance(user.id, -round.ticketPrice);
    await storage.addTransaction(user.id, 'lottery_purchase', round.ticketPrice, round.id, `Ticket ${ticketNumber}`);
    await api.sendMessage({ chat_id: chatId, text: `Ticket ${ticketNumber} purchased successfully.` });
    
    await storage.clearUserScene(telegramId);
    await scheduler.maybeDrawRound(round.id);
    return;
  }

  // Handle Photo Messages for deposit confirmations
  if (message.photo && message.photo.length) {
    if (currentSceneState === 'deposit_screenshot' && user.depositId) {
      const depositId = user.depositId;
      const photo = message.photo[message.photo.length - 1]; // largest size
      await storage.updateDepositScreenshot(depositId, photo.file_id);
      
      const deposit = await storage.getDepositById(depositId);
      const walletInfo = await storage.getWallet(user.id);
      const caption = `New deposit request\nUser: ${message.from.username || message.from.first_name || 'Unknown'}\nAmount: ${deposit?.amount ?? 'n/a'}\nDeposit ID: ${depositId}\nWallet Balance: ${walletInfo?.balance ?? 0} ETB`;
      const keyboard = {
        inline_keyboard: [
          [
            { text: 'Approve', callback_data: `admin:deposit:approve:${depositId}` },
            { text: 'Reject', callback_data: `admin:deposit:reject:${depositId}` }
          ]
        ]
      };
      
      for (const val of config.ADMIN_TELEGRAM_IDS.split(',').map((v) => Number(v.trim())).filter(Boolean)) {
        try {
          await api.sendPhoto({
            chat_id: val,
            photo: photo.file_id,
            caption,
            reply_markup: keyboard
          });
        } catch (err) {
          console.error(`Failed to send deposit screenshot notification to admin ${val}`, err);
        }
      }
      
      await storage.clearUserScene(telegramId);
      await api.sendMessage({
        chat_id: chatId,
        text: 'Deposit proof received. Admin review pending.'
      });
      return;
    }
  }

  // Default fallthrough message
  await api.sendMessage({
    chat_id: chatId,
    text: 'Use the buttons or commands to navigate.',
    reply_markup: mainKeyboard
  });
}
