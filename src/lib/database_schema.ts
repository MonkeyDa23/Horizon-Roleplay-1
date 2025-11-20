
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
DROP TABLE IF EXISTS public.product_categories CASCADE;
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
DROP FUNCTION IF EXISTS public.save_product_categories(jsonb);
DROP FUNCTION IF EXISTS public.get_products_with_categories();
DROP FUNCTION IF EXISTS public.save_rules(jsonb);
DROP FUNCTION IF EXISTS public.save_discord_widgets(jsonb);
DROP FUNCTION IF EXISTS public.update_config(jsonb);
DROP FUNCTION IF EXISTS public.log_action(text, text, uuid, text);
DROP FUNCTION IF EXISTS public.log_admin_action(text, text);
DROP FUNCTION IF EXISTS public.log_system_action(text, text, uuid, text);
DROP FUNCTION IF EXISTS public.log_page_visit(text);
DROP FUNCTION IF EXISTS public.ban_user(uuid, text, int);
DROP FUNCTION IF EXISTS public.unban_user(uuid);
DROP FUNCTION IF EXISTS public.has_permission(uuid, text);
DROP FUNCTION IF EXISTS public.save_role_permissions(text, text[]);
DROP FUNCTION IF EXISTS public.get_user_id();
DROP FUNCTION IF EXISTS public.delete_quiz(uuid);
DROP FUNCTION IF EXISTS public.delete_product(uuid);
DROP FUNCTION IF EXISTS public.verify_admin_password(text);
DROP FUNCTION IF EXISTS public.lookup_user_by_discord_id(text);
DROP FUNCTION IF EXISTS public.handle_user_sync(uuid, text, text, text, jsonb, jsonb);
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
CREATE TABLE public.product_categories ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "nameKey" text NOT NULL, "position" int NOT NULL );
CREATE TABLE public.products ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "nameKey" text NOT NULL, "descriptionKey" text, price numeric(10, 2) NOT NULL, "imageUrl" text, category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL );
CREATE TABLE public.quizzes ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "titleKey" text NOT NULL, "descriptionKey" text, "instructionsKey" text, questions jsonb, "isOpen" boolean DEFAULT false, created_at timestamptz DEFAULT current_timestamp, "allowedTakeRoles" text[], "logoUrl" text, "bannerUrl" text, "lastOpenedAt" timestamptz );
CREATE TABLE public.submissions ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "quizId" uuid REFERENCES public.quizzes(id) ON DELETE SET NULL, "quizTitle" text, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, username text, answers jsonb, "submittedAt" timestamptz DEFAULT current_timestamp, status text DEFAULT 'pending', "adminId" uuid REFERENCES auth.users(id) ON DELETE SET NULL, "adminUsername" text, "updatedAt" timestamptz, "cheatAttempts" jsonb, user_highest_role text, reason text );
CREATE TABLE public.rules ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "titleKey" text NOT NULL, "position" int NOT NULL, rules jsonb );
CREATE TABLE public.audit_log ( id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, timestamp timestamptz DEFAULT current_timestamp, admin_id uuid REFERENCES auth.users(id), admin_username text, action text, log_type text );
CREATE TABLE public.translations ( key text PRIMARY KEY, en text, ar text );
CREATE TABLE public.bans ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, banned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, reason text, expires_at timestamptz, created_at timestamptz DEFAULT current_timestamp, unbanned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, unbanned_at timestamptz, is_active boolean DEFAULT true );
CREATE TABLE public.discord_widgets ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), server_name text NOT NULL, server_id text NOT NULL, invite_url text NOT NULL, "position" int NOT NULL );
CREATE TABLE public.staff ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, role_key text NOT NULL, "position" int NOT NULL, created_at timestamptz DEFAULT now() );

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
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY "Allow public read access" ON public.product_categories FOR SELECT USING (true);
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
  USING (public.has_permission(auth.uid(), '_super_admin') OR public.has_permission(auth.uid(), 'admin_lookup'))
  WITH CHECK (public.has_permission(auth.uid(), '_super_admin') OR public.has_permission(auth.uid(), 'admin_lookup'));

CREATE POLICY "Users can access their own submissions" ON public.submissions FOR ALL USING (user_id = public.get_user_id());

