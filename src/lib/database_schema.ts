// Vixel Roleplay - Supabase Database Schema
// Version: 1.7.0
// Description: This file contains all the SQL commands to set up the database schema,
// tables, roles, functions, and RLS policies required for the Vixel website.
// To use, copy the entire content of this file and run it in the Supabase SQL Editor.

export const DATABASE_SCHEMA = `
-- Drop existing functions and tables to ensure a clean slate.
-- This is safe to run multiple times.
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

-- ========== EXTENSIONS ==========
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- ========== TABLES ==========

-- CONFIG: Stores global site configuration
CREATE TABLE public.config (
    id smallint PRIMARY KEY DEFAULT 1,
    "COMMUNITY_NAME" text NOT NULL DEFAULT 'Vixel',
    "LOGO_URL" text,
    "BACKGROUND_IMAGE_URL" text,
    "DISCORD_GUILD_ID" text,
    "DISCORD_INVITE_URL" text,
    "MTA_SERVER_URL" text,
    "SHOW_HEALTH_CHECK" boolean DEFAULT false,
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
  v_username text := auth.jwt()->>'user_name';
  v_discord_id text := auth.jwt()->'user_metadata'->>'provider_id';
  v_payload jsonb;
  v_full_action text := CONCAT(p_title, ': ', p_description);
BEGIN
  INSERT INTO public.audit_logs (admin_id, admin_username, admin_discord_id, action)
  VALUES (v_user_id, v_username, v_discord_id, v_full_action);

  v_payload := jsonb_build_object(
    'type', 'audit',
    'payload', jsonb_build_object(
      'embed', jsonb_build_object(
        'author', jsonb_build_object('name', v_username),
        'title', p_title,
        'description', p_description,
        'color', 15158332,
        'timestamp', now()
      )
    )
  );
  PERFORM net.http_post(
    url:=(SELECT value FROM private.env_vars WHERE name = 'SUPABASE_DISCORD_PROXY_URL'),
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || (SELECT value FROM private.env_vars WHERE name = 'SUPABASE_SERVICE_ROLE_KEY') || '"}'::jsonb,
    body:=v_payload
  );
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
BEGIN
  SELECT "COMMUNITY_NAME", "LOGO_URL" INTO v_community_name, v_logo_url FROM public.config WHERE id = 1;
  
  -- Notify submissions channel
  payload := jsonb_build_object(
    'type', 'submissions',
    'payload', jsonb_build_object(
      'embed', jsonb_build_object(
        'author', jsonb_build_object('name', new.username, 'icon_url', (SELECT raw_user_meta_data->>'avatar_url' FROM auth.users WHERE id = new.user_id)),
        'title', 'New Application Submitted',
        'description', '**' || new.username || '** has submitted an application for **' || new."quizTitle" || '**. An admin can now claim it from the website.',
        'color', 15105570,
        'footer', jsonb_build_object('text', v_community_name, 'icon_url', v_logo_url),
        'timestamp', new."submittedAt"
      )
    )
  );
  PERFORM net.http_post(
    url:=(SELECT value FROM private.env_vars WHERE name = 'SUPABASE_DISCORD_PROXY_URL'),
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || (SELECT value FROM private.env_vars WHERE name = 'SUPABASE_SERVICE_ROLE_KEY') || '"}'::jsonb,
    body:=payload
  );

  -- Send DM to user
  payload := jsonb_build_object(
      'type', 'dm',
      'payload', jsonb_build_object(
          'userId', (SELECT discord_id FROM public.profiles WHERE id = new.user_id),
          'embed', jsonb_build_object(
            'title', '✅ Your Application has been Received!',
            'description', 'Thank you, **' || new.username || '**! We have successfully received your application for **' || new."quizTitle" || '**. Our staff will review it soon. You can check the status on the "My Applications" page on our website.',
            'color', 5763719,
            'footer', jsonb_build_object('text', v_community_name, 'icon_url', v_logo_url),
            'timestamp', now()
          )
      )
  );
  PERFORM net.http_post(
    url:=(SELECT value FROM private.env_vars WHERE name = 'SUPABASE_DISCORD_PROXY_URL'),
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || (SELECT value FROM private.env_vars WHERE name = 'SUPABASE_SERVICE_ROLE_KEY') || '"}'::jsonb,
    body:=payload
  );
  RETURN new;
END;
$$;
CREATE TRIGGER on_submission_insert
  AFTER INSERT ON public.submissions FOR EACH ROW EXECUTE PROCEDURE public.notify_new_submission();


CREATE OR REPLACE FUNCTION save_role_permissions(p_role_id text, p_permissions text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission('admin_permissions') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM public.log_audit_action('🔐 Permissions Updated', CONCAT('Updated permissions for role ID `', p_role_id, '`. New permissions: `', array_to_string(p_permissions, ', '), '`'));
  INSERT INTO public.role_permissions (role_id, permissions) VALUES (p_role_id, p_permissions)
  ON CONFLICT (role_id) DO UPDATE SET permissions = EXCLUDED.permissions;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_role_permissions(text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION save_rules(p_rules_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  category_record record;
  rule_record record;
BEGIN
  IF NOT public.has_permission('admin_rules') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  
  PERFORM public.log_audit_action('📚 Rules Updated', 'The server rules have been updated from the admin panel.');
  
  TRUNCATE TABLE public.rules, public.rule_categories RESTART IDENTITY;

  FOR category_record IN SELECT * FROM jsonb_to_recordset(p_rules_data) AS x(id uuid, "titleKey" text, "order" int)
  LOOP
    INSERT INTO public.rule_categories(id, "titleKey", "order") 
    VALUES (category_record.id, category_record."titleKey", category_record."order");

    FOR rule_record IN SELECT * FROM jsonb_to_recordset(
        (SELECT rules FROM jsonb_to_record(category_record) AS y(rules jsonb))
    ) AS z(id uuid, "textKey" text, "order" int)
    LOOP
      INSERT INTO public.rules(id, category_id, "textKey", "order")
      VALUES (rule_record.id, category_record.id, rule_record."textKey", rule_record."order");
    END LOOP;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_rules(jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION update_submission_status(p_submission_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_submission record; v_allowed_roles text[]; v_user_roles text[]; v_is_allowed boolean := false; v_is_super_admin boolean := false;
  v_payload jsonb; v_dm_embed jsonb; v_community_name text; v_logo_url text;
  v_admin_username text;
BEGIN
-- FIX: Wrap auth.jwt() in parentheses to avoid linter parsing errors.
  v_admin_username := (auth.jwt())->>'user_name';
  SELECT "COMMUNITY_NAME", "LOGO_URL" INTO v_community_name, v_logo_url FROM public.config WHERE id = 1;
  SELECT * INTO v_submission FROM public.submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  SELECT "allowedTakeRoles" INTO v_allowed_roles FROM public.quizzes WHERE id = v_submission."quizId";
  -- FIX: Changed SELECT ... INTO to direct assignment to avoid linter errors.
  v_user_roles := get_current_user_roles();
  SELECT public.has_permission('_super_admin') INTO v_is_super_admin;
  
  IF v_is_super_admin OR v_allowed_roles IS NULL OR array_length(v_allowed_roles, 1) IS NULL THEN v_is_allowed := true;
  ELSE SELECT EXISTS (SELECT 1 FROM unnest(v_user_roles) r WHERE r = ANY(v_allowed_roles)) INTO v_is_allowed;
  END IF;

  IF p_status = 'taken' THEN
    IF v_submission.status != 'pending' THEN RAISE EXCEPTION 'This submission has already been handled.'; END IF;
    IF NOT v_is_allowed THEN RAISE EXCEPTION 'You do not have permission to handle this application type.'; END IF;
    UPDATE public.submissions SET status = 'taken', "adminId" = auth.uid(), "adminUsername" = v_admin_username, "updatedAt" = now() WHERE id = p_submission_id;
    PERFORM public.log_audit_action('📝 Application Claimed', 'Admin **' || v_admin_username || '** is now reviewing **' || v_submission.username || '''s** application for **' || v_submission."quizTitle" || '**.');
    v_dm_embed := jsonb_build_object('title', '👀 Your Application is Under Review!', 'description', 'Good news, **' || v_submission.username || '**! Your application for **' || v_submission."quizTitle" || '** is now being reviewed by **' || v_admin_username || '**.', 'color', 3447003);
  ELSIF p_status = 'accepted' THEN
    IF v_submission.status != 'taken' THEN RAISE EXCEPTION 'Submission must be taken before a decision is made.'; END IF;
    IF v_submission."adminId" != auth.uid() AND NOT v_is_super_admin THEN RAISE EXCEPTION 'You are not the assigned handler for this submission.'; END IF;
    UPDATE public.submissions SET status = 'accepted', "updatedAt" = now() WHERE id = p_submission_id;
    PERFORM public.log_audit_action('✅ Application Accepted', 'Admin **' || v_admin_username || '** accepted **' || v_submission.username || '''s** application for **' || v_submission."quizTitle" || '**.');
    v_dm_embed := jsonb_build_object('title', '🎉 Congratulations! Your Application was Accepted!', 'description', 'Excellent news, **' || v_submission.username || '**! Your application for **' || v_submission."quizTitle" || '** has been **accepted**. Please check the relevant channels on Discord for further instructions.', 'color', 5763719);
  ELSIF p_status = 'refused' THEN
    IF v_submission.status != 'taken' THEN RAISE EXCEPTION 'Submission must be taken before a decision is made.'; END IF;
    IF v_submission."adminId" != auth.uid() AND NOT v_is_super_admin THEN RAISE EXCEPTION 'You are not the assigned handler for this submission.'; END IF;
    UPDATE public.submissions SET status = 'refused', "updatedAt" = now() WHERE id = p_submission_id;
    PERFORM public.log_audit_action('❌ Application Refused', 'Admin **' || v_admin_username || '** refused **' || v_submission.username || '''s** application for **' || v_submission."quizTitle" || '**.');
    v_dm_embed := jsonb_build_object('title', '📄 Application Update', 'description', 'Hello **' || v_submission.username || '**, after careful review, your application for **' || v_submission."quizTitle" || '** was not accepted at this time. Don''t be discouraged! You may be able to re-apply in the future.', 'color', 15548997);
  ELSE RAISE EXCEPTION 'Invalid status provided.';
  END IF;

  v_dm_embed := v_dm_embed || jsonb_build_object('footer', jsonb_build_object('text', v_community_name, 'icon_url', v_logo_url), 'timestamp', now());
  v_payload := jsonb_build_object('type', 'dm', 'payload', jsonb_build_object('userId', (SELECT discord_id FROM public.profiles WHERE id = v_submission.user_id), 'embed', v_dm_embed));
  PERFORM net.http_post(
    url:=(SELECT value FROM private.env_vars WHERE name = 'SUPABASE_DISCORD_PROXY_URL'),
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || (SELECT value FROM private.env_vars WHERE name = 'SUPABASE_SERVICE_ROLE_KEY') || '"}'::jsonb,
    body:=v_payload
  );
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

-- Create the private schema if it doesn't exist to store secrets securely.
CREATE SCHEMA IF NOT EXISTS private;

-- Add a private table for storing environment variables securely
CREATE TABLE IF NOT EXISTS private.env_vars (name text primary key, value text);
ALTER TABLE private.env_vars ENABLE ROW LEVEL SECURITY;

-- IMPORTANT: YOU MUST MANUALLY INSERT YOUR SECRETS INTO THIS TABLE
-- REPLACE THE PLACEHOLDERS WITH YOUR ACTUAL VALUES
-- THIS IS A ONE-TIME SETUP
-- Example:
-- INSERT INTO private.env_vars (name, value) VALUES ('SUPABASE_SERVICE_ROLE_KEY', 'your_actual_service_role_key');
-- INSERT INTO private.env_vars (name, value) VALUES ('SUPABASE_DISCORD_PROXY_URL', 'https://project-ref.supabase.co/functions/v1/discord-proxy');

`;