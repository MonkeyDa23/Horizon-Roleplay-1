CREATE OR REPLACE FUNCTION public.generate_mta_link_code(p_serial text, p_secret_key text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    expected_secret_key TEXT;
    existing_code RECORD;
    new_code TEXT;
    expires_in_seconds BIGINT;
BEGIN
    -- Get the secret key from Vault
    expected_secret_key := vault.decrypted_secret('mta_link_secret');

    -- Check if the provided secret key is valid
    IF p_secret_key IS NULL OR p_secret_key != expected_secret_key THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Check if an unexpired code already exists for this serial
    SELECT * INTO existing_code FROM public.mta_link_codes 
    WHERE user_serial = p_serial AND expires_at > now();

    IF FOUND THEN
        -- If a code exists, return a cooldown message
        expires_in_seconds := EXTRACT(EPOCH FROM (existing_code.expires_at - now()));
        RETURN json_build_object(
            'success', false, 
            'message', 'لديك بالفعل كود فعال. يرجى الانتظار ' || floor(expires_in_seconds / 60) || ' دقيقة و ' || (expires_in_seconds % 60) || ' ثانية.'
        );
    END IF;

    -- Generate a new unique code
    LOOP
        new_code := 'FL-' || substr(md5(random()::text), 0, 6) || '-' || substr(md5(random()::text), 0, 6);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.mta_link_codes WHERE link_code = new_code);
    END LOOP;

    -- Insert the new code with a 5-minute expiration time
    INSERT INTO public.mta_link_codes (user_serial, link_code, expires_at)
    VALUES (p_serial, new_code, now() + interval '5 minutes');

    RETURN json_build_object('success', true, 'code', new_code);

END;
$function$;
