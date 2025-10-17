// supabase/functions/get-guild-roles/index.ts

// Use the recommended npm specifier for Supabase functions types.
// This ensures Deno globals (like Deno.env) are correctly typed.
// FIX: Reverted to @deno-types to resolve type definition error in some environments.
// @deno-types="https://esm.sh/@supabase/functions-js@2"

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// @ts-ignore - Supressing "Cannot find name 'Deno'" because this is a Deno script running in a non-Deno linter.
const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN')
const DISCORD_API_BASE = 'https://discord.com/api/v10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- In-memory cache for roles to reduce Discord API calls ---
interface CacheEntry {
  timestamp: number;
  roles: any[];
}
const rolesCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Helper to create a response
const createResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}

serve(async (req) => {
  // This is needed to handle the OPTIONS request from the browser for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  if (!DISCORD_BOT_TOKEN) {
    console.error('DISCORD_BOT_TOKEN is not set in Supabase secrets.');
    return createResponse({ error: 'Bot token not configured on server.' }, 500);
  }

  try {
    const { guildId } = await req.json();
    if (!guildId) {
        console.error('Bad Request: guildId is missing from the request body.');
        return createResponse({ error: 'guildId is required' }, 400);
    }
    
    // --- Cache Check ---
    const cachedEntry = rolesCache.get(guildId);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS)) {
        console.log(`Cache hit for guild roles: ${guildId}`);
        return createResponse(cachedEntry.roles);
    }
    console.log(`Cache miss for guild roles: ${guildId}`);


    const rolesUrl = `${DISCORD_API_BASE}/guilds/${guildId}/roles`;

    const rolesResponse = await fetch(rolesUrl, {
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
      },
    });

    if (!rolesResponse.ok) {
        const errorText = await rolesResponse.text();
        console.error(`Discord API Error: Failed to fetch roles for guild ${guildId}. Status: ${rolesResponse.status}. Body: ${errorText}`);
        // Try to parse as JSON, but fall back to text if it fails
        let errorJson;
        try {
            errorJson = JSON.parse(errorText);
        } catch {
            errorJson = { message: errorText };
        }
        return createResponse({ error: `Failed to fetch roles from Discord: ${errorJson.message || 'Unknown error'}` }, rolesResponse.status);
    }

    const roles = await rolesResponse.json();
    
    // Explicitly check if the response is an array before returning
    if (!Array.isArray(roles)) {
        console.error(`Discord API did not return an array for guild roles. Guild ID: ${guildId}. Response:`, roles);
        return createResponse({ error: 'Discord API returned an unexpected data format for roles.' }, 500);
    }

    // --- Cache Update ---
    rolesCache.set(guildId, { timestamp: Date.now(), roles });
    console.log(`Cache updated for guild roles: ${guildId}`);


    return createResponse(roles);

  } catch (error) {
    console.error('An unexpected error occurred in get-guild-roles function:', error.message);
    return createResponse({ error: 'An internal server error occurred.' }, 500);
  }
})