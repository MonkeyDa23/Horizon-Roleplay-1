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
const GUILD_ID = Deno.env.get('DISCORD_GUILD_ID');

serve(async (req) => {
  // Handle CORS preflight requests. This is crucial for browser-based clients.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize clients inside the handler to prevent CORS issues on error
    const discordApi = getDiscordApi();

    if (!GUILD_ID) {
      throw new Error("DISCORD_GUILD_ID is not configured in function secrets.");
    }
    
    const roles = await discordApi.get(`/guilds/${GUILD_ID}/roles`);
    
    // Sort roles by position, highest first
    (roles as any[]).sort((a, b) => b.position - a.position);

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
