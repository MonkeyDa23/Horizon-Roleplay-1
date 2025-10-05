// src/lib/config.ts

// This file contains the central configuration for the website.
// Update these values to match your community's details.

export const CONFIG = {
  /**
   * Your community's name. This will be used in titles and other parts of the site.
   */
  COMMUNITY_NAME: 'Horizon VRoleplay',

  /**
   * The URL for your community's logo.
   * Recommended format: PNG with a transparent background.
   */
  LOGO_URL: 'https://l.top4top.io/p_356271n1v1.png',

  /**
   * The full invite URL for your Discord server.
   */
  DISCORD_INVITE_URL: 'https://discord.gg/u3CazwhxVa',

  /**
   * The connection URL for your Multi Theft Auto (MTA) server.
   * Format: 'mtasa://ip:port'
   */
  MTA_SERVER_URL: 'mtasa://134.255.216.22:22041',

  // --- Discord OAuth2 & API Configuration ---
  
  /**
   * The client ID of your Discord application from the Discord Developer Portal.
   * This is safe to be public and is required by the frontend to initiate login.
   * IMPORTANT: You must also set this as an Environment Variable in Vercel for the backend to use.
   */
  DISCORD_CLIENT_ID: '1423341328355295394',

  /**
   * The ID of your Discord server (also known as a Guild ID).
   * This is public and used for the live member count widget.
   * IMPORTANT: You must also set this as an Environment Variable in Vercel for the backend to use.
   */
  DISCORD_GUILD_ID: '1422936346233933980', 

  /**
   * A mock user ID for a simulated admin in a local development environment.
   * This is ONLY used by the mock data layer and has no effect on the live system.
   */
  MOCK_ADMIN_ID: '1423683069893673050',
};
