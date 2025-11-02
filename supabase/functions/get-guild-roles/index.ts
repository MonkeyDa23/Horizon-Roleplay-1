// supabase/functions/get-guild-roles/index.ts
// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    // 1. Authenticate & Authorize
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: { user } } = await createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    ).auth.getUser();

    if (!user) throw new Error("Authentication failed.");

    // Check for admin_permissions permission using the DB function
    const { data: hasPerm, error: permError } = await supabaseAdmin.rpc('has_permission', { p_user_id: user.id, p_permission_key: 'admin_permissions' });
    if (permError || !hasPerm) {
      return createResponse({ error: 'You do not have permission to view guild roles.' }, 403);
    }

    // 2. Get bot connection details from secrets
    // @ts-ignore
    const botUrl = Deno.env.get('VITE_DISCORD_BOT_URL');
    // @ts-ignore
    const apiKey = Deno.env.get('VITE_DISCORD_BOT_API_KEY');
    if (!botUrl || !apiKey) {
        throw new Error("Bot integration secrets are not configured in this function's environment.");
    }
    
    // 3. Proxy request to the bot
    const endpoint = new URL('/api/roles', botUrl);
    const botResponse = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    const botData = await botResponse.json().catch(() => ({
        error: `Bot API returned a non-JSON response (Status: ${botResponse.status}). Check bot logs.`
    }));

    // 4. Return the bot's response
    return createResponse(botData, botResponse.status);

  } catch (error) {
    console.error(`[CRITICAL] get-guild-roles: ${error.message}`);
    return createResponse({ error: `An unexpected error occurred: ${error.message}` }, 500);
  }
})