export const DATABASE_SCHEMA = `
-- #############################################################################
-- #                                                                           #
-- #                     HORIZON ROLEPLAY DATABASE SETUP                       #
-- #                                                                           #
-- #   Instructions:                                                           #
-- #   1. Go to your Supabase project dashboard.                               #
-- #   2. Navigate to the "SQL Editor".                                        #
-- #   3. Click "+ New query".                                                 #
-- #   4. Copy ALL of the code below and paste it into the editor.             #
-- #   5. Click "RUN".                                                         #
-- #                                                                           #
-- #############################################################################

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

-- Policies for profiles
DROP POLICY IF EXISTS "Allow individual read access" ON public.profiles;
CREATE POLICY "Allow individual read access" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow admin read access" ON public.profiles;
CREATE POLICY "Allow admin read access" ON public.profiles
  FOR SELECT USING (
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

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
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


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
    CONSTRAINT single_row_constraint CHECK (id = 1)
);

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
INSERT INTO public.config (id, "COMMUNITY_NAME", "DISCORD_GUILD_ID", "SHOW_HEALTH_CHECK", "SUPER_ADMIN_ROLE_IDS", "HANDLER_ROLE_IDS") 
VALUES (1, 'Horizon RP', 'YOUR_DISCORD_GUILD_ID_HERE', true, '{}', '{}')
ON CONFLICT (id) DO UPDATE SET
    "COMMUNITY_NAME" = COALESCE(public.config."COMMUNITY_NAME", 'Horizon RP'),
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

-- Helper function for admins to update submission status securely
CREATE OR REPLACE FUNCTION public.update_submission_status(p_submission_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_admin_id uuid := auth.uid();
  current_admin_username text;
BEGIN
  -- Ensure the user is an admin
  IF NOT (SELECT is_admin FROM public.profiles WHERE id = current_admin_id) THEN
    RAISE EXCEPTION 'User is not an admin';
  END IF;

  SELECT raw_user_meta_data->>'full_name' INTO current_admin_username
  FROM auth.users WHERE id = current_admin_id;

  UPDATE public.submissions
  SET
    status = p_status,
    "adminId" = current_admin_id,
    "adminUsername" = current_admin_username,
    "updatedAt" = now()
  WHERE id = p_submission_id;
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
`;