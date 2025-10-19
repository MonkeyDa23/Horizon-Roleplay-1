// FIX: Add a triple-slash directive to include Vite's client types, which are necessary for `import.meta.env`.
/// <reference types="vite/client" />

// In environments where the Vite client types aren't automatically resolved,
// this manual declaration provides the necessary type information to TypeScript,
// resolving errors about 'env' not existing on 'import.meta'.
// FIX: Encapsulate interface declarations in `declare global` to correctly augment the global ImportMeta type.
declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_DISCORD_BOT_URL: string;
    readonly VITE_DISCORD_BOT_API_KEY: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// src/env.ts
// This file is the single source of truth for environment variables.
// It normalizes access to them, whether they come from a local .env file
// (loaded by Vite) or from the production environment (e.g., Vercel).
// This file itself is NOT secret and is safe to commit.

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
   */
  VITE_DISCORD_BOT_URL: import.meta.env.VITE_DISCORD_BOT_URL,

  /**
   * The secret API key you created to protect your bot's API.
   */
  VITE_DISCORD_BOT_API_KEY: import.meta.env.VITE_DISCORD_BOT_API_KEY,
};
