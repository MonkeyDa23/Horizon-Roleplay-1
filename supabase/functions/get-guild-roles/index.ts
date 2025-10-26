// supabase/functions/get-guild-roles/index.ts

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
    // These secrets must be set in the Supabase project settings
    // @ts-ignore
    const BOT_URL = Deno.env.get('VITE_DISCORD_BOT_URL');
    // @ts-ignore
    const BOT_API_KEY = Deno.env.get('VITE_DISCORD_BOT_API_KEY');

    if (!BOT_URL || !BOT_API_KEY) {
      throw new Error("Bot integration is not configured in this function's environment variables.");
    }
    
    // Authenticate the user calling this function
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) return createResponse({ error: 'Unauthorized' }, 401)
    
    // Fetch roles from the external bot
    const endpoint = new URL('/api/roles', BOT_URL);
    const botResponse = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${BOT_API_KEY}` }
    });

    const responseText = await botResponse.text();

    if (!botResponse.ok) {
        const errorMessage = `Bot API returned error (HTTP ${botResponse.status}): ${responseText}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    try {
        const rolesData = JSON.parse(responseText);
        return createResponse(rolesData);
    } catch(e) {
        const errorMessage = `Bot API returned a non-JSON response. Body: ${responseText}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

  } catch (error) {
    console.error('Error in get-guild-roles function:', error.message);
    return createResponse({ error: error.message }, 500);
  }
})