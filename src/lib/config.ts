// /lib/config.ts

// ===================================================================================
// --- CENTRAL WEBSITE CONFIGURATION ---
// ===================================================================================
// This file contains all the public, non-sensitive variables for your community website.
// Fill in the placeholder values with your actual server details.
// ===================================================================================

export const CONFIG = {
  /**
   * The name of your community. This will be displayed on the homepage, navbar, etc.
   */
  COMMUNITY_NAME: 'Horizon Roleplay',

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
  
  /**
   * Your Application's "APPLICATION ID" (also known as Client ID). This is public.
   * Get it from the Discord Developer Portal: https://discord.com/developers/applications
   */
  DISCORD_CLIENT_ID: '1423341328355295394', // <-- Replace with your actual Application/Client ID

  /**
   * Your main Discord Server ID (also called Guild ID).
   * This is REQUIRED for fetching user roles and for the live member count widget.
   */
  DISCORD_GUILD_ID: '1422936346233933980', // <-- REPLACE THIS WITH YOUR ACTUAL SERVER/GUILD ID

  /**
   * YOUR REDIRECT URI(s)
   * The OAuth2 redirect URI is generated dynamically by the website to support multiple
   * environments (development, preview, production) seamlessly.
   * 
   * >>> CRITICAL ACTION REQUIRED <<<
   * You MUST add all potential callback URLs to your Discord application's
   * OAuth2 -> "Redirects" section in the Developer Portal.
   * 
   * Copy and paste the following URLs into the "Redirects" box:
   * 
   * 1. For local development: http://localhost:5173/#/auth/callback
   * 2. For your live website: https://YOUR-WEBSITE-URL.com/#/auth/callback
   * (Replace "YOUR-WEBSITE-URL.com" with your actual domain name)
   * 
   * The `#` is required because this site uses HashRouter.
   */
   
  // ===================================================================================
  // --- Discord Bot Integration (Backend Simulation) ---
  // ===================================================================================
  // These values are used by the mock backend to simulate sending notifications.
  // In a real application, these might be environment variables on your server.
  
  /**
   * An array of Discord Role IDs that grant admin access to the website's admin panel.
   */
  ADMIN_ROLE_IDS: ['1423683069893673050'], // <-- Replace with your actual admin role ID(s). Example: ['123456789012345678']

  /**
   * The Discord Channel ID where new application submissions will be sent.
   * Your bot needs write permissions in this channel.
   */
  APPLICATION_NOTIFICATION_CHANNEL_ID: '1422936347093504012', // <-- Replace with your actual channel ID
};
