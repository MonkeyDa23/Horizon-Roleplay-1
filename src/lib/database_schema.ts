
// FIX: Wrapped the entire SQL script in an exported template literal to make this a valid TypeScript module.
export const databaseSchema = `
/*
-- Vixel Roleplay Website - Full Database Schema (V53 - Reverted Rounds)

/*
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

-- Drop all custom functions to ensure a clean re-creation.
DROP FUNCTION IF EXISTS private.send_notification(text, jsonb);
DROP FUNCTION IF EXISTS public.handle_audit_log_notification();
DROP FUNCTION IF EXISTS public.get_config();
DROP FUNCTION IF EXISTS public.get_all_submissions();
DROP FUNCTION IF EXISTS public.add_submission(jsonb);
DROP FUNCTION IF EXISTS public.update_submission_status(uuid, text);
DROP FUNCTION IF EXISTS public.update_submission_status(uuid, text, text);
DROP FUNCTION IF EXISTS public.delete_submission(uuid);
DROP FUNCTION IF EXISTS public.save_quiz_with_translations(jsonb);
DROP FUNCTION IF EXISTS public.save_product_with_translations(jsonb);
DROP FUNCTION IF EXISTS public.save_rules(jsonb);
DROP FUNCTION IF EXISTS public.save_discord_widgets(jsonb);
DROP FUNCTION IF EXISTS public.get_discord_widgets();
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
GRANT USAGE, CREATE ON SCHEMA public TO postgres;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA extensions;

-- Create a private schema to store secrets and internal functions.
CREATE SCHEMA private;

-- =================================================================
-- 3. TABLE CREATION
-- =================================================================
CREATE TABLE public.config (
    id smallint PRIMARY KEY DEFAULT 1,
    "SUPABASE_PROJECT_URL" text,
    "DISCORD_PROXY_SECRET" text,
    "COMMUNITY_NAME" text NOT NULL DEFAULT 'Vixel Roleplay',
    "LOGO_URL" text,
    "DISCORD_GUILD_ID" text,
    "DISCORD_INVITE_URL" text,
    "MTA_SERVER_URL" text,
    "BACKGROUND_IMAGE_URL" text,
    "SHOW_HEALTH_CHECK" boolean DEFAULT false,
    "SUBMISSIONS_WEBHOOK_URL" text,
    "AUDIT_LOG_WEBHOOK_URL" text, -- General/Fallback
    "AUDIT_LOG_SUBMISSIONS_WEBHOOK_URL" text,
    "AUDIT_LOG_BANS_WEBHOOK_URL" text,
    "AUDIT_LOG_ADMIN_WEBHOOK_URL" text,
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
    timestamp timestamptz DEFAULT now(),
    admin_id uuid REFERENCES auth.users(id),
    admin_username text,
    action text,
    log_type text -- Used by trigger to route to correct webhook
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

CREATE OR REPLACE FUNCTION private.send_notification(p_type text, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  project_url text;
  proxy_secret text;
  proxy_url text;
  response extensions.http_response;
  request extensions.http_request;
BEGIN
  SELECT "SUPABASE_PROJECT_URL", "DISCORD_PROXY_SECRET" INTO project_url, proxy_secret FROM public.config WHERE id = 1;
  IF project_url IS NULL OR project_url = '' OR proxy_secret IS NULL OR proxy_secret = '' THEN
    RAISE WARNING 'DM/Notification system is not configured. Please set SUPABASE_PROJECT_URL and DISCORD_PROXY_SECRET in the Admin Panel -> Appearance settings.';
    RETURN;
  END IF;
  proxy_url := project_url || '/functions/v1/discord-proxy';
  request := ROW('POST', proxy_url, ARRAY[extensions.http_header('Content-Type', 'application/json'), extensions.http_header('Authorization', 'Bearer ' || proxy_secret)], 'application/json', jsonb_build_object('type', p_type, 'payload', p_payload)::text)::extensions.http_request;
  response := extensions.http(request);
  IF response.status >= 300 THEN
    RAISE WARNING 'The discord-proxy function responded with an error. Status: %, Body: %', response.status, response.content;
  END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'A critical error occurred while trying to send a notification via the internal proxy function: %', SQLERRM;
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
CREATE POLICY "Admins can manage config" ON public.config FOR ALL USING (public.has_permission(public.get_user_id(), 'admin_appearance'));
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

CREATE OR REPLACE FUNCTION public.add_submission(submission_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE 
  new_submission public.submissions;
  profile_record record;
  notification_payload jsonb;
  receipt_title text;
  receipt_body text;
  webhook_payload jsonb;
  webhook_fields jsonb[] := '{}';
  cheat_report_field jsonb;
BEGIN
  INSERT INTO public.submissions ("quizId", "quizTitle", user_id, username, answers, "cheatAttempts", user_highest_role)
  VALUES (
    (submission_data->>'quizId')::uuid, submission_data->>'quizTitle', public.get_user_id(), submission_data->>'username',
    submission_data->'answers', submission_data->'cheatAttempts', submission_data->>'user_highest_role'
  ) RETURNING * INTO new_submission;

  SELECT p.discord_id, u.raw_user_meta_data->>'avatar_url' as avatar_url INTO profile_record
  FROM public.profiles p JOIN auth.users u ON p.id = u.id WHERE p.id = public.get_user_id();

  -- Send User Receipt DM
  BEGIN
    SELECT en INTO receipt_title FROM translations WHERE key = 'notification_submission_receipt_title';
    SELECT en INTO receipt_body FROM translations WHERE key = 'notification_submission_receipt_body';
    notification_payload := jsonb_build_object(
        'userId', profile_record.discord_id, 'embed', jsonb_build_object(
            'author', jsonb_build_object('name', new_submission.username, 'icon_url', profile_record.avatar_url),
            'title', receipt_title,
            'description', REPLACE(REPLACE(receipt_body, '{username}', new_submission.username), '{quizTitle}', new_submission."quizTitle"),
            'color', 3092790, 'timestamp', new_submission."submittedAt",
            'footer', jsonb_build_object('text', (SELECT "COMMUNITY_NAME" FROM config WHERE id = 1))
        )
    );
    PERFORM private.send_notification('submission_receipt', notification_payload);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send submission receipt DM for submission %: %', new_submission.id, SQLERRM;
  END;

  -- Construct and Send Rich Admin Webhook
  BEGIN
    -- Base Fields
    webhook_fields := array_append(webhook_fields, jsonb_build_object('name', 'Applicant', 'value', new_submission.username, 'inline', true));
    webhook_fields := array_append(webhook_fields, jsonb_build_object('name', 'For', 'value', new_submission."quizTitle", 'inline', true));
    webhook_fields := array_append(webhook_fields, jsonb_build_object('name', 'Highest Role', 'value', new_submission.user_highest_role, 'inline', true));

    -- Cheat Report Field
    IF jsonb_array_length(new_submission."cheatAttempts") > 0 THEN
      cheat_report_field := jsonb_build_object(
        'name', '🚨 Cheat Attempts Report (' || jsonb_array_length(new_submission."cheatAttempts") || ')',
        'value', '```' || (SELECT string_agg(
          '• ' || (attempt->>'method') || ' at ' || to_char((attempt->>'timestamp')::timestamptz, 'HH24:MI:SS'), E'\\n'
        ) FROM jsonb_array_elements(new_submission."cheatAttempts") AS attempt) || '```'
      );
      webhook_fields := array_append(webhook_fields, cheat_report_field);
    END IF;
    
    -- Reverted: Simple answers field
    webhook_fields := array_append(webhook_fields, jsonb_build_object(
        'name', 'Answers',
        'value', (SELECT string_agg('**Q: ' || (ans->>'questionText') || '**\n```' || (ans->>'answer') || '```', E'\n\n') FROM jsonb_array_elements(new_submission.answers) AS ans)
    ));

    webhook_payload := jsonb_build_object(
        'channelId', (SELECT "SUBMISSIONS_WEBHOOK_URL" FROM public.config WHERE id = 1),
        'embed', jsonb_build_object(
            'author', jsonb_build_object('name', new_submission.username, 'icon_url', profile_record.avatar_url),
            'title', 'New Application Submitted!', 'color', 3447003,
            'fields', webhook_fields, 'timestamp', new_submission."submittedAt",
            'footer', jsonb_build_object('text', 'User ID: ' || new_submission.user_id)
        )
    );
    PERFORM private.send_notification('new_submission', webhook_payload);
  EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to send new submission webhook for submission %: %', new_submission.id, SQLERRM;
  END;

  RETURN jsonb_build_object('submission_id', new_submission.id);
