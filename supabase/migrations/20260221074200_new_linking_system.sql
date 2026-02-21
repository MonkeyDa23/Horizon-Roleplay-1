-- Create the table to store temporary MTA link codes
CREATE TABLE IF NOT EXISTS public.mta_link_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_serial text NOT NULL,
  link_code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT mta_link_codes_pkey PRIMARY KEY (id),
  CONSTRAINT mta_link_codes_link_code_key UNIQUE (link_code)
);

-- Add RLS to the new table
ALTER TABLE public.mta_link_codes ENABLE ROW LEVEL SECURITY;

-- Allow public read-only access for checking codes
-- and service_role access for creation/deletion
DROP POLICY IF EXISTS "Allow public read-only access" ON public.mta_link_codes;
CREATE POLICY "Allow public read-only access" ON public.mta_link_codes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service_role to manage codes" ON public.mta_link_codes;
CREATE POLICY "Allow service_role to manage codes" ON public.mta_link_codes
  FOR ALL USING (auth.role() = 'service_role');


-- Add new columns to the profiles table if they don't exist
-- This ensures we don't break anything if run multiple times

DO $$
BEGIN
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='profiles' AND column_name='mta_id') THEN
    ALTER TABLE public.profiles ADD COLUMN mta_id integer;
  END IF;
  IF NOT EXISTS(SELECT * FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_mta_linked') THEN
    ALTER TABLE public.profiles ADD COLUMN is_mta_linked boolean DEFAULT false;
  END IF;
END $$;

-- Add a comment to explain the purpose of the new columns
COMMENT ON COLUMN public.profiles.mta_id IS 'Stores the linked MTA account ID from the game server database.';
COMMENT ON COLUMN public.profiles.is_mta_linked IS 'Indicates if the user has successfully linked their MTA account.';
