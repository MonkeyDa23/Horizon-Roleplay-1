// FIX: Replaced invalid Deno types reference with a valid one for Supabase edge functions to resolve 'Deno' not found errors.
/// <reference types="https://esm.sh/@supabase/functions-js@2/src/edge-runtime.d.ts" />

// supabase/functions/troubleshoot-user-sync/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

const discordApi = async (endpoint: string) => {
  const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!DISCORD_BOT_TOKEN) throw new Error("Bot token is not configured.");

  const url = `https://discord.com/api/v10${endpoint}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
  });
  
  // Return the raw response so the caller can handle status codes
  return response;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { discordId } = await req.json();
    if (!discordId || typeof discordId !== 'string' || !/^\d{17,19}$/.test(discordId)) {
        return createResponse({ error: 'A valid Discord User ID is required.' }, 400);
    }
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Fetch DB data and Discord data concurrently
    const [profileResult, configResult] = await Promise.all([
        supabaseAdmin.from('profiles').select('id, is_banned, ban_reason, ban_expires_at').eq('discord_id', discordId).maybeSingle(),
        supabaseAdmin.from('config').select('DISCORD_GUILD_ID').single()
    ]);
    
    const { data: profileData } = profileResult;
    const { data: config, error: configError } = configResult;
    if (configError || !config?.DISCORD_GUILD_ID) {
      throw new Error("DISCORD_GUILD_ID is not configured in the database.");
    }
    
    // Fetch member data directly from Discord
    const discordResponse = await discordApi(`/guilds/${config.DISCORD_GUILD_ID}/members/${discordId}`);
    const discordData = await discordResponse.json();

    if (!discordResponse.ok) {
        // Pass Discord's error through
        return createResponse(discordData, discordResponse.status);
    }

    const finalData = {
        username: discordData.user.global_name || discordData.user.username,
        avatar: discordData.avatar 
                ? `https://cdn.discordapp.com/guilds/${config.DISCORD_GUILD_ID}/users/${discordId}/avatars/${discordData.avatar}.png`
                : `https://cdn.discordapp.com/avatars/${discordId}/${discordData.user.avatar}.png`,
        roles: discordData.roles, // Just IDs for this test
        is_banned: profileData?.is_banned || false,
        ban_reason: profileData?.ban_reason || null,
        ban_expires_at: profileData?.ban_expires_at || null
    };

    return createResponse(finalData, 200);

  } catch (error) {
    return createResponse({ 
      error: 'The Supabase function itself failed to execute.',
      details: error.message
    }, 500);
  }
})