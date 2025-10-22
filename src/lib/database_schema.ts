// @ts-nocheck
-- Vixel Roleplay - Supabase Database Schema
-- Version: 2.5.1 (Bot-Dependent Architecture with Fail-Safes)
-- Description: This version adds exception handling to all Discord notification calls.
-- This prevents the entire database transaction from failing if the Discord bot is unreachable or the 'supabase_functions' extension is not enabled.

-- Drop existing functions and tables to ensure a clean slate.
DROP FUNCTION IF EXISTS public.get_current_user_roles() CASCADE;
DROP FUNCTION IF EXISTS public.has_permission(text) CASCADE;
DROP FUNCTION IF EXISTS public.log_audit_action(text,text) CASCADE;
DROP FUNCTION IF EXISTS public.log_admin_access() CASCADE;
DROP FUNCTION IF EXISTS public.notify_new_submission() CASCADE;
DROP FUNCTION IF EXISTS public.save_role_permissions(text, text[]) CASCADE;
DROP FUNCTION IF EXISTS public.save_rules(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.update_submission_status(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_translations(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Drop triggers and policies before tables
DROP TRIGGER IF EXISTS on_submission_insert ON public.submissions;
ALTER TABLE IF EXISTS public.submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quizzes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.config DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS public.role_permissions;
DROP TABLE IF EXISTS public.translations;
DROP TABLE IF EXISTS public.rules;
DROP TABLE IF EXISTS public.rule_categories;
DROP TABLE IF EXISTS public.audit_logs;
DROP TABLE IF EXISTS public.submissions;
DROP TABLE IF EXISTS public.quizzes;
DROP TABLE IF EXISTS public.products;
DROP TABLE IF EXISTS public.profiles;
DROP TABLE IF EXISTS public.config;

-- ========== TABLES ==========

-- CONFIG: Stores global site configuration. Uses Channel IDs for the bot.
CREATE TABLE public.config (
    id smallint PRIMARY KEY DEFAULT 1,
    "COMMUNITY_NAME" text NOT NULL DEFAULT 'Vixel',
    "LOGO_URL" text,
    "BACKGROUND_IMAGE_URL" text,
    "DISCORD_GUILD_ID" text,
    "DISCORD_INVITE_URL" text,
    "MTA_SERVER_URL" text,
    "SHOW_HEALTH_CHECK" boolean DEFAULT true,
    "SUBMISSIONS_CHANNEL_ID" text,
    "AUDIT_LOG_CHANNEL_ID" text,
    CONSTRAINT id_check CHECK (id = 1)
);
INSERT INTO public.config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.config FOR SELECT USING (true);


-- PROFILES: Stores user-specific data, linked to auth.users
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    discord_id text UNIQUE,
    roles jsonb,
    highest_role jsonb,
    last_synced_at timestamptz
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to read their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);


-- PRODUCTS: For the store page
CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "nameKey" text NOT NULL,
    "descriptionKey" text,
    price numeric(10, 2) NOT NULL,
    "imageUrl" text
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.products FOR SELECT USING (true);


-- QUIZZES: Application forms
CREATE TABLE public.quizzes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "titleKey" text NOT NULL,
    "descriptionKey" text,
    questions jsonb NOT NULL,
    "isOpen" boolean DEFAULT false,
    "allowedTakeRoles" text[],
    "lastOpenedAt" timestamptz,
    "logoUrl" text,
    "bannerUrl" text
);
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.quizzes FOR SELECT USING (true);


-- SUBMISSIONS: User applications from quizzes
CREATE TABLE public.submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "quizId" uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    "quizTitle" text NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username text NOT NULL,
    answers jsonb NOT NULL,
    "submittedAt" timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'pending',
    "adminId" uuid REFERENCES auth.users(id),
    "adminUsername" text,
    "updatedAt" timestamptz,
    user_highest_role text,
    "cheatAttempts" jsonb
);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;


-- AUDIT_LOGS: Records admin actions
CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp timestamptz NOT NULL DEFAULT now(),
    admin_id uuid NOT NULL REFERENCES auth.users(id),
    admin_username text NOT NULL,
    admin_discord_id text,
    action text NOT NULL
);


