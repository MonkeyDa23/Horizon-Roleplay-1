// supabase/functions/shared/index.ts
// This file consolidates all shared utilities for Supabase Edge Functions.
// FIX: Updated the Edge Function type reference to resolve Deno runtime types.
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { REST } from "https://esm.sh/@discordjs/rest@2.2.0";

// --- CORS Headers ---
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Discord API Client ---
// This is now a function to defer the environment variable check until it's called.
// This prevents top-level errors that break CORS preflight requests.
export function getDiscordApi() {
    const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
    if (!BOT_TOKEN) {
      throw new Error("DISCORD_BOT_TOKEN is not configured in function secrets.");
    }
    return new REST({ token: BOT_TOKEN, version: "10" });
}

// --- Supabase Admin Client ---
export const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase URL or Service Role Key is not configured in function secrets.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};
