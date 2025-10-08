// src/lib/config.ts

// This file contains the default, fallback configuration for the website.
// These values are used if they are not defined in your Vercel Environment Variables.
// It is recommended to manage all these settings via Environment Variables or Edge Config for live updates without redeployment.

export const staticConfig = {
  COMMUNITY_NAME: 'Horizon',
  LOGO_URL: 'https://l.top4top.io/p_356271n1v1.png', // A placeholder logo
  DISCORD_INVITE_URL: 'https://discord.gg/u3CazwhxVa',
  MTA_SERVER_URL: 'mtasa://134.255.216.22:22041',
};

export type AppConfig = typeof staticConfig;