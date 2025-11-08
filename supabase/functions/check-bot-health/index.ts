// FIX: Updated the type reference to a reliable CDN to resolve Deno runtime types.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { corsHeaders, discordApi } from '../shared/index.ts';

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