-- RULES & CATEGORIES: For the rules page
CREATE TABLE public.rule_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "titleKey" text NOT NULL,
    "order" smallint NOT NULL
);
CREATE TABLE public.rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL REFERENCES public.rule_categories(id) ON DELETE CASCADE,
    "textKey" text NOT NULL,
    "order" smallint NOT NULL
);


-- TRANSLATIONS: For website content
CREATE TABLE public.translations (
    key text PRIMARY KEY,
    en text,
    ar text
);


-- ROLE_PERMISSIONS: The core of the RBAC system
CREATE TABLE public.role_permissions (
    role_id text PRIMARY KEY,
    permissions text[] NOT NULL
);

-- =================================================================
-- IMPORTANT: INITIAL ADMIN SETUP (MANUAL)
-- =================================================================
-- This system does NOT automatically grant admin permissions. You MUST set up the first admin role manually.
-- 1. Get the Discord Role ID for your main admin/owner role. (Enable Developer Mode in Discord, right-click the role, click "Copy Role ID").
-- 2. Run the following command in the SQL Editor, replacing 'YOUR_ADMIN_ROLE_ID' with the actual ID.
--
-- INSERT INTO public.role_permissions (role_id, permissions)
-- VALUES ('YOUR_ADMIN_ROLE_ID', '{"_super_admin"}');
--
-- This will grant the specified role all permissions. You can then manage other roles from the website's admin panel.
-- =================================================================


-- ========== RLS HELPER FUNCTIONS ==========

CREATE OR REPLACE FUNCTION get_current_user_roles()
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role_ids text[];
BEGIN
  SELECT array_agg(r->>'id') FROM public.profiles, jsonb_array_elements(roles) AS r
  WHERE id = auth.uid() INTO v_role_ids;
  RETURN COALESCE(v_role_ids, '{}');
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_current_user_roles() TO authenticated;


CREATE OR REPLACE FUNCTION has_permission(p_permission_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_role_ids text[]; v_has_super_admin boolean; v_has_permission boolean;
BEGIN
  SELECT public.get_current_user_roles() INTO v_user_role_ids;
  SELECT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = ANY(v_user_role_ids) AND permissions @> '["_super_admin"]') INTO v_has_super_admin;
  IF v_has_super_admin THEN RETURN true; END IF;
  SELECT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = ANY(v_user_role_ids) AND permissions @> jsonb_build_array(p_permission_key)) INTO v_has_permission;
  RETURN v_has_permission;
END;
$$;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;


-- ========== RLS POLICIES ==========

CREATE POLICY "Allow users to see their own submissions" ON public.submissions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Allow admins to see all submissions" ON public.submissions FOR SELECT USING (public.has_permission('admin_submissions'));
CREATE POLICY "Allow authenticated users to insert submissions" ON public.submissions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow admins to manage quizzes" ON public.quizzes FOR ALL USING (public.has_permission('admin_quizzes'));
CREATE POLICY "Allow admins to manage products" ON public.products FOR ALL USING (public.has_permission('admin_store'));


-- ========== TRIGGERS & FUNCTIONS ==========

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, discord_id)
  VALUES (new.id, new.raw_user_meta_data->>'provider_id');
  RETURN new;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


