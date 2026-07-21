PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE `users` (
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
INSERT INTO "users" ("id","telegram_id","username","first_name","last_name","language_code","is_admin","is_banned","referral_code","referred_by","scene_state","deposit_id","created_at","updated_at") VALUES(1,7246324907,'Bother32','Miyu',NULL,'en',0,0,'LU752186',NULL,NULL,NULL,'2026-07-15 13:53:07','2026-07-15T15:17:58.714Z');
INSERT INTO "users" ("id","telegram_id","username","first_name","last_name","language_code","is_admin","is_banned","referral_code","referred_by","scene_state","deposit_id","created_at","updated_at") VALUES(2,6597486602,'duna_fx','Pira ',NULL,'en',0,0,'LU178408',NULL,'buy_ticket',NULL,'2026-07-15 13:58:31','2026-07-15T14:02:42.848Z');
INSERT INTO "users" ("id","telegram_id","username","first_name","last_name","language_code","is_admin","is_banned","referral_code","referred_by","scene_state","deposit_id","created_at","updated_at") VALUES(3,6519746436,'gamenaeth','Eurosi',NULL,'en',0,0,'LU152645',NULL,'buy_ticket',NULL,'2026-07-15 14:20:47','2026-07-15T14:26:56.028Z');
INSERT INTO "users" ("id","telegram_id","username","first_name","last_name","language_code","is_admin","is_banned","referral_code","referred_by","scene_state","deposit_id","created_at","updated_at") VALUES(4,1758334208,'ame_kt','AME',NULL,'en',0,0,'LU106258',NULL,'withdraw_request',NULL,'2026-07-15 14:27:22','2026-07-15T15:16:19.821Z');
CREATE TABLE `wallets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `balance` real DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "wallets" ("id","user_id","balance","created_at","updated_at") VALUES(1,1,515,'2026-07-15 13:53:07','2026-07-15T14:28:10.287Z');
INSERT INTO "wallets" ("id","user_id","balance","created_at","updated_at") VALUES(2,2,100,'2026-07-15 13:58:31','2026-07-15T14:02:02.084Z');
INSERT INTO "wallets" ("id","user_id","balance","created_at","updated_at") VALUES(3,3,5,'2026-07-15 14:20:47','2026-07-15T14:26:58.223Z');
INSERT INTO "wallets" ("id","user_id","balance","created_at","updated_at") VALUES(4,4,24,'2026-07-15 14:27:22','2026-07-15T14:43:40.681Z');
CREATE TABLE `lottery_rounds` (
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
INSERT INTO "lottery_rounds" ("id","round_number","status","max_tickets","ticket_price","started_at","ends_at","winner_ticket","winner_user_id","created_at","updated_at") VALUES(1,1,'drawn',100,10,'2026-07-15 13:54:05','2026-07-15T14:09:05.619Z',0,0,'2026-07-15 13:54:05','2026-07-15T14:09:08.694Z');
INSERT INTO "lottery_rounds" ("id","round_number","status","max_tickets","ticket_price","started_at","ends_at","winner_ticket","winner_user_id","created_at","updated_at") VALUES(2,2,'drawn',50,500,'2026-07-15 14:09:08','2026-07-15T14:24:08.756Z',0,0,'2026-07-15 14:09:08','2026-07-15T14:24:58.246Z');
INSERT INTO "lottery_rounds" ("id","round_number","status","max_tickets","ticket_price","started_at","ends_at","winner_ticket","winner_user_id","created_at","updated_at") VALUES(3,3,'drawn',5,10,'2026-07-15 14:24:58','2026-07-15T14:39:58.434Z',3,1,'2026-07-15 14:24:58','2026-07-15T14:28:10.172Z');
INSERT INTO "lottery_rounds" ("id","round_number","status","max_tickets","ticket_price","started_at","ends_at","winner_ticket","winner_user_id","created_at","updated_at") VALUES(4,4,'drawn',100,10,'2026-07-15 14:28:10','2026-07-15T14:43:10.536Z',50,4,'2026-07-15 14:28:10','2026-07-15T14:43:19.080Z');
INSERT INTO "lottery_rounds" ("id","round_number","status","max_tickets","ticket_price","started_at","ends_at","winner_ticket","winner_user_id","created_at","updated_at") VALUES(5,5,'drawn',100,10,'2026-07-15 14:43:19','2026-07-15T14:58:19.514Z',0,0,'2026-07-15 14:43:19','2026-07-15T15:16:19.476Z');
INSERT INTO "lottery_rounds" ("id","round_number","status","max_tickets","ticket_price","started_at","ends_at","winner_ticket","winner_user_id","created_at","updated_at") VALUES(6,6,'open',100,1000,'2026-07-15 15:16:19','2026-07-15T15:31:19.677Z',NULL,NULL,'2026-07-15 15:16:19','2026-07-15T15:17:55.919Z');
CREATE TABLE `tickets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `round_id` integer NOT NULL,
  `user_id` integer NOT NULL,
  `ticket_number` integer NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "tickets" ("id","round_id","user_id","ticket_number","created_at","updated_at") VALUES(1,3,1,1,'2026-07-15 14:25:35','2026-07-15 14:25:35');
INSERT INTO "tickets" ("id","round_id","user_id","ticket_number","created_at","updated_at") VALUES(2,3,3,2,'2026-07-15 14:26:58','2026-07-15 14:26:58');
INSERT INTO "tickets" ("id","round_id","user_id","ticket_number","created_at","updated_at") VALUES(3,3,1,3,'2026-07-15 14:27:59','2026-07-15 14:27:59');
INSERT INTO "tickets" ("id","round_id","user_id","ticket_number","created_at","updated_at") VALUES(4,3,4,4,'2026-07-15 14:28:07','2026-07-15 14:28:07');
INSERT INTO "tickets" ("id","round_id","user_id","ticket_number","created_at","updated_at") VALUES(5,3,4,5,'2026-07-15 14:28:09','2026-07-15 14:28:09');
INSERT INTO "tickets" ("id","round_id","user_id","ticket_number","created_at","updated_at") VALUES(6,4,4,73,'2026-07-15 14:42:06','2026-07-15 14:42:06');
INSERT INTO "tickets" ("id","round_id","user_id","ticket_number","created_at","updated_at") VALUES(7,4,4,50,'2026-07-15 14:42:12','2026-07-15 14:42:12');
CREATE TABLE `deposits` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `amount` real NOT NULL,
  `screenshot_path` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `admin_note` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "deposits" ("id","user_id","amount","screenshot_path","status","admin_note","created_at","updated_at") VALUES(1,2,100,'AgACAgQAAxkBAAIBx2pXki_M12kVRqIX5boouinMJ-mJAAK5DWsbtY-5UrosF2niUCpnAQADAgADeQADPQQ','approved',NULL,'2026-07-15 13:58:55','2026-07-15T14:02:01.984Z');
INSERT INTO "deposits" ("id","user_id","amount","screenshot_path","status","admin_note","created_at","updated_at") VALUES(2,1,500,'AgACAgQAAxkBAAIB8WpXmE3n-1zl2_UagJotl2gP8ieUAALQEGsb-MHAUgTJH6P_6twTAQADAgADdwADPQQ','approved',NULL,'2026-07-15 14:25:07','2026-07-15T14:25:21.080Z');
INSERT INTO "deposits" ("id","user_id","amount","screenshot_path","status","admin_note","created_at","updated_at") VALUES(3,3,15,'AgACAgQAAxkBAAIB_2pXmKDG0FLZtu9uMc__A0RRL2x6AAIGDmsb_LTBUlI2KIg4qw9LAQADAgADeAADPQQ','approved',NULL,'2026-07-15 14:26:30','2026-07-15T14:26:48.189Z');
INSERT INTO "deposits" ("id","user_id","amount","screenshot_path","status","admin_note","created_at","updated_at") VALUES(4,4,50,'AgACAgQAAxkBAAICDWpXmNq8UNG2wmg-9CpaLgYyUVtpAAJQEGsboyq4Ut_uJt70IirYAQADAgADeAADPQQ','approved',NULL,'2026-07-15 14:27:32','2026-07-15T14:27:56.347Z');
INSERT INTO "deposits" ("id","user_id","amount","screenshot_path","status","admin_note","created_at","updated_at") VALUES(5,4,500,'AgACAgQAAxkBAAICImpXnBnnluAk3gxSttP3Bl6lnS1eAAJcEGsboyq4UqPXTDrkH3gwAQADAgADdwADPQQ','approved',NULL,'2026-07-15 14:41:19','2026-07-15T14:41:41.534Z');
CREATE TABLE `withdrawals` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `amount` real NOT NULL,
  `address` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `admin_note` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "withdrawals" ("id","user_id","amount","address","status","admin_note","created_at","updated_at") VALUES(1,4,500,'100037839','approved',NULL,'2026-07-15 14:43:19','2026-07-15T14:43:40.810Z');
CREATE TABLE `transactions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL,
  `type` text NOT NULL,
  `amount` real NOT NULL,
  `related_id` integer,
  `description` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(1,2,'deposit',100,1,'Deposit approved','2026-07-15 14:02:02');
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(2,1,'deposit',500,2,'Deposit approved','2026-07-15 14:25:21');
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(3,1,'lottery_purchase',10,3,'Ticket 1','2026-07-15 14:25:35');
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(4,3,'deposit',15,3,'Deposit approved','2026-07-15 14:26:48');
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(5,3,'lottery_purchase',10,3,'Ticket 2','2026-07-15 14:26:58');
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(6,4,'deposit',50,4,'Deposit approved','2026-07-15 14:27:56');
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(7,1,'lottery_purchase',10,3,'Ticket 3','2026-07-15 14:27:59');
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(8,4,'lottery_purchase',10,3,'Ticket 4','2026-07-15 14:28:07');
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(9,4,'lottery_purchase',10,3,'Ticket 5','2026-07-15 14:28:09');
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(10,1,'lottery_win',35,3,'Won round #3 with ticket 3','2026-07-15 14:28:10');
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(11,4,'deposit',500,5,'Deposit approved','2026-07-15 14:41:41');
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(12,4,'lottery_purchase',10,4,'Ticket 73','2026-07-15 14:42:06');
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(13,4,'lottery_purchase',10,4,'Ticket 50','2026-07-15 14:42:12');
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(14,4,'lottery_win',14,4,'Won round #4 with ticket 50','2026-07-15 14:43:19');
INSERT INTO "transactions" ("id","user_id","type","amount","related_id","description","created_at") VALUES(15,4,'withdrawal',-500,1,'Withdrawal approved','2026-07-15 14:43:40');
CREATE TABLE `referrals` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `referrer_id` integer NOT NULL,
  `referred_user_id` integer NOT NULL,
  `reward_amount` real NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE `admins` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `telegram_id` integer NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE `settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "settings" ("key","value","updated_at") VALUES('ticket','price','2026-07-15 14:02:29');
INSERT INTO "settings" ("key","value","updated_at") VALUES('max','tickets','2026-07-15 14:05:00');
INSERT INTO "settings" ("key","value","updated_at") VALUES('default_max_tickets','5','2026-07-15T14:24:58.613Z');
INSERT INTO "settings" ("key","value","updated_at") VALUES('default_ticket_price','1000','2026-07-15T15:17:55.843Z');
INSERT INTO "settings" ("key","value","updated_at") VALUES('max_ticket','5','2026-07-15 14:42:41');
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('users',4);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('wallets',4);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('lottery_rounds',6);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('deposits',5);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('transactions',15);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('tickets',7);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('withdrawals',1);
CREATE UNIQUE INDEX `users_telegram_id_unique` ON `users` (`telegram_id`);
CREATE UNIQUE INDEX `users_referral_code_unique` ON `users` (`referral_code`);
CREATE UNIQUE INDEX `lottery_rounds_round_number_unique` ON `lottery_rounds` (`round_number`);
CREATE UNIQUE INDEX `admins_telegram_id_unique` ON `admins` (`telegram_id`);
