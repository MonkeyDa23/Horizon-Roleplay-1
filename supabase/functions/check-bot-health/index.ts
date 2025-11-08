
// supabase/functions/check-bot-health/index.ts
// FIX: Updated Supabase Edge Function type reference to resolve Deno runtime types.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { REST } from "https://esm.sh/@discordjs/rest@2.2.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    console.log(`[check-bot-health] Received ${req.method} request.`);
    
    // Define helper inside the handler to ensure no code runs on initialization.
    function getDiscordApi() {
        // FIX: Add type reference to resolve Deno types.
        const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
        if (!BOT_TOKEN) {
          throw new Error("DISCORD_BOT_TOKEN is not configured in function secrets.");
        }
        return new REST({ token: BOT_TOKEN, version: "10" });
    }

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log("[check-bot-health] Initializing Discord API client...");
        const discordApi = getDiscordApi();

        console.log("[check-bot-health] Pinging Discord Gateway...");
        await discordApi.get('/gateway');
        console.log("[check-bot-health] Ping successful.");
        
        return new Response(JSON.stringify({ ok: true, message: "Successfully connected to Discord API." }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        let message = 'Failed to connect to Discord API.';
        let details = error.message;

        if (error.response && error.response.status === 401) {
            message = 'Authentication failed (401 Unauthorized).';
            details = 'The DISCORD_BOT_TOKEN secret is likely invalid or has been reset. Please check your Supabase function secrets.';
        }
        
        console.error('[CRITICAL] check-bot-health:', error);
        return new Response(JSON.stringify({ ok: false, message, details }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
})
