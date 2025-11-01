// supabase/functions/discord-proxy/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

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
    // 1. Authenticate the request from the database trigger
    // @ts-ignore
    const proxySecret = Deno.env.get('DISCORD_PROXY_SECRET');
    if (!proxySecret) {
        console.error("[FATAL] DISCORD_PROXY_SECRET is not set in function secrets.");
        return createResponse({ error: "Proxy authentication is not configured." }, 500);
    }
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${proxySecret}`) {
        console.warn(`[AUTH_FAIL] Unauthorized request to discord-proxy from IP: ${req.headers.get('x-forwarded-for')}`);
        return createResponse({ error: 'Unauthorized.' }, 401);
    }
    
    // 2. Get bot connection details from secrets
    // @ts-ignore
    const botUrl = Deno.env.get('VITE_DISCORD_BOT_URL');
    // @ts-ignore
    const apiKey = Deno.env.get('VITE_DISCORD_BOT_API_KEY');
    if (!botUrl || !apiKey) {
        console.error("[FATAL] VITE_DISCORD_BOT_URL or VITE_DISCORD_BOT_API_KEY is not configured in secrets.");
        throw new Error("Bot integration secrets are not configured.");
    }

    // 3. Forward the exact payload to the bot's /api/notify endpoint
    const body = await req.json();
    const endpoint = new URL('/api/notify', botUrl);

    console.log(`[INFO] Forwarding notification of type '${body.type}' to bot.`);

    const botResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}` 
        },
        body: JSON.stringify(body)
    });

    // 4. Return the bot's response back to the database function
    const botResponseBody = await botResponse.json().catch(() => ({}));
    if (!botResponse.ok) {
        console.error(`[ERROR] Bot API responded with status ${botResponse.status}:`, botResponseBody);
    } else {
        console.log(`[SUCCESS] Bot responded with status ${botResponse.status}.`);
    }

    return createResponse(botResponseBody, botResponse.status);

  } catch (error) {
    console.error('[FATAL] An unhandled error occurred in the discord-proxy function:', error.message);
    return createResponse({ error: error.message }, 500);
  }
})
