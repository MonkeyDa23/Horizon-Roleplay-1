// =================================================================================
//  ✅ Vixel Environment Configuration
// =================================================================================
//
//  Step 1: Create a copy of this file in the same folder (src/).
//  Step 2: Rename the copy to `env.ts`.
//  Step 3: Fill in your actual secret values in the `env.ts` file.
//
//  NOTE: The `env.ts` file is already listed in .gitignore to prevent you from
//  accidentally committing your secrets.
//
// =================================================================================

export const env = {
  /**
   * Supabase Project URL.
   * Find this in your Supabase project settings under 'API'.
   */
  VITE_SUPABASE_URL: 'YOUR_SUPABASE_URL',

  /**
   * Supabase Anon Key (public).
   * Find this in your Supabase project settings under 'API'.
   */
  VITE_SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',
  
  /**
   * The public URL where your Discord Bot API is hosted.
   * Example: 'https://my-cool-bot.wispbyte.com'
   */
  VITE_DISCORD_BOT_URL: 'YOUR_DISCORD_BOT_API_URL',

  /**
   * The secret API key you created to protect your bot's API.
   * This MUST match the `API_SECRET_KEY` in your bot's `env.ts` file.
   */
  VITE_DISCORD_BOT_API_KEY: 'YOUR_SECRET_API_KEY',
};