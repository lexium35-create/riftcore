"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getRiftcoreBrowserSupabase } from "@/lib/supabase-browser";
import styles from "../user-auth.module.css";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
  }, [supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }
    router.replace("/account");
    router.refresh();
  }

  return (
    <main className={styles.shell}>
      <section className={styles.brandArea}>
        <a className={styles.brand} href="/"><span className={styles.mark}>R//C</span><span className={styles.word}>Riftcore</span></a>
        <div className={styles.statement}>
          <span className={styles.kicker}>RIFTCORE / RECOVERY SESSION</span>
          <h1>Set a new<span>password.</span></h1>
          <p>This page only accepts an active recovery session from your email link.</p>
        </div>
        <span className={styles.footnote}>AUTH SESSION / PASSWORD UPDATE</span>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelInner}>
          <span className={styles.panelKicker}>NEW CREDENTIAL</span>
          <h2>Choose password.</h2>
          {ready ? (
            <form className={styles.form} onSubmit={submit} style={{ marginTop: 28 }}>
              <label>
                New password
                <input
                  autoComplete="new-password"
                  type="password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button className={styles.primary} disabled={busy} type="submit">
                <span>{busy ? "Updating…" : "Update password"}</span>
                <span>→</span>
              </button>
            </form>
          ) : (
            <p className={styles.error}>No recovery session found. Open this page from the password-reset email.</p>
          )}
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </section>
    </main>
  );
}
