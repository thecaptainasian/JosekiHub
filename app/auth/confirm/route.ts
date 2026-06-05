import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv, normalizeNextPath } from "@/lib/supabase/env";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = normalizeNextPath(request.nextUrl.searchParams.get("next"));
  const redirectTo = new URL(next, request.url);

  if (tokenHash && type && hasSupabaseEnv()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  const errorUrl = new URL("/auth", request.url);
  errorUrl.searchParams.set(
    "message",
    "That verification link is invalid or has expired. Request a new sign-up email and try again.",
  );
  return NextResponse.redirect(errorUrl);
}
