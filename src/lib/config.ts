// src/lib/config.ts

// This file contains the default, fallback configuration for the website.
// These values are used if they are not defined in your Vercel Environment Variables.
// It is recommended to manage all these settings via Environment Variables for live updates without redeployment.

export const staticConfig = {
  COMMUNITY_NAME: 'Horizon',
  LOGO_URL: 'https://l.top4top.io/p_356271n1v1.png',
  DISCORD_INVITE_URL: 'https://discord.gg/u3CazwhxVa',
  MTA_SERVER_URL: 'mtasa://134.255.216.22:22041',
  DISCORD_CLIENT_ID: '', // Must be set in environment variables
  DISCORD_GUILD_ID: '', // Optional, but needed for Discord Widget
};

export type AppConfig = typeof staticConfig;
