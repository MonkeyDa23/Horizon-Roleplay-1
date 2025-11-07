// FIX: Replaced invalid Deno types reference with a valid one for Supabase edge functions.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// supabase/functions/discord-proxy/index.ts
// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const createResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
};

const discordApi = async (endpoint: string, body?: object) => {
  const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!DISCORD_BOT_TOKEN) {
    console.error("[FATAL] DISCORD_BOT_TOKEN is not set.");
    throw new Error("Bot token is not configured.");
  }

  const url = `https://discord.com/api/v10${endpoint}`;
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      "Authorization": `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error(`Discord API Error (${response.status}) on ${endpoint}:`, errorBody);
    throw new Error(`Discord API failed with status ${response.status}: ${errorBody.message || "Unknown error"}`);
  }
  // For POST requests that succeed with 204 No Content, there's no body to parse.
  if (response.status === 204) return null;
  return response.json();
};

const sendMessageToChannel = async (channelId: string, payload: object) => {
    if (!channelId) {
        console.warn("sendMessageToChannel called with no channelId.");
        return;
    }
    return await discordApi(`/channels/${channelId}/messages`, payload);
};

const sendDM = async (userId: string, embed: object) => {
  try {
    const channel = await discordApi(`/users/@me/channels`, { recipient_id: userId });
    await sendMessageToChannel(channel.id, { embeds: [embed] });
  } catch (error) {
    console.error(`Failed to send DM to user ${userId}:`, error.message);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { type, payload } = await req.json();

    const { data: config, error: configError } = await supabaseAdmin.from("config").select("*").single();
    if (configError) throw new Error(`DB Error: ${configError.message}`);

    const { data: translations, error: transError } = await supabaseAdmin.from("translations").select("key, en");
    if (transError) throw new Error(`DB Error: ${transError.message}`);

    const t = (key: string, replacements: Record<string, string> = {}) => {
      let text = translations?.find((tr) => tr.key === key)?.en || key;
      for (const [placeholder, value] of Object.entries(replacements)) {
        text = text.replace(new RegExp(`{${placeholder}}`, "g"), String(value));
      }
      return text;
    };

    switch (type) {
      case "new_submission": {
        const embed = {
          title: "New Application Submitted",
          color: 3447003, // Blue
          fields: [
            { name: "Applicant", value: payload.username, inline: true },
            { name: "Application Type", value: payload.quizTitle, inline: true },
            { name: "Highest Role", value: payload.userHighestRole, inline: true },
          ],
          footer: { text: `Discord ID: ${payload.discordId}` },
          timestamp: payload.submittedAt,
        };
        const content = config.mention_role_submissions ? `<@&${config.mention_role_submissions}>` : "";
        await sendMessageToChannel(config.submissions_channel_id, { content, embeds: [embed] });
        break;
      }
      case "submission_receipt":
      case "submission_result": {
        const { userId, embed: embedInfo } = payload;
        const embed = {
          title: (embedInfo.isTest ? "[TEST] " : "") + t(embedInfo.titleKey, embedInfo.replacements),
          description: t(embedInfo.bodyKey, embedInfo.replacements),
          color: 3447003,
          timestamp: new Date().toISOString(),
        };
        await sendDM(userId, embed);
        break;
      }
      case "audit_log": {
        const channelId = payload.isTest ? payload.channelId : (config[`log_channel_${payload.log_type}`] || config.audit_log_channel_id);
        const roleId = config[`mention_role_audit_log_${payload.log_type}`] || config.mention_role_audit_log_general;
        
        const content = roleId ? `<@&${roleId}>` : "";
        const embed = {
          title: (payload.isTest ? "[TEST] " : "") + `Audit Log: ${payload.log_type.charAt(0).toUpperCase() + payload.log_type.slice(1)}`,
          description: payload.action,
          color: 15105570, // Orange
          footer: { text: `Admin: ${payload.adminUsername}` },
          timestamp: payload.timestamp,
        };
        await sendMessageToChannel(channelId, { content, embeds: [embed] });
        break;
      }
      default:
        console.warn(`Unknown notification type received: ${type}`);
    }

    return createResponse({ success: true, message: "Notification processed." });
  } catch (error) {
    console.error(`[CRITICAL] discord-proxy: ${error.message}`, error.stack);
    return createResponse({ error: `An unexpected error occurred: ${error.message}` }, 500);
  }
});