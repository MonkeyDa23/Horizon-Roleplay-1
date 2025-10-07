// FIX: Use type assertion for import.meta.env as TypeScript cannot find Vite's client types.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

// FIX: Prevent app crash by checking for environment variables before creating the client.
// If they are not set, export null. The HealthCheckPage will handle this gracefully.
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
