// Vixel Roleplay Website - Full Database Schema (V19 - RLS Recursion Fix)
export const databaseSchema = `
/*
====================================================================================================
 Vixel Roleplay Website - Full Database Schema (V19 - RLS Recursion Fix)
 Author: AI
 Date: 2024-06-08
 
 !! WARNING !!
 This script is DESTRUCTIVE. It will completely DROP all existing website-related tables,
 functions, and data before recreating the entire schema. This is intended for development
 or for a clean installation. DO NOT run this on a production database with live user data
 unless you intend to wipe it completely.

 !! ADMIN SETUP NOTE !!
 Admin permissions are now managed directly on the 'profiles' table.
 To make a user an admin or super admin:
 1. Go to the 'profiles' table in your Supabase Table Editor.
 2. Find the user you want to promote.
 3. Set the 'is_admin' or 'is_super_admin' column to TRUE for that user.
 
 INSTRUCTIONS:
 1. Go to your Supabase Project Dashboard.
 2. Navigate to the "SQL Editor".
 3. Click "+ New query".
 4. Copy the ENTIRE content of this file.
 5. Paste it into the SQL Editor.
 6. Click "RUN". This will apply the new, simpler permission logic.
====================================================================================================
*/

-- Wrap the entire script in a transaction to ensure it either completes fully or not at all.
BEGIN;

-- =================================================================
-- 1. DESTRUCTIVE RESET: Drop all existing objects
-- =================================================================
-- Drop tables with CASCADE to remove dependent objects.
DROP TABLE IF EXISTS public.bans CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE; -- This table is now obsolete.
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
DROP FUNCTION IF EXISTS public.save_quiz(jsonb);
DROP FUNCTION IF EXISTS public.save_rules(jsonb);
DROP FUNCTION IF EXISTS public.update_config(jsonb);
DROP FUNCTION IF EXISTS public.log_action(text);
DROP FUNCTION IF EXISTS public.ban_user(uuid, text, int);
DROP FUNCTION IF EXISTS public.unban_user(uuid);
DROP FUNCTION IF EXISTS public.has_permission(uuid, text);
DROP FUNCTION IF EXISTS public.get_user_id();

-- Drop private schema for secrets
DROP SCHEMA IF EXISTS private CASCADE;


-- =================================================================
-- 2. INITIAL SETUP & EXTENSIONS
-- =================================================================
-- Grant necessary permissions to the postgres role that runs this script.
GRANT USAGE, CREATE ON SCHEMA public TO postgres;

-- Enable required extensions.
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA extensions;

-- Create a private schema to store secrets.
CREATE SCHEMA private;
CREATE TABLE private.secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
REVOKE ALL ON TABLE private.secrets FROM PUBLIC;

-- Function to securely get a secret.
CREATE OR REPLACE FUNCTION private.get_secret(secret_key text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  secret_value text;
BEGIN
  SELECT value INTO secret_value FROM private.secrets WHERE key = secret_key;
  RETURN secret_value;
END;
$$;


-- =================================================================
-- 3. TABLE CREATION
-- =================================================================
-- Table for storing site-wide configuration settings.
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
    "AUDIT_LOG_CHANNEL_ID" text,
    CONSTRAINT id_check CHECK (id = 1)
);
INSERT INTO public.config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Table for storing user profiles, synced with Discord data.
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    discord_id text NOT NULL UNIQUE,
    roles jsonb,
    highest_role jsonb,
    is_guild_owner boolean DEFAULT false,
    last_synced_at timestamptz,
    is_banned boolean DEFAULT false,
    ban_reason text,
    ban_expires_at timestamptz,
    is_admin boolean NOT NULL DEFAULT false, -- NEW
    is_super_admin boolean NOT NULL DEFAULT false -- NEW
);

-- Table for store products.
CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "nameKey" text NOT NULL,
    "descriptionKey" text,
    price numeric(10, 2) NOT NULL,
    "imageUrl" text
);

-- Table for quiz/application forms.
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

-- Table for user submissions to quizzes.
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

-- Table for server rules, organized by categories.
CREATE TABLE public.rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "titleKey" text NOT NULL,
    position int NOT NULL,
    rules jsonb
);

-- Table for audit logs of admin actions.
CREATE TABLE public.audit_log (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    timestamp timestamptz DEFAULT now(),
    admin_id uuid REFERENCES auth.users(id),
    admin_username text,
    action text
);

-- Table for website translations.
CREATE TABLE public.translations (
    key text PRIMARY KEY,
    en text,
    ar text
);

-- Table for user bans.
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
-- This function is a helper to get the current user's ID from the JWT.
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- SIMPLIFIED PERMISSION CHECK FUNCTION (V19 - RLS Recursion Fix)
-- Checks the 'is_admin' and 'is_super_admin' flags on the user's profile.
-- Runs with SECURITY DEFINER to be usable within RLS policies.
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission_key text)
RETURNS boolean
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin boolean;
  v_is_admin boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- This SELECT can now run without being blocked by RLS on the profiles table
  -- because of the new, non-recursive SELECT policy on public.profiles.
  SELECT is_super_admin, is_admin
  INTO v_is_super_admin, v_is_admin
  FROM public.profiles WHERE id = p_user_id;

  -- Super admin has all permissions.
  IF v_is_super_admin THEN
    RETURN true;
  END IF;

  -- Regular admin has specific permissions.
  IF v_is_admin AND p_permission_key IN ('admin_panel', 'admin_submissions') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


-- =================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =================================================================
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;

-- PUBLIC POLICIES (Read-only)
CREATE POLICY "Allow public read access to config" ON public.config FOR SELECT USING (true);
CREATE POLICY "Allow public read access to products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public read access to quizzes" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Allow public read access to rules" ON public.rules FOR SELECT USING (true);
CREATE POLICY "Allow public read access to translations" ON public.translations FOR SELECT USING (true);

-- USER-SPECIFIC POLICIES
CREATE POLICY "Allow users to see their own submissions" ON public.submissions FOR SELECT USING (user_id = public.get_user_id());
CREATE POLICY "Allow users to insert their own submissions" ON public.submissions FOR INSERT WITH CHECK (user_id = public.get_user_id());

-- PROFILES RLS (V19 RECURSION FIX)
-- These new policies prevent the recursive loop that was blocking the permission system.
-- Policy 1: Any logged-in user can read from the profiles table. This is necessary for the has_permission function to work.
CREATE POLICY "Allow authenticated users to read profiles" ON public.profiles
FOR SELECT USING (auth.role() = 'authenticated');
-- Policy 2: Only super admins can modify the profiles table (e.g., banning or promoting other users).
CREATE POLICY "Allow super admins to manage profiles" ON public.profiles
FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_lookup'));


-- ADMIN MANAGEMENT POLICIES (ALL ACTIONS)
CREATE POLICY "Allow admins to manage config" ON public.config FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_appearance'));
CREATE POLICY "Allow admins to manage products" ON public.products FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_store'));
CREATE POLICY "Allow admins to manage quizzes" ON public.quizzes FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_quizzes'));
CREATE POLICY "Allow admins to manage rules" ON public.rules FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_rules'));
CREATE POLICY "Allow admins to manage submissions" ON public.submissions FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_submissions'));
CREATE POLICY "Allow admins to read audit log" ON public.audit_log FOR SELECT USING (public.has_permission(public.get_user_id(), 'admin_audit_log'));
CREATE POLICY "Allow admins to manage translations" ON public.translations FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_translations'));
CREATE POLICY "Allow admins to manage bans" ON public.bans FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_lookup'));


-- =================================================================
-- 6. RPC FUNCTIONS
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_config()
RETURNS json
LANGUAGE sql STABLE
AS $$
  SELECT row_to_json(c) FROM public.config c WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.get_all_submissions()
RETURNS SETOF public.submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_submissions') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  RETURN QUERY SELECT * FROM public.submissions ORDER BY "submittedAt" DESC;
END;
$$;

-- NOTE: This function is for users, so it's intentionally SECURITY INVOKER (default).
-- It relies on the RLS INSERT policy on the 'submissions' table.
CREATE OR REPLACE FUNCTION public.add_submission(submission_data jsonb)
RETURNS public.submissions
LANGUAGE plpgsql
AS $$
DECLARE
  new_submission public.submissions;
  channel_id text;
BEGIN
  INSERT INTO public.submissions ("quizId", "quizTitle", user_id, username, answers, "cheatAttempts", user_highest_role)
  VALUES (
    (submission_data->>'quizId')::uuid,
    submission_data->>'quizTitle',
    public.get_user_id(), -- Use session user ID for security, ignoring payload value
    submission_data->>'username',
    submission_data->'answers',
    submission_data->'cheatAttempts',
    submission_data->>'user_highest_role'
  ) RETURNING * INTO new_submission;

  SELECT "SUBMISSIONS_CHANNEL_ID" INTO channel_id FROM public.config WHERE id = 1;

  IF channel_id IS NOT NULL THEN
    PERFORM extensions.http_post(
      (SELECT value FROM private.secrets WHERE key = 'VITE_DISCORD_BOT_URL') || '/api/notify',
      jsonb_build_object(
        'type', 'new_submission',
        'payload', jsonb_build_object(
          'submissionsChannelId', channel_id,
          'embed', jsonb_build_object(
            'title', 'New Application Submitted!',
            'description', 'A new application has been submitted and is awaiting review.',
            'color', 3447003,
            'fields', jsonb_build_array(
              jsonb_build_object('name', 'Applicant', 'value', new_submission.username, 'inline', true),
              jsonb_build_object('name', 'Application Type', 'value', new_submission."quizTitle", 'inline', true)
            ),
            'timestamp', new_submission."submittedAt"
          )
        )
      ),
      'application/json',
      jsonb_build_object('Authorization', 'Bearer ' || (SELECT value FROM private.secrets WHERE key = 'VITE_DISCORD_BOT_API_KEY'))
    );
  END IF;

  RETURN new_submission;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_submission_status(p_submission_id uuid, p_new_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  submission_record record;
  admin_user record;
  embed_color int;
  embed_title text;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_submissions') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT id, raw_user_meta_data->>'full_name' AS username INTO admin_user FROM auth.users WHERE id = public.get_user_id();

  UPDATE public.submissions
  SET
    status = p_new_status,
    "adminId" = public.get_user_id(),
    "adminUsername" = admin_user.username,
    "updatedAt" = now()
  WHERE id = p_submission_id
  RETURNING * INTO submission_record;

  IF p_new_status = 'accepted' THEN
    embed_color := 5763719;
    embed_title := '✅ Application Accepted';
  ELSIF p_new_status = 'refused' THEN
    embed_color := 15548997;
    embed_title := '❌ Application Refused';
  END IF;

  IF p_new_status IN ('accepted', 'refused') THEN
     PERFORM extensions.http_post(
      (SELECT value FROM private.secrets WHERE key = 'VITE_DISCORD_BOT_URL') || '/api/notify',
      jsonb_build_object(
        'type', 'submission_result',
        'payload', jsonb_build_object(
          'userId', (SELECT discord_id FROM public.profiles WHERE id = submission_record.user_id),
          'embed', jsonb_build_object(
            'title', embed_title,
            'description', 'The status of your application has been updated.',
            'color', embed_color,
            'fields', jsonb_build_array(
              jsonb_build_object('name', 'Application', 'value', submission_record."quizTitle"),
              jsonb_build_object('name', 'Status', 'value', p_new_status),
              jsonb_build_object('name', 'Reviewed By', 'value', admin_user.username)
            ),
            'timestamp', now()
          )
        )
      ),
      'application/json',
      jsonb_build_object('Authorization', 'Bearer ' || (SELECT value FROM private.secrets WHERE key = 'VITE_DISCORD_BOT_API_KEY'))
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_quiz(quiz_data jsonb)
RETURNS public.quizzes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.quizzes;
  q_id uuid;
  is_creating boolean;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_quizzes') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  q_id := (quiz_data->>'id')::uuid;
  is_creating := q_id IS NULL;

  INSERT INTO public.quizzes (id, "titleKey", "descriptionKey", questions, "isOpen", "allowedTakeRoles", "logoUrl", "bannerUrl", "lastOpenedAt")
  VALUES (
    coalesce(q_id, gen_random_uuid()),
    quiz_data->>'titleKey',
    quiz_data->>'descriptionKey',
    quiz_data->'questions',
    (quiz_data->>'isOpen')::boolean,
    (SELECT array_agg(elem) FROM jsonb_array_elements_text(quiz_data->'allowedTakeRoles') AS elem),
    quiz_data->>'logoUrl',
    quiz_data->>'bannerUrl',
    CASE WHEN (quiz_data->>'isOpen')::boolean AND is_creating THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    "titleKey" = excluded."titleKey",
    "descriptionKey" = excluded."descriptionKey",
    questions = excluded.questions,
    "isOpen" = excluded."isOpen",
    "allowedTakeRoles" = excluded."allowedTakeRoles",
    "logoUrl" = excluded."logoUrl",
    "bannerUrl" = excluded."bannerUrl",
    "lastOpenedAt" = CASE WHEN excluded."isOpen" AND NOT quizzes."isOpen" THEN now() ELSE quizzes."lastOpenedAt" END
  RETURNING * INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_rules(rules_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_rules') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  DELETE FROM public.rules;
  
  INSERT INTO public.rules (id, "titleKey", position, rules)
  SELECT
    (value->>'id')::uuid,
    value->>'titleKey',
    (value->>'position')::int,
    value->'rules'
  FROM jsonb_array_elements(rules_data);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_config(new_config jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_appearance') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE public.config
  SET
    "COMMUNITY_NAME" = coalesce(new_config->>'COMMUNITY_NAME', "COMMUNITY_NAME"),
    "LOGO_URL" = coalesce(new_config->>'LOGO_URL', "LOGO_URL"),
    "DISCORD_GUILD_ID" = coalesce(new_config->>'DISCORD_GUILD_ID', "DISCORD_GUILD_ID"),
    "DISCORD_INVITE_URL" = coalesce(new_config->>'DISCORD_INVITE_URL', "DISCORD_INVITE_URL"),
    "MTA_SERVER_URL" = coalesce(new_config->>'MTA_SERVER_URL', "MTA_SERVER_URL"),
    "BACKGROUND_IMAGE_URL" = coalesce(new_config->>'BACKGROUND_IMAGE_URL', "BACKGROUND_IMAGE_URL"),
    "SHOW_HEALTH_CHECK" = coalesce((new_config->>'SHOW_HEALTH_CHECK')::boolean, "SHOW_HEALTH_CHECK"),
    "SUBMISSIONS_CHANNEL_ID" = coalesce(new_config->>'SUBMISSIONS_CHANNEL_ID', "SUBMISSIONS_CHANNEL_ID"),
    "AUDIT_LOG_CHANNEL_ID" = coalesce(new_config->>'AUDIT_LOG_CHANNEL_ID', "AUDIT_LOG_CHANNEL_ID")
  WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_action(p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user record;
  channel_id text;
BEGIN
  SELECT id, raw_user_meta_data->>'full_name' AS username INTO admin_user
  FROM auth.users WHERE id = public.get_user_id();

  INSERT INTO public.audit_log(admin_id, admin_username, action)
  VALUES (admin_user.id, admin_user.username, p_action);

  SELECT "AUDIT_LOG_CHANNEL_ID" INTO channel_id FROM public.config WHERE id = 1;

  IF channel_id IS NOT NULL THEN
    PERFORM extensions.http_post(
      (SELECT value FROM private.secrets WHERE key = 'VITE_DISCORD_BOT_URL') || '/api/notify',
      jsonb_build_object(
        'type', 'audit_log',
        'payload', jsonb_build_object(
          'auditLogChannelId', channel_id,
          'embed', jsonb_build_object(
            'title', 'Admin Action Logged',
            'description', p_action,
            'color', 16776960,
            'author', jsonb_build_object(
              'name', admin_user.username
            ),
            'timestamp', now()
          )
        )
      ),
      'application/json',
      jsonb_build_object('Authorization', 'Bearer ' || (SELECT value FROM private.secrets WHERE key = 'VITE_DISCORD_BOT_API_KEY'))
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ban_user(p_target_user_id uuid, p_reason text, p_duration_hours int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires_at timestamptz;
  target_username text;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_lookup') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_duration_hours IS NOT NULL THEN
    v_expires_at := now() + (p_duration_hours * interval '1 hour');
  ELSE
    v_expires_at := null;
  END IF;
  
  UPDATE public.profiles
  SET is_banned = true, ban_reason = p_reason, ban_expires_at = v_expires_at
  WHERE id = p_target_user_id;

  UPDATE public.bans SET is_active = false WHERE user_id = p_target_user_id AND is_active = true;

  INSERT INTO public.bans(user_id, banned_by, reason, expires_at, is_active)
  VALUES (p_target_user_id, public.get_user_id(), p_reason, v_expires_at, true);

  SELECT raw_user_meta_data->>'global_name' FROM auth.users WHERE id = p_target_user_id INTO target_username;
  PERFORM public.log_action('Banned user ' || coalesce(target_username, p_target_user_id::text) || ' for reason: ' || p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.unban_user(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_username text;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_lookup') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  UPDATE public.profiles
  SET is_banned = false, ban_reason = null, ban_expires_at = null
  WHERE id = p_target_user_id;

  UPDATE public.bans
  SET is_active = false, unbanned_by = public.get_user_id(), unbanned_at = now()
  WHERE user_id = p_target_user_id AND is_active = true;
  
  SELECT raw_user_meta_data->>'global_name' FROM auth.users WHERE id = p_target_user_id INTO target_username;
  PERFORM public.log_action('Unbanned user ' || coalesce(target_username, p_target_user_id::text));
END;
$$;


-- =================================================================
-- 7. INITIAL DATA SEEDING (TRANSLATIONS)
-- =================================================================
-- This seeds the database with the fallback translations from the app.
-- You can manage these in the Admin Panel later.
INSERT INTO public.translations (key, en, ar) VALUES
('home', 'Home', 'الرئيسية'),
('store', 'Store', 'المتجر'),
('rules', 'Rules', 'القوانين'),
('applies', 'Applies', 'التقديمات'),
('about_us', 'About Us', 'من نحن'),
('login_discord', 'Login with Discord', 'تسجيل الدخول'),
('logout', 'Logout', 'تسجيل الخروج'),
('welcome', 'Welcome', 'أهلاً'),
('admin_panel', 'Admin Panel', 'لوحة التحكم'),
('my_applications', 'My Applications', 'تقديماتي'),
('my_profile', 'My Profile', 'ملفي الشخصي'),
('hero_title', '{communityName} Community', 'مجتمع {communityName}'),
('hero_subtitle', 'Where your story begins. Join an immersive world of endless possibilities.', 'حيث تبدأ قصتك. انضم إلى عالم غامر من الاحتمالات اللانهائية.'),
('join_us', 'Join Us', 'انضم إلينا'),
('join_modal_title', 'Join Our Community', 'انضم إلى مجتمعنا'),
('join_discord', 'Join Discord Server', 'انضم لسيرفر الديسكورد'),
('connect_mta', 'Connect to MTA Server', 'اتصل بسيرفر MTA'),
('page_title_store', '{communityName} Store', 'متجر {communityName}'),
('page_title_rules', 'Server Rules', 'قوانين السيرفر'),
('page_title_applies', 'Available Applications', 'التقديمات المتاحة'),
('page_title_about', 'About {communityName}', 'عن {communityName}'),
('page_title_admin', 'Admin Control Panel', 'لوحة تحكم المشرفين'),
('page_title_my_applications', 'My Applications Status', 'حالة تقديماتي'),
('coming_soon', 'Coming Soon...', 'قريباً...'),
('questions', 'Questions', 'أسئلة'),
('about_intro', '{communityName} is more than just a server - it is a vibrant community of players who share a passion for roleplaying.', '{communityName} هو أكثر من مجرد سيرفر - إنه مجتمع نابض بالحياة من اللاعبين الذين يتشاركون شغف اللعب الأدوار.'),
('our_mission', 'Our Mission', 'مهمتنا'),
('mission_text', 'Our mission is to provide an immersive, high-quality roleplaying environment where players can create their own unique stories and characters.', 'مهمتنا هي توفير بيئة لعب أدوار غامرة وعالية الجودة حيث يمكن للاعبين إنشاء قصصهم وشخصياتهم الفريدة.'),
('join_community', 'Join Our Discord Community', 'انضم لمجتمعنا على ديسكورد'),
('discord_online', 'Online', 'متصل'),
('discord_members', 'Members', 'عضو'),
('footer_rights', '© {year} {communityName}. All Rights Reserved.', '© {year} {communityName}. جميع الحقوق محفوظة.'),
('add_to_cart', 'Add to Cart', 'أضف للسلة'),
('item_added_to_cart', '{itemName} added to cart!', 'تمت إضافة {itemName} إلى السلة!'),
('your_cart', 'Your Cart', 'سلة التسوق'),
('empty_cart', 'Your cart is empty.', 'سلتك فارغة.'),
('subtotal', 'Subtotal', 'المجموع الفرعي'),
('checkout', 'Checkout', 'الدفع'),
('remove', 'Remove', 'إزالة'),
('checkout_via_discord', 'Checkout via Discord', 'الدفع عبر ديسكورد'),
('checkout_instructions', 'To complete your purchase, please open a ticket in our Discord server and an admin will assist you.', 'لإكمال عملية الشراء، يرجى فتح تذكرة في سيرفر الديسكورد الخاص بنا وسيقوم أحد المسؤولين بمساعدتك.'),
('open_ticket', 'Open a Ticket', 'فتح تذكرة'),
('apply_now', 'Apply Now', 'قدم الآن'),
('already_applied', 'Already Applied', 'تم التقديم'),
('application_closed', 'Application Closed', 'التقديم مغلق'),
('no_applies_open', 'No applications are open at this time.', 'لا يوجد تقديمات مفتوحة حالياً.'),
('no_rules_yet', 'Rules will be added soon.', 'سيتم إضافة القوانين قريباً.'),
('quiz_rules', 'Application Instructions', 'تعليمات التقديم'),
('begin_quiz', 'Begin Quiz', 'ابدأ الاختبار'),
('question', 'Question', 'سؤال'),
('of', 'of', 'من'),
('time_left', 'Time Left', 'الوقت المتبقي'),
('seconds', 'seconds', 'ثانية'),
('next_question', 'Next Question', 'السؤال التالي'),
('submit_application', 'Submit Application', 'إرسال التقديم'),
('application_submitted', 'Your application has been submitted successfully!', 'تم إرسال تقديمك بنجاح!'),
('application_submitted_desc', 'It will be reviewed by the administration soon. You can track its status on the "My Applications" page.', 'ستتم مراجعته من قبل الإدارة قريباً. يمكنك متابعة حالته من صفحة "تقديماتي".'),
('view_my_applications', 'View My Applications', 'عرض تقديماتي'),
('cheat_attempt_detected', 'Cheat attempt detected! Application has been reset.', 'تم كشف محاولة غش! تم إعادة تعيين التقديم.'),
('cheat_method_switched_tab', 'Switched Tabs', 'تبديل التبويبات'),
('cheat_method_lost_focus', 'Lost Focus', 'فقدان التركيز'),
('cheat_attempts_report', 'Cheat Attempts Report', 'تقرير محاولات الغش'),
('cheat_attempts_count', '{count} attempt(s) were logged.', 'تم تسجيل {count} محاولة/محاولات.'),
('no_cheat_attempts', 'No cheat attempts logged. Great job!', 'لم يتم تسجيل أي محاولات غش. عمل رائع!'),
('quiz_management', 'Quiz Forms Management', 'إدارة نماذج التقديم'),
('submission_management', 'Application Submissions', 'إدارة طلبات التقديم'),
('rules_management', 'Rules Management', 'إدارة القوانين'),
('store_management', 'Store Management', 'إدارة المتجر'),
('appearance_settings', 'Appearance Settings', 'إعدادات المظهر'),
('translations_management', 'Translations Management', 'إدارة الترجمات'),
('permissions_management', 'Permissions Management', 'إدارة الصلاحيات'),
('audit_log', 'Audit Log', 'سجل التدقيق'),
('user_lookup', 'User Lookup', 'بحث عن مستخدم'),
('create_new_quiz', 'Create New Quiz', 'إنشاء تقديم جديد'),
('edit_quiz', 'Edit Quiz', 'تعديل التقديم'),
('quiz_title', 'Quiz Title (Translation Key)', 'عنوان التقديم (مفتاح الترجمة)'),
('quiz_description', 'Quiz Description (Translation Key)', 'وصف التقديم (مفتاح الترجمة)'),
('quiz_questions', 'Quiz Questions', 'أسئلة التقديم'),
('add_question', 'Add Question', 'إضافة سؤال'),
('question_text', 'Question Text (Translation Key)', 'نص السؤال (مفتاح الترجمة)'),
('time_limit_seconds', 'Time Limit (seconds)', 'الوقت المحدد (بالثواني)'),
('save_quiz', 'Save Quiz', 'حفظ التقديم'),
('save_rules', 'Save Rules', 'حفظ القوانين'),
('save_settings', 'Save Settings', 'حفظ الإعدادات'),
('save_translations', 'Save Translations', 'حفظ الترجمات'),
('save_permissions', 'Save Permissions', 'حفظ الصلاحيات'),
('delete_quiz', 'Delete Quiz', 'حذف التقديم'),
('status', 'Status', 'الحالة'),
('open', 'Open', 'مفتوح'),
('closed', 'Closed', 'مغلق'),
('actions', 'Actions', 'الإجراءات'),
('edit', 'Edit', 'تعديل'),
('applicant', 'Applicant', 'المتقدم'),
('submitted_on', 'Submitted On', 'تاريخ التقديم'),
('result_date', 'Result Date', 'تاريخ النتيجة'),
('view_submission', 'View Submission', 'عرض الطلب'),
('take_order', 'Take Order', 'استلام الطلب'),
('take_order_forbidden', 'Not Allowed', 'غير مسموح'),
('taken_by', 'Taken by', 'مستلم بواسطة'),
('accept', 'Accept', 'قبول'),
('refuse', 'Refuse', 'رفض'),
('submission_details', 'Submission Details', 'تفاصيل الطلب'),
('close', 'Close', 'إغلاق'),
('no_pending_submissions', 'There are no pending submissions.', 'لا توجد طلبات تقديم معلقة حالياً.'),
('admin_revoked', 'Your admin permissions have been revoked.', 'تم سحب صلاحيات المشرف منك.'),
('admin_granted', 'You have been granted admin permissions.', 'تم منحك صلاحيات المشرف.'),
('admin_permissions_error', 'Admin permission error or session expired. You have been logged out.', 'خطأ في صلاحيات المشرف أو انتهت صلاحية الجلسة. تم تسجيل خروجك.'),
('admin_session_error_warning', 'Could not verify admin session with the server. Please try again later.', 'لا يمكن التحقق من جلسة المشرف مع الخادم. يرجى المحاولة مرة أخرى لاحقاً.'),
('verifying_admin_permissions', 'Verifying admin permissions...', 'جاري التحقق من صلاحيات المشرف...'),
('quiz_handler_roles', 'Application Handler Roles', 'رتب معالجة التقديم'),
('quiz_handler_roles_desc', 'Enter Role IDs allowed to handle these submissions (comma-separated).', 'ضع هنا آي دي الرتب المسموح لها باستلام هذا النوع من التقديمات (افصل بينها بفاصلة).'),
('config_updated_success', 'Settings updated successfully!', 'تم تحديث الإعدادات بنجاح!'),
('rules_updated_success', 'Rules updated successfully!', 'تم تحديث القوانين بنجاح!'),
('permissions_saved_success', 'Permissions saved successfully!', 'تم حفظ الصلاحيات بنجاح!'),
('discord_id_placeholder', 'Discord User ID...', 'معرف مستخدم ديسكورد...'),
('search', 'Search', 'بحث'),
('ban', 'Ban', 'حظر'),
('unban', 'Unban', 'فك الحظر'),
('reason', 'Reason', 'السبب'),
('duration', 'Duration', 'المدة'),
('confirm_ban', 'Confirm Ban', 'تأكيد الحظر'),
('banned_indefinitely', 'Banned indefinitely', 'محظور بشكل دائم'),
('banned_until', 'Banned until {date}', 'محظور حتى {date}'),
('you_are_banned', 'You Are Banned', 'أنت محظور'),
('banned_page_message', 'You have been banned from accessing this site.', 'تم حظرك من الوصول إلى هذا الموقع.'),
('ban_reason', 'Reason for ban:', 'سبب الحظر:'),
('ban_expires', 'Ban expires:', 'ينتهي الحظر في:'),
('ban_permanent', 'This ban is permanent.', 'الحظر دائم.'),
('community_name', 'Community Name', 'اسم المجتمع'),
('logo_url', 'Logo URL', 'رابط الشعار (URL)'),
('background_image_url', 'Background Image URL', 'رابط صورة الخلفية (URL)'),
('background_image_url_desc', 'Leave empty to use the default animated background.', 'اتركه فارغاً لاستخدام الخلفية الافتراضية.'),
('discord_guild_id', 'Discord Guild ID', 'آي دي سيرفر الديسكورد'),
('discord_guild_id_desc', 'Required for authentication and role sync.', 'مطلوب للمصادقة ومزامنة الرتب.'),
('submissions_webhook_url', 'Submissions Channel ID', 'معرف قناة التقديمات'),
('submissions_webhook_url_desc', 'The ID of the channel that receives new submission notifications.', 'المعرف الرقمي للقناة التي تستقبل إشعارات التقديمات الجديدة.'),
('audit_log_webhook_url', 'Audit Log Channel ID', 'معرف قناة سجل التدقيق'),
('audit_log_webhook_url_desc', 'The ID of the channel that receives admin action logs.', 'المعرف الرقمي للقناة التي تستقبل سجلات إجراءات المشرفين.'),
('discord_roles', 'Discord Roles', 'رتب الديسكورد'),
('available_permissions', 'Available Permissions', 'الصلاحيات المتاحة'),
('select_role_to_manage', 'Select a role to see its permissions.', 'اختر رتبة لعرض صلاحياتها.'),
('admin_permissions_instructions', 'Select a role from the list to view and modify its permissions. The <code>_super_admin</code> permission automatically grants all other permissions.', 'اختر رتبة من القائمة لعرض وتعديل صلاحياتها. صلاحية <code>_super_admin</code> تمنح جميع الصلاحيات الأخرى تلقائياً.'),
('admin_permissions_bootstrap_instructions_title', 'Locked Out?', 'غير قادر على الدخول؟'),
('admin_permissions_bootstrap_instructions_body', 'To grant initial admin access, go to your Supabase <code>role_permissions</code> table. Insert a new row, put your admin role ID in <code>role_id</code>, and type <code>{\\"_super_admin\\"}</code> into the <code>permissions</code> field, then refresh the site.', 'لمنح صلاحيات المشرف الأولية، اذهب إلى جدول <code>role_permissions</code> في Supabase. أضف صفاً جديداً، ضع آي دي رتبة المشرف في <code>role_id</code>، واكتب <code>{\\"_super_admin\\"}</code> في حقل <code>permissions</code> ثم قم بتحديث الصفحة.'),
('status_pending', 'Pending', 'قيد الانتظار'),
('status_taken', 'Under Review', 'قيد المراجعة'),
('status_accepted', 'Accepted', 'مقبول'),
('status_refused', 'Refused', 'مرفوض'),
('no_applications_submitted', 'You have not submitted any applications yet.', 'لم تقم بتقديم أي طلبات بعد.'),
('application_type', 'Application Type', 'نوع التقديم'),
('user_id', 'User ID', 'معرف المستخدم'),
('view_on_discord', 'View on Discord', 'عرض في ديسكورد'),
('recent_applications', 'Recent Applications', 'التقديمات الأخيرة'),
('member', 'Member', 'عضو'),
('refresh_profile_tooltip', 'Sync my data with Discord', 'مزامنة بياناتي مع ديسكورد'),
('profile_synced_success', 'Your profile has been successfully updated!', 'تم تحديث ملفك الشخصي بنجاح!'),
('profile_synced_error', 'Failed to update profile. Please try again.', 'فشل تحديث الملف الشخصي. حاول مرة أخرى.'),
('log_timestamp', 'Timestamp', 'الوقت'),
('log_admin', 'Admin', 'المشرف'),
('log_action', 'Action', 'الإجراء'),
('no_logs_found', 'No logs to display.', 'لا توجد سجلات لعرضها.'),
('health_check_title', 'System Health Check', 'فحص صحة النظام'),
('health_check_desc', 'A diagnostic tool for developers to ensure all system components are correctly connected.', 'أداة تشخيصية للمطورين للتأكد من أن جميع أجزاء النظام متصلة بشكل صحيح.'),
('health_check_step1', 'Step 1: OAuth Redirect URI', 'الخطوة 1: رابط الاسترجاع (OAuth Redirect URI)'),
('health_check_step1_desc', 'Ensure this URI is added to your Supabase Authentication > URL Configuration settings.', 'تأكد من أن هذا الرابط مضاف في قسم "URL Configuration" في إعدادات المصادقة في Supabase.'),
('health_check_uri_label', 'Your Redirect URI is:', 'رابط الاسترجاع الخاص بك هو:'),
('health_check_env_vars', 'Step 2: Environment Variables (Frontend)', 'الخطوة 2: متغيرات البيئة (Frontend)'),
('health_check_env_vars_desc', 'These are the variables loaded into the frontend from your .env file.', 'هذه هي المتغيرات المحملة في الواجهة الأمامية من ملف .env الخاص بك.'),
('health_check_step3', 'Step 3: Bot Connection Test', 'الخطوة 3: اختبار اتصال البوت'),
('health_check_step3_desc', 'This test checks if the Supabase Function can successfully reach your Discord bot.', 'هذا الاختبار يتحقق مما إذا كانت دالة Supabase يمكنها الوصول إلى البوت الخاص بك بنجاح.'),
('health_check_run_test', 'Run Connection Test', 'تشغيل اختبار الاتصال'),
('health_check_test_running', 'Testing...', 'جاري الاختبار...'),
('health_check_test_result', 'Test Result', 'نتيجة الاختبار'),
('health_check_step4', 'Step 4: User Sync Test', 'الخطوة 4: اختبار مزامنة المستخدم'),
('health_check_step4_desc', 'Test fetching a specific user''s data from Discord via the bot.', 'اختبر جلب بيانات مستخدم معين من ديسكورد عبر البوت.'),
('health_check_get_discord_id', 'How to get a Discord ID?', 'كيف أحصل على معرف ديسكورد؟'),
('health_check_get_discord_id_steps', 'In Discord, go to Settings > Advanced > enable Developer Mode. Then, right-click any user and select "Copy User ID".', 'في ديسكورد، اذهب إلى الإعدادات > متقدم > فعل وضع المطور. ثم انقر بزر الماوس الأيمن على أي مستخدم واختر "نسخ معرف المستخدم".'),
('health_check_discord_id_input', 'Enter Discord User ID...', 'أدخل معرف ديسكورد هنا...'),
('health_check_run_sync_test', 'Run Sync Test', 'تشغيل اختبار المزامنة'),
('health_check_sync_test_result', 'Sync Result', 'نتيجة المزامنة'),
('health_check_result_interpretation', 'Interpreting the Results', 'تفسير النتائج'),
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
('q_medic_1', 'What is your top priority when arriving at an accident scene?', 'ما هي أولويتك القصوى عند الوصول إلى مكان الحادث؟')
ON CONFLICT (key) DO UPDATE SET en = excluded.en, ar = excluded.ar;


COMMIT;
`