// supabase/functions/check-bot-health/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const createResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // These secrets must be set in the Supabase project settings
    // under Settings > Edge Functions.
    // @ts-ignore
    const BOT_URL = Deno.env.get('VITE_DISCORD_BOT_URL');
    // @ts-ignore
    const BOT_API_KEY = Deno.env.get('VITE_DISCORD_BOT_API_KEY');

    if (!BOT_URL || !BOT_API_KEY) {
        return createResponse({
            error: "Configuration Error in Supabase Secrets.",
            details: "One or more required secrets (VITE_DISCORD_BOT_URL, VITE_DISCORD_BOT_API_KEY) are missing from your Supabase project settings. Please go to Settings > Edge Functions to add them.",
        });
    }
    
    // Perform a health check against the external bot
    const endpoint = new URL('/health', BOT_URL);
    const botResponse = await fetch(endpoint); // No auth needed for this public endpoint

    if (!botResponse.ok) {
        let errorDetails = `The Supabase function tried to contact your bot at ${BOT_URL} but received an error (Status: ${botResponse.status}). Common causes: the bot is not running, a firewall is blocking the port, or the URL is incorrect.`;
        return createResponse({ 
            error: "Could not connect to the Discord Bot.",
            details: errorDetails 
        }, botResponse.status);
    }

    const botData = await botResponse.json();
    return createResponse(botData);

  } catch (error) {
    // This catches errors like DNS resolution failure, meaning the URL is likely wrong
    return createResponse({ 
      error: 'The Supabase function failed to execute. This often means the Bot URL is invalid or unreachable.',
      details: error.message
    }, 500)
  }
})