// src/lib/staticConfig.ts

// This file contains the default, fallback configuration for the website.
// These values are used if they are not defined in your Vercel Edge Config.
// It is recommended to manage all these settings via Edge Config for live updates without redeployment.

export const staticConfig = {
  COMMUNITY_NAME: 'Horizon VRoleplay',
  LOGO_URL: 'https://l.top4top.io/p_356271n1v1.png',
  DISCORD_INVITE_URL: 'https://discord.gg/u3CazwhxVa',
  MTA_SERVER_URL: 'mtasa://134.255.216.22:22041',
  DISCORD_CLIENT_ID: '1423341328355295394',
  DISCORD_GUILD_ID: '1422936346233933980', 
};

export type AppConfig = typeof staticConfig;