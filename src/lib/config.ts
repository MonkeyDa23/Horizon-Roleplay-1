// /lib/config.ts

// ===================================================================================
// --- CENTRAL WEBSITE CONFIGURATION ---
// ===================================================================================
// This file contains all the public, non-sensitive variables for your community website.
// Fill in the placeholder values with your actual server details. It is safe to
// commit this file to version control.
// ===================================================================================

export const CONFIG = {

  // ===================================================================================
  // --- General Settings ---
  // ===================================================================================

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

  // ===================================================================================
  // --- Discord Application & OAuth2 (Public Info) ---
  // ===================================================================================
  // These are public-facing settings for your Discord Application.
  // Get them from the Discord Developer Portal: https://discord.com/developers/applications
  
  /**
   * Your Application's "APPLICATION ID" (also known as Client ID). This is public.
   */
  DISCORD_CLIENT_ID: '1423341328355295394', // Replace with your actual Client ID

  /**
   * The OAuth2 redirect URI is now generated dynamically in `src/contexts/AuthContext.tsx`
   * to support multiple environments (development, preview, production) seamlessly.
   * 
   * IMPORTANT: You must still add all potential callback URLs to your Discord application's
   * OAuth2 "Redirects" section in the Developer Portal.
   * For example:
   * - http://localhost:5173/#/auth/callback (for local development)
   * - https://your-production-site.com/#/auth/callback
   */
  
  // ===================================================================================
  // --- SECRETS (FOR BACKEND REFERENCE ONLY) ---
  // ===================================================================================
  // WARNING: DO NOT store real secrets (API keys, tokens) in frontend code. 
  // This section is a reference for your backend developer. In a real application,
  // these values MUST be stored as environment variables on your server.
  //
  // process.env.DISCORD_CLIENT_SECRET
  // process.env.DISCORD_BOT_TOKEN
  // process.env.API_KEY (for Google Gemini)
  // ===================================================================================

  // ===================================================================================
  // --- Server, Channel & Role IDs (Public Info) ---
  // ===================================================================================
  // These IDs are not sensitive and are used to identify resources within Discord.
  // How to get IDs: https://support.discord.com/hc/en-us/articles/206346498
  
  /**
   * Your main Discord Server ID (also called Guild ID).
   */
  DISCORD_SERVER_ID: '1422936346233933980', // Replace with your actual Server ID

  /**
   * Channel ID where the bot should post "New Application Submitted" notifications.
   * This is a backend integration point.
   */
  APPLICATION_NOTIFICATION_CHANNEL_ID: '1422941415486390334',

  /**
   * An array of Discord Role IDs that grant admin access on the website.
   * A secure backend is required to verify if a logged-in user has one of these roles.
   */
  ADMIN_ROLE_IDS: ['1423683069893673050'], // Replace with your actual Admin Role ID(s)
};
