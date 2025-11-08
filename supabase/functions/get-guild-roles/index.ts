// FIX: Updated the type reference to a reliable CDN to resolve Deno runtime types.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { corsHeaders, discordApi } from '../shared/index.ts';

const GUILD_ID = Deno.env.get('DISCORD_GUILD_ID');

serve(async (_req) => {
  if (_req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!GUILD_ID) {
      throw new Error("DISCORD_GUILD_ID is not configured in function secrets.");
    }
    
    const roles = await discordApi.get(`/guilds/${GUILD_ID}/roles`);
    
    // Sort roles by position, highest first
    roles.sort((a, b) => b.position - a.position);

    return new Response(JSON.stringify(roles), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('get-guild-roles error:', error.message);
    return new Response(JSON.stringify({ error: `Failed to fetch roles: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})