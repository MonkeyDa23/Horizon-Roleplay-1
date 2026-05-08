-- SUPABASE REPAIR SCRIPT 2.0
-- This script fixes RLS infinite recursion and adds missing RPC functions.

-- 1. Ensure columns exist and fix email nullability
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS discord_id TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS highest_role JSONB,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
ADD COLUMN IF NOT EXISTS balance DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS mta_serial TEXT,
ADD COLUMN IF NOT EXISTS mta_name TEXT,
ADD COLUMN IF NOT EXISTS mta_linked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Helper functions for RLS (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.check_user_is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = user_id 
        AND (
            role IN ('admin', 'super_admin') 
            OR 'admin' = ANY(roles) 
            OR 'super_admin' = ANY(roles)
            OR 'owner' = ANY(roles)
        )
    );
END;
$$;

-- 3. Reset and Re-create RLS for users
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "policy_user_read_self" ON public.users;
DROP POLICY IF EXISTS "policy_admin_all" ON public.users;
DROP POLICY IF EXISTS "policy_user_update_self" ON public.users;
DROP POLICY IF EXISTS "policy_user_insert_self" ON public.users;
DROP POLICY IF EXISTS "policy_public_read" ON public.users;

-- Standard policies
CREATE POLICY "policy_user_read_self" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "policy_public_read" ON public.users FOR SELECT USING (TRUE);
CREATE POLICY "policy_admin_all" ON public.users FOR ALL USING (public.check_user_is_admin(auth.uid()));
CREATE POLICY "policy_user_update_self" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "policy_user_insert_self" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. RPC: log_page_visit
CREATE TABLE IF NOT EXISTS public.page_visits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id),
    page_name text NOT NULL,
    visited_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.log_page_visit(p_page_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.page_visits (user_id, page_name)
    VALUES (auth.uid(), p_page_name);
END;
$$;

-- 5. RPC: get_all_submissions
CREATE OR REPLACE FUNCTION public.get_all_submissions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT public.check_user_is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    
    RETURN (SELECT jsonb_agg(s) FROM public.submissions s);
END;
$$;

-- 6. RPC: log_admin_action
CREATE OR REPLACE FUNCTION public.log_admin_action(p_site_name text, p_user_data jsonb, p_action text, p_details text, p_level text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.audit_logs (site_name, user_id, action, details, level, created_at)
    VALUES (p_site_name, (p_user_data->>'id')::uuid, p_action, p_details, p_level, now());
END;
$$;

-- 7. RPC: get_products_with_categories
CREATE OR REPLACE FUNCTION public.get_products_with_categories()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'name_ar', c.name_ar,
            'icon', c.icon,
            'products', (
                SELECT jsonb_agg(p)
                FROM public.products p
                WHERE p.category_id = c.id
            )
        ))
        FROM public.categories c
    );
END;
$$;

-- 8. RPC: get_config
CREATE OR REPLACE FUNCTION public.get_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT jsonb_object_agg(key, value)
        FROM public.config
    );
END;
$$;
