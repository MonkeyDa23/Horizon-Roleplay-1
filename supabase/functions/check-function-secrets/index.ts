// FIX: Replaced invalid Deno types reference with a valid one for Supabase edge functions to resolve 'Deno' not found errors.
/// <reference types="https://esm.sh/@supabase/functions-js@2/src/edge-runtime.d.ts" />

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
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const maskValue = (value: string | undefined) => {
      if (!value) return null;
      if (value.length <= 12) return '********';
      return `${value.substring(0, 6)}...${value.substring(value.length - 6)}`;
    };

    const secrets = {
      DISCORD_BOT_TOKEN: {
        found: !!botToken,
        value: maskValue(botToken),
      },
      SUPABASE_URL: {
          found: !!supabaseUrl,
          value: supabaseUrl, // URL is not secret
      },
      SUPABASE_SERVICE_ROLE_KEY: {
          found: !!serviceRoleKey,
          value: maskValue(serviceRoleKey),
      }
    };

    return createResponse(secrets, 200);

  } catch (error) {
    console.error('Error in check-function-secrets:', error.message);
    return createResponse({ error: error.message }, 500);
  }
})