import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are missing.');
}

export const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
