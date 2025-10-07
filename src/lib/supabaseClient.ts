import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

// Prevent app crash by checking for environment variables before creating the client.
// If they are not set, export null. The app will gracefully degrade to a logged-out
// state, and the HealthCheckPage will guide the user on setup.
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
