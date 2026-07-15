# Lucky100 Telegram Lottery Bot

Lucky100 is a Telegram lottery bot built with Node.js, TypeScript, Telegraf, SQLite, Drizzle ORM, and Zod.

## Features
- Automatic Telegram registration
- Wallet system
- Manual deposit requests with screenshot upload
- Manual withdrawal requests
- Admin approval/rejection workflow
- Lottery rounds with ticket numbers 1–100
- Duplicate ticket protection
- Automatic winner selection when the round fills or the timer expires
- Transaction history
- Referral rewards
- Telegram-based admin dashboard

## Requirements
- Node.js 20+
- npm 10+

## Setup
1. Clone the project and install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment file:
   ```bash
   cp .env.example .env
   ```
3. Fill in your Telegram bot token and admin IDs in `.env`.
4. Run the database migration/setup:
   ```bash
   npm run db:migrate
   ```
5. Start the bot:
   ```bash
   npm run dev
   ```

## Project Structure
- src/index.ts - entrypoint
- src/bot - Telegram bot handlers
- src/core - config and shared utilities
- src/db - database schema and migrations
- src/services - business services

## Notes
- The current implementation uses SQLite for persistence and is ready for extension with a richer admin workflow and scheduled round handling.
- For production, consider adding persistent media storage for deposit screenshots and a scheduler for automatic round closing.
