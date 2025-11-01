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
    mentionRole: "Admins", // This would need the role ID in a real scenario, but "Admins" is fine for a text test
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Authenticate & Authorize
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: { user } } = await createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    ).auth.getUser();

    if (!user) throw new Error("Authentication failed.");

    // Check for admin_notifications permission
    const { data: permissions, error: permError } = await supabaseAdmin.rpc('has_permission', { p_user_id: user.id, p_permission_key: 'admin_notifications' });
    if (permError || !permissions) throw new Error("You do not have permission to test notifications.");


    // 2. Get request body
    const { type, targetId } = await req.json();
    if (!type || !targetId) throw new Error("Missing 'type' or 'targetId' in request body.");
    
    // 3. Fetch templates from DB
    const titleKey = `notification_${type}_title`;
    const bodyKey = `notification_${type}_body`;
    const { data: templates, error: templateError } = await supabaseAdmin
        .from('translations')
        .select('key, en, ar')
        .in('key', [titleKey, bodyKey]);
    if (templateError) throw new Error(`DB Error fetching templates: ${templateError.message}`);

    let title = templates.find(t => t.key === titleKey)?.en || `Test Title: ${type}`;
    let body = templates.find(t => t.key === bodyKey)?.en || `This is a test body for the '{type}' notification.`;
    
    // 4. Populate placeholders
    for (const [key, value] of Object.entries(sampleData)) {
        title = title.replace(new RegExp(`{${key}}`, 'g'), value);
        body = body.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    
    // 5. Construct payload for discord-proxy
    const isUserTarget = type.endsWith('_dm') || type === 'submission_receipt' || type.startsWith('submission_');
    const proxyPayload: any = {
        embed: {
            title: `[TEST] ${title}`,
            description: body,
            color: 15844367, // Orange
            timestamp: new Date().toISOString()
        }
    };
    
    let proxyType = 'audit_log'; // Default to a channel post
    if (isUserTarget) {
        proxyType = 'submission_result'; // Re-use the DM logic
        proxyPayload.userId = targetId;
    } else {
        proxyPayload.channelId = targetId;
        proxyPayload.content = `This is a test message for the \`${type}\` notification.`
    }
    
    // 6. Invoke the discord-proxy function by getting its secret
    // @ts-ignore
    const proxySecret = Deno.env.get('DISCORD_PROXY_SECRET');
    if (!proxySecret) throw new Error("DISCORD_PROXY_SECRET is not configured.");
    
    const { data, error } = await supabaseAdmin.functions.invoke('discord-proxy', {
      headers: { 'Authorization': `Bearer ${proxySecret}` },
      body: JSON.stringify({ type: proxyType, payload: proxyPayload })
    });
    if (error) throw new Error(`Failed to invoke discord-proxy: ${error.message}`);
    
    return createResponse({ success: true, message: "Test notification sent.", response: data });

  } catch (error) {
    console.error(`[CRITICAL] test-notification: ${error.message}`);
    return createResponse({ error: `An unexpected error occurred: ${error.message}` }, 500);
  }
})
