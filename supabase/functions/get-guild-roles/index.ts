// supabase/functions/get-guild-roles/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore
const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN')
const DISCORD_API_BASE = 'https://discord.com/api/v10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CacheEntry {
  timestamp: number;
  roles: any[];
}
const rolesCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const createResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  if (!DISCORD_BOT_TOKEN) {
    return createResponse({ error: 'Bot token not configured on server.' }, 500);
  }

  try {
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: config, error: configError } = await supabaseClient.from('config').select('DISCORD_GUILD_ID').single();
    if (configError) throw new Error(`Could not fetch guild config: ${configError.message}`);
    const guildId = config.DISCORD_GUILD_ID;
    if (!guildId) throw new Error('DISCORD_GUILD_ID is not set in config table.');
    
    const cachedEntry = rolesCache.get(guildId);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS)) {
        return createResponse(cachedEntry.roles);
    }

    const rolesUrl = `${DISCORD_API_BASE}/guilds/${guildId}/roles`;
    const rolesResponse = await fetch(rolesUrl, {
      headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}` },
    });

    if (!rolesResponse.ok) {
        const errorText = await rolesResponse.text();
        return createResponse({ error: `Failed to fetch roles from Discord: ${errorText}` }, rolesResponse.status);
    }

    const roles = await rolesResponse.json();
    if (!Array.isArray(roles)) {
        return createResponse({ error: 'Discord API returned an unexpected data format for roles.' }, 500);
    }
    
    rolesCache.set(guildId, { timestamp: Date.now(), roles });
    
    return createResponse(roles);

  } catch (error) {
    console.error('Error in get-guild-roles function:', error.message);
    return createResponse({ error: 'An internal server error occurred.' }, 500);
  }
})