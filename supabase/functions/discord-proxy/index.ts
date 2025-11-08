// supabase/functions/discord-proxy/index.ts
// FIX: Update the Supabase function type reference to a valid path.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

const COLORS = {
  INFO: 0x00B2FF, // Blue
  SUCCESS: 0x22C55E, // Green
  WARNING: 0xF59E0B, // Amber
  ERROR: 0xEF4444, // Red
  PRIMARY: 0x00F2EA, // Cyan
  ADMIN: 0x808080, // Gray
};

const DISCORD_API_BASE = 'https://discord.com/api/v10';

async function makeDiscordRequest(endpoint: string, options: RequestInit = {}) {
  // FIX: Cast Deno to `any` to avoid type errors in some environments.
  const BOT_TOKEN = (Deno as any).env.get('DISCORD_BOT_TOKEN');
  if (!BOT_TOKEN) {
    throw new Error("DISCORD_BOT_TOKEN is not configured in function secrets.");
  }

  const response = await fetch(`${DISCORD_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    // FIX: Safely parse error body and cast to access message property.
    const errorBody = await response.json().catch(() => ({ message: 'Failed to parse error body' })) as { message?: string };
    console.error(`Discord API Error on ${options.method || 'GET'} ${endpoint}: ${response.status}`, errorBody);
    const error = new Error(`Discord API Error: ${errorBody.message || response.statusText}`);
    (error as any).status = response.status;
    (error as any).response = response;
    throw error;
  }
  
  return response.status === 204 ? null : response.json();
}

const discordApi = {
  post: (endpoint: string, body: any) => makeDiscordRequest(endpoint, { method: 'POST', body: JSON.stringify(body) }),
};

serve(async (req) => {
  console.log(`[discord-proxy] Received ${req.method} request.`);

  const createAdminClient = () => {
    // FIX: Cast Deno to `any` to avoid type errors in some environments.
    const supabaseUrl = (Deno as any).env.get('SUPABASE_URL');
    const serviceRoleKey = (Deno as any).env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase URL or Service Role Key is not configured.');
    return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, payload } = await req.json();
    if (!type || !payload) throw new Error("Missing 'type' or 'payload'.");
    console.log(`[discord-proxy] Processing notification type: '${type}'`);

    const supabaseAdmin = createAdminClient();
    
    // Security check for internal DB triggers
    if (type === 'audit_log') {
        const internalSecretHeader = req.headers.get('X-Internal-Secret');
        // FIX: Cast Deno to `any` to avoid type errors in some environments.
        const PROXY_SECRET = (Deno as any).env.get('DISCORD_PROXY_SECRET');
        if (!PROXY_SECRET || internalSecretHeader !== PROXY_SECRET) {
            console.error("[discord-proxy] Unauthorized internal call attempt.");
            return new Response(JSON.stringify({ error: "Unauthorized." }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        }
    }

    const { data: config, error: configError } = await supabaseAdmin.rpc('get_config');
    if (configError) throw new Error(`Failed to fetch config: ${configError.message}`);
    const { data: translations, error: transError } = await supabaseAdmin.from('translations').select('key, en, ar');
    if (transError) throw new Error(`Failed to fetch translations: ${transError.message}`);
    
    const t_fallback: { [key: string]: string } = {
        'notification_submission_receipt_title': "Application Submitted Successfully! ✅",
        'notification_submission_receipt_body': "Hey {username},\n\nWe have successfully received your application for **{quizTitle}**. Our team will review it as soon as possible.",
        'notification_submission_accepted_title': "Congratulations! Your Application was Accepted! 🎉",
        'notification_submission_accepted_body': "Hey {username},\n\nGreat news! Your application for **{quizTitle}** has been reviewed and **accepted** by {adminUsername}.\n\nReason: {reason}",
        'notification_submission_refused_title': "Update on Your Application",
        'notification_submission_refused_body': "Hey {username},\n\nThank you for your interest in **{quizTitle}**. After careful review by {adminUsername}, we have decided not to move forward with your application at this time.\n\nReason: {reason}"
    };

    const t = (key: string, lang = 'en') => {
        const dbTranslation = (translations as any[]).find(tr => tr.key === key);
        if (dbTranslation && dbTranslation[lang]) return dbTranslation[lang];
        if (dbTranslation && dbTranslation[lang === 'en' ? 'ar' : 'en']) return dbTranslation[lang === 'en' ? 'ar' : 'en'];
        return t_fallback[key] || key;
    }
    
    const footer = { text: config.COMMUNITY_NAME, icon_url: config.LOGO_URL };

    switch (type) {
      case 'audit_log': {
        const log = payload; // payload is the audit_log row

        // --- SPECIAL CASE: New Submission Notification ---
        if (log.log_type === 'submissions' && log.action.startsWith('New submission by')) {
            const channelId = config.submissions_channel_id;
            const mentionRoleId = config.mention_role_submissions;
            
            if (!channelId) {
                console.warn(`[discord-proxy] No 'submissions_channel_id' configured, skipping new submission notification.`);
                break;
            }

            const matches = log.action.match(/New submission by (.*) for (.*)\./);
            const username = matches ? matches[1] : log.admin_username;
            const quizTitle = matches ? matches[2] : 'Unknown Quiz';

            const embed = {
                author: { name: "New Application Received", icon_url: "https://i.imgur.com/gJt1kUD.png" },
                description: `An application from **${username}** for **${quizTitle}** is awaiting review.`,
                color: COLORS.PRIMARY,
                fields: [
                    { name: "Applicant", value: username, inline: true },
                    { name: "Application Type", value: quizTitle, inline: true },
                ],
                footer,
                timestamp: new Date(log.timestamp).toISOString(),
            };

            const content = mentionRoleId ? `<@&${mentionRoleId}>` : '';
            await discordApi.post(`/channels/${channelId}/messages`, { content, embeds: [embed] });
            console.log(`[discord-proxy] Sent 'new_submission' notification to channel ${channelId}.`);
            break; // Exit after handling this special case
        }
        
        // --- REGULAR Audit Log Flow ---
        let channelId: string | null = null;
        let mentionRoleId: string | null = null;
        let color = COLORS.ADMIN;
        let title = `Audit Log: ${log.log_type.charAt(0).toUpperCase() + log.log_type.slice(1)}`;

        switch(log.log_type) {
            case 'submissions':
                channelId = config.log_channel_submissions;
                mentionRoleId = config.mention_role_audit_log_submissions;
                color = COLORS.INFO;
                title = "Submission Status Update";
                break;
            case 'bans':
                channelId = config.log_channel_bans;
                mentionRoleId = config.mention_role_audit_log_bans;
                color = COLORS.ERROR;
                title = "User Moderation Action";
                break;
            case 'admin':
                channelId = config.log_channel_admin;
                mentionRoleId = config.mention_role_audit_log_admin;
                color = COLORS.WARNING;
                title = "Admin Panel Action";
                break;
        }
        
        if (!channelId) channelId = config.audit_log_channel_id; // Fallback to general channel
        if (!mentionRoleId) mentionRoleId = config.mention_role_audit_log_general;

        if (!channelId) {
            console.warn(`[discord-proxy] No channel configured for log_type '${log.log_type}', skipping log notification.`);
            break;
        }
        
        const embed = {
          title: title,
          description: log.action,
          color,
          fields: [ { name: "Action By", value: log.admin_username, inline: true } ],
          footer,
          timestamp: new Date(log.timestamp).toISOString(),
        };
        const content = mentionRoleId ? `<@&${mentionRoleId}>` : '';
        await discordApi.post(`/channels/${channelId}/messages`, { content, embeds: [embed] });
        console.log(`[discord-proxy] Sent 'audit_log' notification for type '${log.log_type}' to channel ${channelId}.`);
        break;
      }
      
      case 'submission_receipt': {
         const { submission } = payload;
         const { data: profile } = await supabaseAdmin.from('profiles').select('discord_id').eq('id', submission.user_id).single();
         if (!profile) { console.warn(`[discord-proxy] Could not find profile for user_id ${submission.user_id} to send receipt.`); break; }
         
         const embed = {
            title: t('notification_submission_receipt_title', 'en'),
            description: t('notification_submission_receipt_body', 'en').replace('{username}', submission.username).replace('{quizTitle}', submission.quizTitle),
            color: COLORS.INFO,
            footer,
            timestamp: new Date().toISOString()
         };
         const dmChannel = await discordApi.post('/users/@me/channels', { recipient_id: profile.discord_id }) as { id: string };
         await discordApi.post(`/channels/${dmChannel.id}/messages`, { embeds: [embed] });
         console.log(`[discord-proxy] Sent 'submission_receipt' DM to user ${profile.discord_id}.`);
         break;
      }

      case 'submission_result': {
        const { submission } = payload;
        const isAccepted = submission.status === 'accepted';
        const messageType = isAccepted ? 'submission_accepted' : 'submission_refused';

        const { data: profile } = await supabaseAdmin.from('profiles').select('discord_id').eq('id', submission.user_id).single();
        if (!profile) { console.warn(`[discord-proxy] Could not find profile for user_id ${submission.user_id} to send result.`); break; }

        const replacements = { username: submission.username, quizTitle: submission.quizTitle, adminUsername: submission.adminUsername || 'Staff', reason: submission.reason || 'No reason provided.' };

        const embed = {
            title: t(`notification_${messageType}_title`, 'en'),
            description: t(`notification_${messageType}_body`, 'en')
                .replace('{username}', replacements.username).replace('{quizTitle}', replacements.quizTitle)
                .replace('{adminUsername}', replacements.adminUsername).replace('{reason}', replacements.reason),
            color: isAccepted ? COLORS.SUCCESS : COLORS.ERROR,
            footer,
            timestamp: new Date(submission.updatedAt).toISOString()
        };
        const dmChannel = await discordApi.post('/users/@me/channels', { recipient_id: profile.discord_id }) as { id: string };
        await discordApi.post(`/channels/${dmChannel.id}/messages`, { embeds: [embed] });
        console.log(`[discord-proxy] Sent '${messageType}' DM to user ${profile.discord_id}.`);
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
                .replace('{username}', replacements.username).replace('{quizTitle}', replacements.quizTitle)
                .replace('{adminUsername}', replacements.adminUsername).replace('{reason}', replacements.reason),
            color: COLORS.WARNING,
            footer
         };

         if (isUser) {
            const dmChannel = await discordApi.post('/users/@me/channels', { recipient_id: targetId }) as {id: string};
            await discordApi.post(`/channels/${dmChannel.id}/messages`, { embeds: [embed] });
         } else {
            await discordApi.post(`/channels/${targetId}/messages`, { embeds: [embed] });
         }
         console.log(`[discord-proxy] Sent test notification '${type}' to target ${targetId}.`);
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
    console.error(`[CRITICAL] discord-proxy:`, error);
    const errorMessage = (error as any).response 
      ? JSON.stringify(await (error as any).response.json().catch(() => 'Unreadable error response'))
      : (error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: `An unexpected error occurred: ${errorMessage}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
