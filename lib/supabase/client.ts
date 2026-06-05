import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export function createClient() {
  const { supabasePublishableKey, supabaseUrl } = getSupabaseEnv();

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
