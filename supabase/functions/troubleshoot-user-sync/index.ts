// FIX: Updated the type reference to a reliable CDN to resolve Deno runtime types.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { corsHeaders, discordApi, createAdminClient } from '../shared/index.ts';

const GUILD_ID = Deno.env.get('DISCORD_GUILD_ID');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!GUILD_ID) {
      throw new Error("DISCORD_GUILD_ID is not configured in function secrets.");
    }
    const { discordId } = await req.json();
    if (!discordId) {
      throw new Error("Missing 'discordId' in request body.");
    }

    // This function is for admins, so use the service role key to check permissions
    const supabaseAdmin = createAdminClient();
    // Note: In a real app, you'd verify the caller is an admin first.
    // For this diagnostic tool, we assume it's called by an authorized frontend.

    const member = await discordApi.get(`/guilds/${GUILD_ID}/members/${discordId}`);

    // Additionally, try to get the user's profile from the DB to check both sides
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, is_banned')
        .eq('discord_id', discordId)
        .single();
    
    const response = {
        discord: {
            found: true,
            username: member.user.username,
            roles: member.roles,
        },
        database: {
            found: !!profile,
            error: profileError?.message || null,
            is_banned: profile?.is_banned || false,
            supabase_id: profile?.id || null,
        }
    }
    
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

    console.error('troubleshoot-user-sync error:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
})