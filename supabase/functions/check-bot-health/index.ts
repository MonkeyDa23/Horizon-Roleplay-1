
// FIX: Updated the Edge Function type reference to resolve Deno runtime types.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// This file is bundled for standalone deployment.
// --- Start of inlined shared code ---
// FIX: Updated the type reference to a reliable CDN to resolve Deno runtime types.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { REST } from "https://esm.sh/@discordjs/rest@2.2.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
if (!BOT_TOKEN) {
  throw new Error("DISCORD_BOT_TOKEN is not configured in function secrets.");
}
const discordApi = new REST({
  token: BOT_TOKEN,
  version: "10",
});

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


// Original function code for check-bot-health
serve(async (_req) => {
    if (_req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // A simple request to a stable Discord endpoint to verify the token
        await discordApi.get('/gateway');
        
        return new Response(JSON.stringify({ ok: true, message: "Successfully connected to Discord API." }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        let message = 'Failed to connect to Discord API.';
        let details = error.message;

        if (error.response && (error.response as any).status === 401) {
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
