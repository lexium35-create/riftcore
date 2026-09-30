"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BrandIcon, { type BrandName } from "@/components/BrandIcon";
import { getRiftcoreBrowserSupabase } from "@/lib/supabase-browser";
import styles from "../user-auth.module.css";

type OAuthProvider = "google" | "discord" | "github" | "custom:telegram";

const providers: Array<{
  id: OAuthProvider;
  label: string;
  detail: string;
  brand: BrandName;
  scopes?: string;
}> = [
  { id: "google", label: "Continue with Google", detail: "GOOGLE IDENTITY", brand: "google" },
  { id: "discord", label: "Continue with Discord", detail: "DISCORD", brand: "discord", scopes: "identify email" },
  { id: "github", label: "Continue with GitHub", detail: "GITHUB", brand: "github", scopes: "read:user user:email" },
  { id: "custom:telegram", label: "Continue with Telegram", detail: "TELEGRAM", brand: "telegram" },
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
        <div className={styles.authBackdrop} />
        <a className={styles.brand} href="/">
          <span className={styles.mark}>R//C</span>
          <span className={styles.word}>Riftcore</span>
        </a>

        <div className={styles.authSignal}>
          <i />
          <span>IDENTITY GATE // ONLINE</span>
          <b>RIFTCORE ID</b>
        </div>

        <div className={styles.statement}>
          <span className={styles.kicker}>ONE ACCOUNT / EVERY OPERATION</span>
          <h1>ENTER THE<span>CONTROL LAYER.</span></h1>
          <p>
            Your Riftcore identity follows tournament registrations, bound
            platforms, match activity and staff permissions without splitting
            you into separate accounts.
          </p>
        </div>

        <div className={styles.authStatRail}>
          <div><span>EVENT</span><strong>#001</strong></div>
          <div><span>GAME</span><strong>MLBB</strong></div>
          <div><span>DATE</span><strong>13 OCT</strong></div>
          <div><span>REGION</span><strong>INDIA</strong></div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelInner}>
          <div className={styles.authPanelHeader}>
            <div><span className={styles.panelKicker}>RIFTCORE / SIGN IN</span><small>SECURE SESSION</small></div>
            <b>01</b>
          </div>

          <h2>Welcome back.</h2>
          <p className={styles.panelLead}>
            Continue with a bound platform or use your Riftcore email identity.
          </p>

          <div className={styles.socials}>
            {providers.map((provider) => (
              <button
                className={styles.socialButton}
                data-provider={provider.id}
                disabled={busy !== null}
                key={provider.id}
                onClick={() => void oauth(provider.id)}
                type="button"
              >
                <span className={styles.providerIcon}>
                  <BrandIcon brand={provider.brand} size={21} />
                </span>
                <span className={styles.providerCopy}>
                  <small>{provider.detail}</small>
                  <strong>{busy === provider.id ? "Redirecting…" : provider.label}</strong>
                </span>
                <b>↗</b>
              </button>
            ))}
          </div>

          <div className={styles.divider}>RIFTCORE EMAIL</div>

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
              <span>{busy === "email" ? "Signing in…" : "Enter Riftcore"}</span>
              <span>→</span>
            </button>
          </form>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.links}>
            <a href="/signup">Create Riftcore ID</a>
            <a href="/forgot-password">Recover access</a>
          </div>

          <div className={styles.authTrustLine}>
            <span>AUTH / SUPABASE</span>
            <span>MAIL / RESEND</span>
            <span>SESSION / ENCRYPTED</span>
          </div>
        </div>
      </section>
    </main>
  );
}
