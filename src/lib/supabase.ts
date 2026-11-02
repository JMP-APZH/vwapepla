import { createClient } from "@supabase/supabase-js";

// Read-only public client (publishable key, RLS = public read). No user sessions in MVP2.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
