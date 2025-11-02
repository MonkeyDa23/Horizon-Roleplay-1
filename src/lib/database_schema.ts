// src/lib/database_schema.ts
export const DATABASE_SCHEMA = `
-- Vixel Roleplay Community Hub - Database Schema
-- Version: 4.0.0 (Webhook Notification System)
-- This script is idempotent and can be run multiple times.

-- 1. EXTENSIONS & SCHEMA SETUP
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "public"; -- Required for webhooks

-- 2. TABLES
-- =============================================

-- Profiles table
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

-- Config table (MODIFIED for Webhooks)
CREATE TABLE IF NOT EXISTS "public"."config" (
    "id" smallint PRIMARY KEY DEFAULT 1,
    "COMMUNITY_NAME" "text" NOT NULL DEFAULT 'Vixel Roleplay',
    "LOGO_URL" "text" NOT NULL DEFAULT 'https://l.top4top.io/p_356271n1v1.png',
    "BACKGROUND_IMAGE_URL" "text" DEFAULT '',
    "DISCORD_GUILD_ID" "text",
    "DISCORD_INVITE_URL" "text" DEFAULT 'https://discord.gg/your-invite',
    "MTA_SERVER_URL" "text" DEFAULT 'mtasa://your.server.ip:port',
    "SHOW_HEALTH_CHECK" boolean NOT NULL DEFAULT true
);
-- Idempotent ALTER statements to switch from channel IDs to webhooks
ALTER TABLE "public"."config" DROP COLUMN IF EXISTS "SUBMISSION_NOTIFICATION_CHANNEL_ID";
ALTER TABLE "public"."config" DROP COLUMN IF EXISTS "AUDIT_LOG_NOTIFICATION_CHANNEL_ID";
ALTER TABLE "public"."config" ADD COLUMN IF NOT EXISTS "SUBMISSION_WEBHOOK_URL" "text";
ALTER TABLE "public"."config" ADD COLUMN IF NOT EXISTS "AUDIT_LOG_WEBHOOK_URL" "text";
-- Ensure the default config row exists
INSERT INTO "public"."config" (id) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM "public"."config" WHERE id=1);


-- Translations table
CREATE TABLE IF NOT EXISTS "public"."translations" (
    "key" "text" PRIMARY KEY,
    "en" "text" NOT NULL,
    "ar" "text" NOT NULL
);

-- Products for the store
CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" PRIMARY KEY DEFAULT "uuid_generate_v4"(),
    "nameKey" "text" NOT NULL,
    "descriptionKey" "text" NOT NULL,
    "price" "numeric" NOT NULL DEFAULT 0,
    "imageUrl" "text"
);

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

-- Rule categories
CREATE TABLE IF NOT EXISTS "public"."rule_categories" (
    "id" "uuid" PRIMARY KEY DEFAULT "uuid_generate_v4"(),
    "titleKey" "text" NOT NULL,
    "position" integer NOT NULL DEFAULT 0
);

-- Individual rules
CREATE TABLE IF NOT EXISTS "public"."rules" (
    "id" "uuid" PRIMARY KEY DEFAULT "uuid_generate_v4"(),
    "category_id" "uuid" NOT NULL REFERENCES "public"."rule_categories"("id") ON DELETE CASCADE,
    "textKey" "text" NOT NULL
);

-- Role permissions mapping
CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role_id" "text" PRIMARY KEY,
    "permissions" "text"[] NOT NULL DEFAULT '{}'
);

-- Audit logs for admin actions
CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" bigserial PRIMARY KEY,
    "timestamp" timestamptz NOT NULL DEFAULT "now"(),
    "admin_id" "uuid" NOT NULL REFERENCES "auth"."users"("id"),
    "admin_username" "text" NOT NULL,
    "action" "text" NOT NULL
);

-- Discord widgets for the "About Us" page
CREATE TABLE IF NOT EXISTS "public"."discord_widgets" (
    "id" "uuid" PRIMARY KEY DEFAULT "uuid_generate_v4"(),
    "server_name" "text" NOT NULL,
    "server_id" "text" NOT NULL,
    "invite_url" "text" NOT NULL,
    "position" integer NOT NULL DEFAULT 0
);


-- 3. FUNCTIONS (Webhook System)
-- =============================================

-- NEW: Function to send a payload to a webhook
CREATE OR REPLACE FUNCTION public.send_webhook(webhook_url text, payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF webhook_url IS NOT NULL AND webhook_url <> '' THEN
        PERFORM public.http_post(
            webhook_url,
            payload,
            'application/json'::text,
            '{}'::jsonb
        );
    END IF;
END;
$$;


-- NEW: Trigger function for new submissions
CREATE OR REPLACE FUNCTION public.handle_new_submission_webhook()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    config_row record;
    payload jsonb;
BEGIN
    SELECT "SUBMISSION_WEBHOOK_URL", "COMMUNITY_NAME", "LOGO_URL" INTO config_row FROM public.config WHERE id = 1;
    
    payload := jsonb_build_object(
        'embeds', jsonb_build_array(
            jsonb_build_object(
                'title', '📝 New Application Received!',
                'color', 62194, -- #00f2ea
                'fields', jsonb_build_array(
                    jsonb_build_object('name', 'Applicant', 'value', NEW.username, 'inline', true),
                    jsonb_build_object('name', 'Application Type', 'value', NEW.quizTitle, 'inline', true),
                    jsonb_build_object('name', 'Highest Role', 'value', COALESCE(NEW.user_highest_role, 'Member'), 'inline', true)
                ),
                'footer', jsonb_build_object('text', config_row.COMMUNITY_NAME, 'icon_url', config_row.LOGO_URL),
                'timestamp', to_char(NEW.submittedAt, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            )
        )
    );
    
    PERFORM public.send_webhook(config_row.SUBMISSION_WEBHOOK_URL, payload);
    RETURN NEW;
END;
$$;

-- NEW: Trigger function for new audit logs
CREATE OR REPLACE FUNCTION public.handle_new_audit_log_webhook()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    config_row record;
    payload jsonb;
BEGIN
    SELECT "AUDIT_LOG_WEBHOOK_URL", "COMMUNITY_NAME", "LOGO_URL" INTO config_row FROM public.config WHERE id = 1;

    payload := jsonb_build_object(
        'embeds', jsonb_build_array(
            jsonb_build_object(
                'title', '🛡️ Admin Action Logged',
                'color', 15105570, -- #e67e22
                'fields', jsonb_build_array(
                    jsonb_build_object('name', 'Admin', 'value', NEW.admin_username, 'inline', true),
                    jsonb_build_object('name', 'Action', 'value', NEW.action, 'inline', false)
                ),
                'footer', jsonb_build_object('text', config_row.COMMUNITY_NAME, 'icon_url', config_row.LOGO_URL),
                'timestamp', to_char(NEW.timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            )
        )
    );

    PERFORM public.send_webhook(config_row.AUDIT_LOG_WEBHOOK_URL, payload);
    RETURN NEW;
END;
$$;


-- 4. OTHER FUNCTIONS & TRIGGERS
-- =============================================

-- Get a user's permissions based on their roles
CREATE OR REPLACE FUNCTION "public"."get_user_permissions"("p_user_id" "uuid")
RETURNS "text"[] LANGUAGE "sql" SECURITY DEFINER AS $$
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

-- Check if a user has a specific permission
CREATE OR REPLACE FUNCTION "public"."has_permission"("p_user_id" "uuid", "p_permission_key" "text")
RETURNS boolean LANGUAGE "plpgsql" SECURITY DEFINER AS $$
DECLARE "user_permissions" "text"[];
BEGIN
    SELECT "public"."get_user_permissions"("p_user_id") INTO "user_permissions";
    RETURN '_super_admin' = ANY("user_permissions") OR "p_permission_key" = ANY("user_permissions");
END;
$$;

-- Trigger function to log various admin actions
CREATE OR REPLACE FUNCTION "public"."log_admin_actions"()
RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER AS $$
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


-- 5. TRIGGERS (Complete Refresh)
-- =============================================

-- Drop ALL old notification-related triggers to ensure a clean slate
DROP TRIGGER IF EXISTS "on_submission_change_notify" ON "public"."submissions";
DROP TRIGGER IF EXISTS "trigger_new_submission_webhook" ON "public"."submissions";
DROP TRIGGER IF EXISTS "trigger_new_audit_log_webhook" ON "public"."audit_logs";

-- NEW: Trigger for new submissions (webhook notification)
CREATE TRIGGER trigger_new_submission_webhook
AFTER INSERT ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.handle_new_submission_webhook();

-- NEW: Trigger for new audit logs (webhook notification)
CREATE TRIGGER trigger_new_audit_log_webhook
AFTER INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.handle_new_audit_log_webhook();

-- Admin action logging triggers (these CREATE the logs, the triggers above SEND them)
DROP TRIGGER IF EXISTS "log_quizzes_changes" ON "public"."quizzes";
DROP TRIGGER IF EXISTS "log_products_changes" ON "public"."products";
DROP TRIGGER IF EXISTS "log_submissions_status_changes" ON "public"."submissions";
DROP TRIGGER IF EXISTS "log_profile_ban_changes" ON "public"."profiles";

CREATE TRIGGER "log_quizzes_changes" AFTER INSERT OR UPDATE OR DELETE ON "public"."quizzes" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();
CREATE TRIGGER "log_products_changes" AFTER INSERT OR UPDATE OR DELETE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();
CREATE TRIGGER "log_submissions_status_changes" AFTER UPDATE OF "status" ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();
CREATE TRIGGER "log_profile_ban_changes" AFTER UPDATE OF "is_banned" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();


-- 6. ROW LEVEL SECURITY (RLS)
-- =============================================
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

CREATE POLICY "Allow users to see their own profile" ON "public"."profiles" FOR SELECT USING ("auth"."uid"() = "id");
CREATE POLICY "Allow admins to see all profiles" ON "public"."profiles" FOR SELECT USING ("public"."has_permission"("auth"."uid"(), 'admin_lookup'));

CREATE POLICY "Allow public read access" ON "public"."config" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."translations" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."products" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."quizzes" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."rule_categories" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."rules" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."discord_widgets" FOR SELECT USING (true);

CREATE POLICY "Allow users to create submissions" ON "public"."submissions" FOR INSERT WITH CHECK ("auth"."uid"() = "user_id");
CREATE POLICY "Allow users to see their own submissions" ON "public"."submissions" FOR SELECT USING ("auth"."uid"() = "user_id");
CREATE POLICY "Allow admins to manage submissions" ON "public"."submissions" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_submissions'));

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