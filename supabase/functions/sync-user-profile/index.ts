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

  let authUser;
  // Use the SERVICE_ROLE_KEY to bypass RLS for internal operations
  const supabaseAdmin = createClient(
    // @ts-ignore
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // =================================================================
    // 1. AUTHENTICATE USER & GET PARAMS
    // =================================================================
    let force = false;
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        const body = await req.json();
        if (body && body.force === true) force = true;
      }
    } catch (e) { /* Ignore parsing errors if body is empty */ }

    // Create a client with the user's auth token to identify them
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

    // =================================================================
    // 2. GET TRUSTED PROFILE & PERMISSIONS FROM DATABASE
    // =================================================================
    const { data: dbProfile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();
    if (dbError) throw new Error(`DB Error fetching profile: ${dbError.message}`);

    // =================================================================
    // 3. ATTEMPT TO SYNC WITH DISCORD BOT
    // =================================================================
    const needsSync = force || !dbProfile?.last_synced_at || (new Date().getTime() - new Date(dbProfile.last_synced_at).getTime() >= CACHE_TTL_MS);
    let syncError: string | null = null;
    let syncedMemberData = null;

    if (needsSync) {
      try {
        const discordUserId = dbProfile?.discord_id || authUser.user_metadata?.provider_id;
        if (!discordUserId) throw new Error('Could not determine Discord ID for user.');

        // @ts-ignore
        const BOT_URL = Deno.env.get('VITE_DISCORD_BOT_URL');
        // @ts-ignore
        const BOT_API_KEY = Deno.env.get('VITE_DISCORD_BOT_API_KEY');
        if (!BOT_URL || !BOT_API_KEY) throw new Error("Bot integration secrets are not configured.");

        const botResponse = await fetch(`${BOT_URL}/api/user/${discordUserId}`, {
          headers: { 'Authorization': `Bearer ${BOT_API_KEY}` }
        });

        if (!botResponse.ok) {
          const errBody = await botResponse.json().catch(() => ({}));
          throw new Error(`Bot API error (${botResponse.status}): ${errBody.error || 'Unknown error'}`);
        }
        
        syncedMemberData = await botResponse.json();

        // ** CRITICAL CHECKS **
        if (!syncedMemberData || !Array.isArray(syncedMemberData.roles)) {
            throw new Error("Sync failed: Bot returned invalid or malformed data.");
        }
        if (syncedMemberData.roles.length === 0) {
            throw new Error("Sync failed: Bot returned an empty role list. This is likely a 'Server Members Intent' issue. Please check bot configuration.");
        }

      } catch (e) {
        syncError = `Could not sync with Discord: ${e.message}. Using last known data.`;
        console.warn(`[SYNC-FAIL] User ${authUser.id}: ${e.message}`);
      }
    }
    
    // =================================================================
    // 4. PERSIST CHANGES AND CONSTRUCT FINAL USER OBJECT
    // =================================================================
    let finalProfileDataSource = dbProfile; 

    if (syncedMemberData) {
        const discordUserId = dbProfile?.discord_id || authUser.user_metadata?.provider_id;
        const { data: updatedProfile, error: upsertError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: authUser.id,
                discord_id: discordUserId,
                roles: syncedMemberData.roles,
                highest_role: syncedMemberData.highest_role,
                is_guild_owner: syncedMemberData.isGuildOwner,
                last_synced_at: new Date().toISOString(),
                // DO NOT update is_admin or is_super_admin here. They are managed manually.
            })
            .select()
            .single();
        
        if (upsertError) {
            console.error(`[DB-FAIL] Profile update failed for ${authUser.id}:`, upsertError);
            syncError = (syncError ? syncError + ' ' : '') + `Database update failed after sync: ${upsertError.message}. Using cached data.`;
        } else {
            finalProfileDataSource = {
                ...updatedProfile,
                username: syncedMemberData.username,
                avatar: syncedMemberData.avatar,
            };
        }
    }
    
    if (!finalProfileDataSource) {
        throw new Error("Initial profile sync failed and no cached data is available. This can happen if the bot is offline or misconfigured during your first login.");
    }
    
    const finalUser = {
      id: authUser.id,
      discordId: finalProfileDataSource.discord_id,
      username: finalProfileDataSource.username || authUser.user_metadata?.full_name,
      avatar: finalProfileDataSource.avatar || authUser.user_metadata?.avatar_url,
      roles: finalProfileDataSource.roles,
      highestRole: finalProfileDataSource.highest_role,
      is_guild_owner: finalProfileDataSource.is_guild_owner || false,
      is_admin: finalProfileDataSource.is_admin || false,
      is_super_admin: finalProfileDataSource.is_super_admin || false,
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