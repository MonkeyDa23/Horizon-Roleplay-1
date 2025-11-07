// src/lib/database_schema.ts

export const databaseSchema = `
/*
-- Vixel Roleplay Website - Full Database Schema (V8.0.0 - Bot-less Architecture)

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
DROP TRIGGER IF EXISTS on_audit_log_insert ON public.audit_log;

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

DROP FUNCTION IF EXISTS private.send_notification(text, jsonb);
DROP FUNCTION IF EXISTS public.handle_audit_log_notification();
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
DROP FUNCTION IF EXISTS public.test_http_request();

-- =================================================================
-- 2. INITIAL SETUP & EXTENSIONS
-- =================================================================
CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";
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
    
    -- Notification Webhooks
    "submissions_webhook_url" text,
    "log_webhook_submissions" text,
    "log_webhook_bans" text,
    "log_webhook_admin" text,
    "audit_log_webhook_url" text, -- General/Fallback
    
    -- Mention Roles
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
    created_at timestamptz DEFAULT current_timestamp,
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
    "submittedAt" timestamptz DEFAULT current_timestamp,
    status text DEFAULT 'pending',
    "adminId" uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    "adminUsername" text,
    "updatedAt" timestamptz,
    "cheatAttempts" jsonb,
    user_highest_role text,
    reason text
);

CREATE TABLE public.rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "titleKey" text NOT NULL,
    position int NOT NULL,
    rules jsonb
);

CREATE TABLE public.audit_log (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    timestamp timestamptz DEFAULT current_timestamp,
    admin_id uuid REFERENCES auth.users(id),
    admin_username text,
    action text,
    log_type text
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
    created_at timestamptz DEFAULT current_timestamp,
    unbanned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    unbanned_at timestamptz,
    is_active boolean DEFAULT true
);

CREATE TABLE public.discord_widgets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_name text NOT NULL,
    server_id text NOT NULL,
    invite_url text NOT NULL,
    position int NOT NULL
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

-- This is the new, simplified notification function.
-- It securely calls the 'discord-proxy' Edge Function using the service role key.
CREATE OR REPLACE FUNCTION private.send_notification(p_type text, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  project_url text;
  proxy_url text;
  service_key text;
  response extensions.http_response;
BEGIN
  project_url := 'https://' || split_part(current_setting('supa.endpoint'), ':', 1);
  proxy_url := project_url || '/functions/v1/discord-proxy';

  -- The service role key is retrieved securely from a private schema.
  -- This key allows this function to securely invoke the Edge Function.
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  IF service_key IS NULL THEN
    RAISE WARNING 'Could not retrieve service_role_key to send notification. Please ensure it is available in vault.';
    RETURN;
  END IF;

  SELECT * INTO response FROM extensions.http((
    'POST'::extensions.http_method,
    proxy_url,
    ARRAY[
        ('Content-Type', 'application/json'),
        ('Authorization', 'Bearer ' || service_key)
    ]::extensions.http_header[],
    'application/json',
    jsonb_build_object('type', p_type, 'payload', p_payload)::text
  )::extensions.http_request);

  IF response.status >= 300 THEN
    RAISE WARNING 'Notification proxy function responded with an error. Status: %, Body: %', response.status, response.content;
  END IF;
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
ALTER TABLE public.discord_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.config FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.rules FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.translations FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.discord_widgets FOR SELECT USING (true);
CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT USING (id = public.get_user_id());
CREATE POLICY "Users can access their own submissions" ON public.submissions FOR ALL USING (user_id = public.get_user_id());

CREATE POLICY "Admins can manage config" ON public.config FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_appearance') OR public.has_permission(public.get_user_id(), 'admin_notifications'));
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_store'));
CREATE POLICY "Admins can manage quizzes" ON public.quizzes FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_quizzes'));
CREATE POLICY "Admins can manage rules" ON public.rules FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_rules'));
CREATE POLICY "Admins can manage translations" ON public.translations FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_translations') OR public.has_permission(public.get_user_id(), 'admin_notifications'));
CREATE POLICY "Admins can manage bans" ON public.bans FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_lookup'));
CREATE POLICY "Admins can manage role permissions" ON public.role_permissions FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_permissions'));
CREATE POLICY "Admins can manage discord widgets" ON public.discord_widgets FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_widgets'));
CREATE POLICY "Admins can read audit log" ON public.audit_log FOR SELECT USING (public.has_permission(public.get_user_id(), 'admin_audit_log'));
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (public.has_permission(public.get_user_id(), '_super_admin'));
CREATE POLICY "Admins can manage submissions" ON public.submissions FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_submissions'));

-- =================================================================
-- 6. RPC FUNCTIONS
-- =================================================================
CREATE OR REPLACE FUNCTION public.get_config() RETURNS json LANGUAGE sql STABLE AS $$ SELECT row_to_json(c) FROM public.config c WHERE id = 1; $$;

CREATE OR REPLACE FUNCTION public.get_all_submissions() RETURNS SETOF public.submissions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_submissions') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  RETURN QUERY SELECT * FROM public.submissions ORDER BY "submittedAt" DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_submission(submission_data jsonb) RETURNS public.submissions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE 
  new_submission public.submissions;
  profile_record record;
  admin_payload jsonb;
  receipt_payload jsonb;
  config_record record;
BEGIN
  SELECT * INTO config_record FROM public.config WHERE id = 1;
  
  INSERT INTO public.submissions ("quizId", "quizTitle", user_id, username, answers, "cheatAttempts", user_highest_role)
  VALUES (
    (submission_data->>'quizId')::uuid, submission_data->>'quizTitle', public.get_user_id(), submission_data->>'username',
    submission_data->'answers', submission_data->'cheatAttempts', submission_data->>'user_highest_role'
  ) RETURNING * INTO new_submission;

  BEGIN
    SELECT discord_id INTO profile_record FROM public.profiles WHERE id = public.get_user_id();
    receipt_payload := jsonb_build_object(
        'userId', profile_record.discord_id,
        'embed', jsonb_build_object(
            'titleKey', 'notification_submission_receipt_title',
            'bodyKey', 'notification_submission_receipt_body',
            'replacements', jsonb_build_object('username', new_submission.username, 'quizTitle', new_submission."quizTitle")
        )
    );
    PERFORM private.send_notification('submission_receipt', receipt_payload);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send submission receipt DM for submission %: %', new_submission.id, SQLERRM;
  END;

  BEGIN
    SELECT avatar_url, discord_id INTO profile_record FROM public.profiles WHERE id = public.get_user_id();
    admin_payload := jsonb_build_object(
        'username', new_submission.username, 'avatarUrl', profile_record.avatar_url,
        'discordId', profile_record.discord_id, 'quizTitle', new_submission."quizTitle",
        'submittedAt', new_submission."submittedAt", 'userHighestRole', new_submission.user_highest_role,
        'adminPanelUrl', 'https://' || split_part(current_setting('supa.endpoint'), ':', 1)
    );
    PERFORM private.send_notification('new_submission', admin_payload);
  EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to send new submission admin notification for submission %: %', new_submission.id, SQLERRM;
  END;

  RETURN new_submission;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_submission_status(p_submission_id uuid, p_new_status text, p_reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE 
  submission_record record; 
  admin_user record;
  profile_record record;
  notification_payload jsonb;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_submissions') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  
  SELECT id, COALESCE(raw_user_meta_data->>'global_name', raw_user_meta_data->>'full_name') as username 
  INTO admin_user 
  FROM auth.users WHERE id = public.get_user_id();

  UPDATE public.submissions
  SET 
    status = p_new_status,
    "adminId" = CASE WHEN p_new_status = 'taken' THEN admin_user.id ELSE "adminId" END,
    "adminUsername" = CASE WHEN p_new_status = 'taken' THEN admin_user.username ELSE "adminUsername" END,
    reason = CASE WHEN p_new_status IN ('accepted', 'refused') THEN p_reason ELSE reason END,
    "updatedAt" = CASE WHEN p_new_status IN ('accepted', 'refused') THEN current_timestamp ELSE "updatedAt" END
  WHERE id = p_submission_id
  RETURNING * INTO submission_record;

  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found.'; END IF;

  PERFORM public.log_action(
    format('Updated submission for %s (%s) to %s. Admin: %s', submission_record.username, submission_record."quizTitle", p_new_status, admin_user.username),
    'submission'
  );

  IF p_new_status IN ('accepted', 'refused') THEN
    BEGIN
      SELECT discord_id INTO profile_record FROM public.profiles WHERE id = submission_record.user_id;
      notification_payload := jsonb_build_object(
        'userId', profile_record.discord_id,
        'embed', jsonb_build_object(
          'titleKey', 'notification_submission_' || p_new_status || '_title',
          'bodyKey', 'notification_submission_' || p_new_status || '_body',
          'replacements', jsonb_build_object(
              'username', submission_record.username,
              'quizTitle', submission_record."quizTitle",
              'adminUsername', submission_record."adminUsername",
              'reason', COALESCE(p_reason, 'No reason provided.')
          )
        )
      );
      PERFORM private.send_notification('submission_result', notification_payload);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to send submission result DM for submission %: %', submission_record.id, SQLERRM;
    END;
  END IF;

END;
$$;

CREATE OR REPLACE FUNCTION public.delete_submission(p_submission_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), '_super_admin') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  DELETE FROM public.submissions WHERE id = p_submission_id;
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
    (SELECT jsonb_agg(value) FROM jsonb_array_elements_text(p_quiz_data->'allowedTakeRoles')),
    p_quiz_data->>'logoUrl',
    p_quiz_data->>'bannerUrl',
    (SELECT jsonb_agg(jsonb_build_object('id', el->>'id', 'textKey', el->>'textKey', 'timeLimit', (el->>'timeLimit')::int)) FROM jsonb_array_elements(p_quiz_data->'questions') as el),
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

  PERFORM public.log_action(format('Saved quiz: %s', p_quiz_data->>'titleEn'), 'admin');
  RETURN quiz_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_quiz(p_quiz_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_quizzes') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  DELETE FROM public.quizzes WHERE id = p_quiz_id;
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
  
  PERFORM public.log_action(format('Saved product: %s', p_product_data->>'nameEn'), 'admin');
  RETURN product_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_product(p_product_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_store') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  DELETE FROM public.products WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_rules(p_rules_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    category jsonb;
    rule jsonb;
BEGIN
    IF NOT public.has_permission(public.get_user_id(), 'admin_rules') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;

    -- Clear existing rules
    DELETE FROM public.rules;

    FOR category IN SELECT * FROM jsonb_array_elements(p_rules_data) LOOP
        -- Upsert category title translation
        INSERT INTO public.translations (key, en, ar)
        VALUES (category->>'titleKey', category->>'titleEn', category->>'titleAr')
        ON CONFLICT (key) DO UPDATE SET en = EXCLUDED.en, ar = EXCLUDED.ar;

        -- Upsert rule text translations
        FOR rule IN SELECT * FROM jsonb_array_elements(category->'rules') LOOP
            INSERT INTO public.translations (key, en, ar)
            VALUES (rule->>'textKey', rule->>'textEn', rule->>'textAr')
            ON CONFLICT (key) DO UPDATE SET en = EXCLUDED.en, ar = EXCLUDED.ar;
        END LOOP;
        
        -- Insert the category with its rules
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
    DELETE FROM public.discord_widgets;
    INSERT INTO public.discord_widgets (server_name, server_id, invite_url, position)
    SELECT value->>'server_name', value->>'server_id', value->>'invite_url', (value->>'position')::int
    FROM jsonb_array_elements(p_widgets_data);
    PERFORM public.log_action('Updated Discord widgets', 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_config(new_config jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    allowed_admin_keys text[] := ARRAY['COMMUNITY_NAME', 'LOGO_URL', 'DISCORD_GUILD_ID', 'BACKGROUND_IMAGE_URL'];
    allowed_notif_keys text[] := ARRAY['submissions_webhook_url', 'log_webhook_submissions', 'log_webhook_bans', 'log_webhook_admin', 'audit_log_webhook_url', 'mention_role_submissions', 'mention_role_audit_log_submissions', 'mention_role_audit_log_bans', 'mention_role_audit_log_admin', 'mention_role_audit_log_general'];
    key text;
    sql_query text := 'UPDATE public.config SET ';
    updates text[] := '{}';
BEGIN
    IF public.has_permission(public.get_user_id(), 'admin_appearance') THEN
        FOR key IN SELECT jsonb_object_keys(new_config) LOOP
            IF key = ANY(allowed_admin_keys) THEN
                updates := array_append(updates, format('"%s" = %L', key, new_config->>key));
            END IF;
        END LOOP;
    END IF;

    IF public.has_permission(public.get_user_id(), 'admin_notifications') THEN
        FOR key IN SELECT jsonb_object_keys(new_config) LOOP
            IF key = ANY(allowed_notif_keys) THEN
                updates := array_append(updates, format('"%s" = %L', key, new_config->>key));
            END IF;
        END LOOP;
    END IF;

    IF array_length(updates, 1) IS NULL THEN
        RAISE EXCEPTION 'Insufficient permissions or no valid fields provided.';
    END IF;

    sql_query := sql_query || array_to_string(updates, ', ') || ' WHERE id = 1;';
    EXECUTE sql_query;
    PERFORM public.log_action('Updated system configuration.', 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.log_action(p_action text, p_log_type text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    admin_user record;
BEGIN
    SELECT id, COALESCE(raw_user_meta_data->>'global_name', raw_user_meta_data->>'full_name') as username 
    INTO admin_user 
    FROM auth.users WHERE id = public.get_user_id();

    INSERT INTO public.audit_log (admin_id, admin_username, action, log_type)
    VALUES (admin_user.id, admin_user.username, p_action, p_log_type);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_page_visit(p_page_name text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM public.log_action(format('Visited admin page: %s', p_page_name), 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.ban_user(p_target_user_id uuid, p_reason text, p_duration_hours int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    expires_timestamp timestamptz;
BEGIN
    IF NOT public.has_permission(public.get_user_id(), 'admin_lookup') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
    
    expires_timestamp := CASE WHEN p_duration_hours IS NOT NULL THEN current_timestamp + (p_duration_hours * interval '1 hour') ELSE NULL END;

    UPDATE public.profiles SET is_banned = true, ban_reason = p_reason, ban_expires_at = expires_timestamp WHERE id = p_target_user_id;
    INSERT INTO public.bans (user_id, banned_by, reason, expires_at) VALUES (p_target_user_id, public.get_user_id(), p_reason, expires_timestamp);
    PERFORM public.log_action(format('Banned user %s. Reason: %s', p_target_user_id, p_reason), 'ban');
END;
$$;

CREATE OR REPLACE FUNCTION public.unban_user(p_target_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.has_permission(public.get_user_id(), 'admin_lookup') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
    UPDATE public.profiles SET is_banned = false, ban_reason = null, ban_expires_at = null WHERE id = p_target_user_id;
    UPDATE public.bans SET is_active = false, unbanned_by = public.get_user_id(), unbanned_at = current_timestamp WHERE user_id = p_target_user_id AND is_active = true;
    PERFORM public.log_action(format('Unbanned user %s.', p_target_user_id), 'ban');
END;
$$;

CREATE OR REPLACE FUNCTION public.save_role_permissions(p_role_id text, p_permissions text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.has_permission(public.get_user_id(), 'admin_permissions') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
    INSERT INTO public.role_permissions (role_id, permissions)
    VALUES (p_role_id, p_permissions)
    ON CONFLICT (role_id) DO UPDATE SET permissions = EXCLUDED.permissions;
    PERFORM public.log_action(format('Updated permissions for role %s', p_role_id), 'admin');
END;
$$;

-- =================================================================
-- 7. TRIGGERS
-- =================================================================
CREATE OR REPLACE FUNCTION public.handle_audit_log_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'adminUsername', NEW.admin_username,
    'action', NEW.action,
    'timestamp', NEW.timestamp,
    'log_type', NEW.log_type
  );
  -- Send to bot for logging
  BEGIN
    PERFORM private.send_notification('audit_log', payload);
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the original transaction
    RAISE WARNING 'Failed to send audit log notification: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_audit_log_insert
AFTER INSERT ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.handle_audit_log_notification();


-- =================================================================
-- 8. HEALTH CHECK FUNCTIONS
-- =================================================================
CREATE OR REPLACE FUNCTION public.test_http_request() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  response http_response;
BEGIN
  SELECT * INTO response FROM http_get('https://httpbin.org/get');
  RETURN jsonb_build_object(
    'status', response.status,
    'content_type', response.content_type
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Commit the transaction
COMMIT;
`