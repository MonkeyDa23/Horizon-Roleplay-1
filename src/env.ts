
// In environments where Vite's client types aren't automatically resolved,
// this manual declaration provides the necessary type information to TypeScript,
// resolving errors about 'env' not existing on 'import.meta'.
declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    // New variables for the standalone bot
    readonly VITE_DISCORD_BOT_URL: string;
    // FIX: This key is exposed to the client for use in diagnostic pages.
    readonly VITE_DISCORD_BOT_API_KEY: string;
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
   * The secret API key to communicate with the bot.
   * Exposed on the client ONLY for diagnostic pages.
   */
  VITE_DISCORD_BOT_API_KEY: import.meta.env.VITE_DISCORD_BOT_API_KEY,
};
