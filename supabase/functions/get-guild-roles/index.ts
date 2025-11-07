// FIX: Add Deno types reference to resolve "Cannot find name 'Deno'" errors.
/// <reference types="https://deno.land/x/deno/cli/types/deno.d.ts" />

// supabase/functions/get-guild-roles/index.ts
// @deno-types="https://esm.sh/@supabase/functions-js@2"
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const discordApi = async (endpoint: string) => {
  const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!DISCORD_BOT_TOKEN) throw new Error("Bot token is not configured.");

  const url = `https://discord.com/api/v10${endpoint}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      `Discord API Error (${response.status}): ${
        errorBody.message || "Unknown error"
      }`
    );
  }
  return response.json();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate & Authorize
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return createResponse({ error: "Authentication failed." }, 401);

    const { data: hasPerm, error: permError } = await supabaseAdmin.rpc(
      "has_permission",
      { p_user_id: user.id, p_permission_key: "admin_permissions" }
    );
    if (permError || !hasPerm) {
      return createResponse(
        { error: "You do not have permission to view guild roles." },
        403
      );
    }

    // 2. Fetch Guild ID from database config
    const { data: config, error: configError } = await supabaseAdmin
      .from("config")
      .select("DISCORD_GUILD_ID")
      .single();
    if (configError || !config?.DISCORD_GUILD_ID) {
      throw new Error("DISCORD_GUILD_ID is not configured in the database.");
    }

    // 3. Fetch roles directly from Discord API
    const roles = await discordApi(`/guilds/${config.DISCORD_GUILD_ID}/roles`);

    // 4. Sort roles by position (descending) and return
    const sortedRoles = roles.sort((a: any, b: any) => b.position - a.position);
    return createResponse(sortedRoles);

  } catch (error) {
    console.error(`[CRITICAL] get-guild-roles: ${error.message}`);
    return createResponse(
      { error: `An unexpected error occurred: ${error.message}` },
      500
    );
  }
});