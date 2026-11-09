import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gowdixuenmfmvxdnlgpw.supabase.co';
const VALID_FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdvd2RpeHVlbm1mbXZ4ZG5sZ3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxNjEzMTQsImV4cCI6MjEwOTczNzMxNH0.OKyfXwgLhvZWPBEfbN7rZ-KwklxVQOzkMjglPMlNYvw';

const SUPABASE_KEY =
  (process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY.startsWith('eyJ'))
    ? process.env.SUPABASE_ANON_KEY
    : (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ'))
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : VALID_FALLBACK_KEY;


if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[SUPABASE] ADVERTENCIA: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configurados.');
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const DOCUMENTS_BUCKET = 'marisma-documents';
