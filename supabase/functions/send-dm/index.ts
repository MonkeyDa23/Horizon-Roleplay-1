// supabase/functions/send-dm/index.ts
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

const COLORS = {
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

    const { type, payload } = await req.json();
    if (!type || !payload) throw new Error("Missing 'type' or 'payload'.");

    const { data: config, error: configError } = await supabaseAdmin.from('config').select('COMMUNITY_NAME, LOGO_URL').single();
    if (configError) throw configError;

    let userId: string;
    let embed: any;
    const footer = { text: config.COMMUNITY_NAME, icon_url: config.LOGO_URL };
    const timestamp = new Date().toISOString();

    switch (type) {
      case 'submission_receipt': {
        const { data: sub, error } = await supabaseAdmin.from('submissions').select('*').eq('id', payload.submissionId).single();
        if (error || !sub) throw new Error(`Submission not found: ${payload.submissionId}`);
        userId = sub.user_id;
        embed = {
          title: '✅ Your Application has been Submitted!',
          description: `Thank you, **${sub.username}**! We have successfully received your application for the **${sub.quizTitle}**.\n\nOur administration team will review it shortly. You can check the status at any time on the 'My Applications' page on our website.`,
          color: COLORS.BLUE, footer, timestamp
        };
        break;
      }
      case 'submission_accepted':
      case 'submission_refused': {
        const { data: sub, error } = await supabaseAdmin.from('submissions').select('*').eq('id', payload.submissionId).single();
        if (error || !sub) throw new Error(`Submission not found: ${payload.submissionId}`);
        userId = sub.user_id;
        if (type === 'submission_accepted') {
            embed = {
                title: '🎉 Congratulations! Your Application was Accepted!',
                description: `Great news, **${sub.username}**! Your application for the **${sub.quizTitle}** has been accepted. Please follow the next steps provided in our Discord server.`,
                color: COLORS.GREEN, fields: [{ name: 'Reviewed by', value: sub.adminUsername || 'Admin' }], footer, timestamp,
            };
        } else {
            embed = {
                title: '❌ Regarding Your Application...',
                description: `Hello, **${sub.username}**. After careful review, we regret to inform you that your application for the **${sub.quizTitle}** has been refused at this time. Thank you for your interest.`,
                color: COLORS.RED, fields: [{ name: 'Reviewed by', value: sub.adminUsername || 'Admin' }], footer, timestamp
            };
        }
        break;
      }
      case 'test_dm': {
          userId = payload.targetId;
          embed = {
              title: `📢 Test Direct Message`,
              description: `This is a test DM from the website's Admin Panel, sent by **${user.user_metadata.full_name}**. If you can see this, the bot's DM system is working correctly!`,
              color: COLORS.ORANGE, footer, timestamp
          };
          break;
      }
      default:
        throw new Error(`Unknown DM type: ${type}`);
    }

    const botResponse = await forwardToBot({ userId, embed });
    return createResponse(botResponse);

  } catch (error) {
    console.error(`[CRITICAL] send-dm: ${error.message}`);
    return createResponse({ error: `An unexpected error occurred: ${error.message}` }, 500);
  }
});

async function forwardToBot(body: { userId: string; embed: any }) {
  // @ts-ignore
  const botUrl = Deno.env.get('VITE_DISCORD_BOT_URL');
  // @ts-ignore
  const apiKey = Deno.env.get('VITE_DISCORD_BOT_API_KEY');
  if (!botUrl || !apiKey) {
    throw new Error("Bot integration secrets are not configured in this function's environment.");
  }
  
  const endpoint = new URL('/api/dm', botUrl);
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
