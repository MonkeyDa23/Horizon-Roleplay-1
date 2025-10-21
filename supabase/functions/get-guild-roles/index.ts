// supabase/functions/get-guild-roles/index.ts

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
    // @ts-ignore
    const botUrl = Deno.env.get('VITE_DISCORD_BOT_URL');
    // @ts-ignore
    const apiKey = Deno.env.get('VITE_DISCORD_BOT_API_KEY');

    if (!botUrl || !apiKey) {
      throw new Error("Bot integration is not configured in this function's environment variables.");
    }

    const botResponse = await fetch(`${botUrl}/roles`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!botResponse.ok) {
        const errorData = await botResponse.json().catch(() => ({error: "Unknown error from bot"}));
        throw new Error(`Bot returned error (HTTP ${botResponse.status}): ${errorData.error}`);
    }

    const rolesData = await botResponse.json();
    return createResponse(rolesData);

  } catch (error) {
    console.error('Error in get-guild-roles function:', error.message);
    return createResponse({ error: error.message }, 500);
  }
})
