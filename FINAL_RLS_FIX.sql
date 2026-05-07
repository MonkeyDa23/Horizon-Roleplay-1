-- FINAL_RLS_FIX.sql
-- هذا الملف يحل مشكلة التداخل اللانهائي (Infinite Recursion) ويضيف الأعمدة الناقصة

-- 1. تعطيل الـ RLS مؤقتاً
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 2. التأكد من وجود الأعمدة المطلوبة
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND table_schema='public' AND column_name='avatar_url') THEN
    ALTER TABLE public.users ADD COLUMN avatar_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND table_schema='public' AND column_name='discord_id') THEN
    ALTER TABLE public.users ADD COLUMN discord_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND table_schema='public' AND column_name='highest_role') THEN
    ALTER TABLE public.users ADD COLUMN highest_role JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND table_schema='public' AND column_name='last_synced_at') THEN
    ALTER TABLE public.users ADD COLUMN last_synced_at TIMESTAMPTZ;
  END IF;
END $$;

-- 3. حذف كل السياسات الحالية لتجنب التضارب
DROP POLICY IF EXISTS "user_read_self" ON public.users;
DROP POLICY IF EXISTS "admin_read_all" ON public.users;
DROP POLICY IF EXISTS "user_update_self" ON public.users;
DROP POLICY IF EXISTS "user_insert_self" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "policy_user_read_self" ON public.users;
DROP POLICY IF EXISTS "policy_admin_read_all" ON public.users;
DROP POLICY IF EXISTS "policy_user_update_self" ON public.users;
DROP POLICY IF EXISTS "policy_user_insert_self" ON public.users;

-- 4. إنشاء وظيفة الأمن (SECURITY DEFINER) لتجنب التداخل
CREATE OR REPLACE FUNCTION public.is_admin_uid(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = user_id AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. إنشاء السياسات الجديدة بدون تداخل
CREATE POLICY "policy_user_read_self" ON public.users 
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "policy_admin_read_all" ON public.users 
FOR SELECT USING (is_admin_uid(auth.uid()));

CREATE POLICY "policy_user_update_self" ON public.users 
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "policy_user_insert_self" ON public.users 
FOR INSERT WITH CHECK (auth.uid() = id);

-- 6. إعادة تفعيل الـ RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 7. إصلاح وظيفة المنتجات
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
      'products', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'nameKey', p.name_key,
            'descriptionKey', p.description_key,
            'price', p.price,
            'imageUrl', p.image_url
          )
        )
        FROM public.products p
        WHERE p.category_id = c.id
      ), '[]'::jsonb)
    )
  ) INTO result
  FROM public.product_categories c;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
