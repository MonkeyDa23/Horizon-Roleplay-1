// FIX: Updated the type reference to a reliable CDN to resolve Deno runtime types.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { corsHeaders, discordApi, createAdminClient } from '../shared/index.ts';

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
    const t = (key, lang = 'en') => translations.find(tr => tr.key === key)?.[lang] || key;

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
        await discordApi.post(`/channels/${channelId}/messages`, { content, embeds: [embed] });
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
         const dmChannel = await discordApi.post('/users/@me/channels', { recipient_id: profile.discord_id });
         await discordApi.post(`/channels/${dmChannel.id}/messages`, { embeds: [embed] });
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
        const dmChannel = await discordApi.post('/users/@me/channels', { recipient_id: profile.discord_id });
        await discordApi.post(`/channels/${dmChannel.id}/messages`, { embeds: [embed] });
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
            const dmChannel = await discordApi.post('/users/@me/channels', { recipient_id: targetId });
            await discordApi.post(`/channels/${dmChannel.id}/messages`, { embeds: [embed] });
         } else {
            await discordApi.post(`/channels/${targetId}/messages`, { embeds: [embed] });
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
    const errorMessage = error.response ? JSON.stringify(await error.response.json()) : error.message;
    return new Response(JSON.stringify({ error: `An unexpected error occurred: ${errorMessage}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})