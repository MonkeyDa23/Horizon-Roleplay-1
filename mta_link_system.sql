-- =================================================================
-- MTA:SA Account Linking System Schema
-- =================================================================

-- 1. Table to store temporary link codes
CREATE TABLE IF NOT EXISTS public.mta_link_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial VARCHAR(50) NOT NULL,
    code VARCHAR(20) NOT NULL,
    discord_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    linked BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add MTA-related columns to profiles if they don't exist
-- We use a DO block to safely add columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'mta_serial') THEN
        ALTER TABLE public.profiles ADD COLUMN mta_serial VARCHAR(50) UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'mta_name') THEN
        ALTER TABLE public.profiles ADD COLUMN mta_name VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'mta_linked_at') THEN
        ALTER TABLE public.profiles ADD COLUMN mta_linked_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 3. Enable RLS on link codes
ALTER TABLE public.mta_link_codes ENABLE ROW LEVEL SECURITY;

-- 4. Policies for link codes
CREATE POLICY "Users can view their own link codes" 
    ON public.mta_link_codes FOR SELECT 
    USING (auth.uid() = discord_id);

CREATE POLICY "Users can insert their own link codes" 
    ON public.mta_link_codes FOR INSERT 
    WITH CHECK (auth.uid() = discord_id);

-- 5. Function to handle the linking process
CREATE OR REPLACE FUNCTION public.link_mta_account(p_code TEXT, p_discord_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_serial VARCHAR(50);
    v_link_id UUID;
BEGIN
    -- Find a valid, non-expired, non-linked code
    SELECT serial, id INTO v_serial, v_link_id
    FROM public.mta_link_codes
    WHERE code = p_code 
      AND linked = FALSE 
      AND expires_at > NOW()
    LIMIT 1;

    IF v_serial IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Invalid or expired code');
    END IF;

    -- Update the profile
    UPDATE public.profiles
    SET mta_serial = v_serial,
        mta_linked_at = NOW()
    WHERE id = p_discord_id;

    -- Mark the code as linked
    UPDATE public.mta_link_codes
    SET linked = TRUE,
        discord_id = p_discord_id
    WHERE id = v_link_id;

    RETURN jsonb_build_object('ok', true, 'serial', v_serial);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant permissions
GRANT ALL ON public.mta_link_codes TO authenticated;
GRANT ALL ON public.mta_link_codes TO anon;
GRANT EXECUTE ON FUNCTION public.link_mta_account(TEXT, UUID) TO authenticated;
