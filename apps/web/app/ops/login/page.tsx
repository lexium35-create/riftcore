"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getRiftcoreBrowserSupabase } from "@/lib/supabase-browser";
import styles from "../ops.module.css";

type OAuthProvider = "google" | "discord" | "github";

const socialProviders: Array<{
  id: OAuthProvider;
  label: string;
  hint: string;
}> = [
  { id: "google", label: "Continue with Google", hint: "Google" },
  { id: "discord", label: "Continue with Discord", hint: "Discord" },
  { id: "github", label: "Continue with GitHub", hint: "GitHub" },
];

export default function OperatorLoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [socialBusy, setSocialBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/ops");
    });
  }, [router, supabase]);

  async function signInWithProvider(provider: OAuthProvider) {
    setError(null);
    setSocialBusy(provider);

    const redirectTo = `${window.location.origin}/auth/callback?next=/ops`;

    const options =
      provider === "github"
        ? { redirectTo, scopes: "read:user user:email" }
        : provider === "discord"
          ? { redirectTo, scopes: "identify email" }
          : { redirectTo };

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options,
    });

    if (oauthError) {
      setError(oauthError.message);
      setSocialBusy(null);
    }
  }

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
          Authenticate with an approved identity. A valid login still requires
          an active Riftcore operator role before the control room opens.
        </p>

        <div className={styles.socialStack}>
          {socialProviders.map((provider) => (
            <button
              className={styles.socialButton}
              disabled={socialBusy !== null || submitting}
              key={provider.id}
              onClick={() => void signInWithProvider(provider.id)}
              type="button"
            >
              <span>{provider.hint}</span>
              <strong>
                {socialBusy === provider.id ? "Redirecting…" : provider.label}
              </strong>
            </button>
          ))}
        </div>

        <div className={styles.divider}>
          <span>or</span>
        </div>

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
            disabled={submitting || socialBusy !== null}
            type="submit"
          >
            {submitting ? "Authenticating…" : "Sign in with email"}
          </button>

          {error && <p className={styles.errorText}>{error}</p>}
        </form>

        <p className={styles.loginNote}>
          Authentication does not grant tournament privileges by itself.
          Operator access is controlled separately in the database.
        </p>
      </section>
    </main>
  );
}
