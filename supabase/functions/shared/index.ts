// supabase/functions/shared/index.ts
// This file consolidates all shared utilities for Supabase Edge Functions.
// FIX: Updated the type reference to a reliable CDN to resolve Deno runtime types.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { REST } from "https://deno.land/x/discord_rest@v0.1.0/mod.ts";

// --- CORS Headers ---
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Discord API Client ---
const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
if (!BOT_TOKEN) {
  throw new Error("DISCORD_BOT_TOKEN is not configured in function secrets.");
}
export const discordApi = new REST({
  token: BOT_TOKEN,
  version: "10",
});

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