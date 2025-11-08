
// supabase/functions/get-guild-roles/index.ts
// FIX: Updated Supabase Edge Function type reference to resolve Deno runtime types.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { REST } from "https://esm.sh/@discordjs/rest@2.2.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log(`[get-guild-roles] Received ${req.method} request.`);

  // Define helpers inside the handler to ensure no code runs on initialization.
  function getDiscordApi() {
    // FIX: Add type reference to resolve Deno types.
    const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
    if (!BOT_TOKEN) {
      throw new Error("DISCORD_BOT_TOKEN is not configured in function secrets.");
    }
    return new REST({ token: BOT_TOKEN, version: "10" });
  }

  // Handle CORS preflight requests. This is crucial for browser-based clients.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const discordApi = getDiscordApi();
    // FIX: Add type reference to resolve Deno types.
    const GUILD_ID = Deno.env.get('DISCORD_GUILD_ID');

    if (!GUILD_ID) {
      throw new Error("DISCORD_GUILD_ID is not configured in function secrets.");
    }
    
    console.log(`[get-guild-roles] Fetching roles for guild: ${GUILD_ID}`);
    const roles = await discordApi.get(`/guilds/${GUILD_ID}/roles`);
    
    // Sort roles by position, highest first
    (roles as any[]).sort((a, b) => b.position - a.position);
    console.log(`[get-guild-roles] Successfully fetched and sorted ${ (roles as any[]).length} roles.`);

    return new Response(JSON.stringify(roles), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[CRITICAL] get-guild-roles:', error);
    return new Response(JSON.stringify({ error: `Failed to fetch roles: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
