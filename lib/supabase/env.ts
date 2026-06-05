const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

export function hasSupabaseEnv() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function normalizeNextPath(path: string | null | undefined) {
  return path && path.startsWith("/") ? path : "/";
}

export function getAuthCallbackUrl(next = "/") {
  const callbackUrl = new URL("/auth/confirm", getSupabaseEnv().siteUrl);
  callbackUrl.searchParams.set("next", normalizeNextPath(next));
  return callbackUrl.toString();
}

export function getSupabaseEnv() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return {
    siteUrl: siteUrl || "http://localhost:3000",
    supabasePublishableKey,
    supabaseUrl,
  };
}
