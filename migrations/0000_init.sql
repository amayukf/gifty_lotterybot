CREATE TABLE IF NOT EXISTS `users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `telegram_id` integer NOT NULL,
  `username` text,
  `first_name` text,
  `last_name` text,
  `language_code` text,
  `is_admin` integer DEFAULT 0 NOT NULL,
  `is_banned` integer DEFAULT 0 NOT NULL,
  `referral_code` text,
  `referred_by` integer,
  `scene_state` text,
  `deposit_id` integer,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `users_telegram_id_unique` ON `users` (`telegram_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `users_referral_code_unique` ON `users` (`referral_code`);

CREATE TABLE IF NOT EXISTS `wallets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `balance` real DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS `lottery_rounds` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `round_number` integer NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `max_tickets` integer DEFAULT 100 NOT NULL,
  `ticket_price` real DEFAULT 10 NOT NULL,
  `started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `ends_at` text,
  `winner_ticket` integer,
  `winner_user_id` integer,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `lottery_rounds_round_number_unique` ON `lottery_rounds` (`round_number`);

CREATE TABLE IF NOT EXISTS `tickets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `round_id` integer NOT NULL,
  `user_id` integer NOT NULL,
  `ticket_number` integer NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS `deposits` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `amount` real NOT NULL,
  `screenshot_path` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `admin_note` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `amount` real NOT NULL,
  `address` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `admin_note` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS `transactions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `type` text NOT NULL,
  `amount` real NOT NULL,
  `related_id` integer,
  `description` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS `referrals` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `referrer_id` integer NOT NULL,
  `referred_user_id` integer NOT NULL,
  `reward_amount` real NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS `admins` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `telegram_id` integer NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `admins_telegram_id_unique` ON `admins` (`telegram_id`);

CREATE TABLE IF NOT EXISTS `settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
