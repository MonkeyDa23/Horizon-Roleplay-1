-- SUPABASE_FIX.sql
-- Fix for Infinite Recursion in users table policies

-- 1. Redefine get_role to be more efficient and avoid search_path issues
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 2. Update is_admin to use the new helper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (public.get_user_role(auth.uid())) IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. DROP old policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- 4. RECREATE policies without recursion
-- For SELECT: Use a raw check for own profile, and for admins use a check that doesn't loop.
-- The trick is to NOT call is_admin() for the users table SELECT, 
-- or ensure is_admin() bypasses RLS correctly.

CREATE POLICY "Users can read own profile" ON public.users 
FOR SELECT USING (auth.uid() = id);

-- Use a subquery with LIMIT 1 to check admin status
CREATE POLICY "Admins can read all profiles" ON public.users 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin') 
    LIMIT 1
  )
);

CREATE POLICY "Users can update own profile" ON public.users 
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users 
FOR INSERT WITH CHECK (auth.uid() = id);

-- Fix for Products Categories RPC if it was failing
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
          )
        )
        FROM public.products p
        WHERE p.category_id = c.id
      )
    )
  ) INTO result
  FROM public.categories c;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
