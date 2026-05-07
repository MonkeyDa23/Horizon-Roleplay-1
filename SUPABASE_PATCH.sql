-- ==========================================
-- SUPABASE PATCH SCRIPT
-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- ==========================================

-- 1. ADD MISSING COLUMNS TO USERS
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS balance INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mta_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mta_linked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;

-- 2. CREATE MISSING TABLES
CREATE TABLE IF NOT EXISTS public.discord_widgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  server_id TEXT NOT NULL,
  server_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id TEXT PRIMARY KEY,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  action TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id),
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quizzes (
  id TEXT PRIMARY KEY,
  title_key TEXT,
  description_key TEXT,
  instructions_key TEXT,
  is_open BOOLEAN DEFAULT TRUE,
  questions JSONB DEFAULT '[]'::jsonb
);

-- Note: we renamed submissions to quiz_submissions and product_categories to categories in code,
-- but just to be safe we recreate aliases or tables if needed. 
-- The code now uses `categories` and `quiz_submissions`.

-- 3. ENABLE RLS FOR NEW TABLES
ALTER TABLE public.discord_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES FOR NEW TABLES
CREATE POLICY "Public read discord_widgets" ON public.discord_widgets FOR SELECT USING (true);
CREATE POLICY "Admins manage discord_widgets" ON public.discord_widgets FOR ALL USING (public.is_admin());

CREATE POLICY "Public read role_permissions" ON public.role_permissions FOR SELECT USING (true);
CREATE POLICY "Admins manage role_permissions" ON public.role_permissions FOR ALL USING (public.is_admin());

CREATE POLICY "Admins read audit_log" ON public.audit_log FOR SELECT USING (public.is_admin());
CREATE POLICY "System insert audit_log" ON public.audit_log FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read quizzes" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Admins manage quizzes" ON public.quizzes FOR ALL USING (public.is_admin());

-- 5. RPC FIXES
CREATE OR REPLACE FUNCTION public.get_staff()
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT,
  role_key TEXT
) AS $$
BEGIN
  -- Returns admins
  RETURN QUERY SELECT 
    u.id, 
    u.username, 
    u.avatar as avatar_url, 
    u.role as role_key
  FROM public.users u 
  WHERE u.role IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
