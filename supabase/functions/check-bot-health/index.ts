// supabase/functions/check-bot-health/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
     const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return createResponse({ ok: false, message: 'Not authenticated' }, 401);
    }
    
    // @ts-ignore
    const botUrl = Deno.env.get('VITE_DISCORD_BOT_URL');
    // @ts-ignore
    const apiKey = Deno.env.get('VITE_DISCORD_BOT_API_KEY');

    if (!botUrl || !apiKey) {
      throw new Error("Bot integration is not configured in this function's environment variables.");
    }
    
    // Fetch the bot's own health check endpoint
    const botResponse = await fetch(`${botUrl}/bot-status`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const responseData = await botResponse.json().catch(() => ({ 
        ok: false,
        message: `Bot returned a non-JSON response (Status: ${botResponse.status}). Check bot logs for critical errors.`,
        details: null,
    }));

    return createResponse(responseData, 200);

  } catch (error) {
    // This catches network errors, e.g., "Connection refused".
    return createResponse({ 
      ok: false,
      message: 'Failed to connect to the bot API.',
      details: error.message
    }, 200)
  }
})
