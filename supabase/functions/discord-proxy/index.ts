// supabase/functions/discord-proxy/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // This is needed to handle the OPTIONS request from the browser for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // These variables must be set in the Supabase Function's environment settings.
    // @ts-ignore
    const botUrl = Deno.env.get('VITE_DISCORD_BOT_URL');
    // @ts-ignore
    const apiKey = Deno.env.get('VITE_DISCORD_BOT_API_KEY');

    if (!botUrl || !apiKey) {
      console.error("Discord Bot integration is not configured in this function's environment variables.");
      throw new Error("Internal server configuration error.");
    }
    
    const body = await req.json();

    const botResponse = await fetch(`${botUrl}/notify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!botResponse.ok) {
        const errorData = await botResponse.json().catch(() => ({ error: 'Failed to parse bot error response' }));
        console.error(`Error from bot API (HTTP ${botResponse.status}):`, errorData.error);
        // It's crucial to still return a 200 OK to the database trigger that called this function.
        // This prevents the original database operation from failing or retrying indefinitely
        // just because a notification failed to send. The failure is logged here and in the bot itself.
        return new Response(JSON.stringify({ success: false, reason: errorData.error || 'Bot API error' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // Success
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Fatal error in discord-proxy function:', error.message)
    // Also return 200 OK here for database triggers
    return new Response(JSON.stringify({ success: false, reason: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    })
  }
})
