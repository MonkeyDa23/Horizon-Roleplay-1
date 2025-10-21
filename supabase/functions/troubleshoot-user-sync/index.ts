// supabase/functions/troubleshoot-user-sync/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to create a standardized JSON response
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
    const { discordId } = await req.json();
    if (!discordId || typeof discordId !== 'string' || !/^\d{17,19}$/.test(discordId)) {
        return createResponse({ error: 'A valid Discord User ID is required.' }, 400);
    }

    // These secrets must be set in the Supabase project settings
    // @ts-ignore
    const BOT_URL = Deno.env.get('VITE_DISCORD_BOT_URL');
    // @ts-ignore
    const BOT_API_KEY = Deno.env.get('VITE_DISCORD_BOT_API_KEY');
    if (!BOT_URL || !BOT_API_KEY) {
      throw new Error("Bot integration is not configured in this function's environment variables.");
    }

    // Fetch member data from our external bot
    const botResponse = await fetch(`${BOT_URL}/api/user/${discordId}`, {
        headers: { 'Authorization': `Bearer ${BOT_API_KEY}` }
    });
    
    const responseData = await botResponse.json().catch(() => ({
        error: `Bot API returned a non-JSON response (Status: ${botResponse.status}). Check bot logs.`
    }));

    // Pass the bot's response directly to the client for diagnosis
    return createResponse(responseData, botResponse.status);

  } catch (error) {
    // This catches internal function errors.
    return createResponse({ 
      error: 'The Supabase function itself failed to execute.',
      details: error.message
    }, 500);
  }
})
