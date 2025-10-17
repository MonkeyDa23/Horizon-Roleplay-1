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

-- Helper function to check admin status without recursion
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
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- New RPC for updating user permissions by Super Admins
CREATE OR REPLACE FUNCTION public.update_user_permissions(target_user_id uuid, p_is_admin boolean, p_is_super_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_admin_id uuid := auth.uid();
  current_admin_username text;
  target_user_username text;
BEGIN
  -- Ensure the current user is a super admin
  IF NOT (SELECT is_super_admin FROM public.profiles WHERE id = current_admin_id) THEN
    RAISE EXCEPTION 'Only super admins can change permissions.';
  END IF;

  -- Prevent a super admin from removing their own super admin status
  IF current_admin_id = target_user_id AND p_is_super_admin = false THEN
      RAISE EXCEPTION 'Super admins cannot revoke their own super admin status.';
  END IF;

  -- Update the target profile
  UPDATE public.profiles
  SET
    is_admin = p_is_admin,
    is_super_admin = p_is_super_admin
  WHERE id = target_user_id;

  -- Create audit log entry
  SELECT raw_user_meta_data->>'full_name' INTO current_admin_username
  FROM auth.users WHERE id = current_admin_id;

  SELECT raw_user_meta_data->>'full_name' INTO target_user_username
  FROM auth.users WHERE id = target_user_id;

  INSERT INTO public.audit_logs(admin_id, admin_username, action)
  VALUES (
    current_admin_id,
    current_admin_username,
    'Updated permissions for "' || target_user_username || '" (' || target_user_id || ') to: Admin=' || p_is_admin || ', SuperAdmin=' || p_is_super_admin
  );
END;
$$;


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

ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.config;
CREATE POLICY "Allow public read access" ON public.config
  FOR SELECT USING (true);
  
DROP POLICY IF EXISTS "Allow super admin update access" ON public.config;
CREATE POLICY "Allow super admin update access" ON public.config
  FOR UPDATE USING (
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- Insert a default config row if it doesn't exist, and update with new branding
INSERT INTO public.config (id, "COMMUNITY_NAME", "LOGO_URL")
VALUES (1, 'Vixel Roleplay', 'https://i.ibb.co/L86D58p/vixel-logo.png')
ON CONFLICT (id) DO UPDATE SET
  "COMMUNITY_NAME" = EXCLUDED."COMMUNITY_NAME",
  "LOGO_URL" = EXCLUDED."LOGO_URL";


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
  "submittedAt" timestamp with time zone DEFAULT now(),
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
  id text PRIMARY KEY,
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
  id text PRIMARY KEY,
  "titleKey" text NOT NULL,
  "order" int
);

CREATE TABLE IF NOT EXISTS public.rules (
  id text PRIMARY KEY,
  category_id text REFERENCES public.rule_categories(id) ON DELETE CASCADE,
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
--  8. TRANSLATIONS (FOR CMS)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.translations (
  key text PRIMARY KEY,
  en text,
  ar text,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.translations;
CREATE POLICY "Allow public read access" ON public.translations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow super admin update access" ON public.translations;
CREATE POLICY "Allow super admin update access" ON public.translations FOR UPDATE USING (
  (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- Function for super admins to bulk-update translations
CREATE OR REPLACE FUNCTION public.update_translations(translations_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_admin_id uuid := auth.uid();
  translation_record jsonb;
BEGIN
  -- Ensure the user is a super admin
  IF NOT (SELECT is_super_admin FROM public.profiles WHERE id = current_admin_id) THEN
    RAISE EXCEPTION 'Only super admins can update translations.';
  END IF;

  -- Loop through the JSON array and upsert each translation
  FOR translation_record IN SELECT * FROM jsonb_array_elements(translations_data)
  LOOP
    INSERT INTO public.translations (key, en, ar, updated_at)
    VALUES (
      translation_record->>'key',
      translation_record->>'en',
      translation_record->>'ar',
      now()
    )
    ON CONFLICT (key) DO UPDATE
    SET
      en = EXCLUDED.en,
      ar = EXCLUDED.ar,
      updated_at = EXCLUDED.updated_at;
  END LOOP;
  
  -- Create a single audit log for the bulk operation
  INSERT INTO public.audit_logs(admin_id, admin_username, action)
  SELECT
    current_admin_id,
    raw_user_meta_data->>'full_name',
    'Updated ' || jsonb_array_length(translations_data) || ' translation(s).'
  FROM auth.users WHERE id = current_admin_id;

END;
$$;

-- =============================================================================
--  9. DISCORD WEBHOOK & DM TRIGGERS
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
    RETURN new;
  END IF;

  cheat_count := COALESCE(jsonb_array_length(new."cheatAttempts"), 0);

  payload := jsonb_build_object(
    'embeds', jsonb_build_array(
      jsonb_build_object(
        'title', 'New Application: ' || new."quizTitle",
        'color', 3447003, -- Blue
        'fields', jsonb_build_array(
          jsonb_build_object('name', 'Applicant', 'value', new.username || ' (\`' || new.user_id || '\`)', 'inline', true),
          jsonb_build_object('name', 'Highest Role', 'value', COALESCE(new.user_highest_role, 'Member'), 'inline', true),
          jsonb_build_object('name', 'Cheat Attempts', 'value', cheat_count::text, 'inline', true)
        ),
        'timestamp', new."submittedAt",
        'footer', jsonb_build_object('text', (SELECT "COMMUNITY_NAME" FROM public.config WHERE id = 1))
      )
    )
  );
  
  PERFORM extensions.http_post(webhook_url, payload, '{"Content-Type": "application/json"}'::jsonb);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_submission_insert ON public.submissions;
CREATE TRIGGER on_submission_insert
AFTER INSERT ON public.submissions
FOR EACH ROW
EXECUTE PROCEDURE public.notify_new_submission();


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
    RETURN new;
  END IF;

  payload := jsonb_build_object(
    'embeds', jsonb_build_array(
      jsonb_build_object(
        'title', 'Admin Action Logged',
        'color', 9807270, -- Gray
        'fields', jsonb_build_array(
          jsonb_build_object('name', 'Admin', 'value', new.admin_username || ' (\`' || new.admin_id || '\`)', 'inline', false),
          jsonb_build_object('name', 'Action', 'value', new.action, 'inline', false)
        ),
        'timestamp', new.timestamp
      )
    )
  );
  
  PERFORM extensions.http_post(webhook_url, payload, '{"Content-Type": "application/json"}'::jsonb);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_audit_log_insert ON public.audit_logs;
CREATE TRIGGER on_audit_log_insert
AFTER INSERT ON public.audit_logs
FOR EACH ROW
EXECUTE PROCEDURE public.notify_new_audit_log();


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
            'userId', new.user_id,
            'username', new.username,
            'quizTitle', new."quizTitle"
        )
    );
  ELSIF TG_OP = 'UPDATE' AND new.status <> old.status THEN
    IF new.status = 'taken' THEN
      event_type := 'SUBMISSION_TAKEN';
    ELSIF new.status = 'accepted' THEN
      event_type := 'SUBMISSION_ACCEPTED';
    ELSIF new.status = 'refused' THEN
      event_type := 'SUBMISSION_REFUSED';
    ELSE
      RETURN new; -- Not a status change we care about
    END IF;

    payload := jsonb_build_object(
        'type', event_type,
        'payload', jsonb_build_object(
            'userId', new.user_id,
            'username', new.username,
            'quizTitle', new."quizTitle",
            'status', new.status,
            'adminUsername', new."adminUsername"
        )
    );
  ELSE
    RETURN new; -- No relevant change
  END IF;
  
  -- Invoke the Edge Function, ignoring the result.
  PERFORM supabase_functions.invoke_edge_function('discord-bot-interactions', payload);

  RETURN new;
END;
$$;

-- New trigger for DMs
DROP TRIGGER IF EXISTS on_submission_change_notify_user ON public.submissions;
CREATE TRIGGER on_submission_change_notify_user
AFTER INSERT OR UPDATE ON public.submissions
FOR EACH ROW
EXECUTE PROCEDURE public.notify_user_on_submission_change();

-- =============================================================================
--  10. INITIAL DATA SEEDING
-- =============================================================================
-- This will populate the new 'translations' table with the default text.
-- It's safe to run multiple times due to 'ON CONFLICT'.
INSERT INTO public.translations (key, ar, en) VALUES
  ('home', 'الرئيسية', 'Home'),
  ('store', 'المتجر', 'Store'),
  ('rules', 'القوانين', 'Rules'),
  ('applies', 'التقديمات', 'Applies'),
  ('about_us', 'من نحن', 'About Us'),
  ('login_discord', 'تسجيل الدخول', 'Login with Discord'),
  ('logout', 'تسجيل الخروج', 'Logout'),
  ('welcome', 'أهلاً', 'Welcome'),
  ('admin_panel', 'لوحة التحكم', 'Admin Panel'),
  ('my_applications', 'تقديماتي', 'My Applications'),
  ('my_profile', 'ملفي الشخصي', 'My Profile'),
  ('hero_title', 'مجتمع هورايزن للعب الأدوار', 'Horizon Roleplay Community'),
  ('hero_subtitle', 'حيث تبدأ قصتك. انضم إلى عالم غامر من الاحتمالات اللانهائية.', 'Where your story begins. Join an immersive world of endless possibilities.'),
  ('join_us', 'انضم إلينا', 'Join Us'),
  ('join_modal_title', 'انضم إلى مجتمعنا', 'Join Our Community'),
  ('join_discord', 'انضم لسيرفر الديسكورد', 'Join Discord Server'),
  ('connect_mta', 'اتصل بسيرفر MTA', 'Connect to MTA Server'),
  ('page_title_store', 'متجر {communityName}', '{communityName} Store'),
  ('page_title_rules', 'قوانين السيرفر', 'Server Rules'),
  ('page_title_applies', 'التقديمات المتاحة', 'Available Applications'),
  ('page_title_about', 'عن {communityName}', 'About {communityName}'),
  ('page_title_admin', 'لوحة تحكم المشرفين', 'Admin Control Panel'),
  ('page_title_my_applications', 'حالة تقديماتي', 'My Applications Status'),
  ('coming_soon', 'قريباً...', 'Coming Soon...'),
  ('questions', 'أسئلة', 'Questions'),
  ('about_intro', '{communityName} هو أكثر من مجرد سيرفر - إنه مجتمع نابض بالحياة من اللاعبين الذين يتشاركون شغف اللعب الأدوار.', '{communityName} is more than just a server - it is a vibrant community of players who share a passion for roleplaying.'),
  ('our_mission', 'مهمتنا', 'Our Mission'),
  ('mission_text', 'مهمتنا هي توفير بيئة لعب أدوار غامرة وعالية الجودة حيث يمكن للاعبين إنشاء قصصهم وشخصياتهم الفريدة.', 'Our mission is to provide an immersive, high-quality roleplaying environment where players can create their own unique stories and characters.'),
  ('join_community', 'انضم لمجتمعنا على ديسكورد', 'Join Our Discord Community'),
  ('discord_online', 'متصل', 'Online'),
  ('discord_members', 'عضو', 'Members'),
  ('footer_rights', '© {year} {communityName}. جميع الحقوق محفوظة.', '© {year} {communityName}. All Rights Reserved.'),
  ('add_to_cart', 'أضف للسلة', 'Add to Cart'),
  ('item_added_to_cart', 'تمت إضافة {itemName} إلى السلة!', '{itemName} added to cart!'),
  ('your_cart', 'سلة التسوق', 'Your Cart'),
  ('empty_cart', 'سلتك فارغة.', 'Your cart is empty.'),
  ('subtotal', 'المجموع الفرعي', 'Subtotal'),
  ('checkout', 'الدفع', 'Checkout'),
  ('remove', 'إزالة', 'Remove'),
  ('checkout_via_discord', 'الدفع عبر ديسكورد', 'Checkout via Discord'),
  ('checkout_instructions', 'لإكمال عملية الشراء، يرجى فتح تذكرة في سيرفر الديسكورد الخاص بنا وسيقوم أحد المسؤولين بمساعدتك.', 'To complete your purchase, please open a ticket in our Discord server and an admin will assist you.'),
  ('open_ticket', 'فتح تذكرة', 'Open a Ticket'),
  ('apply_now', 'قدم الآن', 'Apply Now'),
  ('already_applied', 'تم التقديم', 'Already Applied'),
  ('application_closed', 'التقديم مغلق', 'Application Closed'),
  ('no_applies_open', 'لا يوجد تقديمات مفتوحة حالياً.', 'No applications are open at this time.'),
  ('no_rules_yet', 'سيتم إضافة القوانين قريباً.', 'Rules will be added soon.'),
  ('quiz_rules', 'تعليمات التقديم', 'Application Instructions'),
  ('begin_quiz', 'ابدأ الاختبار', 'Begin Quiz'),
  ('question', 'سؤال', 'Question'),
  ('of', 'من', 'of'),
  ('time_left', 'الوقت المتبقي', 'Time Left'),
  ('seconds', 'ثانية', 'seconds'),
  ('next_question', 'السؤال التالي', 'Next Question'),
  ('submit_application', 'إرسال التقديم', 'Submit Application'),
  ('application_submitted', 'تم إرسال تقديمك بنجاح!', 'Your application has been submitted successfully!'),
  ('application_submitted_desc', 'ستتم مراجعته من قبل الإدارة قريباً. يمكنك متابعة حالته من صفحة "تقديماتي".', 'It will be reviewed by the administration soon. You can track its status on the "My Applications" page.'),
  ('view_my_applications', 'عرض تقديماتي', 'View My Applications'),
  ('cheat_attempt_detected', 'تم كشف محاولة غش! تم إعادة تعيين التقديم.', 'Cheat attempt detected! Application has been reset.'),
  ('cheat_method_switched_tab', 'تبديل التبويبات', 'Switched Tabs'),
  ('cheat_method_lost_focus', 'فقدان التركيز', 'Lost Focus'),
  ('cheat_attempts_report', 'تقرير محاولات الغش', 'Cheat Attempts Report'),
  ('cheat_attempts_count', 'تم تسجيل {count} محاولة/محاولات.', '{count} attempt(s) were logged.'),
  ('no_cheat_attempts', 'لم يتم تسجيل أي محاولات غش. عمل رائع!', 'No cheat attempts logged. Great job!'),
  ('quiz_management', 'إدارة نماذج التقديم', 'Quiz Forms Management'),
  ('submission_management', 'إدارة طلبات التقديم', 'Application Submissions'),
  ('rules_management', 'إدارة القوانين', 'Rules Management'),
  ('store_management', 'إدارة المتجر', 'Store Management'),
  ('appearance_settings', 'إعدادات المظهر', 'Appearance Settings'),
  ('translations_management', 'إدارة الترجمات', 'Translations Management'),
  ('audit_log', 'سجل التدقيق', 'Audit Log'),
  ('user_lookup', 'بحث عن مستخدم', 'User Lookup'),
  ('create_new_quiz', 'إنشاء تقديم جديد', 'Create New Quiz'),
  ('edit_quiz', 'تعديل التقديم', 'Edit Quiz'),
  ('quiz_title', 'عنوان التقديم (مفتاح الترجمة)', 'Quiz Title (Translation Key)'),
  ('quiz_description', 'وصف التقديم (مفتاح الترجمة)', 'Quiz Description (Translation Key)'),
  ('quiz_questions', 'أسئلة التقديم', 'Quiz Questions'),
  ('add_question', 'إضافة سؤال', 'Add Question'),
  ('question_text', 'نص السؤال (مفتاح الترجمة)', 'Question Text (Translation Key)'),
  ('time_limit_seconds', 'الوقت المحدد (بالثواني)', 'Time Limit (seconds)'),
  ('save_quiz', 'حفظ التقديم', 'Save Quiz'),
  ('save_rules', 'حفظ القوانين', 'Save Rules'),
  ('save_settings', 'حفظ الإعدادات', 'Save Settings'),
  ('save_translations', 'حفظ الترجمات', 'Save Translations'),
  ('delete_quiz', 'حذف التقديم', 'Delete Quiz'),
  ('status', 'الحالة', 'Status'),
  ('open', 'مفتوح', 'Open'),
  ('closed', 'مغلق', 'Closed'),
  ('actions', 'الإجراءات', 'Actions'),
  ('edit', 'تعديل', 'Edit'),
  ('applicant', 'المتقدم', 'Applicant'),
  ('submitted_on', 'تاريخ التقديم', 'Submitted On'),
  ('result_date', 'تاريخ النتيجة', 'Result Date'),
  ('view_submission', 'عرض الطلب', 'View Submission'),
  ('take_order', 'استلام الطلب', 'Take Order'),
  ('take_order_forbidden', 'غير مسموح', 'Not Allowed'),
  ('taken_by', 'مستلم بواسطة', 'Taken by'),
  ('accept', 'قبول', 'Accept'),
  ('refuse', 'رفض', 'Refuse'),
  ('submission_details', 'تفاصيل الطلب', 'Submission Details'),
  ('close', 'إغلاق', 'Close'),
  ('no_pending_submissions', 'لا توجد طلبات تقديم معلقة حالياً.', 'There are no pending submissions.'),
  ('log_timestamp', 'الوقت', 'Timestamp'),
  ('log_admin', 'المشرف', 'Admin'),
  ('log_action', 'الإجراء', 'Action'),
  ('no_logs_found', 'لا توجد سجلات.', 'No logs found.'),
  ('rules_updated_success', 'تم تحديث القوانين بنجاح!', 'Rules updated successfully!'),
  ('config_updated_success', 'تم تحديث الإعدادات بنجاح!', 'Settings updated successfully!'),
  ('translations_updated_success', 'تم تحديث الترجمات بنجاح!', 'Translations updated successfully!'),
  ('admin_revoked', 'تم سحب صلاحيات الإدارة منك.', 'Your admin permissions have been revoked.'),
  ('admin_granted', 'تم منحك صلاحيات الإدارة!', 'You have been granted admin permissions!'),
  ('admin_permissions_error', 'خطأ في صلاحيات المشرف. تم تسجيل خروجك.', 'Admin permission error. You have been logged out.'),
  ('admin_session_error_warning', 'لا يمكن التحقق من صلاحياتك حاليًا. قد تكون بعض الميزات غير متاحة.', 'Could not verify your permissions right now. Some features may be unavailable.'),
  ('role_updated', 'تم تحديث رتبتك إلى {roleName}!', 'Your role has been updated to {roleName}!'),
  ('session_expired_not_in_guild', 'انتهت صلاحية الجلسة أو لم تعد عضواً في السيرفر.', 'Session expired or you are no longer a member of the guild.'),
  ('quiz_handler_roles', 'أرقام رتب المعالجين', 'Handler Role IDs'),
  ('quiz_handler_roles_desc', 'مفصولة بفاصلة. اتركها فارغة للسماح لجميع المشرفين.', 'Comma-separated. Leave empty to allow all admins.'),
  ('community_name', 'اسم المجتمع', 'Community Name'),
  ('logo_url', 'رابط الشعار', 'Logo URL'),
  ('background_image_url', 'رابط صورة الخلفية', 'Background Image URL'),
  ('background_image_url_desc', 'اتركه فارغًا لاستخدام الخلفية الافتراضية.', 'Leave blank to use the default background.'),
  ('discord_guild_id', 'معرف سيرفر ديسكورد', 'Discord Guild ID'),
  ('discord_guild_id_desc', 'المعرف الرقمي لسيرفرك لاستخراج الرتب.', 'The numerical ID of your server for fetching roles.'),
  ('super_admin_role_ids', 'أرقام رتب المشرفين الخارقين', 'Super Admin Role IDs'),
  ('super_admin_role_ids_desc', 'مفصولة بفاصلة. هؤلاء يمكنهم تغيير إعدادات الموقع.', 'Comma-separated. These can change site settings.'),
  ('handler_role_ids', 'أرقام رتب المعالجين', 'Handler Role IDs'),
  ('handler_role_ids_desc', 'مفصولة بفاصلة. هؤلاء يمكنهم رؤية جميع التقديمات.', 'Comma-separated. These can view all submissions.'),
  ('submissions_webhook_url', 'رابط ويبهوك التقديمات', 'Submissions Webhook URL'),
  ('submissions_webhook_url_desc', 'سيتم إرسال إشعار فوري عند تقديم طلب جديد.', 'Get instant notifications when a new application is submitted.'),
  ('audit_log_webhook_url', 'رابط ويبهوك السجلات', 'Audit Log Webhook URL'),
  ('audit_log_webhook_url_desc', 'سيتم إرسال جميع إجراءات المشرفين إلى هذه القناة.', 'All admin actions will be logged to this channel.'),
  ('show_health_check_page', 'عرض صفحة فحص الحالة', 'Show Health Check Page'),
  ('enter_discord_id', 'أدخل معرف ديسكورد...', 'Enter Discord ID...'),
  ('search', 'بحث', 'Search'),
  ('search_by_key', 'بحث بالمفتاح...', 'Search by key...'),
  ('key', 'المفتاح', 'Key'),
  ('arabic_translation', 'الترجمة العربية', 'Arabic Translation'),
  ('english_translation', 'الترجمة الإنجليزية', 'English Translation'),
  ('lookup_results_for', 'نتائج البحث عن', 'Lookup Results for'),
  ('application_history', 'سجل التقديمات', 'Application History'),
  ('no_submissions_found_for_user', 'لم يتم العثور على تقديمات لهذا المستخدم.', 'No submissions found for this user.'),
  ('no_user_found_or_no_data', 'المستخدم غير موجود أو ليس لديه بيانات.', 'User not found or has no data.'),
  ('mta_player_logs', 'سجلات لاعب MTA', 'MTA Player Logs'),
  ('loading_logs', 'جاري تحميل السجلات...', 'Loading logs...'),
  ('error_loading_logs', 'خطأ في تحميل السجلات.', 'Error loading logs.'),
  ('no_logs_found_for_player', 'لم يتم العثور على سجلات لهذا اللاعب.', 'No logs found for this player.'),
  ('user_information', 'معلومات المستخدم', 'User Information'),
  ('permissions', 'الصلاحيات', 'Permissions'),
  ('grant_admin_access', 'منح صلاحية مشرف', 'Grant Admin Access'),
  ('grant_super_admin_access', 'منح صلاحية مشرف خارق', 'Grant Super Admin Access'),
  ('confirm_permission_change_title', 'تأكيد تغيير الصلاحيات', 'Confirm Permission Change'),
  ('confirm_permission_change_desc', 'هل أنت متأكد أنك تريد تحديث صلاحيات هذا المستخدم؟ هذا الإجراء سيتم تسجيله.', 'Are you sure you want to update this user''s permissions? This action will be logged.'),
  ('update_permissions', 'تحديث الصلاحيات', 'Update Permissions'),
  ('permissions_updated', 'تم تحديث الصلاحيات بنجاح!', 'Permissions updated successfully!'),
  ('joined_discord', 'تاريخ الانضمام', 'Joined Discord'),
  ('save', 'حفظ', 'Save'),
  ('cancel', 'إلغاء', 'Cancel'),
  ('add_new_product', 'إضافة منتج جديد', 'Add New Product'),
  ('edit_product', 'تعديل المنتج', 'Edit Product'),
  ('delete_product', 'حذف المنتج', 'Delete Product'),
  ('product_name_key', 'اسم المنتج (مفتاح الترجمة)', 'Product Name (Translation Key)'),
  ('product_desc_key', 'وصف المنتج (مفتاح الترجمة)', 'Product Description (Translation Key)'),
  ('price', 'السعر', 'Price'),
  ('image_url', 'رابط الصورة', 'Image URL'),
  ('delete_product_confirm', 'هل أنت متأكد من حذف هذا المنتج؟', 'Are you sure you want to delete this product?'),
  ('add_category', 'إضافة فئة', 'Add Category'),
  ('add_rule', 'إضافة قانون', 'Add Rule'),
  ('category_title_key', 'عنوان الفئة (مفتاح الترجمة)', 'Category Title (Translation Key)'),
  ('rule_text_key', 'نص القانون (مفتاح الترجمة)', 'Rule Text (Translation Key)'),
  ('delete_category_confirm', 'هل أنت متأكد من حذف هذه الفئة وجميع قوانينها؟', 'Are you sure you want to delete this category and all its rules?'),
  ('quiz_logo_url', 'رابط شعار التقديم', 'Quiz Logo URL'),
  ('quiz_banner_url', 'رابط بانر التقديم', 'Quiz Banner URL'),
  ('quiz_logo_url_desc', 'اختياري. يظهر في قائمة التقديمات.', 'Optional. Appears in the application list.'),
  ('quiz_banner_url_desc', 'اختياري. يظهر في صفحة التعليمات.', 'Optional. Appears on the instructions page.'),
  ('status_pending', 'قيد الانتظار', 'Pending'),
  ('status_taken', 'قيد المراجعة', 'Under Review'),
  ('status_accepted', 'مقبول', 'Accepted'),
  ('status_refused', 'مرفوض', 'Refused'),
  ('no_applications_submitted', 'لم تقم بتقديم أي طلبات بعد.', 'You have not submitted any applications yet.'),
  ('application_type', 'نوع التقديم', 'Application Type'),
  ('discord_roles', 'رتب الديسكورد', 'Discord Roles'),
  ('view_on_discord', 'عرض في ديسكورد', 'View on Discord'),
  ('recent_applications', 'التقديمات الأخيرة', 'Recent Applications'),
  ('user_id', 'معرف المستخدم', 'User ID'),
  ('role', 'الرتبة', 'Role'),
  ('admin', 'مشرف', 'Admin'),
  ('member', 'عضو', 'Member'),
  ('community_announcements', 'إعلانات المجتمع', 'Community Announcements'),
  ('health_check_title', 'فحص حالة النظام', 'System Health Check'),
  ('health_check_desc', 'هذه الصفحة تساعد في تشخيص مشاكل الإعداد الأولية.', 'This page helps diagnose initial setup problems.'),
  ('health_check_step1', 'الخطوة 1: إعدادات Supabase OAuth', 'Step 1: Supabase OAuth Setup'),
  ('health_check_step1_desc', 'لتمكين تسجيل الدخول عبر ديسكورد، يجب عليك إضافة الرابط التالي إلى قائمة Redirect URLs في إعدادات مصادقة Supabase.', 'To enable Discord login, you must add the following URL to your Redirect URLs list in your Supabase Authentication settings.'),
  ('health_check_uri_label', 'رابط إعادة التوجيه الخاص بك', 'Your Redirect URI'),
  ('health_check_copy', 'نسخ', 'Copy'),
  ('health_check_copied', 'تم النسخ!', 'Copied!'),
  ('health_check_step2', 'الخطوة 2: إعدادات قاعدة البيانات', 'Step 2: Database Configuration'),
  ('health_check_step2_desc', 'يتم جلب هذه الإعدادات مباشرة من جدول `config` في قاعدة بياناتك.', 'These settings are fetched directly from your `config` table in the database.'),
  ('health_check_step3', 'الخطوة 3: تشخيص اتصال ديسكورد', 'Step 3: Discord Connection Diagnostics'),
  ('health_check_step3_desc', 'يستخدم هذا الاختبار بيانات اعتماد تسجيل دخولك الحالية للتحقق مما إذا كان الموقع يمكنه الاتصال بخادم ديسكورد الخاص بك بشكل صحيح. هذا هو السبب الأكثر شيوعًا لفشل تسجيل الدخول.', 'This test uses your current login credentials to check if the site can connect to your Discord server correctly. This is the most common reason for login failures.'),
  ('health_check_run_test', 'تشغيل الاختبار', 'Run Test'),
  ('health_check_login_to_test', 'يجب عليك تسجيل الدخول لتشغيل هذا الاختبار.', 'You must be logged in to run this test.'),
  ('health_check_test_running', 'جاري الاختبار...', 'Testing...'),
  ('health_check_test_result', 'نتيجة الاختبار', 'Test Result'),
  ('health_check_guild_id', 'معرف سيرفر ديسكورد', 'Discord Guild ID'),
  ('health_check_super_admin_roles', 'رتب المشرفين الخارقين', 'Super Admin Roles'),
  ('health_check_handler_roles', 'رتب المعالجين', 'Handler Roles'),
  ('health_check_not_set', 'لم يتم التعيين', 'Not Set'),
  ('health_check_env_vars', 'متغيرات البيئة', 'Environment Variables'),
  ('health_check_env_vars_desc', 'يتم تحميل هذه المتغيرات من ملف .env الخاص بك.', 'These are loaded from your .env file.'),
  ('health_check_supabase_connection', 'اتصال Supabase', 'Supabase Connection'),
  ('health_check_supabase_desc', 'يتحقق هذا من أن الموقع يمكنه الاتصال بقاعدة بيانات Supabase باستخدام مفاتيحك.', 'This checks that the site can connect to your Supabase database using your keys.'),
  ('health_check_db_status', 'DB Connection', 'DB Connection'),
  ('product_vip_bronze_name', 'عضوية VIP برونزية', 'Bronze VIP Membership'),
  ('product_vip_bronze_desc', 'مميزات حصرية داخل السيرفر لمدة شهر.', 'Exclusive in-server perks for one month.'),
  ('product_vip_silver_name', 'عضوية VIP فضية', 'Silver VIP Membership'),
  ('product_vip_silver_desc', 'مميزات أفضل مع وصول خاص للمركبات.', 'Better perks with special vehicle access.'),
  ('product_cash_1_name', 'حزمة نقدية 100 ألف', '100k Cash Pack'),
  ('product_cash_1_desc', 'دفعة نقدية داخل اللعبة لتبدأ بقوة.', 'An in-game cash boost to get you started.'),
  ('product_custom_plate_name', 'لوحة سيارة مخصصة', 'Custom License Plate'),
  ('product_custom_plate_desc', 'لوحة فريدة لسيارتك المفضلة.', 'A unique license plate for your favorite vehicle.'),
  ('quiz_police_name', 'تقديم قسم الشرطة', 'Police Department Application'),
  ('quiz_police_desc', 'اقرأ القوانين جيداً. أي محاولة غش ستؤدي للرفض الفوري.', 'Read the rules carefully. Any attempt to cheat will result in immediate rejection.'),
  ('q_police_1', 'ما هو الإجراء الأول عند التعامل مع شخص مشتبه به؟', 'What is the first procedure when dealing with a suspect?'),
  ('q_police_2', 'متى يسمح لك باستخدام القوة المميتة؟', 'When are you permitted to use lethal force?'),
  ('quiz_medic_name', 'تقديم قسم الإسعاف', 'EMS Department Application'),
  ('quiz_medic_desc', 'مطلوب منك الهدوء والاحترافية في جميع الأوقات.', 'You are required to be calm and professional at all times.'),
  ('q_medic_1', 'ما هي أولويتك القصوى عند الوصول إلى مكان الحادث؟', 'What is your top priority when arriving at an accident scene?')
ON CONFLICT (key) DO NOTHING;
`