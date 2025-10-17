// supabase/functions/get-guild-roles/index.ts

// Use the recommended npm specifier for Supabase functions types.
// This ensures Deno globals (like Deno.env) are correctly typed.
// FIX: Replaced @deno-types with a triple-slash directive for better tool compatibility.
/// <reference types="https://esm.sh/@supabase/functions-js@2" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// @ts-ignore - Supressing "Cannot find name 'Deno'" because this is a Deno script running in a non-Deno linter.
const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN')
const DISCORD_API_BASE = 'https://discord.com/api/v10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      return createResponse({ error: 'guildId is required' }, 400);
    }
    
    const rolesUrl = `${DISCORD_API_BASE}/guilds/${guildId}/roles`;

    const rolesResponse = await fetch(rolesUrl, {
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
      },
    });

    if (!rolesResponse.ok) {
      const errorData = await rolesResponse.json();
      console.error(`Failed to fetch roles for guild ${guildId}:`, errorData.message);
      return createResponse({ error: `Failed to fetch roles from Discord: ${errorData.message}` }, rolesResponse.status);
    }

    const roles = await rolesResponse.json();
    
    // The client expects an object with a 'roles' key
    return createResponse({ roles });

  } catch (error) {
    console.error('An unexpected error occurred:', error.message);
    return createResponse({ error: 'An internal server error occurred.' }, 500);
  }
})