/*
--------------------------------------------------------------------------------
DATABASE SCHEMA & REQUIRED SQL
--------------------------------------------------------------------------------
This file is for TypeScript type generation. To set up your database, run the
SQL commands below in your Supabase SQL Editor.
--------------------------------------------------------------------------------

-- Enable the http extension if you need to make external requests from database functions
-- create extension if not exists http;

--------------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- Stores public user data and permissions.
--------------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean DEFAULT false NOT NULL,
  is_super_admin boolean DEFAULT false NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- RLS Policy: Allow users to read their own profile.
CREATE POLICY "Allow individual read access" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- RLS Policy: Allow admins to read all profiles (example).
-- You might want to restrict this further.
CREATE POLICY "Allow admin read access" ON public.profiles
  FOR SELECT USING (
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- Function to create a profile when a new user signs up.
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

-- Trigger to call the function on new user creation.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

--------------------------------------------------------------------------------
-- 2. CONFIG TABLE
-- Stores dynamic, public-facing configuration for the website.
--------------------------------------------------------------------------------
CREATE TABLE public.config (
    id bigint PRIMARY KEY DEFAULT 1,
    COMMUNITY_NAME text,
    LOGO_URL text,
    DISCORD_INVITE_URL text,
    MTA_SERVER_URL text,
    BACKGROUND_IMAGE_URL text,
    SHOW_HEALTH_CHECK boolean DEFAULT false,
    SUPER_ADMIN_ROLE_IDS text[],
    CONSTRAINT single_row_constraint CHECK (id = 1)
);

-- RLS Policy: Allow everyone to read the configuration.
CREATE POLICY "Allow public read access" ON public.config
  FOR SELECT USING (true);

-- RLS Policy: Only allow super admins to update the configuration.
CREATE POLICY "Allow super admin update access" ON public.config
  FOR UPDATE USING (
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );
-- Enable RLS on the config table
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

-- Insert a default row so it can be updated.
INSERT INTO public.config (id, COMMUNITY_NAME) VALUES (1, 'My Community')
ON CONFLICT (id) DO NOTHING;

--------------------------------------------------------------------------------
-- 3. SUBMISSIONS & QUIZZES FUNCTIONS & RLS
-- Add RLS and helper functions for better security and data management.
--------------------------------------------------------------------------------

-- Enable RLS on all tables that need protection.
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Allow public read for quizzes.
CREATE POLICY "Allow public read access" ON public.quizzes FOR SELECT USING (true);
-- Allow only super admins to modify quizzes.
CREATE POLICY "Allow super admin full access" ON public.quizzes FOR ALL USING (
  (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- Allow users to read their own submissions.
CREATE POLICY "Allow individual read access" ON public.submissions FOR SELECT USING (auth.uid() = user_id);
-- Allow admins to read all submissions.
CREATE POLICY "Allow admin read access" ON public.submissions FOR SELECT USING (
  (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- Function to update submission status and log the admin action.
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
    admin_id = current_admin_id,
    admin_username = current_admin_username
  WHERE id = p_submission_id;
END;
$$;

*/

export interface Database {
    // Schema definition will be auto-generated by Supabase CLI based on the SQL above
    // This is a placeholder for development.
}
