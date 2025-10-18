import { createClient } from '@supabase/supabase-js';
import { env } from '../env';

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

// Prevent app crash by checking for environment variables before creating the client.
// This ensures the app fails gracefully with a clear error if not configured.
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
