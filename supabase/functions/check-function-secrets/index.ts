// FIX: Add Deno types reference to resolve "Cannot find name 'Deno'" errors.
/// <reference types="https://deno.land/x/deno/cli/types/deno.d.ts" />

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
    // This is the only secret required for the bot-less architecture.
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');

    // For security, we only show a portion of the secret key.
    const maskValue = (value: string | undefined) => {
      if (!value) return null;
      if (value.length <= 12) return '********';
      return `${value.substring(0, 6)}...${value.substring(value.length - 6)}`;
    };

    const secrets = {
      DISCORD_BOT_TOKEN: {
        found: !!botToken,
        value: maskValue(botToken),
      }
    };

    return createResponse(secrets, 200);

  } catch (error) {
    console.error('Error in check-function-secrets:', error.message);
    return createResponse({ error: error.message }, 500);
  }
})