import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "./auth/actions";
import GoBoard from "./components/go-board";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export default async function Home() {
  const hasAuthConfig = hasSupabaseEnv();

  if (!hasAuthConfig) {
    return (
      <main className="joseki-page">
        <HeroSection>
          <div className="setup-card">
            <p className="status-label">Supabase Setup</p>
            <p className="status-message" data-tone="info">
              Copy `.env.example` to `.env.local`, add your Supabase project
              values, and restart the dev server to turn auth on.
            </p>
            <p className="status-meta">
              Once those values are present, this board will switch to
              server-verified Supabase sessions automatically.
            </p>
          </div>
        </HeroSection>

        <section className="board-card auth-lock-card">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Board Access</p>
              <h2 className="section-title">Finish the auth setup first</h2>
            </div>
            <p className="section-note">
              The interactive study board is now gated behind Supabase auth so
              we can keep the session consistent between server and client code.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = (data?.claims ?? null) as Record<string, unknown> | null;
  const isSignedIn = typeof claims?.sub === "string";
  const email = typeof claims?.email === "string" ? claims.email : null;

  return (
    <main className="joseki-page">
      <HeroSection>
        {isSignedIn ? (
          <div className="session-card">
            <p className="status-label">Signed in with Supabase</p>
            <p className="session-email">{email ?? "Authenticated study session"}</p>
            <p className="status-meta">
              Your session is refreshed in `proxy.ts` and verified on the server
              before the board is rendered.
            </p>
            <div className="session-actions">
              <Link href="/auth" className="control-button">
                Account
              </Link>
              <form action={signOutAction} className="inline-form">
                <button type="submit" className="control-button danger">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="auth-callout">
            <p className="status-label">Board Locked</p>
            <p className="status-message" data-tone="info">
              Sign in or create an account to open the study board.
            </p>
            <p className="status-meta">
              This project now uses Supabase email/password auth with cookie
              sessions that work in both Server Components and client UI.
            </p>
            <div className="session-actions">
              <Link href="/auth" className="control-button primary">
                Open auth
              </Link>
            </div>
          </div>
        )}
      </HeroSection>

      {isSignedIn ? (
        <GoBoard />
      ) : (
        <section className="board-card auth-lock-card">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Study Board</p>
              <h2 className="section-title">Ready when you are</h2>
            </div>
            <p className="section-note">
              The goban unlocks after sign-in so the auth example has a real
              protected experience to hang off of.
            </p>
          </div>
          <div className="session-actions">
            <Link href="/auth" className="control-button primary">
              Sign in to continue
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}

function HeroSection({ children }: { children: ReactNode }) {
  return (
    <section className="hero-panel">
      <div>
        <p className="hero-kicker">Joseki Atelier</p>
        <h1 className="hero-title">
          Model opening patterns on a board that feels studied, calm, and
          tactile.
        </h1>
      </div>
      <div className="hero-copy">
        <p>
          This first pass focuses on the board itself: a responsive 19 by 19
          goban with coordinates, numbered stones, captures, suicide
          prevention, and simple ko.
        </p>
        <p>
          The goal is to make sketching joseki lines feel closer to working on
          a study table than clicking through a generic game widget.
        </p>
        {children}
      </div>
    </section>
  );
}
