import { getDb } from '../lib/db.js';
import { setDb } from '../lib/storage.js';
import { setApi, TelegramApi } from '../lib/api.js';
import { setConfig } from '../lib/config.js';
import messageHandler from '../handlers/message.js';
import callbackQueryHandler from '../handlers/callback_query.js';
import * as storage from '../lib/storage.js';
import * as scheduler from '../lib/scheduler.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET') {
      if (url.pathname === '/admin/dashboard') {
        const { dashboardHtml } = await import('../lib/dashboard.js');
        return new Response(dashboardHtml, {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        });
      }
      return new Response('Lucky100 Telegram Bot is running.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      // 2. Initialize environment config and binding managers
      setConfig(env);
      
      const dbInstance = getDb(env);
      setDb(dbInstance);

      if (url.pathname === '/api/admin/data') {
        const body = await request.json();
        const adminIds = (env.ADMIN_TELEGRAM_IDS || '').split(',').map((v) => Number(v.trim())).filter(Boolean);
        
        if (!body.userId || !adminIds.includes(Number(body.userId))) {
          return new Response('Unauthorized', { status: 401 });
        }
        
        const analytics = await storage.getAnalytics();
        if (analytics.activeRound) {
          const tickets = await storage.getTicketsForRound(analytics.activeRound.id);
          analytics.activeRound.ticketsSold = tickets.length;
        }

        const pendingDeposits = await storage.listPendingDeposits();
        const pendingWithdrawals = await storage.listPendingWithdrawals();
        
        const settings = {
          defaultTicketPrice: await storage.getSetting('default_ticket_price') ?? env.TICKET_PRICE ?? '10',
          defaultMaxTickets: await storage.getSetting('default_max_tickets') ?? env.MAX_TICKETS ?? '100',
          defaultPrizePercentage: await storage.getSetting('default_prize_percentage') ?? '70',
          defaultFeePercentage: await storage.getSetting('default_fee_percentage') ?? '20'
        };
        
        return new Response(JSON.stringify({
          ...analytics,
          pendingDeposits,
          pendingWithdrawals,
          settings
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.pathname === '/api/admin/action') {
        const body = await request.json();
        const adminIds = (env.ADMIN_TELEGRAM_IDS || '').split(',').map((v) => Number(v.trim())).filter(Boolean);
        
        if (!body.userId || !adminIds.includes(Number(body.userId))) {
          return new Response('Unauthorized', { status: 401 });
        }

        // Action routing logic
        const apiInstance = new TelegramApi(env.BOT_TOKEN.trim());
        setApi(apiInstance);

        try {
          if (body.action === 'approve_deposit') {
            await storage.approveDeposit(body.id);
            const dep = await storage.getDepositById(body.id);
            if (dep) {
              const u = await storage.getUserById(dep.userId);
              if (u) await apiInstance.sendMessage({ chat_id: u.telegramId, text: `✅ Your deposit of ${dep.amount} ETB has been approved.` }).catch(() => {});
            }
          } else if (body.action === 'reject_deposit') {
            await storage.rejectDeposit(body.id);
            const dep = await storage.getDepositById(body.id);
            if (dep) {
              const u = await storage.getUserById(dep.userId);
              if (u) await apiInstance.sendMessage({ chat_id: u.telegramId, text: `❌ Your deposit of ${dep.amount} ETB was rejected. Please contact support.` }).catch(() => {});
            }
          } else if (body.action === 'approve_withdrawal') {
            await storage.approveWithdrawal(body.id);
            const w = await storage.getWithdrawalById(body.id);
            if (w) {
              const u = await storage.getUserById(w.userId);
              if (u) await apiInstance.sendMessage({ chat_id: u.telegramId, text: `✅ Your withdrawal of ${w.amount} ETB has been processed and approved.` }).catch(() => {});
            }
          } else if (body.action === 'reject_withdrawal') {
            await storage.rejectWithdrawal(body.id);
            const w = await storage.getWithdrawalById(body.id);
            if (w) {
              const u = await storage.getUserById(w.userId);
              if (u) await apiInstance.sendMessage({ chat_id: u.telegramId, text: `❌ Your withdrawal of ${w.amount} ETB was rejected. The amount has been refunded to your wallet.` }).catch(() => {});
            }
          } else if (body.action === 'save_settings') {
            await storage.setSetting('default_ticket_price', String(body.payload.defaultTicketPrice));
            await storage.setSetting('default_max_tickets', String(body.payload.defaultMaxTickets));
            await storage.setSetting('default_prize_percentage', String(body.payload.defaultPrizePercentage));
            await storage.setSetting('default_fee_percentage', String(body.payload.defaultFeePercentage));
            
            const activeRound = await storage.getActiveRound();
            if (activeRound) {
              await storage.updateRound(activeRound.id, { 
                ticketPrice: Number(body.payload.defaultTicketPrice),
                maxTickets: Number(body.payload.defaultMaxTickets) 
              });
            }
          } else if (body.action === 'start_round') {
            const activeRound = await storage.getActiveRound();
            if (activeRound) throw new Error('A round is already running.');
            
            const rounds = await storage.getAllRounds();
            const nextRoundNumber = rounds.length + 1;
            const max = Number(await storage.getSetting('default_max_tickets') ?? env.MAX_TICKETS ?? 100);
            const price = Number(await storage.getSetting('default_ticket_price') ?? env.TICKET_PRICE ?? 10);
            
            const dur = Number(env.ROUND_DURATION_MINUTES || 15);
            const nextEndsAt = new Date(Date.now() + dur * 60_000).toISOString();
            
            await storage.createRound(nextRoundNumber, max, price, nextEndsAt);
          } else if (body.action === 'force_draw') {
            const activeRound = await storage.getActiveRound();
            if (!activeRound) throw new Error('No active round to draw.');
            await scheduler.finalizeRound(activeRound.id);
          } else if (body.action === 'send_broadcast') {
            if (!body.payload || !body.payload.message) throw new Error('Message is required.');
            const messageContent = body.payload.message;
            const users = await storage.getAllUsers();
            for (const u of users) {
              if (!u.isBanned) {
                try {
                  await apiInstance.sendMessage({
                    chat_id: u.telegramId,
                    text: `📣 Admin broadcast:\n${messageContent}`
                  });
                } catch { /* ignore */ }
              }
            }
          }
          
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      if (!env.BOT_TOKEN) {
        return new Response('Missing BOT_TOKEN configuration in Worker environment.', { status: 500 });
      }
      const apiInstance = new TelegramApi(env.BOT_TOKEN.trim());
      setApi(apiInstance);

      // 3. Process webhook update payload
      const update = await request.json();

      if (update.message) {
        await messageHandler(update.message, url.origin);
      } else if (update.callback_query) {
        await callbackQueryHandler(update.callback_query, url.origin);
      }

      // Return 200 OK to Telegram to confirm receipt of the update
      return new Response('OK', { status: 200 });
    } catch (err) {
      console.error('Error handling Telegram webhook update:', err);
      // We still return 200 to prevent Telegram from retrying the same broken update endlessly
      return new Response('Error Handled', { status: 200 });
    }
  }
};
