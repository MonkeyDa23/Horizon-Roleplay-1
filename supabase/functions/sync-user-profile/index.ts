// supabase/functions/sync-user-profile/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verify } from "https://deno.land/x/djwt@v2.9.1/mod.ts"

const DISCORD_API_BASE = 'https://discord.com/api/v10'
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
    // 1. Manually verify the JWT to get the Supabase user ID.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createResponse({ error: 'Missing authorization header.' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    // @ts-ignore
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('SUPABASE_JWT_SECRET is not configured on the server.');
    }

    let userId: string;
    let userMetadata: any;
    try {
      const payload = await verify(token, jwtSecret);
      userId = payload.sub as string; // This is the Supabase UUID
      userMetadata = payload.user_metadata;
      if (!userId) throw new Error("Invalid JWT payload: missing 'sub' claim.");
    } catch (e) {
      return createResponse({ error: `Invalid JWT: ${e.message}` }, 401);
    }

    // 2. Create a service role client for elevated permissions.
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Fetch the user's profile from our DB to get the crucial Discord ID.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('discord_id, roles, highest_role, last_synced_at')
      .eq('id', userId)
      .single();

    if (!profile) {
      throw new Error(`Profile not found for user ${userId}. A profile should be created automatically on signup.`);
    }
    const discordUserId = profile.discord_id;
    if (!discordUserId) {
      throw new Error(`Discord ID not found in profile for user ${userId}. This may indicate an issue with the initial signup process.`);
    }

    // 4. Check if we have fresh, cached data.
    if (profile.last_synced_at && (new Date().getTime() - new Date(profile.last_synced_at).getTime() < CACHE_TTL_MS)) {
      const { data: permsData } = await supabaseAdmin.from('role_permissions').select('permissions').in('role_id', profile.roles || []);
      const finalPermissions = new Set<string>();
      if (permsData) {
        permsData.forEach(p => p.permissions.forEach(key => finalPermissions.add(key)));
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

    // --- CACHE MISS: Fetch fresh data from Discord ---
    let syncError: string | null = null;
    let memberData;
    let finalUsername = userMetadata.full_name;
    let finalAvatar = userMetadata.avatar_url;
    let finalRoles: string[] = profile.roles || [];
    let finalHighestRole = profile.highest_role || null;

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
      
      memberData = await memberResponse.json();
      const discordUser = memberData?.user;
      finalUsername = memberData.nick || discordUser?.global_name || discordUser?.username || finalUsername;
      if (memberData.avatar) {
          finalAvatar = `https://cdn.discordapp.com/guilds/${config.DISCORD_GUILD_ID}/users/${discordUserId}/avatars/${memberData.avatar}.png`;
      } else if (discordUser?.avatar) {
          finalAvatar = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      }
      finalRoles = memberData.roles || [];

      // Determine highest role
      const { data: allGuildRoles, error: rolesError } = await supabaseAdmin.functions.invoke('get-guild-roles');
      if (rolesError) {
        syncError = "Could not fetch guild roles to determine highest role.";
      } else if (Array.isArray(allGuildRoles) && finalRoles.length > 0) {
        const userRolesDetails = allGuildRoles.filter(role => finalRoles.includes(role.id)).sort((a, b) => b.position - a.position);
        if (userRolesDetails.length > 0) {
          const topRole = userRolesDetails[0];
          finalHighestRole = { id: topRole.id, name: topRole.name, color: topRole.color };
        }
      }

    } catch (e) {
      syncError = `Could not sync with Discord: ${e.message}. Displaying last known data.`;
    }

    // 6. Update our DB and Auth cache with the new info.
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { ...userMetadata, full_name: finalUsername, avatar_url: finalAvatar, roles: finalRoles }
    });
    const { error: upsertError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      discord_id: discordUserId,
      roles: finalRoles,
      highest_role: finalHighestRole,
      last_synced_at: new Date().toISOString()
    });
    if (upsertError) console.error("Error updating profile cache:", upsertError.message);

    // 7. Calculate final permissions and return the complete user object.
    const { data: permsData } = await supabaseAdmin.from('role_permissions').select('permissions').in('role_id', finalRoles);
    const finalPermissions = new Set<string>();
    if (permsData) {
      permsData.forEach(p => p.permissions.forEach(key => finalPermissions.add(key)));
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