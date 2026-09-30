"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  recommendFastFormat,
  type SwissStanding,
  type TournamentEngineEntry,
  type TournamentEngineMatch,
} from "@riftcore/tournament-core";
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
  email?: string | null;
  rosterRole: "starter" | "substitute";
  isCaptain: boolean;
};

type RegistrationRow = {
  registration_id: string;
  team_name: string;
  team_tag: string | null;
  captain_contact: string;
  captain_email?: string | null;
  registration_status: RegistrationStatus;
  checked_in: boolean;
  submitted_at: string;
  players: RegistrationPlayer[];
};

type EngineFormat = {
  priority: "fast";
  mode: "fast_swiss" | "single_elimination";
  swissRounds: number;
  playoffCut: number;
  swissBestOf: number;
  playoffBestOf: number;
  grandFinalBestOf: number;
  maxConcurrentMatches: number;
  estimatedMinutes: number;
  lockedTeamCount: number;
};

type EngineState = {
  format: EngineFormat | null;
  entries: TournamentEngineEntry[];
  matches: TournamentEngineMatch[];
  standings: SwissStanding[];
};

type FinanceState = {
  basePrizePool: number;
  joinFee: number;
  activeRegistrations: number;
  registrationContribution: number;
  donationTotal: number;
  donationCount: number;
  currentPrizePool: number;
  projectedMaxPrizePool: number | null;
};

