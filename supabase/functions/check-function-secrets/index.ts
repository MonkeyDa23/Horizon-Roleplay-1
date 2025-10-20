
// supabase/functions/check-function-secrets/index.ts

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
    // These variables must be set as secrets in the Supabase project settings
    // under Settings > Edge Functions.
    // @ts-ignore
    const botUrl = Deno.env.get('VITE_DISCORD_BOT_URL');
    // @ts-ignore
    const apiKey = Deno.env.get('VITE_DISCORD_BOT_API_KEY');

    // For security, we only show a portion of the secret key.
    const maskValue = (value: string | undefined) => {
      if (!value) return null;
      if (value.length <= 8) return '****';
      return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
    };

    const secrets = {
      VITE_DISCORD_BOT_URL: {
        found: !!botUrl,
        value: botUrl || null, // Show the full URL as it's not a secret
      },
      VITE_DISCORD_BOT_API_KEY: {
        found: !!apiKey,
        value: maskValue(apiKey), // Mask the key
      },
    };

    return createResponse(secrets, 200);

  } catch (error) {
    console.error('Error in check-function-secrets:', error.message);
    return createResponse({ error: error.message }, 500);
  }
})
