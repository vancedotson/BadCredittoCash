// Public client configuration must be present while Next.js builds so it can be
// embedded in browser bundles. Cloudflare's runtime vars remain the override.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? "https://gulidnxltrgomjyctjlp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? "sb_publishable_kUngQFloolk0SWmgkBRUYw_l44atY4F";

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

export function getSupabaseConfig() {
  if (!hasSupabaseConfig()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url: SUPABASE_URL!, publishableKey: SUPABASE_PUBLISHABLE_KEY! };
}
