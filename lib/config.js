export let config = {
  ADMIN_TELEGRAM_IDS: '',
  TICKET_PRICE: 10,
  MAX_TICKETS: 100,
  REFERRAL_REWARD: 5,
  ROUND_DURATION_MINUTES: 15
};

export function setConfig(env) {
  config.ADMIN_TELEGRAM_IDS = env.ADMIN_TELEGRAM_IDS || '';
  config.TICKET_PRICE = Number(env.TICKET_PRICE || 10);
  config.MAX_TICKETS = Number(env.MAX_TICKETS || 100);
  config.REFERRAL_REWARD = Number(env.REFERRAL_REWARD || 5);
  config.ROUND_DURATION_MINUTES = Number(env.ROUND_DURATION_MINUTES || 15);
}

export function isAdmin(telegramId) {
  if (!config.ADMIN_TELEGRAM_IDS) return false;
  return config.ADMIN_TELEGRAM_IDS
    .split(',')
    .map((val) => Number(val.trim()))
    .filter(Boolean)
    .includes(Number(telegramId));
}
