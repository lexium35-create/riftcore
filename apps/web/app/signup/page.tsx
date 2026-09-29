"use client";

import { FormEvent, useMemo, useState } from "react";
import { getRiftcoreBrowserSupabase } from "@/lib/supabase-browser";
import styles from "../user-auth.module.css";

export default function SignupPage() {
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
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
      setBusy(false);
      return;
    }

    if (data.session) {
      window.location.assign("/account");
      return;
    }

    setMessage("Account created. Check your email to verify the address, then sign in.");
    setBusy(false);
  }

  return (
    <main className={styles.shell}>
      <section className={styles.brandArea}>
        <a className={styles.brand} href="/">
          <span className={styles.mark}>R//C</span>
          <span className={styles.word}>Riftcore</span>
        </a>
        <div className={styles.statement}>
          <span className={styles.kicker}>RIFTCORE / NEW IDENTITY</span>
          <h1>Create your<span>Riftcore ID.</span></h1>
          <p>
            Your account becomes the persistent identity behind tournament
            participation, recovery and future team features.
          </p>
        </div>
        <span className={styles.footnote}>EMAIL VERIFICATION / RECHARZA.IN DELIVERY</span>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelInner}>
          <span className={styles.panelKicker}>NEW ACCOUNT</span>
          <h2>Join Riftcore.</h2>
          <p className={styles.panelLead}>Create one account and keep the same identity across Riftcore.</p>

          <form className={styles.form} onSubmit={submit} style={{ marginTop: 28 }}>
            <label>
              Display name
              <input
                autoComplete="name"
                required
                minLength={2}
                maxLength={40}
                placeholder="Your Riftcore name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
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
                autoComplete="new-password"
                type="password"
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className={styles.primary} disabled={busy} type="submit">
              <span>{busy ? "Creating account…" : "Create account"}</span>
              <span>→</span>
            </button>
          </form>

          {message && <p className={styles.message}>{message}</p>}
          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.links}>
            <a href="/login">Already have an account?</a>
          </div>
        </div>
      </section>
    </main>
  );
}
