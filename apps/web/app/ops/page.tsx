"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getRiftcoreBrowserSupabase } from "@/lib/supabase-browser";
import styles from "./ops.module.css";

const TOURNAMENT_SLUG = "riftcore-2026-10-13";

type OperatorRole = "owner" | "admin" | "referee";
type RegistrationStatus = "pending" | "verified" | "rejected" | "withdrawn";

type OperatorProfile = {
  user_id: string;
  display_name: string | null;
  role: OperatorRole;
  active: boolean;
};

type RegistrationPlayer = {
  id: string;
  ign: string;
  mlbbId: string;
  serverId: string;
  rosterRole: "starter" | "substitute";
  isCaptain: boolean;
};

type RegistrationRow = {
  registration_id: string;
  team_name: string;
  team_tag: string | null;
  captain_contact: string;
  registration_status: RegistrationStatus;
  checked_in: boolean;
  submitted_at: string;
  players: RegistrationPlayer[];
};

export default function OpsPage() {
  const router = useRouter();
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const loadRegistrations = useCallback(async () => {
    const { data, error: listError } = await supabase.rpc(
      "list_tournament_registrations",
      { p_tournament_slug: TOURNAMENT_SLUG },
    );

    if (listError) throw new Error(listError.message);
    setRegistrations((data ?? []) as RegistrationRow[]);
  }, [supabase]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/ops/login");
      return;
    }

    const { data, error: profileError } = await supabase.rpc(
      "get_my_operator_profile",
    );

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const operator = ((data ?? []) as OperatorProfile[])[0];

    if (!operator) {
      setUnauthorized(true);
      setLoading(false);
      return;
    }

    setProfile(operator);

    try {
      await loadRegistrations();
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load registrations.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadRegistrations, router, supabase]);

  useEffect(() => {
    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/ops/login");
    });

    return () => subscription.unsubscribe();
  }, [bootstrap, router, supabase]);

  const summary = useMemo(
    () => ({
      total: registrations.length,
      pending: registrations.filter(
        (registration) => registration.registration_status === "pending",
      ).length,
      verified: registrations.filter(
        (registration) => registration.registration_status === "verified",
      ).length,
      checkedIn: registrations.filter((registration) => registration.checked_in)
        .length,
    }),
    [registrations],
  );

  const canReview = profile?.role === "owner" || profile?.role === "admin";
  const canCheckIn =
    profile?.role === "owner" ||
    profile?.role === "admin" ||
    profile?.role === "referee";

  async function changeStatus(
    registrationId: string,
    status: RegistrationStatus,
  ) {
    setBusyKey(`${registrationId}:status`);
    setError(null);

    const { error: mutationError } = await supabase.rpc(
      "set_registration_status",
      {
        p_registration_id: registrationId,
        p_status: status,
      },
    );

    if (mutationError) {
      setError(mutationError.message);
      setBusyKey(null);
      return;
    }

    try {
      await loadRegistrations();
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to refresh registrations.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function changeCheckIn(
    registrationId: string,
    checkedIn: boolean,
  ) {
    setBusyKey(`${registrationId}:checkin`);
    setError(null);

    const { error: mutationError } = await supabase.rpc(
      "set_registration_check_in",
      {
        p_registration_id: registrationId,
        p_checked_in: checkedIn,
      },
    );

    if (mutationError) {
      setError(mutationError.message);
      setBusyKey(null);
      return;
    }

    try {
      await loadRegistrations();
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to refresh registrations.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/ops/login");
  }

  if (loading) {
    return (
      <main className={styles.shell}>
        <p className={styles.eyebrow}>RIFTCORE / CONTROL ROOM</p>
        <h1>Authenticating.</h1>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className={styles.shell}>
        <p className={styles.eyebrow}>RIFTCORE / ACCESS DENIED</p>
        <h1>Not an operator.</h1>
        <p className={styles.lede}>
          This Supabase account is authenticated, but it does not have an
          active Riftcore operator role.
        </p>
        <button className={styles.secondaryButton} onClick={signOut}>
          Sign out
        </button>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div>
          <p className={styles.eyebrow}>RIFTCORE / CONTROL ROOM</p>
          <h1>Operations.</h1>
        </div>
        <div className={styles.operator}>
          <span>{profile?.display_name || "Operator"}</span>
          <strong>{profile?.role}</strong>
          <button className={styles.textButton} onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className={styles.metrics}>
        <article>
          <span>Total teams</span>
          <strong>{summary.total}</strong>
        </article>
        <article>
          <span>Pending review</span>
          <strong>{summary.pending}</strong>
        </article>
        <article>
          <span>Verified</span>
          <strong>{summary.verified}</strong>
        </article>
        <article>
          <span>Checked in</span>
          <strong>{summary.checkedIn}</strong>
        </article>
      </section>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.sectionHeading}>
        <div>
          <span>13 OCTOBER 2026</span>
          <h2>Registration desk</h2>
        </div>
        <button
          className={styles.secondaryButton}
          onClick={() => void loadRegistrations()}
        >
          Refresh
        </button>
      </section>

      <section className={styles.registrationList}>
        {registrations.length === 0 ? (
          <div className={styles.empty}>
            <strong>No team registrations yet.</strong>
            <span>New submissions will appear here from Supabase.</span>
          </div>
        ) : (
          registrations.map((registration) => {
            const statusBusy =
              busyKey === `${registration.registration_id}:status`;
            const checkInBusy =
              busyKey === `${registration.registration_id}:checkin`;

            return (
              <article
                className={styles.registration}
                key={registration.registration_id}
              >
                <div className={styles.registrationHead}>
                  <div>
                    <span className={styles.tag}>
                      {registration.team_tag || "TEAM"}
                    </span>
                    <h3>{registration.team_name}</h3>
                    <p>
                      Captain contact: <strong>{registration.captain_contact}</strong>
                    </p>
                  </div>
                  <div className={styles.statusStack}>
                    <span
                      className={`${styles.status} ${styles[registration.registration_status]}`}
                    >
                      {registration.registration_status}
                    </span>
                    {registration.checked_in && (
                      <span className={styles.checkBadge}>checked in</span>
                    )}
                  </div>
                </div>

                <div className={styles.roster}>
                  {registration.players.map((player) => (
                    <div className={styles.player} key={player.id}>
                      <span>
                        {player.rosterRole === "substitute" ? "SUB" : "STARTER"}
                      </span>
                      <strong>
                        {player.ign}
                        {player.isCaptain ? " · C" : ""}
                      </strong>
                      <small>
                        {player.mlbbId} ({player.serverId})
                      </small>
                    </div>
                  ))}
                </div>

                <div className={styles.actions}>
                  {canReview &&
                    registration.registration_status === "pending" && (
                      <>
                        <button
                          className={styles.primaryButton}
                          disabled={statusBusy}
                          onClick={() =>
                            void changeStatus(
                              registration.registration_id,
                              "verified",
                            )
                          }
                        >
                          Verify team
                        </button>
                        <button
                          className={styles.dangerButton}
                          disabled={statusBusy}
                          onClick={() =>
                            void changeStatus(
                              registration.registration_id,
                              "rejected",
                            )
                          }
                        >
                          Reject
                        </button>
                      </>
                    )}

                  {canReview &&
                    (registration.registration_status === "rejected" ||
                      registration.registration_status === "withdrawn") && (
                      <button
                        className={styles.secondaryButton}
                        disabled={statusBusy}
                        onClick={() =>
                          void changeStatus(
                            registration.registration_id,
                            "pending",
                          )
                        }
                      >
                        Reopen review
                      </button>
                    )}

                  {canReview &&
                    registration.registration_status === "verified" && (
                      <button
                        className={styles.secondaryButton}
                        disabled={statusBusy}
                        onClick={() =>
                          void changeStatus(
                            registration.registration_id,
                            "pending",
                          )
                        }
                      >
                        Return to review
                      </button>
                    )}

                  {canCheckIn &&
                    registration.registration_status === "verified" && (
                      <button
                        className={
                          registration.checked_in
                            ? styles.secondaryButton
                            : styles.primaryButton
                        }
                        disabled={checkInBusy}
                        onClick={() =>
                          void changeCheckIn(
                            registration.registration_id,
                            !registration.checked_in,
                          )
                        }
                      >
                        {registration.checked_in
                          ? "Undo check-in"
                          : "Check in team"}
                      </button>
                    )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
