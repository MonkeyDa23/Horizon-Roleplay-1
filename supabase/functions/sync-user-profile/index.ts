// supabase/functions/sync-user-profile/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// DUPLICATED from src/lib/permissions.ts to remove external dependency for deployment.
const PERMISSIONS = {
  _super_admin: 'Grants all other permissions automatically.',
  page_store: 'Allow user to see and access the Store page.',
  page_rules: 'Allow user to see and access the Rules page.',
  page_applies: 'Allow user to see and access the Applies page.',
  admin_panel: 'Allow user to see the "Admin Panel" button and access the /admin route.',
  admin_submissions: 'Allow user to view and handle all application submissions.',
  admin_quizzes: 'Allow user to create, edit, and delete application forms (quizzes).',
  admin_rules: 'Allow user to edit the server rules.',
  admin_store: 'Allow user to manage items in the store.',
  admin_translations: 'Allow user to edit all website text and translations.',
  admin_notifications: 'Allow user to manage automated Discord notifications and messages.',
  admin_appearance: 'Allow user to change site-wide settings like name, logo, and theme.',
  admin_audit_log: 'Allow user to view the log of all admin actions.',
  admin_permissions: 'Allow user to change permissions for other Discord roles.',
  admin_lookup: 'Allow user to look up user profiles by Discord ID.',
  admin_widgets: 'Allow user to create, edit, and delete Discord widgets on the "About Us" page.',
} as const;


const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  let authUser;
  const supabaseAdmin = createClient(
    // @ts-ignore
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    let force = false;
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        const body = await req.json();
        if (body && body.force === true) force = true;
      }
    } catch (e) { /* Ignore parsing errors */ }

    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
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
      .select('discord_id, roles, highest_role, last_synced_at, is_banned, ban_reason, ban_expires_at, permissions')
      .eq('id', authUser.id)
      .maybeSingle();
    if (dbError) throw new Error(`DB Error fetching profile: ${dbError.message}`);

    const needsSync = force || !dbProfile?.last_synced_at || (new Date().getTime() - new Date(dbProfile.last_synced_at).getTime() >= CACHE_TTL_MS);
    let syncError: string | null = null;
    let syncedMemberData = null;
    let finalPermissions = dbProfile?.permissions || [];

    if (needsSync) {
      try {
        const discordUserId = dbProfile?.discord_id || authUser.user_metadata?.provider_id;
        if (!discordUserId) throw new Error('Could not determine Discord ID for user.');

        // @ts-ignore
        const BOT_URL = Deno.env.get('VITE_DISCORD_BOT_URL');
        // @ts-ignore
        const BOT_API_KEY = Deno.env.get('VITE_DISCORD_BOT_API_KEY');
        if (!BOT_URL || !BOT_API_KEY) throw new Error("Bot integration secrets are not configured.");

        const endpoint = new URL(`/api/user/${discordUserId}`, BOT_URL);
        const botResponse = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${BOT_API_KEY}` } });

        if (!botResponse.ok) {
          const errBody = await botResponse.json().catch(() => ({}));
          throw new Error(`Bot API error (${botResponse.status}): ${errBody.error || 'Unknown error'}`);
        }
        
        syncedMemberData = await botResponse.json();
        if (!syncedMemberData || !Array.isArray(syncedMemberData.roles)) throw new Error("Sync failed: Bot returned invalid or malformed data.");
        if (syncedMemberData.roles.length === 0) throw new Error("Sync failed: Bot returned an empty role list. This is likely a 'Server Members Intent' issue. Please check bot configuration.");

        // NEW: Calculate permissions after successful sync
        const userRoleIds = (syncedMemberData.roles || []).map((r: any) => r.id);
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
          Object.keys(PERMISSIONS).forEach(p => permissionSet.add(p));
        }
        finalPermissions = Array.from(permissionSet);

        // Persist all new data
        const { error: upsertError } = await supabaseAdmin.from('profiles').upsert({
            id: authUser.id,
            discord_id: discordUserId,
            roles: syncedMemberData.roles,
            highest_role: syncedMemberData.highest_role,
            last_synced_at: new Date().toISOString(),
            permissions: finalPermissions, // Store the calculated permissions
        });
        if (upsertError) throw new Error(`Database update failed after sync: ${upsertError.message}.`);

      } catch (e) {
        let friendlyMessage = e.message;
        if (e.message.includes('Connection refused')) friendlyMessage = "The website could not connect to the Discord bot. The bot might be offline, the URL in your configuration might be incorrect, or a firewall could be blocking the connection. Please check the bot's status.";
        else if (e.message.includes('Bot API error (404)')) friendlyMessage = "The bot reported that you are not a member of the Discord server. If you have recently joined, please wait a few minutes before trying again.";
        else if (e.message.includes('Server Members Intent')) friendlyMessage = "Sync failed because the bot returned no roles. This is almost always caused by the 'Server Members Intent' being disabled in the Discord Developer Portal. Please enable it and restart the bot.";
        
        syncError = `Could not sync with Discord: ${friendlyMessage}. Using last known data.`;
        console.warn(`[SYNC-FAIL] User ${authUser.id}: ${e.message}`);
      }
    }
    
    const finalProfileDataSource = syncedMemberData ? {
        discord_id: syncedMemberData.discord_id,
        roles: syncedMemberData.roles,
        highest_role: syncedMemberData.highest_role,
        permissions: finalPermissions,
        is_banned: dbProfile?.is_banned || false,
        ban_reason: dbProfile?.ban_reason || null,
        ban_expires_at: dbProfile?.ban_expires_at || null,
    } : dbProfile;

    if (!finalProfileDataSource) {
        throw new Error("Initial profile sync failed and no cached data is available. This can happen if the bot is offline or misconfigured during your first login.");
    }
    
    const finalUser = {
      id: authUser.id,
      discordId: finalProfileDataSource.discord_id,
      username: syncedMemberData?.username || authUser.user_metadata?.full_name,
      avatar: syncedMemberData?.avatar || authUser.user_metadata?.avatar_url,
      roles: finalProfileDataSource.roles,
      highestRole: finalProfileDataSource.highest_role,
      permissions: finalProfileDataSource.permissions,
      is_banned: finalProfileDataSource.is_banned,
      ban_reason: finalProfileDataSource.ban_reason,
      ban_expires_at: finalProfileDataSource.ban_expires_at,
    };

    return createResponse({ user: finalUser, syncError });

  } catch (error) {
    console.error(`[CRITICAL] sync-user-profile for ${authUser?.id || 'unknown user'}: ${error.message}`);
    return createResponse({ error: `An unexpected error occurred: ${error.message}` }, 500);
  }
})