function duration(minutes: number): string {
  if (!minutes) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function stageName(match: TournamentEngineMatch): string {
  if (match.stage === "swiss") return `Swiss R${match.roundNumber}`;
  if (match.stage === "semifinal") return "Top 4 · Semifinal";
  if (match.stage === "final") return "Grand Final";
  return `Elimination R${match.roundNumber}`;
}

export default function OpsPage() {
  const router = useRouter();
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [engine, setEngine] = useState<EngineState>({
    format: null,
    entries: [],
    matches: [],
    standings: [],
  });
  const [finance, setFinance] = useState<FinanceState | null>(null);
  const [donationAmount, setDonationAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const sessionToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login?next=/ops");
      return null;
    }
    return session.access_token;
  }, [router, supabase]);

  const loadRegistrations = useCallback(async () => {
    const { data, error: listError } = await supabase.rpc(
      "list_tournament_registrations",
      { p_tournament_slug: TOURNAMENT_SLUG },
    );
    if (listError) throw new Error(listError.message);
    setRegistrations((data ?? []) as RegistrationRow[]);
  }, [supabase]);

  const loadEngine = useCallback(async () => {
    const token = await sessionToken();
    if (!token) return;
    const response = await fetch(
      `/api/ops/tournament/${TOURNAMENT_SLUG}/engine`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Unable to load tournament engine.");
    setEngine(payload as EngineState);
  }, [sessionToken]);

  const loadFinance = useCallback(async () => {
    const response = await fetch(
      `/api/tournaments/${TOURNAMENT_SLUG}/finance`,
      { cache: "no-store" },
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Unable to load tournament finance.");
    setFinance(payload as FinanceState);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadRegistrations(), loadEngine(), loadFinance()]);
  }, [loadEngine, loadFinance, loadRegistrations]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login?next=/ops");
      return;
    }

    const { data, error: profileError } = await supabase.rpc("get_my_operator_profile");
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
      await refreshAll();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load operations.");
    } finally {
      setLoading(false);
    }
  }, [refreshAll, router, supabase]);

  useEffect(() => {
    void bootstrap();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login?next=/ops");
    });
    return () => subscription.unsubscribe();
  }, [bootstrap, router, supabase]);

  const summary = useMemo(() => ({
    total: registrations.length,
    pending: registrations.filter((item) => item.registration_status === "pending").length,
    verified: registrations.filter((item) => item.registration_status === "verified").length,
    checkedIn: registrations.filter((item) => item.checked_in).length,
  }), [registrations]);

  const preview = useMemo(
    () => recommendFastFormat(summary.verified, 8),
    [summary.verified],
  );

  const canReview = profile?.role === "owner" || profile?.role === "admin";
  const canCheckIn = Boolean(profile);
  const swissMatches = engine.matches.filter((match) => match.stage === "swiss");
  const currentSwissRound = swissMatches.reduce(
    (max, match) => Math.max(max, match.roundNumber),
    0,
  );
  const currentSwissMatches = swissMatches.filter(
    (match) => match.roundNumber === currentSwissRound,
  );
  const currentSwissComplete =
    currentSwissMatches.length > 0 &&
    currentSwissMatches.every((match) => match.status === "final");
  const swissComplete =
    Boolean(engine.format?.mode === "fast_swiss") &&
    currentSwissRound >= (engine.format?.swissRounds ?? 0) &&
    swissMatches.length > 0 &&
    swissMatches.every((match) => match.status === "final");
  const playoffsExist = engine.matches.some(
    (match) => match.stage === "semifinal" || match.stage === "final",
  );

  const eliminationMatches = engine.matches.filter(
    (match) => match.stage === "single_elimination",
  );
  const currentEliminationRound = eliminationMatches.reduce(
    (max, match) => Math.max(max, match.roundNumber),
    0,
  );
  const currentElimination = eliminationMatches.filter(
    (match) => match.roundNumber === currentEliminationRound,
  );
  const eliminationRoundComplete =
    currentElimination.length > 0 &&
    currentElimination.every((match) => match.status === "final");

  const groupedMatches = useMemo(() => {
    const groups = new Map<string, TournamentEngineMatch[]>();
    for (const match of engine.matches) {
      const key = `${match.stage}:${match.roundNumber}`;
      groups.set(key, [...(groups.get(key) ?? []), match]);
    }
    return [...groups.values()];
  }, [engine.matches]);

  async function engineAction(action: "start" | "next_round" | "create_playoffs") {
    setBusyKey(`engine:${action}`);
    setError(null);
    const token = await sessionToken();
    if (!token) return;

    const response = await fetch(
      `/api/ops/tournament/${TOURNAMENT_SLUG}/engine`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          maxConcurrentMatches: 8,
        }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "Tournament action failed.");
      setBusyKey(null);
      return;
    }
    await refreshAll();
    setBusyKey(null);
  }

  async function recordResult(
    match: TournamentEngineMatch,
    teamAScore: number,
    teamBScore: number,
  ) {
    if (!match.id) return;
    setBusyKey(`match:${match.id}`);
    setError(null);
    const token = await sessionToken();
    if (!token) return;

    const response = await fetch(
      `/api/ops/tournament/${TOURNAMENT_SLUG}/matches/${match.id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teamAScore, teamBScore }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error ?? "Unable to record result.");
    else await refreshAll();
    setBusyKey(null);
  }

  async function changeStatus(registrationId: string, status: RegistrationStatus) {
    setBusyKey(`${registrationId}:status`);
    setError(null);
    const token = await sessionToken();
    if (!token) return;
    const response = await fetch(`/api/ops/registrations/${registrationId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error ?? "Unable to change registration status.");
    else await refreshAll();
    setBusyKey(null);
  }

  async function changeCheckIn(registrationId: string, checkedIn: boolean) {
    setBusyKey(`${registrationId}:checkin`);
    setError(null);
    const token = await sessionToken();
    if (!token) return;
    const response = await fetch(`/api/ops/registrations/${registrationId}/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ checkedIn }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error ?? "Unable to change check-in state.");
    else await refreshAll();
    setBusyKey(null);
  }

  async function recordDonation() {
    const amount = Number.parseInt(donationAmount, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Enter a valid donation amount in INR.");
      return;
    }

    setBusyKey("finance:donation");
    setError(null);
    const token = await sessionToken();
    if (!token) return;

    const response = await fetch(
      `/api/ops/tournament/${TOURNAMENT_SLUG}/donations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amountInr: amount,
          donorName: donorName || undefined,
        }),
      },
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error ?? "Unable to record donation.");
      setBusyKey(null);
      return;
    }

    setDonationAmount("");
    setDonorName("");
    await refreshAll();
    setBusyKey(null);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return <main className={styles.shell}><p className={styles.eyebrow}>RIFTCORE / CONTROL ROOM</p><h1>Authenticating.</h1></main>;
  }

  if (unauthorized) {
    return (
      <main className={styles.shell}>
        <p className={styles.eyebrow}>RIFTCORE / ACCESS DENIED</p>
        <h1>Not an operator.</h1>
        <p className={styles.lede}>This account is signed in, but it does not have an active Riftcore operator role.</p>
        <button className={styles.secondaryButton} onClick={signOut}>Sign out</button>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div><p className={styles.eyebrow}>RIFTCORE / CONTROL ROOM</p><h1>Operations.</h1></div>
        <div className={styles.operator}>
          <span>{profile?.display_name || "Operator"}</span>
          <strong>{profile?.role}</strong>
          <button className={styles.textButton} onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className={styles.metrics}>
        <article><span>Total teams</span><strong>{summary.total}</strong></article>
        <article><span>Verified</span><strong>{summary.verified}</strong></article>
        <article><span>Checked in</span><strong>{summary.checkedIn}</strong></article>
        <article><span>Engine</span><strong className={styles.metricWord}>{engine.format ? "LIVE" : "PREP"}</strong></article>
      </section>

      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.financePanel}>
        <div className={styles.financeSummary}>
          <div>
            <span>TOURNAMENT #001 / PRIZE POOL</span>
            <h2>₹{(finance?.currentPrizePool ?? 2000).toLocaleString("en-IN")}</h2>
            <p>
              ₹{(finance?.basePrizePool ?? 2000).toLocaleString("en-IN")} base
              + ₹{(finance?.joinFee ?? 250).toLocaleString("en-IN")} per active team
              + verified donations.
            </p>
          </div>
          <div className={styles.financeStats}>
            <div><span>TEAM FEES</span><strong>₹{(finance?.registrationContribution ?? 0).toLocaleString("en-IN")}</strong></div>
            <div><span>DONATIONS</span><strong>₹{(finance?.donationTotal ?? 0).toLocaleString("en-IN")}</strong></div>
            <div><span>ACTIVE ENTRIES</span><strong>{finance?.activeRegistrations ?? 0}</strong></div>
            <div><span>ENTRY FEE</span><strong>₹{(finance?.joinFee ?? 250).toLocaleString("en-IN")}</strong></div>
          </div>
        </div>

        {canReview && (
          <div className={styles.donationRecorder}>
            <label>
              <span>DONATION AMOUNT (INR)</span>
              <input
                inputMode="numeric"
                value={donationAmount}
                onChange={(event) => setDonationAmount(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="500"
              />
            </label>
            <label>
              <span>DONOR NAME (OPTIONAL)</span>
              <input
                value={donorName}
                onChange={(event) => setDonorName(event.target.value)}
                placeholder="Community member"
              />
            </label>
            <button
              className={styles.primaryButton}
              disabled={busyKey !== null}
              onClick={() => void recordDonation()}
            >
              Add verified donation
            </button>
          </div>
        )}
      </section>

      <section className={styles.enginePanel}>
        <div className={styles.engineIntro}>
          <div>
            <span>TOURNAMENT #001 / FAST MODE</span>
            <h2>{engine.format ? (engine.format.mode === "fast_swiss" ? `${engine.format.swissRounds}R Fast Swiss → Top ${engine.format.playoffCut}` : "Fast Single Elimination") : preview.label}</h2>
            <p>
              Finish quickly: BO1 early stage, aggressive parallel scheduling,
              BO3 Top 4, BO3 final. Pairings and standings are persisted in Supabase.
            </p>
          </div>
          <div className={styles.engineStats}>
            <div><span>PLANNING FIELD</span><strong>{engine.format?.lockedTeamCount ?? summary.verified}</strong></div>
            <div><span>CHECKED IN</span><strong>{summary.checkedIn}</strong></div>
            <div><span>TARGET TIME</span><strong>{duration(engine.format?.estimatedMinutes ?? preview.estimatedMinutes)}</strong></div>
            <div><span>PARALLEL</span><strong>{engine.format?.maxConcurrentMatches ?? 8}</strong></div>
          </div>
        </div>

        <div className={styles.engineActions}>
          {!engine.format && canReview && (
            <button
              className={styles.primaryButton}
              disabled={busyKey !== null || summary.checkedIn < 2}
              onClick={() => void engineAction("start")}
            >
              Lock field + start Round 1
            </button>
          )}

          {engine.format?.mode === "fast_swiss" &&
            currentSwissComplete &&
            currentSwissRound < engine.format.swissRounds && (
              <button
                className={styles.primaryButton}
                disabled={busyKey !== null}
                onClick={() => void engineAction("next_round")}
              >
                Generate Swiss Round {currentSwissRound + 1}
              </button>
            )}

          {engine.format?.mode === "fast_swiss" && swissComplete && !playoffsExist && (
            <button
              className={styles.primaryButton}
              disabled={busyKey !== null}
              onClick={() => void engineAction("create_playoffs")}
            >
              Lock Top 4 playoffs
            </button>
          )}

          {engine.format?.mode === "single_elimination" &&
            eliminationRoundComplete &&
            !engine.matches.some((match) => match.stage === "final") && (
              <button
                className={styles.primaryButton}
                disabled={busyKey !== null}
                onClick={() => void engineAction("next_round")}
              >
                Generate next bracket round
              </button>
            )}

          <button className={styles.secondaryButton} disabled={busyKey !== null} onClick={() => void refreshAll()}>
            Refresh engine
          </button>
        </div>
      </section>

      {engine.format?.mode === "fast_swiss" && engine.standings.length > 0 && (
        <section className={styles.standingsPanel}>
          <div className={styles.sectionHeading}>
            <div><span>LIVE RANKING</span><h2>Swiss standings</h2></div>
          </div>
          <div className={styles.standingsTable}>
            <div className={styles.standingsHead}><span>#</span><span>Team</span><span>W-L</span><span>BH</span><span>GD</span></div>
            {engine.standings.map((standing) => (
              <div className={styles.standingRow} key={standing.entryId}>
                <b>{standing.rank}</b>
                <div><strong>{standing.teamName}</strong><small>Seed {standing.seed}</small></div>
                <span>{standing.wins}-{standing.losses}</span>
                <span>{standing.buchholz}</span>
                <span>{standing.gameDifferential > 0 ? "+" : ""}{standing.gameDifferential}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {groupedMatches.length > 0 && (
        <section className={styles.matchDesk}>
          <div className={styles.sectionHeading}>
            <div><span>PAIRINGS + RESULTS</span><h2>Match desk</h2></div>
          </div>
          <div className={styles.roundGrid}>
            {groupedMatches.map((matches) => (
              <article className={styles.roundCard} key={`${matches[0].stage}:${matches[0].roundNumber}`}>
                <div className={styles.roundTitle}>
                  <span>{stageName(matches[0])}</span>
                  <strong>BO{matches[0].bestOf}</strong>
                </div>
                {matches.map((match) => {
                  const busy = Boolean(match.id && busyKey === `match:${match.id}`);
                  return (
                    <div className={styles.matchRow} key={match.id ?? `${match.roundNumber}:${match.matchNumber}`}>
                      <div className={styles.matchTeams}>
                        <div><span>{match.teamAName || "Team A"}</span><b>{match.status === "final" ? match.teamAScore : "—"}</b></div>
                        <div><span>{match.teamBName || "BYE"}</span><b>{match.status === "final" ? match.teamBScore : "—"}</b></div>
                      </div>
                      <small>Batch {match.batchNumber} · Match {match.matchNumber}</small>

                      {match.status === "scheduled" && !match.isBye && (
                        <div className={styles.resultButtons}>
                          {match.bestOf === 1 ? (
                            <>
                              <button disabled={busy} onClick={() => void recordResult(match, 1, 0)}>A · 1–0</button>
                              <button disabled={busy} onClick={() => void recordResult(match, 0, 1)}>B · 0–1</button>
                            </>
                          ) : (
                            <>
                              <button disabled={busy} onClick={() => void recordResult(match, 2, 0)}>A · 2–0</button>
                              <button disabled={busy} onClick={() => void recordResult(match, 2, 1)}>A · 2–1</button>
                              <button disabled={busy} onClick={() => void recordResult(match, 1, 2)}>B · 1–2</button>
                              <button disabled={busy} onClick={() => void recordResult(match, 0, 2)}>B · 0–2</button>
                            </>
                          )}
                        </div>
                      )}
                      {match.status === "final" && <span className={styles.finalBadge}>{match.isBye ? "AUTO ADVANCE" : "FINAL"}</span>}
                    </div>
                  );
                })}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className={styles.sectionHeading}>
        <div><span>13 OCTOBER 2026</span><h2>Registration desk</h2></div>
        <button className={styles.secondaryButton} onClick={() => void refreshAll()}>Refresh</button>
      </section>

      <section className={styles.registrationList}>
        {registrations.length === 0 ? (
          <div className={styles.empty}><strong>No team registrations yet.</strong><span>New submissions will appear here from Supabase.</span></div>
        ) : (
          registrations.map((registration) => {
            const statusBusy = busyKey === `${registration.registration_id}:status`;
            const checkInBusy = busyKey === `${registration.registration_id}:checkin`;
            return (
              <article className={styles.registration} key={registration.registration_id}>
                <div className={styles.registrationHead}>
                  <div>
                    <span className={styles.tag}>{registration.team_tag || "TEAM"}</span>
                    <h3>{registration.team_name}</h3>
                    <p>Captain: <strong>{registration.captain_contact}</strong>{registration.captain_email ? <> · {registration.captain_email}</> : null}</p>
                  </div>
                  <div className={styles.statusStack}>
                    <span className={`${styles.status} ${styles[registration.registration_status]}`}>{registration.registration_status}</span>
                    {registration.checked_in && <span className={styles.checkBadge}>checked in</span>}
                  </div>
                </div>

                <div className={styles.roster}>
                  {registration.players.map((player) => (
                    <div className={styles.player} key={player.id}>
                      <span>{player.rosterRole === "substitute" ? "SUB" : "STARTER"}</span>
                      <strong>{player.ign}{player.isCaptain ? " · C" : ""}</strong>
                      <small>{player.mlbbId} ({player.serverId})</small>
                    </div>
                  ))}
                </div>

                <div className={styles.actions}>
                  {canReview && registration.registration_status === "pending" && (
                    <>
                      <button className={styles.primaryButton} disabled={statusBusy} onClick={() => void changeStatus(registration.registration_id, "verified")}>Verify team</button>
                      <button className={styles.dangerButton} disabled={statusBusy} onClick={() => void changeStatus(registration.registration_id, "rejected")}>Reject</button>
                    </>
                  )}
                  {canReview && (registration.registration_status === "rejected" || registration.registration_status === "withdrawn") && (
                    <button className={styles.secondaryButton} disabled={statusBusy} onClick={() => void changeStatus(registration.registration_id, "pending")}>Reopen review</button>
                  )}
                  {canReview && registration.registration_status === "verified" && (
                    <button className={styles.secondaryButton} disabled={statusBusy} onClick={() => void changeStatus(registration.registration_id, "pending")}>Return to review</button>
                  )}
                  {canCheckIn && registration.registration_status === "verified" && !engine.format && (
                    <button
                      className={registration.checked_in ? styles.secondaryButton : styles.primaryButton}
                      disabled={checkInBusy}
                      onClick={() => void changeCheckIn(registration.registration_id, !registration.checked_in)}
                    >
                      {registration.checked_in ? "Undo check-in" : "Check in team"}
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
