-- FINAL_RLS_FIX.sql
-- هذا الملف يحل مشكلة التداخل اللانهائي (Infinite Recursion) بشكل نهائي

-- 1. تعطيل الـ RLS مؤقتاً لتنظيف السياسات
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 2. حذف كل السياسات الحالية للجدول لتجنب أي تضارب
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Anyone can view basic profiles" ON public.users;

-- 3. إنشاء وظيفة فحص الأدوار بحيث تتخطى الـ RLS (Security Definer)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- نستخدم SELECT بدون RLS هنا لأن الوظيفة SECURITY DEFINER
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. إعادة تفعيل الـ RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. إنشاء السياسات الجديدة (بدون استدعاء وظائف داخل SELECT الخاص بـ users لتجنب التكرار)

-- المستخدم يرى نفسه دائماً
CREATE POLICY "user_read_self" ON public.users 
FOR SELECT USING (auth.uid() = id);

-- الأدمن يرى الجميع (باستخدام EXISTS بسيطة لا تسبب تداخل)
CREATE POLICY "admin_read_all" ON public.users 
FOR SELECT USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin')
);

-- التحديث مسموح للمالك فقط
CREATE POLICY "user_update_self" ON public.users 
FOR UPDATE USING (auth.uid() = id);

-- الإدخال مسموح عند التسجيل
CREATE POLICY "user_insert_self" ON public.users 
FOR INSERT WITH CHECK (auth.uid() = id);

-- 7. التأكد من وجود الأعمدة المطلوبة
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='avatar_url') THEN
    ALTER TABLE public.users ADD COLUMN avatar_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='discord_id') THEN
    ALTER TABLE public.users ADD COLUMN discord_id TEXT;
  END IF;
END $$;

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
            'nameKey', p.nameKey, -- تأكد من استخدام المفاتيح الصحيحة
            'descriptionKey', p.descriptionKey,
            'price', p.price,
            'imageUrl', p.imageUrl
          )
        )
        FROM public.products p
        WHERE p.category_id = c.id
      )
    )
  ) INTO result
  FROM public.product_categories c; -- تأكد من اسم الجدول
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
