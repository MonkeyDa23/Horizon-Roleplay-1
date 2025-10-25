
// Vixel Roleplay Website - Full Database Schema (V13 - RLS Recursion Fix Attempt)
export const databaseSchema = `
/*
====================================================================================================
 Vixel Roleplay Website - Full Database Schema (V13 - RLS Recursion Fix Attempt)
 Author: AI
 Date: 2024-06-03
 
 !! WARNING !!
 This script is DESTRUCTIVE. It will completely DROP all existing website-related tables,
 functions, and data before recreating the entire schema. This is intended for development
 or for a clean installation. DO NOT run this on a production database with live user data
 unless you intend to wipe it completely.

 !! SUPER ADMIN NOTE !!
 The first super admin role must be set MANUALLY after running this script.
 See the project's README or documentation for instructions on how to insert the role
 into the 'role_permissions' table.
 
 INSTRUCTIONS:
 1. Go to your Supabase Project Dashboard.
 2. Navigate to the "SQL Editor".
 3. Click "+ New query".
 4. Copy the ENTIRE content of this file.
 5. Paste it into the SQL Editor.
 6. Click "RUN".
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
DROP TABLE IF EXISTS public.role_permissions CASCADE;
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
    ban_expires_at timestamptz
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

-- Table to map Discord role IDs to website permissions.
CREATE TABLE public.role_permissions (
    role_id text PRIMARY KEY,
    permissions text[]
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
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- REFACTORED PERMISSION CHECK FUNCTION (V13 - RLS Recursion Fix Attempt)
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    CROSS JOIN LATERAL jsonb_array_elements(p.roles) AS user_role(role_data)
    JOIN public.role_permissions rp ON rp.role_id = user_role.role_data->>'id'
    WHERE
      p.id = p_user_id
      AND (
        rp.permissions @> ARRAY['_super_admin']::text[] OR
        rp.permissions @> ARRAY[p_permission_key]::text[]
      )
  );
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
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;

-- PUBLIC POLICIES (Read-only)
CREATE POLICY "Allow public read access to config" ON public.config FOR SELECT USING (true);
CREATE POLICY "Allow public read access to products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public read access to quizzes" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Allow public read access to rules" ON public.rules FOR SELECT USING (true);
CREATE POLICY "Allow public read access to translations" ON public.translations FOR SELECT USING (true);

-- USER-SPECIFIC POLICIES
CREATE POLICY "Allow users to read their own profile" ON public.profiles FOR SELECT USING (id = public.get_user_id());
CREATE POLICY "Allow users to see their own submissions" ON public.submissions FOR SELECT USING (user_id = public.get_user_id());
CREATE POLICY "Allow users to insert their own submissions" ON public.submissions FOR INSERT WITH CHECK (user_id = public.get_user_id());

-- ADMIN MANAGEMENT POLICIES (ALL ACTIONS)
-- These policies are a fallback. The primary logic is in SECURITY DEFINER functions which bypass RLS.
CREATE POLICY "Allow admins to manage config" ON public.config FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_appearance'));
CREATE POLICY "Allow admins to manage products" ON public.products FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_store'));
CREATE POLICY "Allow admins to manage quizzes" ON public.quizzes FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_quizzes'));
CREATE POLICY "Allow admins to manage rules" ON public.rules FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_rules'));
CREATE POLICY "Allow admins to manage submissions" ON public.submissions FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_submissions'));
CREATE POLICY "Allow admins to read audit log" ON public.audit_log FOR SELECT USING (public.has_permission(public.get_user_id(), 'admin_audit_log'));
CREATE POLICY "Allow admins to manage permissions" ON public.role_permissions FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_permissions'));
CREATE POLICY "Allow admins to manage translations" ON public.translations FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_translations'));
CREATE POLICY "Allow admins to manage profiles" ON public.profiles FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_lookup'));
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
-- It relies on the RLS INSERT policy on the `submissions` table.
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
('admin_session_error_warning', 'Could not verify admin session with the server. Please try again later.', 'لا يمكن التحقق من جلسة المشرف مع الخادم. يرى المحاولة مرة أخرى لاحقاً.'),
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
('admin_permissions_instructions', 'Select a role from the list to view and modify its permissions. The <code>