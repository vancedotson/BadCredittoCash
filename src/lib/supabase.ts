/**
 * Supabase client (placeholder).
 *
 * Not wired up yet. When you're ready to connect Supabase:
 *
 *   1. npm install @supabase/supabase-js
 *   2. Set the env vars in .env.local (see .env.example)
 *   3. Uncomment the implementation below
 *   4. Use getSupabaseServerClient() inside src/lib/store.ts
 *
 * Keeping this isolated means only store.ts changes when the DB comes online.
 */

// import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// let client: SupabaseClient | null = null;

export function getSupabaseServerClient() {
  // if (!client) {
  //   const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  //   const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only
  //   if (!url || !key) throw new Error("Supabase env vars are not set.");
  //   client = createClient(url, key, { auth: { persistSession: false } });
  // }
  // return client;

  throw new Error(
    "Supabase is not configured yet. See src/lib/supabase.ts for setup steps.",
  );
}
