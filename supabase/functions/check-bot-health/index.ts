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
        // Initialize Discord API client. This is done inside the handler to ensure
        // that any errors (like missing secrets) don't break the CORS preflight check.
        const discordApi = getDiscordApi();

        // A simple request to a stable Discord endpoint to verify the token
        await discordApi.get('/gateway');
        
        return new Response(JSON.stringify({ ok: true, message: "Successfully connected to Discord API." }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        let message = 'Failed to connect to Discord API.';
        let details = error.message;

        // @ts-ignore: Check for response property on error
        if (error.response && error.response.status === 401) {
            message = 'Authentication failed (401 Unauthorized).';
            details = 'The DISCORD_BOT_TOKEN secret is likely invalid or has been reset. Please check your Supabase function secrets.';
        }
        
        console.error('check-bot-health error:', error.message);
        return new Response(JSON.stringify({ ok: false, message, details }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
})
