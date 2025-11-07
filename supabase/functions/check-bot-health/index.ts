// FIX: Replaced invalid Deno types reference with a valid one for Supabase edge functions to resolve 'Deno' not found errors.
/// <reference types="https://esm.sh/@supabase/functions-js@2/src/edge-runtime.d.ts" />

// supabase/functions/check-bot-health/index.ts

// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const createResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
};

// This function now checks the health of the Discord API connection directly,
// using the stored bot token.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");

    if (!DISCORD_BOT_TOKEN) {
      return createResponse({
        ok: false,
        message: "Configuration Error",
        details:
          "The 'DISCORD_BOT_TOKEN' secret is missing from your Supabase project settings. Please go to Settings > Edge Functions to add it.",
      }, 500);
    }

    // Make a simple request to the Discord API to verify the token is valid.
    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: {
        "Authorization": `Bot ${DISCORD_BOT_TOKEN}`,
      },
    });

    if (!response.ok) {
        let errorDetails = `The Discord API rejected the request. This almost always means your DISCORD_BOT_TOKEN is invalid or has been reset. Please verify it in your Supabase function secrets. (Status: ${response.status})`;
         return createResponse({
            ok: false,
            message: "Discord API Connection Failed",
            details: errorDetails,
        }, response.status);
    }
    
    const botData = await response.json();
    return createResponse({
      ok: true,
      message: "Successfully connected to Discord API.",
      bot: {
        username: botData.username,
        id: botData.id,
      },
    });

  } catch (error) {
    // This catches network-level errors (e.g., Supabase can't reach Discord)
    return createResponse({
      ok: false,
      message: "Network Error",
      details:
        `The Supabase function failed to reach the Discord API. This may indicate a temporary network issue with Supabase or Discord. Error: ${error.message}`,
    }, 500);
  }
});