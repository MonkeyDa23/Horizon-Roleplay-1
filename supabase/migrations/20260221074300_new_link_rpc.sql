CREATE OR REPLACE FUNCTION public.link_mta_account_with_temp_code(p_code text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    link_record RECORD;
    account_record RECORD;
    mta_db_user TEXT;
    mta_db_pass TEXT;
    mta_db_host TEXT;
    mta_db_port TEXT;
    mta_db_name TEXT;
    conn_str TEXT;
BEGIN
    -- Find the link code record
    SELECT * INTO link_record FROM public.mta_link_codes WHERE link_code = p_code;

    -- If no record is found, return error
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'الكود غير صحيح أو قد تم استخدامه بالفعل.');
    END IF;

    -- Check if the code has expired
    IF link_record.expires_at < now() THEN
        -- Delete the expired code
        DELETE FROM public.mta_link_codes WHERE id = link_record.id;
        RETURN json_build_object('success', false, 'message', 'هذا الكود منتهي الصلاحية. الرجاء طلب كود جديد من اللعبة.');
    END IF;

    -- The code is valid, now fetch MTA account details from the game DB
    -- This requires the mysql_fdw extension and a foreign server setup
    -- First, get connection details from Vault
    mta_db_user := vault.decrypted_secret('mta_db_user');
    mta_db_pass := vault.decrypted_secret('mta_db_password');
    mta_db_host := vault.decrypted_secret('mta_db_host');
    mta_db_port := vault.decrypted_secret('mta_db_port');
    mta_db_name := vault.decrypted_secret('mta_db_name');

    -- Construct the connection string
    conn_str := 'host=' || mta_db_host || ' port=' || mta_db_port || ' dbname=' || mta_db_name;

    -- Use dblink to query the MTA database
    SELECT id, username INTO account_record
    FROM dblink(conn_str, 'SELECT id, username FROM accounts WHERE serial = ' || quote_literal(link_record.user_serial))
    AS t(id int, username text);

    -- If no account found in MTA DB for that serial, it's an issue
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'لم يتم العثور على حساب MTA مرتبط بهذا السيريال.');
    END IF;

    -- Update the user's profile with MTA details
    UPDATE public.profiles
    SET 
        mta_serial = link_record.user_serial,
        mta_id = account_record.id,
        mta_name = account_record.username,
        is_mta_linked = true,
        mta_linked_at = now()
    WHERE id = p_user_id;

    -- Delete the used link code
    DELETE FROM public.mta_link_codes WHERE id = link_record.id;

    RETURN json_build_object('success', true, 'message', 'تم ربط حسابك بنجاح!');

EXCEPTION
    WHEN others THEN
        RETURN json_build_object('success', false, 'message', 'حدث خطأ غير متوقع في الخادم.');
END;
$function$;
