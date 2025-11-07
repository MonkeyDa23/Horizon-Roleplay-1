// FIX: Add Deno types reference to resolve "Cannot find name 'Deno'" errors.
/// <reference types="https://deno.land/x/deno/cli/types/deno.d.ts" />

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

// Helper to interact with Discord API
const discordApi = async (endpoint: string) => {
  const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!DISCORD_BOT_TOKEN) {
    console.error("[FATAL] DISCORD_BOT_TOKEN is not configured in secrets.");
    throw new Error("Bot token is not configured in the function's environment.");
  }

  const url = `https://discord.com/api/v10${endpoint}`;
  const response = await fetch(url, {
    headers: { "Authorization": `Bot ${DISCORD_BOT_TOKEN}` },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errorMessage = errorBody.message || "Unknown Discord API error.";
    // Provide a more helpful error message for a common issue.
    if (response.status === 403 && errorBody.code === 50001) {
       throw new Error(`Discord API Error (403): Missing Access. The bot does not have permission to view this resource. This is often caused by the 'Server Members Intent' being disabled in the Discord Developer Portal.`);
    }
    throw new Error(`Discord API Error (${response.status}): ${errorMessage}`);
  }
  return response.json();
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let authUser;
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    let force = false;
    if (req.headers.get("content-type")?.includes("application/json")) {
        const body = await req.json().catch(() => ({}));
        if (body && body.force === true) force = true;
    }
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return createResponse({ error: 'Authentication failed.' }, 401);
    }
    authUser = user;

    const { data: dbProfile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('discord_id, roles, highest_role, last_synced_at, is_banned, ban_reason, ban_expires_at')
      .eq('id', authUser.id)
      .maybeSingle();
    if (dbError) throw new Error(`DB Error fetching profile: ${dbError.message}`);

    const needsSync = force || !dbProfile?.last_synced_at || (new Date().getTime() - new Date(dbProfile.last_synced_at).getTime() >= CACHE_TTL_MS);
    let syncError: string | null = null;
    let syncedMemberData: any = null;

    if (needsSync) {
      try {
        const discordUserId = authUser.user_metadata?.provider_id;
        if (!discordUserId) throw new Error('Could not determine Discord ID from auth token.');

        const { data: config, error: configError } = await supabaseAdmin.from('config').select('DISCORD_GUILD_ID').single();
        if (configError || !config?.DISCORD_GUILD_ID) {
          throw new Error("DISCORD_GUILD_ID is not configured in the database.");
        }
        
        const [memberData, guildRoles] = await Promise.all([
            discordApi(`/guilds/${config.DISCORD_GUILD_ID}/members/${discordUserId}`),
            discordApi(`/guilds/${config.DISCORD_GUILD_ID}/roles`)
        ]);

        const memberRoles = guildRoles
            .filter((role: any) => memberData.roles.includes(role.id))
            .sort((a: any, b: any) => b.position - a.position);
            
        syncedMemberData = {
            username: memberData.user.global_name || memberData.user.username,
            avatar: memberData.avatar 
                ? `https://cdn.discordapp.com/guilds/${config.DISCORD_GUILD_ID}/users/${discordUserId}/avatars/${memberData.avatar}.png`
                : `https://cdn.discordapp.com/avatars/${discordUserId}/${memberData.user.avatar}.png`,
            roles: memberRoles,
            highest_role: memberRoles[0] || null
        };

      } catch (e) {
        syncError = `Could not sync with Discord: ${e.message}. Using last known data.`;
        console.warn(`[SYNC-FAIL] User ${authUser.id}: ${e.message}`);
      }
    }
    
    let finalProfileDataSource = dbProfile;
    let userRoles = dbProfile?.roles || [];

    if (syncedMemberData) {
        const discordUserId = authUser.user_metadata?.provider_id;
        
        const { data: updatedProfile, error: upsertError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: authUser.id,
                discord_id: discordUserId,
                username: syncedMemberData.username,
                avatar_url: syncedMemberData.avatar,
                roles: syncedMemberData.roles,
                highest_role: syncedMemberData.highest_role,
                last_synced_at: new Date().toISOString(),
            }, { onConflict: 'id' })
            .select('discord_id, roles, highest_role, is_banned, ban_reason, ban_expires_at')
            .single();
        
        if (upsertError) {
            console.error(`[DB-FAIL] Profile update failed for ${authUser.id}:`, upsertError);
            syncError = (syncError ? syncError + ' ' : '') + `Database update failed after sync: ${upsertError.message}. Using cached data.`;
        } else {
            finalProfileDataSource = updatedProfile;
            userRoles = syncedMemberData.roles;
        }
    }
    
    if (!finalProfileDataSource) {
        if (syncError) {
            throw new Error(syncError.replace('. Using last known data.', ''));
        }
        throw new Error("Initial profile sync failed and no cached data is available. This can happen if the bot token is invalid or the guild ID is incorrect.");
    }
    
    const userRoleIds = (userRoles || []).map((r: any) => r.id);
    const { data: rolePermissions, error: permsError } = await supabaseAdmin
        .from('role_permissions')
        .select('permissions')
        .in('role_id', userRoleIds);
    if (permsError) throw new Error(`Could not fetch role permissions: ${permsError.message}`);

    const permissionSet = new Set<string>();
    for (const rp of rolePermissions || []) {
        for (const p of rp.permissions || []) {
            permissionSet.add(p);
        }
    }

    if (permissionSet.has('_super_admin')) {
      // In a bot-less architecture, we don't have an easy way to get ALL permission keys.
      // The frontend can handle expanding this. We will just send the flag.
    }
    
    const finalUser = {
      id: authUser.id,
      discordId: finalProfileDataSource.discord_id,
      username: syncedMemberData?.username || authUser.user_metadata?.full_name,
      avatar: syncedMemberData?.avatar || authUser.user_metadata?.avatar_url,
      roles: userRoles,
      highestRole: syncedMemberData?.highest_role || finalProfileDataSource.highest_role,
      permissions: Array.from(permissionSet),
      is_banned: finalProfileDataSource.is_banned || false,
      ban_reason: finalProfileDataSource.ban_reason || null,
      ban_expires_at: finalProfileDataSource.ban_expires_at || null,
    };

    return createResponse({ user: finalUser, syncError });

  } catch (error) {
    console.error(`[CRITICAL] sync-user-profile for ${authUser?.id || 'unknown user'}: ${error.message}`);
    return createResponse({ error: `An unexpected error occurred: ${error.message}` }, 500);
  }
})