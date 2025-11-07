// supabase/functions/send-notification/index.ts
// FIX: Replaced invalid Deno types reference with a valid one for Supabase edge functions.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

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

const sampleData = {
    username: "TestUser",
    quizTitle: "Sample Application",
    adminUsername: "Admin",
    reason: "This is a test reason for the notification."
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, payload } = await req.json();
    if (!type || !payload) throw new Error("Missing 'type' or 'payload' in request body.");

    // 1. Authenticate user and create an admin client for permission checks
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
    
    // 2. Perform permission check based on notification type
    let requiredPermission: string | null = null;
    switch (type) {
        case 'new_submission':
        case 'submission_receipt':
            // These are triggered by the user themselves, no admin perm needed
            break;
        case 'submission_result':
        case 'log_action':
             // For logs, the permission is checked by the RPC function that creates the log.
             // For submission results, we need to check 'admin_submissions'
            requiredPermission = 'admin_submissions';
            break;
        case type.startsWith('test_') ? type : '':
            requiredPermission = 'admin_notifications';
            break;
        default:
             // For other admin-initiated actions, they are logged via RPCs which check perms.
    }
    
    if (requiredPermission) {
        const { data: hasPerm } = await supabaseAdmin.rpc('has_permission', { p_user_id: user.id, p_permission_key: requiredPermission });
        if (!hasPerm) throw new Error(`You do not have permission to send '${type}' notifications.`);
    }

    // 3. Prepare payload for discord-proxy
    let proxyType = '';
    let proxyPayload: any = {};
    
    if (type.startsWith('test_')) {
        const testType = type.replace('test_', '');
        proxyType = 'submission_result';
        proxyPayload = {
            userId: payload.targetId,
            embed: {
                titleKey: `notification_${testType}_title`,
                bodyKey: `notification_${testType}_body`,
                replacements: sampleData,
                isTest: true
            }
        };
    } else {
        switch (type) {
            case 'new_submission': {
                const { data: profile } = await supabaseAdmin.from('profiles').select('discord_id, avatar_url').eq('id', user.id).single();
                proxyType = 'new_submission';
                proxyPayload = {
                    ...payload.submission, // Pass through all submission data
                    discordId: profile?.discord_id,
                    avatarUrl: profile?.avatar_url,
                };
                break;
            }
            case 'submission_receipt':
            case 'submission_result': {
                const subId = type === 'submission_receipt' ? payload.submission.id : payload.submissionId;
                const { data: submission } = await supabaseAdmin.from('submissions').select('*, profiles(discord_id)').eq('id', subId).single();
                if (!submission) throw new Error(`Submission ${subId} not found.`);

                proxyType = 'submission_result';
                proxyPayload = {
                    userId: (submission.profiles as any)?.discord_id,
                    embed: {
                        titleKey: `notification_${type}_title`,
                        bodyKey: `notification_${type}_body`,
                        replacements: {
                            username: submission.username,
                            quizTitle: submission.quizTitle,
                            adminUsername: submission.adminUsername,
                            reason: payload.reason || 'N/A'
                        }
                    }
                };
                break;
            }
            case 'log_action': {
                proxyType = 'audit_log';
                proxyPayload = {
                    ...payload,
                    adminUsername: user.user_metadata.full_name,
                    timestamp: new Date().toISOString(),
                };
                break;
            }
            default:
                throw new Error(`Unknown notification type: ${type}`);
        }
    }


    // 4. Invoke the discord-proxy function with service_role key
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
    return createResponse({ success: true, message: `Notification '${type}' sent.`, response: responseData });

  } catch (error) {
    console.error(`[CRITICAL] send-notification: ${error.message}`);
    return createResponse({ error: `An unexpected error occurred: ${error.message}` }, 500);
  }
})