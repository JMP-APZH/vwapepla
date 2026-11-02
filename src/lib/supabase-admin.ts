import "server-only"; // build error if this module is ever imported into browser code
import { createClient } from "@supabase/supabase-js";

// Server-side client with the SECRET key. Used only to call cast_site_vote (the only write path from the site).
// SUPABASE_SECRET_KEY: Vercel env var (Production + Preview, Sensitive) and .env.local — never NEXT_PUBLIC_.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_SECRET_KEY is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
