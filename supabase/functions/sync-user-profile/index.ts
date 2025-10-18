// supabase/functions/sync-user-profile/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DISCORD_API_BASE = 'https://discord.com/api/v10'
// Cache is now shorter to allow for more frequent role updates if needed.
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
      // Check if the request has a body and handle potential errors.
      if (req.headers.get("content-type")?.includes("application/json")) {
        const body = await req.json();
        if (body && body.force === true) {
          force = true;
        }
      }
    } catch (e) {
      // This is expected if no body is sent (e.g., from background session validation).
      // We can safely ignore the error and proceed without forcing a refresh.
    }

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
      .single();

    if (!profile) {
      throw new Error(`Profile not found for user ${userId}. A profile should be created automatically on signup.`);
    }

    let discordUserId = profile.discord_id;
    
    if (!discordUserId) {
        const providerId = userMetadata?.provider_id;
        if (providerId) {
            console.log(`Profile for user ${userId} is missing discord_id. Attempting to self-heal with provider_id from JWT.`);
            const { error: updateError } = await supabaseAdmin
              .from('profiles')
              .update({ discord_id: providerId })
              .eq('id', userId);
            
            if (updateError) {
                throw new Error(`Failed to self-heal discord_id for user ${userId}: ${updateError.message}`);
            }
            discordUserId = providerId;
        } else {
            throw new Error(`Discord ID not found in profile or JWT for user ${userId}. This may indicate an issue with the initial signup process.`);
        }
    }
    
    if (!force && profile.last_synced_at && (new Date().getTime() - new Date(profile.last_synced_at).getTime() < CACHE_TTL_MS)) {
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
        discordId: discordUserId,
        username: userMetadata.full_name,
        avatar: userMetadata.avatar_url,
        roles: profile.roles || [],
        highestRole: profile.highest_role || null,
        permissions: Array.from(finalPermissions),
      };
      return createResponse({ user: cachedUser, syncError: null });
    }
    
    let syncError: string | null = null;
    let finalUsername = userMetadata.full_name || 'New User';
    let finalAvatar = userMetadata.avatar_url;
    let finalRoles: any[] = profile.roles || []; 
    let finalHighestRole: any | null = profile.highest_role || null;
    let memberRoleIds: string[] = (profile.roles || []).map((r: any) => r.id);

    try {
      // @ts-ignore
      const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
      if (!botToken) throw new Error('DISCORD_BOT_TOKEN is not configured.');

      const { data: config } = await supabaseAdmin.from('config').select('DISCORD_GUILD_ID').single();
      if (!config?.DISCORD_GUILD_ID) throw new Error('DISCORD_GUILD_ID is not configured in DB.');
      
      const memberUrl = `${DISCORD_API_BASE}/guilds/${config.DISCORD_GUILD_ID}/members/${discordUserId}`;
      const memberResponse = await fetch(memberUrl, { headers: { 'Authorization': `Bot ${botToken}` } });

      if (!memberResponse.ok) {
        if (memberResponse.status === 404) throw new Error("User not found in Discord guild. Session invalid.");
        throw new Error(`Failed to fetch Discord member data (HTTP ${memberResponse.status}).`);
      }
      
      const memberData = await memberResponse.json();
      const freshMemberRoleIds = memberData.roles || [];
      const discordUser = memberData?.user;
      
      finalUsername = memberData.nick || discordUser?.global_name || discordUser?.username || finalUsername;
      if (memberData.avatar) {
          finalAvatar = `https://cdn.discordapp.com/guilds/${config.DISCORD_GUILD_ID}/users/${discordUserId}/avatars/${memberData.avatar}.png`;
      } else if (discordUser?.avatar) {
          finalAvatar = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      }

      const { data: allGuildRoles, error: rolesError } = await supabaseAdmin.functions.invoke('get-guild-roles', {
        headers: {
          'Authorization': req.headers.get('Authorization')!,
        },
      });

      if (rolesError) {
        throw new Error("Could not fetch guild roles to determine user roles.");
      } 
      
      if (Array.isArray(allGuildRoles)) {
        const userRolesDetails = allGuildRoles
          .filter(role => freshMemberRoleIds.includes(role.id))
          .sort((a, b) => b.position - a.position);
        
        finalRoles = userRolesDetails;
        finalHighestRole = userRolesDetails.length > 0 ? userRolesDetails[0] : null;
        memberRoleIds = freshMemberRoleIds;
      }

    } catch (e) {
      syncError = `Could not sync with Discord: ${e.message}. Displaying last known data.`;
      console.warn(`Sync error for user ${userId}:`, e.message);
    }
    
    // --- Automatic Permission Bootstrap Logic ---
    const { count: permissionCount, error: countError } = await supabaseAdmin
      .from('role_permissions')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error(`Error checking permissions table count: ${countError.message}`);
    } else if (permissionCount === 0 && finalHighestRole) {
      console.log(`First run detected. Granting Super Admin to role: ${finalHighestRole.name} (${finalHighestRole.id})`);
      const { error: grantError } = await supabaseAdmin
        .from('role_permissions')
        .insert({
          role_id: finalHighestRole.id,
          permissions: ['_super_admin']
        });
      
      if (grantError) {
        syncError = `Failed to bootstrap initial admin role: ${grantError.message}`;
        console.error(syncError);
      } else {
        syncError = `Initial setup complete. The '${finalHighestRole.name}' role has been granted Super Admin permissions.`;
      }
    }
    // --- End of Bootstrap Logic ---

    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { 
        ...userMetadata, 
        full_name: finalUsername, 
        avatar_url: finalAvatar,
        roles: memberRoleIds 
      }
    });
    
    const { error: upsertError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      discord_id: discordUserId,
      roles: finalRoles,
      highest_role: finalHighestRole,
      last_synced_at: new Date().toISOString()
    });
    if (upsertError) console.error("Error updating profile cache:", upsertError.message);

    const finalPermissions = new Set<string>();
    if (memberRoleIds && memberRoleIds.length > 0) {
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