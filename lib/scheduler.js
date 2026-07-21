import { api } from './api.js';
import * as storage from './storage.js';
import { config } from './config.js';

export async function finalizeRound(roundId) {
  const round = await storage.getRoundById(roundId);
  if (!round || round.status !== 'open') {
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
        await api.sendMessage({
          chat_id: buyer.telegramId,
          text: `🔔 Lottery round #${round.roundNumber} is now drawing... Best of luck!`
        });
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
            await api.sendMessage({
              chat_id: buyer.telegramId,
              text: `🎉 Lottery round #${round.roundNumber} has been drawn!\nYou won with ticket ${winner.ticketNumber}!\n\nPrize of ${prizeAmount} has been credited to your wallet!`
            });
          } else {
            await api.sendMessage({
              chat_id: buyer.telegramId,
              text: `ℹ️ Lottery round #${round.roundNumber} has been drawn.\nThe winning ticket was ${winner.ticketNumber}.\n\nBetter luck next time!`
            });
          }
        } catch (err) {
          console.error(`Failed to send post-draw message to user ${buyer.telegramId}:`, err);
        }
      }
    }
  }

  // Automatic round spanning removed (now managed via Admin Mini-App)
}

export async function maybeDrawRound(roundId) {
  const round = await storage.getRoundById(roundId);
  if (!round || round.status !== 'open') {
    return;
  }

  const tickets = await storage.getTicketsForRound(round.id);
  if (tickets.length >= round.maxTickets) {
    await finalizeRound(round.id);
  }
}

export async function checkExpiredRounds() {
  // Time-based automatic expiration is disabled. 
  // Rounds now only finish when max tickets are sold, or if forcefully drawn.
  return;
}

export async function ensureRound() {
  const existingRound = await storage.getActiveRound();
  if (existingRound) {
    return existingRound;
  }

  return existingRound || null;
}
