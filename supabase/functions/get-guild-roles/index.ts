
// supabase/functions/get-guild-roles/index.ts
// FIX: Removed version from reference path for better stability.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DISCORD_API_BASE = 'https://discord.com/api/v10';

async function makeDiscordRequest(endpoint: string, options: RequestInit = {}) {
  const BOT_TOKEN = (Deno as any).env.get('DISCORD_BOT_TOKEN');
  if (!BOT_TOKEN) {
    throw new Error("DISCORD_BOT_TOKEN is not configured in function secrets.");
  }

  const response = await fetch(`${DISCORD_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Failed to parse error body' }));
    console.error(`Discord API Error on ${options.method || 'GET'} ${endpoint}: ${response.status}`, errorBody);
    const error = new Error(`Discord API Error: ${errorBody.message || response.statusText}`);
    (error as any).status = response.status;
    (error as any).response = response;
    throw error;
  }
  
  if (response.status === 204) {
    return null;
  }
  
  return response.json();
}

const discordApi = {
  get: (endpoint: string) => makeDiscordRequest(endpoint, { method: 'GET' }),
};

serve(async (req) => {
  console.log(`[get-guild-roles] Received ${req.method} request.`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GUILD_ID = (Deno as any).env.get('DISCORD_GUILD_ID');

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
    // FIX: Cast error to Error type to safely access the message property.
    return new Response(JSON.stringify({ error: `Failed to fetch roles: ${(error as Error).message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
