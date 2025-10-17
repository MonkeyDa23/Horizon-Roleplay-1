
export const DATABASE_SCHEMA = `
-- -----------------------------------------------------------------------------
-- -                                                                           -
-- -                     HORIZON ROLEPLAY DATABASE SETUP                       -
-- -                                                                           -
-- -   Instructions:                                                           -
-- -   1. Go to your Supabase project dashboard.                               -
-- -   2. Navigate to the "SQL Editor".                                        -
-- -   3. Click "+ New query".                                                 -
-- -   4. Copy ALL of the code below and paste it into the editor.             -
-- -   5. Click "RUN". This script is safe to run multiple times.              -
-- -                                                                           -
-- -----------------------------------------------------------------------------

-- =============================================================================
--  0. EXTENSIONS
-- =============================================================================
-- Enable HTTP extension for sending webhooks from database triggers
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
-- Enable pg_net for invoking Edge Functions from database triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- =============================================================================
--  1. PROFILES & AUTHENTICATION
-- =============================================================================
-- Create a table for public profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean DEFAULT false NOT NULL,
  is_super_admin boolean DEFAULT false NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- NEW: Helper function to check admin status without recursion
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Bypasses RLS to check the is_admin flag of the current user.
  RETURN (SELECT is_admin FROM public.profiles WHERE id = auth.uid());
EXCEPTION
  -- Return false if the user has no profile yet or any other error occurs.
  WHEN OTHERS THEN
    RETURN false;
END;
$$;


-- Policies for profiles
DROP POLICY IF EXISTS "Allow individual read access" ON public.profiles;
CREATE POLICY "Allow individual read access" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- UPDATED: Use the helper function to prevent infinite recursion.
DROP POLICY IF EXISTS "Allow admin read access" ON public.profiles;
CREATE POLICY "Allow admin read access" ON public.profiles
  FOR SELECT USING (public.is_current_user_admin() = true);

DROP POLICY IF EXISTS "Allow individual insert access" ON public.profiles;
CREATE POLICY "Allow individual insert access" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow individual update access" ON public.profiles;
CREATE POLICY "Allow individual update access" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


-- Function to create a profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;

-- Trigger to execute the function on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
--  2. WEBSITE CONFIGURATION
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.config (
    id bigint PRIMARY KEY DEFAULT 1,
    "COMMUNITY_NAME" text,
    "LOGO_URL" text,
    "DISCORD_GUILD_ID" text,
    "DISCORD_INVITE_URL" text,
    "MTA_SERVER_URL" text,
    "BACKGROUND_IMAGE_URL" text,
    "SHOW_HEALTH_CHECK" boolean DEFAULT false,
    "SUPER_ADMIN_ROLE_IDS" text[],
    "HANDLER_ROLE_IDS" text[],
    "SUBMISSIONS_WEBHOOK_URL" text,
    "AUDIT_LOG_WEBHOOK_URL" text,
    CONSTRAINT single_row_constraint CHECK (id = 1)
);

-- FIX: Add the columns if they are missing from an older schema version to ensure backwards compatibility.
ALTER TABLE public.config ADD COLUMN IF NOT EXISTS "AUDIT_LOG_WEBHOOK_URL" text;
ALTER TABLE public.config ADD COLUMN IF NOT EXISTS "SUBMISSIONS_WEBHOOK_URL" text;


ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.config;
CREATE POLICY "Allow public read access" ON public.config
  FOR SELECT USING (true);
  
DROP POLICY IF EXISTS "Allow super admin update access" ON public.config;
CREATE POLICY "Allow super admin update access" ON public.config
  FOR UPDATE USING (
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- Insert a default config row if it doesn't exist
INSERT INTO public.config (id, "COMMUNITY_NAME", "LOGO_URL", "DISCORD_GUILD_ID", "SHOW_HEALTH_CHECK", "SUPER_ADMIN_ROLE_IDS", "HANDLER_ROLE_IDS") 
VALUES (1, 'Horizon RP', 'https://k.top4top.io/p_3567qyjog1.png', 'YOUR_DISCORD_GUILD_ID_HERE', true, '{}', '{}')
ON CONFLICT (id) DO UPDATE SET
    "COMMUNITY_NAME" = COALESCE(public.config."COMMUNITY_NAME", 'Horizon RP'),
    "LOGO_URL" = COALESCE(public.config."LOGO_URL", 'https://k.top4top.io/p_3567qyjog1.png'),
    "DISCORD_GUILD_ID" = COALESCE(public.config."DISCORD_GUILD_ID", 'YOUR_DISCORD_GUILD_ID_HERE'),
    "SHOW_HEALTH_CHECK" = COALESCE(public.config."SHOW_HEALTH_CHECK", true),
    "SUPER_ADMIN_ROLE_IDS" = COALESCE(public.config."SUPER_ADMIN_ROLE_IDS", '{}'),
    "HANDLER_ROLE_IDS" = COALESCE(public.config."HANDLER_ROLE_IDS", '{}');


-- =============================================================================
--  3. QUIZZES (APPLICATIONS)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "titleKey" text NOT NULL,
  "descriptionKey" text,
  questions jsonb,
  "isOpen" boolean DEFAULT false,
  "allowedTakeRoles" text[],
  "lastOpenedAt" timestamp with time zone,
  "logoUrl" text,
  "bannerUrl" text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.quizzes;
CREATE POLICY "Allow public read access" ON public.quizzes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow super admin full access" ON public.quizzes;
CREATE POLICY "Allow super admin full access" ON public.quizzes FOR ALL USING (
  (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
);


-- =============================================================================
--  4. SUBMISSIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "quizId" uuid REFERENCES public.quizzes(id) ON DELETE SET NULL,
  "quizTitle" text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  username text,
  answers jsonb,
  status text DEFAULT 'pending',
  "adminId" uuid REFERENCES auth.users(id),
  "adminUsername" text,
  "cheatAttempts" jsonb,
  "user_highest_role" text,
  submitted_at timestamp with time zone DEFAULT now(),
  "updatedAt" timestamp with time zone
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow individual access" ON public.submissions;
CREATE POLICY "Allow individual access" ON public.submissions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow admin read access" ON public.submissions;
CREATE POLICY "Allow admin read access" ON public.submissions
  FOR SELECT USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);
  
DROP POLICY IF EXISTS "Allow individual insert" ON public.submissions;
CREATE POLICY "Allow individual insert" ON public.submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Helper function for admins to update submission status securely AND create an audit log
CREATE OR REPLACE FUNCTION public.update_submission_status(p_submission_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_admin_id uuid := auth.uid();
  current_admin_username text;
  submission_info RECORD;
BEGIN
  -- Ensure the user is an admin
  IF NOT (SELECT is_admin FROM public.profiles WHERE id = current_admin_id) THEN
    RAISE EXCEPTION 'User is not an admin';
  END IF;
  
  -- Get info for logging
  SELECT s.username, s."quizTitle" INTO submission_info
  FROM public.submissions s
  WHERE s.id = p_submission_id;

  -- Get admin username
  SELECT raw_user_meta_data->>'full_name' INTO current_admin_username
  FROM auth.users WHERE id = current_admin_id;

  -- Update submission
  UPDATE public.submissions
  SET
    status = p_status,
    "adminId" = current_admin_id,
    "adminUsername" = current_admin_username,
    "updatedAt" = now()
  WHERE id = p_submission_id;

  -- Create audit log entry
  INSERT INTO public.audit_logs(admin_id, admin_username, action)
  VALUES (
    current_admin_id,
    current_admin_username,
    'Updated submission for "' || submission_info.username || '" (' || submission_info."quizTitle" || ') to status: ' || p_status
  );
END;
$$;


-- =============================================================================
--  5. STORE PRODUCTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nameKey" text NOT NULL,
  "descriptionKey" text,
  price numeric(10, 2) NOT NULL,
  "imageUrl" text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.products;
CREATE POLICY "Allow public read access" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow super admin full access" ON public.products;
CREATE POLICY "Allow super admin full access" ON public.products FOR ALL USING (
  (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
);


-- =============================================================================
--  6. RULES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.rule_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "titleKey" text NOT NULL,
  "order" int
);

CREATE TABLE IF NOT EXISTS public.rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.rule_categories(id) ON DELETE CASCADE,
  "textKey" text NOT NULL
);

ALTER TABLE public.rule_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.rule_categories;
CREATE POLICY "Allow public read access" ON public.rule_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow super admin full access" ON public.rule_categories;
CREATE POLICY "Allow super admin full access" ON public.rule_categories FOR ALL USING (
  (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
);

ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.rules;
CREATE POLICY "Allow public read access" ON public.rules FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow super admin full access" ON public.rules;
CREATE POLICY "Allow super admin full access" ON public.rules FOR ALL USING (
  (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
);


-- =============================================================================
--  7. AUDIT LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamp with time zone DEFAULT now(),
  admin_id uuid REFERENCES auth.users(id),
  admin_username text,
  action text
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admin read access" ON public.audit_logs;
CREATE POLICY "Allow admin read access" ON public.audit_logs
  FOR SELECT USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);
  
DROP POLICY IF EXISTS "Allow admin insert access" ON public.audit_logs;
CREATE POLICY "Allow admin insert access" ON public.audit_logs
  FOR INSERT WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);

-- =============================================================================
--  8. DISCORD WEBHOOK & DM TRIGGERS
-- =============================================================================

-- Submission Webhook (for admins)
CREATE OR REPLACE FUNCTION public.notify_new_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  webhook_url TEXT;
  payload JSONB;
  cheat_count INT;
BEGIN
  SELECT "SUBMISSIONS_WEBHOOK_URL" INTO webhook_url FROM public.config WHERE id = 1;

  IF webhook_url IS NULL OR webhook_url = '' THEN
    RETURN NEW;
  END IF;

  cheat_count := COALESCE(jsonb_array_length(NEW."cheatAttempts"), 0);

  payload := jsonb_build_object(
    'embeds', jsonb_build_array(
      jsonb_build_object(
        'title', 'New Application: ' || NEW."quizTitle",
        'color', 3447003, -- Blue
        'fields', jsonb_build_array(
          -- FIX: Replaced string concatenation with format() to avoid potential linter issues with backticks.
          -- FIX: Reverting to string concatenation as the linter has issues with format() specifiers.
          jsonb_build_object('name', 'Applicant', 'value', NEW.username || ' (`' || NEW.user_id || '`)', 'inline', true),
          jsonb_build_object('name', 'Highest Role', 'value', COALESCE(NEW.user_highest_role, 'Member'), 'inline', true),
          jsonb_build_object('name', 'Cheat Attempts', 'value', cheat_count, 'inline', true)
        ),
        'timestamp', NEW.submitted_at,
        'footer', jsonb_build_object('text', (SELECT "COMMUNITY_NAME" FROM public.config WHERE id = 1))
      )
    )
  );
  PERFORM http_post(webhook_url, payload, 'application/json', '{}'::jsonb);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_submission_insert ON public.submissions;
CREATE TRIGGER on_submission_insert
AFTER INSERT ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_submission();


-- Audit Log Webhook
CREATE OR REPLACE FUNCTION public.notify_new_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  webhook_url TEXT;
  payload JSONB;
BEGIN
  SELECT "AUDIT_LOG_WEBHOOK_URL" INTO webhook_url FROM public.config WHERE id = 1;

  IF webhook_url IS NULL OR webhook_url = '' THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'embeds', jsonb_build_array(
      jsonb_build_object(
        'title', 'Admin Action Logged',
        'color', 9807270, -- Gray
        'fields', jsonb_build_array(
          -- FIX: Replaced string concatenation with format() to avoid potential linter issues with backticks.
          -- FIX: Reverting to string concatenation as the linter has issues with format() specifiers.
          jsonb_build_object('name', 'Admin', 'value', NEW.admin_username || ' (`' || NEW.admin_id || '`)', 'inline', false),
          jsonb_build_object('name', 'Action', 'value', NEW.action, 'inline', false)
        ),
        'timestamp', NEW.timestamp
      )
    )
  );
  
  PERFORM http_post(webhook_url, payload, 'application/json', '{}'::jsonb);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_audit_log_insert ON public.audit_logs;
CREATE TRIGGER on_audit_log_insert
AFTER INSERT ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_audit_log();


-- Submission DM Notifier (for users)
CREATE OR REPLACE FUNCTION public.notify_user_on_submission_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  payload JSONB;
  event_type TEXT;
BEGIN
  -- Determine the event type
  IF TG_OP = 'INSERT' THEN
    event_type := 'SUBMISSION_RECEIVED';
    payload := jsonb_build_object(
        'type', event_type,
        'payload', jsonb_build_object(
            'userId', NEW.user_id,
            'username', NEW.username,
            'quizTitle', NEW."quizTitle"
        )
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    IF NEW.status = 'taken' THEN
      event_type := 'SUBMISSION_TAKEN';
    ELSIF NEW.status = 'accepted' THEN
      event_type := 'SUBMISSION_ACCEPTED';
    ELSIF NEW.status = 'refused' THEN
      event_type := 'SUBMISSION_REFUSED';
    ELSE
      RETURN NEW; -- Not a status change we care about
    END IF;

    payload := jsonb_build_object(
        'type', event_type,
        'payload', jsonb_build_object(
            'userId', NEW.user_id,
            'username', NEW.username,
            'quizTitle', NEW."quizTitle",
            'status', NEW.status,
            'adminUsername', NEW."adminUsername"
        )
    );
  ELSE
    RETURN NEW; -- No relevant change
  END IF;
  
  -- Invoke the Edge Function, ignoring the result.
  PERFORM supabase_functions.invoke_edge_function('discord-bot-interactions', payload);

  RETURN NEW;
END;
$$;

-- New trigger for DMs
DROP TRIGGER IF EXISTS on_submission_change_notify_user ON public.submissions;
CREATE TRIGGER on_submission_change_notify_user
AFTER INSERT OR UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.notify_user_on_submission_change();

`;