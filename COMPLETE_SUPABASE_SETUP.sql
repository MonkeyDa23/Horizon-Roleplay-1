-- ==========================================
-- COMPLETE SUPABASE DATABASE SETUP SCRIPT
-- ==========================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- TABLES
-- ==========================================

-- USERS TABLE (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar TEXT,
  discord_id TEXT,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  ban_expires_at TIMESTAMP WITH TIME ZONE,
  role TEXT DEFAULT 'user',
  mta_serial TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CONFIG TABLE
CREATE TABLE IF NOT EXISTS public.config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TRANSLATIONS TABLE
CREATE TABLE IF NOT EXISTS public.translations (
  key TEXT PRIMARY KEY,
  ar TEXT NOT NULL,
  en TEXT NOT NULL
);

-- CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0
);

-- PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  robux_price INTEGER,
  features JSONB DEFAULT '[]'::jsonb,
  is_subscription BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RULES TABLE
CREATE TABLE IF NOT EXISTS public.rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- QUIZ SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.quiz_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  quiz_id TEXT NOT NULL,
  quiz_title TEXT NOT NULL,
  discord_id TEXT,
  answers JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'accepted', 'rejected')),
  score INTEGER,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  review_reason TEXT
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) & HELPERS
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;

-- Users RLS
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON public.users FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Config RLS (Public Read)
CREATE POLICY "Public read config" ON public.config FOR SELECT USING (true);
CREATE POLICY "Admins manage config" ON public.config FOR ALL USING (public.is_admin());

-- Translations RLS (Public Read)
CREATE POLICY "Public read translations" ON public.translations FOR SELECT USING (true);
CREATE POLICY "Admins manage translations" ON public.translations FOR ALL USING (public.is_admin());

-- Categories & Products RLS
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL USING (public.is_admin());

CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins manage products" ON public.products FOR ALL USING (public.is_admin());

-- Rules RLS
CREATE POLICY "Public read rules" ON public.rules FOR SELECT USING (true);
CREATE POLICY "Admins manage rules" ON public.rules FOR ALL USING (public.is_admin());

-- Quiz Submissions RLS
CREATE POLICY "Users read own submissions" ON public.quiz_submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create submissions" ON public.quiz_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage submissions" ON public.quiz_submissions FOR ALL USING (public.is_admin());

-- ==========================================
-- FUNCTIONS & TRIGGERS
-- ==========================================

-- Trigger to sync auth.users to public.users on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, username, email, avatar, discord_id)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'custom_claims'->>'global_name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User'), 
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'sub'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RPC: Get Config
CREATE OR REPLACE FUNCTION public.get_config()
RETURNS TABLE(key text, value jsonb) AS $$
BEGIN
  RETURN QUERY SELECT c.key, c.value FROM public.config c;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get Products with Categories
CREATE OR REPLACE FUNCTION public.get_products_with_categories()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'icon', c.icon,
      'description', c.description,
      'products', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'title', p.title,
            'description', p.description,
            'price', p.price,
            'robux_price', p.robux_price,
            'features', p.features,
            'is_subscription', p.is_subscription
          ) ORDER BY p.sort_order
        )
        FROM public.products p
        WHERE p.category_id = c.id
      )
    ) ORDER BY c.sort_order
  ) INTO result
  FROM public.categories c;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- RPC: Update Submission Status
CREATE OR REPLACE FUNCTION public.update_submission_status(p_submission_id uuid, p_new_status text, p_reason text DEFAULT NULL)
RETURNS SETOF public.quiz_submissions AS $$
BEGIN
  RETURN QUERY
  UPDATE public.quiz_submissions
  SET status = p_new_status, review_reason = p_reason, reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = p_submission_id
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- INITIAL DATA (UPSERT)
-- ==========================================

