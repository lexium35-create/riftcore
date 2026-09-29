"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getRiftcoreBrowserSupabase } from "@/lib/supabase-browser";
import styles from "../user-auth.module.css";

type Profile = {
  user_id: string;
  display_name: string | null;
  created_at: string;
};

type Operator = {
  role: "owner" | "admin" | "referee";
  active: boolean;
};

export default function AccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login?next=/account");
        return;
      }

      setEmail(session.user.email ?? "");
      setProvider(
        String(session.user.app_metadata.provider ?? session.user.identities?.[0]?.provider ?? "email"),
      );

      const [{ data: profileData }, { data: operatorData }] = await Promise.all([
        supabase.from("user_profiles").select("user_id,display_name,created_at").eq("user_id", session.user.id).maybeSingle(),
        supabase.rpc("get_my_operator_profile"),
      ]);

      const p = profileData as Profile | null;
      setProfile(p);
      setDisplayName(p?.display_name ?? String(session.user.user_metadata.display_name ?? session.user.user_metadata.full_name ?? ""));
      setOperator(((operatorData ?? []) as Operator[])[0] ?? null);
      setLoading(false);
    }
    void load();
  }, [router, supabase]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from("user_profiles").upsert({
      user_id: session.user.id,
      display_name: displayName.trim() || null,
    });

    if (error) setMessage(error.message);
    else setMessage("Profile updated.");
    setSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return <main className={styles.accountShell}><div className={styles.accountWrap}><p className={styles.kicker}>RIFTCORE / ACCOUNT</p><h1>Loading identity…</h1></div></main>;
  }

  return (
    <main className={styles.accountShell}>
      <div className={styles.accountWrap}>
        <nav className={styles.accountNav}>
          <a className={styles.brand} href="/"><span className={styles.mark}>R//C</span><span className={styles.word}>Riftcore</span></a>
          <div className={styles.navLinks}>
            <a href="/tournament/riftcore-2026-10-13">Tournament</a>
            <a href="/register">Register</a>
            <button onClick={() => void signOut()}>Sign out</button>
          </div>
        </nav>

        <section className={styles.accountHero}>
          <div>
            <span className={styles.kicker}>RIFTCORE / USER ACCOUNT</span>
            <h1>{displayName || "Your identity"}</h1>
          </div>
          <aside className={styles.identityCard}>
            <span>AUTHENTICATED AS</span>
            <strong>{email}</strong>
            <small>{provider.toUpperCase()} · {operator ? operator.role.toUpperCase() : "USER"}</small>
          </aside>
        </section>

        <section className={styles.accountGrid}>
          <article className={styles.accountCard}>
            <span>PROFILE / 01</span>
            <h2>Public identity</h2>
            <p>Your display name is used across Riftcore account surfaces. Tournament roster names remain separate in-game identities.</p>
            <form className={styles.form} onSubmit={saveProfile}>
              <label>
                Display name
                <input
                  minLength={2}
                  maxLength={40}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <button className={styles.primary} disabled={saving} type="submit">
                <span>{saving ? "Saving…" : "Save profile"}</span>
                <span>→</span>
              </button>
            </form>
            {message && <p className={styles.message}>{message}</p>}
          </article>

          <aside className={styles.accountCard}>
            <span>QUICK ACTIONS / 02</span>
            <h2>Riftcore access</h2>
            <div className={styles.actionList}>
              <a className={styles.actionLink} href="/register"><span>Register a team</span><b>→</b></a>
              <a className={styles.actionLink} href="/tournament/riftcore-2026-10-13"><span>View tournament</span><b>→</b></a>
              {operator && (
                <a className={`${styles.actionLink} ${styles.operatorLink}`} href="/ops">
                  <span>Open operator console</span><b>→</b>
                </a>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