END;
$$;

DROP FUNCTION IF EXISTS public.update_submission_status(uuid, text);
DROP FUNCTION IF EXISTS public.update_submission_status(uuid, text, text);
CREATE OR REPLACE FUNCTION public.update_submission_status(p_submission_id uuid, p_new_status text, p_reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE 
  submission_record record; 
  admin_user record;
  profile_record record;
  notification_title text;
  notification_body text;
  notification_payload jsonb;
  final_body text;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_submissions') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
  
  SELECT id, COALESCE(raw_user_meta_data->>'global_name', raw_user_meta_data->>'full_name') AS username, raw_user_meta_data->>'avatar_url' as avatar_url 
  INTO admin_user FROM auth.users WHERE id = public.get_user_id();
  
  UPDATE public.submissions SET status = p_new_status, "adminId" = public.get_user_id(), "adminUsername" = admin_user.username, "updatedAt" = now(), reason = p_reason
  WHERE id = p_submission_id RETURNING * INTO submission_record;
  
  PERFORM public.log_action('قام بتغيير حالة تقديم (' || submission_record."quizTitle" || ') للمستخدم **' || submission_record.username || '** إلى ' || p_new_status, 'submission');
  
  IF p_new_status IN ('taken', 'accepted', 'refused') THEN
    BEGIN
      SELECT discord_id INTO profile_record FROM public.profiles WHERE id = submission_record.user_id;
      IF FOUND THEN
        SELECT en INTO notification_title FROM translations WHERE key = 'notification_submission_' || p_new_status || '_title';
        SELECT en INTO notification_body FROM translations WHERE key = 'notification_submission_' || p_new_status || '_body';
        
        final_body := REPLACE(REPLACE(REPLACE(notification_body, '{username}', submission_record.username), '{quizTitle}', submission_record."quizTitle"), '{adminUsername}', admin_user.username);
        IF p_reason IS NOT NULL AND p_reason <> '' THEN
          final_body := final_body || E'\\n\\n**Reason:** ' || p_reason;
        END IF;

        notification_payload := jsonb_build_object(
            'userId', profile_record.discord_id,
            'embed', jsonb_build_object(
                'author', jsonb_build_object('name', admin_user.username, 'icon_url', admin_user.avatar_url),
                'title', notification_title, 'description', final_body,
                'color', CASE 
                            WHEN p_new_status = 'accepted' THEN 3066993 -- Green
                            WHEN p_new_status = 'taken' THEN 15844367 -- Yellow
                            ELSE 15158332 -- Red
                         END,
                'timestamp', submission_record."updatedAt",
                'footer', jsonb_build_object('text', 'Reviewed by ' || admin_user.username)
            )
        );
        PERFORM private.send_notification('submission_result', notification_payload);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to send DM for submission status update (ID: %): %', p_submission_id, SQLERRM;
    END;
  END IF;
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
    "SUPABASE_PROJECT_URL" = coalesce(new_config->>'SUPABASE_PROJECT_URL', "SUPABASE_PROJECT_URL"),
    "DISCORD_PROXY_SECRET" = coalesce(new_config->>'DISCORD_PROXY_SECRET', "DISCORD_PROXY_SECRET"),
    "COMMUNITY_NAME" = coalesce(new_config->>'COMMUNITY_NAME', "COMMUNITY_NAME"), "LOGO_URL" = coalesce(new_config->>'LOGO_URL', "LOGO_URL"),
    "DISCORD_GUILD_ID" = coalesce(new_config->>'DISCORD_GUILD_ID', "DISCORD_GUILD_ID"), "DISCORD_INVITE_URL" = coalesce(new_config->>'DISCORD_INVITE_URL', "DISCORD_INVITE_URL"),
    "MTA_SERVER_URL" = coalesce(new_config->>'MTA_SERVER_URL', "MTA_SERVER_URL"), "BACKGROUND_IMAGE_URL" = coalesce(new_config->>'BACKGROUND_IMAGE_URL', "BACKGROUND_IMAGE_URL"),
    "SHOW_HEALTH_CHECK" = coalesce((new_config->>'SHOW_HEALTH_CHECK')::boolean, "SHOW_HEALTH_CHECK"), 
    "SUBMISSIONS_WEBHOOK_URL" = coalesce(new_config->>'SUBMISSIONS_WEBHOOK_URL', "SUBMISSIONS_WEBHOOK_URL"),
    "AUDIT_LOG_WEBHOOK_URL" = coalesce(new_config->>'AUDIT_LOG_WEBHOOK_URL', "AUDIT_LOG_WEBHOOK_URL"), 
    "AUDIT_LOG_SUBMISSIONS_WEBHOOK_URL" = coalesce(new_config->>'AUDIT_LOG_SUBMISSIONS_WEBHOOK_URL', "AUDIT_LOG_SUBMISSIONS_WEBHOOK_URL"),
    "AUDIT_LOG_BANS_WEBHOOK_URL" = coalesce(new_config->>'AUDIT_LOG_BANS_WEBHOOK_URL', "AUDIT_LOG_BANS_WEBHOOK_URL"), 
    "AUDIT_LOG_ADMIN_WEBHOOK_URL" = coalesce(new_config->>'AUDIT_LOG_ADMIN_WEBHOOK_URL', "AUDIT_LOG_ADMIN_WEBHOOK_URL")
  WHERE id = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_quiz_with_translations(p_quiz_data jsonb) RETURNS public.quizzes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
  result public.quizzes; 
  v_question jsonb; 
  action_text text; 
  is_new boolean;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_quizzes') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;
  
  is_new := NOT EXISTS (SELECT 1 FROM public.quizzes WHERE id = (p_quiz_data->>'id')::uuid);
  IF is_new THEN action_text := '📝 قام بإنشاء تقديم جديد: ' || (p_quiz_data->>'titleEn');
  ELSE action_text := '✏️ قام بتعديل بيانات التقديم: ' || (p_quiz_data->>'titleEn'); END IF;
  PERFORM public.log_action(action_text, 'admin');
  
  INSERT INTO public.translations (key, en, ar) VALUES 
    (p_quiz_data->>'titleKey', p_quiz_data->>'titleEn', p_quiz_data->>'titleAr'), 
    (p_quiz_data->>'descriptionKey', p_quiz_data->>'descriptionEn', p_quiz_data->>'descriptionAr')
  ON CONFLICT (key) DO UPDATE SET en = excluded.en, ar = excluded.ar;
  
  IF jsonb_typeof(p_quiz_data->'questions') = 'array' THEN
    FOR v_question IN SELECT * FROM jsonb_array_elements(p_quiz_data->'questions') LOOP
      INSERT INTO public.translations (key, en, ar) VALUES (v_question->>'textKey', v_question->>'textEn', v_question->>'textAr')
      ON CONFLICT (key) DO UPDATE SET en = excluded.en, ar = excluded.ar;
    END LOOP;
  END IF;
  
  INSERT INTO public.quizzes (id, "titleKey", "descriptionKey", questions, "isOpen", "allowedTakeRoles", "logoUrl", "bannerUrl", "lastOpenedAt")
  VALUES (
    (p_quiz_data->>'id')::uuid, p_quiz_data->>'titleKey', p_quiz_data->>'descriptionKey', 
    (SELECT jsonb_agg(jsonb_build_object('id', q->>'id', 'textKey', q->>'textKey', 'timeLimit', q->'timeLimit')) FROM jsonb_array_elements(p_quiz_data->'questions') q),
    (p_quiz_data->>'isOpen')::boolean, 
    (SELECT array_agg(elem) FROM jsonb_array_elements_text(p_quiz_data->'allowedTakeRoles') AS elem), 
    p_quiz_data->>'logoUrl', p_quiz_data->>'bannerUrl',
    CASE WHEN (p_quiz_data->>'isOpen')::boolean AND is_new THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET 
    "titleKey" = excluded."titleKey", "descriptionKey" = excluded."descriptionKey", questions = excluded.questions, "isOpen" = excluded."isOpen", 
    "allowedTakeRoles" = excluded."allowedTakeRoles", "logoUrl" = excluded."logoUrl", "bannerUrl" = excluded."bannerUrl", 
    "lastOpenedAt" = CASE WHEN excluded."isOpen" AND NOT quizzes."isOpen" THEN now() ELSE quizzes."lastOpenedAt" END
  RETURNING * INTO result;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_quiz(p_quiz_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE quiz_record record;
BEGIN
    IF NOT public.has_permission(public.get_user_id(), 'admin_quizzes') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
    SELECT "titleKey" INTO quiz_record FROM public.quizzes WHERE id = p_quiz_id;
    IF FOUND THEN
        PERFORM public.log_action('🗑️ قام بحذف نموذج التقديم: *' || quiz_record."titleKey" || '*', 'admin');
        DELETE FROM public.quizzes WHERE id = p_quiz_id;
    END IF;
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

CREATE OR REPLACE FUNCTION public.delete_product(p_product_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE product_record record;
BEGIN
    IF NOT public.has_permission(public.get_user_id(), 'admin_store') THEN RAISE EXCEPTION 'Insufficient permissions.'; END IF;
    SELECT "nameKey" INTO product_record FROM public.products WHERE id = p_product_id;
    IF FOUND THEN
        PERFORM public.log_action('🗑️ قام بحذف المنتج: *' || product_record."nameKey" || '*', 'admin');
        DELETE FROM public.products WHERE id = p_product_id;
    END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.save_rules(p_rules_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_category jsonb; v_rule jsonb;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_rules') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF; PERFORM public.log_action('⚖️ قام بتحديث قوانين السيرفر', 'admin');
  FOR v_category IN SELECT * FROM jsonb_array_elements(p_rules_data) LOOP INSERT INTO public.translations (key, en, ar) VALUES (v_category->>'titleKey', v_category->>'titleEn', v_category->>'titleAr') ON CONFLICT (key) DO UPDATE SET en = excluded.en, ar = excluded.ar; IF jsonb_typeof(v_category->'rules') = 'array' THEN FOR v_rule IN SELECT * FROM jsonb_array_elements(v_category->'rules') LOOP INSERT INTO public.translations (key, en, ar) VALUES (v_rule->>'textKey', v_rule->>'textEn', v_rule->>'textAr') ON CONFLICT (key) DO UPDATE SET en = excluded.en, ar = excluded.ar; END LOOP; END IF; END LOOP;
  DELETE FROM public.rules WHERE true; INSERT INTO public.rules (id, "titleKey", position, rules) SELECT (c->>'id')::uuid, c->>'titleKey', (c->>'position')::int, (SELECT jsonb_agg(jsonb_build_object('id', r->>'id', 'textKey', r->>'textKey')) FROM jsonb_array_elements(c->'rules') AS r) FROM jsonb_array_elements(p_rules_data) AS c;
END; $$;

CREATE OR REPLACE FUNCTION public.get_discord_widgets() RETURNS SETOF public.discord_widgets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.discord_widgets ORDER BY position ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_discord_widgets(p_widgets_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_widget jsonb;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_widgets') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;
  PERFORM public.log_action('🖼️ قام بتحديث ويدجتات الديسكورد', 'admin');
  TRUNCATE public.discord_widgets;
  FOR v_widget IN SELECT * FROM jsonb_array_elements(p_widgets_data) LOOP
    INSERT INTO public.discord_widgets(server_name, server_id, invite_url, position)
    VALUES (v_widget->>'server_name', v_widget->>'server_id', v_widget->>'invite_url', (v_widget->>'position')::int);
  END LOOP;
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
END;
$$;

CREATE OR REPLACE FUNCTION public.unban_user(p_target_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_username text;
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_lookup') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;
  UPDATE public.profiles SET is_banned = false, ban_reason = null, ban_expires_at = null WHERE id = p_target_user_id;
  UPDATE public.bans SET is_active = false, unbanned_by = public.get_user_id(), unbanned_at = now() WHERE user_id = p_target_user_id AND is_active = true;
  SELECT username FROM public.profiles WHERE id = p_target_user_id INTO target_username;
  PERFORM public.log_action('✅ قام بفك الحظر عن المستخدم **' || coalesce(target_username, p_target_user_id::text) || '**', 'ban');
END;
$$;

CREATE OR REPLACE FUNCTION public.save_role_permissions(p_role_id text, p_permissions text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(public.get_user_id(), 'admin_permissions') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;
  PERFORM public.log_action('🛡️ قام بتحديث صلاحيات الرتبة <@&' || p_role_id || '>', 'admin');
  INSERT INTO public.role_permissions (role_id, permissions) VALUES (p_role_id, p_permissions) ON CONFLICT (role_id) DO UPDATE SET permissions = excluded.permissions;
END; $$;

CREATE OR REPLACE FUNCTION public.test_http_request()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
DECLARE
  response extensions.http_response;
BEGIN
  SELECT * INTO response FROM extensions.http_get('https://example.com');
  RETURN jsonb_build_object('status', response.status);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- =================================================================
-- 7. NOTIFICATION TRIGGER
-- =================================================================
CREATE OR REPLACE FUNCTION public.handle_audit_log_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  payload jsonb;
  embed_color int;
  embed_title text;
  admin_avatar_url text;
  config_record record;
  channel_id text;
BEGIN
  SELECT "AUDIT_LOG_WEBHOOK_URL", "AUDIT_LOG_SUBMISSIONS_WEBHOOK_URL", "AUDIT_LOG_BANS_WEBHOOK_URL", "AUDIT_LOG_ADMIN_WEBHOOK_URL"
  INTO config_record FROM public.config WHERE id = 1;

  channel_id := CASE 
    WHEN NEW.log_type = 'submission' THEN config_record."AUDIT_LOG_SUBMISSIONS_WEBHOOK_URL"
    WHEN NEW.log_type = 'ban' THEN config_record."AUDIT_LOG_BANS_WEBHOOK_URL"
    WHEN NEW.log_type = 'admin' THEN config_record."AUDIT_LOG_ADMIN_WEBHOOK_URL"
    ELSE NULL
  END;
  IF channel_id IS NULL THEN channel_id := config_record."AUDIT_LOG_WEBHOOK_URL"; END IF;

  IF channel_id IS NOT NULL THEN
    CASE NEW.log_type
      WHEN 'submission' THEN embed_color := 3447003; embed_title := '📝 Submission Action';
      WHEN 'ban' THEN embed_color := 15158332; embed_title := '🛡️ Moderation Action';
      WHEN 'admin' THEN embed_color := 15105570; embed_title := '⚙️ Admin Panel Action';
      ELSE embed_color := 9807270; embed_title := '📄 General Log';
    END CASE;

    SELECT raw_user_meta_data->>'avatar_url' INTO admin_avatar_url FROM auth.users WHERE id = NEW.admin_id;

    payload := jsonb_build_object(
      'channelId', channel_id,
      'embed', jsonb_build_object(
        'author', jsonb_build_object('name', NEW.admin_username, 'icon_url', admin_avatar_url),
        'title', embed_title, 'description', NEW.action, 'color', embed_color,
        'timestamp', NEW.timestamp,
        'footer', jsonb_build_object('text', 'Admin ID: ' || NEW.admin_id)
      )
    );
    PERFORM private.send_notification('audit_log', payload);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_audit_log_insert
AFTER INSERT ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.handle_audit_log_notification();

-- =================================================================
-- 8. INITIAL DATA SEEDING
-- =================================================================
-- Add new notification templates for DMs
INSERT INTO public.translations(key, en, ar) VALUES
('notification_submission_receipt_title', 'Application Received', 'تم استلام طلبك'),
('notification_submission_receipt_body', 'Hello {username}, we have successfully received your application for **{quizTitle}**. It is now pending review by our administration team. We will notify you again once its status is updated.', 'مرحباً {username}، لقد استلمنا بنجاح طلب تقديمك لوظيفة **{quizTitle}**. طلبك الآن قيد الانتظار لمراجعته من قبل فريق الإدارة. سنقوم بإعلامك مرة أخرى عند تحديث حالته.'),
('notification_submission_taken_title', 'Application Under Review', 'طلبك قيد المراجعة'),
('notification_submission_taken_body', 'Good news, {username}! Your application for **{quizTitle}** has been picked up for review by **{adminUsername}**. You will receive another notification once a final decision has been made.', 'أخبار جيدة، {username}! طلب تقديمك لوظيفة **{quizTitle}** قد تم استلامه للمراجعة من قبل **{adminUsername}**. ستتلقى إشعارًا آخر بمجرد اتخاذ قرار نهائي.'),
('notification_submission_accepted_title', 'Application Accepted!', 'تم قبول طلبك!'),
('notification_submission_accepted_body', 'Congratulations, {username}! We are pleased to inform you that your application for **{quizTitle}** has been accepted by **{adminUsername}**. Please follow up with the administration on Discord for your next steps.', 'تهانينا، {username}! يسعدنا إخبارك بأن طلب تقديمك لوظيفة **{quizTitle}** قد تم قبوله من قبل **{adminUsername}**. يرجى المتابعة مع الإدارة على ديسكورد لمعرفة خطواتك التالية.'),
('notification_submission_refused_title', 'Application Update', 'تحديث بخصوص طلبك'),
('notification_submission_refused_body', 'Hello {username}, after careful consideration, your application for **{quizTitle}** has been refused by **{adminUsername}**.', 'مرحباً {username}، بعد مراجعة دقيقة، تم رفض طلب تقديمك لوظيفة **{quizTitle}** من قبل **{adminUsername}**.')
ON CONFLICT(key) DO NOTHING;


COMMIT;
`;
