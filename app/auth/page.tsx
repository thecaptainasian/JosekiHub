import AuthForm from "./auth-form";
import { signInAction, signOutAction, signUpAction } from "./actions";
import GoBoard from "../components/go-board";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

type AuthPageProps = {
  searchParams: Promise<{
    message?: string | string[];
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const rawMessage = (await searchParams).message;
  const message = Array.isArray(rawMessage) ? rawMessage[0] : rawMessage;
  const hasAuthConfig = hasSupabaseEnv();
  let isSignedIn = false;
  let email: string | null = null;

  if (hasAuthConfig) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = (data?.claims ?? null) as Record<string, unknown> | null;

    isSignedIn = typeof claims?.sub === "string";
    email = typeof claims?.email === "string" ? claims.email : null;
  }

  return (
    <main className="joseki-page auth-board-page">
      <section className="auth-strip" aria-labelledby="account-title">
        <div className="auth-strip-heading">
          <p className="section-kicker">Account</p>
          <h1 id="account-title" className="auth-strip-title">
            Sign in or create account
          </h1>
        </div>

        {!hasAuthConfig ? (
          <div className="auth-setup-note">
            <p>
              Copy `.env.example` to `.env.local`, fill in your project URL,
              publishable key, and site URL, then restart the Next dev server.
            </p>
          </div>
        ) : isSignedIn ? (
          <div className="auth-signed-in">
            <p>{email ?? "Signed in"}</p>
            <form action={signOutAction} className="inline-form">
              <button type="submit" className="control-button danger">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="auth-grid" aria-label="Authentication forms">
            <AuthForm
              action={signInAction}
              idPrefix="sign-in"
              passwordAutoComplete="current-password"
              submitLabel="Sign in"
              title="Sign in"
            />
            <AuthForm
              action={signUpAction}
              helperText="Email confirmation may be required."
              idPrefix="sign-up"
              passwordAutoComplete="new-password"
              submitLabel="Create account"
              title="Create account"
            />
          </div>
        )}
      </section>

      {message ? (
        <section className="status-card auth-page-message">
          <p className="status-label">Auth update</p>
          <p className="status-message" data-tone="info">
            {message}
          </p>
        </section>
      ) : null}

      <GoBoard canSaveSequences={isSignedIn} />
    </main>
  );
}
