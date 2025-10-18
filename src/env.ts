/// <reference types="vite/client" />

// This file safely reads and exports environment variables for the Vite frontend.
// Vite exposes variables from .env files (for local dev) and hosting provider settings (for deployment)
// on the `import.meta.env` object. All public-facing variables must be prefixed with `VITE_`.

const getEnvVar = (key: string): string => {
  const value = import.meta.env[key];
  if (!value) {
    // This provides a clear error message during development if a variable is missing.
    const errorMessage = `FATAL: Environment variable ${key} is not set. Please create a .env file in the root directory and add the variable. See src/env.example.ts for required variables.`;
    console.error(errorMessage);
    // In a production build, this will also fail loudly.
    throw new Error(errorMessage);
  }
  return value;
};

export const env = {
  /**
   * Supabase Project URL.
   * Found in your Supabase project settings under 'API'.
   */
  VITE_SUPABASE_URL: getEnvVar('VITE_SUPABASE_URL'),

  /**
   * Supabase Anon Key (public).
   * Find this in your Supabase project settings under 'API'.
   */
  VITE_SUPABASE_ANON_KEY: getEnvVar('VITE_SUPABASE_ANON_KEY'),
  
  /**
   * The public URL where your Discord Bot API is hosted.
   * Example: 'https://my-cool-bot.wispbyte.com'
   */
  VITE_DISCORD_BOT_URL: getEnvVar('VITE_DISCORD_BOT_URL'),

  /**
   * The secret API key you created to protect your bot's API.
   * This MUST match the `API_SECRET_KEY` in your bot's environment.
   */
  VITE_DISCORD_BOT_API_KEY: getEnvVar('VITE_DISCORD_BOT_API_KEY'),
};