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
    const botResponse = await fetch(`${BOT_URL}/api/roles`, {
      headers: { 'Authorization': `Bearer ${BOT_API_KEY}` }
    });

    if (!botResponse.ok) {
        const errorData = await botResponse.json().catch(() => ({error: "Unknown error from bot API"}));
        throw new Error(`Bot API returned error (HTTP ${botResponse.status}): ${JSON.stringify(errorData)}`);
    }

    const rolesData = await botResponse.json();
    return createResponse(rolesData);

  } catch (error) {
    console.error('Error in get-guild-roles function:', error.message);
    return createResponse({ error: error.message }, 500);
  }
})
