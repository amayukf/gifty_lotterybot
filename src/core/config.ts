import { z } from 'zod';

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  ADMIN_TELEGRAM_IDS: z.string().default(''),
  DB_PATH: z.string().default('data/lucky100.sqlite'),
  TICKET_PRICE: z.coerce.number().default(10),
  MAX_TICKETS: z.coerce.number().default(100),
  REFERRAL_REWARD: z.coerce.number().default(5),
  ROUND_DURATION_MINUTES: z.coerce.number().default(15),
  NODE_ENV: z.string().default('development')
});

export const config = envSchema.parse(process.env);

export function isAdmin(telegramId: number) {
  return config.ADMIN_TELEGRAM_IDS.split(',').map((value) => Number(value.trim())).filter(Boolean).includes(telegramId);
}