CREATE OR REPLACE FUNCTION log_audit_action(p_title text, p_description text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_username text := COALESCE(
    (auth.jwt())->'user_metadata'->>'full_name',
    (auth.jwt())->>'user_name'
  );
  v_discord_id text := (auth.jwt())->'user_metadata'->>'provider_id';
  v_payload jsonb;
  v_channel_id text;
  v_full_action text := p_title || ': ' || p_description;
BEGIN
  IF v_user_id IS NULL OR v_username IS NULL THEN
    RAISE LOG 'log_audit_action called with null user_id or username. Skipping audit log insert.';
    RETURN;
  END IF;

  INSERT INTO public.audit_logs (admin_id, admin_username, admin_discord_id, action)
  VALUES (v_user_id, v_username, v_discord_id, v_full_action);

  SELECT "AUDIT_LOG_CHANNEL_ID" INTO v_channel_id FROM public.config WHERE id=1;
  IF v_channel_id IS NOT NULL AND v_channel_id <> '' THEN
    BEGIN
      v_payload := jsonb_build_object(
          'type', 'channel',
          'targetId', v_channel_id,
          'embed', jsonb_build_object(
              'author', jsonb_build_object('name', v_username),
              'title', p_title,
              'description', p_description,
              'color', 15158332, -- Red
              'timestamp', now()
          )
      );
      PERFORM supabase_functions.http_request('discord-proxy', 'POST', '{"Content-Type":"application/json"}', '{}', v_payload::text);
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to send Discord notification in log_audit_action. Error: %', SQLERRM;
    END;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_audit_action(text,text) TO authenticated;


CREATE OR REPLACE FUNCTION log_admin_access()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN PERFORM public.log_audit_action('🖥️ Admin Panel Accessed', 'User accessed the admin control panel.'); END;
$$;
GRANT EXECUTE ON FUNCTION public.log_admin_access() TO authenticated;


CREATE OR REPLACE FUNCTION public.notify_new_submission()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  payload jsonb;
  v_community_name text;
  v_logo_url text;
  v_channel_id text;
BEGIN
  SELECT "COMMUNITY_NAME", "LOGO_URL", "SUBMISSIONS_CHANNEL_ID" INTO v_community_name, v_logo_url, v_channel_id FROM public.config WHERE id = 1;

  IF v_channel_id IS NOT NULL AND v_channel_id <> '' THEN
    BEGIN
      payload := jsonb_build_object(
        'type', 'channel',
        'targetId', v_channel_id,
        'embed', jsonb_build_object(
            'author', jsonb_build_object('name', new.username, 'icon_url', (SELECT raw_user_meta_data->>'avatar_url' FROM auth.users WHERE id = new.user_id)),
            'title', 'New Application Submitted',
            'description', format('**%s** has submitted an application for **%s**. An admin can now claim it from the website.', new.username, new."quizTitle"),
            'color', 15105570, -- Orange
            'footer', jsonb_build_object('text', v_community_name, 'icon_url', v_logo_url),
            'timestamp', new."submittedAt"
        )
      );
      PERFORM supabase_functions.http_request('discord-proxy', 'POST', '{"Content-Type":"application/json"}', '{}', payload::text);
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to send new submission notification. Error: %', SQLERRM;
    END;
  END IF;

  RETURN new;
END;
$$;
CREATE TRIGGER on_submission_insert
  AFTER INSERT ON public.submissions FOR EACH ROW EXECUTE PROCEDURE public.notify_new_submission();


CREATE OR REPLACE FUNCTION save_role_permissions(p_role_id text, p_permissions text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action_desc text;
BEGIN
  IF NOT public.has_permission('admin_permissions') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  
  v_action_desc := 'Updated permissions for role ID \`' || p_role_id || '\`. New permissions: \`' || array_to_string(p_permissions, ', ') || '\`';
  PERFORM public.log_audit_action('🔐 Permissions Updated', v_action_desc);

  INSERT INTO public.role_permissions (role_id, permissions) VALUES (p_role_id, p_permissions)
  ON CONFLICT (role_id) DO UPDATE SET permissions = EXCLUDED.permissions;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_role_permissions(text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION save_rules(p_rules_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission('admin_rules') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM public.log_audit_action('📚 Rules Updated', 'The server rules have been updated from the admin panel.');
  TRUNCATE TABLE public.rules, public.rule_categories RESTART IDENTITY;
  INSERT INTO public.rule_categories (id, "titleKey", "order")
  SELECT (d->>'id')::uuid, d->>'titleKey', (d->>'order')::smallint FROM jsonb_array_elements(p_rules_data) d;
  INSERT INTO public.rules (id, category_id, "textKey", "order")
  SELECT (r->>'id')::uuid, (d->>'id')::uuid, r->>'textKey', (r->>'order')::smallint
  FROM jsonb_array_elements(p_rules_data) d, jsonb_array_elements(d->'rules') r;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_rules(jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION update_submission_status(p_submission_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_submission record; v_allowed_roles text[]; v_user_roles text[]; v_is_allowed boolean := false; v_is_super_admin boolean := false;
  v_admin_username text := (auth.jwt())->>'user_name';
  v_user_discord_id text; v_community_name text; v_logo_url text; v_payload jsonb; v_action_title text; v_action_desc text; v_action_color int;
BEGIN
  SELECT * INTO v_submission FROM public.submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  SELECT "allowedTakeRoles" INTO v_allowed_roles FROM public.quizzes WHERE id = v_submission."quizId";
  v_user_roles := get_current_user_roles();
  v_is_super_admin := public.has_permission('_super_admin');
  
  IF v_is_super_admin OR v_allowed_roles IS NULL OR array_length(v_allowed_roles, 1) IS NULL THEN v_is_allowed := true;
  ELSE SELECT EXISTS (SELECT 1 FROM unnest(v_user_roles) r WHERE r = ANY(v_allowed_roles)) INTO v_is_allowed;
  END IF;

  IF p_status = 'taken' THEN
    IF v_submission.status != 'pending' THEN RAISE EXCEPTION 'This submission has already been handled.'; END IF;
    IF NOT v_is_allowed THEN RAISE EXCEPTION 'Do not have permission to handle this application type.'; END IF;
    UPDATE public.submissions SET status = 'taken', "adminId" = auth.uid(), "adminUsername" = v_admin_username, "updatedAt" = now() WHERE id = p_submission_id;
    PERFORM public.log_audit_action('📝 Application Claimed', format('Admin **%s** is now reviewing **%s''s** application for **%s**.', v_admin_username, v_submission.username, v_submission."quizTitle"));
  ELSE
    IF v_submission.status != 'taken' THEN RAISE EXCEPTION 'Submission must be taken before a decision is made.'; END IF;
    IF v_submission."adminId" != auth.uid() AND NOT v_is_super_admin THEN RAISE EXCEPTION 'You are not the assigned handler for this submission.'; END IF;
    UPDATE public.submissions SET status = p_status, "updatedAt" = now() WHERE id = p_submission_id;

    IF p_status = 'accepted' THEN
      v_action_title := '✅ Application Accepted';
      v_action_desc := format('Admin **%s** accepted **%s''s** application for **%s**.', v_admin_username, v_submission.username, v_submission."quizTitle");
      v_action_color := 5763719; -- Green
    ELSIF p_status = 'refused' THEN
      v_action_title := '❌ Application Refused';
      v_action_desc := format('Admin **%s** refused **%s''s** application for **%s**.', v_admin_username, v_submission.username, v_submission."quizTitle");
      v_action_color := 15548997; -- Dark Red
    ELSE RAISE EXCEPTION 'Invalid status provided.';
    END IF;
    PERFORM public.log_audit_action(v_action_title, v_action_desc);

    -- Send DM to the user
    SELECT p.discord_id INTO v_user_discord_id FROM public.profiles p WHERE p.id = v_submission.user_id;
    SELECT "COMMUNITY_NAME", "LOGO_URL" INTO v_community_name, v_logo_url FROM public.config WHERE id=1;

    IF v_user_discord_id IS NOT NULL THEN
      BEGIN
        v_payload := jsonb_build_object(
          'type', 'dm',
          'targetId', v_user_discord_id,
          'embed', jsonb_build_object(
              'title', format('Your application for "%s" has been updated!', v_submission."quizTitle"),
              'description', format('Hello %s,\nYour application has been **%s**.\n\nThank you for your interest in our community.', v_submission.username, p_status),
              'color', v_action_color,
              'footer', jsonb_build_object('text', v_community_name, 'icon_url', v_logo_url)
          )
        );
        PERFORM supabase_functions.http_request('discord-proxy', 'POST', '{"Content-Type":"application/json"}', '{}', v_payload::text);
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Failed to send submission status DM. Error: %', SQLERRM;
      END;
    END IF;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_submission_status(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION update_translations(translations_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.has_permission('admin_translations') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM public.log_audit_action('🌐 Translations Updated', 'Website translations have been updated.');
  INSERT INTO public.translations (key, en, ar)
  SELECT t.key, t.en, t.ar FROM jsonb_to_recordset(translations_data) AS t(key text, en text, ar text)
  ON CONFLICT (key) DO UPDATE SET en = EXCLUDED.en, ar = EXCLUDED.ar;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_translations(jsonb) TO authenticated;