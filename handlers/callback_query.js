import { api } from '../lib/api.js';
import * as storage from '../lib/storage.js';
import { isAdmin } from '../lib/config.js';
import { generateTicketGrid } from '../lib/keyboard.js';
import * as scheduler from '../lib/scheduler.js';

export default async function (callbackQuery) {
  if (!callbackQuery || !callbackQuery.from) {
    return;
  }

  const telegramId = callbackQuery.from.id;
  const data = callbackQuery.data || '';
  const queryId = callbackQuery.id;

  // 1. Verify admin privilege if the action is an admin command
  if (data.startsWith('admin:')) {
    if (!isAdmin(telegramId)) {
      await api.answerCallbackQuery({
        callback_query_id: queryId,
        text: 'Access denied.',
        show_alert: true
      });
      return;
    }
  }

  const chat_id = callbackQuery.message?.chat?.id;
  const message_id = callbackQuery.message?.message_id;

  // --- User callbacks (ticket purchase/interactions) ---
  if (data.startsWith('ticket:taken:')) {
    const ticketNum = data.split(':')[2];
    await api.answerCallbackQuery({
      callback_query_id: queryId,
      text: `Ticket #${ticketNum} has already been purchased.`,
      show_alert: false
    });
    return;
  }

  if (data.startsWith('ticket:buy:')) {
    const parts = data.split(':');
    const roundId = Number(parts[2]);
    const ticketNumber = Number(parts[3]);

    const round = await storage.getRoundById(roundId);
    if (!round || round.status !== 'open') {
      await api.answerCallbackQuery({
        callback_query_id: queryId,
        text: 'This round has ended or is not open.',
        show_alert: true
      });
      return;
    }

    const userRecord = await storage.getUserByTelegramId(telegramId);
    if (!userRecord || userRecord.isBanned) {
      await api.answerCallbackQuery({
        callback_query_id: queryId,
        text: 'Access suspended.',
        show_alert: true
      });
      return;
    }

    const tickets = await storage.getTicketsForRound(round.id);
    const existing = tickets.find(t => t.ticketNumber === ticketNumber);
    if (existing) {
      await api.answerCallbackQuery({
        callback_query_id: queryId,
        text: 'This ticket number has already been taken!',
        show_alert: true
      });
      return;
    }

    const wallet = await storage.getWallet(userRecord.id);
    if (!wallet || wallet.balance < round.ticketPrice) {
      await api.answerCallbackQuery({
        callback_query_id: queryId,
        text: `Insufficient balance! Cost: ${round.ticketPrice} USDT. Balance: ${wallet?.balance ?? 0} USDT.`,
        show_alert: true
      });
      return;
    }

    // Complete ticket purchase
    await storage.buyTicket(round.id, userRecord.id, ticketNumber);
    await storage.updateWalletBalance(userRecord.id, -round.ticketPrice);
    await storage.addTransaction(userRecord.id, 'lottery_purchase', round.ticketPrice, round.id, `Ticket ${ticketNumber}`);

    await api.answerCallbackQuery({
      callback_query_id: queryId,
      text: `🎉 Ticket #${ticketNumber} purchased successfully!`,
      show_alert: true
    });

    // Run draw check (starts round creation/finalization dynamically)
    await scheduler.maybeDrawRound(round.id);

    // Refresh UI
    const updatedRound = await storage.getRoundById(round.id);
    if (updatedRound && updatedRound.status === 'open') {
      const updatedTickets = await storage.getTicketsForRound(round.id);
      const updatedTaken = new Set(updatedTickets.map(t => t.ticketNumber));
      const remaining = updatedRound.maxTickets - updatedTickets.length;
      const replyMarkup = generateTicketGrid(updatedRound, updatedTaken);

      await api.editMessageText({
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        text: `🎟️ Round #${updatedRound.roundNumber}\n🎫 Price: ${updatedRound.ticketPrice} USDT\n📊 Tickets remaining: ${remaining}/${updatedRound.maxTickets}\n\nSelect a number from the grid below to purchase (or type it):`,
        reply_markup: replyMarkup
      });
    } else {
      await api.editMessageText({
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        text: `🎟️ Round #${round.roundNumber} has been drawn and finalized!`
      });
    }
    return;
  }

  const editResponse = async (newText) => {
    if (!chat_id || !message_id) return;
    try {
      if (callbackQuery.message.photo) {
        await api.editMessageCaption({
          chat_id,
          message_id,
          caption: newText
        });
      } else {
        await api.editMessageText({
          chat_id,
          message_id,
          text: newText
        });
      }
    } catch (err) {
      console.error('Failed to edit request response message', err);
    }
  };

  // --- Admin action dispatcher ---
  
  if (data === 'admin:show_deposits') {
    const pendingDeposits = await storage.listPendingDeposits();
    if (!pendingDeposits.length) {
      await editResponse('No pending deposits.');
      await api.answerCallbackQuery({ callback_query_id: queryId, text: 'No pending deposits' });
      return;
    }

    await api.answerCallbackQuery({ callback_query_id: queryId, text: 'Showing pending deposits' });

    for (const deposit of pendingDeposits) {
      const keyboard = {
        inline_keyboard: [
          [
            { text: 'View', callback_data: `admin:deposit:view:${deposit.id}` },
            { text: 'Approve', callback_data: `admin:deposit:approve:${deposit.id}` },
            { text: 'Reject', callback_data: `admin:deposit:reject:${deposit.id}` }
          ]
        ]
      };

      if (deposit.screenshotPath && deposit.screenshotPath !== 'pending-upload') {
        try {
          await api.sendPhoto({
            chat_id: telegramId,
            photo: deposit.screenshotPath,
            caption: `Deposit #${deposit.id}\nUser ID: ${deposit.userId}\nAmount: ${deposit.amount}\nStatus: ${deposit.status}`,
            reply_markup: keyboard
          });
        } catch (err) {
          console.error(`Failed to send deposit photo ${deposit.id} to admin`, err);
        }
      } else {
        await api.sendMessage({
          chat_id: telegramId,
          text: `Deposit #${deposit.id}\nUser ID: ${deposit.userId}\nAmount: ${deposit.amount}\nStatus: ${deposit.status}\nNo screenshot attached.`,
          reply_markup: keyboard
        });
      }
    }
    return;
  }

  if (data === 'admin:show_withdrawals') {
    const pendingWithdrawals = await storage.listPendingWithdrawals();
    if (!pendingWithdrawals.length) {
      await editResponse('No pending withdrawals.');
      await api.answerCallbackQuery({ callback_query_id: queryId, text: 'No pending withdrawals' });
      return;
    }

    await api.answerCallbackQuery({ callback_query_id: queryId, text: 'Showing pending withdrawals' });

    for (const withdrawal of pendingWithdrawals) {
      const keyboard = {
        inline_keyboard: [
          [
            { text: 'Approve', callback_data: `admin:withdrawal:approve:${withdrawal.id}` },
            { text: 'Reject', callback_data: `admin:withdrawal:reject:${withdrawal.id}` }
          ]
        ]
      };

      await api.sendMessage({
        chat_id: telegramId,
        text: `Withdrawal #${withdrawal.id}\nUser ID: ${withdrawal.userId}\nAmount: ${withdrawal.amount}\nAddress: ${withdrawal.address}\nStatus: ${withdrawal.status}`,
        reply_markup: keyboard
      });
    }
    return;
  }

  if (data === 'admin:show_rounds') {
    const rounds = await storage.getAllRounds();
    if (!rounds.length) {
      await editResponse('No rounds found.');
      await api.answerCallbackQuery({ callback_query_id: queryId });
      return;
    }

    const lines = rounds.map(r => `#${r.roundNumber} | ${r.status} | Price: ${r.ticketPrice} | Max: ${r.maxTickets}`).join('\n');
    await editResponse(`Rounds:\n${lines}`);
    await api.answerCallbackQuery({ callback_query_id: queryId });
    return;
  }

  if (data === 'admin:force_draw') {
    await editResponse('Use /force_draw <round_id> to force-draw a round.');
    await api.answerCallbackQuery({ callback_query_id: queryId });
    return;
  }

  if (data === 'admin:broadcast') {
    await editResponse('Use /broadcast <message> to send a broadcast.');
    await api.answerCallbackQuery({ callback_query_id: queryId });
    return;
  }

  if (data === 'admin:ban_unban') {
    await editResponse('Use /ban <telegram_id> or /unban <telegram_id>.');
    await api.answerCallbackQuery({ callback_query_id: queryId });
    return;
  }

  if (data === 'admin:settings') {
    const defaultTicketPrice = await storage.getSetting('default_ticket_price');
    const defaultMaxTickets = await storage.getSetting('default_max_tickets');
    const defaultPrizePercentage = await storage.getSetting('default_prize_percentage');
    const defaultFeePercentage = await storage.getSetting('default_fee_percentage');
    
    await editResponse(`Settings:\nTicket price: ${defaultTicketPrice}\nMax tickets: ${defaultMaxTickets}\nPrize %: ${defaultPrizePercentage}\nFee %: ${defaultFeePercentage}\n\nUse /settings <key> <value> to change.`);
    await api.answerCallbackQuery({ callback_query_id: queryId });
    return;
  }

  if (data === 'admin:analytics') {
    const analytics = await storage.getAnalytics();
    await editResponse(`Analytics:\nUsers: ${analytics.totalUsers}\nBanned: ${analytics.totalBannedUsers}\nApproved deposits: ${analytics.totalDeposits}\nApproved withdrawals: ${analytics.totalWithdrawals}\nTickets sold: ${analytics.totalTickets}\nTotal balance: ${analytics.totalBalance}\nActive round: ${analytics.activeRound?.roundNumber ?? 'none'} (${analytics.activeRound?.status ?? 'n/a'})`);
    await api.answerCallbackQuery({ callback_query_id: queryId });
    return;
  }

  // --- Dynamic action matches: admin:(deposit|withdrawal):(view|approve|reject):(\d+) ---
  const matches = data.match(/^admin:(deposit|withdrawal):(view|approve|reject):(\d+)$/);
  if (matches) {
    const [, type, action, rawId] = matches;
    const id = Number(rawId);

    if (type === 'deposit') {
      if (action === 'view') {
        const deposit = await storage.getDepositById(id);
        if (!deposit) {
          await api.answerCallbackQuery({ callback_query_id: queryId, text: 'Deposit not found' });
          return;
        }
        if (deposit.screenshotPath && deposit.screenshotPath !== 'pending-upload') {
          await api.answerCallbackQuery({ callback_query_id: queryId, text: `Viewing deposit #${id}` });
          try {
            await api.sendPhoto({
              chat_id: telegramId,
              photo: deposit.screenshotPath,
              caption: `Deposit #${deposit.id}\nAmount: ${deposit.amount}\nStatus: ${deposit.status}`
            });
          } catch (err) {
            console.error(`Failed to send deposit photo ${id} to admin`, err);
          }
        } else {
          await api.answerCallbackQuery({ callback_query_id: queryId, text: 'No screenshot attached.' });
        }
        return;
      }

      if (action === 'approve') {
        const deposit = await storage.approveDeposit(id);
        await api.answerCallbackQuery({ callback_query_id: queryId, text: `Deposit #${id} approved` });
        await editResponse(`Deposit #${id} approved.`);
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

      if (action === 'reject') {
        const deposit = await storage.rejectDeposit(id);
        await api.answerCallbackQuery({ callback_query_id: queryId, text: `Deposit #${id} rejected` });
        await editResponse(`Deposit #${id} rejected.`);
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
    }

    if (type === 'withdrawal') {
      if (action === 'approve') {
        const withdrawal = await storage.approveWithdrawal(id);
        await api.answerCallbackQuery({ callback_query_id: queryId, text: `Withdrawal #${id} approved` });
        await editResponse(`Withdrawal #${id} approved.`);
        if (withdrawal) {
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
        }
        return;
      }

      if (action === 'reject') {
        const withdrawal = await storage.rejectWithdrawal(id);
        await api.answerCallbackQuery({ callback_query_id: queryId, text: `Withdrawal #${id} rejected` });
        await editResponse(`Withdrawal #${id} rejected.`);
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
    }
  }

  try {
    await api.answerCallbackQuery({ callback_query_id: queryId });
  } catch (err) {
    // ignore if already handled
  }
}
