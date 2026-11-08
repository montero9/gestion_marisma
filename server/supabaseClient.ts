import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gowdixuenmfmvxdnlgpw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || 'sb_secret_7p0L0wIkWojx_BezjZSciQ_OQh1trI1';

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
