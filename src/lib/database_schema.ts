// Vixel Roleplay - Supabase Database Schema
// Version: 1.5.0
// Description: This file contains all the SQL commands to set up the database schema,
// tables, roles, functions, and RLS policies required for the Vixel website.
// To use, copy the entire content of this file and run it in the Supabase SQL Editor.

export const DATABASE_SCHEMA = `
-- Drop existing functions and tables to ensure a clean slate.
-- This is safe to run multiple times.
DROP FUNCTION IF EXISTS public.get_current_user_roles() CASCADE;
DROP FUNCTION IF EXISTS public.has_permission(text) CASCADE;
DROP FUNCTION IF EXISTS public.log_audit_action(text) CASCADE;
DROP FUNCTION IF EXISTS public.log_admin_access() CASCADE;
DROP FUNCTION IF EXISTS public.notify_new_submission() CASCADE;
DROP FUNCTION IF EXISTS public.notify_submission_update(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.save_role_permissions(text, text[]) CASCADE;
DROP FUNCTION IF EXISTS public.update_submission_status(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_translations(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Drop triggers and policies before tables
DROP TRIGGER IF EXISTS on_submission_insert ON public.submissions;
DROP TRIGGER IF EXISTS on_submission_update ON public.submissions;
ALTER TABLE IF EXISTS public.submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quizzes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS public.role_permissions;
DROP TABLE IF EXISTS public.discord_roles_cache;
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
-- Enable pg_net for webhooks if it doesn't exist.
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
    "SUBMISSIONS_WEBHOOK_URL" text,
    "AUDIT_LOG_WEBHOOK_URL" text,
    "SHOW_HEALTH_CHECK" boolean DEFAULT false,
    CONSTRAINT id_check CHECK (id = 1)
);
-- Initial default config
INSERT INTO public.config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.config FOR SELECT USING (true);


-- PROFILES: Stores user-specific data, linked to auth.users
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    discord_id text UNIQUE,
    roles jsonb, -- [{id, name, color, position}]
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
    "allowedTakeRoles" text[], -- Array of Discord Role IDs that can handle submissions
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
    status text NOT NULL DEFAULT 'pending', -- pending, taken, accepted, refused
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

-- RLS HELPER: Get a user's roles from their profile
CREATE OR REPLACE FUNCTION get_current_user_roles()
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_ids text[];
BEGIN
  -- We must use the profiles table because the JWT may be stale.
  -- This ensures RLS policies always have the most up-to-date roles.
  SELECT array_agg(r->>'id')
  FROM public.profiles, jsonb_array_elements(roles) AS r
  WHERE id = auth.uid()
  INTO v_role_ids;

  RETURN COALESCE(v_role_ids, '{}');
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_current_user_roles() TO authenticated;


-- RLS HELPER: Check if a user has a specific permission
CREATE OR REPLACE FUNCTION has_permission(p_permission_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role_ids text[];
  v_has_super_admin boolean;
  v_has_permission boolean;
BEGIN
  -- Use the helper function to get the latest roles from the profile.
  SELECT public.get_current_user_roles() INTO v_user_role_ids;

  -- 1. Check for Super Admin (grants all permissions)
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions
    WHERE role_id = ANY(v_user_role_ids) AND permissions @> '["_super_admin"]'
  ) INTO v_has_super_admin;
  
  IF v_has_super_admin THEN
    RETURN true;
  END IF;

  -- 2. If not super admin, check for the specific permission
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions
    WHERE role_id = ANY(v_user_role_ids) AND permissions @> jsonb_build_array(p_permission_key)
  ) INTO v_has_permission;

  RETURN v_has_permission;
END;
$$;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;


-- ========== RLS POLICIES ==========

-- Submissions RLS
CREATE POLICY "Allow users to see their own submissions" ON public.submissions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Allow admins to see all submissions" ON public.submissions FOR SELECT USING (public.has_permission('admin_submissions'));
CREATE POLICY "Allow authenticated users to insert submissions" ON public.submissions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Quizzes RLS
CREATE POLICY "Allow admins to manage quizzes" ON public.quizzes FOR ALL USING (public.has_permission('admin_quizzes'));

-- Products RLS
CREATE POLICY "Allow admins to manage products" ON public.products FOR ALL USING (public.has_permission('admin_store'));

-- All other admin-related tables will be managed via SECURITY DEFINER functions, so they don't need RLS policies.


-- ========== TRIGGERS & FUNCTIONS ==========

-- FUNCTION: handle_new_user
-- Creates a profile for a new user upon signup.
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, discord_id)
  VALUES (new.id, new.raw_user_meta_data->>'provider_id');
  RETURN new;
END;
$$;
-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- FUNCTION: log_audit_action
-- Helper to insert a new entry into the audit log.
CREATE OR REPLACE FUNCTION log_audit_action(p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_username text;
  v_discord_id text;
BEGIN
  SELECT auth.uid(), auth.jwt()->>'user_name', auth.jwt()->'user_metadata'->>'provider_id' 
  INTO v_user_id, v_username, v_discord_id;
  
  INSERT INTO public.audit_logs (admin_id, admin_username, admin_discord_id, action)
  VALUES (v_user_id, v_username, v_discord_id, p_action);
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_audit_action(text) TO authenticated;


-- RPC FUNCTION: log_admin_access
CREATE OR REPLACE FUNCTION log_admin_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.log_audit_action('Accessed Admin Panel');
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_admin_access() TO authenticated;


-- FUNCTION: notify_new_submission (for trigger)
CREATE OR REPLACE FUNCTION public.notify_new_submission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  webhook_url text;
  payload jsonb;
BEGIN
  SELECT "SUBMISSIONS_WEBHOOK_URL" INTO webhook_url FROM public.config WHERE id = 1;
  IF webhook_url IS NULL OR webhook_url = '' THEN
    RETURN new;
  END IF;

  payload := jsonb_build_object(
    'embeds', jsonb_build_array(
      jsonb_build_object(
        'title', 'New Application Submitted: ' || new."quizTitle",
        'description', 'A new application has been submitted by **' || new.username || '**. You can view it in the admin panel.',
        'color', 15105570, -- Orange
        'timestamp', new."submittedAt"
      )
    )
  );

  PERFORM extensions.http_post(webhook_url, payload, 'application/json', '{}');
  RETURN new;
END;
$$;
-- Trigger for new submissions
CREATE TRIGGER on_submission_insert
  AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE PROCEDURE public.notify_new_submission();


-- FUNCTION: notify_submission_update
CREATE OR REPLACE FUNCTION notify_submission_update(p_event_type text, p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  submission_rec record;
  webhook_url text;
  payload jsonb;
BEGIN
  SELECT "SUBMISSIONS_WEBHOOK_URL" INTO webhook_url FROM public.config WHERE id = 1;
  IF webhook_url IS NULL OR webhook_url = '' THEN RETURN; END IF;
  
  SELECT * INTO submission_rec FROM public.submissions WHERE id = p_submission_id;

  -- This internal function calls a Supabase Edge Function which then DMs the user.
  -- This prevents database triggers from getting stuck on failed Discord API calls.
  PERFORM net.http_post(
    url:='https://olyoxlctsjioqcywsbwp.supabase.co/functions/v1/discord-bot-interactions',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9seW94bGN0c2ppb3FjeXdzYndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgzNDI3MTgsImV4cCI6MjAzMzkxODcxOH0.rM1wum1sMCb5h2aAFu96y2n3z2XOeM4YsyqjLCN2JvY"}',
    body:=jsonb_build_object(
        'type', p_event_type,
        'payload', jsonb_build_object(
            'userId', (SELECT discord_id FROM public.profiles WHERE id = submission_rec.user_id),
            'username', submission_rec.username,
            'quizTitle', submission_rec."quizTitle",
            'adminUsername', submission_rec."adminUsername"
        )
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.notify_submission_update(text, uuid) TO authenticated;


-- RPC FUNCTION: Save role permissions (admins only)
CREATE OR REPLACE FUNCTION save_role_permissions(p_role_id text, p_permissions text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role_ids text[];
  v_can_manage_permissions boolean;
BEGIN
  -- Inlined Security Check for robustness, avoiding nested function context issues.
  SELECT coalesce(jsonb_array_to_text_array(auth.jwt()->'user_metadata'->'roles'), '{}') INTO v_user_role_ids;

  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role_id = ANY(v_user_role_ids) AND (
      permissions @> '["_super_admin"]' OR 
      permissions @> '["admin_permissions"]'
    )
  ) INTO v_can_manage_permissions;
  
  IF NOT v_can_manage_permissions THEN
    RAISE EXCEPTION 'Forbidden: You do not have permission to manage roles.';
  END IF;
  
  -- Log the action
  PERFORM public.log_audit_action(
    CONCAT(
      'Updated permissions for role ID ', 
      p_role_id, 
      '. New perms: ', 
      array_to_string(p_permissions, ', ')
    )
  );

  -- Upsert the permissions for the given role
  INSERT INTO public.role_permissions (role_id, permissions)
  VALUES (p_role_id, p_permissions)
  ON CONFLICT (role_id)
  DO UPDATE SET permissions = EXCLUDED.permissions;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_role_permissions(text, text[]) TO authenticated;


-- RPC FUNCTION: update_submission_status
CREATE OR REPLACE FUNCTION update_submission_status(p_submission_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz_id uuid;
  v_submission record;
  v_allowed_roles text[];
  v_user_roles text[];
  v_is_allowed boolean := false;
  v_is_super_admin boolean := false;
BEGIN
  -- 1. Get submission details, quiz ID, and user roles
  SELECT * INTO v_submission FROM public.submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  v_quiz_id := v_submission."quizId";

  SELECT "allowedTakeRoles" INTO v_allowed_roles FROM public.quizzes WHERE id = v_quiz_id;
  SELECT coalesce(jsonb_array_to_text_array(auth.jwt()->'user_metadata'->'roles'), '{}') INTO v_user_roles;
  
  -- 2. Check if the current user is a super admin (inlined)
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role_id = ANY(v_user_roles) AND permissions @> '["_super_admin"]'
  ) INTO v_is_super_admin;
  
  -- 3. Check if admin is allowed to handle this application type
  IF v_is_super_admin OR v_allowed_roles IS NULL OR array_length(v_allowed_roles, 1) IS NULL THEN
    v_is_allowed := true;
  ELSE
    SELECT EXISTS (SELECT 1 FROM unnest(v_user_roles) r WHERE r = ANY(v_allowed_roles)) INTO v_is_allowed;
  END IF;

  -- 4. Perform security checks and update based on status
  IF p_status = 'taken' THEN
    IF v_submission.status != 'pending' THEN RAISE EXCEPTION 'This submission has already been handled.'; END IF;
    IF NOT v_is_allowed THEN RAISE EXCEPTION 'You do not have permission to handle this application type.'; END IF;
    
    UPDATE public.submissions SET 
      status = 'taken', 
      "adminId" = auth.uid(),
      "adminUsername" = auth.jwt()->>'user_name',
      "updatedAt" = now()
    WHERE id = p_submission_id;

    PERFORM public.notify_submission_update('SUBMISSION_TAKEN', p_submission_id);

  ELSIF p_status = 'accepted' OR p_status = 'refused' THEN
    IF v_submission.status != 'taken' THEN RAISE EXCEPTION 'Submission must be taken before a decision is made.'; END IF;
    IF v_submission."adminId" != auth.uid() AND NOT v_is_super_admin THEN
      RAISE EXCEPTION 'You are not the assigned handler for this submission.';
    END IF;

    UPDATE public.submissions SET 
      status = p_status,
      "updatedAt" = now()
    WHERE id = p_submission_id;

    IF p_status = 'accepted' THEN
      PERFORM public.notify_submission_update('SUBMISSION_ACCEPTED', p_submission_id);
    ELSE
      PERFORM public.notify_submission_update('SUBMISSION_REFUSED', p_submission_id);
    END IF;

  ELSE
    RAISE EXCEPTION 'Invalid status provided.';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_submission_status(uuid, text) TO authenticated;


-- RPC FUNCTION: update_translations
CREATE OR REPLACE FUNCTION update_translations(translations_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.has_permission('admin_translations') THEN
    RAISE EXCEPTION 'Forbidden: You do not have permission to manage translations.';
  END IF;
  
  INSERT INTO public.translations (key, en, ar)
  SELECT t.key, t.en, t.ar
  FROM jsonb_to_recordset(translations_data) AS t(key text, en text, ar text)
  ON CONFLICT (key)
  DO UPDATE SET
    en = EXCLUDED.en,
    ar = EXCLUDED.ar;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_translations(jsonb) TO authenticated;
`;