
// supabase/functions/sync-user-profile/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

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
    let force = false;
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        const body = await req.json();
        if (body && body.force === true) {
          force = true;
        }
      }
    } catch (e) { /* Ignore parsing errors */ }

    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();

    if (authError) {
      console.error('Supabase auth.getUser() error:', authError.message);
      return createResponse({ error: 'Authentication failed.' }, 401);
    }
    if (!authUser) {
      return createResponse({ error: 'No authenticated user found.' }, 401);
    }
    
    const userMetadata = authUser.user_metadata || {};
    const userId = authUser.id;

    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('discord_id, roles, highest_role, last_synced_at')
      .eq('id', userId)
      .maybeSingle();

    if (!force && profile?.last_synced_at && (new Date().getTime() - new Date(profile.last_synced_at).getTime() < CACHE_TTL_MS)) {
      const userRoleIds = (profile.roles || []).map((r: any) => r.id);
      const finalPermissions = new Set<string>();

      if (userRoleIds.length > 0) {
        const { data: permsData } = await supabaseAdmin.from('role_permissions').select('permissions').in('role_id', userRoleIds);
        if (permsData) {
          permsData.forEach(p => p.permissions.forEach((key: string) => finalPermissions.add(key)));
        }
      }

      const cachedUser = {
        id: userId,
        discordId: profile.discord_id,
        username: userMetadata.full_name,
        avatar: userMetadata.avatar_url,
        roles: profile.roles || [],
        highestRole: profile.highest_role || null,
        permissions: Array.from(finalPermissions),
      };
      return createResponse({ user: cachedUser, syncError: null });
    }

    // --- Start Full Sync with Bot ---
    let discordUserId = profile?.discord_id || userMetadata?.provider_id;
    if (!discordUserId) {
      throw new Error(`Could not determine Discord ID for user ${userId}. Critical signup failure.`);
    }

    // @ts-ignore
    const botUrl = Deno.env.get('VITE_DISCORD_BOT_URL');
    // @ts-ignore
    const botApiKey = Deno.env.get('VITE_DISCORD_BOT_API_KEY');
    if (!botUrl || !botApiKey) {
        throw new Error("Bot integration is not configured in this function's environment variables.");
    }

    let syncError: string | null = null;
    let finalUsername = userMetadata.full_name || 'New User';
    let finalAvatar = userMetadata.avatar_url;
    let finalRoles: any[] = profile?.roles || []; 
    let finalHighestRole: any | null = profile?.highest_role || null;
    let memberRoleIds: string[] = (profile?.roles || []).map((r: any) => r.id);

    try {
        // Step 1: Fetch member data from the bot
        const memberResponse = await fetch(`${botUrl}/member/${discordUserId}`, {
            headers: { 'Authorization': `Bearer ${botApiKey}` }
        });

        if (!memberResponse.ok) {
            const errorBody = await memberResponse.json().catch(() => ({error: "Unknown error from bot"}));
            throw new Error(`Bot returned error (HTTP ${memberResponse.status}): ${errorBody.error}`);
        }
        const memberData = await memberResponse.json();

        // Step 2: Fetch all guild roles from the bot
        const rolesResponse = await fetch(`${botUrl}/roles`, {
            headers: { 'Authorization': `Bearer ${botApiKey}` }
        });
        if (!rolesResponse.ok) {
            throw new Error(`Could not fetch guild roles from bot.`);
        }
        const allGuildRoles = await rolesResponse.json();

        // Step 3: Process and combine the data
        const freshMemberRoleIds = memberData.roles || [];
        
        finalUsername = memberData.nick || memberData.global_name || memberData.username || finalUsername;
        
        const { data: guildConfig } = await supabaseAdmin.from('config').select('DISCORD_GUILD_ID').single();
        const guildId = guildConfig?.DISCORD_GUILD_ID;

        if (memberData.guild_avatar && guildId) {
            finalAvatar = `https://cdn.discordapp.com/guilds/${guildId}/users/${discordUserId}/avatars/${memberData.guild_avatar}.png`;
        } else if (memberData.avatar) {
            finalAvatar = `https://cdn.discordapp.com/avatars/${discordUserId}/${memberData.avatar}.png`;
        }
        
        const userRolesDetails = allGuildRoles
          .filter((role: any) => freshMemberRoleIds.includes(role.id))
          .sort((a: any, b: any) => b.position - a.position);
        
        finalRoles = userRolesDetails;
        finalHighestRole = userRolesDetails.length > 0 ? userRolesDetails[0] : null;
        memberRoleIds = freshMemberRoleIds;

    } catch (e) {
      syncError = `Could not sync with Discord Bot: ${e.message}. Displaying last known data. Please check bot logs.`;
      console.warn(`Sync error for user ${userId}:`, e.message);
    }
    
    // Step 4: Bootstrap first admin if necessary
    const { count: permissionCount } = await supabaseAdmin.from('role_permissions').select('*', { count: 'exact', head: true });
    if (permissionCount === 0 && finalHighestRole?.id) {
        console.log(`First run detected. Granting Super Admin to role: ${finalHighestRole.name} (${finalHighestRole.id})`);
        const { error: grantError } = await supabaseAdmin.from('role_permissions').insert({ role_id: finalHighestRole.id, permissions: ['_super_admin'] });
        if (grantError) {
          syncError = (syncError ? syncError + "\n" : "") + `Failed to bootstrap initial admin role: ${grantError.message}`;
        } else {
          syncError = `Initial setup complete. The '${finalHighestRole.name}' role has been granted Super Admin permissions.`;
        }
    }
    
    // Step 5: Update Supabase data
    await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { ...userMetadata, full_name: finalUsername, avatar_url: finalAvatar } });
    await supabaseAdmin.from('profiles').upsert({ id: userId, discord_id: discordUserId, roles: finalRoles, highest_role: finalHighestRole, last_synced_at: new Date().toISOString() });

    // Step 6: Calculate final permissions
    const finalPermissions = new Set<string>();
    if (memberRoleIds.length > 0) {
        const { data: permsData } = await supabaseAdmin.from('role_permissions').select('permissions').in('role_id', memberRoleIds);
        if (permsData) {
          permsData.forEach(p => p.permissions.forEach((key: string) => finalPermissions.add(key)));
        }
    }

    const finalUser = {
      id: userId,
      discordId: discordUserId,
      username: finalUsername,
      avatar: finalAvatar,
      roles: finalRoles,
      highestRole: finalHighestRole,
      permissions: Array.from(finalPermissions),
    };
    return createResponse({ user: finalUser, syncError });

  } catch (error) {
    console.error(`Fatal error in sync-user-profile function: ${error.message}`);
    return createResponse({ error: error.message }, 500);
  }
})