-- 1. Initial Config
INSERT INTO public.config (key, value) VALUES
  ('branding', '{"siteName":"Nova Roleplay","primaryColor":"#00A9FF","logoUrl":"https://cdn.discordapp.com/attachments/1118169443210453114/1336496305609805954/image_28.png"}'),
  ('contact', '{"discordUrl":"https://discord.gg/nova","twitterUrl":"https://twitter.com/nova","youtubeUrl":"https://youtube.com/nova"}'),
  ('features', '{"storeEnabled":true,"applicationsEnabled":true,"linkingEnabled":true}'),
  ('home_features', '[{"icon":"Shield","title":"الحماية والأمان","description":"نظام حماية متطور لضمان تجربة لعب عادلة للجميع.","title_en":"Security & Protection","description_en":"Advanced security system ensuring fair gameplay for all."},{"icon":"Users","title":"مجتمع متفاعل","description":"استمتع باللعب مع مئات اللاعبين في بيئة تفاعلية مميزة.","title_en":"Active Community","description_en":"Enjoy playing with hundreds of players in a unique interactive environment."},{"icon":"Zap","title":"أداء عالي","description":"خوادم سريعة ومستقرة تضمن لك أفضل تجربة بدون تقطيع.","title_en":"High Performance","description_en":"Fast and stable servers ensuring the best lag-free experience."}]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Initial Translations (Fixed English translations)
INSERT INTO public.translations (key, ar, en) VALUES
  ('home', 'الرئيسية', 'Home'),
  ('store', 'المتجر', 'Store'),
  ('rules', 'القوانين', 'Rules'),
  ('applies', 'التقديمات', 'Applications'),
  ('about_us', 'من نحن', 'About Us'),
  ('login', 'تسجيل الدخول', 'Login'),
  ('logout', 'تسجيل الخروج', 'Logout'),
  ('my_profile', 'الملف الشخصي', 'My Profile'),
  ('admin_panel', 'لوحة الإدارة', 'Admin Panel'),
  ('welcome', 'أهلاً بك', 'Welcome'),
  ('connecting', 'جاري الاتصال...', 'Connecting...'),
  ('please_wait', 'يرجى الانتظار لحين تحميل البيانات', 'Please wait while data is loading'),
  ('setup_incomplete', 'إعداد النظام غير مكتمل', 'System Setup Incomplete'),
  ('loading_community_hub', 'جاري تحميل مجتمع اللاعبين...', 'Loading Community Hub...'),
  ('db_connection_error', 'خطأ في الاتصال بقاعدة البيانات', 'Database Connection Error'),
  ('play_now', 'العب الآن', 'Play Now'),
  ('apply_now', 'قدم الآن', 'Apply Now'),
  ('view_store', 'تصفح المتجر', 'View Store'),
  ('buy_now', 'شراء الآن', 'Buy Now'),
  ('add_to_cart', 'إضافة للسلة', 'Add to Cart'),
  ('cart', 'سلة المشتريات', 'Shopping Cart'),
  ('checkout', 'إتمام الطلب', 'Checkout'),
  ('total', 'المجموع', 'Total'),
  ('price', 'السعر', 'Price'),
  ('empty_cart', 'السلة فارغة', 'Cart is empty'),
  ('your_cart', 'سلتك', 'Your Cart'),
  ('sync_profile', 'مزامنة الحساب', 'Sync Profile'),
  ('syncing', 'جاري المزامنة...', 'Syncing...'),
  ('discord_profile', 'حساب ديسكورد', 'Discord Profile'),
  ('game_characters', 'شخصيات اللعبة', 'Game Characters'),
  ('no_characters_found', 'لا توجد شخصيات', 'No Characters Found'),
  ('play_to_create_character', 'العب داخل الخادم لإنشاء شخصيتك الأولى!', 'Play in the server to create your first character!'),
  ('currency_usd', 'دولار أمريكي', 'USD'),
  ('currency_jod', 'دينار أردني', 'JOD'),
  ('currency_sar', 'ريال سعودي', 'SAR'),
  ('currency_egp', 'جنيه مصري', 'EGP'),
  ('server_status', 'حالة الخادم', 'Server Status'),
  ('online_players', 'اللاعبين المتصلين', 'Online Players'),
  ('applications_history', 'سجل التقديمات', 'Applications History'),
  ('new_application', 'تقديم جديد', 'New Application'),
  ('no_submissions', 'لا توجد تقديمات سابقة', 'No previous applications'),
  ('status_pending', 'قيد المراجعة', 'Pending'),
  ('status_accepted', 'مقبول', 'Accepted'),
  ('status_rejected', 'مرفوض', 'Rejected'),
  ('stats', 'إحصائيات', 'Statistics'),
  ('total_apps', 'إجمالي التقديمات', 'Total Apps'),
  ('accepted_apps', 'التقديمات المقبولة', 'Accepted Apps'),
  ('personal_info', 'المعلومات الشخصية', 'Personal Info'),
  ('gender', 'الجنس', 'Gender'),
  ('age', 'العمر', 'Age'),
  ('dob', 'تاريخ الميلاد', 'Date of Birth'),
  ('level', 'المستوى', 'Level'),
  ('job', 'الوظيفة', 'Job'),
  ('faction', 'العصابة/المنظمة', 'Faction'),
  ('cash', 'كاش', 'Cash'),
  ('bank', 'البنك', 'Bank'),
  ('playtime', 'ساعات اللعب', 'Playtime'),
  ('vehicles', 'المركبات', 'Vehicles'),
  ('properties', 'الممتلكات', 'Properties'),
  ('no_vehicles', 'لا يملك مركبات', 'No vehicles owned'),
  ('no_properties', 'لا يملك ممتلكات', 'No properties owned'),
  ('hours', 'ساعة', 'Hours')
ON CONFLICT (key) DO UPDATE SET ar = EXCLUDED.ar, en = EXCLUDED.en;
