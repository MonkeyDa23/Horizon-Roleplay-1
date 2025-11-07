// FIX: Add Deno types reference to resolve "Cannot find name 'Deno'" errors.
/// <reference types="https://deno.land/x/deno/cli/types/deno.d.ts" />

// supabase/functions/discord-proxy/index.ts
// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This function now acts as the entire "bot brain" for notifications.
// It receives a payload from a database trigger, fetches necessary config (like webhook URLs),
// and then uses the bot token to communicate directly with the Discord API.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Create a new Supabase client with the service role key to bypass RLS
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
    console.error(
      `Discord API Error (${response.status}) on ${endpoint}:`,
      errorBody
    );
    throw new Error(
      `Discord API failed with status ${response.status}: ${
        errorBody.message || "Unknown error"
      }`
    );
  }
  return response.json();
};

const sendDM = async (userId: string, embed: object) => {
  try {
    const channel = await discordApi(`/users/@me/channels`, {
      recipient_id: userId,
    });
    return await discordApi(`/channels/${channel.id}/messages`, {
      embeds: [embed],
    });
  } catch (error) {
    console.error(`Failed to send DM to user ${userId}:`, error.message);
    // Do not re-throw, as failing to DM should not fail the entire process.
  }
};

const executeWebhook = async (url: string, payload: object) => {
  if (!url || !url.startsWith("https://discord.com/api/webhooks/")) {
    console.warn("Invalid or missing webhook URL provided.");
    return;
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    console.error(
      `Failed to execute webhook. Status: ${response.status}`,
      await response.text()
    );
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { type, payload } = await req.json();

    // Fetch all config in one go
    const { data: config, error: configError } = await supabaseAdmin
      .from("config")
      .select("*")
      .single();
    if (configError) throw new Error(`DB Error: ${configError.message}`);

    const { data: translations, error: transError } = await supabaseAdmin
      .from("translations")
      .select("key, en");
    if (transError) throw new Error(`DB Error: ${transError.message}`);

    const t = (key: string, replacements: Record<string, string> = {}) => {
      let text = translations?.find((tr) => tr.key === key)?.en || key;
      for (const [placeholder, value] of Object.entries(replacements)) {
        text = text.replace(new RegExp(`{${placeholder}}`, "g"), value);
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
        const content = config.mention_role_submissions
          ? `<@&${config.mention_role_submissions}>`
          : "";
        await executeWebhook(config.submissions_webhook_url, {
          content,
          embeds: [embed],
        });
        break;
      }
      case "submission_receipt":
      case "submission_result": {
        const { userId, embed: embedInfo } = payload;
        const embed = {
          title: t(embedInfo.titleKey, embedInfo.replacements),
          description: t(embedInfo.bodyKey, embedInfo.replacements),
          color: 3447003,
          timestamp: new Date().toISOString(),
        };
        await sendDM(userId, embed);
        break;
      }
      case "audit_log": {
        const webhookUrl =
          config[`log_webhook_${payload.log_type}`] ||
          config.audit_log_webhook_url;
        const roleId =
          config[`mention_role_audit_log_${payload.log_type}`] ||
          config.mention_role_audit_log_general;
        const content = roleId ? `<@&${roleId}>` : "";
        const embed = {
          title: `Audit Log: ${
            payload.log_type.charAt(0).toUpperCase() + payload.log_type.slice(1)
          }`,
          description: payload.action,
          color: 15105570, // Orange
          footer: { text: `Admin: ${payload.adminUsername}` },
          timestamp: payload.timestamp,
        };
        await executeWebhook(webhookUrl, { content, embeds: [embed] });
        break;
      }
      default:
        console.warn(`Unknown notification type received: ${type}`);
    }

    return createResponse({ success: true, message: "Notification processed." });
  } catch (error) {
    console.error(
      `[CRITICAL] discord-proxy: ${error.message}`,
      error.stack
    );
    return createResponse(
      { error: `An unexpected error occurred: ${error.message}` },
      500
    );
  }
});