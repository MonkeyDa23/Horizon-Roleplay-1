// This file contains the full SQL schema for setting up the Supabase database.
// You can copy the content of the `supabaseSchema` string and paste it directly
// into the Supabase SQL Editor to run all the commands at once.

export const supabaseSchema = `
-- Full Supabase Schema for Horizon Roleplay Website
-- Copy and paste the entire content of this file into the Supabase SQL Editor.

-- 1. Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create custom types
-- Drop the type if it exists to avoid errors on re-running
DROP TYPE IF EXISTS submission_status;
CREATE TYPE submission_status AS ENUM ('pending', 'taken', 'accepted', 'refused');

-- 3. Create Tables
-- Use "DROP TABLE ... CASCADE" to remove existing tables if you're re-running the script
DROP TABLE IF EXISTS "products" CASCADE;
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "nameKey" TEXT NOT NULL,
    "descriptionKey" TEXT,
    price NUMERIC(10, 2) NOT NULL,
    "imageUrl" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

DROP TABLE IF EXISTS "quizzes" CASCADE;
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "titleKey" TEXT NOT NULL,
    "descriptionKey" TEXT,
    "isOpen" BOOLEAN DEFAULT FALSE,
    "allowedTakeRoles" TEXT[],
    "lastOpenedAt" TIMESTAMPTZ DEFAULT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

DROP TABLE IF EXISTS "quiz_questions" CASCADE;
CREATE TABLE quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    "textKey" TEXT NOT NULL,
    "timeLimit" INT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

DROP TABLE IF EXISTS "submissions" CASCADE;
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "quizId" UUID REFERENCES quizzes(id) ON DELETE SET NULL,
    "quizTitle" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    username TEXT NOT NULL,
    answers JSONB NOT NULL,
    "submittedAt" TIMESTAMPTZ NOT NULL,
    status submission_status DEFAULT 'pending',
    "adminId" TEXT,
    "adminUsername" TEXT
);

DROP TABLE IF EXISTS "audit_logs" CASCADE;
CREATE TABLE audit_logs (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    "adminId" TEXT NOT NULL,
    "adminUsername" TEXT NOT NULL,
    action TEXT NOT NULL
);

DROP TABLE IF EXISTS "rules_categories" CASCADE;
CREATE TABLE rules_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "titleKey" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

DROP TABLE IF EXISTS "rules" CASCADE;
CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES rules_categories(id) ON DELETE CASCADE,
    "textKey" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS) for all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
-- IMPORTANT: These are basic policies. Your backend uses the SERVICE_ROLE_KEY which bypasses RLS.
-- These policies are for any potential client-side access.

-- Products, Quizzes, Questions, Rules: Publicly readable by everyone.
DROP POLICY IF EXISTS "Allow public read access" ON products;
CREATE POLICY "Allow public read access" ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON quizzes;
CREATE POLICY "Allow public read access" ON quizzes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON quiz_questions;
CREATE POLICY "Allow public read access" ON quiz_questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON rules_categories;
CREATE POLICY "Allow public read access" ON rules_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON rules;
CREATE POLICY "Allow public read access" ON rules FOR SELECT USING (true);

-- Submissions: Allow users to create submissions, and view their own.
DROP POLICY IF EXISTS "Allow users to create submissions" ON submissions;
CREATE POLICY "Allow users to create submissions" ON submissions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can see their own submissions" ON submissions;
CREATE POLICY "Users can see their own submissions" ON submissions FOR SELECT USING (auth.uid()::text = "userId");

-- By default, INSERT, UPDATE, DELETE are denied for other tables unless a policy allows it.
-- The backend API uses the service role key to perform these actions securely.

-- 6. Insert initial mock/default data (optional, but good for starting)

-- Add some product examples
INSERT INTO products ("nameKey", "descriptionKey", price, "imageUrl") VALUES
('product_vip_bronze_name', 'product_vip_bronze_desc', 10.00, 'https://via.placeholder.com/300x200/cd7f32/ffffff?text=Bronze+VIP'),
('product_vip_silver_name', 'product_vip_silver_desc', 20.00, 'https://via.placeholder.com/300x200/c0c0c0/ffffff?text=Silver+VIP'),
('product_cash_1_name', 'product_cash_1_desc', 5.00, 'https://via.placeholder.com/300x200/228b22/ffffff?text=%24100k'),
('product_custom_plate_name', 'product_custom_plate_desc', 15.00, 'https://via.placeholder.com/300x200/4682b4/ffffff?text=Custom+Plate');

-- Add some rule examples
INSERT INTO rules_categories (id, "titleKey") VALUES
('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'rules_general_title'),
('b2c3d4e5-f6a7-8901-2345-67890abcdef1', 'rules_rp_title');

INSERT INTO rules (category_id, "textKey") VALUES
('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'rule_general_1'),
('a1b2c3d4-e5f6-7890-1234-567890abcdef', 'rule_general_2'),
('b2c3d4e5-f6a7-8901-2345-67890abcdef1', 'rule_rp_1');

-- Add some quiz examples
INSERT INTO quizzes (id, "titleKey", "descriptionKey", "isOpen") VALUES
('c3d4e5f6-a7b8-9012-3456-7890abcdef12', 'quiz_police_name', 'quiz_police_desc', true),
('d4e5f6a7-b8c9-0123-4567-890abcdef123', 'quiz_medic_name', 'quiz_medic_desc', false);

INSERT INTO quiz_questions (quiz_id, "textKey", "timeLimit") VALUES
('c3d4e5f6-a7b8-9012-3456-7890abcdef12', 'q_police_1', 120),
('c3d4e5f6-a7b8-9012-3456-7890abcdef12', 'q_police_2', 90),
('d4e5f6a7-b8c9-0123-4567-890abcdef123', 'q_medic_1', 120);
`;