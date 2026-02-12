import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service role key
// NEVER expose this on the client
export function createServerSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key);
}

// The demo org ID - in production this comes from the authenticated user's session
export const DEMO_ORG_ID = "a1b2c3d4-0000-0000-0000-000000000001";
