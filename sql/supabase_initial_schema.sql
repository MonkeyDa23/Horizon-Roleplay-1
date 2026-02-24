-- ====================================================================
-- SUPABASE DATABASE SETUP FOR WEBSITE
-- ====================================================================
-- Execute these commands in your Supabase project's SQL Editor.
-- This will create the 'profiles' table to store user data synced from Discord.

-- 1. Create the 'profiles' table.
-- This table will store public user information.
-- It is linked to the main 'auth.users' table via the user's ID.

CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_id TEXT UNIQUE,
  username TEXT,
  avatar_url TEXT,
  roles JSONB,
  highest_role JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Set up Row Level Security (RLS) for the 'profiles' table.
-- This is crucial for security in Supabase.

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to view their own profile.
CREATE POLICY "Users can view their own profile." ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy: Allow users to insert their own profile upon signup.
CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy: Allow users to update their own profile.
CREATE POLICY "Users can update their own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 3. Create a trigger to automatically update the 'updated_at' timestamp.

CREATE OR REPLACE FUNCTION public.handle_updated_at() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- ====================================================================
-- NOTES:
-- ====================================================================
-- - The 'id' column in 'profiles' is a foreign key that points to the 'id' in Supabase's built-in 'auth.users' table.
--   This ensures data integrity.
-- - RLS policies ensure that a user can only access and modify their own profile data.
-- ====================================================================
