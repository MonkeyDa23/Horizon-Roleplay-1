// supabase/functions/troubleshoot-user-sync/index.ts
// FIX: Updated the Supabase function type reference to a valid path.
/// <reference types="https://esm.sh/@supabase/functions-js" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js';
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
  console.log(`[troubleshoot-user-sync] Received ${req.method} request.`);

  const createAdminClient = () => {
    const supabaseUrl = (Deno as any).env.get('SUPABASE_URL');
    const serviceRoleKey = (Deno as any).env.get('SUPABASE_SERVICE_ROLE_KEY');
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

    const supabaseAdmin = createAdminClient();
    const GUILD_ID = (Deno as any).env.get('DISCORD_GUILD_ID');
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
    // FIX: Improved error handling to safely access the message property from an unknown type.
    let message = error instanceof Error ? error.message : String(error);

    if ((error as any).status) {
      status = (error as any).status;
      if (status === 404) {
        message = `User with ID ${req.url.split('/').pop()} was not found in the guild. This means the connection to Discord is working, but the user is not a member.`;
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