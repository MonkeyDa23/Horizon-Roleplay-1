// supabase/functions/check-bot-health/index.ts
// FIX: Update the Supabase function type reference to a more stable URL to resolve Deno environment type errors.
/// <reference types="https://esm.sh/@supabase/functions-js@2/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DISCORD_API_BASE = 'https://discord.com/api/v10';

async function makeDiscordRequest(endpoint: string, options: RequestInit = {}) {
  // FIX: Cast Deno to `any` to avoid type errors in non-Deno environments.
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
    // FIX: Safely parse error body and cast to access message property.
    const errorBody = await response.json().catch(() => ({ message: 'Failed to parse error body' })) as { message?: string };
    console.error(`Discord API Error on ${options.method || 'GET'} ${endpoint}: ${response.status}`, errorBody);
    const error = new Error(`Discord API Error: ${errorBody.message || response.statusText}`);
    (error as any).status = response.status;
    (error as any).response = response;
    throw error;
  }
  
  return response.status === 204 ? null : response.json();
}

const discordApi = {
  get: (endpoint: string) => makeDiscordRequest(endpoint, { method: 'GET' }),
};

serve(async (req) => {
    console.log(`[check-bot-health] Received ${req.method} request.`);

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log("[check-bot-health] Pinging Discord Gateway...");
        await discordApi.get('/gateway');
        console.log("[check-bot-health] Ping successful.");
        
        return new Response(JSON.stringify({ ok: true, message: "Successfully connected to Discord API." }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        let message = 'Failed to connect to Discord API.';
        let details = error instanceof Error ? error.message : String(error);

        if ((error as any).status === 401) {
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