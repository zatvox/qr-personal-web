// ============================================================
// CLIENT LAYER — Instancia única (singleton) del cliente Supabase
// ============================================================
import { CONFIG } from './config.js';

let _client = null;

/**
 * Devuelve la instancia singleton del cliente Supabase.
 * Carga el SDK desde CDN (ESM) para no requerir build step.
 */
export async function getSupabaseClient() {
  if (_client) return _client;

  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

  _client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return _client;
}
