// FIX: Replaced invalid Deno types reference with a valid one.
/// <reference types="https://raw.githubusercontent.com/denoland/deno/main/cli/tsc/dts/lib.deno.d.ts" />

// supabase/functions/test-notification/index.ts
// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// Sample data for populating placeholders
const sampleData = {
    username: "TestUser",
    quizTitle: "Sample Application",
    adminUsername: "Admin",
    userHighestRole: "VIP",
    mentionRole: "Admins",
    reason: "This is a test reason for the notification."
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Authenticate & Authorize
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: { user } } = await createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    ).auth.getUser();

    if (!user) throw new Error("Authentication failed.");

    const { data: hasPerm, error: permError } = await supabaseAdmin.rpc('has_permission', { p_user_id: user.id, p_permission_key: 'admin_notifications' });
    if (permError || !hasPerm) throw new Error("You do not have permission to test notifications.");

    // 2. Get request body
    const { type, targetId } = await req.json();
    if (!type || !targetId) throw new Error("Missing 'type' or 'targetId' in request body.");
    
    // 3. Construct a payload for the 'discord-proxy' function.
    // We don't need to fetch templates here; the proxy function does that.
    // We just need to simulate the payload that the database trigger would send.
    
    let proxyType = 'audit_log'; // Default to a channel post type
    let proxyPayload: any = {};
    const isUserTarget = type.endsWith('_dm') || type === 'submission_receipt' || type.startsWith('submission_');

    if (isUserTarget) {
      // Re-use the submission_result type in the proxy for sending DMs
      proxyType = 'submission_result'; 
      proxyPayload = {
        userId: targetId,
        embed: {
            titleKey: `notification_${type}_title`,
            bodyKey: `notification_${type}_body`,
            replacements: sampleData,
            isTest: true // Add a flag to modify the title in the proxy
        }
      };
    } else {
      // Re-use the audit_log type for sending webhook messages
      proxyType = 'audit_log';
      proxyPayload = {
        log_type: type, // This will determine which webhook URL is used
        action: `This is a test notification for the **${type}** event.`,
        adminUsername: user.user_metadata.full_name,
        timestamp: new Date().toISOString(),
        isTest: true,
        channelId: targetId, // Override the channel
      };
    }

    // 4. Invoke the discord-proxy function
    // We pass the service role key via the Authorization header to authenticate the call
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const projectUrl = Deno.env.get('SUPABASE_URL');
    const proxyUrl = `${projectUrl}/functions/v1/discord-proxy`;

    const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ type: proxyType, payload: proxyPayload })
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(`Failed to invoke discord-proxy: ${errorBody.error || `Status ${response.status}`}`);
    }
    
    const responseData = await response.json();
    return createResponse({ success: true, message: "Test notification sent.", response: responseData });

  } catch (error) {
    console.error(`[CRITICAL] test-notification: ${error.message}`);
    return createResponse({ error: `An unexpected error occurred: ${error.message}` }, 500);
  }
})
