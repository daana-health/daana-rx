import { createClient } from '@supabase/supabase-js';
import './loadEnv';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseServiceKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

if (!supabaseAnonKey) {
  console.warn('Warning: NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Authentication may not work properly.');
}

// Server-side Supabase client with service role key (for admin operations)
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Server-side Supabase client with anon key (for authentication)
// This is needed because signInWithPassword doesn't work properly with service role key
// Fallback to service key if anon key is not available (should not happen in production)
export const supabaseAuth = createClient(
  supabaseUrl, 
  supabaseAnonKey || supabaseServiceKey, 
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
