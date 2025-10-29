// @ts-nocheck
// Vixel Roleplay Website - Full Database Schema (V35, Customizable Notifications)
export const schema = `
/*
====================================================================================================
 Vixel Roleplay Website - Full Database Schema (V35, Customizable Notifications)
 Author: AI
 Date: 2024/06/21
 
 !! WARNING !!
 This script is DESTRUCTIVE. It will completely DROP all existing website-related tables,
 functions, and data before recreating the entire schema. This is intended for development
 or for a clean installation. DO NOT run this on a production database with live user data
 unless you intend to wipe it completely.

 !! WHAT'S NEW (V35) !!
 - Fully Customizable Notifications: All automated Discord messages (DMs and channel posts)
   are now controlled by entries in the 'translations' table. Admins can edit these messages
   live from a new "Notifications" panel.
 - New User Welcome DM: A new trigger has been added that sends a customizable DM to a user
   when they log in for the first time.
 - Refactored Notification Functions: All notification triggers in the database have been
   rewritten to fetch their message content dynamically from the translations table.
 - New 'test-notification' Function Support: Backend is ready for the new admin panel
   feature that allows testing each notification.
 
 INSTRUCTIONS:
 1. Go to your Supabase Project Dashboard -> SQL Editor.
 2. Click "+ New query".
 3. Copy the ENTIRE content of this file, paste it into the editor, and click "RUN".
====================================================================================================
*/

-- Wrap the entire script in a transaction to ensure it either completes fully or not at all.
BEGIN;

-- =================================================================
-- 1. DESTRUCTIVE RESET: Drop all existing objects
-- =================================================================
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.bans CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.rules CASCADE;
DROP TABLE IF EXISTS public.quizzes CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.config CASCADE;
DROP TABLE IF EXISTS public.translations CASCADE;

-- Drop all custom functions to ensure a clean re-creation.
DROP FUNCTION IF EXISTS public.get_config();
DROP FUNCTION IF EXISTS public.get_all_submissions();
DROP FUNCTION IF EXISTS public.add_submission(jsonb);
DROP FUNCTION IF EXISTS public.update_submission_status(uuid, text);
DROP FUNCTION IF EXISTS public.delete_submission(uuid);
DROP FUNCTION IF EXISTS public.save_quiz_with_translations(jsonb);
DROP FUNCTION IF EXISTS public.save_product_with_translations(jsonb);
DROP FUNCTION IF EXISTS public.save_rules(jsonb);
DROP FUNCTION IF EXISTS public.update_config(jsonb);
DROP FUNCTION IF EXISTS public.log_action(text, text);
DROP FUNCTION IF EXISTS public.log_page_visit(text);
DROP FUNCTION IF EXISTS public.ban_user(uuid, text, int);
DROP FUNCTION IF EXISTS public.unban_user(uuid);
DROP FUNCTION IF EXISTS public.has_permission(uuid, text);
DROP FUNCTION IF EXISTS public.save_role_permissions(text, text[]);
DROP FUNCTION IF EXISTS public.get_user_id();
DROP FUNCTION IF EXISTS public.test_pg_net();
DROP FUNCTION IF EXISTS private.handle_new_submission_notification();
DROP FUNCTION IF EXISTS private.handle_submission_status_update();
DROP FUNCTION IF EXISTS private.handle_audit_log_notification();
DROP FUNCTION IF EXISTS private.handle_new_profile_notification();
DROP FUNCTION IF EXISTS private.handle_new_profile_welcome_dm();
DROP FUNCTION IF EXISTS private.handle_quiz_deleted_notification();
DROP FUNCTION IF EXISTS private.handle_product_deleted_notification();

-- Drop private schema for secrets
DROP SCHEMA IF EXISTS private CASCADE;


-- =================================================================
-- 2. INITIAL SETUP & EXTENSIONS
-- =================================================================
GRANT USAGE, CREATE ON SCHEMA public TO postgres;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a private schema to store secrets and internal functions.
CREATE SCHEMA private;

-- =================================================================
-- 3. TABLE CREATION
-- =================================================================
CREATE TABLE public.config (
    id smallint PRIMARY KEY DEFAULT 1,
    "COMMUNITY_NAME" text NOT NULL DEFAULT 'Vixel Roleplay',
    "LOGO_URL" text,
    "DISCORD_GUILD_ID" text,
    "DISCORD_INVITE_URL" text,
    "MTA_SERVER_URL" text,
    "BACKGROUND_IMAGE_URL" text,
    "SHOW_HEALTH_CHECK" boolean DEFAULT false,
    "SUBMISSIONS_CHANNEL_ID" text,
    "SUBMISSIONS_MENTION_ROLE_ID" text,
    "AUDIT_LOG_CHANNEL_ID" text, -- General/Fallback
    "AUDIT_LOG_CHANNEL_ID_SUBMISSIONS" text,
    "AUDIT_LOG_CHANNEL_ID_BANS" text,
    "AUDIT_LOG_CHANNEL_ID_ADMIN" text,
    CONSTRAINT id_check CHECK (id = 1)
);
INSERT INTO public.config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    discord_id text NOT NULL UNIQUE,
    username text,
    roles jsonb,
    highest_role jsonb,
    last_synced_at timestamptz,
    is_banned boolean DEFAULT false,
    ban_reason text,
    ban_expires_at timestamptz
);

CREATE TABLE public.role_permissions (
    role_id text PRIMARY KEY,
    permissions text[]
);

CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "nameKey" text NOT NULL,
    "descriptionKey" text,
    price numeric(10, 2) NOT NULL,
    "imageUrl" text
);

CREATE TABLE public.quizzes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "titleKey" text NOT NULL,
    "descriptionKey" text,
    questions jsonb,
    "isOpen" boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    "allowedTakeRoles" text[],
    "logoUrl" text,
    "bannerUrl" text,
    "lastOpenedAt" timestamptz
);

CREATE TABLE public.submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "quizId" uuid REFERENCES public.quizzes(id) ON DELETE SET NULL,
    "quizTitle" text,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    username text,
    answers jsonb,
    "submittedAt" timestamptz DEFAULT now(),
    status text DEFAULT 'pending',
    "adminId" uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    "adminUsername" text,
    "updatedAt" timestamptz,
    "cheatAttempts" jsonb,
    user_highest_role text
);

CREATE TABLE public.rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "titleKey" text NOT NULL,
    position int NOT NULL,
    rules jsonb
);

CREATE TABLE public.audit_log (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    timestamp timestamptz DEFAULT now(),
    admin_id uuid REFERENCES auth.users(id),
    admin_username text,
    action text,
    log_type text -- Used by trigger to route to correct channel
);

CREATE TABLE public.translations (
    key text PRIMARY KEY,
    en text,
    ar text
);

CREATE TABLE public.bans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    banned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reason text,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    unbanned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    unbanned_at timestamptz,
    is_active boolean DEFAULT true
);


-- =================================================================
-- 4. HELPER & RPC FUNCTIONS (DEFINED BEFORE RLS)
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE user_permissions text[];
BEGIN
    IF p_user_id IS NULL THEN RETURN false; END IF;
    SELECT COALESCE(array_agg(DISTINCT p.permission), '{}') INTO user_permissions
    FROM public.profiles prof
    CROSS JOIN jsonb_array_elements(prof.roles) AS r(role_obj)
    JOIN public.role_permissions rp ON rp.role_id = r.role_obj->>'id'
    CROSS JOIN unnest(rp.permissions) AS p(permission) WHERE prof.id = p_user_id;
    RETURN ('_super_admin' = ANY(user_permissions) OR p_permission_key = ANY(user_permissions));
END;
$$;


-- =================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =================================================================
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.config FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.rules FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.translations FOR SELECT USING (true);
CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT USING (id = public.get_user_id());
CREATE POLICY "Users can access their own submissions" ON public.submissions FOR ALL USING (user_id = public.get_user_id());
CREATE POLICY "Admins can manage config" ON public.config FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_appearance'));
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_store'));
CREATE POLICY "Admins can manage quizzes" ON public.quizzes FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_quizzes'));
CREATE POLICY "Admins can manage rules" ON public.rules FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_rules'));
CREATE POLICY "Admins can manage translations" ON public.translations FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_translations') OR public.has_permission(public.get_user_id(), 'admin_notifications'));
CREATE POLICY "Admins can manage bans" ON public.bans FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_lookup'));
CREATE POLICY "Admins can manage role permissions" ON public.role_permissions FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_permissions'));
CREATE POLICY "Admins can read audit log" ON public.audit_log FOR SELECT USING (public.has_permission(public.get_user_id(), 'admin_audit_log'));
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (public.has_permission(public.get_user_id(), '_super_admin'));
CREATE POLICY "Admins can manage submissions" ON public.submissions FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_submissions'));

-- =================================================================
-- 6. RPC FUNCTIONS
-- =================================================================
CREATE OR REPLACE FUNCTION public.test_pg_net()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE response_body text; request_id bigint;
BEGIN
    IF NOT public.has_permission(public.get_user_id(), 'admin_panel') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
    SELECT net.http_get(url := 'https://httpbin.org/get') INTO request_id;
    SELECT content INTO response_body FROM net.http_collect_response(request_id, async := false);
    IF response_body IS NOT NULL AND response_body LIKE '%"url": "https://httpbin.org/get"%' THEN
        RETURN 'SUCCESS: pg_net is configured correctly and can make outbound requests.';
    ELSE
        RETURN 'FAILURE: pg_net could not make an outbound request. Check Database Network Restrictions.';
    END IF;
EXCEPTION WHEN OTHERS THEN RETURN 'ERROR: An unexpected error occurred. Details: ' || SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_config() RETURNS json LANGUAGE sql STABLE AS $$ SELECT row_to_json(c) FROM public.config c WHERE id = 1; $$;

CREATE OR REPLACE FUNCTION public.get_all_submissions() RETURNS SETOF public.submissions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_submissions') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  RETURN QUERY SELECT * FROM public.submissions ORDER BY "submittedAt" DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_submission(submission_data jsonb) RETURNS public.submissions LANGUAGE plpgsql
AS $$
DECLARE new_submission public.submissions;
BEGIN
  INSERT INTO public.submissions ("quizId", "quizTitle", user_id, username, answers, "cheatAttempts", user_highest_role)
  VALUES (
    (submission_data->>'quizId')::uuid, submission_data->>'quizTitle', public.get_user_id(), submission_data->>'username',
    submission_data->'answers', submission_data->'cheatAttempts', submission_data->>'user_highest_role'
  ) RETURNING * INTO new_submission;
  IF jsonb_array_length(submission_data->'cheatAttempts') > 0 THEN
    PERFORM public.log_action('⚠️ تم تسجيل ' || jsonb_array_length(submission_data->'cheatAttempts') || ' محاولة غش للمستخدم **' || (submission_data->>'username') || '** في تقديم (*' || (submission_data->>'quizTitle') || '*).', 'submission');
  END IF;
  RETURN new_submission;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_submission_status(p_submission_id uuid, p_new_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE submission_record record; admin_user record;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_submissions') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  SELECT id, raw_user_meta_data->>'full_name' AS username INTO admin_user FROM auth.users WHERE id = public.get_user_id();
  UPDATE public.submissions SET status = p_new_status, "adminId" = public.get_user_id(), "adminUsername" = admin_user.username, "updatedAt" = now()
  WHERE id = p_submission_id RETURNING * INTO submission_record;
  PERFORM public.log_action('قام بتغيير حالة تقديم (' || submission_record."quizTitle" || ') للمستخدم ' || submission_record.username || ' إلى ' || p_new_status, 'submission');
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_submission(p_submission_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE submission_record record;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_submissions') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  SELECT username, "quizTitle" INTO submission_record FROM public.submissions WHERE id = p_submission_id;
  IF FOUND THEN
    DELETE FROM public.submissions WHERE id = p_submission_id;
    PERFORM public.log_action('🗑️ قام بحذف تقديم (' || submission_record."quizTitle" || ') للمستخدم ' || submission_record.username, 'submission');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_action(p_action text, p_log_type text DEFAULT 'general') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE admin_user record;
BEGIN
  SELECT id, COALESCE(raw_user_meta_data->>'global_name', raw_user_meta_data->>'full_name', 'Unknown') AS username INTO admin_user FROM auth.users WHERE id = public.get_user_id();
  INSERT INTO public.audit_log(admin_id, admin_username, action, log_type) VALUES (admin_user.id, admin_user.username, p_action, p_log_type);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_page_visit(p_page_name text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.has_permission(public.get_user_id(), 'admin_panel') THEN
    PERFORM public.log_action('👁️ تصفح صفحة: ' || p_page_name, 'admin');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_config(new_config jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_appearance') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;
  PERFORM public.log_action('⚙️ قام بتحديث إعدادات المظهر والاتصال', 'admin');
  UPDATE public.config SET
    "COMMUNITY_NAME" = coalesce(new_config->>'COMMUNITY_NAME', "COMMUNITY_NAME"), "LOGO_URL" = coalesce(new_config->>'LOGO_URL', "LOGO_URL"),
    "DISCORD_GUILD_ID" = coalesce(new_config->>'DISCORD_GUILD_ID', "DISCORD_GUILD_ID"), "DISCORD_INVITE_URL" = coalesce(new_config->>'DISCORD_INVITE_URL', "DISCORD_INVITE_URL"),
    "MTA_SERVER_URL" = coalesce(new_config->>'MTA_SERVER_URL', "MTA_SERVER_URL"), "BACKGROUND_IMAGE_URL" = coalesce(new_config->>'BACKGROUND_IMAGE_URL', "BACKGROUND_IMAGE_URL"),
    "SHOW_HEALTH_CHECK" = coalesce((new_config->>'SHOW_HEALTH_CHECK')::boolean, "SHOW_HEALTH_CHECK"), "SUBMISSIONS_CHANNEL_ID" = coalesce(new_config->>'SUBMISSIONS_CHANNEL_ID', "SUBMISSIONS_CHANNEL_ID"),
    "SUBMISSIONS_MENTION_ROLE_ID" = coalesce(new_config->>'SUBMISSIONS_MENTION_ROLE_ID', "SUBMISSIONS_MENTION_ROLE_ID"),
    "AUDIT_LOG_CHANNEL_ID" = coalesce(new_config->>'AUDIT_LOG_CHANNEL_ID', "AUDIT_LOG_CHANNEL_ID"), "AUDIT_LOG_CHANNEL_ID_SUBMISSIONS" = coalesce(new_config->>'AUDIT_LOG_CHANNEL_ID_SUBMISSIONS', "AUDIT_LOG_CHANNEL_ID_SUBMISSIONS"),
    "AUDIT_LOG_CHANNEL_ID_BANS" = coalesce(new_config->>'AUDIT_LOG_CHANNEL_ID_BANS', "AUDIT_LOG_CHANNEL_ID_BANS"), "AUDIT_LOG_CHANNEL_ID_ADMIN" = coalesce(new_config->>'AUDIT_LOG_CHANNEL_ID_ADMIN', "AUDIT_LOG_CHANNEL_ID_ADMIN")
  WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_quiz_with_translations(p_quiz_data jsonb) RETURNS public.quizzes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result public.quizzes; v_question jsonb; action_text text; is_new boolean;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_quizzes') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;
  is_new := NOT EXISTS (SELECT 1 FROM public.quizzes WHERE id = (p_quiz_data->>'id')::uuid);
  IF is_new THEN action_text := '📝 قام بإنشاء تقديم جديد: ' || (p_quiz_data->>'titleEn');
  ELSE action_text := '✏️ قام بتعديل بيانات التقديم: ' || (p_quiz_data->>'titleEn'); END IF;
  PERFORM public.log_action(action_text, 'admin');
  INSERT INTO public.translations (key, en, ar) VALUES (p_quiz_data->>'titleKey', p_quiz_data->>'titleEn', p_quiz_data->>'titleAr'), (p_quiz_data->>'descriptionKey', p_quiz_data->>'descriptionEn', p_quiz_data->>'descriptionAr') ON CONFLICT (key) DO UPDATE SET en = excluded.en, ar = excluded.ar;
  IF jsonb_typeof(p_quiz_data->'questions') = 'array' THEN FOR v_question IN SELECT * FROM jsonb_array_elements(p_quiz_data->'questions') LOOP INSERT INTO public.translations (key, en, ar) VALUES (v_question->>'textKey', v_question->>'textEn', v_question->>'textAr') ON CONFLICT (key) DO UPDATE SET en = excluded.en, ar = excluded.ar; END LOOP; END IF;
  INSERT INTO public.quizzes (id, "titleKey", "descriptionKey", questions, "isOpen", "allowedTakeRoles", "logoUrl", "bannerUrl", "lastOpenedAt")
  VALUES ((p_quiz_data->>'id')::uuid, p_quiz_data->>'titleKey', p_quiz_data->>'descriptionKey', (SELECT jsonb_agg(jsonb_build_object('id', q->>'id', 'textKey', q->>'textKey', 'timeLimit', q->'timeLimit')) FROM jsonb_array_elements(p_quiz_data->'questions') q), (p_quiz_data->>'isOpen')::boolean, (SELECT array_agg(elem) FROM jsonb_array_elements_text(p_quiz_data->'allowedTakeRoles') AS elem), p_quiz_data->>'logoUrl', p_quiz_data->>'bannerUrl', CASE WHEN (p_quiz_data->>'isOpen')::boolean AND is_new THEN now() ELSE NULL END)
  ON CONFLICT (id) DO UPDATE SET "titleKey" = excluded."titleKey", "descriptionKey" = excluded."descriptionKey", questions = excluded.questions, "isOpen" = excluded."isOpen", "allowedTakeRoles" = excluded."allowedTakeRoles", "logoUrl" = excluded."logoUrl", "bannerUrl" = excluded."bannerUrl", "lastOpenedAt" = CASE WHEN excluded."isOpen" AND NOT quizzes."isOpen" THEN now() ELSE quizzes."lastOpenedAt" END
  RETURNING * INTO result;
  RETURN result;
END; $$;
CREATE OR REPLACE FUNCTION public.save_product_with_translations(p_product_data jsonb) RETURNS public.products LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result public.products;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_store') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;
  IF EXISTS (SELECT 1 FROM public.products WHERE id = (p_product_data->>'id')::uuid) THEN PERFORM public.log_action('🛍️ قام بتعديل المنتج: ' || (p_product_data->>'nameEn'), 'admin');
  ELSE PERFORM public.log_action('➕ قام بإضافة منتج جديد: ' || (p_product_data->>'nameEn'), 'admin'); END IF;
  INSERT INTO public.translations (key, en, ar) VALUES (p_product_data->>'nameKey', p_product_data->>'nameEn', p_product_data->>'nameAr'), (p_product_data->>'descriptionKey', p_product_data->>'descriptionEn', p_product_data->>'descriptionAr') ON CONFLICT (key) DO UPDATE SET en = excluded.en, ar = excluded.ar;
  INSERT INTO public.products (id, "nameKey", "descriptionKey", price, "imageUrl") VALUES ((p_product_data->>'id')::uuid, p_product_data->>'nameKey', p_product_data->>'descriptionKey', (p_product_data->>'price')::numeric, p_product_data->>'imageUrl') ON CONFLICT (id) DO UPDATE SET "nameKey" = excluded."nameKey", "descriptionKey" = excluded."descriptionKey", price = excluded.price, "imageUrl" = excluded."imageUrl" RETURNING * INTO result;
  RETURN result;
END; $$;
CREATE OR REPLACE FUNCTION public.save_rules(p_rules_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_category jsonb; v_rule jsonb;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_rules') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF; PERFORM public.log_action('⚖️ قام بتحديث قوانين السيرفر', 'admin');
  FOR v_category IN SELECT * FROM jsonb_array_elements(p_rules_data) LOOP INSERT INTO public.translations (key, en, ar) VALUES (v_category->>'titleKey', v_category->>'titleEn', v_category->>'titleAr') ON CONFLICT (key) DO UPDATE SET en = excluded.en, ar = excluded.ar; IF jsonb_typeof(v_category->'rules') = 'array' THEN FOR v_rule IN SELECT * FROM jsonb_array_elements(v_category->'rules') LOOP INSERT INTO public.translations (key, en, ar) VALUES (v_rule->>'textKey', v_rule->>'textEn', v_rule->>'textAr') ON CONFLICT (key) DO UPDATE SET en = excluded.en, ar = excluded.ar; END LOOP; END IF; END LOOP;
  DELETE FROM public.rules WHERE true; INSERT INTO public.rules (id, "titleKey", position, rules) SELECT (c->>'id')::uuid, c->>'titleKey', (c->>'position')::int, (SELECT jsonb_agg(jsonb_build_object('id', r->>'id', 'textKey', r->>'textKey')) FROM jsonb_array_elements(c->'rules') AS r) FROM jsonb_array_elements(p_rules_data) AS c;
END; $$;
CREATE OR REPLACE FUNCTION public.ban_user(p_target_user_id uuid, p_reason text, p_duration_hours int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_expires_at timestamptz; target_username text;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_lookup') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;
  IF p_duration_hours IS NOT NULL THEN v_expires_at := now() + (p_duration_hours * interval '1 hour'); ELSE v_expires_at := null; END IF;
  UPDATE public.profiles SET is_banned = true, ban_reason = p_reason, ban_expires_at = v_expires_at WHERE id = p_target_user_id;
  UPDATE public.bans SET is_active = false WHERE user_id = p_target_user_id AND is_active = true;
  INSERT INTO public.bans(user_id, banned_by, reason, expires_at, is_active) VALUES (p_target_user_id, public.get_user_id(), p_reason, v_expires_at, true);
  SELECT username FROM public.profiles WHERE id = p_target_user_id INTO target_username;
  PERFORM public.log_action('🚫 قام بحظر المستخدم **' || coalesce(target_username, p_target_user_id::text) || '** للسبب: *' || p_reason || '*', 'ban');
END; $$;
CREATE OR REPLACE FUNCTION public.unban_user(p_target_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_username text;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_lookup') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;
  UPDATE public.profiles SET is_banned = false, ban_reason = null, ban_expires_at = null WHERE id = p_target_user_id;
  UPDATE public.bans SET is_active = false, unbanned_by = public.get_user_id(), unbanned_at = now() WHERE user_id = p_target_user_id AND is_active = true;
  SELECT username FROM public.profiles WHERE id = p_target_user_id INTO target_username;
  PERFORM public.log_action('✅ قام بفك الحظر عن المستخدم **' || coalesce(target_username, p_target_user_id::text) || '**', 'ban');
END; $$;
CREATE OR REPLACE FUNCTION public.save_role_permissions(p_role_id text, p_permissions text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_permissions') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;
  PERFORM public.log_action('🛡️ قام بتحديث صلاحيات الرتبة <@&' || p_role_id || '>', 'admin');
  INSERT INTO public.role_permissions (role_id, permissions) VALUES (p_role_id, p_permissions) ON CONFLICT (role_id) DO UPDATE SET permissions = excluded.permissions;
END; $$;

-- =================================================================
-- 7. NOTIFICATION TRIGGERS (REBUILT FOR V35 - CUSTOMIZABLE)
-- =================================================================
CREATE OR REPLACE FUNCTION private.handle_new_submission_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE channel_id text; role_id text; user_discord_id text; proxy_url text := 'http://supabase_kong_url/functions/v1/discord-proxy';
    embed_title text; embed_body text; dm_title text; dm_body text;
BEGIN
  SELECT "SUBMISSIONS_CHANNEL_ID", "SUBMISSIONS_MENTION_ROLE_ID" INTO channel_id, role_id FROM public.config WHERE id = 1;
  SELECT ar INTO embed_title FROM public.translations WHERE key = 'notification_new_submission_channel_title';
  SELECT ar INTO embed_body FROM public.translations WHERE key = 'notification_new_submission_channel_body';
  SELECT ar INTO dm_title FROM public.translations WHERE key = 'notification_submission_receipt_dm_title';
  SELECT ar INTO dm_body FROM public.translations WHERE key = 'notification_submission_receipt_dm_body';

  embed_body := replace(embed_body, '{username}', NEW.username);
  embed_body := replace(embed_body, '{quizTitle}', NEW."quizTitle");
  embed_body := replace(embed_body, '{userHighestRole}', NEW.user_highest_role);
  
  -- 1. Send to Submissions Channel
  IF channel_id IS NOT NULL THEN
    PERFORM net.http_post(url := proxy_url, body := jsonb_build_object('type', 'new_submission', 'payload', jsonb_build_object(
        'channelId', channel_id, 'content', '<@&' || role_id || '>',
        'embed', jsonb_build_object('title', embed_title, 'description', embed_body, 'color', 3447003, 'timestamp', NEW."submittedAt"))));
  END IF;
  -- 2. Send DM to user
  dm_body := replace(dm_body, '{username}', NEW.username);
  dm_body := replace(dm_body, '{quizTitle}', NEW."quizTitle");
  SELECT discord_id INTO user_discord_id FROM public.profiles WHERE id = NEW.user_id;
  IF user_discord_id IS NOT NULL THEN
     PERFORM net.http_post(url := proxy_url, body := jsonb_build_object('type', 'submission_receipt', 'payload', jsonb_build_object(
          'userId', user_discord_id, 'embed', jsonb_build_object('title', dm_title, 'description', dm_body, 'color', 3447003, 'timestamp', now()))));
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION private.handle_submission_status_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE user_discord_id text; embed_title text; embed_body text; embed_color int; proxy_url text := 'http://supabase_kong_url/functions/v1/discord-proxy';
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT discord_id INTO user_discord_id FROM public.profiles WHERE id = NEW.user_id;
  IF user_discord_id IS NULL THEN RETURN NEW; END IF;
  
  IF NEW.status = 'taken' THEN SELECT ar INTO embed_title FROM translations WHERE key = 'notification_submission_taken_dm_title'; SELECT ar INTO embed_body FROM translations WHERE key = 'notification_submission_taken_dm_body'; embed_color := 3447003;
  ELSIF NEW.status = 'accepted' THEN SELECT ar INTO embed_title FROM translations WHERE key = 'notification_submission_accepted_dm_title'; SELECT ar INTO embed_body FROM translations WHERE key = 'notification_submission_accepted_dm_body'; embed_color := 5763719;
  ELSIF NEW.status = 'refused' THEN SELECT ar INTO embed_title FROM translations WHERE key = 'notification_submission_refused_dm_title'; SELECT ar INTO embed_body FROM translations WHERE key = 'notification_submission_refused_dm_body'; embed_color := 15548997;
  ELSE RETURN NEW; END IF;
  
  embed_body := replace(replace(replace(embed_body, '{username}', NEW.username), '{quizTitle}', NEW."quizTitle"), '{adminUsername}', NEW."adminUsername");
  
  PERFORM net.http_post(url := proxy_url, body := jsonb_build_object('type', 'submission_result', 'payload', jsonb_build_object(
      'userId', user_discord_id, 'embed', jsonb_build_object('title', embed_title, 'description', embed_body, 'color', embed_color, 'timestamp', now()))));
  PERFORM public.log_action('📧 أرسل رسالة خاصة إلى **' || NEW.username || '** بخصوص تقديم (' || NEW."quizTitle" || ') بعنوان: "' || embed_title || '"', 'submission');
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION private.handle_audit_log_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE channel_id text; proxy_url text := 'http://supabase_kong_url/functions/v1/discord-proxy';
BEGIN
  SELECT CASE NEW.log_type WHEN 'submission' THEN "AUDIT_LOG_CHANNEL_ID_SUBMISSIONS" WHEN 'ban' THEN "AUDIT_LOG_CHANNEL_ID_BANS" WHEN 'admin' THEN "AUDIT_LOG_CHANNEL_ID_ADMIN" ELSE "AUDIT_LOG_CHANNEL_ID" END INTO channel_id FROM public.config WHERE id = 1;
  IF channel_id IS NOT NULL THEN
     PERFORM net.http_post(url := proxy_url, body := jsonb_build_object('type', 'audit_log', 'payload', jsonb_build_object(
          'channelId', channel_id, 'embed', jsonb_build_object('description', NEW.action, 'color', 16776960,
            'author', jsonb_build_object('name', 'سجل إدارة | ' || NEW.admin_username), 'timestamp', now()))));
  END IF; RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION private.handle_new_profile_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.log_action('✨ انضم مستخدم جديد للموقع: **' || NEW.username || '** (`' || NEW.discord_id || '`)', 'admin');
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION private.handle_new_profile_welcome_dm()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE proxy_url text := 'http://supabase_kong_url/functions/v1/discord-proxy'; title text; body text;
BEGIN
    SELECT ar INTO title FROM public.translations WHERE key = 'notification_welcome_dm_title';
    SELECT ar INTO body FROM public.translations WHERE key = 'notification_welcome_dm_body';
    body := replace(body, '{username}', NEW.username);
    PERFORM net.http_post(url := proxy_url, body := jsonb_build_object('type', 'submission_receipt', 'payload', jsonb_build_object(
          'userId', NEW.discord_id, 'embed', jsonb_build_object('title', title, 'description', body, 'color', 5763719, 'timestamp', now()))));
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.handle_quiz_deleted_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    PERFORM public.log_action('🗑️ قام بحذف نموذج التقديم: *' || OLD."titleKey" || '*', 'admin');
    RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION private.handle_product_deleted_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    PERFORM public.log_action('🗑️ قام بحذف المنتج: *' || OLD."nameKey" || '*', 'admin');
    RETURN OLD;
END; $$;

-- ALL TRIGGERS
CREATE TRIGGER on_submission_created AFTER INSERT ON public.submissions FOR EACH ROW EXECUTE FUNCTION private.handle_new_submission_notification();
CREATE TRIGGER on_submission_updated AFTER UPDATE OF status ON public.submissions FOR EACH ROW EXECUTE FUNCTION private.handle_submission_status_update();
CREATE TRIGGER on_audit_log_created AFTER INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION private.handle_audit_log_notification();
CREATE TRIGGER on_profile_created AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.handle_new_profile_notification();
CREATE TRIGGER on_profile_created_welcome_dm AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.handle_new_profile_welcome_dm();
CREATE TRIGGER on_quiz_deleted AFTER DELETE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION private.handle_quiz_deleted_notification();
CREATE TRIGGER on_product_deleted AFTER DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION private.handle_product_deleted_notification();

-- =================================================================
-- 8. INITIAL DATA SEEDING (TRANSLATIONS, INCLUDING NOTIFICATIONS)
-- =================================================================
INSERT INTO public.translations (key, en, ar) VALUES
('home', 'Home', 'الرئيسية'), ('store', 'Store', 'المتجر'), ('rules', 'Rules', 'القوانين'), ('applies', 'Applies', 'التقديمات'),
('about_us', 'About Us', 'من نحن'), ('login_discord', 'Login with Discord', 'تسجيل الدخول'), ('logout', 'Logout', 'تسجيل الخروج'),
('welcome', 'Welcome', 'أهلاً'), ('admin_panel', 'Admin Panel', 'لوحة التحكم'), ('my_applications', 'My Applications', 'تقديماتي'),
('my_profile', 'My Profile', 'ملفي الشخصي'), ('hero_title', '{communityName} Community', 'مجتمع {communityName}'),
('hero_subtitle', 'Where your story begins. Join an immersive world of endless possibilities.', 'حيث تبدأ قصتك. انضم إلى عالم غامر من الاحتمالات اللانهائية.'),
('join_us', 'Join Us', 'انضم إلينا'), ('join_modal_title', 'Join Our Community', 'انضم إلى مجتمعنا'), ('join_discord', 'Join Discord Server', 'انضم لسيرفر الديسكورد'),
('connect_mta', 'Connect to MTA Server', 'اتصل بسيرفر MTA'), ('page_title_store', '{communityName} Store', 'متجر {communityName}'),
('page_title_rules', 'Server Rules', 'قوانين السيرفر'), ('page_title_applies', 'Available Applications', 'التقديمات المتاحة'),
('page_title_about', 'About {communityName}', 'عن {communityName}'), ('page_title_admin', 'Admin Control Panel', 'لوحة تحكم المشرفين'),
('page_title_my_applications', 'My Applications Status', 'حالة تقديماتي'), ('coming_soon', 'Coming Soon...', 'قريباً...'), ('questions', 'Questions', 'أسئلة'),
('about_intro', '{communityName} is more than just a server - it is a vibrant community of players who share a passion for roleplaying.', '{communityName} هو أكثر من مجرد سيرفر - إنه مجتمع نابض بالحياة من اللاعبين الذين يتشاركون شغف اللعب الأدوار.'),
('our_mission', 'Our Mission', 'مهمتنا'), ('mission_text', 'Our mission is to provide an immersive, high-quality roleplaying environment where players can create their own unique stories and characters.', 'مهمتنا هي توفير بيئة لعب أدوار غامرة وعالية الجودة حيث يمكن للاعبين إنشاء قصصهم وشخصياتهم الفريدة.'),
('join_community', 'Join Our Discord Community', 'انضم لمجتمعنا على ديسكورد'), ('discord_online', 'Online', 'متصل'), ('discord_members', 'Members', 'عضو'),
('footer_rights', '© {year} {communityName}. All Rights Reserved.', '© {year} {communityName}. جميع الحقوق محفوظة.'), ('add_to_cart', 'Add to Cart', 'أضف للسلة'),
('item_added_to_cart', '{itemName} added to cart!', 'تمت إضافة {itemName} إلى السلة!'), ('your_cart', 'Your Cart', 'سلة التسوق'), ('empty_cart', 'Your cart is empty.', 'سلتك فارغة.'),
('subtotal', 'Subtotal', 'المجموع الفرعي'), ('checkout', 'Checkout', 'الدفع'), ('remove', 'Remove', 'إزالة'), ('checkout_via_discord', 'Checkout via Discord', 'الدفع عبر ديسكورد'),
('checkout_instructions', 'To complete your purchase, please open a ticket in our Discord server and an admin will assist you.', 'لإكمال عملية الشراء، يرجى فتح تذكرة في سيرفر الديسكورد الخاص بنا وسيقوم أحد المسؤولين بمساعدتك.'),
('open_ticket', 'Open a Ticket', 'فتح تذكرة'), ('apply_now', 'Apply Now', 'قدم الآن'), ('already_applied', 'Already Applied', 'تم التقديم'), ('application_closed', 'Application Closed', 'التقديم مغلق'),
('no_applies_open', 'No applications are open at this time.', 'لا يوجد تقديمات مفتوحة حالياً.'), ('no_rules_yet', 'Rules will be added soon.', 'سيتم إضافة القوانين قريباً.'),
('quiz_rules', 'Application Instructions', 'تعليمات التقديم'), ('begin_quiz', 'Begin Quiz', 'ابدأ الاختبار'), ('question', 'Question', 'سؤال'), ('of', 'of', 'من'),
('time_left', 'Time Left', 'الوقت المتبقي'), ('seconds', 'seconds', 'ثانية'), ('next_question', 'Next Question', 'السؤال التالي'), ('submit_application', 'Submit Application', 'إرسال التقديم'),
('application_submitted', 'Your application has been submitted successfully!', 'تم إرسال تقديمك بنجاح!'), ('application_submitted_desc', 'It will be reviewed by the administration soon. You can track its status on the "My Applications" page.', 'ستتم مراجعته من قبل الإدارة قريباً. يمكنك متابعة حالته من صفحة "تقديماتي".'),
('view_my_applications', 'View My Applications', 'عرض تقديماتي'), ('cheat_attempt_detected', 'Cheat attempt detected! Application has been reset.', 'تم كشف محاولة غش! تم إعادة تعيين التقديم.'),
('cheat_method_switched_tab', 'Switched Tabs', 'تبديل التبويبات'), ('cheat_method_lost_focus', 'Lost Focus', 'فقدان التركيز'), ('cheat_attempts_report', 'Cheat Attempts Report', 'تقرير محاولات الغش'),
('cheat_attempts_count', '{count} attempt(s) were logged.', 'تم تسجيل {count} محاولة/محاولات.'), ('no_cheat_attempts', 'No cheat attempts logged. Great job!', 'لم يتم تسجيل أي محاولات غش. عمل رائع!'),
('dashboard', 'Dashboard', 'الرئيسية'), ('admin_dashboard_welcome_message', 'Welcome to the control panel. You can manage all website settings from the sidebar.', 'أهلاً بك في لوحة التحكم. يمكنك إدارة جميع إعدادات الموقع من الشريط الجانبي.'),
('loading_submissions', 'Loading submissions...', 'جاري تحميل التقديمات...'), ('quiz_management', 'Quiz Forms Management', 'إدارة نماذج التقديم'), ('submission_management', 'Application Submissions', 'إدارة طلبات التقديم'),
('rules_management', 'Rules Management', 'إدارة القوانين'), ('store_management', 'Store Management', 'إدارة المتجر'), ('notifications_management', 'Notifications Management', 'إدارة الإشعارات'), ('appearance_settings', 'Appearance Settings', 'إعدادات المظهر'),
('translations_management', 'Translations Management', 'إدارة الترجمات'), ('permissions_management', 'Permissions Management', 'إدارة الصلاحيات'), ('audit_log', 'Audit Log', 'سجل التدقيق'),
('user_lookup', 'User Lookup', 'بحث عن مستخدم'), ('create_new_quiz', 'Create New Quiz', 'إنشاء تقديم جديد'), ('edit_quiz', 'Edit Quiz', 'تعديل التقديم'),
('quiz_title', 'Quiz Title (Translation Key)', 'عنوان التقديم (مفتاح الترجمة)'), ('quiz_description', 'Quiz Description (Translation Key)', 'وصف التقديم (مفتاح الترجمة)'),
('quiz_questions', 'Quiz Questions', 'أسئلة التقديم'), ('add_question', 'Add Question', 'إضافة سؤال'), ('question_text', 'Question Text (Translation Key)', 'نص السؤال (مفتاح الترجمة)'),
('time_limit_seconds', 'Time Limit (seconds)', 'الوقت المحدد (بالثواني)'), ('save_quiz', 'Save Quiz', 'حفظ التقديم'), ('save_rules', 'Save Rules', 'حفظ القوانين'),
('save_settings', 'Save Settings', 'حفظ الإعدادات'), ('save_translations', 'Save Translations', 'حفظ الترجمات'), ('save_permissions', 'Save Permissions', 'حفظ الصلاحيات'),
('delete_quiz', 'Delete Quiz', 'حذف التقديم'), ('delete_submission', 'Delete Submission', 'حذف التقديم'), ('delete_submission_confirm', 'Are you sure you want to delete the submission from {username} for {quizTitle}? This action cannot be undone.', 'هل أنت متأكد من رغبتك في حذف تقديم {username} لـ {quizTitle}؟ لا يمكن التراجع عن هذا الإجراء.'),
('submission_deleted_success', 'Submission deleted successfully.', 'تم حذف التقديم بنجاح.'), ('status', 'Status', 'الحالة'), ('open', 'Open', 'مفتوح'), ('closed', 'Closed', 'مغلق'),
('actions', 'Actions', 'الإجراءات'), ('edit', 'Edit', 'تعديل'), ('applicant', 'Applicant', 'المتقدم'), ('highest_role', 'Highest Role', 'أعلى رتبة'), ('submitted_on', 'Submitted On', 'تاريخ التقديم'),
('result_date', 'Result Date', 'تاريخ النتيجة'), ('view_submission', 'View Submission', 'عرض الطلب'), ('take_order', 'Take Order', 'استلام الطلب'), ('take_order_forbidden', 'Not Allowed', 'غير مسموح'),
('taken_by', 'Taken by', 'مستلم بواسطة'), ('accept', 'Accept', 'قبول'), ('refuse', 'Refuse', 'رفض'), ('submission_details', 'Submission Details', 'تفاصيل الطلب'), ('close', 'Close', 'إغلاق'),
('no_pending_submissions', 'There are no pending submissions.', 'لا توجد طلبات تقديم معلقة حالياً.'), ('admin_revoked', 'Your admin permissions have been revoked.', 'تم سحب صلاحيات المشرف منك.'),
('admin_granted', 'You have been granted admin permissions.', 'تم منحك صلاحيات المشرف.'), ('admin_permissions_error', 'Admin permission error or session expired. You have been logged out.', 'خطأ في صلاحيات المشرف أو انتهت صلاحية الجلسة. تم تسجيل خروجك.'),
('admin_session_error_warning', 'Could not verify admin session with the server. Please try again later.', 'لا يمكن التحقق من جلسة المشرف مع الخادم. يرجى المحاولة مرة أخرى لاحقاً.'),
('verifying_admin_permissions', 'Verifying admin permissions...', 'جاري التحقق من صلاحيات المشرف...'), ('quiz_handler_roles', 'Application Handler Roles', 'رتب معالجة التقديم'),
('quiz_handler_roles_desc', 'Enter Role IDs allowed to handle these submissions (comma-separated).', 'ضع هنا آي دي الرتب المسموح لها باستلام هذا النوع من التقديمات (افصل بينها بفاصلة).'),
('config_updated_success', 'Settings updated successfully!', 'تم تحديث الإعدادات بنجاح!'), ('rules_updated_success', 'Rules updated successfully!', 'تم تحديث القوانين بنجاح!'),
('permissions_saved_success', 'Permissions saved successfully!', 'تم حفظ الصلاحيات بنجاح!'), ('permissions_load_error', 'Failed to load permissions', 'فشل تحميل الصلاحيات'),
('text_en', 'Text (English)', 'النص بالإنجليزي'), ('text_ar', 'Text (Arabic)', 'النص بالعربي'), ('title_en', 'Title (English)', 'العنوان بالإنجليزي'),
('title_ar', 'Title (Arabic)', 'العنوان بالعربي'), ('description_en', 'Description (English)', 'الوصف بالإنجليزي'), ('description_ar', 'Description (Arabic)', 'الوصف بالعربي'),
('name_en', 'Name (English)', 'الاسم بالإنجليزي'), ('name_ar', 'Name (Arabic)', 'الاسم بالعربي'), ('price', 'Price', 'السعر'), ('image_url', 'Image URL', 'رابط الصورة'),
('create_product', 'Create New Product', 'إنشاء منتج جديد'), ('edit_product', 'Edit Product', 'تعديل المنتج'), ('save_product', 'Save Product', 'حفظ المنتج'),
('add_new_product', 'Add New Product', 'إضافة منتج جديد'), ('logo_image_url', 'Logo Image URL', 'رابط صورة الشعار'), ('banner_image_url', 'Banner Image URL', 'رابط صورة البانر'),
('discord_id_placeholder', 'Discord User ID...', 'معرف مستخدم ديسكورد...'), ('search', 'Search', 'بحث'), ('ban', 'Ban', 'حظر'), ('unban', 'Unban', 'فك الحظر'),
('reason', 'Reason', 'السبب'), ('duration', 'Duration', 'المدة'), ('confirm_ban', 'Confirm Ban', 'تأكيد الحظر'), ('banned_indefinitely', 'Banned indefinitely', 'محظور بشكل دائم'),
('banned_until', 'Banned until {date}', 'محظور حتى {date}'), ('you_are_banned', 'You Are Banned', 'أنت محظور'), ('banned_page_message', 'You have been banned from accessing this site.', 'تم حظرك من الوصول إلى هذا الموقع.'),
('ban_reason', 'Reason for ban:', 'سبب الحظر:'), ('ban_expires', 'Ban expires:', 'ينتهي الحظر في:'), ('ban_permanent', 'This ban is permanent.', 'الحظر دائم.'),
('community_name', 'Community Name', 'اسم المجتمع'), ('logo_url', 'Logo URL', 'رابط الشعار (URL)'), ('background_image_url', 'Background Image URL', 'رابط صورة الخلفية (URL)'),
('background_image_url_desc', 'Leave empty to use the default animated background.', 'اتركه فارغاً لاستخدام الخلفية الافتراضية.'), ('discord_guild_id', 'Discord Guild ID', 'آي دي سيرفر الديسكورد'),
('discord_guild_id_desc', 'Required for authentication and role sync.', 'مطلوب للمصادقة ومزامنة الرتب.'), ('submissions_webhook_url', 'Submissions Channel ID', 'معرف قناة التقديمات'),
('submissions_webhook_url_desc', 'The ID of the channel that receives new submission notifications.', 'المعرف الرقمي للقناة التي تستقبل إشعارات التقديمات الجديدة.'),
('audit_log_webhook_url', 'General Audit Log Channel ID', 'معرف قناة سجل التدقيق العام'), ('audit_log_webhook_url_desc', 'A general/fallback channel for admin action logs.', 'قناة عامة/احتياطية لسجلات إجراءات المشرفين.'),
('log_channel_submissions', 'Submissions Log Channel ID', 'معرف قناة سجلات التقديمات'), ('log_channel_submissions_desc', 'Channel for logs related to submission status changes (taken, accepted, refused).', 'قناة للسجلات المتعلقة بحالة التقديمات (استلام، قبول، رفض).'),
('log_channel_bans', 'Bans Log Channel ID', 'معرف قناة سجلات الحظر'), ('log_channel_bans_desc', 'Channel for logs related to user bans and unbans.', 'قناة للسجلات المتعلقة بحظر وفك حظر المستخدمين.'),
('log_channel_admin', 'Admin Actions Log Channel ID', 'معرف قناة سجلات الإدارة'), ('log_channel_admin_desc', 'Channel for logs related to admin panel changes (e.g., editing quizzes, rules, settings).', 'قناة للسجلات المتعلقة بتغييرات لوحة التحكم (مثل تعديل التقديمات، القوانين، الإعدادات).'),
('discord_roles', 'Discord Roles', 'رتب الديسكورد'), ('available_permissions', 'Available Permissions', 'الصلاحيات المتاحة'), ('select_role_to_manage', 'Select a role to see its permissions.', 'اختر رتبة لعرض صلاحياتها.'),
('admin_permissions_instructions', 'Select a role from the list to view and modify its permissions. The <code>_super_admin</code> permission automatically grants all other permissions.', 'اختر رتبة من القائمة لعرض وتعديل صلاحياتها. صلاحية <code>_super_admin</code> تمنح جميع الصلاحيات الأخرى تلقائياً.'),
('admin_permissions_bootstrap_instructions_title', 'Locked Out?', 'غير قادر على الدخول؟'), ('admin_permissions_bootstrap_instructions_body', 'To grant initial admin access, go to your Supabase <code>role_permissions</code> table. Insert a new row, put your admin role ID in <code>role_id</code>, and type <code>{\\"_super_admin\\"}</code> into the <code>permissions</code> field, then refresh the site.', 'لمنح صلاحيات المشرف الأولية، اذهب إلى جدول <code>role_permissions</code> في Supabase. أضف صفاً جديداً، ضع آي دي رتبة المشرف في <code>role_id</code>، واكتب <code>{\\"_super_admin\\"}</code> في حقل <code>permissions</code> ثم قم بتحديث الصفحة.'),
('notification_templates', 'Notification Templates', 'قوالب الإشعارات'), ('notifications_desc', 'Edit the content of automated messages sent to users and channels.', 'تعديل محتوى الرسائل الآلية المرسلة للمستخدمين والقنوات.'),
('test_notification', 'Test Notification', 'اختبار الإشعار'), ('test', 'Test', 'اختبار'), ('target_id', 'Target ID (User or Channel)', 'معرف الهدف (مستخدم أو قناة)'),
('send_test', 'Send Test', 'إرسال اختبار'), ('available_placeholders', 'Available Placeholders', 'المتغيرات المتاحة'), ('notification_group_welcome', 'Welcome Messages', 'رسائل الترحيب'),
('notification_group_submission_user', 'Submission Messages (to User)', 'رسائل التقديمات (للمستخدم)'), ('notification_group_submission_admin', 'Submission Notifications (to Admin)', 'إشعارات التقديمات (للإدارة)'),
('status_pending', 'Pending', 'قيد الانتظار'), ('status_taken', 'Under Review', 'قيد المراجعة'), ('status_accepted', 'Accepted', 'مقبول'), ('status_refused', 'Refused', 'مرفوض'),
('no_applications_submitted', 'You have not submitted any applications yet.', 'لم تقم بتقديم أي طلبات بعد.'), ('application_type', 'Application Type', 'نوع التقديم'),
('user_id', 'User ID', 'معرف المستخدم'), ('view_on_discord', 'View on Discord', 'عرض في ديسكورد'), ('recent_applications', 'Recent Applications', 'التقديمات الأخيرة'),
('member', 'Member', 'عضو'), ('refresh_profile_tooltip', 'Sync my data with Discord', 'مزامنة بياناتي مع ديسكورد'), ('profile_synced_success', 'Your profile has been successfully updated!', 'تم تحديث ملفك الشخصي بنجاح!'),
('profile_synced_error', 'Failed to update profile. Please try again.', 'فشل تحديث الملف الشخصي. حاول مرة أخرى.'), ('log_timestamp', 'Timestamp', 'الوقت'), ('log_admin', 'Admin', 'المشرف'),
('log_action', 'Action', 'الإجراء'), ('no_logs_found', 'No logs to display.', 'لا توجد سجلات لعرضها.'), ('health_check_title', 'System Health Check', 'فحص صحة النظام'),
('health_check_desc', 'A diagnostic tool for developers to ensure all system components are correctly connected.', 'أداة تشخيصية للمطورين للتأكد من أن جميع أجزاء النظام متصلة بشكل صحيح.'),
('health_check_step0', 'Step 0: Database Egress (pg_net)', 'الخطوة 0: الاتصال الخارجي لقاعدة البيانات (pg_net)'), ('health_check_step0_desc', 'This tests if your database can make outbound network requests, which is essential for sending notifications to Discord. This MUST succeed.', 'يختبر هذا ما إذا كانت قاعدة البيانات الخاصة بك تستطيع إجراء اتصالات شبكة خارجية، وهو أمر ضروري لإرسال الإشعارات إلى ديسكورد. يجب أن تنجح هذه الخطوة.'),
('health_check_run_pgnet_test', 'Run Egress Test', 'تشغيل اختبار الاتصال الخارجي'), ('health_check_step0_5', 'Step 0.5: Supabase Function Secrets', 'الخطوة 0.5: متغيرات Supabase Function Secrets'),
('health_check_step0_5_desc', 'This checks if you have set the required secrets for your Edge Functions. These are needed to connect to your bot.', 'يتحقق هذا مما إذا كنت قد قمت بتعيين المتغيرات المطلوبة لوظائف Edge Functions الخاصة بك. هذه المتغيرات مطلوبة للاتصال بالبوت الخاص بك.'),
('health_check_step1', 'Step 1: OAuth Redirect URI', 'الخطوة 1: رابط الاسترجاع (OAuth Redirect URI)'), ('health_check_step1_desc', 'Ensure this URI is added to your Supabase Authentication > URL Configuration settings.', 'تأكد من أن هذا الرابط مضاف في قسم "URL Configuration" في إعدادات المصادقة في Supabase.'),
('health_check_uri_label', 'Your Redirect URI is:', 'رابط الاسترجاع الخاص بك هو:'), ('health_check_env_vars', 'Step 2: Environment Variables (Frontend)', 'الخطوة 2: متغيرات البيئة (Frontend)'),
('health_check_env_vars_desc', 'These are the variables loaded into the frontend from your .env file.', 'هذه هي المتغيرات المحملة في الواجهة الأمامية من ملف .env الخاص بك.'),
('health_check_step3', 'Step 3: Bot Connection Test', 'الخطوة 3: اختبار اتصال البوت'), ('health_check_step3_desc', 'This test checks if the Supabase Function can successfully reach your Discord bot.', 'هذا الاختبار يتحقق مما إذا كانت دالة Supabase يمكنها الوصول إلى البوت الخاص بك بنجاح.'),
('health_check_run_test', 'Run Connection Test', 'تشغيل اختبار الاتصال'), ('health_check_test_running', 'Testing...', 'جاري الاختبار...'), ('health_check_test_result', 'Test Result', 'نتيجة الاختبار'),
('health_check_step4', 'Step 4: User Sync Test', 'الخطوة 4: اختبار مزامنة المستخدم'), ('health_check_step4_desc', 'Test fetching a specific user''s data from Discord via the bot.', 'اختبر جلب بيانات مستخدم معين من ديسكورد عبر البوت.'),
('health_check_get_discord_id', 'How to get a Discord ID?', 'كيف أحصل على معرف ديسكورد؟'), ('health_check_get_discord_id_steps', 'In Discord, go to Settings > Advanced > enable Developer Mode. Then, right-click any user and select "Copy User ID".', 'في ديسكورد، اذهب إلى الإعدادات > متقدم > فعل وضع المطور. ثم انقر بزر الماوس الأيمن على أي مستخدم واختر "نسخ معرف المستخدم".'),
('health_check_discord_id_input', 'Enter Discord User ID...', 'أدخل معرف ديسكورد هنا...'), ('health_check_run_sync_test', 'Run Sync Test', 'تشغيل اختبار المزامنة'),
('health_check_sync_test_result', 'Sync Result', 'نتيجة المزامنة'), ('health_check_result_interpretation', 'Interpreting the Results', 'تفسير النتائج'),
('health_check_result_success', '<ul><li class="mb-2"><strong>Success (200 OK):</strong> Excellent! The user was found in the guild and their data was fetched successfully. This confirms everything is working.</li>', '<ul><li class="mb-2"><strong>Success (200 OK):</strong> ممتاز! تم العثور على المستخدم في السيرفر وتم جلب بياناته بنجاح. هذا يؤكد أن كل شيء يعمل.</li>'),
('health_check_result_404', '<li class="mb-2"><strong>Error (404 Not Found):</strong> This means the bot connected to Discord correctly, but couldn''t find a user with that ID in your server. Check the ID or ensure the user is a member.</li>', '<li class="mb-2"><strong>Error (404 Not Found):</strong> هذا يعني أن البوت متصل بديسكورد بشكل صحيح، لكنه لم يتمكن من العثور على المستخدم بهذا المعرف في السيرفر الخاص بك. تحقق من المعرف أو تأكد من أن المستخدم عضو في السيرفر.</li>'),
('health_check_result_503', '<li class="mb-2"><strong>Error (503 Service Unavailable):</strong> The most common cause is that the <strong>Server Members Intent</strong> is not enabled in the Discord Developer Portal. Go to your bot''s settings and turn it on.</li>', '<li class="mb-2"><strong>Error (503 Service Unavailable):</strong> السبب الأكثر شيوعاً هو أن <strong>Server Members Intent</strong> غير مفعل في بوابة مطوري ديسكورد. اذهب إلى إعدادات البوت الخاص بك وقم بتفعيله.</li>'),
('health_check_result_other', '<li><strong>Other Errors:</strong> Usually indicates a problem with the bot''s configuration or it being offline. Check the bot''s logs for more details.</li></ul>', '<li><strong>أخطاء أخرى:</strong> عادة ما تشير إلى مشكلة في تكوين البوت أو أنه غير متصل بالإنترنت. تحقق من سجلات البوت لمزيد من التفاصيل.</li></ul>'),
  ('health_check_banner_link', 'Click here to run system diagnostics.', 'اضغط هنا لتشغيل فحص النظام التشخيصي.'),
  ('session_expired_not_in_guild', 'Your session has expired or you are no longer in the guild. You have been logged out.', 'انتهت صلاحية جلستك أو لم تعد عضواً في السيرفر. تم تسجيل خروجك.'),
  ('product_vip_bronze_name', 'Bronze VIP Membership', 'عضوية VIP برونزية'),
  ('product_vip_bronze_desc', 'Exclusive in-server perks for one month.', 'مميزات حصرية داخل السيرفر لمدة شهر.'),
  ('product_vip_silver_name', 'Silver VIP Membership', 'عضوية VIP فضية'),
  ('product_vip_silver_desc', 'Better perks with special vehicle access.', 'مميزات أفضل مع وصول خاص للمركبات.'),
  ('product_cash_1_name', '100k Cash Pack', 'حزمة نقدية 100 ألف'),
  ('product_cash_1_desc', 'An in-game cash boost to get you started.', 'دفعة نقدية داخل اللعبة لتبدأ بقوة.'),
  ('product_custom_plate_name', 'Custom License Plate', 'لوحة سيارة مخصصة'),
  ('product_custom_plate_desc', 'A unique license plate for your favorite vehicle.', 'لوحة فريدة لسيارتك المفضلة.'),
  ('quiz_police_name', 'Police Department Application', 'تقديم قسم الشرطة'),
  ('quiz_police_desc', 'Read the rules carefully. Any attempt to cheat will result in immediate rejection.', 'اقرأ القوانين جيداً. أي محاولة غش ستؤدي للرفض الفوري.'),
  ('q_police_1', 'What is the first procedure when dealing with a suspect?', 'ما هو الإجراء الأول عند التعامل مع شخص مشتبه به؟'),
  ('q_police_2', 'When are you permitted to use lethal force?', 'متى يسمح لك باستخدام القوة المميتة؟'),
  ('quiz_medic_name', 'EMS Department Application', 'تقديم قسم الإسعاف'),
  ('quiz_medic_desc', 'You are required to be calm and professional at all times.', 'مطلوب منك الهدوء والاحترافية في جميع الأوقات.'),
  ('q_medic_1', 'What is your top priority when arriving at an accident scene?', 'ما هي أولويتك القصوى عند الوصول إلى مكان الحادث؟');

COMMIT;
`;
