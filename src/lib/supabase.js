import { createClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis;

function ensureEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildClient(key) {
  const url = ensureEnv("SUPABASE_URL");
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseServiceClient() {
  if (!globalForSupabase.__supabaseServiceClient) {
    const serviceKey = ensureEnv("SUPABASE_SERVICE_ROLE_KEY");
    globalForSupabase.__supabaseServiceClient = buildClient(serviceKey);
  }
  return globalForSupabase.__supabaseServiceClient;
}

export function getSupabaseAnonClient() {
  if (!globalForSupabase.__supabaseAnonClient) {
    const anonKey =
      process.env.SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      null;
    if (!anonKey) {
      throw new Error(
        "Missing required environment variable: SUPABASE_ANON_KEY",
      );
    }
    globalForSupabase.__supabaseAnonClient = buildClient(anonKey);
  }
  return globalForSupabase.__supabaseAnonClient;
}
