import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase URL or Service Role Key is not set in environment variables.");
    // In a real app, you might want to prevent the app from starting.
}

export const supabase = createClient(supabaseUrl, supabaseKey);
