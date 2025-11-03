
export const DATABASE_SCHEMA = `
-- Vixel Roleplay Community Hub - Database Schema
-- Version: 5.9.0 (Critical Security & Stability Overhaul)
-- This script is idempotent and can be run multiple times.

-- 1. EXTENSIONS & SCHEMA SETUP
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "public"; -- Required for webhooks

-- 2. TABLES
-- =============================================

-- Profiles table (NOW WITH CACHED PERMISSIONS for stability)
CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "discord_id" "text" UNIQUE,
    "roles" "jsonb" DEFAULT '[]'::"jsonb",
    "highest_role" "jsonb",
    "permissions" "text"[] DEFAULT '{}'::"text"[], -- Caches user permissions for performance and UI display. RLS SHOULD NOT rely on this.
    "last_synced_at" timestamptz,
    "is_banned" boolean NOT NULL DEFAULT false,
    "ban_reason" "text",
    "ban_expires_at" timestamptz
);
-- Add permissions column if it doesn't exist on an existing table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='permissions') THEN
        ALTER TABLE "public"."profiles" ADD COLUMN "permissions" "text"[] DEFAULT '{}'::"text"[];
    END IF;
END $$;


-- Config table (Webhook URLs are now the primary notification method)
CREATE TABLE IF NOT EXISTS "public"."config" (
    "id" smallint PRIMARY KEY DEFAULT 1,
    "COMMUNITY_NAME" "text" NOT NULL DEFAULT 'Vixel Roleplay',
    "LOGO_URL" "text" NOT NULL DEFAULT 'https://l.top4top.io/p_356271n1v1.png',
    "BACKGROUND_IMAGE_URL" "text" DEFAULT '',
    "DISCORD_GUILD_ID" "text",
    "DISCORD_INVITE_URL" "text" DEFAULT 'https://discord.gg/your-invite',
    "MTA_SERVER_URL" "text" DEFAULT 'mtasa://your.server.ip:port',
    "SHOW_HEALTH_CHECK" boolean NOT NULL DEFAULT true,
    "SUBMISSION_WEBHOOK_URL" "text",
    "AUDIT_LOG_WEBHOOK_URL" "text"
);
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
    "admin_id" "uuid" NOT NULL,
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


-- 3. CORE FUNCTIONS
-- =============================================

-- Permission checking function (CRITICAL SECURITY/STABILITY UPDATE)
-- This function is now SECURITY DEFINER and calculates permissions on-the-fly from user roles,
-- completely ignoring the potentially stale 'permissions' cache column in the profiles table.
-- This is the definitive fix for stale permissions and related RLS issues.
DROP FUNCTION IF EXISTS "public"."has_permission"("p_user_id" "uuid", "p_permission_key" "text") CASCADE;
CREATE OR REPLACE FUNCTION "public"."has_permission"("p_user_id" "uuid", "p_permission_key" "text")
RETURNS boolean LANGUAGE "plpgsql" SECURITY DEFINER AS $$
DECLARE
    has_perm boolean;
BEGIN
    -- Check if user has the permission directly or via super_admin from their roles
    SELECT EXISTS (
        SELECT 1
        FROM public.role_permissions rp
        WHERE rp.role_id IN (
            SELECT value->>'id'
            FROM public.profiles p,
                 jsonb_array_elements(p.roles)
            WHERE p.id = p_user_id
        ) AND (
            p_permission_key = ANY(rp.permissions) OR
            '_super_admin' = ANY(rp.permissions)
        )
    ) INTO has_perm;
    
    RETURN has_perm;
END;
$$;
DROP FUNCTION IF EXISTS "public"."get_user_permissions"("p_user_id" "uuid");


-- Webhook sender function
CREATE OR REPLACE FUNCTION public.send_webhook(webhook_url text, payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  func_oid oid;
  func_schema name;
  payload_text text;
BEGIN
    IF webhook_url IS NOT NULL AND webhook_url <> '' THEN
        SELECT p.oid, n.nspname INTO func_oid, func_schema
        FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'http_post' AND n.nspname IN ('public', 'extensions')
        LIMIT 1;

        IF func_oid IS NOT NULL THEN
            payload_text := payload::text;
            EXECUTE format('SELECT %I.http_post(%L, $1, %L)', func_schema, webhook_url, 'application/json')
            USING payload_text;
        ELSE
            RAISE NOTICE 'Webhook Error: http_post function not found.';
        END IF;
    END IF;
END;
$$;


-- Admin action logging function
CREATE OR REPLACE FUNCTION "public"."log_admin_actions"()
RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER AS $$
DECLARE
    "user_id" "uuid";
    "user_name" "text";
    "action_text" "text";
BEGIN
    IF auth.role() = 'authenticated' AND auth.jwt() IS NOT NULL THEN
        "user_id" := ((auth.jwt())->>'sub')::uuid;
        "user_name" := (auth.jwt())->'user_metadata' ->> 'full_name';
        IF "user_name" IS NULL OR "user_name" = '' THEN
            "user_name" := 'User (' || "user_id"::text || ')';
        END IF;
    ELSE
        "user_id" := '00000000-0000-0000-0000-000000000000'; -- Nil UUID for system actions
        "user_name" := 'System (Dashboard/Service Role)';
    END IF;

    IF TG_TABLE_NAME = 'quizzes' THEN
        IF TG_OP = 'INSERT' THEN "action_text" := 'Created form: "' || COALESCE(NEW."titleKey", 'N/A') || '"';
        ELSIF TG_OP = 'UPDATE' THEN "action_text" := 'Updated form: "' || COALESCE(NEW."titleKey", 'N/A') || '"';
        ELSIF TG_OP = 'DELETE' THEN "action_text" := 'Deleted form: "' || COALESCE(OLD."titleKey", 'N/A') || '"';
        END IF;
    ELSIF TG_TABLE_NAME = 'products' THEN
        IF TG_OP = 'INSERT' THEN "action_text" := 'Created product: "' || COALESCE(NEW."nameKey", 'N/A') || '"';
        ELSIF TG_OP = 'UPDATE' THEN "action_text" := 'Updated product: "' || COALESCE(NEW."nameKey", 'N/A') || '"';
        ELSIF TG_OP = 'DELETE' THEN "action_text" := 'Deleted product: "' || COALESCE(OLD."nameKey", 'N/A') || '"';
        END IF;
    ELSIF TG_TABLE_NAME = 'submissions' AND TG_OP = 'UPDATE' THEN
        IF OLD."status" != NEW."status" THEN
             "action_text" := 'Updated submission for "' || NEW."username" || '" (' || NEW."quizTitle" || ') to status: ' || UPPER(NEW."status");
        END IF;
    ELSIF TG_TABLE_NAME = 'profiles' AND TG_OP = 'UPDATE' THEN
        IF OLD."is_banned" != NEW."is_banned" THEN
           "action_text" := CASE WHEN NEW."is_banned" THEN 'BANNED' ELSE 'UNBANNED' END || ' user with Discord ID: ' || NEW."discord_id";
        END IF;
    ELSIF TG_TABLE_NAME = 'role_permissions' THEN
        "action_text" := 'Updated permissions for role ID: ' || COALESCE(NEW.role_id, OLD.role_id);
    ELSIF TG_TABLE_NAME = 'config' THEN
        "action_text" := 'Updated website configuration.';
    ELSIF TG_TABLE_NAME = 'discord_widgets' THEN
        "action_text" := 'Updated Discord widgets.';
    END IF;

    IF "action_text" IS NOT NULL THEN
        INSERT INTO "public"."audit_logs"("admin_id", "admin_username", "action")
        VALUES ("user_id", "user_name", "action_text");
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;


-- 4. WEBHOOK TRIGGERS
-- =============================================

-- Webhook for NEW SUBMISSIONS.
CREATE OR REPLACE FUNCTION public.handle_new_submission_webhook()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_webhook_url text;
    v_community_name text;
    v_logo_url text;
    payload jsonb;
BEGIN
    SELECT "SUBMISSION_WEBHOOK_URL", "COMMUNITY_NAME", "LOGO_URL"
    INTO v_webhook_url, v_community_name, v_logo_url
    FROM public.config WHERE id = 1;
    
    payload := jsonb_build_object(
        'username', v_community_name || ' Submissions',
        'avatar_url', v_logo_url,
        'embeds', jsonb_build_array(
            jsonb_build_object(
                'title', '📝 New Application Received!',
                'color', 62194, -- #00f2ea
                'fields', jsonb_build_array(
                    jsonb_build_object('name', 'Applicant', 'value', NEW.username, 'inline', true),
                    jsonb_build_object('name', 'Application Type', 'value', NEW.quizTitle, 'inline', true),
                    jsonb_build_object('name', 'Highest Role', 'value', COALESCE(NEW.user_highest_role, 'Member'), 'inline', true)
                ),
                'footer', jsonb_build_object('text', v_community_name, 'icon_url', v_logo_url),
                'timestamp', to_char(NEW.submittedAt, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            )
        )
    );
    
    PERFORM public.send_webhook(v_webhook_url, payload);
    RETURN NEW;
END;
$$;

-- Webhook for NEW AUDIT LOGS.
CREATE OR REPLACE FUNCTION public.handle_new_audit_log_webhook()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_webhook_url text;
    v_community_name text;
    v_logo_url text;
    payload jsonb;
BEGIN
    SELECT "AUDIT_LOG_WEBHOOK_URL", "COMMUNITY_NAME", "LOGO_URL"
    INTO v_webhook_url, v_community_name, v_logo_url
    FROM public.config WHERE id = 1;

    payload := jsonb_build_object(
        'username', v_community_name || ' Audit Log',
        'avatar_url', v_logo_url,
        'embeds', jsonb_build_array(
            jsonb_build_object(
                'title', '🛡️ Admin Action Logged',
                'color', 15105570, -- #e67e22 (Orange)
                'fields', jsonb_build_array(
                    jsonb_build_object('name', 'Admin', 'value', NEW.admin_username, 'inline', true),
                    jsonb_build_object('name', 'Action', 'value', NEW.action, 'inline', false)
                ),
                'footer', jsonb_build_object('text', v_community_name, 'icon_url', v_logo_url),
                'timestamp', to_char(NEW.timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            )
        )
    );
    
    PERFORM public.send_webhook(v_webhook_url, payload);
    RETURN NEW;
END;
$$;


-- 5. TRIGGERS
-- =============================================

DROP TRIGGER IF EXISTS "on_submission_change_notify" ON "public"."submissions";
DROP TRIGGER IF EXISTS "trigger_new_submission_webhook" ON "public"."submissions";
DROP TRIGGER IF EXISTS "trigger_new_audit_log_webhook" ON "public"."audit_logs";
DROP TRIGGER IF EXISTS "log_quizzes_changes" ON "public"."quizzes";
DROP TRIGGER IF EXISTS "log_products_changes" ON "public"."products";
DROP TRIGGER IF EXISTS "log_submissions_status_changes" ON "public"."submissions";
DROP TRIGGER IF EXISTS "log_profile_ban_changes" ON "public"."profiles";
DROP TRIGGER IF EXISTS "log_config_changes" ON "public"."config";
DROP TRIGGER IF EXISTS "log_permissions_changes" ON "public"."role_permissions";
DROP TRIGGER IF EXISTS "log_widgets_changes" ON "public"."discord_widgets";

CREATE TRIGGER trigger_new_submission_webhook
AFTER INSERT ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.handle_new_submission_webhook();

CREATE TRIGGER trigger_new_audit_log_webhook
AFTER INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.handle_new_audit_log_webhook();

CREATE TRIGGER "log_quizzes_changes" AFTER INSERT OR UPDATE OR DELETE ON "public"."quizzes" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();
CREATE TRIGGER "log_products_changes" AFTER INSERT OR UPDATE OR DELETE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();
CREATE TRIGGER "log_submissions_status_changes" AFTER UPDATE OF "status" ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();
CREATE TRIGGER "log_profile_ban_changes" AFTER UPDATE OF "is_banned" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();
CREATE TRIGGER "log_config_changes" AFTER UPDATE ON "public"."config" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();
CREATE TRIGGER "log_permissions_changes" AFTER INSERT OR UPDATE ON "public"."role_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();
CREATE TRIGGER "log_widgets_changes" AFTER INSERT OR UPDATE OR DELETE ON "public"."discord_widgets" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_actions"();


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
DROP POLICY IF EXISTS "Allow admins to manage translations" ON "public"."translations"; -- DEFINITIVE FIX
DROP POLICY IF EXISTS "Allow public read access" ON "public"."products";
DROP POLICY IF EXISTS "Allow public read access" ON "public"."quizzes";
DROP POLICY IF EXISTS "Allow public read access" ON "public"."rule_categories";
DROP POLICY IF EXISTS "Allow public read access" ON "public"."rules";
DROP POLICY IF EXISTS "Allow public read access" ON "public"."discord_widgets";
DROP POLICY IF EXISTS "Allow users to create submissions" ON "public"."submissions";
DROP POLICY IF EXISTS "Allow users to see their own submissions" ON "public"."submissions";
DROP POLICY IF EXISTS "Allow admins to manage submissions" ON "public"."submissions";
DROP POLICY IF EXISTS "Allow admins full access" ON "public"."role_permissions";
DROP POLICY IF EXISTS "Allow inserts for all authenticated users" ON "public"."audit_logs"; -- NEW
DROP POLICY IF EXISTS "Allow admins to read logs" ON "public"."audit_logs"; -- NEW
DROP POLICY IF EXISTS "Allow admins full access" ON "public"."audit_logs"; -- OLD, REMOVED
DROP POLICY IF EXISTS "Allow admins to manage config" ON "public"."config";
DROP POLICY IF EXISTS "Allow admins to manage products" ON "public"."products";
DROP POLICY IF EXISTS "Allow admins to manage quizzes" ON "public"."quizzes";
DROP POLICY IF EXISTS "Allow admins to manage rules" ON "public"."rules";
DROP POLICY IF EXISTS "Allow admins to manage rule categories" ON "public"."rule_categories";
DROP POLICY IF EXISTS "Allow admins to manage widgets" ON "public"."discord_widgets";

CREATE POLICY "Allow users to see their own profile" ON "public"."profiles" FOR SELECT USING ("auth"."uid"() = "id");
CREATE POLICY "Allow admins to see all profiles" ON "public"."profiles" FOR SELECT USING ("public"."has_permission"("auth"."uid"(), 'admin_lookup'));

CREATE POLICY "Allow public read access" ON "public"."config" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."translations" FOR SELECT USING (true);
-- DEFINITIVE FIX: Allow any admin who can access the admin panel to also manage translations.
-- This is crucial so that creating new quizzes/products/rules (which creates new translation keys) does not fail.
CREATE POLICY "Allow admins to manage translations" ON "public"."translations" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_panel'));
CREATE POLICY "Allow public read access" ON "public"."products" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."quizzes" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."rule_categories" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."rules" FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON "public"."discord_widgets" FOR SELECT USING (true);

CREATE POLICY "Allow users to create submissions" ON "public"."submissions" FOR INSERT WITH CHECK ("auth"."uid"() = "user_id");
CREATE POLICY "Allow users to see their own submissions" ON "public"."submissions" FOR SELECT USING ("auth"."uid"() = "user_id");
CREATE POLICY "Allow admins to manage submissions" ON "public"."submissions" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_submissions'));

CREATE POLICY "Allow admins full access" ON "public"."role_permissions" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_permissions'));

-- NEW RLS FOR AUDIT LOGS: Allow any authenticated user to INSERT (via triggers), but only specific admins to SELECT.
CREATE POLICY "Allow inserts for all authenticated users" ON "public"."audit_logs" FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow admins to read logs" ON "public"."audit_logs" FOR SELECT USING (public.has_permission(auth.uid(), 'admin_audit_log'));

CREATE POLICY "Allow admins to manage config" ON "public"."config" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_appearance'));
CREATE POLICY "Allow admins to manage products" ON "public"."products" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_store'));
CREATE POLICY "Allow admins to manage quizzes" ON "public"."quizzes" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_quizzes'));
CREATE POLICY "Allow admins to manage rules" ON "public"."rules" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_rules'));
CREATE POLICY "Allow admins to manage rule categories" ON "public"."rule_categories" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_rules'));
CREATE POLICY "Allow admins to manage widgets" ON "public"."discord_widgets" FOR ALL USING ("public"."has_permission"("auth"."uid"(), 'admin_widgets'));
`;
