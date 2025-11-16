import { createClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis;

function ensureEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseClient() {
  if (!globalForSupabase.__supabaseClient) {
    const url = ensureEnv("SUPABASE_URL");
    const serviceKey = ensureEnv("SUPABASE_SERVICE_ROLE_KEY");

    globalForSupabase.__supabaseClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return globalForSupabase.__supabaseClient;
}
