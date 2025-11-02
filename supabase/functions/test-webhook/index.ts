// supabase/functions/test-webhook/index.ts
// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  
  const supabaseAdmin = createClient(
    // @ts-ignore
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
     const { data: { user } } = await createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    ).auth.getUser();
    if (!user) throw new Error("Authentication failed.");
    
    // Check for admin permissions
    const { data: hasPerm, error: permError } = await supabaseAdmin.rpc('has_permission', { p_user_id: user.id, p_permission_key: 'admin_notifications' });
    if (permError || !hasPerm) throw new Error("You do not have permission to test webhooks.");

    const { type } = await req.json();
    if (type !== 'submission' && type !== 'audit') throw new Error("Invalid webhook type specified.");

    const { data: config } = await supabaseAdmin.from('config').select('COMMUNITY_NAME, LOGO_URL, SUBMISSION_WEBHOOK_URL, AUDIT_LOG_WEBHOOK_URL').single();

    const webhookUrl = type === 'submission' ? config.SUBMISSION_WEBHOOK_URL : config.AUDIT_LOG_WEBHOOK_URL;
    if (!webhookUrl) throw new Error(`The webhook URL for '${type}' is not configured in the admin panel.`);

    const testEmbed = {
        title: `📢 Test Webhook Notification (${type})`,
        description: `This is a test message from the website, sent by **${user.user_metadata.full_name}**. If you see this, the webhook is configured correctly!`,
        color: 0xe67e22, // Orange
        footer: { text: config.COMMUNITY_NAME, icon_url: config.LOGO_URL },
        timestamp: new Date().toISOString()
    };
    const testPayload = { 
        username: config.COMMUNITY_NAME + ' Notifications',
        avatar_url: config.LOGO_URL,
        embeds: [testEmbed] 
    };
    
    const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
    });
    
    if (!webhookResponse.ok) {
        throw new Error(`Discord returned an error (${webhookResponse.status}). Check if the webhook URL is correct and valid.`);
    }
    
    return createResponse({ message: `Test ${type} webhook sent successfully.` });

  } catch (error) {
    console.error(`[CRITICAL] test-webhook: ${error.message}`);
    return createResponse({ error: `An unexpected error occurred: ${error.message}` }, 500);
  }
});
