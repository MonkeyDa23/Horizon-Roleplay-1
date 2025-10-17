// supabase/functions/get-guild-roles/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore
const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN')
const DISCORD_API_BASE = 'https://discord.com/api/v10'
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    // Use the Service Role Key to interact with the database, bypassing RLS.
    // This is secure because this function is only callable by authenticated users,
    // and we are not using any user-provided data to query sensitive tables.
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: config, error: configError } = await supabaseAdmin.from('config').select('DISCORD_GUILD_ID').single();
    if (configError) throw new Error(`Could not fetch guild config: ${configError.message}`);
    const guildId = config.DISCORD_GUILD_ID;
    if (!guildId) throw new Error('DISCORD_GUILD_ID is not set in config table.');
    
    // 1. Check database cache first
    const { data: cachedData, error: cacheError } = await supabaseAdmin
      .from('discord_roles_cache')
      .select('roles, updated_at')
      .eq('id', 1)
      .single();

    if (cacheError && cacheError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error fetching roles from cache:', cacheError.message);
    }

    if (cachedData && cachedData.updated_at && (new Date().getTime() - new Date(cachedData.updated_at).getTime() < CACHE_TTL_MS)) {
        return createResponse(cachedData.roles);
    }
    
    // 2. If cache is stale or non-existent, fetch from Discord API
    const rolesUrl = `${DISCORD_API_BASE}/guilds/${guildId}/roles`;
    const rolesResponse = await fetch(rolesUrl, {
      headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}` },
    });

    if (!rolesResponse.ok) {
        const errorText = await rolesResponse.text();
        // If Discord is rate-limiting us, try to return the stale cache data if available
        if (rolesResponse.status === 429 && cachedData?.roles) {
            console.warn('Discord rate limited. Serving stale cache for roles.');
            return createResponse(cachedData.roles);
        }
        return createResponse({ error: `Failed to fetch roles from Discord: ${errorText}` }, rolesResponse.status);
    }

    const roles = await rolesResponse.json();
    if (!Array.isArray(roles)) {
        return createResponse({ error: 'Discord API returned an unexpected data format for roles.' }, 500);
    }
    
    // 3. Update the database cache with the fresh data
    const { error: upsertError } = await supabaseAdmin
        .from('discord_roles_cache')
        .upsert({ id: 1, roles: roles, updated_at: new Date().toISOString() });

    if (upsertError) {
        console.error('Failed to update roles cache:', upsertError.message);
    }
    
    return createResponse(roles);

  } catch (error) {
    console.error('Error in get-guild-roles function:', error.message);
    return createResponse({ error: 'An internal server error occurred.' }, 500);
  }
})