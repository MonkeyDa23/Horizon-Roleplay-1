// FIX: Updated the type reference to a reliable CDN to resolve Deno runtime types.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { corsHeaders, discordApi, createAdminClient } from '../shared/index.ts';
import type { User, DiscordRole, PermissionKey } from '../../../src/types.ts';

const GUILD_ID = Deno.env.get('DISCORD_GUILD_ID');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!GUILD_ID) {
      throw new Error("DISCORD_GUILD_ID is not configured in function secrets.");
    }
    
    // 1. Create a Supabase client with the user's auth token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authUser) throw new Error("User not found.");

    const discordId = authUser.user_metadata?.provider_id;
    if (!discordId) throw new Error("Could not determine Discord ID from auth token.");

    // 2. Create a Supabase admin client to query protected tables
    const supabaseAdmin = createAdminClient();

    // 3. Fetch user's ban status from the DB
    const { data: banData, error: banError } = await supabaseAdmin
      .from('profiles')
      .select('is_banned, ban_reason, ban_expires_at')
      .eq('id', authUser.id)
      .single();

    if (banError && banError.code !== 'PGRST116') { // Ignore "not found" error
      console.error(`Ban check error for ${authUser.id}:`, banError.message);
    }
    
    // 4. Fetch the member from Discord API
    let member;
    try {
        member = await discordApi.get(`/guilds/${GUILD_ID}/members/${discordId}`);
    } catch(e) {
        if (e.response && e.response.status === 404) {
             return new Response(JSON.stringify({ error: "User not found in the Discord server." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404,
            });
        }
        throw e; // Re-throw other Discord API errors
    }
    
    // 5. Fetch all guild roles once for efficient lookup
    const allGuildRoles: DiscordRole[] = await discordApi.get(`/guilds/${GUILD_ID}/roles`);
    const rolesMap = new Map(allGuildRoles.map(r => [r.id, r]));

    // 6. Map member's roles and find the highest one
    const memberRoles: DiscordRole[] = member.roles
        .map((roleId: string) => rolesMap.get(roleId))
        .filter(Boolean)
        .sort((a, b) => b.position - a.position);

    const highestRole = memberRoles[0] || null;

    // 7. Fetch all permissions for the member's roles
    const { data: permissionsData, error: permissionsError } = await supabaseAdmin
      .from('role_permissions')
      .select('permissions')
      .in('role_id', member.roles);

    if (permissionsError) {
      console.error(`Permissions fetch error:`, permissionsError.message);
    }

    const userPermissions = new Set<PermissionKey>();
    if (permissionsData) {
      permissionsData.forEach(p => {
        (p.permissions || []).forEach(perm => userPermissions.add(perm as PermissionKey));
      });
    }

    // 8. Construct the final User object
    const finalUser: User = {
      id: authUser.id,
      discordId: discordId,
      username: member.user.global_name || member.user.username,
      avatar: member.avatar 
        ? `https://cdn.discordapp.com/guilds/${GUILD_ID}/users/${discordId}/avatars/${member.avatar}.png`
        : `https://cdn.discordapp.com/avatars/${discordId}/${member.user.avatar}.png`,
      roles: memberRoles,
      highestRole: highestRole,
      permissions: Array.from(userPermissions),
      is_banned: banData?.is_banned ?? false,
      ban_reason: banData?.ban_reason ?? null,
      ban_expires_at: banData?.ban_expires_at ?? null,
    };
    
    // 9. Update the user's profile in the DB (don't await this)
    supabaseAdmin.from('profiles').upsert({
        id: finalUser.id,
        discord_id: finalUser.discordId,
        username: finalUser.username,
        avatar_url: finalUser.avatar,
        roles: finalUser.roles,
        highest_role: finalUser.highestRole,
        last_synced_at: new Date().toISOString()
    }, { onConflict: 'id' }).then(({ error }) => {
        if (error) console.error("Profile update failed:", error.message);
    });

    return new Response(JSON.stringify({ user: finalUser, syncError: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[CRITICAL] sync-user-profile:', error.message);
    return new Response(JSON.stringify({ error: `An unexpected error occurred: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})