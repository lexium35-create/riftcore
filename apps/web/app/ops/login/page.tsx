"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getRiftcoreBrowserSupabase } from "@/lib/supabase-browser";
import styles from "../ops.module.css";

export default function OperatorLoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/ops");
    });
  }, [router, supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    router.replace("/ops");
    router.refresh();
  }

  return (
    <main className={styles.loginShell}>
      <a className={styles.backlink} href="/">
        ← Riftcore
      </a>

      <section className={styles.loginPanel}>
        <p className={styles.eyebrow}>RIFTCORE / STAFF ACCESS</p>
        <h1>Operator login.</h1>
        <p className={styles.lede}>
          Restricted tournament operations. Public team registration does not
          use this account.
        </p>

        <form className={styles.loginForm} onSubmit={submit}>
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

          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button
            className={styles.primaryButton}
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Authenticating…" : "Enter control room"}
          </button>

          {error && <p className={styles.errorText}>{error}</p>}
        </form>

        <p className={styles.loginNote}>
          Operator accounts are provisioned explicitly. There is no public
          staff signup route.
        </p>
      </section>
    </main>
  );
}
