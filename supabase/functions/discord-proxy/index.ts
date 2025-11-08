// supabase/functions/discord-proxy/index.ts
// FIX: Update the Supabase function type reference to a versioned URL to ensure it can be found.
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

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
  // FIX: Cast Deno to `any` to avoid type errors in non-Deno environments.
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
    // FIX: Cast Deno to `any` to avoid type errors in non-Deno environments.
    const supabaseUrl = (Deno as any).env.get('SUPABASE_URL');
    // FIX: Cast Deno to `any` to avoid type errors in non-Deno environments.
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
        // FIX: Cast Deno to `any` to avoid type errors in non-Deno environments.
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
        'notification_submission_receipt_title': "تم استلام تقديمك بنجاح! ✅",
        'notification_submission_receipt_body': "أهلاً {username},\n\nلقد استلمنا بنجاح تقديمك لوظيفة **{quizTitle}**. سيقوم فريقنا بمراجعته في أقرب وقت ممكن.",
        'notification_submission_accepted_title': "تهانينا! تم قبول تقديمك! 🎉",
        'notification_submission_accepted_body': "أهلاً {username},\n\nأخبار رائعة! بعد المراجعة، تم **قبول** تقديمك لوظيفة **{quizTitle}** من قبل {adminUsername}.\n\nالسبب: {reason}",
        'notification_submission_refused_title': "تحديث بخصوص تقديمك",
        'notification_submission_refused_body': "أهلاً {username},\n\nشكراً لاهتمامك والوقت الذي قضيته في التقديم لوظيفة **{quizTitle}**. بعد المراجعة الدقيقة من قبل {adminUsername}، قررنا عدم المتابعة في طلبك في الوقت الحالي.\n\nالسبب: {reason}"
    };

    const t = (key: string, lang = 'ar') => {
        const dbTranslation = (translations as any[]).find(tr => tr.key === key);
        if (dbTranslation && dbTranslation[lang]) return dbTranslation[lang];
        if (dbTranslation && dbTranslation['en']) return dbTranslation['en'];
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
                author: { name: "تم استلام تقديم جديد", icon_url: "https://i.imgur.com/gJt1kUD.png" },
                description: `تقديم من **${username}** لوظيفة **${quizTitle}** في انتظار المراجعة.`,
                color: COLORS.PRIMARY,
                fields: [
                    { name: "المتقدم", value: username, inline: true },
                    { name: "نوع التقديم", value: quizTitle, inline: true },
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
        let title = `سجل التدقيق: ${log.log_type.charAt(0).toUpperCase() + log.log_type.slice(1)}`;

        switch(log.log_type) {
            case 'submissions':
                channelId = config.log_channel_submissions;
                mentionRoleId = config.mention_role_audit_log_submissions;
                color = COLORS.INFO;
                title = "تحديث حالة تقديم";
                break;
            case 'bans':
                channelId = config.log_channel_bans;
                mentionRoleId = config.mention_role_audit_log_bans;
                color = COLORS.ERROR;
                title = "إجراء إشرافي على مستخدم";
                break;
            case 'admin':
                channelId = config.log_channel_admin;
                mentionRoleId = config.mention_role_audit_log_admin;
                color = COLORS.WARNING;
                title = "إجراء في لوحة التحكم";
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
          fields: [ { name: "الإجراء بواسطة", value: log.admin_username, inline: true } ],
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
            title: t('notification_submission_receipt_title'),
            description: t('notification_submission_receipt_body').replace('{username}', submission.username).replace('{quizTitle}', submission.quizTitle),
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

        const replacements = { username: submission.username, quizTitle: submission.quizTitle, adminUsername: submission.adminUsername || 'الإدارة', reason: submission.reason || 'لا يوجد سبب.' };

        const embed = {
            title: t(`notification_${messageType}_title`),
            description: t(`notification_${messageType}_body`)
                .replace(/{username}/g, replacements.username)
                .replace(/{quizTitle}/g, replacements.quizTitle)
                .replace(/{adminUsername}/g, replacements.adminUsername)
                .replace(/{reason}/g, replacements.reason),
            color: isAccepted ? COLORS.SUCCESS : COLORS.ERROR,
            footer,
            timestamp: new Date().toISOString()
        };
        const dmChannel = await discordApi.post('/users/@me/channels', { recipient_id: profile.discord_id }) as { id: string };
        await discordApi.post(`/channels/${dmChannel.id}/messages`, { embeds: [embed] });
        console.log(`[discord-proxy] Sent 'submission_result' DM to user ${profile.discord_id}.`);
        break;
      }

      // --- NEW TEST CASES ---
      case 'test_new_submission':
      case 'test_submission_result':
      case 'test_audit_log_submissions':
      case 'test_audit_log_bans':
      case 'test_audit_log_admin':
      case 'test_audit_log_general':
        {
          const { targetId } = payload;
          if (!targetId) throw new Error("Missing 'targetId' for test notification.");
          
          let embed: any;
          const isUserDm = type === 'test_submission_result';

          const commonFields = [
            { name: "المشرف", value: "مشرف تجريبي", inline: true },
            { name: "المستخدم", value: "مستخدم تجريبي", inline: true },
          ];

          switch (type) {
            case 'test_new_submission':
              embed = {
                author: { name: "اختبار: تم استلام تقديم جديد", icon_url: "https://i.imgur.com/gJt1kUD.png" },
                description: `هذا إشعار تجريبي لوصول تقديم جديد من **مستخدم تجريبي** لوظيفة **تقديم تجريبي**.`,
                color: COLORS.PRIMARY,
                fields: [{ name: "التقديم", value: "تقديم تجريبي", inline: true }],
              };
              break;
            case 'test_submission_result':
              embed = {
                title: `اختبار: ${t('notification_submission_accepted_title')}`,
                description: t('notification_submission_accepted_body').replace('{username}', 'مستخدم تجريبي').replace('{quizTitle}', 'تقديم تجريبي').replace('{adminUsername}', 'مشرف تجريبي').replace('{reason}', 'هذا سبب تجريبي.'),
                color: COLORS.SUCCESS,
              };
              break;
            case 'test_audit_log_submissions':
              embed = { title: "اختبار: سجل التقديمات", description: "تم تحديث حالة تقديم **مستخدم تجريبي** إلى **مقبول**.", color: COLORS.INFO, fields: commonFields };
              break;
            case 'test_audit_log_bans':
              embed = { title: "اختبار: سجل الحظر", description: "تم حظر المستخدم **مستخدم تجريبي**. السبب: حظر تجريبي.", color: COLORS.ERROR, fields: commonFields };
              break;
            case 'test_audit_log_admin':
              embed = { title: "اختبار: سجل الإدارة", description: "تم تحديث إعدادات النظام.", color: COLORS.WARNING, fields: commonFields };
              break;
             case 'test_audit_log_general':
              embed = { title: "اختبار: السجل العام", description: "هذا إدخال سجل تجريبي عام.", color: COLORS.ADMIN, fields: commonFields };
              break;
          }

          embed.footer = footer;
          embed.timestamp = new Date().toISOString();
          
          let endpoint: string;
          if (isUserDm) {
             console.log(`[discord-proxy] Sending test DM to user ${targetId}.`);
             const dmChannel = await discordApi.post('/users/@me/channels', { recipient_id: targetId }) as { id: string };
             endpoint = `/channels/${dmChannel.id}/messages`;
          } else {
             console.log(`[discord-proxy] Sending test message to channel ${targetId}.`);
             endpoint = `/channels/${targetId}/messages`;
          }

          await discordApi.post(endpoint, { embeds: [embed] });
          console.log(`[discord-proxy] Successfully sent test notification for type '${type}'.`);
          break;
        }

      default:
        throw new Error(`Unknown notification type: '${type}'`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[CRITICAL] discord-proxy:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: `Function error: ${message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})