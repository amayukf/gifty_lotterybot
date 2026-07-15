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
    const nextEndsAt = new Date(Date.now() + config.ROUND_DURATION_MINUTES * 60_000).toISOString();
    await storage.createRound(round.roundNumber + 1, config.MAX_TICKETS, config.TICKET_PRICE, nextEndsAt);
    return;
  }

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
    
    // Notify the winner
    const winningUser = await storage.getUserById(winner.userId);
    if (winningUser) {
      try {
        await api.sendMessage({
          chat_id: winningUser.telegramId,
          text: `🎉 Lottery round #${round.roundNumber} has been drawn!\nYou won with ticket ${winner.ticketNumber}!\n\nPrize of ${prizeAmount} has been credited to your wallet!`
        });
      } catch (err) {
        console.error(`Failed to send win message to user ${winningUser.telegramId}:`, err);
      }
    }
  }

  // Automatically spin up the next round
  const nextEndsAt = new Date(Date.now() + config.ROUND_DURATION_MINUTES * 60_000).toISOString();
  await storage.createRound(round.roundNumber + 1, config.MAX_TICKETS, config.TICKET_PRICE, nextEndsAt);
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
  const round = await storage.getActiveRound();
  if (!round?.endsAt) {
    return;
  }
  if (new Date(round.endsAt).getTime() <= Date.now()) {
    await finalizeRound(round.id);
  }
}

export async function ensureRound() {
  const existingRound = await storage.getActiveRound();
  if (existingRound) {
    return existingRound;
  }

  const endsAt = new Date(Date.now() + config.ROUND_DURATION_MINUTES * 60_000).toISOString();
  return await storage.createRound(1, config.MAX_TICKETS, config.TICKET_PRICE, endsAt);
}
