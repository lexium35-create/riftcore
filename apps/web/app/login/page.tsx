"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getRiftcoreBrowserSupabase } from "@/lib/supabase-browser";
import styles from "../user-auth.module.css";

type OAuthProvider = "google" | "discord" | "github" | "custom:telegram";

const providers: Array<{ id: OAuthProvider; label: string; short: string; scopes?: string }> = [
  { id: "google", label: "Continue with Google", short: "Google" },
  { id: "discord", label: "Continue with Discord", short: "Discord", scopes: "identify email" },
  { id: "github", label: "Continue with GitHub", short: "GitHub", scopes: "read:user user:email" },
  { id: "custom:telegram", label: "Continue with Telegram", short: "Telegram" },
];

function safeNext(): string {
  if (typeof window === "undefined") return "/account";
  const value = new URLSearchParams(window.location.search).get("next");
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/account";
  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(safeNext());
    });
  }, [router, supabase]);

  async function oauth(provider: OAuthProvider) {
    setError(null);
    setBusy(provider);
    const selected = providers.find((item) => item.id === provider);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext())}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        ...(selected?.scopes ? { scopes: selected.scopes } : {}),
      },
    });
    if (authError) {
      setError(authError.message);
      setBusy(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("email");
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError(authError.message);
      setBusy(null);
      return;
    }
    router.replace(safeNext());
    router.refresh();
  }

  return (
    <main className={styles.shell}>
      <section className={styles.brandArea}>
        <a className={styles.brand} href="/">
          <span className={styles.mark}>R//C</span>
          <span className={styles.word}>Riftcore</span>
        </a>
        <div className={styles.statement}>
          <span className={styles.kicker}>RIFTCORE / USER IDENTITY</span>
          <h1>Enter your<span>competitive ID.</span></h1>
          <p>
            One Riftcore account for tournament registration, team activity,
            account recovery and — if assigned — staff operations.
          </p>
        </div>
        <span className={styles.footnote}>AUTHENTICATION / SUPABASE + RESEND</span>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelInner}>
          <span className={styles.panelKicker}>WELCOME BACK</span>
          <h2>Sign in.</h2>
          <p className={styles.panelLead}>
            Use your Riftcore account. Operator access is a role on top of this
            same identity — not a separate login.
          </p>

          <div className={styles.socials}>
            {providers.map((provider) => (
              <button
                className={styles.socialButton}
                disabled={busy !== null}
                key={provider.id}
                onClick={() => void oauth(provider.id)}
                type="button"
              >
                <span>{provider.short}</span>
                <strong>{busy === provider.id ? "Redirecting…" : provider.label}</strong>
                <b>↗</b>
              </button>
            ))}
          </div>

          <div className={styles.divider}>or use email</div>

          <form className={styles.form} onSubmit={submit}>
            <label>
              Email
              <input
                autoComplete="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                autoComplete="current-password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className={styles.primary} disabled={busy !== null} type="submit">
              <span>{busy === "email" ? "Signing in…" : "Sign in"}</span>
              <span>→</span>
            </button>
          </form>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.links}>
            <a href="/signup">Create account</a>
            <a href="/forgot-password">Forgot password?</a>
          </div>
        </div>
      </section>
    </main>
  );
}
