
-- =================================================================
-- MTA:SA Link System - Server Side Logic (Edge Function Simulation)
-- =================================================================

-- This function is called by the MTA server to generate a code
CREATE OR REPLACE FUNCTION public.generate_mta_link_code(p_serial TEXT, p_secret_key TEXT)
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
    v_secret TEXT := 'YOUR_SUPER_SECRET_KEY_HERE'; -- Change this!
BEGIN
    -- Basic security check
    IF p_secret_key != v_secret THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Generate a random code: VXL-XXXXX-XXXX
    v_code := 'VXL-' || 
              upper(substring(md5(random()::text), 1, 5)) || '-' || 
              upper(substring(md5(random()::text), 6, 4));

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

-- Add unique constraint on serial for the ON CONFLICT to work
ALTER TABLE public.mta_link_codes ADD CONSTRAINT mta_link_codes_serial_key UNIQUE (serial);
