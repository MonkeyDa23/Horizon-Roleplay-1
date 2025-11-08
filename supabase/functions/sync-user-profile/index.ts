// supabase/functions/sync-user-profile/index.ts
// FIX: Updated the Supabase function type reference to a valid path.
/// <reference types="https://esm.sh/@supabase/functions-js" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js';
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

const DISCORD_API_BASE = 'https://discord.com/api/v10';

async function makeDiscordRequest(endpoint: string, options: RequestInit = {}) {
  const BOT_TOKEN = (Deno as any).env.get('DISCORD_BOT_TOKEN');
  if (!BOT_TOKEN) {
    throw new Error("DISCORD_BOT_TOKEN is not configured in function secrets.");
  }

  const response = await fetch(`${DISCORD_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Failed to parse error body' }));
    console.error(`Discord API Error on ${options.method || 'GET'} ${endpoint}: ${response.status}`, errorBody);
    const error = new Error(`Discord API Error: ${errorBody.message || response.statusText}`);
    (error as any).status = response.status;
    (error as any).response = response;
    throw error;
  }
  
  if (response.status === 204) {
    return null;
  }
  
  return response.json();
}

const discordApi = {
  get: (endpoint: string) => makeDiscordRequest(endpoint, { method: 'GET' }),
};

serve(async (req) => {
  console.log(`[sync-user-profile] Received ${req.method} request.`);

  const createAdminClient = () => {
    const supabaseUrl = (Deno as any).env.get('SUPABASE_URL');
    const serviceRoleKey = (Deno as any).env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase URL or Service Role Key is not configured in function secrets.');
    return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("[sync-user-profile] Error: Missing Authorization header.");
      return new Response(JSON.stringify({ error: "Missing Authorization header." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const GUILD_ID = (Deno as any).env.get('DISCORD_GUILD_ID');
    if (!GUILD_ID) throw new Error("DISCORD_GUILD_ID is not configured in function secrets.");
    
    const supabase = createClient(
      (Deno as any).env.get('SUPABASE_URL') ?? '',
      (Deno as any).env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error(`[sync-user-profile] Supabase auth error: ${authError.message}`);
      return new Response(JSON.stringify({ error: `Authentication error: ${authError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    if (!authUser) {
      console.error(`[sync-user-profile] User not found from auth token.`);
      return new Response(JSON.stringify({ error: "User not found from auth token. Session may be invalid." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

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
        if ((e as any).status === 404) {
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
    
    const { error: upsertError } = await supabaseAdmin.from('profiles').upsert({
        id: finalUser.id, discord_id: finalUser.discordId, username: finalUser.username, avatar_url: finalUser.avatar,
        roles: finalUser.roles, highest_role: finalUser.highestRole, last_synced_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (upsertError) {
        console.error("[sync-user-profile] Profile upsert failed:", upsertError.message);
    } else {
        console.log(`[sync-user-profile] Successfully upserted profile for user ${finalUser.id}.`);
    }

    console.log("[sync-user-profile] Sync complete. Returning user profile.");
    return new Response(JSON.stringify({ user: finalUser, syncError: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[CRITICAL] sync-user-profile:', error);
    // FIX: Improved error handling to safely access the message property from an unknown type.
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: `An unexpected error occurred: ${message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})