// src/lib/database_schema.ts
export const DATABASE_SCHEMA = `-- Vixel Roleplay Community Hub - Database Schema
-- Version: 2.3.0 (Admin Panel & Notification Refactor)
-- This script is idempotent and can be run multiple times.

-- 1. EXTENSIONS & SCHEMA SETUP
-- =============================================
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

-- Grant usage for webhooks and functions to make outbound requests.
-- This section is corrected to work with various Supabase project configurations
-- by granting permissions to standard roles instead of the newer 'supabase_functions' role
-- which may not exist in all projects, causing the migration to fail.
-- Granting to 'postgres', 'authenticated', and 'service_role' ensures that migrations,
-- authenticated users, and server-side functions can use the necessary extensions.

-- Grant usage on schemas.
GRANT USAGE ON SCHEMA "extensions" TO "postgres", "authenticated", "service_role";
-- The pg_net extension's functions reside in the 'net' schema, which also needs permissions.
GRANT USAGE ON SCHEMA "net" TO "postgres", "authenticated", "service_role";

-- Grant execute permissions on functions within those schemas.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "extensions" TO "postgres", "authenticated", "service_role";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "net" TO "postgres", "authenticated", "service_role";


-- 2. TABLES
-- =============================================

-- Profiles table to store user-specific data, linked to auth.users
CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "discord_id" "text" UNIQUE,
    "roles" "jsonb" DEFAULT '[]'::"jsonb",
    "highest_role" "jsonb",
    "last_synced_at" timestamptz,
    "is_banned" boolean NOT NULL DEFAULT false,
    "ban_reason" "text",
    "ban_expires_at" timestamptz
);
COMMENT ON TABLE "public"."profiles" IS 'Stores user profile data synced from Discord. The "roles" column contains an array of role objects.';

-- Singleton configuration table
CREATE TABLE IF NOT EXISTS "public"."config" (
    "id" smallint PRIMARY KEY DEFAULT 1,
    "COMMUNITY_NAME" "text" NOT NULL DEFAULT 'Vixel Roleplay',
    "LOGO_URL" "text" NOT NULL DEFAULT 'https://l.top4top.io/p_356271n1v1.png',
    "BACKGROUND_IMAGE_URL" "text" DEFAULT '',
    "DISCORD_GUILD_ID" "text",
    "DISCORD_INVITE_URL" "text" DEFAULT 'https://discord.gg/your-invite',
    "MTA_SERVER_URL" "text" DEFAULT 'mtasa://your.server.ip:port',
    "SHOW_HEALTH_CHECK" boolean NOT NULL DEFAULT true,
    "SUPABASE_PROJECT_URL" "text",
    "DISCORD_PROXY_SECRET" "text",
    CONSTRAINT "config_singleton" CHECK ("id" = 1)
);
COMMENT ON TABLE "public"."config" IS 'Site-wide configuration settings.';
-- Seed config table if it's empty
INSERT INTO "public"."config" (id) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM "public"."config" WHERE id=1);

-- Remove deprecated webhook URL columns
ALTER TABLE "public"."config"
DROP COLUMN IF EXISTS "SUBMISSIONS_WEBHOOK_URL",
DROP COLUMN IF EXISTS "AUDIT_LOG_WEBHOOK_URL",
DROP COLUMN IF EXISTS "AUDIT_LOG_SUBMISSIONS_WEBHOOK_URL",
DROP COLUMN IF EXISTS "AUDIT_LOG_BANS_WEBHOOK_URL",
DROP COLUMN IF EXISTS "AUDIT_LOG_ADMIN_WEBHOOK_URL";


-- Translations table
CREATE TABLE IF NOT EXISTS "public"."translations" (
    "key" "text" PRIMARY KEY,
    "en" "text" NOT NULL,
    "ar" "text" NOT NULL
);
COMMENT ON TABLE "public"."translations" IS 'Stores key-value pairs for multilingual support.';

-- Products for the store
CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" PRIMARY KEY DEFAULT "uuid_generate_v4"(),
    "nameKey" "text" NOT NULL,
    "descriptionKey" "text" NOT NULL,
    "price" "numeric" NOT NULL DEFAULT 0,
    "imageUrl" "text"
);
COMMENT ON TABLE "public"."products" IS 'Store items available for purchase.';

-- Quizzes (application forms)
CREATE TABLE IF NOT EXISTS "public"."quizzes" (
    "id" "uuid" PRIMARY KEY DEFAULT "uuid_generate_v4"(),
    "titleKey" "text" NOT NULL,
    "descriptionKey" "text" NOT NULL,
    "questions" "jsonb" DEFAULT '[]'::"jsonb",
    "isOpen" boolean NOT NULL DEFAULT false,
    "allowedTakeRoles" "text"[],
    "logoUrl" "text",
    "bannerUrl" "text",
    "lastOpenedAt" timestamptz
);
COMMENT ON TABLE "public"."quizzes" IS 'Application forms and their questions.';

-- Submissions for quizzes
CREATE TABLE IF NOT EXISTS "public"."submissions" (
    "id" "uuid" PRIMARY KEY DEFAULT "uuid_generate_v4"(),
    "quizId" "uuid" NOT NULL REFERENCES "public"."quizzes"("id") ON DELETE CASCADE,
    "quizTitle" "text" NOT NULL,
    "user_id" "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "username" "text" NOT NULL,
    "answers" "jsonb" NOT NULL,
    "submittedAt" timestamptz NOT NULL DEFAULT "now"(),
    "status" "text" NOT NULL DEFAULT 'pending',
    "adminId" "uuid",
    "adminUsername" "text",
    "updatedAt" timestamptz,
    "cheatAttempts" "jsonb",
    "user_highest_role" "text",
    "reason" "text"
);
COMMENT ON TABLE "public"."submissions" IS 'User-submitted applications.';

-- Rule categories
CREATE TABLE IF NOT EXISTS "public"."rule_categories" (
    "id" "uuid" PRIMARY KEY DEFAULT "uuid_generate_v4"(),
    "titleKey" "text" NOT NULL,
    "position" integer NOT NULL DEFAULT 0
);
COMMENT ON TABLE "public"."rule_categories" IS 'Categories for organizing server rules.';

-- Individual rules
CREATE TABLE IF NOT EXISTS "public"."rules" (
    "id" "uuid" PRIMARY KEY DEFAULT "uuid_generate_v4"(),
    "category_id" "uuid" NOT NULL REFERENCES "public"."rule_categories"("id") ON DELETE CASCADE,
    "textKey" "text" NOT NULL
);
COMMENT ON TABLE "public"."rules" IS 'Individual server rules, grouped by category.';

-- Role permissions mapping
CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role_id" "text" PRIMARY KEY,
    "permissions" "text"[] NOT NULL DEFAULT '{}'
);
COMMENT ON TABLE "public"."role_permissions" IS 'Maps Discord role IDs to website permission keys.';

-- Audit logs for admin actions
CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" bigserial PRIMARY KEY,
    "timestamp" timestamptz NOT NULL DEFAULT "now"(),
    "admin_id" "uuid" NOT NULL REFERENCES "auth"."users"("id"),
    "admin_username" "text" NOT NULL,
    "action" "text" NOT NULL
);
COMMENT ON TABLE "public"."audit_logs" IS 'Logs actions performed by administrators.';

-- Discord widgets for the "About Us" page
CREATE TABLE IF NOT EXISTS "public"."discord_widgets" (
    "id" "uuid" PRIMARY KEY DEFAULT "uuid_generate_v4"(),
    "server_name" "text" NOT NULL,
    "server_id" "text" NOT NULL,
    "invite_url" "text" NOT NULL,
    "position" integer NOT NULL DEFAULT 0
);
COMMENT ON TABLE "public"."discord_widgets" IS 'Discord server widgets for the About Us page.';


-- 3. FUNCTIONS
-- =============================================

-- [CORRECTED] Get a user's permissions based on their roles
-- This function correctly extracts role IDs from the JSONB roles array in the profiles table.
CREATE OR REPLACE FUNCTION "public"."get_user_permissions"("p_user_id" "uuid")
RETURNS "text"[]
LANGUAGE "sql"
SECURITY DEFINER
AS $$
    SELECT COALESCE(array_agg(DISTINCT "p"), '{}'::"text"[])
    FROM (
        SELECT "unnest"("permissions") AS "p"
        FROM "public"."role_permissions"
        WHERE "role_id" = ANY(
            SELECT value ->> 'id'
            FROM jsonb_array_elements(
                (SELECT "roles" FROM "public"."profiles" WHERE "id" = "p_user_id")
            )
        )
    ) AS "user_perms";
$$;
COMMENT ON FUNCTION "public"."get_user_permissions"(uuid) IS 'Aggregates all permission keys for a user based on their roles stored in the profiles table.';

-- Check if a user has a specific permission
CREATE OR REPLACE FUNCTION "public"."has_permission"("p_user_id" "uuid", "p_permission_key" "text")
RETURNS boolean
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
    "user_permissions" "text"[];
BEGIN
    -- This function MUST be SECURITY DEFINER to be able to call get_user_permissions,
    -- which needs to read the profiles and role_permissions tables for any user.
    SELECT "public"."get_user_permissions"("p_user_id") INTO "user_permissions";
    RETURN "_super_admin" = ANY("user_permissions") OR "p_permission_key" = ANY("user_permissions");
END;
$$;
COMMENT ON FUNCTION "public"."has_permission"(uuid, text) IS 'Checks if a user has a specific permission, with _super_admin granting all permissions.';

-- Function to send a notification payload to the discord-proxy edge function
CREATE OR REPLACE FUNCTION "public"."notify_discord_proxy"("payload" "jsonb")
RETURNS "void"
LANGUAGE "plpgsql"
AS $$
DECLARE
    "project_url" "text";
    "proxy_secret" "text";
    "proxy_url" "text";
BEGIN
    SELECT "SUPABASE_PROJECT_URL", "DISCORD_PROXY_SECRET"
    INTO "project_url", "proxy_secret"
    FROM "public"."config" WHERE "id" = 1;

    IF "project_url" IS NULL OR "proxy_secret" IS NULL THEN
        RAISE WARNING '[notify_discord_proxy] Discord proxy URL or secret not configured in the config table. Notification skipped.';
        RETURN;
    END IF;

    "proxy_url" := "project_url" || '/functions/v1/discord-proxy';

    PERFORM "net"."http_post"(
        "url" := "proxy_url",
        "headers" := "jsonb_build_object"(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || "proxy_secret"
        ),
        "body" := "payload",
        "timeout_milliseconds" := 5000
    );
END;
$$;
COMMENT ON FUNCTION "public"."notify_discord_proxy"(jsonb) IS 'Makes an authenticated POST request to the discord-proxy edge function to send notifications.';

-- Trigger function to handle submission notifications
CREATE OR REPLACE FUNCTION "public"."handle_submission_notification"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Notify admins of new submission
        PERFORM "public"."notify_discord_proxy"("jsonb_build_object"('type', 'new_submission', 'payload', jsonb_build_object('quizTitle', NEW."quizTitle", 'username', NEW."username", 'userHighestRole', NEW."user_highest_role")));
        -- Send receipt DM to user
        PERFORM "public"."notify_discord_proxy"("jsonb_build_object"('type', 'submission_receipt', 'payload', jsonb_build_object('userId', NEW."user_id", 'quizTitle', NEW."quizTitle", 'username', NEW."username")));
    ELSIF TG_OP = 'UPDATE' AND OLD."status" <> NEW."status" THEN
        -- Notify user of status change
        PERFORM "public"."notify_discord_proxy"("jsonb_build_object"('type', 'submission_result', 'payload', jsonb_build_object('userId', NEW."user_id", 'quizTitle', NEW."quizTitle", 'username', NEW."username", 'status', NEW."status", 'adminUsername', NEW."adminUsername")));
    END IF;
    RETURN NEW;
END;
$$;
COMMENT ON FUNCTION "public"."handle_submission_notification"() IS 'Constructs and sends notification payloads when a submission is created or its status changes.';

-- Function for health check to test http extension
CREATE OR REPLACE FUNCTION "public"."test_http_request"()
RETURNS "jsonb"
LANGUAGE "plpgsql"
AS $$
DECLARE
  "response" "extensions"."http_response";
BEGIN
  SELECT *
  INTO "response"
  FROM "extensions"."http_get"('http://worldtimeapi.org/api/ip');

  RETURN "jsonb_build_object"('status', "response"."status", 'data', "response"."content"::"jsonb");
EXCEPTION
  WHEN OTHERS THEN
    RETURN "jsonb_build_object"('status', 500, 'error', SQLERRM);
END;
$$;
COMMENT ON FUNCTION "public"."test_http_request"() IS 'A simple function for the Health Check page to verify that the http extension is enabled and working.';


-- Trigger function to log various admin actions
CREATE OR REPLACE FUNCTION "public"."log_admin_actions"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
    "user_id" "uuid" := "auth"."uid"();
    "user_name" "text" := COALESCE((SELECT "raw_user_meta_data" ->> 'global_name' FROM "auth"."users" WHERE "id" = "user_id"), 'Unknown Admin');
    "action_text" "text";
BEGIN
    IF TG_TABLE_NAME = 'quizzes' THEN
        IF TG_OP = 'INSERT' THEN "action_text" := 'Created quiz: ' || NEW."titleKey";
        ELSIF TG_OP = 'UPDATE' THEN "action_text" := 'Updated quiz: ' || NEW."titleKey";
        ELSIF TG_OP = 'DELETE' THEN "action_text" := 'Deleted quiz: ' || OLD."titleKey";
        END IF;
    ELSIF TG_TABLE_NAME = 'products' THEN
        IF TG_OP = 'INSERT' THEN "action_text" := 'Created product: ' || NEW."nameKey";
        ELSIF TG_OP = 'UPDATE' THEN "action_text" := 'Updated product: ' || NEW."nameKey";
        ELSIF TG_OP = 'DELETE' THEN "action_text" := 'Deleted product: ' || OLD."nameKey";
        END IF;
    ELSIF TG_TABLE_NAME = 'submissions' AND TG_OP = 'UPDATE' THEN
        "action_text" := 'Updated submission status for ' || NEW."username" || ' to ' || UPPER(NEW."status");
    ELSIF TG_TABLE_NAME = 'profiles' AND TG_OP = 'UPDATE' THEN
        IF OLD."is_banned" != NEW."is_banned" THEN
           "action_text" := CASE WHEN NEW."is_banned" THEN 'BANNED' ELSE 'UNBANNED' END || ' user with Discord ID: ' || NEW."discord_id";
        END IF;
    END IF;

    IF "action_text" IS NOT NULL THEN
        INSERT INTO "public"."audit_logs"("admin_id", "admin_username", "action")
        VALUES ("user_id", "user_name", "action_text");
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;
COMMENT ON FUNCTION "public"."log_admin_actions"() IS 'A generic trigger function that logs various changes made by admins to the audit_logs table.';


-- 4. TRIGGERS
-- =============================================

-- Drop existing triggers to prevent duplicates and ensure the latest logic is applied
DROP TRIGGER IF EXISTS "on_submission_change_notify" ON "public"."submissions";
DROP TRIGGER IF EXISTS "log_quizzes_changes" ON "public"."quizzes";
DROP TRIGGER IF EXISTS "log_products_changes" ON "public"."products";
DROP TRIGGER IF EXISTS "log_submissions_status_changes" ON "public"."submissions";
DROP TRIGGER IF EXISTS "log_profile_ban_changes" ON "public"."profiles";

-- Create trigger for submission notifications
CREATE TRIGGER "on_submission_change_notify"
AFTER INSERT OR UPDATE OF "status" ON "public"."submissions"
FOR EACH ROW
EXECUTE FUNCTION "public"."handle_submission_notification"();

-- Create triggers for audit logging
CREATE TRIGGER "log_quizzes_changes" AFTER INSERT OR UPDATE OR DELETE ON "public"."quizzes" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();
CREATE TRIGGER "log_products_changes" AFTER INSERT OR UPDATE OR DELETE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();
CREATE TRIGGER "log_submissions_status_changes" AFTER UPDATE OF "status" ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();
CREATE TRIGGER "log_profile_ban_changes" AFTER UPDATE OF "is_banned" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();


-- 5. ROW LEVEL SECURITY (RLS)
-- =============================================
-- Enable RLS on all tables
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."translations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."quizzes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rule_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."discord_widgets" ENABLE ROW LEVEL SECURITY;

-- Clear old policies to ensure a clean slate
DROP POLICY IF EXISTS "Allow users to see their own profile" ON "public"."profiles";
DROP POLICY IF EXISTS "Allow admins to see all profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "Allow public read access" ON "public"."config";
DROP POLICY IF EXISTS "Allow public read access" ON "public"."translations";
DROP POLICY IF EXISTS "Allow public read access" ON "public"."products";
DROP POLICY IF EXISTS "Allow public read access" ON "public"."quizzes";
DROP POLICY IF EXISTS "Allow public read access" ON "public"."rule_categories";
DROP POLICY IF EXISTS "Allow public read access" ON "public"."rules";
DROP POLICY IF EXISTS "Allow public read access" ON "public"."discord_widgets";
DROP POLICY IF EXISTS "Allow users to create submissions" ON "public"."submissions";
DROP POLICY IF EXISTS "Allow users to see their own submissions" ON "public"."submissions";
DROP POLICY IF EXISTS "Allow admins to manage submissions" ON "public"."submissions";
DROP POLICY IF EXISTS "Allow admins full access" ON "public"."role_permissions";
DROP POLICY IF EXISTS "Allow admins full access" ON "public"."audit_logs";
DROP POLICY IF EXISTS "Allow admins to manage config" ON "public"."config";
DROP POLICY IF EXISTS "Allow admins to manage translations" ON "public"."translations";
DROP POLICY IF EXISTS "Allow admins to manage products" ON "public"."products";
DROP POLICY IF EXISTS "Allow admins to manage quizzes" ON "public"."quizzes";
DROP POLICY IF EXISTS "Allow admins to manage rules" ON "public"."rules";
DROP POLICY IF EXISTS "Allow admins to manage rule categories" ON "public"."rule_categories";
DROP POLICY IF EXISTS "Allow admins to manage widgets" ON "public"."discord_widgets";


-- Create policies for profiles
CREATE POLICY "Allow users to see their own profile" ON "public"."profiles" FOR SELECT USING ("auth"."uid"() = "id");
CREATE POLICY "Allow admins to see all profiles" ON "public"."profiles" FOR SELECT USING ("public"."has_permission"("auth"."uid"(), 'admin_lookup'));

-- Create policies for public read tables
CREATE POLICY "Allow public read access" ON "public"."config" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."translations" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."products" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."quizzes" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."rule_categories" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."rules" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."discord_widgets" FOR SELECT USING (true);

-- Create policies for submissions
CREATE POLICY "Allow users to create submissions" ON "public"."submissions" FOR INSERT WITH CHECK ("auth"."uid"() = "user_id");
CREATE POLICY "Allow users to see their own submissions" ON "public"."submissions" FOR SELECT USING ("auth"."uid"() = "user_id");
CREATE POLICY "Allow admins to manage submissions" ON "public"."submissions" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_submissions'));

-- Create policies for admin-only tables
CREATE POLICY "Allow admins full access" ON "public"."role_permissions" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_permissions'));
CREATE POLICY "Allow admins full access" ON "public"."audit_logs" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_audit_log'));
CREATE POLICY "Allow admins to manage config" ON "public"."config" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_appearance'));
CREATE POLICY "Allow admins to manage translations" ON "public"."translations" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_translations'));
CREATE POLICY "Allow admins to manage products" ON "public"."products" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_store'));
CREATE POLICY "Allow admins to manage quizzes" ON "public"."quizzes" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_quizzes'));
CREATE POLICY "Allow admins to manage rules" ON "public"."rules" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_rules'));
CREATE POLICY "Allow admins to manage rule categories" ON "public"."rule_categories" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_rules'));
CREATE POLICY "Allow admins to manage widgets" ON "public"."discord_widgets" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_widgets'));
`;
