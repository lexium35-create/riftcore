"use client";

import { FormEvent, useMemo, useState } from "react";
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

export default function SignupPage() {
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function oauth(provider: OAuthProvider) {
    setError(null);
    setMessage(null);
    setBusy(provider);
    const selected = providers.find((item) => item.id === provider);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/account`,
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
    setMessage(null);

    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/account`,
      },
    });

    if (authError) {
      setError(authError.message);
      setBusy(null);
      return;
    }

    if (data.session) {
      window.location.assign("/account");
      return;
    }

    setMessage("Riftcore ID created. Verify the email we sent, then sign in.");
    setBusy(null);
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
          <span>NEW IDENTITY // READY</span>
          <b>RIFTCORE ID</b>
        </div>

        <div className={styles.statement}>
          <span className={styles.kicker}>BUILD YOUR COMPETITIVE IDENTITY</span>
          <h1>ONE ID.<span>EVERY EVENT.</span></h1>
          <p>
            Tournament entries stay event-specific. Your account does not.
            Build one identity, bind your platforms and carry it forward.
          </p>
        </div>

        <div className={styles.authStatRail}>
          <div><span>PROFILE</span><strong>PERSISTENT</strong></div>
          <div><span>PLATFORMS</span><strong>BOUND</strong></div>
          <div><span>ROSTERS</span><strong>EVENT-SPECIFIC</strong></div>
          <div><span>RECOVERY</span><strong>EMAIL</strong></div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelInner}>
          <div className={styles.authPanelHeader}>
            <div><span className={styles.panelKicker}>RIFTCORE / CREATE ID</span><small>NEW PLAYER IDENTITY</small></div>
            <b>00</b>
          </div>

          <h2>Join Riftcore.</h2>
          <p className={styles.panelLead}>Use a platform identity or create a Riftcore email login.</p>

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
                <span className={styles.providerIcon}><BrandIcon brand={provider.brand} size={21} /></span>
                <span className={styles.providerCopy}>
                  <small>{provider.detail}</small>
                  <strong>{busy === provider.id ? "Opening…" : provider.label}</strong>
                </span>
                <b>↗</b>
              </button>
            ))}
          </div>

          <div className={styles.divider}>OR CREATE WITH EMAIL</div>

          <form className={styles.form} onSubmit={submit}>
            <label>
              Display name
              <input autoComplete="name" required minLength={2} maxLength={40} placeholder="Your Riftcore name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label>
              Email
              <input autoComplete="email" type="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Password
              <input autoComplete="new-password" type="password" required minLength={8} placeholder="Minimum 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button className={styles.primary} disabled={busy !== null} type="submit">
              <span>{busy === "email" ? "Creating…" : "Create Riftcore ID"}</span>
              <span>→</span>
            </button>
          </form>

          {message && <p className={styles.message}>{message}</p>}
          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.links}><a href="/login">Already have an identity?</a></div>

          <div className={styles.authTrustLine}>
            <span>AUTH / SUPABASE</span>
            <span>MAIL / RESEND</span>
            <span>PROFILE / PORTABLE</span>
          </div>
        </div>
      </section>
    </main>
  );
}
