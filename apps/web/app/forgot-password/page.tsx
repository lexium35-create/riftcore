"use client";

import { FormEvent, useMemo, useState } from "react";
import { getRiftcoreBrowserSupabase } from "@/lib/supabase-browser";
import styles from "../user-auth.module.css";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` },
    );

    if (resetError) setError(resetError.message);
    else setMessage("If that address has a Riftcore account, a recovery email has been sent.");
    setBusy(false);
  }

  return (
    <main className={styles.shell}>
      <section className={styles.brandArea}>
        <a className={styles.brand} href="/"><span className={styles.mark}>R//C</span><span className={styles.word}>Riftcore</span></a>
        <div className={styles.statement}>
          <span className={styles.kicker}>RIFTCORE / ACCOUNT RECOVERY</span>
          <h1>Recover your<span>identity.</span></h1>
          <p>Reset links are delivered through Riftcore’s verified Recharza mail domain.</p>
        </div>
        <span className={styles.footnote}>SECURE RECOVERY / SINGLE-USE FLOW</span>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelInner}>
          <span className={styles.panelKicker}>RECOVERY</span>
          <h2>Reset password.</h2>
          <p className={styles.panelLead}>Enter the email attached to your Riftcore account.</p>

          <form className={styles.form} onSubmit={submit} style={{ marginTop: 28 }}>
            <label>
              Email
              <input
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button className={styles.primary} disabled={busy} type="submit">
              <span>{busy ? "Sending…" : "Send recovery email"}</span>
              <span>→</span>
            </button>
          </form>

          {message && <p className={styles.message}>{message}</p>}
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.links}><a href="/login">Back to sign in</a></div>
        </div>
      </section>
    </main>
  );
}
