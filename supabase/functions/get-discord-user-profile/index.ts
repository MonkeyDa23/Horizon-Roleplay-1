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
    
    // 2. Fetch all guild roles
    const rolesResponse = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, {
        headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}` },
    });
    if (!rolesResponse.ok) throw new Error('Failed to fetch guild roles from Discord.');
    const allGuildRoles = await rolesResponse.json();

    // 3. Fetch specific guild member
    const memberResponse = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`, {
        headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}` },
    });
    if (!memberResponse.ok) {
        if (memberResponse.status === 404) return createResponse({ error: 'User not found in this Discord server.'}, 404);
        throw new Error('Failed to fetch guild member from Discord.');
    }
    const memberData = await memberResponse.json();
    
    // 4. Fetch role permissions from our DB (Gracefully handle if table doesn't exist)
    const userRoleIds: string[] = memberData.roles || [];
    let permsData: { permissions: string[] }[] | null = null;
    if (userRoleIds.length > 0) {
      const { data, error: permsError } = await supabaseClient
        .from('role_permissions')
        .select('permissions')
        .in('role_id', userRoleIds);
      
      if (permsError) {
        if (permsError.code === '42P01') { // table does not exist
          console.warn('Warning: role_permissions table not found in get-discord-user-profile function.');
        } else {
          throw new Error(`Failed to fetch role permissions: ${permsError.message}`);
        }
      } else {
        permsData = data;
      }
    }
    
    // 5. Calculate final permissions set
    const permissions = new Set<string>();
    if(permsData) {
      for (const rolePerms of permsData) {
        if (Array.isArray(rolePerms.permissions)) {
          rolePerms.permissions.forEach(p => permissions.add(p));
        }
      }
    }
     // If user has any permissions, grant them base admin access
    if (permissions.size > 0) {
        permissions.add('submissions');
        permissions.add('lookup');
    }
    
    // 6. Fetch user's submission history
    const { data: submissions, error: subsError } = await supabaseClient
      .from('submissions')
      .select('*')
      .eq('user_id', memberData.user.id)
      .order('submittedAt', { ascending: false });
    if (subsError) throw new Error(`Failed to fetch submissions: ${subsError.message}`);

    // 7. Combine all data for the final response
    const discordRoles = allGuildRoles
      .filter((role: any) => userRoleIds.includes(role.id))
      .map((role: any) => ({
        id: role.id,
        name: role.name,
        color: `#${(role.color || 0).toString(16).padStart(6, '0')}`,
        position: role.position
      }))
      .sort((a: any, b: any) => b.position - a.position);

    const result = {
      id: memberData.user.id,
      username: memberData.user.global_name || memberData.user.username,
      avatar: memberData.user.avatar 
        ? `https://cdn.discordapp.com/avatars/${memberData.user.id}/${memberData.user.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(memberData.user.discriminator || '0') % 5}.png`,
      permissions: Array.from(permissions),
      discordRoles: discordRoles,
      joinedAt: memberData.joined_at,
      submissions: submissions || [],
    };

    return createResponse(result);

  } catch (error) {
    console.error('Error in get-discord-user-profile function:', error.message);
    return createResponse({ error: error.message }, 500);
  }
})