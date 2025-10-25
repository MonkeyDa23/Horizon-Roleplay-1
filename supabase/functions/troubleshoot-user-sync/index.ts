// supabase/functions/troubleshoot-user-sync/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to create a standardized JSON response
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
    const { discordId } = await req.json();
    if (!discordId || typeof discordId !== 'string' || !/^\d{17,19}$/.test(discordId)) {
        return createResponse({ error: 'A valid Discord User ID is required.' }, 400);
    }
    
    // Create an admin client to fetch profile data
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: profileData } = await supabaseAdmin.from('profiles').select('id, is_banned, ban_reason, ban_expires_at').eq('discord_id', discordId).maybeSingle();

    // These secrets must be set in the Supabase project settings
    // @ts-ignore
    const BOT_URL = Deno.env.get('VITE_DISCORD_BOT_URL');
    // @ts-ignore
    const BOT_API_KEY = Deno.env.get('VITE_DISCORD_BOT_API_KEY');
    if (!BOT_URL || !BOT_API_KEY) {
      throw new Error("Bot integration is not configured in this function's environment variables.");
    }

    // Fetch member data from our external bot
    const botResponse = await fetch(`${BOT_URL}/api/user/${discordId}`, {
        headers: { 'Authorization': `Bearer ${BOT_API_KEY}` }
    });
    
    const botData = await botResponse.json().catch(() => ({
        error: `Bot API returned a non-JSON response (Status: ${botResponse.status}). Check bot logs.`
    }));

    // Combine bot data with our profile data
    const finalData = {
        ...botData,
        id: profileData?.id || null, // Supabase Auth UUID
        is_banned: profileData?.is_banned || false,
        ban_reason: profileData?.ban_reason || null,
        ban_expires_at: profileData?.ban_expires_at || null
    };

    // Pass the bot's response directly to the client for diagnosis
    return createResponse(finalData, botResponse.status);

  } catch (error) {
    // This catches internal function errors.
    return createResponse({ 
      error: 'The Supabase function itself failed to execute.',
      details: error.message
    }, 500);
  }
})
