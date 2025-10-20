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
    } catch (e) {
      // Ignore errors from parsing an empty body.
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
      .maybeSingle(); // Use maybeSingle() to prevent error if profile doesn't exist yet

    // If cache is valid, construct user object and return early
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

    // --- Start Full Sync with Discord ---
    let discordUserId = profile?.discord_id || userMetadata?.provider_id;
    if (!discordUserId) {
      throw new Error(`Could not determine Discord ID for user ${userId}. Critical signup failure.`);
    }

    let syncError: string | null = null;
    let finalUsername = userMetadata.full_name || 'New User';
    let finalAvatar = userMetadata.avatar_url;
    let finalRoles: any[] = profile?.roles || []; 
    let finalHighestRole: any | null = profile?.highest_role || null;
    let memberRoleIds: string[] = (profile?.roles || []).map((r: any) => r.id);

    try {
      // @ts-ignore
      const botUrl = Deno.env.get('VITE_DISCORD_BOT_URL');
      // @ts-ignore
      const apiKey = Deno.env.get('VITE_DISCORD_BOT_API_KEY');

      if (!botUrl || !apiKey) {
        throw new Error("VITE_DISCORD_BOT_URL or VITE_DISCORD_BOT_API_KEY is not configured in the Supabase Function's environment variables. Please set them in your project settings.");
      }
      
      const authHeader = { 'Authorization': `Bearer ${apiKey}` };
      const { data: config } = await supabaseAdmin.from('config').select('DISCORD_GUILD_ID').single();
      if (!config?.DISCORD_GUILD_ID) throw new Error('DISCORD_GUILD_ID is not configured in DB.');

      // --- Fetch member and role data concurrently from the bot API ---
      const [memberResult, rolesResult] = await Promise.all([
        fetch(`${botUrl}/member/${discordUserId}`, { headers: authHeader }),
        fetch(`${botUrl}/roles`, { headers: authHeader })
      ]);

      if (!memberResult.ok) {
        if (memberResult.status === 404) throw new Error("User not found in Discord guild. This often means the 'Server Members Intent' is disabled for your bot, or the DISCORD_GUILD_ID is wrong. Use the Health Check page to diagnose.");
        const errorBody = await memberResult.text();
        throw new Error(`Failed to fetch Discord member data from bot (HTTP ${memberResult.status}): ${errorBody}`);
      }
      const memberData = await memberResult.json();

      if (!rolesResult.ok) {
          const errorBody = await rolesResult.text();
          throw new Error(`Failed to fetch roles from bot API (HTTP ${rolesResult.status}): ${errorBody}`);
      }
      const allGuildRoles = await rolesResult.json();
      if (!Array.isArray(allGuildRoles)) {
        throw new Error("Could not determine user roles: Bot API returned invalid format for roles.");
      }
      // --- End data fetching ---

      const freshMemberRoleIds = memberData.roles || [];
      
      finalUsername = memberData.nick || memberData.global_name || memberData.username || finalUsername;
      
      if (memberData.guild_avatar) {
          finalAvatar = `https://cdn.discordapp.com/guilds/${config.DISCORD_GUILD_ID}/users/${discordUserId}/avatars/${memberData.guild_avatar}.png`;
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
      syncError = `Could not sync with Discord: ${e.message}. Displaying last known data.`;
      console.warn(`Sync error for user ${userId}:`, e.message);
    }
    
    // --- Automatic Permission Bootstrap Logic ---
    const { count: permissionCount, error: countError } = await supabaseAdmin.from('role_permissions').select('*', { count: 'exact', head: true });
    if (countError) {
      console.error(`Error checking permissions table count: ${countError.message}`);
    } else if (permissionCount === 0 && finalHighestRole?.id) {
      console.log(`First run detected. Granting Super Admin to role: ${finalHighestRole.name} (${finalHighestRole.id})`);
      const { error: grantError } = await supabaseAdmin.from('role_permissions').insert({ role_id: finalHighestRole.id, permissions: ['_super_admin'] });
      if (grantError) {
        syncError = (syncError ? syncError + "\n" : "") + `Failed to bootstrap initial admin role: ${grantError.message}`;
      } else {
        syncError = `Initial setup complete. The '${finalHighestRole.name}' role has been granted Super Admin permissions.`;
      }
    }
    
    // --- Update Auth User and Profile ---
    const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { ...userMetadata, full_name: finalUsername, avatar_url: finalAvatar, roles: memberRoleIds } });
    if (updateUserError) {
      throw new Error(`Failed to update auth user metadata: ${updateUserError.message}`);
    }
    
    const { error: upsertError } = await supabaseAdmin.from('profiles').upsert({ id: userId, discord_id: discordUserId, roles: finalRoles, highest_role: finalHighestRole, last_synced_at: new Date().toISOString() });
    if (upsertError) {
      console.error("Error updating profile cache:", upsertError.message);
    }

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