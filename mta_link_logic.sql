
-- =================================================================
-- MTA:SA Link System - Server Side Logic (Edge Function Simulation)
-- =================================================================

-- This function is called by the MTA server to generate a code
CREATE OR REPLACE FUNCTION public.generate_mta_link_code(p_serial TEXT, p_secret_key TEXT, p_custom_code TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
    v_secret TEXT := 'FL-RP_9x2#KzL8!vQp$mWn5&7Zt*Y2uBvR1_VXL'; 
BEGIN
    -- Basic security check
    IF p_secret_key != v_secret THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Use custom code if provided, else generate one
    IF p_custom_code IS NOT NULL THEN
        v_code := p_custom_code;
    ELSE
        -- Generate a random code: VXL-XXXXX-XXXX
        v_code := 'VXL-' || 
                  upper(substring(md5(random()::text), 1, 5)) || '-' || 
                  upper(substring(md5(random()::text), 6, 4));
    END IF;

    -- Insert or update the code for this serial
    INSERT INTO public.mta_link_codes (serial, code, expires_at)
    VALUES (p_serial, v_code, NOW() + INTERVAL '10 minutes')
    ON CONFLICT (serial) DO UPDATE 
    SET code = v_code, 
        expires_at = NOW() + INTERVAL '10 minutes',
        linked = FALSE;

    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add unique constraint on serial for the ON CONFLICT to work (Safe check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mta_link_codes_serial_key') THEN
        ALTER TABLE public.mta_link_codes ADD CONSTRAINT mta_link_codes_serial_key UNIQUE (serial);
    END IF;
END $$;

-- =================================================================
-- Profiles Table Setup (Ensure columns exist)
-- =================================================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ban_reason TEXT,
ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS balance BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS mta_serial TEXT,
ADD COLUMN IF NOT EXISTS mta_name TEXT,
ADD COLUMN IF NOT EXISTS mta_linked_at TIMESTAMP WITH TIME ZONE;

-- =================================================================
-- Link Account RPC
-- =================================================================
CREATE OR REPLACE FUNCTION public.link_mta_account(p_code TEXT, p_discord_id TEXT)
RETURNS JSON AS $$
DECLARE
    v_serial TEXT;
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_linked BOOLEAN;
BEGIN
    -- 1. Check if code exists and is valid
    SELECT serial, expires_at, linked INTO v_serial, v_expires_at, v_linked
    FROM public.mta_link_codes
    WHERE code = p_code;

    IF v_serial IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'الكود غير صحيح');
    END IF;

    IF v_expires_at < NOW() THEN
        RETURN json_build_object('success', false, 'message', 'انتهت صلاحية الكود');
    END IF;

    IF v_linked THEN
        RETURN json_build_object('success', false, 'message', 'هذا الكود تم استخدامه مسبقاً');
    END IF;

    -- 2. Update Profile
    UPDATE public.profiles
    SET mta_serial = v_serial,
        mta_linked_at = NOW()
    WHERE id = p_discord_id::uuid;

    -- 3. Mark code as linked
    UPDATE public.mta_link_codes
    SET linked = TRUE
    WHERE code = p_code;

    RETURN json_build_object('success', true, 'message', 'تم ربط الحساب بنجاح');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
