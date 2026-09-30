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
type OpsTab = "overview" | "matches" | "teams" | "finance" | "comms";

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

type MatchOps = {
  id: string;
  status: "scheduled" | "ready" | "live" | "final";
  roomCode: string | null;
  roomPassword: string | null;
  refereeName: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  streamed: boolean;
  teamAReady: boolean;
  teamBReady: boolean;
  opsNote: string | null;
};

type Announcement = {
  id: string;
  kind: "info" | "schedule" | "important" | "critical" | "result";
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
};

type Incident = {
  id: string;
  matchId: string | null;
  severity: "normal" | "important" | "critical";
  category: "match" | "lobby" | "no_show" | "connectivity" | "conduct" | "score" | "other";
  title: string;
  description: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
};

type Activity = {
  id: string;
  action: string;
  afterState: Record<string, unknown> | null;
  createdAt: string;
};

type OperationsState = {
  matchOps: MatchOps[];
  announcements: Announcement[];
  incidents: Incident[];
  activity: Activity[];
};

type MatchDraft = {
  roomCode: string;
  roomPassword: string;
  refereeName: string;
  scheduledAt: string;
  streamed: boolean;
  opsNote: string;
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

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

function actionLabel(action: string): string {
  return action
    .replace(/^tournament\./, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function localDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function displayClock(value: string | null | undefined): string {
  if (!value) return "UNSCHEDULED";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export default function OpsPage() {
  const router = useRouter();
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [activeTab, setActiveTab] = useState<OpsTab>("overview");
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [engine, setEngine] = useState<EngineState>({
    format: null,
    entries: [],
    matches: [],
    standings: [],
  });
  const [finance, setFinance] = useState<FinanceState | null>(null);
  const [operations, setOperations] = useState<OperationsState>({
    matchOps: [],
    announcements: [],
    incidents: [],
    activity: [],
  });
  const [matchDrafts, setMatchDrafts] = useState<Record<string, MatchDraft>>({});
  const [donationAmount, setDonationAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementKind, setAnnouncementKind] = useState<Announcement["kind"]>("info");
  const [announcementPinned, setAnnouncementPinned] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState<Incident["severity"]>("normal");
  const [incidentCategory, setIncidentCategory] = useState<Incident["category"]>("match");
  const [incidentMatchId, setIncidentMatchId] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
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

  const loadOperations = useCallback(async () => {
    const token = await sessionToken();
    if (!token) return;
    const response = await fetch(
      `/api/ops/tournament/${TOURNAMENT_SLUG}/operations`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Unable to load match operations.");

    const next = payload as OperationsState;
    setOperations(next);
    setMatchDrafts((current) => {
      const drafts = { ...current };
      for (const item of next.matchOps) {
        if (!drafts[item.id]) {
          drafts[item.id] = {
            roomCode: item.roomCode ?? "",
            roomPassword: item.roomPassword ?? "",
            refereeName: item.refereeName ?? "",
            scheduledAt: localDateTime(item.scheduledAt),
            streamed: item.streamed,
            opsNote: item.opsNote ?? "",
          };
        }
      }
      return drafts;
    });
  }, [sessionToken]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadRegistrations(),
      loadEngine(),
      loadFinance(),
      loadOperations(),
    ]);
  }, [loadEngine, loadFinance, loadOperations, loadRegistrations]);

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
  const opsByMatch = useMemo(
    () => new Map(operations.matchOps.map((item) => [item.id, item])),
    [operations.matchOps],
  );
  const liveMatches = engine.matches.filter((match) => match.status === "live");
  const readyMatches = engine.matches.filter((match) => match.status === "ready");
  const openIncidents = operations.incidents.filter((incident) => incident.status === "open");
  const criticalIncidents = openIncidents.filter((incident) => incident.severity === "critical");

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

  const filteredRegistrations = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    if (!query) return registrations;
    return registrations.filter((registration) =>
      [registration.team_name, registration.team_tag, registration.captain_contact, registration.captain_email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [registrations, teamSearch]);

  const attention = useMemo(() => {
    const items: Array<{ level: "critical" | "warn" | "info"; title: string; copy: string; tab: OpsTab }> = [];
    if (criticalIncidents.length > 0) {
      items.push({
        level: "critical",
        title: `${criticalIncidents.length} critical incident${criticalIncidents.length === 1 ? "" : "s"} open`,
        copy: "Resolve match-day blockers before advancing rounds.",
        tab: "comms",
      });
    }
    if (summary.pending > 0) {
      items.push({
        level: "warn",
        title: `${summary.pending} registration${summary.pending === 1 ? "" : "s"} awaiting review`,
        copy: "Pending teams cannot reach tournament check-in.",
        tab: "teams",
      });
    }
    if (!engine.format && summary.verified > summary.checkedIn) {
      items.push({
        level: "warn",
        title: `${summary.verified - summary.checkedIn} verified team${summary.verified - summary.checkedIn === 1 ? "" : "s"} not checked in`,
        copy: "Only verified + checked-in teams are snapshotted when Round 1 starts.",
        tab: "teams",
      });
    }
    if (readyMatches.length > 0) {
      items.push({
        level: "info",
        title: `${readyMatches.length} match${readyMatches.length === 1 ? "" : "es"} ready to launch`,
        copy: "Lobby details and teams are prepared. Move them live when the referee confirms.",
        tab: "matches",
      });
    }
    if (liveMatches.length > 0) {
      items.push({
        level: "info",
        title: `${liveMatches.length} live match${liveMatches.length === 1 ? "" : "es"}`,
        copy: "Keep score reporting and incident handling focused here.",
        tab: "matches",
      });
    }
    if (items.length === 0) {
      items.push({
        level: "info",
        title: "No urgent blockers",
        copy: engine.format ? "Tournament operations are clear." : "Continue registration review and check-in preparation.",
        tab: "overview",
      });
    }
    return items;
  }, [criticalIncidents.length, engine.format, liveMatches.length, readyMatches.length, summary]);

  async function postOperations(body: Record<string, unknown>) {
    const token = await sessionToken();
    if (!token) return null;
    const response = await fetch(
      `/api/ops/tournament/${TOURNAMENT_SLUG}/operations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Operation failed.");
    setOperations(payload as OperationsState);
    return payload as OperationsState;
  }

  async function engineAction(action: "start" | "next_round" | "create_playoffs") {
    setBusyKey(`engine:${action}`);
    setError(null);
    try {
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
          body: JSON.stringify({ action, maxConcurrentMatches: 8 }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Tournament action failed.");
      await refreshAll();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Tournament action failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function recordResult(
    match: TournamentEngineMatch,
    teamAScore: number,
    teamBScore: number,
  ) {
    if (!match.id) return;
    setBusyKey(`match:${match.id}`);
    setError(null);
    try {
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
      if (!response.ok) throw new Error(payload.error ?? "Unable to record result.");
      await refreshAll();
    } catch (resultError) {
      setError(resultError instanceof Error ? resultError.message : "Unable to record result.");
    } finally {
      setBusyKey(null);
    }
  }

  async function changeStatus(registrationId: string, status: RegistrationStatus) {
    setBusyKey(`${registrationId}:status`);
    setError(null);
    try {
      const token = await sessionToken();
      if (!token) return;
      const response = await fetch(`/api/ops/registrations/${registrationId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to change registration status.");
      await refreshAll();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to change registration status.");
    } finally {
      setBusyKey(null);
    }
  }

  async function changeCheckIn(registrationId: string, checkedIn: boolean) {
    setBusyKey(`${registrationId}:checkin`);
    setError(null);
    try {
      const token = await sessionToken();
      if (!token) return;
      const response = await fetch(`/api/ops/registrations/${registrationId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ checkedIn }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to change check-in state.");
      await refreshAll();
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Unable to change check-in state.");
    } finally {
      setBusyKey(null);
    }
  }

  async function recordDonation() {
    const amount = Number.parseInt(donationAmount, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Enter a valid donation amount in INR.");
      return;
    }

    setBusyKey("finance:donation");
    setError(null);
    try {
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
      if (!response.ok) throw new Error(payload.error ?? "Unable to record donation.");
      setDonationAmount("");
      setDonorName("");
      await loadFinance();
    } catch (donationError) {
      setError(donationError instanceof Error ? donationError.message : "Unable to record donation.");
    } finally {
      setBusyKey(null);
    }
  }

  function patchDraft(matchId: string, patch: Partial<MatchDraft>) {
    setMatchDrafts((current) => {
      const existing =
        current[matchId] ??
        ({
          roomCode: "",
          roomPassword: "",
          refereeName: "",
          scheduledAt: "",
          streamed: false,
          opsNote: "",
        } satisfies MatchDraft);

      return {
        ...current,
        [matchId]: { ...existing, ...patch },
      };
    });
  }

  async function saveMatchOps(matchId: string) {
    const draft = matchDrafts[matchId];
    if (!draft) return;
    setBusyKey(`ops:${matchId}`);
    setError(null);
    try {
      await postOperations({
        action: "update_match",
        matchId,
        roomCode: draft.roomCode,
        roomPassword: draft.roomPassword,
        refereeName: draft.refereeName,
        scheduledAt: draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : null,
        streamed: draft.streamed,
        opsNote: draft.opsNote,
      });
      await loadEngine();
    } catch (opsError) {
      setError(opsError instanceof Error ? opsError.message : "Unable to save match operations.");
    } finally {
      setBusyKey(null);
    }
  }

  async function updateMatchQuick(
    matchId: string,
    patch: {
      status?: "scheduled" | "ready" | "live";
      teamAReady?: boolean;
      teamBReady?: boolean;
    },
  ) {
    setBusyKey(`quick:${matchId}`);
    setError(null);
    try {
      await postOperations({ action: "update_match", matchId, ...patch });
      await loadEngine();
    } catch (opsError) {
      setError(opsError instanceof Error ? opsError.message : "Unable to update match.");
    } finally {
      setBusyKey(null);
    }
  }

  async function publishAnnouncement() {
    if (!announcementTitle.trim() || !announcementBody.trim()) {
      setError("Announcement title and message are required.");
      return;
    }
    setBusyKey("comms:announcement");
    setError(null);
    try {
      await postOperations({
        action: "announcement",
        kind: announcementKind,
        title: announcementTitle,
        message: announcementBody,
        pinned: announcementPinned,
      });
      setAnnouncementTitle("");
      setAnnouncementBody("");
      setAnnouncementPinned(false);
    } catch (announcementError) {
      setError(announcementError instanceof Error ? announcementError.message : "Unable to publish announcement.");
    } finally {
      setBusyKey(null);
    }
  }

  async function archiveAnnouncement(id: string) {
    setBusyKey(`announcement:${id}`);
    setError(null);
    try {
      await postOperations({ action: "archive_announcement", announcementId: id });
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Unable to archive announcement.");
    } finally {
      setBusyKey(null);
    }
  }

  async function recordIncident() {
    if (!incidentTitle.trim() || !incidentDescription.trim()) {
      setError("Incident title and description are required.");
      return;
    }
    setBusyKey("comms:incident");
    setError(null);
    try {
      await postOperations({
        action: "incident",
        matchId: incidentMatchId || undefined,
        severity: incidentSeverity,
        category: incidentCategory,
        title: incidentTitle,
        description: incidentDescription,
      });
      setIncidentTitle("");
      setIncidentDescription("");
      setIncidentMatchId("");
      setIncidentSeverity("normal");
      setIncidentCategory("match");
    } catch (incidentError) {
      setError(incidentError instanceof Error ? incidentError.message : "Unable to record incident.");
    } finally {
      setBusyKey(null);
    }
  }

  async function resolveIncident(id: string) {
    setBusyKey(`incident:${id}`);
    setError(null);
    try {
      await postOperations({ action: "resolve_incident", incidentId: id });
    } catch (incidentError) {
      setError(incidentError instanceof Error ? incidentError.message : "Unable to resolve incident.");
    } finally {
      setBusyKey(null);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className={styles.loadingShell}>
        <span>R//C</span>
        <strong>SYNCING CONTROL PLANE</strong>
        <i />
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className={styles.accessShell}>
        <span>R//C / ACCESS</span>
        <h1>Operator clearance required.</h1>
        <p>This account is authenticated, but it does not hold an active Riftcore tournament role.</p>
        <button onClick={signOut}>Sign out</button>
      </main>
    );
  }

  const tabs: Array<{ id: OpsTab; label: string; count?: number }> = [
    { id: "overview", label: "Overview" },
    { id: "matches", label: "Match Ops", count: liveMatches.length + readyMatches.length },
    { id: "teams", label: "Teams", count: summary.pending },
    { id: "finance", label: "Prize" },
    { id: "comms", label: "Comms", count: openIncidents.length },
  ];

  return (
    <main className={styles.shell}>
      <header className={styles.commandBar}>
        <a className={styles.mark} href="/">
          <span>R//C</span>
          <small>RIFTCORE OPS</small>
        </a>

        <div className={styles.eventIdentity}>
          <span>TOURNAMENT #001</span>
          <strong>13 OCT 2026 · MLBB</strong>
        </div>

        <div className={styles.commandStatus}>
          <span className={engine.format ? styles.liveSignal : styles.prepSignal} />
          <div>
            <small>{engine.format ? "OPERATION LIVE" : "PRE-MATCH"}</small>
            <strong>{profile?.display_name || "Operator"} · {profile?.role}</strong>
          </div>
          <button onClick={() => void refreshAll()} disabled={busyKey !== null}>SYNC</button>
        </div>
      </header>

      <nav className={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? styles.tabActive : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            {Boolean(tab.count) && <b>{tab.count}</b>}
          </button>
        ))}
        <button className={styles.signOutButton} onClick={signOut}>Sign out</button>
      </nav>

      {error && <div className={styles.errorBanner}><span>OPS ERROR</span>{error}</div>}

      <section className={styles.statusRail}>
        <article>
          <span>CHECKED IN</span>
          <strong>{summary.checkedIn}<small>/{summary.verified}</small></strong>
          <i style={{ width: `${summary.verified ? Math.min(100, (summary.checkedIn / summary.verified) * 100) : 0}%` }} />
        </article>
        <article>
          <span>LIVE MATCHES</span>
          <strong>{liveMatches.length}</strong>
          <small>{readyMatches.length} ready</small>
        </article>
        <article>
          <span>OPEN INCIDENTS</span>
          <strong className={criticalIncidents.length ? styles.dangerNumber : ""}>{openIncidents.length}</strong>
          <small>{criticalIncidents.length} critical</small>
        </article>
        <article>
          <span>PRIZE POOL</span>
          <strong>{inr.format(finance?.currentPrizePool ?? 2000)}</strong>
          <small>+{inr.format(finance?.joinFee ?? 250)} / team</small>
        </article>
        <article>
          <span>FORMAT</span>
          <strong className={styles.formatMetric}>
            {engine.format
              ? engine.format.mode === "fast_swiss"
                ? `${engine.format.swissRounds}R SWISS`
                : "ELIM"
              : preview.mode === "fast_swiss"
                ? `${preview.swissRounds}R PLAN`
                : "FAST ELIM"}
          </strong>
          <small>{engine.format ? duration(engine.format.estimatedMinutes) : duration(preview.estimatedMinutes)}</small>
        </article>
      </section>

      {activeTab === "overview" && (
        <div className={styles.dashboardGrid}>
          <section className={styles.primaryPanel}>
            <div className={styles.panelHeading}>
              <div><span>ATTENTION QUEUE</span><h2>What needs you now.</h2></div>
              <b>{attention.length.toString().padStart(2, "0")}</b>
            </div>
            <div className={styles.attentionList}>
              {attention.map((item, index) => (
                <button key={index} onClick={() => setActiveTab(item.tab)}>
                  <i className={styles[item.level]} />
                  <div><strong>{item.title}</strong><span>{item.copy}</span></div>
                  <b>→</b>
                </button>
              ))}
            </div>
          </section>

          <aside className={styles.sideStack}>
            <section className={styles.stagePanel}>
              <span>MATCHDAY FLOW</span>
              <h3>{engine.format ? "Tournament active" : "Pre-flight"}</h3>
              <ol>
                <li className={summary.checkedIn > 0 ? styles.doneStep : ""}><b>01</b><div><strong>Check-in</strong><span>{summary.checkedIn} teams ready</span></div></li>
                <li className={engine.format ? styles.doneStep : ""}><b>02</b><div><strong>Lock field</strong><span>{engine.format?.lockedTeamCount ?? "Not locked"}</span></div></li>
                <li className={currentSwissRound > 0 || engine.format?.mode === "single_elimination" ? styles.activeStep : ""}><b>03</b><div><strong>Competition</strong><span>{engine.format?.mode === "fast_swiss" ? `Swiss R${currentSwissRound || 1}` : engine.format ? "Elimination" : "Waiting"}</span></div></li>
                <li className={playoffsExist ? styles.activeStep : ""}><b>04</b><div><strong>Top cut</strong><span>{playoffsExist ? "Playoffs created" : "Pending"}</span></div></li>
                <li className={engine.matches.some((match) => match.stage === "final") ? styles.activeStep : ""}><b>05</b><div><strong>Grand final</strong><span>{engine.matches.some((match) => match.stage === "final") ? "Generated" : "Pending"}</span></div></li>
              </ol>
            </section>

            <section className={styles.activityPanel}>
              <div className={styles.miniHeading}><span>RECENT ACTIVITY</span><button onClick={() => setActiveTab("comms")}>ALL →</button></div>
              <div className={styles.activityList}>
                {operations.activity.slice(0, 6).map((item) => (
                  <div key={item.id}>
                    <i />
                    <div><strong>{actionLabel(item.action)}</strong><span>{new Date(item.createdAt).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", day: "2-digit", month: "short" })}</span></div>
                  </div>
                ))}
                {operations.activity.length === 0 && <p>No operator activity yet.</p>}
              </div>
            </section>
          </aside>

          <section className={styles.fullPanel}>
            <div className={styles.panelHeading}>
              <div><span>LIVE FLOOR</span><h2>{engine.format ? "Match control" : "Launch plan"}</h2></div>
              {!engine.format && canReview && (
                <button
                  className={styles.actionPrimary}
                  disabled={busyKey !== null || summary.checkedIn < 2}
                  onClick={() => void engineAction("start")}
                >
                  Lock field + launch R1
                </button>
              )}
            </div>

            {!engine.format ? (
              <div className={styles.launchPlan}>
                <div><span>VERIFIED</span><strong>{summary.verified}</strong></div>
                <div><span>CHECKED IN</span><strong>{summary.checkedIn}</strong></div>
                <div><span>RECOMMENDED</span><strong>{preview.label}</strong></div>
                <div><span>TARGET</span><strong>{duration(preview.estimatedMinutes)}</strong></div>
              </div>
            ) : (
              <div className={styles.liveFloor}>
                {(liveMatches.length ? liveMatches : readyMatches).slice(0, 4).map((match) => (
                  <button key={match.id} onClick={() => setActiveTab("matches")}>
                    <span className={match.status === "live" ? styles.liveBadge : styles.readyBadge}>{match.status}</span>
                    <small>{stageName(match)} · M{match.matchNumber}</small>
                    <strong>{match.teamAName || "TBD"} <i>vs</i> {match.teamBName || "BYE"}</strong>
                    <em>{displayClock(match.scheduledAt)}</em>
                  </button>
                ))}
                {liveMatches.length === 0 && readyMatches.length === 0 && (
                  <div className={styles.floorEmpty}>No matches are live or ready. Open Match Ops to prepare the next batch.</div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === "matches" && (
        <section className={styles.sectionShell}>
          <div className={styles.sectionHero}>
            <div>
              <span>MATCH OPS</span>
              <h1>Run the floor.</h1>
              <p>Prepare lobbies, ready teams, assign referees, launch matches, and finalize scores without exposing private room credentials publicly.</p>
            </div>
            <div className={styles.sectionActions}>
              {engine.format?.mode === "fast_swiss" &&
                currentSwissComplete &&
                currentSwissRound < engine.format.swissRounds && (
                  <button className={styles.actionPrimary} onClick={() => void engineAction("next_round")} disabled={busyKey !== null}>
                    Generate Swiss R{currentSwissRound + 1}
                  </button>
                )}
              {engine.format?.mode === "fast_swiss" && swissComplete && !playoffsExist && (
                <button className={styles.actionPrimary} onClick={() => void engineAction("create_playoffs")} disabled={busyKey !== null}>
                  Lock Top 4
                </button>
              )}
              {engine.format?.mode === "single_elimination" &&
                eliminationRoundComplete &&
                !engine.matches.some((match) => match.stage === "final") && (
                  <button className={styles.actionPrimary} onClick={() => void engineAction("next_round")} disabled={busyKey !== null}>
                    Next bracket round
                  </button>
                )}
              {!engine.format && canReview && (
                <button className={styles.actionPrimary} disabled={busyKey !== null || summary.checkedIn < 2} onClick={() => void engineAction("start")}>
                  Start tournament
                </button>
              )}
            </div>
          </div>

          {engine.format?.mode === "fast_swiss" && engine.standings.length > 0 && (
            <div className={styles.compactStandings}>
              {engine.standings.slice(0, 8).map((standing) => (
                <div key={standing.entryId}>
                  <b>{standing.rank}</b>
                  <span>{standing.teamName}</span>
                  <strong>{standing.wins}-{standing.losses}</strong>
                  <small>BH {standing.buchholz}</small>
                </div>
              ))}
            </div>
          )}

          {groupedMatches.length === 0 ? (
            <div className={styles.emptyState}>
              <span>NO MATCHES GENERATED</span>
              <strong>Check in teams and launch the tournament.</strong>
            </div>
          ) : (
            <div className={styles.roundSections}>
              {groupedMatches.map((matches) => (
                <section className={styles.roundSection} key={`${matches[0].stage}:${matches[0].roundNumber}`}>
                  <div className={styles.roundHeader}>
                    <div><span>{stageName(matches[0])}</span><strong>BO{matches[0].bestOf}</strong></div>
                    <small>{matches.filter((match) => match.status === "final").length}/{matches.length} final</small>
                  </div>

                  <div className={styles.matchGrid}>
                    {matches.map((match) => {
                      const matchId = match.id ?? "";
                      const ops = matchId ? opsByMatch.get(matchId) : undefined;
                      const draft = matchId ? matchDrafts[matchId] : undefined;
                      const busy = Boolean(matchId && busyKey?.includes(matchId));
                      const isFinal = match.status === "final";
                      return (
                        <article className={`${styles.matchCard} ${match.status === "live" ? styles.matchLive : ""}`} key={matchId || `${match.roundNumber}:${match.matchNumber}`}>
                          <div className={styles.matchTopline}>
                            <div>
                              <span className={styles[`state_${match.status}`]}>{match.status.toUpperCase()}</span>
                              {ops?.streamed && <span className={styles.streamBadge}>STREAM</span>}
                            </div>
                            <small>B{match.batchNumber} · M{match.matchNumber} · {displayClock(ops?.scheduledAt)}</small>
                          </div>

                          <div className={styles.versusBlock}>
                            <div>
                              <button
                                className={ops?.teamAReady ? styles.teamReady : ""}
                                disabled={busy || isFinal}
                                onClick={() => matchId && void updateMatchQuick(matchId, { teamAReady: !ops?.teamAReady })}
                              >
                                <span>{ops?.teamAReady ? "READY" : "NOT READY"}</span>
                                <strong>{match.teamAName || "TBD"}</strong>
                              </button>
                              <b>{isFinal ? match.teamAScore : "—"}</b>
                            </div>
                            <em>VS</em>
                            <div>
                              <button
                                className={ops?.teamBReady ? styles.teamReady : ""}
                                disabled={busy || isFinal || match.isBye}
                                onClick={() => matchId && void updateMatchQuick(matchId, { teamBReady: !ops?.teamBReady })}
                              >
                                <span>{match.isBye ? "BYE" : ops?.teamBReady ? "READY" : "NOT READY"}</span>
                                <strong>{match.teamBName || "BYE"}</strong>
                              </button>
                              <b>{isFinal ? match.teamBScore : "—"}</b>
                            </div>
                          </div>

                          {!isFinal && !match.isBye && (
                            <>
                              <div className={styles.stateControls}>
                                <button disabled={busy} onClick={() => matchId && void updateMatchQuick(matchId, { status: "scheduled" })}>Scheduled</button>
                                <button disabled={busy} onClick={() => matchId && void updateMatchQuick(matchId, { status: "ready" })}>Ready</button>
                                <button disabled={busy} onClick={() => matchId && void updateMatchQuick(matchId, { status: "live" })}>Go live</button>
                              </div>

                              <details className={styles.lobbyDetails}>
                                <summary>Lobby + referee controls</summary>
                                <div className={styles.lobbyGrid}>
                                  <label><span>ROOM CODE</span><input value={draft?.roomCode ?? ""} onChange={(event) => patchDraft(matchId, { roomCode: event.target.value })} placeholder="Custom room ID" /></label>
                                  <label><span>PASSWORD</span><input value={draft?.roomPassword ?? ""} onChange={(event) => patchDraft(matchId, { roomPassword: event.target.value })} placeholder="Private" /></label>
                                  <label><span>REFEREE</span><input value={draft?.refereeName ?? ""} onChange={(event) => patchDraft(matchId, { refereeName: event.target.value })} placeholder="Name / handle" /></label>
                                  <label><span>START TIME</span><input type="datetime-local" value={draft?.scheduledAt ?? ""} onChange={(event) => patchDraft(matchId, { scheduledAt: event.target.value })} /></label>
                                  <label className={styles.streamToggle}><input type="checkbox" checked={draft?.streamed ?? false} onChange={(event) => patchDraft(matchId, { streamed: event.target.checked })} /><span>Featured / streamed match</span></label>
                                  <label className={styles.noteField}><span>OPS NOTE</span><textarea value={draft?.opsNote ?? ""} onChange={(event) => patchDraft(matchId, { opsNote: event.target.value })} placeholder="Pause reason, lobby note, admin context…" /></label>
                                </div>
                                <button className={styles.saveLobby} disabled={busy} onClick={() => matchId && void saveMatchOps(matchId)}>Save private match ops</button>
                              </details>

                              <div className={styles.scoreControls}>
                                <span>FINALIZE SCORE</span>
                                {match.bestOf === 1 ? (
                                  <div>
                                    <button disabled={busy} onClick={() => void recordResult(match, 1, 0)}>A · 1–0</button>
                                    <button disabled={busy} onClick={() => void recordResult(match, 0, 1)}>B · 0–1</button>
                                  </div>
                                ) : (
                                  <div>
                                    <button disabled={busy} onClick={() => void recordResult(match, 2, 0)}>A · 2–0</button>
                                    <button disabled={busy} onClick={() => void recordResult(match, 2, 1)}>A · 2–1</button>
                                    <button disabled={busy} onClick={() => void recordResult(match, 1, 2)}>B · 1–2</button>
                                    <button disabled={busy} onClick={() => void recordResult(match, 0, 2)}>B · 0–2</button>
                                  </div>
                                )}
                              </div>
                            </>
                          )}

                          {isFinal && (
                            <div className={styles.finalStrip}>
                              <span>FINAL</span>
                              <strong>{match.winnerEntryId === match.teamAEntryId ? match.teamAName : match.teamBName}</strong>
                              <small>Winner</small>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "teams" && (
        <section className={styles.sectionShell}>
          <div className={styles.sectionHero}>
            <div>
              <span>TEAM CONTROL</span>
              <h1>Roster readiness.</h1>
              <p>Review registration, verify teams, and lock attendance before the tournament engine snapshots the field.</p>
            </div>
            <div className={styles.teamSearch}>
              <span>SEARCH</span>
              <input value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} placeholder="Team, captain, email…" />
            </div>
          </div>

          <div className={styles.teamMatrix}>
            {filteredRegistrations.map((registration) => {
              const statusBusy = busyKey === `${registration.registration_id}:status`;
              const checkBusy = busyKey === `${registration.registration_id}:checkin`;
              return (
                <article key={registration.registration_id} className={styles.teamCard}>
                  <div className={styles.teamCardHead}>
                    <div><span>{registration.team_tag || "TEAM"}</span><h3>{registration.team_name}</h3></div>
                    <div>
                      <b className={styles[`registration_${registration.registration_status}`]}>{registration.registration_status}</b>
                      <b className={registration.checked_in ? styles.checkedTag : styles.notCheckedTag}>{registration.checked_in ? "CHECKED IN" : "NOT CHECKED"}</b>
                    </div>
                  </div>

                  <div className={styles.captainLine}>
                    <span>CAPTAIN</span>
                    <strong>{registration.captain_contact}</strong>
                    <small>{registration.captain_email || "No email"}</small>
                  </div>

                  <div className={styles.rosterMini}>
                    {registration.players.map((player) => (
                      <div key={player.id}>
                        <span>{player.rosterRole === "substitute" ? "SUB" : player.isCaptain ? "C" : "P"}</span>
                        <strong>{player.ign}</strong>
                        <small>{player.mlbbId} · {player.serverId}</small>
                      </div>
                    ))}
                  </div>

                  <div className={styles.teamActions}>
                    {canReview && registration.registration_status === "pending" && (
                      <>
                        <button className={styles.actionPrimary} disabled={statusBusy} onClick={() => void changeStatus(registration.registration_id, "verified")}>Verify</button>
                        <button className={styles.actionDanger} disabled={statusBusy} onClick={() => void changeStatus(registration.registration_id, "rejected")}>Reject</button>
                      </>
                    )}
                    {canReview && registration.registration_status === "verified" && !engine.format && (
                      <button className={styles.actionSecondary} disabled={statusBusy} onClick={() => void changeStatus(registration.registration_id, "pending")}>Return to review</button>
                    )}
                    {registration.registration_status === "verified" && !engine.format && (
                      <button className={registration.checked_in ? styles.actionSecondary : styles.actionPrimary} disabled={checkBusy} onClick={() => void changeCheckIn(registration.registration_id, !registration.checked_in)}>
                        {registration.checked_in ? "Undo check-in" : "Check in"}
                      </button>
                    )}
                    {canReview && (registration.registration_status === "rejected" || registration.registration_status === "withdrawn") && !engine.format && (
                      <button className={styles.actionSecondary} disabled={statusBusy} onClick={() => void changeStatus(registration.registration_id, "pending")}>Reopen</button>
                    )}
                  </div>
                </article>
              );
            })}
            {filteredRegistrations.length === 0 && <div className={styles.emptyState}><span>NO TEAMS FOUND</span><strong>Registrations matching this search will appear here.</strong></div>}
          </div>
        </section>
      )}

      {activeTab === "finance" && (
        <section className={styles.sectionShell}>
          <div className={styles.sectionHero}>
            <div>
              <span>PRIZE + MONEY FLOW</span>
              <h1>{inr.format(finance?.currentPrizePool ?? 2000)}</h1>
              <p>Transparent Tournament #001 accounting: base prize + every active team fee + verified donations.</p>
            </div>
          </div>

          <div className={styles.financeGrid}>
            <article><span>BASE</span><strong>{inr.format(finance?.basePrizePool ?? 2000)}</strong><small>Guaranteed prize</small></article>
            <article><span>TEAM FEES</span><strong>+{inr.format(finance?.registrationContribution ?? 0)}</strong><small>{finance?.activeRegistrations ?? 0} active × {inr.format(finance?.joinFee ?? 250)}</small></article>
            <article><span>DONATIONS</span><strong>+{inr.format(finance?.donationTotal ?? 0)}</strong><small>{finance?.donationCount ?? 0} verified</small></article>
            <article><span>24 TEAM TARGET</span><strong>{inr.format(finance?.projectedMaxPrizePool ?? 8000)}</strong><small>Before future donations</small></article>
          </div>

          {canReview && (
            <section className={styles.financeRecorder}>
              <div><span>ADD VERIFIED CONTRIBUTION</span><h2>Donation ledger</h2><p>Only record money that has actually been received and verified.</p></div>
              <label><span>AMOUNT INR</span><input inputMode="numeric" value={donationAmount} onChange={(event) => setDonationAmount(event.target.value.replace(/[^0-9]/g, ""))} placeholder="500" /></label>
              <label><span>DONOR (OPTIONAL)</span><input value={donorName} onChange={(event) => setDonorName(event.target.value)} placeholder="Community member" /></label>
              <button className={styles.actionPrimary} disabled={busyKey !== null} onClick={() => void recordDonation()}>Add verified donation</button>
            </section>
          )}
        </section>
      )}

      {activeTab === "comms" && (
        <section className={styles.sectionShell}>
          <div className={styles.sectionHero}>
            <div>
              <span>COMMS + INCIDENTS</span>
              <h1>Keep the event coherent.</h1>
              <p>Publish only the information players need. Keep operational problems inside the incident ledger until they require a public update.</p>
            </div>
          </div>

          <div className={styles.commsGrid}>
            <section className={styles.composerPanel}>
              <div className={styles.panelHeading}><div><span>PUBLIC ANNOUNCEMENT</span><h2>Broadcast</h2></div></div>
              <div className={styles.formStack}>
                <div className={styles.formRow}>
                  <label><span>TYPE</span><select value={announcementKind} onChange={(event) => setAnnouncementKind(event.target.value as Announcement["kind"])}><option value="info">Info</option><option value="schedule">Schedule</option><option value="important">Important</option><option value="critical">Critical</option><option value="result">Result</option></select></label>
                  <label className={styles.pinToggle}><input type="checkbox" checked={announcementPinned} onChange={(event) => setAnnouncementPinned(event.target.checked)} /><span>Pin publicly</span></label>
                </div>
                <label><span>TITLE</span><input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="Swiss Round 2 is ready" /></label>
                <label><span>MESSAGE</span><textarea value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} placeholder="Pairings are live. Captains should report to their match page…" /></label>
                <button className={styles.actionPrimary} disabled={busyKey !== null} onClick={() => void publishAnnouncement()}>Publish announcement</button>
              </div>

              <div className={styles.announcementList}>
                {operations.announcements.map((announcement) => (
                  <article key={announcement.id}>
                    <div><span className={styles[`announcement_${announcement.kind}`]}>{announcement.kind}</span>{announcement.pinned && <b>PINNED</b>}</div>
                    <h3>{announcement.title}</h3>
                    <p>{announcement.body}</p>
                    <footer><small>{new Date(announcement.createdAt).toLocaleString("en-IN")}</small><button disabled={busyKey !== null} onClick={() => void archiveAnnouncement(announcement.id)}>Archive</button></footer>
                  </article>
                ))}
                {operations.announcements.length === 0 && <div className={styles.smallEmpty}>No public announcements yet.</div>}
              </div>
            </section>

            <section className={styles.composerPanel}>
              <div className={styles.panelHeading}><div><span>PRIVATE INCIDENT</span><h2>Issue log</h2></div><b>{openIncidents.length} OPEN</b></div>
              <div className={styles.formStack}>
                <div className={styles.formRow}>
                  <label><span>SEVERITY</span><select value={incidentSeverity} onChange={(event) => setIncidentSeverity(event.target.value as Incident["severity"])}><option value="normal">Normal</option><option value="important">Important</option><option value="critical">Critical</option></select></label>
                  <label><span>CATEGORY</span><select value={incidentCategory} onChange={(event) => setIncidentCategory(event.target.value as Incident["category"])}><option value="match">Match</option><option value="lobby">Lobby</option><option value="no_show">No show</option><option value="connectivity">Connectivity</option><option value="conduct">Conduct</option><option value="score">Score</option><option value="other">Other</option></select></label>
                </div>
                <label><span>MATCH (OPTIONAL)</span><select value={incidentMatchId} onChange={(event) => setIncidentMatchId(event.target.value)}><option value="">Tournament-wide</option>{engine.matches.filter((match) => match.id).map((match) => <option key={match.id} value={match.id}>{stageName(match)} · M{match.matchNumber} · {match.teamAName} vs {match.teamBName || "BYE"}</option>)}</select></label>
                <label><span>TITLE</span><input value={incidentTitle} onChange={(event) => setIncidentTitle(event.target.value)} placeholder="Team B unable to enter lobby" /></label>
                <label><span>DETAILS</span><textarea value={incidentDescription} onChange={(event) => setIncidentDescription(event.target.value)} placeholder="What happened, what has been tried, and what the referee needs to know…" /></label>
                <button className={styles.actionSecondary} disabled={busyKey !== null} onClick={() => void recordIncident()}>Record incident</button>
              </div>

              <div className={styles.incidentList}>
                {operations.incidents.map((incident) => (
                  <article key={incident.id} className={incident.status === "resolved" ? styles.incidentResolved : ""}>
                    <div><span className={styles[`incident_${incident.severity}`]}>{incident.severity}</span><b>{incident.category.replace("_", " ")}</b></div>
                    <h3>{incident.title}</h3>
                    <p>{incident.description}</p>
                    <footer><small>{new Date(incident.createdAt).toLocaleString("en-IN")}</small>{incident.status === "open" ? <button disabled={busyKey !== null} onClick={() => void resolveIncident(incident.id)}>Resolve</button> : <span>RESOLVED</span>}</footer>
                  </article>
                ))}
                {operations.incidents.length === 0 && <div className={styles.smallEmpty}>No incidents logged.</div>}
              </div>
            </section>
          </div>

          <section className={styles.activityFull}>
            <div className={styles.panelHeading}><div><span>AUDIT TRAIL</span><h2>Operator activity</h2></div></div>
            <div className={styles.activityTable}>
              {operations.activity.map((item) => (
                <div key={item.id}><span>{new Date(item.createdAt).toLocaleString("en-IN")}</span><strong>{actionLabel(item.action)}</strong><code>{item.afterState ? JSON.stringify(item.afterState) : "—"}</code></div>
              ))}
              {operations.activity.length === 0 && <div className={styles.smallEmpty}>No activity yet.</div>}
            </div>
          </section>
        </section>
      )}
    </main>
  );
}
