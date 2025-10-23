
// Vixel Roleplay Website - Full Database Schema (V7 - Quoted Identifiers)
export const databaseSchema = `
/*
====================================================================================================
 Vixel Roleplay Website - Full Database Schema (V7 - Quoted Identifiers)
 Author: AI
 Date: 2024-05-28
 
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
-- 4. ROW LEVEL SECURITY (RLS)
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

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

CREATE POLICY "Allow public read access" ON public.config FOR SELECT USING (true);
CREATE POLICY "Allow public read access to products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public read access to quizzes" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Allow public read access to rules" ON public.rules FOR SELECT USING (true);
CREATE POLICY "Allow public read access to translations" ON public.translations FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to read their own profile" ON public.profiles FOR SELECT USING (id = public.get_user_id());
CREATE POLICY "Allow users to see their own submissions" ON public.submissions FOR SELECT USING (user_id = public.get_user_id());


-- =================================================================
-- 5. HELPER & RPC FUNCTIONS
-- =================================================================
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_roles_json jsonb;
  role_ids text[];
  has_perm boolean;
BEGIN
  -- This function is SECURITY DEFINER, so it runs with the permissions of the user who defined it (postgres).
  SELECT roles INTO user_roles_json FROM public.profiles WHERE id = p_user_id;

  IF user_roles_json IS NULL OR jsonb_array_length(user_roles_json) = 0 THEN
    RETURN false;
  END IF;

  SELECT array_agg(r->>'id') INTO role_ids FROM jsonb_array_elements(user_roles_json) AS r;

  -- First, check for the super admin permission, as it overrides all others.
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions
    WHERE role_id = ANY(role_ids) AND '_super_admin' = ANY(permissions)
  ) INTO has_perm;

  IF has_perm THEN
    RETURN true;
  END IF;

  -- If not a super admin, check for the specific permission.
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions
    WHERE role_id = ANY(role_ids) AND p_permission_key = ANY(permissions)
  ) INTO has_perm;

  RETURN has_perm;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_config()
RETURNS json
LANGUAGE sql STABLE
AS $$
  SELECT row_to_json(c) FROM public.config c WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.get_all_submissions()
RETURNS SETOF public.submissions
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_submissions') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  RETURN QUERY SELECT * FROM public.submissions ORDER BY "submittedAt" DESC;
END;
$$;

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
    (submission_data->>'user_id')::uuid,
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
          'userId', submission_record.user_id,
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
-- 6. FINALIZATION & GRANTS
-- =================================================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

COMMIT;
`;