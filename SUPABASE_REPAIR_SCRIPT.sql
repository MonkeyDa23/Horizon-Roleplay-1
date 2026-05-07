-- SUPABASE_REPAIR_SCRIPT.sql
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Disable RLS temporarily to avoid conflicts during repair
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 2. Repair Table Structure (Add missing columns)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS discord_id TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS highest_role JSONB,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
ADD COLUMN IF NOT EXISTS balance DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Create Security Definer Helper for Admin Check (Prevents Infinite Recursion)
CREATE OR REPLACE FUNCTION public.check_is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = user_id 
        AND (role IN ('admin', 'super_admin') OR 'admin' = ANY(roles) OR 'super_admin' = ANY(roles))
    ) INTO is_admin;
    RETURN is_admin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Clean up old problematic policies
DROP POLICY IF EXISTS "policy_user_read_self" ON public.users;
DROP POLICY IF EXISTS "policy_admin_read_all" ON public.users;
DROP POLICY IF EXISTS "policy_user_update_self" ON public.users;
DROP POLICY IF EXISTS "policy_user_insert_self" ON public.users;
DROP POLICY IF EXISTS "user_read_self" ON public.users;
DROP POLICY IF EXISTS "admin_read_all" ON public.users;
DROP POLICY IF EXISTS "user_update_self" ON public.users;
DROP POLICY IF EXISTS "user_insert_self" ON public.users;

-- 5. Re-create Clean Policies using the Helper
CREATE POLICY "policy_user_read_self" ON public.users 
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "policy_admin_read_all" ON public.users 
FOR SELECT USING (public.check_is_admin(auth.uid()));

CREATE POLICY "policy_user_update_self" ON public.users 
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "policy_user_insert_self" ON public.users 
FOR INSERT WITH CHECK (auth.uid() = id);

-- 6. Grant basic permissions
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

-- 7. Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 8. Fix RPC functions if they exist
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
