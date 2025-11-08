// FIX: Updated the Edge Function type reference to resolve Deno runtime types.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// Inlined shared code to support manual deployment via Supabase dashboard.
// This block is a copy of `supabase/functions/shared/index.ts`.
// --- Start of inlined shared code ---
import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { REST } from "https://esm.sh/@discordjs/rest@2.2.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getDiscordApi() {
    const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
    if (!BOT_TOKEN) {
      throw new Error("DISCORD_BOT_TOKEN is not configured in function secrets.");
    }
    return new REST({ token: BOT_TOKEN, version: "10" });
}

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase URL or Service Role Key is not configured in function secrets.');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};
// --- End of inlined shared code ---

// Main function logic
serve(async (req) => {
  // Handle CORS preflight requests. This is crucial for browser-based clients.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize clients inside the handler to prevent CORS issues on error
    const discordApi = getDiscordApi();
    const supabaseAdmin = createAdminClient();
    const GUILD_ID = Deno.env.get('DISCORD_GUILD_ID');

    if (!GUILD_ID) {
      throw new Error("DISCORD_GUILD_ID is not configured in function secrets.");
    }
    const { discordId } = await req.json();
    if (!discordId) {
      throw new Error("Missing 'discordId' in request body.");
    }

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
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    let status = 500;
    let message = error.message;

    // @ts-ignore
    if (error.response) {
      // @ts-ignore
      status = error.response.status;
      if (status === 404) {
        // @ts-ignore
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
