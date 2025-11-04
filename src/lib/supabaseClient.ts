import { createClient } from '@supabase/supabase-js';
import { env } from '../env.ts';

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

// Prevent app crash by checking for environment variables before creating the client.
// A check is added to ensure the placeholder values have been replaced.
export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'YOUR_SUPABASE_URL')
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
