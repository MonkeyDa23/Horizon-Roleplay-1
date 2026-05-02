-- ==========================================
-- 1. ملف إعدادات Supabase (PostgreSQL)
-- انسخ هذا الكود بالكامل والصقه في الـ SQL Editor في Supabase
-- ==========================================

-- تحديث جدول الإعدادات (config) ليكون متوافقاً مع الميزات الجديدة
-- ملاحظة: اسم الجدول هو config بحروف صغيرة كما هو في schema.ts
DO $$ 
BEGIN 
    -- إضافة عمود وضع الصيانة إذا لم يكن موجوداً
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'config' AND column_name = 'MAINTENANCE_MODE') THEN
        ALTER TABLE public.config ADD COLUMN "MAINTENANCE_MODE" BOOLEAN DEFAULT false;
    END IF;

    -- إضافة رسالة الصيانة بالعربية
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'config' AND column_name = 'MAINTENANCE_MESSAGE_AR') THEN
        ALTER TABLE public.config ADD COLUMN "MAINTENANCE_MESSAGE_AR" TEXT DEFAULT 'الموقع حالياً تحت الصيانة لتحسين تجربتكم. سنعود قريباً!';
    END IF;
END $$;

-- تحديث الترجمات: تحويل كل المفاتيح التي تبدأ بـ vixel_ لتصبح nova_
-- هكذا ستظهر الترجمات في الموقع فوراً بعد أن قمنا بتغييرها في الكود
UPDATE public.translations 
SET key = REPLACE(key, 'vixel_', 'nova_') 
WHERE key LIKE 'vixel_%';

-- التأكد من بقاء لغة المفاتيح سليمة
-- إذا كان هناك ترجمات مفقودة، سيقوم الموقع باستخدام القيمة الافتراضية المكتوبة في الكود كمفتاح (Key)
-- لذا يفضل مراجعة جدول translations والتأكد من وجود nova_dashboard_title وغيرها.

-- تحديث اسم المجتمع في الإعدادات
UPDATE public.config 
SET "COMMUNITY_NAME" = 'Nova Roleplay' 
WHERE "id" = 1;

-- ==========================================
-- 2. تأكيد العمليات
-- ==========================================
COMMIT;
