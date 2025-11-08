// supabase/functions/sync-user-profile/index.ts
// FIX: Updated Supabase Edge Function type reference to resolve Deno runtime types.
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { REST } from "https://esm.sh/@discordjs/rest@2.2.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Inlined types to remove dependency on src/types.ts
interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
}
type PermissionKey = string;
interface User {
  id: string;
  discordId: string;
  username: string;
  avatar: string;
  roles: DiscordRole[];
  highestRole: DiscordRole | null;
  permissions: PermissionKey[];
  is_banned: boolean;
  ban_reason: string | null;
  ban_expires_at: string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log(`[sync-user-profile] Received ${req.method} request.`);

  // Define helpers inside the handler
  function getDiscordApi() {
    const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
    if (!BOT_TOKEN) throw new Error("DISCORD_BOT_TOKEN is not configured in function secrets.");
    return new REST({ token: BOT_TOKEN, version: "10" });
  }

  const createAdminClient = () => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase URL or Service Role Key is not configured in function secrets.');
    return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Robustly handle Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("[sync-user-profile] Error: Missing Authorization header.");
      return new Response(JSON.stringify({ error: "Missing Authorization header." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const discordApi = getDiscordApi();
    const GUILD_ID = Deno.env.get('DISCORD_GUILD_ID');
    if (!GUILD_ID) throw new Error("DISCORD_GUILD_ID is not configured in function secrets.");
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authUser) throw new Error("User not found from auth token.");
    console.log(`[sync-user-profile] Authenticated Supabase user: ${authUser.id}`);

    const discordId = authUser.user_metadata?.provider_id;
    if (!discordId) throw new Error("Could not determine Discord ID from auth token.");
    console.log(`[sync-user-profile] Processing Discord ID: ${discordId}`);

    const supabaseAdmin = createAdminClient();

    const { data: banData, error: banError } = await supabaseAdmin
      .from('profiles').select('is_banned, ban_reason, ban_expires_at').eq('id', authUser.id).single();
    if (banError && banError.code !== 'PGRST116') console.error(`[sync-user-profile] Ban check error for ${authUser.id}:`, banError.message);
    
    let member;
    try {
        member = await discordApi.get(`/guilds/${GUILD_ID}/members/${discordId}`);
        console.log(`[sync-user-profile] Successfully fetched member from Discord for ID ${discordId}.`);
    } catch(e) {
        if (e.response && e.response.status === 404) {
             console.warn(`[sync-user-profile] User ${discordId} not found in Discord server ${GUILD_ID}.`);
             return new Response(JSON.stringify({ error: "User not found in the Discord server." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
        }
        throw e;
    }
    
    const allGuildRoles: DiscordRole[] = (await discordApi.get(`/guilds/${GUILD_ID}/roles`)) as any[];
    const rolesMap = new Map(allGuildRoles.map(r => [r.id, r]));

    const memberRoles: DiscordRole[] = (member as any).roles
        .map((roleId: string) => rolesMap.get(roleId)).filter(Boolean).sort((a:any, b:any) => b.position - a.position);
    console.log(`[sync-user-profile] User has ${memberRoles.length} roles.`);

    const highestRole = memberRoles[0] || null;

    const { data: permissionsData, error: permissionsError } = await supabaseAdmin
      .from('role_permissions').select('permissions').in('role_id', (member as any).roles);
    if (permissionsError) console.error(`[sync-user-profile] Permissions fetch error:`, permissionsError.message);

    const userPermissions = new Set<PermissionKey>();
    if (permissionsData) {
      permissionsData.forEach(p => (p.permissions || []).forEach(perm => userPermissions.add(perm as PermissionKey)));
    }
    console.log(`[sync-user-profile] User has ${userPermissions.size} unique permissions.`);

    const finalUser: User = {
      id: authUser.id,
      discordId: discordId,
      username: (member as any).user.global_name || (member as any).user.username,
      avatar: (member as any).avatar 
        ? `https://cdn.discordapp.com/guilds/${GUILD_ID}/users/${discordId}/avatars/${(member as any).avatar}.png`
        : `https://cdn.discordapp.com/avatars/${discordId}/${(member as any).user.avatar}.png`,
      roles: memberRoles,
      highestRole: highestRole,
      permissions: Array.from(userPermissions),
      is_banned: banData?.is_banned ?? false,
      ban_reason: banData?.ban_reason ?? null,
      ban_expires_at: banData?.ban_expires_at ?? null,
    };
    
    // Fire and forget profile update
    supabaseAdmin.from('profiles').upsert({
        id: finalUser.id, discord_id: finalUser.discordId, username: finalUser.username, avatar_url: finalUser.avatar,
        roles: finalUser.roles, highest_role: finalUser.highestRole, last_synced_at: new Date().toISOString()
    }, { onConflict: 'id' }).then(({ error }) => {
        if (error) console.error("[sync-user-profile] Profile upsert failed:", error.message);
        else console.log(`[sync-user-profile] Successfully upserted profile for user ${finalUser.id}.`);
    });

    console.log("[sync-user-profile] Sync complete. Returning user profile.");
    return new Response(JSON.stringify({ user: finalUser, syncError: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[CRITICAL] sync-user-profile:', error); // Log the full error object
    return new Response(JSON.stringify({ error: `An unexpected error occurred: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
