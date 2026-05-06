import { createClient } from '@supabase/supabase-js';
import { env } from '../env.ts';

let supabaseUrl = env.VITE_SUPABASE_URL;
if (supabaseUrl && supabaseUrl.endsWith('/rest/v1')) {
  supabaseUrl = supabaseUrl.replace('/rest/v1', '');
} else if (supabaseUrl && supabaseUrl.endsWith('/rest/v1/')) {
  supabaseUrl = supabaseUrl.replace('/rest/v1/', '');
}

const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

// Prevent app crash by checking for environment variables before creating the client.
// A check is added to ensure the placeholder values have been replaced.
export const supabase = (supabaseUrl && supabaseAnonKey && (!supabaseUrl.includes('YOUR_SUPABASE_URL')))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
