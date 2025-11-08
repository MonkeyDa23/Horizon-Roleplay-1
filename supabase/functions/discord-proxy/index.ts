
// FIX: Updated the Edge Function type reference to resolve Deno runtime types.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// This file is bundled for standalone deployment.
// --- Start of inlined shared code ---
// FIX: Updated the type reference to a reliable CDN to resolve Deno runtime types.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { REST } from "https://esm.sh/@discordjs/rest@2.2.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
if (!BOT_TOKEN) {
  throw new Error("DISCORD_BOT_TOKEN is not configured in function secrets.");
}
const discordApi = new REST({
  token: BOT_TOKEN,
  version: "10",
});

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase URL or Service Role Key is not configured in function secrets.');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};
// --- End of inlined shared code ---


// Original function code for discord-proxy
const COLORS = {
  INFO: 0x00B2FF, // Blue
  SUCCESS: 0x22C55E, // Green
  WARNING: 0xF59E0B, // Amber
  ERROR: 0xEF4444, // Red
  PRIMARY: 0x00F2EA  // Cyan
};

// Main handler for all Discord-bound messages
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, payload } = await req.json();
    if (!type || !payload) throw new Error("Missing 'type' or 'payload'.");

    const supabaseAdmin = createAdminClient();

    // 1. Fetch config and translations
    const { data: config, error: configError } = await supabaseAdmin.rpc('get_config');
    if (configError) throw new Error(`Failed to fetch config: ${configError.message}`);
    
    const { data: translations, error: transError } = await supabaseAdmin.from('translations').select('key, en, ar');
    if (transError) throw new Error(`Failed to fetch translations: ${transError.message}`);
    const t = (key: string, lang = 'en') => (translations as any[]).find(tr => tr.key === key)?.[lang] || key;

    // 2. Process based on notification type
    switch (type) {
      case 'new_submission': {
        const { submission } = payload;
        const channelId = config.submissions_channel_id;
        if (!channelId) return new Response(JSON.stringify({ warning: "submissions_channel_id not set, skipping notification." }));
        
        const embed = {
          title: `New Application: ${submission.quizTitle}`,
          description: `A new application has been submitted by **${submission.username}**.`,
          color: COLORS.PRIMARY,
          fields: [
            { name: "Applicant", value: submission.username, inline: true },
            { name: "Application Type", value: submission.quizTitle, inline: true },
            { name: "Highest Role", value: submission.user_highest_role || "Member", inline: true },
          ],
          timestamp: new Date(submission.submittedAt).toISOString()
        };
        const content = config.mention_role_submissions ? `<@&${config.mention_role_submissions}>` : '';
        await discordApi.post(`/channels/${channelId}/messages`, { body: { content, embeds: [embed] } });
        break;
      }
      
      case 'submission_receipt': {
         const { submission } = payload;
         const { data: profile } = await supabaseAdmin.from('profiles').select('discord_id').eq('id', submission.user_id).single();
         if (!profile) break; // User not found, can't DM
         
         const embed = {
            title: t('notification_submission_receipt_title', 'en'),
            description: t('notification_submission_receipt_body', 'en').replace('{username}', submission.username).replace('{quizTitle}', submission.quizTitle),
            color: COLORS.INFO,
            timestamp: new Date().toISOString()
         };
         const dmChannel = await discordApi.post('/users/@me/channels', { body: { recipient_id: profile.discord_id } }) as { id: string };
         await discordApi.post(`/channels/${dmChannel.id}/messages`, { body: { embeds: [embed] } });
         break;
      }

      case 'submission_result': {
        const { submission } = payload;
        const isAccepted = submission.status === 'accepted';
        const messageType = isAccepted ? 'submission_accepted' : 'submission_refused';

        const { data: profile } = await supabaseAdmin.from('profiles').select('discord_id').eq('id', submission.user_id).single();
        if (!profile) break;

        const replacements = {
            username: submission.username,
            quizTitle: submission.quizTitle,
            adminUsername: submission.adminUsername || 'Staff',
            reason: submission.reason || 'No reason provided.'
        };

        const embed = {
            title: t(`notification_${messageType}_title`, 'en'),
            description: t(`notification_${messageType}_body`, 'en')
                .replace('{username}', replacements.username)
                .replace('{quizTitle}', replacements.quizTitle)
                .replace('{adminUsername}', replacements.adminUsername)
                .replace('{reason}', replacements.reason),
            color: isAccepted ? COLORS.SUCCESS : COLORS.ERROR,
            timestamp: new Date(submission.updatedAt).toISOString()
        };
        const dmChannel = await discordApi.post('/users/@me/channels', { body: { recipient_id: profile.discord_id } }) as { id: string };
        await discordApi.post(`/channels/${dmChannel.id}/messages`, { body: { embeds: [embed] } });
        break;
      }

      case 'test_submission_receipt':
      case 'test_submission_accepted':
      case 'test_submission_refused': {
         const messageType = type.replace('test_', '');
         const isUser = ['submission_receipt', 'submission_accepted', 'submission_refused'].includes(messageType);
         const targetId = payload.targetId;
         
         const replacements = { username: "TestUser", quizTitle: "Sample Application", adminUsername: "Admin", reason: "This is a test reason." };

         const embed = {
            title: `[TEST] ${t(`notification_${messageType}_title`, 'en')}`,
            description: t(`notification_${messageType}_body`, 'en')
                .replace('{username}', replacements.username)
                .replace('{quizTitle}', replacements.quizTitle)
                .replace('{adminUsername}', replacements.adminUsername)
                .replace('{reason}', replacements.reason),
            color: COLORS.WARNING
         };

         if (isUser) {
            const dmChannel = await discordApi.post('/users/@me/channels', { body: { recipient_id: targetId } }) as {id: string};
            await discordApi.post(`/channels/${dmChannel.id}/messages`, { body: { embeds: [embed] } });
         } else {
            await discordApi.post(`/channels/${targetId}/messages`, { body: { embeds: [embed] } });
         }
         break;
      }

      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    return new Response(JSON.stringify({ success: true, message: `Notification '${type}' processed.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error(`[CRITICAL] discord-proxy: ${error.message}`);
    const errorMessage = error.response ? JSON.stringify(await (error.response as any).json()) : error.message;
    return new Response(JSON.stringify({ error: `An unexpected error occurred: ${errorMessage}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
