
// supabase/functions/troubleshoot-user-sync/index.ts
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
  console.log(`[troubleshoot-user-sync] Received ${req.method} request.`);

  // Define helpers inside the handler to ensure no code runs on initialization.
  function getDiscordApi() {
    // FIX: Add type reference to resolve Deno types.
    const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
    if (!BOT_TOKEN) throw new Error("DISCORD_BOT_TOKEN is not configured in function secrets.");
    return new REST({ token: BOT_TOKEN, version: "10" });
  }

  const createAdminClient = () => {
    // FIX: Add type reference to resolve Deno types.
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase URL or Service Role Key is not configured in function secrets.');
    return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { discordId } = await req.json();
    if (!discordId) throw new Error("Missing 'discordId' in request body.");
    console.log(`[troubleshoot-user-sync] Processing request for Discord ID: ${discordId}`);

    const discordApi = getDiscordApi();
    const supabaseAdmin = createAdminClient();
    // FIX: Add type reference to resolve Deno types.
    const GUILD_ID = Deno.env.get('DISCORD_GUILD_ID');
    if (!GUILD_ID) throw new Error("DISCORD_GUILD_ID is not configured in function secrets.");

    console.log(`[troubleshoot-user-sync] Fetching member from Discord...`);
    const member = await discordApi.get(`/guilds/${GUILD_ID}/members/${discordId}`);
    console.log(`[troubleshoot-user-sync] Successfully fetched member from Discord.`);

    console.log(`[troubleshoot-user-sync] Fetching profile from database...`);
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles').select('id, is_banned').eq('discord_id', discordId).single();
    if(profileError && profileError.code !== 'PGRST116') {
        console.warn(`[troubleshoot-user-sync] DB profile lookup warning: ${profileError.message}`);
    } else {
        console.log(`[troubleshoot-user-sync] DB profile lookup complete. Found: ${!!profile}`);
    }
    
    const response = {
        discord: {
            found: true,
            username: (member as any).user.username,
            roles: (member as any).roles,
        },
        database: {
            found: !!profile,
            error: profileError?.message || null,
            is_banned: profile?.is_banned || false,
            supabase_id: profile?.id || null,
        }
    }
    
    console.log(`[troubleshoot-user-sync] Test complete. Returning results.`);
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    let status = 500;
    let message = error.message;

    if (error.response) {
      status = error.response.status;
      if (status === 404) {
        message = `User with ID ${error.config.url.split('/').pop()} was not found in the guild. This means the connection to Discord is working, but the user is not a member.`;
      } else if (status === 403) {
        message = 'Discord API returned Forbidden (403). The most common cause is that the "Server Members Intent" is not enabled in the Discord Developer Portal for your bot.';
      }
    }

    console.error('[CRITICAL] troubleshoot-user-sync:', error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
})
