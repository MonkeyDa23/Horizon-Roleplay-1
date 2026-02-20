


// In environments where Vite's client types aren't automatically resolved,
// this manual declaration provides the necessary type information to TypeScript,
// resolving errors about 'env' not existing on 'import.meta'.
declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    // New variables for the standalone bot
    readonly VITE_DISCORD_BOT_URL: string;
    // FIX: This key is still needed for server-side processes (Vite proxy, Vercel functions)
    // but it will not be exposed to the client bundle.
    readonly VITE_DISCORD_BOT_API_KEY: string;
    // New variable for hCaptcha integration
    readonly VITE_HCAPTCHA_SITE_KEY: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// src/env.ts
// This file is the single source of truth for environment variables.
export const env = {
  /**
   * Supabase Project URL.
   */
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,

  /**
   * Supabase Anon Key (public).
   */
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  
  /**
   * The public URL where your Discord Bot API is hosted.
   * This is used by the local dev server proxy.
   */
  VITE_DISCORD_BOT_URL: import.meta.env.VITE_DISCORD_BOT_URL,

  /**
   * The public site key for hCaptcha.
   */
  VITE_HCAPTCHA_SITE_KEY: import.meta.env.VITE_HCAPTCHA_SITE_KEY,

  /**
   * The secret API key to communicate with the bot.
   * REMOVED: This is now a server-side only variable and must not be exposed to the client.
   * It's used by the /api/proxy function on Vercel and the vite.config.ts proxy.
   */
  // VITE_DISCORD_BOT_API_KEY: import.meta.env.VITE_DISCORD_BOT_API_KEY,
};