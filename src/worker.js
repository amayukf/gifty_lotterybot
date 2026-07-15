import { getDb } from '../lib/db.js';
import { setDb } from '../lib/storage.js';
import { setApi, TelegramApi } from '../lib/api.js';
import { setConfig } from '../lib/config.js';
import messageHandler from '../handlers/message.js';
import callbackQueryHandler from '../handlers/callback_query.js';

export default {
  async fetch(request, env, ctx) {
    // 1. Only allow POST requests (or return a status check)
    if (request.method !== 'POST') {
      return new Response('Lucky100 Telegram Bot is running.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    try {
      // 2. Initialize environment config and binding managers
      setConfig(env);
      
      const dbInstance = getDb(env);
      setDb(dbInstance);

      if (!env.BOT_TOKEN) {
        return new Response('Missing BOT_TOKEN configuration in Worker environment.', { status: 500 });
      }
      const apiInstance = new TelegramApi(env.BOT_TOKEN.trim());
      setApi(apiInstance);

      // 3. Process webhook update payload
      const update = await request.json();

      if (update.message) {
        await messageHandler(update.message);
      } else if (update.callback_query) {
        await callbackQueryHandler(update.callback_query);
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
