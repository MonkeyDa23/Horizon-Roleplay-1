// supabase/functions/get-discord-user-profile/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore
const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN')
const DISCORD_API_BASE = 'https://discord.com/api/v10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to create a response
const createResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

serve(async (req) => {
  // This is needed to handle the OPTIONS request from the browser for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!DISCORD_BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN is not configured.');
    
    // Create a Supabase client with the service role key to bypass RLS for this internal function.
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { userId } = await req.json();
    if (!userId) {
        return createResponse({ error: 'userId is required' }, 400);
    }
    
    // 1. Get Guild ID from config
    const { data: config, error: configError } = await supabaseClient.from('config').select('DISCORD_GUILD_ID').single();
    if (configError) throw new Error(`Could not fetch guild config: ${configError.message}`);
    const guildId = config.DISCORD_GUILD_ID;
    if (!guildId) throw new Error('DISCORD_GUILD_ID is not set in config table.');
    
    // 2. Fetch specific guild member from Discord
    const memberResponse = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`, {
        headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}` },
    });
    if (!memberResponse.ok) {
        if (memberResponse.status === 404) return createResponse({ error: 'User not found in this Discord server.'}, 404);
        throw new Error('Failed to fetch guild member from Discord.');
    }
    const memberData = await memberResponse.json();
    
    // 3. Fetch user's permissions from our `profiles` table
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('is_admin, is_super_admin')
      .eq('id', userId)
      .single();

    // If there's an error fetching the profile (e.g., user exists in auth but not profiles yet), default to false.
    const isAdmin = profile?.is_admin || false;
    const isSuperAdmin = profile?.is_super_admin || false;
      
    // 4. Fetch user's submission history
    const { data: submissions, error: subsError } = await supabaseClient
      .from('submissions')
      .select('*')
      .eq('user_id', memberData.user.id)
      .order('submittedAt', { ascending: false });
    if (subsError) throw new Error(`Failed to fetch submissions: ${subsError.message}`);

    // 5. Combine all data for the final response
    const result = {
      id: memberData.user.id,
      username: memberData.user.global_name || memberData.user.username,
      avatar: memberData.user.avatar 
        ? `https://cdn.discordapp.com/avatars/${memberData.user.id}/${memberData.user.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(memberData.user.discriminator || '0') % 5}.png`,
      isAdmin: isAdmin || isSuperAdmin,
      isSuperAdmin: isSuperAdmin,
      joinedAt: memberData.joined_at,
      submissions: submissions || [],
    };

    return createResponse(result);

  } catch (error) {
    console.error('Error in get-discord-user-profile function:', error.message);
    return createResponse({ error: error.message }, 500);
  }
})
