import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Only used in server-side routes — never imported client-side
let _client: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _client;
}

// Convenience export — lazily initialized so it's safe during build
export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabaseServer()[prop as keyof SupabaseClient];
  },
});
