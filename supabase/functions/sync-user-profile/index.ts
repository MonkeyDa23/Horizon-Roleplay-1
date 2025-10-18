// supabase/functions/sync-user-profile/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DISCORD_API_BASE = 'https://discord.com/api/v10'
// Cache user data for 2 minutes to avoid hitting Discord's API rate limits on rapid reloads.
const CACHE_TTL_MS = 2 * 60 * 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to create a standardized response.
const createResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

// Main function logic
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 1. Get the user from the JWT
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return createResponse({ error: 'No valid user session found.' }, 401);
    }

    // Create a service role client for elevated permissions
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. Check server-side cache in `profiles` table
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('roles, highest_role, last_synced_at')
      .eq('id', user.id)
      .single();

    if (profile && profile.last_synced_at && (new Date().getTime() - new Date(profile.last_synced_at).getTime() < CACHE_TTL_MS)) {
        // --- CACHE HIT ---
        // Build and return user object from cached data without calling Discord
        const { data: permsData } = await supabaseAdmin.from('role_permissions').select('permissions').in('role_id', profile.roles || []);
        const finalPermissions = new Set<string>();
        if (permsData) {
            permsData.forEach(p => p.permissions.forEach(key => finalPermissions.add(key)));
        }

        const finalUser = {
            id: user.id,
            username: user.user_metadata.full_name,
            avatar: user.user_metadata.avatar_url,
            roles: profile.roles || [],
            highestRole: profile.highest_role || null,
            permissions: Array.from(finalPermissions),
        };
        return createResponse({ user: finalUser, syncError: null });
    }

    // --- CACHE MISS ---
    // 3. Get the Discord Bot Token from environment variables
    // @ts-ignore
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    if (!botToken) {
        throw new Error('DISCORD_BOT_TOKEN is not configured on the server.');
    }

    // 4. Get Guild ID from the public config table
    const { data: config } = await supabaseAdmin.from('config').select('DISCORD_GUILD_ID').single();
    if (!config?.DISCORD_GUILD_ID) {
        throw new Error('DISCORD_GUILD_ID is not configured in the database.');
    }
    const guildId = config.DISCORD_GUILD_ID;

    // 5. Fetch fresh user data from Discord API using the Bot Token
    let syncError: string | null = null;
    let memberData;

    try {
        const memberUrl = `${DISCORD_API_BASE}/guilds/${guildId}/members/${user.id}`;
        const memberResponse = await fetch(memberUrl, {
            headers: { 'Authorization': `Bot ${botToken}` },
        });

        if (!memberResponse.ok) {
            if (memberResponse.status === 404) {
                // User is authenticated but no longer in the Discord server.
                // This is a critical error that the client should handle by logging the user out.
                throw new Error("User not found in Discord guild. Session invalid.");
            }
            throw new Error(`Failed to fetch Discord member data (HTTP ${memberResponse.status}).`);
        }
        memberData = await memberResponse.json();
    } catch (e) {
        // If Discord API fails, we still try to serve data from the (stale) profile if available
        if (profile) {
            syncError = `Could not sync with Discord: ${e.message}. Displaying last known data.`;
            // Re-use stale profile data from the cache check earlier
            const { data: permsData } = await supabaseAdmin.from('role_permissions').select('permissions').in('role_id', profile.roles || []);
            const finalPermissions = new Set<string>();
            if (permsData) permsData.forEach(p => p.permissions.forEach(key => finalPermissions.add(key)));
            const finalUser = { id: user.id, username: user.user_metadata.full_name, avatar: user.user_metadata.avatar_url, roles: profile.roles || [], highestRole: profile.highest_role || null, permissions: Array.from(finalPermissions) };
            return createResponse({ user: finalUser, syncError });
        }
        // If there's no stale profile to fall back on, we must throw.
        throw e;
    }

    // --- Start of Resilient User Object Construction ---
    // Start with a base user object from the reliable JWT data.
    let finalUsername = user.user_metadata.full_name;
    let finalAvatar = user.user_metadata.avatar_url;
    let finalRoles: string[] = user.user_metadata.roles || []; // Get roles from JWT if possible
    let finalHighestRole = null;

    // Safely enhance with guild-specific data if the member object is valid
    // The bot endpoint returns a `user` object inside the member object.
    const discordUser = memberData?.user;
    if (memberData && typeof memberData === 'object') {
        finalUsername = memberData.nick || discordUser?.global_name || discordUser?.username || finalUsername;
        if (memberData.avatar) {
            finalAvatar = `https://cdn.discordapp.com/guilds/${guildId}/users/${user.id}/avatars/${memberData.avatar}.png`;
        } else if (discordUser?.avatar) {
            finalAvatar = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        }
        // Always prefer the roles list from the live API call as it's most current
        finalRoles = memberData.roles || [];
    }

    // Calculate highest role using the determined roles
    if (finalRoles.length > 0) {
        const { data: allGuildRoles, error: rolesError } = await supabaseClient.functions.invoke('get-guild-roles');
        if (rolesError) {
          syncError = "Could not fetch guild roles to determine highest role.";
        } else if (Array.isArray(allGuildRoles)) {
          const userRolesDetails = allGuildRoles
              .filter(role => finalRoles.includes(role.id))
              .sort((a, b) => b.position - a.position);
          if (userRolesDetails.length > 0) {
              const topRole = userRolesDetails[0];
              finalHighestRole = { id: topRole.id, name: topRole.name, color: topRole.color };
          }
        }
    }

    // Update Supabase Auth metadata and profiles table (the cache)
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, roles: finalRoles }
    });
    const { error: upsertError } = await supabaseAdmin.from('profiles').upsert({
        id: user.id,
        roles: finalRoles,
        highest_role: finalHighestRole,
        last_synced_at: new Date().toISOString()
    });
    if (upsertError) console.error("Error updating profile cache:", upsertError.message);

    // Calculate final permissions from the roles
    const { data: permsData } = await supabaseAdmin.from('role_permissions').select('permissions').in('role_id', finalRoles);
    const finalPermissions = new Set<string>();
    if (permsData) {
        permsData.forEach(p => p.permissions.forEach(key => finalPermissions.add(key)));
    }

    // Construct the final user object
    const finalUser = {
        id: user.id,
        username: finalUsername,
        avatar: finalAvatar,
        roles: finalRoles,
        highestRole: finalHighestRole,
        permissions: Array.from(finalPermissions),
    };
    // --- End of Resilient User Object Construction ---

    return createResponse({ user: finalUser, syncError });

  } catch (error) {
    console.error(`Error in sync-user-profile function: ${error.message}`);
    return createResponse({ error: error.message }, 500);
  }
})
