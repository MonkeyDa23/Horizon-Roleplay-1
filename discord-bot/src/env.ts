// src/env.ts
import 'dotenv/config';

export const env = {
  // Discord Bot
  DISCORD_BOT_TOKEN: process.env.GAME_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN,
  DISCORD_CLIENT_ID: process.env.GAME_BOT_CLIENT_ID || process.env.DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID || '',
  LOG_GUILD_ID: process.env.LOG_GUILD_ID || '', // Dedicated logging server ID
  WEBSITE_BOT_CHANNEL_ID: process.env.WEBSITE_BOT_CHANNEL_ID || '',
  LOG_CHANNEL_MTA: process.env.LOG_CHANNEL_MTA || '',
  LOG_CHANNEL_COMMANDS: process.env.LOG_CHANNEL_COMMANDS || '',
  LOG_CHANNEL_AUTH: process.env.LOG_CHANNEL_AUTH || '',
  LOG_CHANNEL_ADMIN: process.env.LOG_CHANNEL_ADMIN || '',
  LOG_CHANNEL_STORE: process.env.LOG_CHANNEL_STORE || '',
  LOG_CHANNEL_FINANCE: process.env.LOG_CHANNEL_FINANCE || '',
  LOG_CHANNEL_SUBMISSIONS: process.env.LOG_CHANNEL_SUBMISSIONS || '',
  LOG_CHANNEL_VISITS: process.env.LOG_CHANNEL_VISITS || '',
  DISCORD_ADMIN_ROLE_ID: process.env.DISCORD_ADMIN_ROLE_ID || '',
  API_SECRET_KEY: process.env.API_SECRET_KEY || '',

  // MySQL / phpMyAdmin Connection
  MTA_DB_HOST: process.env.MTA_DB_HOST,
  MTA_DB_USER: process.env.MTA_DB_USER,
  MTA_DB_PASSWORD: process.env.MTA_DB_PASSWORD,
  MTA_DB_NAME: process.env.MTA_DB_NAME,
  PORT: process.env.PORT || 3001
};
