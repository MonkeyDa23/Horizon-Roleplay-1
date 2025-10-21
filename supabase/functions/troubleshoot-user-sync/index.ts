// supabase/functions/troubleshoot-user-sync/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to create a standardized JSON response
const createJsonResponse = (data: any, status: number) => {
    return new Response(JSON.stringify({ data, status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Always return 200 from the function itself
    });
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { discordId } = await req.json();
    if (!discordId || typeof discordId !== 'string' || !/^\d{17,19}$/.test(discordId)) {
        return createJsonResponse({ error: 'A valid Discord User ID is required.' }, 400);
    }

    // @ts-ignore
    const botUrl = Deno.env.get('VITE_DISCORD_BOT_URL');
    // @ts-ignore
    const apiKey = Deno.env.get('VITE_DISCORD_BOT_API_KEY');

    if (!botUrl || !apiKey) {
      throw new Error("Bot integration is not configured in this function's environment variables.");
    }

    const botResponse = await fetch(`${botUrl}/member/${discordId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    const responseData = await botResponse.json().catch(() => ({
        error: `Bot returned a non-JSON response (Status: ${botResponse.status}). Check bot logs for critical errors.`
    }));

    // Pass the bot's status code and data through to the client for accurate diagnosis
    return createJsonResponse(responseData, botResponse.status);

  } catch (error) {
    // This catches network errors, e.g., "Connection refused".
    return createJsonResponse({ 
      error: 'Failed to connect to the bot API.',
      details: error.message
    }, 503); // Use 503 Service Unavailable for connection errors.
  }
})
