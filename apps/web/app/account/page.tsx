"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getRiftcoreBrowserSupabase } from "@/lib/supabase-browser";
import styles from "../user-auth.module.css";

type Profile = {
  user_id: string;
  display_name: string | null;
  created_at: string;
  welcome_email_sent_at?: string | null;
};

type Operator = {
  role: "owner" | "admin" | "referee";
  active: boolean;
};

type Identity = {
  id: string;
  provider: string;
  identity_data?: Record<string, any>;
};

type MyRegistration = {
  registration_id: string;
  tournament_slug: string;
  tournament_name: string;
  tournament_date: string;
  team_name: string;
  team_tag: string | null;
  registration_status: string;
  checked_in: boolean;
  captain_email: string;
  submitted_at: string;
};

const platformOptions = [
  { provider: "google", label: "Google" },
  { provider: "discord", label: "Discord" },
  { provider: "github", label: "GitHub" },
  { provider: "custom:telegram", label: "Telegram" },
];

function platformLabel(provider: string): string {
  return platformOptions.find((item) => item.provider === provider)?.label ?? provider;
}

export default function AccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [identityLabel, setIdentityLabel] = useState("");
  const [provider, setProvider] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [registrations, setRegistrations] = useState<MyRegistration[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login?next=/account");
        return;
      }

      const providerName = String(
        session.user.app_metadata.provider ??
          session.user.identities?.[0]?.provider ??
          "email",
      );
      const metadata = session.user.user_metadata ?? {};
      const telegramHandle = metadata.preferred_username ? `@${String(metadata.preferred_username)}` : "";
      const fallbackName = String(
        metadata.display_name ?? metadata.full_name ?? metadata.name ?? telegramHandle ?? "",
      );

      setProvider(providerName);
      setAvatarUrl(metadata.avatar_url ?? metadata.picture ?? null);
      setIdentities((session.user.identities ?? []) as Identity[]);
      setIdentityLabel(
        session.user.email ??
          (providerName === "custom:telegram"
            ? telegramHandle || fallbackName || "Telegram identity"
            : fallbackName || "Riftcore identity"),
      );

      const [{ data: profileData }, { data: operatorData }, { data: registrationData }] = await Promise.all([
        supabase.from("user_profiles").select("user_id,display_name,created_at,welcome_email_sent_at").eq("user_id", session.user.id).maybeSingle(),
        supabase.rpc("get_my_operator_profile"),
        supabase.rpc("get_my_registrations"),
      ]);

      const p = profileData as Profile | null;
      setProfile(p);
      setDisplayName(p?.display_name ?? fallbackName);
      setOperator(((operatorData ?? []) as Operator[])[0] ?? null);
      setRegistrations((registrationData ?? []) as MyRegistration[]);
      setLoading(false);
    }
    void load();
  }, [router, supabase]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.replace("/login?next=/account");

    const { error } = await supabase.from("user_profiles").upsert({
      user_id: session.user.id,
      display_name: displayName.trim() || null,
    });
    setMessage(error ? error.message : "Profile updated.");
    setSaving(false);
  }

  async function linkPlatform(providerName: string) {
    setLinking(providerName);
    setMessage(null);
    const { error } = await (supabase.auth as any).linkIdentity({
      provider: providerName,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/account`,
      },
    });
    if (error) {
      setMessage(error.message);
      setLinking(null);
    }
  }

  async function unlinkPlatform(identity: Identity) {
    if (identities.length <= 1) {
      setMessage("Keep at least one sign-in method bound to the account.");
      return;
    }
    setLinking(identity.provider);
    const { error } = await (supabase.auth as any).unlinkIdentity(identity);
    if (error) setMessage(error.message);
    else {
      setIdentities((current) => current.filter((item) => item.id !== identity.id));
      setMessage(`${platformLabel(identity.provider)} unbound.`);
    }
    setLinking(null);
  }

  async function signOut() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetch("/api/account/signout-notice", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => null);
    }
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
          <div className={styles.profileLead}>
            {avatarUrl ? <img className={styles.profileAvatar} src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : <div className={styles.profileAvatarFallback}>{(displayName || identityLabel || "R").slice(0,1).toUpperCase()}</div>}
            <div>
              <span className={styles.kicker}>RIFTCORE / USER ACCOUNT</span>
              <h1>{displayName || "Your identity"}</h1>
            </div>
          </div>
          <aside className={styles.identityCard}>
            <span>AUTHENTICATED AS</span>
            <strong>{identityLabel}</strong>
            <small>{platformLabel(provider).toUpperCase()} · {operator ? operator.role.toUpperCase() : "USER"}</small>
          </aside>
        </section>

        <section className={styles.accountGrid}>
          <article className={styles.accountCard}>
            <span>PROFILE / 01</span>
            <h2>Public identity</h2>
            <p>Your Riftcore profile follows you across tournaments. Tournament roster identities stay event-specific.</p>
            <form className={styles.form} onSubmit={saveProfile}>
              <label>Display name<input minLength={2} maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
              <button className={styles.primary} disabled={saving} type="submit"><span>{saving ? "Saving…" : "Save profile"}</span><span>→</span></button>
            </form>
            {message && <p className={styles.message}>{message}</p>}
          </article>

          <aside className={styles.accountCard}>
            <span>QUICK ACTIONS / 02</span>
            <h2>Riftcore access</h2>
            <div className={styles.actionList}>
              <a className={styles.actionLink} href="/register"><span>Register a team</span><b>→</b></a>
              <a className={styles.actionLink} href="/tournament/riftcore-2026-10-13"><span>View current tournament</span><b>→</b></a>
              {operator && <a className={`${styles.actionLink} ${styles.operatorLink}`} href="/ops"><span>Open operator console</span><b>→</b></a>}
            </div>
          </aside>
        </section>

        <section className={styles.fullCard}>
          <span>BOUND PLATFORMS / 03</span>
          <div className={styles.sectionHead}>
            <div><h2>Sign in anywhere. Stay one account.</h2><p>Bind other platforms to this Riftcore identity instead of creating separate accounts.</p></div>
            <strong>{identities.length} BOUND</strong>
          </div>
          <div className={styles.platformGrid}>
            {platformOptions.map((option) => {
              const bound = identities.find((identity) => identity.provider === option.provider);
              const detail = bound?.identity_data?.email ?? bound?.identity_data?.preferred_username ?? bound?.identity_data?.user_name ?? bound?.identity_data?.name;
              return (
                <article className={styles.platformCard} key={option.provider}>
                  <div><span>{option.label}</span><small>{bound ? (detail ? String(detail) : "Connected") : "Not bound"}</small></div>
                  {bound ? (
                    <button disabled={linking !== null || identities.length <= 1} onClick={() => void unlinkPlatform(bound)}>{identities.length <= 1 ? "Primary" : "Unbind"}</button>
                  ) : (
                    <button disabled={linking !== null} onClick={() => void linkPlatform(option.provider)}>{linking === option.provider ? "Opening…" : "Bind"}</button>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.fullCard}>
          <span>TOURNAMENT ACTIVITY / 04</span>
          <div className={styles.sectionHead}>
            <div><h2>Your registrations</h2><p>This is account history across tournaments; the current event is simply the first operation.</p></div>
            <strong>{registrations.length} ENTRIES</strong>
          </div>
          {registrations.length === 0 ? (
            <div className={styles.emptyState}>No team registrations are attached to this account yet.</div>
          ) : (
            <div className={styles.registrationHistory}>
              {registrations.map((entry) => (
                <a key={entry.registration_id} href={`/tournament/${entry.tournament_slug}`} className={styles.registrationHistoryRow}>
                  <div><strong>{entry.team_name}</strong><span>{entry.tournament_name}</span></div>
                  <div><span>{new Date(entry.tournament_date).toLocaleDateString()}</span><b>{entry.registration_status.toUpperCase()}</b><small>{entry.checked_in ? "CHECKED IN" : "NOT CHECKED IN"}</small></div>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
