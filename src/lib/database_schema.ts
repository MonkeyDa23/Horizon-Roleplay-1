// src/lib/database_schema.ts

export const databaseSchema = `
/*
 Vixel Roleplay Community Hub - Full Database Schema
 Copyright © 2024 Vixel Roleplay. All Rights Reserved.

 !! WARNING !!
 This script is DESTRUCTIVE. It will completely DROP all existing website-related tables,
 functions, and data before recreating the entire schema. This is intended for development
 or for a clean installation. DO NOT run this on a production database with live user data
 unless you intend to wipe it completely.

 INSTRUCTIONS:
 1. Go to your Supabase Project Dashboard -> SQL Editor.
 2. Click "+ New query".
 3. Copy the ENTIRE content of this file, paste it into the editor, and click "RUN".

*/

-- Wrap the entire script in a transaction to ensure it either completes fully or not at all.
BEGIN;

-- =================================================================
-- 1. DESTRUCTIVE RESET: Drop all existing objects
-- =================================================================
DROP SCHEMA IF EXISTS private CASCADE;
DROP TABLE IF EXISTS public.staff CASCADE;
DROP TABLE IF EXISTS public.discord_widgets CASCADE;
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

DROP FUNCTION IF EXISTS public.get_staff();
DROP FUNCTION IF EXISTS public.save_staff(jsonb);
DROP FUNCTION IF EXISTS public.get_config();
DROP FUNCTION IF EXISTS public.get_all_submissions();
DROP FUNCTION IF EXISTS public.add_submission(jsonb);
DROP FUNCTION IF EXISTS public.update_submission_status(uuid, text, text);
DROP FUNCTION IF EXISTS public.delete_submission(uuid);
DROP FUNCTION IF EXISTS public.save_quiz_with_translations(jsonb);
DROP FUNCTION IF EXISTS public.save_product_with_translations(jsonb);
DROP FUNCTION IF EXISTS public.save_rules(jsonb);
DROP FUNCTION IF EXISTS public.save_discord_widgets(jsonb);
DROP FUNCTION IF EXISTS public.update_config(jsonb);
DROP FUNCTION IF EXISTS public.log_action(text, text);
DROP FUNCTION IF EXISTS public.log_page_visit(text);
DROP FUNCTION IF EXISTS public.ban_user(uuid, text, int);
DROP FUNCTION IF EXISTS public.unban_user(uuid);
DROP FUNCTION IF EXISTS public.has_permission(uuid, text);
DROP FUNCTION IF EXISTS public.save_role_permissions(text, text[]);
DROP FUNCTION IF EXISTS public.get_user_id();
DROP FUNCTION IF EXISTS public.delete_quiz(uuid);
DROP FUNCTION IF EXISTS public.delete_product(uuid);
DROP FUNCTION IF EXISTS public.verify_admin_password(text);
DROP VIEW IF EXISTS private.user_roles_view;


-- =================================================================
-- 2. INITIAL SETUP & EXTENSIONS
-- =================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
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
    "admin_password" text,
    "submissions_channel_id" text,
    "log_channel_submissions" text,
    "log_channel_bans" text,
    "log_channel_admin" text,
    "audit_log_channel_id" text,
    "mention_role_submissions" text,
    "mention_role_audit_log_submissions" text,
    "mention_role_audit_log_bans" text,
    "mention_role_audit_log_admin" text,
    "mention_role_audit_log_general" text,
    CONSTRAINT id_check CHECK (id = 1)
);
INSERT INTO public.config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    discord_id text NOT NULL UNIQUE,
    username text,
    avatar_url text,
    roles jsonb,
    highest_role jsonb,
    last_synced_at timestamptz,
    is_banned boolean DEFAULT false,
    ban_reason text,
    ban_expires_at timestamptz
);

CREATE TABLE public.role_permissions ( role_id text PRIMARY KEY, permissions text[] );
CREATE TABLE public.products ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "nameKey" text NOT NULL, "descriptionKey" text, price numeric(10, 2) NOT NULL, "imageUrl" text );
CREATE TABLE public.quizzes ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "titleKey" text NOT NULL, "descriptionKey" text, questions jsonb, "isOpen" boolean DEFAULT false, created_at timestamptz DEFAULT current_timestamp, "allowedTakeRoles" text[], "logoUrl" text, "bannerUrl" text, "lastOpenedAt" timestamptz );
CREATE TABLE public.submissions ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "quizId" uuid REFERENCES public.quizzes(id) ON DELETE SET NULL, "quizTitle" text, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, username text, answers jsonb, "submittedAt" timestamptz DEFAULT current_timestamp, status text DEFAULT 'pending', "adminId" uuid REFERENCES auth.users(id) ON DELETE SET NULL, "adminUsername" text, "updatedAt" timestamptz, "cheatAttempts" jsonb, user_highest_role text, reason text );
CREATE TABLE public.rules ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "titleKey" text NOT NULL, position int NOT NULL, rules jsonb );
CREATE TABLE public.audit_log ( id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, timestamp timestamptz DEFAULT current_timestamp, admin_id uuid REFERENCES auth.users(id), admin_username text, action text, log_type text );
CREATE TABLE public.translations ( key text PRIMARY KEY, en text, ar text );
CREATE TABLE public.bans ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, banned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, reason text, expires_at timestamptz, created_at timestamptz DEFAULT current_timestamp, unbanned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, unbanned_at timestamptz, is_active boolean DEFAULT true );
CREATE TABLE public.discord_widgets ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), server_name text NOT NULL, server_id text NOT NULL, invite_url text NOT NULL, position int NOT NULL );
CREATE TABLE public.staff ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, role_key text NOT NULL, position int NOT NULL, created_at timestamptz DEFAULT now() );

-- =================================================================
-- 4. RLS-BYPASS VIEW (CRITICAL FIX FOR RECURSION)
-- =================================================================
CREATE VIEW private.user_roles_view AS
  SELECT id, roles FROM public.profiles;

-- =================================================================
-- 5. HELPER & RPC FUNCTIONS (DEFINED BEFORE RLS)
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private
AS $$
DECLARE
    user_permissions text[];
BEGIN
    IF p_user_id IS NULL THEN RETURN false; END IF;

    -- Query the private view which bypasses RLS on the profiles table, preventing recursion.
    SELECT COALESCE(array_agg(DISTINCT p.permission), '{}')
    INTO user_permissions
    FROM private.user_roles_view prof
    CROSS JOIN jsonb_array_elements(prof.roles) AS r(role_obj)
    JOIN public.role_permissions rp ON rp.role_id = r.role_obj->>'id'
    CROSS JOIN unnest(rp.permissions) AS p(permission)
    WHERE prof.id = p_user_id;

    RETURN ('_super_admin' = ANY(user_permissions) OR p_permission_key = ANY(user_permissions));
END;
$$;


-- =================================================================
-- 6. ROW LEVEL SECURITY (RLS)
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
ALTER TABLE public.discord_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.config FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.rules FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.translations FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.discord_widgets FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.staff FOR SELECT USING (true);

-- Profiles Policies (REFINED to prevent recursion)
CREATE POLICY "Allow individual user full access to their own profile" ON public.profiles FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
CREATE POLICY "Allow admins full access to all profiles" ON public.profiles FOR ALL
  USING (public.has_permission(auth.uid(), '_super_admin'))
  WITH CHECK (public.has_permission(auth.uid(), '_super_admin'));

CREATE POLICY "Users can access their own submissions" ON public.submissions FOR ALL USING (user_id = public.get_user_id());

CREATE POLICY "Admins can manage config" ON public.config FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_appearance') OR public.has_permission(public.get_user_id(), 'admin_notifications'));
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_store'));
CREATE POLICY "Admins can manage quizzes" ON public.quizzes FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_quizzes'));
CREATE POLICY "Admins can manage rules" ON public.rules FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_rules'));
CREATE POLICY "Admins can manage translations" ON public.translations FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_translations') OR public.has_permission(public.get_user_id(), 'admin_notifications'));
CREATE POLICY "Admins can manage bans" ON public.bans FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_lookup'));
CREATE POLICY "Admins can manage role permissions" ON public.role_permissions FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_permissions'));
CREATE POLICY "Admins can manage discord widgets" ON public.discord_widgets FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_widgets'));
CREATE POLICY "Admins can manage staff" ON public.staff FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_staff'));
CREATE POLICY "Admins can read audit log" ON public.audit_log FOR SELECT USING (public.has_permission(public.get_user_id(), 'admin_audit_log'));
CREATE POLICY "Admins can manage submissions" ON public.submissions FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_submissions'));

-- =================================================================
-- 7. RPC FUNCTIONS
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_config() RETURNS json LANGUAGE sql STABLE AS $$ SELECT row_to_json(c) FROM public.config c WHERE id = 1; $$;

CREATE OR REPLACE FUNCTION public.get_staff()
RETURNS TABLE(id uuid, user_id uuid, role_key text, position int, username text, avatar_url text, discord_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT s.id, s.user_id, s.role_key, s.position, p.username, p.avatar_url, p.discord_id
    FROM public.staff s
    JOIN public.profiles p ON s.user_id = p.id
    ORDER BY s.position;
$$;

CREATE OR REPLACE FUNCTION public.save_staff(p_staff_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    staff_member jsonb;
BEGIN
    IF NOT public.has_permission(public.get_user_id(), 'admin_staff') THEN
        RAISE EXCEPTION 'Insufficient permissions.';
    END IF;

    -- First, clear the existing staff table to handle deletions and reordering
    DELETE FROM public.staff;

    -- Loop through the provided array and insert new records
    FOR staff_member IN SELECT * FROM jsonb_array_elements(p_staff_data) LOOP
        -- Also save the role translation
        INSERT INTO public.translations (key, en, ar)
        VALUES (
            staff_member->>'role_key',
            staff_member->>'role_en',
            staff_member->>'role_ar'
        )
        ON CONFLICT (key) DO UPDATE SET
            en = EXCLUDED.en,
            ar = EXCLUDED.ar;

        INSERT INTO public.staff (user_id, role_key, "position")
        VALUES (
            (staff_member->>'user_id')::uuid,
            staff_member->>'role_key',
            (staff_member->>'position')::int
        );
    END LOOP;
    PERFORM public.log_action('Updated the staff list.', 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_all_submissions() RETURNS SETOF public.submissions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_submissions') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  RETURN QUERY SELECT * FROM public.submissions ORDER BY "submittedAt" DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_submission(submission_data jsonb) RETURNS public.submissions LANGUAGE plpgsql
AS $$
DECLARE 
  new_submission public.submissions;
  discord_id_val text;
BEGIN
  -- We need the discord_id for the log, which is in the profiles table.
  SELECT p.discord_id INTO discord_id_val FROM public.profiles p WHERE p.id = public.get_user_id();

  INSERT INTO public.submissions ("quizId", "quizTitle", user_id, username, answers, "cheatAttempts", user_highest_role)
  VALUES (
    (submission_data->>'quizId')::uuid, submission_data->>'quizTitle', public.get_user_id(), submission_data->>'username',
    submission_data->'answers', submission_data->'cheatAttempts', submission_data->>'user_highest_role'
  ) RETURNING * INTO new_submission;
  
  PERFORM public.log_action(
    'New submission by **' || new_submission.username || '** (`' || discord_id_val || '`) for **' || new_submission."quizTitle" || '**.',
    'submissions'
  );

  RETURN new_submission;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_submission_status(p_submission_id uuid, p_new_status text, p_reason text DEFAULT NULL) RETURNS public.submissions LANGUAGE plpgsql
AS $$
DECLARE 
  submission_record public.submissions; 
  admin_user record;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_submissions') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  
  SELECT id, COALESCE(raw_user_meta_data->>'global_name', raw_user_meta_data->>'full_name') as username 
  INTO admin_user 
  FROM auth.users WHERE id = public.get_user_id();

  UPDATE public.submissions
  SET 
    status = p_new_status,
    "adminId" = CASE WHEN p_new_status = 'taken' THEN admin_user.id WHEN (p_new_status = 'accepted' OR p_new_status = 'refused') AND "adminId" IS NULL THEN admin_user.id ELSE "adminId" END,
    "adminUsername" = CASE WHEN p_new_status = 'taken' THEN admin_user.username WHEN (p_new_status = 'accepted' OR p_new_status = 'refused') AND "adminUsername" IS NULL THEN admin_user.username ELSE "adminUsername" END,
    reason = CASE WHEN (p_new_status = 'accepted' OR p_new_status = 'refused') THEN p_reason ELSE reason END,
    "updatedAt" = current_timestamp
  WHERE id = p_submission_id
  RETURNING * INTO submission_record;

  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found.'; END IF;
  
  PERFORM public.log_action(
    'Submission for **' || submission_record.username || '** (' || submission_record."quizTitle" || ') was updated to **' || upper(p_new_status) || '** by admin ' || submission_record."adminUsername" || '.',
    'submissions'
  );
  
  RETURN submission_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_submission(p_submission_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deleted_submission record;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), '_super_admin') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  
  DELETE FROM public.submissions WHERE id = p_submission_id RETURNING username, "quizTitle" INTO deleted_submission;

  PERFORM public.log_action(
    'Deleted submission from ' || deleted_submission.username || ' for ' || deleted_submission."quizTitle" || '.',
    'admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_quiz_with_translations(p_quiz_data jsonb) RETURNS public.quizzes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  quiz_record public.quizzes;
  q jsonb;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_quizzes') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;

  INSERT INTO public.translations (key, en, ar)
  VALUES (p_quiz_data->>'titleKey', p_quiz_data->>'titleEn', p_quiz_data->>'titleAr'),
         (p_quiz_data->>'descriptionKey', p_quiz_data->>'descriptionEn', p_quiz_data->>'descriptionAr')
  ON CONFLICT (key) DO UPDATE SET en = EXCLUDED.en, ar = EXCLUDED.ar;

  FOR q IN SELECT * FROM jsonb_array_elements(p_quiz_data->'questions') LOOP
    INSERT INTO public.translations (key, en, ar)
    VALUES (q->>'textKey', q->>'textEn', q->>'textAr')
    ON CONFLICT (key) DO UPDATE SET en = EXCLUDED.en, ar = EXCLUDED.ar;
  END LOOP;

  INSERT INTO public.quizzes (id, "titleKey", "descriptionKey", "isOpen", "allowedTakeRoles", "logoUrl", "bannerUrl", questions, "lastOpenedAt")
  VALUES (
    (p_quiz_data->>'id')::uuid,
    p_quiz_data->>'titleKey',
    p_quiz_data->>'descriptionKey',
    (p_quiz_data->>'isOpen')::boolean,
    COALESCE((SELECT array_agg(value) FROM jsonb_array_elements_text(p_quiz_data->'allowedTakeRoles')), '{}'::text[]),
    p_quiz_data->>'logoUrl',
    p_quiz_data->>'bannerUrl',
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', el->>'id', 'textKey', el->>'textKey', 'timeLimit', (el->>'timeLimit')::int)) FROM jsonb_array_elements(p_quiz_data->'questions') as el), '[]'::jsonb),
    CASE WHEN (p_quiz_data->>'isOpen')::boolean AND NOT EXISTS (SELECT 1 FROM public.quizzes WHERE id = (p_quiz_data->>'id')::uuid AND "isOpen" = true) THEN current_timestamp ELSE (SELECT "lastOpenedAt" FROM public.quizzes WHERE id = (p_quiz_data->>'id')::uuid) END
  )
  ON CONFLICT (id) DO UPDATE SET
    "titleKey" = EXCLUDED."titleKey",
    "descriptionKey" = EXCLUDED."descriptionKey",
    "isOpen" = EXCLUDED."isOpen",
    "allowedTakeRoles" = EXCLUDED."allowedTakeRoles",
    "logoUrl" = EXCLUDED."logoUrl",
    "bannerUrl" = EXCLUDED."bannerUrl",
    questions = EXCLUDED.questions,
    "lastOpenedAt" = CASE WHEN EXCLUDED."isOpen" AND public.quizzes."isOpen" = false THEN current_timestamp ELSE public.quizzes."lastOpenedAt" END
  RETURNING * INTO quiz_record;

  PERFORM public.log_action('Saved quiz: ' || p_quiz_data->>'titleEn', 'admin');
  RETURN quiz_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_quiz(p_quiz_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deleted_quiz record;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_quizzes') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  
  SELECT "titleKey" INTO deleted_quiz FROM public.quizzes WHERE id = p_quiz_id;
  DELETE FROM public.quizzes WHERE id = p_quiz_id;

  IF FOUND THEN
    PERFORM public.log_action('Deleted quiz with title key: ' || deleted_quiz."titleKey", 'admin');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_product_with_translations(p_product_data jsonb) RETURNS public.products LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  product_record public.products;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_store') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  
  INSERT INTO public.translations (key, en, ar)
  VALUES (p_product_data->>'nameKey', p_product_data->>'nameEn', p_product_data->>'nameAr'),
         (p_product_data->>'descriptionKey', p_product_data->>'descriptionEn', p_product_data->>'descriptionAr')
  ON CONFLICT (key) DO UPDATE SET en = EXCLUDED.en, ar = EXCLUDED.ar;

  INSERT INTO public.products (id, "nameKey", "descriptionKey", price, "imageUrl")
  VALUES ((p_product_data->>'id')::uuid, p_product_data->>'nameKey', p_product_data->>'descriptionKey', (p_product_data->>'price')::numeric, p_product_data->>'imageUrl')
  ON CONFLICT (id) DO UPDATE SET
    "nameKey" = EXCLUDED."nameKey", "descriptionKey" = EXCLUDED."descriptionKey",
    price = EXCLUDED.price, "imageUrl" = EXCLUDED."imageUrl"
  RETURNING * INTO product_record;
  
  PERFORM public.log_action('Saved product: ' || p_product_data->>'nameEn', 'admin');
  RETURN product_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_product(p_product_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deleted_product record;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_store') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  
  SELECT "nameKey" INTO deleted_product FROM public.products WHERE id = p_product_id;
  DELETE FROM public.products WHERE id = p_product_id;

  IF FOUND THEN
      PERFORM public.log_action('Deleted product with name key: ' || deleted_product."nameKey", 'admin');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_rules(p_rules_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    category jsonb;
    rule jsonb;
BEGIN
    IF NOT public.has_permission(public.get_user_id(), 'admin_rules') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
    DELETE FROM public.rules WHERE 1=1;

    FOR category IN SELECT * FROM jsonb_array_elements(p_rules_data) LOOP
        INSERT INTO public.translations (key, en, ar)
        VALUES (category->>'titleKey', category->>'titleEn', category->>'titleAr')
        ON CONFLICT (key) DO UPDATE SET en = EXCLUDED.en, ar = EXCLUDED.ar;

        FOR rule IN SELECT * FROM jsonb_array_elements(category->'rules') LOOP
            INSERT INTO public.translations (key, en, ar)
            VALUES (rule->>'textKey', rule->>'textEn', rule->>'textAr')
            ON CONFLICT (key) DO UPDATE SET en = EXCLUDED.en, ar = EXCLUDED.ar;
        END LOOP;
        
        INSERT INTO public.rules (id, "titleKey", position, rules)
        VALUES (
            (category->>'id')::uuid,
            category->>'titleKey',
            (category->>'position')::int,
            (SELECT jsonb_agg(jsonb_build_object('id', r->>'id', 'textKey', r->>'textKey')) FROM jsonb_array_elements(category->'rules') as r)
        );
    END LOOP;
    PERFORM public.log_action('Updated server rules', 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.save_discord_widgets(p_widgets_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.has_permission(public.get_user_id(), 'admin_widgets') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
    DELETE FROM public.discord_widgets WHERE 1=1;
    INSERT INTO public.discord_widgets (server_name, server_id, invite_url, position)
    SELECT value->>'server_name', value->>'server_id', value->>'invite_url', (value->>'position')::int
    FROM jsonb_array_elements(p_widgets_data);
    PERFORM public.log_action('Updated Discord widgets', 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_config(new_config jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    should_log boolean := false;
BEGIN
    -- Update Appearance Settings
    IF public.has_permission(public.get_user_id(), 'admin_appearance') THEN
        UPDATE public.config SET 
            "COMMUNITY_NAME" = COALESCE(new_config->>'COMMUNITY_NAME', "COMMUNITY_NAME"),
            "LOGO_URL" = COALESCE(new_config->>'LOGO_URL', "LOGO_URL"),
            "DISCORD_GUILD_ID" = COALESCE(new_config->>'DISCORD_GUILD_ID', "DISCORD_GUILD_ID"),
            "DISCORD_INVITE_URL" = COALESCE(new_config->>'DISCORD_INVITE_URL', "DISCORD_INVITE_URL"),
            "MTA_SERVER_URL" = COALESCE(new_config->>'MTA_SERVER_URL', "MTA_SERVER_URL"),
            "BACKGROUND_IMAGE_URL" = COALESCE(new_config->>'BACKGROUND_IMAGE_URL', "BACKGROUND_IMAGE_URL"),
            "admin_password" = CASE WHEN new_config ? 'admin_password' THEN 
                                    CASE WHEN new_config->>'admin_password' IS NULL OR new_config->>'admin_password' = '' THEN NULL
                                        ELSE crypt(new_config->>'admin_password', gen_salt('bf'))
                                    END
                                ELSE "admin_password" END
        WHERE id = 1;
        should_log := true;
    END IF;
    
    -- Update Notification Settings
    IF public.has_permission(public.get_user_id(), 'admin_notifications') THEN
        UPDATE public.config SET
            "submissions_channel_id" = COALESCE(new_config->>'submissions_channel_id', "submissions_channel_id"),
            "log_channel_submissions" = COALESCE(new_config->>'log_channel_submissions', "log_channel_submissions"),
            "log_channel_bans" = COALESCE(new_config->>'log_channel_bans', "log_channel_bans"),
            "log_channel_admin" = COALESCE(new_config->>'log_channel_admin', "log_channel_admin"),
            "audit_log_channel_id" = COALESCE(new_config->>'audit_log_channel_id', "audit_log_channel_id"),
            "mention_role_submissions" = COALESCE(new_config->>'mention_role_submissions', "mention_role_submissions"),
            "mention_role_audit_log_submissions" = COALESCE(new_config->>'mention_role_audit_log_submissions', "mention_role_audit_log_submissions"),
            "mention_role_audit_log_bans" = COALESCE(new_config->>'mention_role_audit_log_bans', "mention_role_audit_log_bans"),
            "mention_role_audit_log_admin" = COALESCE(new_config->>'mention_role_audit_log_admin', "mention_role_audit_log_admin"),
            "mention_role_audit_log_general" = COALESCE(new_config->>'mention_role_audit_log_general', "mention_role_audit_log_general")
        WHERE id = 1;
        should_log := true;
    END IF;

    IF should_log THEN
        PERFORM public.log_action('Updated website settings.', 'admin');
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_action(p_action text, p_log_type text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_user record;
BEGIN
  SELECT id, COALESCE(raw_user_meta_data->>'global_name', raw_user_meta_data->>'full_name') as username
  INTO admin_user
  FROM auth.users
  WHERE id = public.get_user_id();

  IF admin_user.id IS NOT NULL THEN
    INSERT INTO public.audit_log (admin_id, admin_username, action, log_type)
    VALUES (admin_user.id, admin_user.username, p_action, p_log_type);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_page_visit(p_page_name text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM public.log_action('Accessed admin page: **' || p_page_name || '**', 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.ban_user(p_target_user_id uuid, p_reason text, p_duration_hours int DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    expires_timestamp timestamptz;
    target_user_record record;
BEGIN
    IF NOT public.has_permission(public.get_user_id(), 'admin_lookup') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;

    IF p_duration_hours IS NOT NULL THEN
        expires_timestamp := current_timestamp + (p_duration_hours * interval '1 hour');
    ELSE
        expires_timestamp := NULL; -- Permanent ban
    END IF;

    UPDATE public.profiles SET is_banned = true, ban_reason = p_reason, ban_expires_at = expires_timestamp WHERE id = p_target_user_id RETURNING username INTO target_user_record;

    IF NOT FOUND THEN RAISE EXCEPTION 'Target user not found.'; END IF;
    
    INSERT INTO public.bans (user_id, banned_by, reason, expires_at) VALUES (p_target_user_id, public.get_user_id(), p_reason, expires_timestamp);
    PERFORM public.log_action('Banned user **' || target_user_record.username || '**. Reason: ' || p_reason || '. Duration: ' || COALESCE(p_duration_hours::text, 'Permanent') || ' hours.', 'bans');
END;
$$;

CREATE OR REPLACE FUNCTION public.unban_user(p_target_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_user_record record;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_lookup') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  UPDATE public.profiles SET is_banned = false, ban_reason = NULL, ban_expires_at = NULL WHERE id = p_target_user_id RETURNING username INTO target_user_record;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target user not found.'; END IF;
  UPDATE public.bans SET is_active = false, unbanned_by = public.get_user_id(), unbanned_at = current_timestamp WHERE user_id = p_target_user_id AND is_active = true;
  PERFORM public.log_action('Unbanned user **' || target_user_record.username || '**.', 'bans');
END;
$$;

CREATE OR REPLACE FUNCTION public.save_role_permissions(p_role_id text, p_permissions text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.has_permission(public.get_user_id(), 'admin_permissions') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
    INSERT INTO public.role_permissions (role_id, permissions) VALUES (p_role_id, p_permissions)
    ON CONFLICT (role_id) DO UPDATE SET permissions = EXCLUDED.permissions;
    PERFORM public.log_action('Updated permissions for role ID ' || p_role_id || '.', 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_admin_password(p_password text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    hashed_password text;
BEGIN
    IF NOT public.has_permission(public.get_user_id(), '_super_admin') THEN RETURN false; END IF;
    
    SELECT admin_password INTO hashed_password FROM public.config WHERE id = 1;
    
    IF hashed_password IS NULL THEN
        RETURN true;
    END IF;
    
    RETURN (hashed_password = crypt(p_password, hashed_password));
END;
$$;


COMMIT;
`