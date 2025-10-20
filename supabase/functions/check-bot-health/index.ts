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
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    
    const { data: { user } } = await supabaseAdmin.auth.getUser();
    if (!user) return createResponse({ error: 'Not authenticated' }, 401);
    
    // 1. Get channel IDs from config
    const { data: config, error: configError } = await supabaseAdmin.from('config').select('SUBMISSIONS_CHANNEL_ID, AUDIT_LOG_CHANNEL_ID').single();
    if (configError) {
        throw new Error(`Could not fetch channel config from database: ${configError.message}`);
    }

    // @ts-ignore
    const botUrl = Deno.env.get('VITE_DISCORD_BOT_URL');
    // @ts-ignore
    const apiKey = Deno.env.get('VITE_DISCORD_BOT_API_KEY');

    if (!botUrl || !apiKey) {
      throw new Error("Bot integration is not configured in this function's environment variables.");
    }
    
    // 2. Build URL with query params
    const url = new URL(`${botUrl}/health`);
    if (config.SUBMISSIONS_CHANNEL_ID) {
        url.searchParams.append('submissionsChannelId', config.SUBMISSIONS_CHANNEL_ID);
    }
    if (config.AUDIT_LOG_CHANNEL_ID) {
        url.searchParams.append('auditChannelId', config.AUDIT_LOG_CHANNEL_ID);
    }

    // 3. Call bot
    const botResponse = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    const botData = await botResponse.json();
    return createResponse(botData, botResponse.status);

  } catch (error) {
    return createResponse({ 
      ok: false,
      message: 'Failed to connect to the bot API.',
      details: error.message
    }, 500)
  }
})