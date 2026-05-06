
// src/lib/database_schema.ts

export const databaseSchema = `
/* 
  =================================================================
  NOVA ROLEPLAY - ULTIMATE MASTER SCHEMA (CLEAN & COMPLETE)
  =================================================================
*/

BEGIN;

-- 1. الأساسيات
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS private;

-- 2. تنظيف شامل
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.characters CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;
DROP TABLE IF EXISTS public.properties CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.product_categories CASCADE;
DROP TABLE IF EXISTS public.purchases CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.security_events CASCADE;
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.staff CASCADE;
DROP TABLE IF EXISTS public.rules CASCADE;
DROP TABLE IF EXISTS public.quizzes CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.translations CASCADE;
DROP TABLE IF EXISTS public.config CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS private.user_secrets CASCADE;

-- 3. الجداول الأساسية
CREATE TABLE public.config (
    key text PRIMARY KEY,
    value jsonb DEFAULT '{}',
    updated_at timestamptz DEFAULT now()
);

-- إعدادات الموقع الافتراضية
INSERT INTO public.config (key, value) VALUES 
('branding', '{
    "siteName": "Nova Roleplay", 
    "logoUrl": "https://cdn-icons-png.flaticon.com/512/2910/2910768.png",
    "primaryColor": "#00F2EA",
    "secondaryColor": "#6366F1",
    "heroTitle": "نوفا رول بلاي",
    "heroSubtitle": "أفضل تجربة واقع حياة في عالم MTA",
    "discordUrl": "https://discord.gg/nova"
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    discord_id text UNIQUE,
    username text,
    avatar_url text,
    roles jsonb DEFAULT '{"admin": false, "_super_admin": false}'::jsonb,
    balance numeric(12, 2) DEFAULT 0 CHECK (balance >= 0),
    mta_serial text UNIQUE,
    mta_name text,
    mta_linked_at timestamptz,
    is_banned boolean DEFAULT false,
    ban_reason text,
    ban_expires_at timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.role_permissions (
    role_id text PRIMARY KEY,
    permissions text[] DEFAULT '{}'
);

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp timestamptz DEFAULT now(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    username text,
    action text NOT NULL,
    details jsonb,
    severity text DEFAULT 'INFO',
    ip_address text,
    user_agent text,
    category text DEFAULT 'GENERAL'
);

CREATE TABLE public.security_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp timestamptz DEFAULT now(),
    event_type text NOT NULL,
    severity text DEFAULT 'WARNING',
    ip_address text,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    details jsonb,
    request_path text,
    user_agent text
);

-- 4. بيانات اللعبة (MTA Sync)
CREATE TABLE public.characters (
    id serial PRIMARY KEY,
    owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    money numeric DEFAULT 0,
    bank numeric DEFAULT 0,
    job text DEFAULT 'Unemployed',
    faction text DEFAULT 'None',
    skin int DEFAULT 0,
    playtime_hours int DEFAULT 0,
    last_login timestamptz DEFAULT now()
);

-- 5. المتجر والمالية
CREATE TABLE public.product_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name_key text NOT NULL,
    icon text,
    position int DEFAULT 0
);

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id uuid REFERENCES public.product_categories(id),
    name_key text NOT NULL,
    description_key text,
    price numeric NOT NULL,
    image_url text,
    is_active boolean DEFAULT true
);

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    admin_id uuid,
    products jsonb NOT NULL, 
    total_amount numeric(12,2) NOT NULL,
    status text DEFAULT 'pending', -- pending, paid, cancelled
    created_at timestamptz DEFAULT now()
);

-- 6. التقديمات والمسابقات
CREATE TABLE public.quizzes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title_key text NOT NULL,
    description_key text,
    questions jsonb NOT NULL, 
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.submissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id uuid REFERENCES public.quizzes(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    answers jsonb NOT NULL, 
    status text DEFAULT 'pending', -- pending, taken, accepted, rejected
    admin_id uuid,
    reason text,
    created_at timestamptz DEFAULT now()
);

-- 7. الترجمات الشاملة للموقع
CREATE TABLE public.translations ( key text PRIMARY KEY, en text, ar text );

INSERT INTO public.translations (key, en, ar) VALUES
-- Header & Footer
('home', 'Home', 'الرئيسية'),
('store', 'Store', 'المتجر'),
('rules', 'Rules', 'القوانين'),
('applies', 'Applications', 'التقديمات'),
('logout', 'Log Out', 'تسجيل الخروج'),
('login_discord', 'Login with Discord', 'دخول بواسطة ديسكورد'),
('admin_panel', 'Admin Panel', 'لوحة التحكم'),
('welcome', 'Welcome', 'مرحباً'),
('footer_rights', 'All rights reserved.', 'جميع الحقوق محفوظة.'),

-- Landing Page
('hero_title', 'Nova Roleplay', 'نوفا رول بلاي'),
('hero_subtitle', 'Join the most advanced community.', 'انضم لأكثر مجتمع تطوراً.'),
('play_now', 'Play Now', 'إلعب الآن'),
('join_discord', 'Join Discord', 'انضم للديسكورد'),
('server_status', 'Server Status', 'حالة السيرفر'),

-- Profile & MTA
('my_profile', 'My Profile', 'حسابي'),
('balance', 'Balance', 'الرصيد'),
('link_account', 'Link Account', 'ربط الحساب'),
('mta_serial', 'MTA Serial', 'سيريال اللعبة'),
('mta_name', 'MTA Username', 'اسم المستخدم في اللعبة'),
('not_linked', 'Not Linked', 'غير مرتبط'),
('total_playtime', 'Total Playtime', 'إجمالي وقت اللعب'),
('hours', 'Hours', 'ساعة'),

-- Store & Bank
('add_to_cart', 'Add to Cart', 'أضف للسلة'),
('checkout', 'Checkout', 'إتمام الشراء'),
('empty_cart', 'Cart is empty', 'السلة فارغة'),
('price', 'Price', 'السعر'),
('purchase_success', 'Purchase Successful', 'تم الشراء بنجاح'),
('insufficient_balance', 'Insufficient Balance', 'رصيدك غير كافٍ'),
('confirm_purchase', 'Confirm Purchase', 'تأكيد الشراء'),
('item_already_in_cart', 'Item already in cart', 'المنتج موجود فعلاً في السلة'),

-- Admin Dashboard
('dashboard', 'Dashboard', 'الرئيسية'),
('users_management', 'Users Management', 'إدارة المستخدمين'),
('invoices_management', 'Invoices Management', 'إدارة الفواتير'),
('site_settings', 'Site Settings', 'إعدادات الموقع'),
('save_changes', 'Save Changes', 'حفظ التغييرات'),
('delete_confirm', 'Are you sure?', 'هل أنت متأكد؟'),
('ban_user', 'Ban User', 'حظر المستخدم'),
('unban_user', 'Unban User', 'فك حظر المستخدم'),
('grant_admin', 'Grant Admin', 'منح صلاحية إدمن'),
('revoke_admin', 'Revoke Admin', 'سحب صلاحية إدمن'),

-- Quiz & Apply
('submit', 'Submit', 'إرسال'),
('pending', 'Pending', 'قيد الانتظار'),
('accepted', 'Accepted', 'مقبول'),
('rejected', 'Rejected', 'مرفوض'),
('taken', 'Under Review', 'قيد المراجعة'),
('quiz_title_label', 'Application Title', 'عنوان التقديم'),
('instructions', 'Instructions', 'الإرشادات'),
('start_apply', 'Start Application', 'بدء التقديم'),
('back_to_list', 'Back to List', 'الرجوع للقائمة'),

-- Branding UI
('edit_branding', 'Edit Site Branding', 'تعديل هوية الموقع'),
('site_name', 'Site Name', 'اسم الموقع'),
('site_logo', 'Logo URL', 'رابط الشعار'),
('primary_color', 'Primary Color', 'اللون الأساسي'),
('secondary_color', 'Secondary Color', 'اللون الثانوي'),

-- General Utils
('loading', 'Loading...', 'جاري التحميل...'),
('error', 'Error', 'خطأ'),
('success', 'Success', 'نجاح')

-- Anti-Duplicate Update Gate
ON CONFLICT (key) DO UPDATE SET en = EXCLUDED.en, ar = EXCLUDED.ar;

-- 8. الحماية RLS
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow Public Access to Translations" ON public.translations FOR SELECT USING (true);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow Users to read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

COMMIT;
`;
;