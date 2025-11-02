// supabase/functions/send-notification/index.ts
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

const COLORS = {
  CYAN: 0x00f2ea,
  BLUE: 0x3498db,
  GREEN: 0x2ecc71,
  RED: 0xe74c3c,
  ORANGE: 0xe67e22,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // 1. Authenticate user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Authentication failed.");

    const { type, payload } = await req.json();
    if (!type || !payload) throw new Error("Missing 'type' or 'payload'.");

    const { data: config, error: configError } = await supabaseAdmin.from('config').select('*').single();
    if (configError) throw configError;

    let botPayload: any;
    const footer = { text: config.COMMUNITY_NAME, icon_url: config.LOGO_URL };
    const timestamp = new Date().toISOString();

    switch (type) {
      case 'new_submission': {
        const { data: sub, error } = await supabaseAdmin.from('submissions').select('*').eq('id', payload.submissionId).single();
        if (error || !sub) throw new Error(`Submission not found: ${payload.submissionId}`);
        
        // --- Notification to Admin Channel ---
        const adminEmbed = {
          title: '📝 New Application Received!',
          color: COLORS.CYAN,
          fields: [
            { name: 'Applicant', value: sub.username, inline: true },
            { name: 'Application Type', value: sub.quizTitle, inline: true },
            { name: 'Highest Role', value: sub.user_highest_role || 'Member', inline: true },
          ],
          footer,
          timestamp
        };
        botPayload = { type: 'channel', payload: { channelId: config.SUBMISSION_NOTIFICATION_CHANNEL_ID, embed: adminEmbed } };
        await forwardToBot(botPayload);

        // --- Receipt DM to User ---
        const userEmbed = {
          title: '✅ Your Application has been Submitted!',
          description: `Thank you, **${sub.username}**! We have successfully received your application for the **${sub.quizTitle}**.\n\nOur administration team will review it shortly. You can check the status at any time on the 'My Applications' page on our website.`,
          color: COLORS.BLUE,
          footer,
          timestamp,
        };
        botPayload = { type: 'dm', payload: { userId: sub.user_id, embed: userEmbed } };
        break;
      }
      case 'submission_update': {
        const { data: sub, error } = await supabaseAdmin.from('submissions').select('*').eq('id', payload.submissionId).single();
        if (error || !sub) throw new Error(`Submission not found: ${payload.submissionId}`);
        
        let userEmbed;
        if (sub.status === 'accepted') {
            userEmbed = {
                title: '🎉 Congratulations! Your Application was Accepted!',
                description: `Great news, **${sub.username}**! Your application for the **${sub.quizTitle}** has been accepted. Please follow the next steps provided in our Discord server.`,
                color: COLORS.GREEN,
                fields: [{ name: 'Reviewed by', value: sub.adminUsername || 'Admin' }],
                footer,
                timestamp,
            };
        } else if (sub.status === 'refused') {
            userEmbed = {
                title: '❌ Regarding Your Application...',
                description: `Hello, **${sub.username}**. After careful review, we regret to inform you that your application for the **${sub.quizTitle}** has been refused at this time. Thank you for your interest.`,
                color: COLORS.RED,
                fields: [{ name: 'Reviewed by', value: sub.adminUsername || 'Admin' }],
                footer,
                timestamp
            };
        } else { // 'taken' or other statuses
             return createResponse({ message: "No notification for this status update." });
        }
        botPayload = { type: 'dm', payload: { userId: sub.user_id, embed: userEmbed } };
        break;
      }
      case 'test_notification': {
          const { targetId, isUser } = payload;
          const testEmbed = {
              title: `📢 Test Notification`,
              description: `This is a test notification from the website's Health Check page, sent by **${user.user_metadata.full_name}**. If you can see this, the notification system is working correctly!`,
              color: COLORS.ORANGE,
              footer,
              timestamp
          };
          if (isUser) {
              botPayload = { type: 'dm', payload: { userId: targetId, embed: testEmbed } };
          } else {
              botPayload = { type: 'channel', payload: { channelId: targetId, embed: testEmbed, content: `Test message initiated by <@${user.user_metadata.provider_id}>` } };
          }
          break;
      }
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    const botResponse = await forwardToBot(botPayload);
    return createResponse(botResponse);

  } catch (error) {
    console.error(`[CRITICAL] send-notification: ${error.message}`);
    return createResponse({ error: `An unexpected error occurred: ${error.message}` }, 500);
  }
});

async function forwardToBot(body: any) {
  const botUrl = Deno.env.get('VITE_DISCORD_BOT_URL');
  const apiKey = Deno.env.get('VITE_DISCORD_BOT_API_KEY');
  if (!botUrl || !apiKey) {
    throw new Error("Bot integration secrets are not configured in this function's environment.");
  }
  
  const endpoint = new URL('/api/notify', botUrl);
  const botResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  const responseData = await botResponse.json().catch(() => ({}));

  if (!botResponse.ok) {
    throw new Error(`Bot API failed with status ${botResponse.status}: ${responseData.error || responseData.details || 'No details from bot.'}`);
  }

  return responseData;
}