CREATE POLICY "Admins can manage config" ON public.config FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_appearance') OR public.has_permission(public.get_user_id(), 'admin_notifications'));
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_store'));
CREATE POLICY "Admins can manage product categories" ON public.product_categories FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_store'));
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
RETURNS TABLE(id uuid, user_id uuid, role_key text, "position" int, username text, avatar_url text, discord_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT s.id, s.user_id, s.role_key, s."position", p.username, p.avatar_url, p.discord_id
    FROM public.staff s
    JOIN public.profiles p ON s.user_id = p.id
    ORDER BY s."position";
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
    DELETE FROM public.staff WHERE 1=1;

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
BEGIN
  -- This function is now only responsible for inserting the data.
  -- Logging and notifications are handled by the frontend via the bot API.
  INSERT INTO public.submissions ("quizId", "quizTitle", user_id, username, answers, "cheatAttempts", user_highest_role)
  VALUES (
    (submission_data->>'quizId')::uuid, submission_data->>'quizTitle', public.get_user_id(), submission_data->>'username',
    submission_data->'answers', submission_data->'cheatAttempts', submission_data->>'user_highest_role'
  ) RETURNING * INTO new_submission;
  
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
  
  -- Logging is now handled by the frontend.
  
  RETURN submission_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_submission(p_submission_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), '_super_admin') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  DELETE FROM public.submissions WHERE id = p_submission_id;
  -- Logging is handled by the frontend.
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
         (p_quiz_data->>'descriptionKey', p_quiz_data->>'descriptionEn', p_quiz_data->>'descriptionAr'),
         (p_quiz_data->>'instructionsKey', p_quiz_data->>'instructionsEn', p_quiz_data->>'instructionsAr')
  ON CONFLICT (key) DO UPDATE SET en = EXCLUDED.en, ar = EXCLUDED.ar;

  FOR q IN SELECT * FROM jsonb_array_elements(p_quiz_data->'questions') LOOP
    INSERT INTO public.translations (key, en, ar)
    VALUES (q->>'textKey', q->>'textEn', q->>'textAr')
    ON CONFLICT (key) DO UPDATE SET en = EXCLUDED.en, ar = EXCLUDED.ar;
  END LOOP;

  INSERT INTO public.quizzes (id, "titleKey", "descriptionKey", "instructionsKey", "isOpen", "allowedTakeRoles", "logoUrl", "bannerUrl", questions, "lastOpenedAt")
  VALUES (
    (p_quiz_data->>'id')::uuid,
    p_quiz_data->>'titleKey',
    p_quiz_data->>'descriptionKey',
    p_quiz_data->>'instructionsKey',
    (p_quiz_data->>'isOpen')::boolean,
    COALESCE((SELECT array_agg(value) FROM jsonb_array_elements_text(p_quiz_data->'allowedTakeRoles')), '{}'::text[]),
    p_quiz_data->>'logoUrl',
    p_quiz_data->>'bannerUrl',
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', el->>'id', 'textKey', el->>'textKey', 'timeLimit', (el->>'timeLimit')::int)) FROM jsonb_array_elements(p_quiz_data->'questions') as el), '[]'::jsonb),
    CASE WHEN (p_quiz_data->>'isOpen')::boolean AND NOT EXISTS (SELECT 1 FROM public.quizzes WHERE id = (p_quiz_data->>'id')::uuid AND "isOpen" = true) THEN current_timestamp ELSE (SELECT "lastOpenedAt" FROM public.quizzes WHERE id = (p_quiz_data->>'id')::uuid) END
  )
  ON CONFLICT (id) DO UPDATE SET
    "titleKey" = EXCLUDED."titleKey", "descriptionKey" = EXCLUDED."descriptionKey", "instructionsKey" = EXCLUDED."instructionsKey", "isOpen" = EXCLUDED."isOpen", "allowedTakeRoles" = EXCLUDED."allowedTakeRoles", "logoUrl" = EXCLUDED."logoUrl", "bannerUrl" = EXCLUDED."bannerUrl", questions = EXCLUDED.questions, "lastOpenedAt" = EXCLUDED."lastOpenedAt"
  RETURNING * INTO quiz_record;
  
  RETURN quiz_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_quiz(p_quiz_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_quizzes') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  DELETE FROM public.quizzes WHERE id = p_quiz_id;
  -- Logging handled on frontend
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
  
  INSERT INTO public.products (id, "nameKey", "descriptionKey", price, "imageUrl", category_id)
  VALUES (
    (p_product_data->>'id')::uuid,
    p_product_data->>'nameKey',
    p_product_data->>'descriptionKey',
    (p_product_data->>'price')::numeric,
    p_product_data->>'imageUrl',
    NULLIF(p_product_data->>'category_id', '')::uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    "nameKey" = EXCLUDED."nameKey", "descriptionKey" = EXCLUDED."descriptionKey", price = EXCLUDED.price, "imageUrl" = EXCLUDED."imageUrl", category_id = EXCLUDED.category_id
  RETURNING * INTO product_record;
  
  RETURN product_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_product(p_product_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_store') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  DELETE FROM public.products WHERE id = p_product_id;
  -- Logging handled on frontend
END;
$$;

CREATE OR REPLACE FUNCTION public.save_product_categories(p_categories_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    category jsonb;
BEGIN
    IF NOT public.has_permission(public.get_user_id(), 'admin_store') THEN
        RAISE EXCEPTION 'Insufficient permissions.';
    END IF;

    -- Clear existing categories
    DELETE FROM public.product_categories WHERE 1=1;

    -- Insert new categories from the JSON array
    FOR category IN SELECT * FROM jsonb_array_elements(p_categories_data) LOOP
        -- Also save the translation for the category name
        INSERT INTO public.translations (key, en, ar)
        VALUES (
            category->>'nameKey',
            category->>'nameEn',
            category->>'nameAr'
        )
        ON CONFLICT (key) DO UPDATE SET
            en = EXCLUDED.en,
            ar = EXCLUDED.ar;

        INSERT INTO public.product_categories (id, "nameKey", "position")
        VALUES (
            (category->>'id')::uuid,
            category->>'nameKey',
            (category->>'position')::int
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_products_with_categories()
RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT COALESCE(jsonb_agg(cats ORDER BY cats.position), '[]'::jsonb)
    FROM (
        SELECT
            pc.id,
            pc."nameKey",
            pc.position,
            (
                SELECT COALESCE(jsonb_agg(prods ORDER BY prods.id), '[]'::jsonb)
                FROM public.products AS prods
                WHERE prods.category_id = pc.id
            ) AS products
        FROM public.product_categories AS pc
        ORDER BY pc.position
    ) AS cats;
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
    
    INSERT INTO public.rules (id, "titleKey", "position", rules)
    VALUES (
      (category->>'id')::uuid,
      category->>'titleKey',
      (category->>'position')::int,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', el->>'id', 'textKey', el->>'textKey')) FROM jsonb_array_elements(category->'rules') as el), '[]'::jsonb)
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_discord_widgets(p_widgets_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  widget jsonb;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_widgets') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  
  DELETE FROM public.discord_widgets WHERE 1=1;
  
  FOR widget IN SELECT * FROM jsonb_array_elements(p_widgets_data) LOOP
    INSERT INTO public.discord_widgets (server_name, server_id, invite_url, "position")
    VALUES (
      widget->>'server_name',
      widget->>'server_id',
      widget->>'invite_url',
      (widget->>'position')::int
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_config(new_config jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_permission(public.get_user_id(), 'admin_appearance') OR public.has_permission(public.get_user_id(), 'admin_notifications')) THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  
  UPDATE public.config SET
    "COMMUNITY_NAME" = COALESCE(new_config->>'COMMUNITY_NAME', "COMMUNITY_NAME"),
    "LOGO_URL" = COALESCE(new_config->>'LOGO_URL', "LOGO_URL"),
    "DISCORD_GUILD_ID" = COALESCE(new_config->>'DISCORD_GUILD_ID', "DISCORD_GUILD_ID"),
    "BACKGROUND_IMAGE_URL" = COALESCE(new_config->>'BACKGROUND_IMAGE_URL', "BACKGROUND_IMAGE_URL"),
    "admin_password" = COALESCE(new_config->>'admin_password', "admin_password"),
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
END;
$$;

-- FIX: Replaced ambiguous log_action with two specific functions
-- Logs an action performed by the currently authenticated admin
CREATE OR REPLACE FUNCTION public.log_admin_action(p_action text, p_log_type text) 
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_user_id uuid;
  admin_user_name text;
BEGIN
  admin_user_id := public.get_user_id();
  IF admin_user_id IS NULL THEN RETURN; END IF;
  
  SELECT COALESCE(raw_user_meta_data->>'global_name', raw_user_meta_data->>'full_name') 
  INTO admin_user_name
  FROM auth.users WHERE id = admin_user_id;
  
  INSERT INTO public.audit_log (admin_id, admin_username, action, log_type)
  VALUES (admin_user_id, admin_user_name, p_action, p_log_type);
END;
$$;

-- Logs an action performed by the system or on behalf of a specified user
CREATE OR REPLACE FUNCTION public.log_system_action(p_action text, p_log_type text, p_actor_id uuid, p_actor_username text) 
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_log (admin_id, admin_username, action, log_type)
  VALUES (p_actor_id, p_actor_username, p_action, p_log_type);
END;
$$;


CREATE OR REPLACE FUNCTION public.log_page_visit(p_page_name text) 
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_user_id uuid;
  admin_user_name text;
BEGIN
  admin_user_id := public.get_user_id();
  
  -- Silently exit if no user is found (e.g., function called improperly).
  -- The frontend logic should prevent this, but this makes the function robust.
  IF admin_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'global_name', raw_user_meta_data->>'full_name') 
  INTO admin_user_name
  FROM auth.users WHERE id = admin_user_id;
  
  INSERT INTO public.audit_log (admin_id, admin_username, action, log_type)
  VALUES (admin_user_id, admin_user_name, 'Visited Admin Panel page: ' || p_page_name, 'navigation');
END;
$$;

CREATE OR REPLACE FUNCTION public.ban_user(p_target_user_id uuid, p_reason text, p_duration_hours int DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_expires_at timestamptz;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_lookup') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  
  IF p_duration_hours IS NOT NULL THEN
    v_expires_at := current_timestamp + (p_duration_hours * interval '1 hour');
  END IF;
  
  UPDATE public.profiles SET is_banned = true, ban_reason = p_reason, ban_expires_at = v_expires_at WHERE id = p_target_user_id;
  
  INSERT INTO public.bans (user_id, banned_by, reason, expires_at)
  VALUES (p_target_user_id, public.get_user_id(), p_reason, v_expires_at);
  
  PERFORM public.log_admin_action('Banned user ' || p_target_user_id || ' for reason: ' || p_reason, 'ban');
END;
$$;

CREATE OR REPLACE FUNCTION public.unban_user(p_target_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_lookup') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  
  UPDATE public.profiles SET is_banned = false, ban_reason = NULL, ban_expires_at = NULL WHERE id = p_target_user_id;
  UPDATE public.bans SET is_active = false, unbanned_by = public.get_user_id(), unbanned_at = current_timestamp WHERE user_id = p_target_user_id AND is_active = true;
  
  PERFORM public.log_admin_action('Unbanned user ' || p_target_user_id, 'ban');
END;
$$;

CREATE OR REPLACE FUNCTION public.save_role_permissions(p_role_id text, p_permissions text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_permissions') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  
  INSERT INTO public.role_permissions (role_id, permissions)
  VALUES (p_role_id, p_permissions)
  ON CONFLICT (role_id) DO UPDATE SET permissions = EXCLUDED.permissions;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_admin_password(p_password text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (SELECT 1 FROM public.config WHERE id = 1 AND admin_password = p_password);
$$;

CREATE OR REPLACE FUNCTION public.lookup_user_by_discord_id(p_discord_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    profile_record record;
BEGIN
    IF NOT public.has_permission(public.get_user_id(), 'admin_lookup') THEN
        RAISE EXCEPTION 'Insufficient permissions.';
    END IF;

    SELECT id, discord_id, username, avatar_url, roles, highest_role, is_banned, ban_reason, ban_expires_at
    INTO profile_record
    FROM public.profiles
    WHERE discord_id = p_discord_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User with Discord ID % not found. They may need to log in to the website once to register.', p_discord_id;
    END IF;

    RETURN json_build_object(
        'id', profile_record.id,
        'discordId', profile_record.discord_id,
        'username', profile_record.username,
        'avatar', profile_record.avatar_url,
        'roles', profile_record.roles,
        'highestRole', profile_record.highest_role,
        'is_banned', profile_record.is_banned,
        'ban_reason', profile_record.ban_reason,
        'ban_expires_at', profile_record.ban_expires_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_sync(p_id uuid, p_discord_id text, p_username text, p_avatar_url text, p_roles jsonb, p_highest_role jsonb)
RETURNS boolean -- returns true if a new user was created
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_new_user boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_id) THEN
    is_new_user := true;
  END IF;

  INSERT INTO public.profiles(id, discord_id, username, avatar_url, roles, highest_role, last_synced_at)
  VALUES (p_id, p_discord_id, p_username, p_avatar_url, p_roles, p_highest_role, now())
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    roles = EXCLUDED.roles,
    highest_role = EXCLUDED.highest_role,
    last_synced_at = EXCLUDED.last_synced_at;

  RETURN is_new_user;
END;
$$;


-- =================================================================
-- 8. INITIAL DATA (TRANSLATIONS)
-- =================================================================
-- This section intentionally left blank. Translations will be populated from the fallback file on first run.

-- End of transaction
COMMIT;
`