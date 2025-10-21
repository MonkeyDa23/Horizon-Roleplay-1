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
    // =================================================================
    // 1. SETUP & AUTHENTICATION
    // =================================================================
    let force = false;
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        const body = await req.json();
        if (body && body.force === true) force = true;
      }
    } catch (e) { /* Ignore parsing errors */ }

    // Authenticate the user making the request
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authUser) {
      return createResponse({ error: 'Authentication failed.' }, 401);
    }
    const userId = authUser.id;
    
    // Create an admin client to perform elevated actions
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Get secrets for Bot API calls
    // @ts-ignore
    const BOT_URL = Deno.env.get('VITE_DISCORD_BOT_URL');
    // @ts-ignore
    const BOT_API_KEY = Deno.env.get('VITE_DISCORD_BOT_API_KEY');
    if (!BOT_URL || !BOT_API_KEY) {
      throw new Error("VITE_DISCORD_BOT_URL and/or VITE_DISCORD_BOT_API_KEY are not configured as secrets.");
    }

    // =================================================================
    // 2. CACHE CHECK
    // =================================================================
    const { data: profile } = await supabaseAdmin.from('profiles').select('discord_id, roles, highest_role, last_synced_at').eq('id', userId).maybeSingle();

    if (!force && profile?.last_synced_at && (new Date().getTime() - new Date(profile.last_synced_at).getTime() < CACHE_TTL_MS)) {
      const userRoleIds = (profile.roles || []).map((r: any) => r.id);
      const finalPermissions = new Set<string>();
      if (userRoleIds.length > 0) {
        const { data: permsData } = await supabaseAdmin.from('role_permissions').select('permissions').in('role_id', userRoleIds);
        if (permsData) permsData.forEach(p => p.permissions.forEach((key: string) => finalPermissions.add(key)));
      }

      const cachedUser = {
        id: userId,
        discordId: profile.discord_id,
        username: authUser.user_metadata?.full_name,
        avatar: authUser.user_metadata?.avatar_url,
        roles: profile.roles || [],
        highestRole: profile.highest_role || null,
        permissions: Array.from(finalPermissions),
      };
      return createResponse({ user: cachedUser, syncError: null });
    }

    // =================================================================
    // 3. FULL SYNC WITH BOT API
    // =================================================================
    const discordUserId = profile?.discord_id || authUser.user_metadata?.provider_id;
    if (!discordUserId) throw new Error(`Could not determine Discord ID for user ${userId}.`);

    let syncError: string | null = null;
    let finalUsername = authUser.user_metadata?.full_name || 'New User';
    let finalAvatar = authUser.user_metadata?.avatar_url;
    let finalRoles: any[] = profile?.roles || []; 
    let finalHighestRole: any | null = profile?.highest_role || null;
    let memberRoleIds: string[] = (profile?.roles || []).map((r: any) => r.id);

    try {
      // Fetch member data from our external bot
      const botResponse = await fetch(`${BOT_URL}/api/user/${discordUserId}`, {
        headers: { 'Authorization': `Bearer ${BOT_API_KEY}` }
      });

      if (!botResponse.ok) {
         const errBody = await botResponse.json().catch(() => ({}));
         throw new Error(`Bot API error (${botResponse.status}): ${errBody.error || 'Unknown error'}`);
      }
      const memberData = await botResponse.json();
      
      finalRoles = memberData.roles;
      finalHighestRole = memberData.highestRole;
      finalUsername = memberData.username;
      finalAvatar = memberData.avatar;
      memberRoleIds = finalRoles.map(r => r.id);

    } catch (e) {
      syncError = `Could not sync with Bot API: ${e.message}. Displaying last known data. This often means the bot is offline or the 'Server Members Intent' is disabled.`;
      console.warn(`Sync error for user ${userId}:`, e.message);
    }
    
    // =================================================================
    // 4. UPDATE DATABASE & CALCULATE FINAL PERMISSIONS
    // =================================================================
    await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { ...authUser.user_metadata, full_name: finalUsername, avatar_url: finalAvatar } });
    await supabaseAdmin.from('profiles').upsert({ id: userId, discord_id: discordUserId, roles: finalRoles, highest_role: finalHighestRole, last_synced_at: new Date().toISOString() });

    const finalPermissions = new Set<string>();
    if (memberRoleIds.length > 0) {
        const { data: permsData } = await supabaseAdmin.from('role_permissions').select('permissions').in('role_id', memberRoleIds);
        if (permsData) permsData.forEach(p => p.permissions.forEach((key: string) => finalPermissions.add(key)));
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
