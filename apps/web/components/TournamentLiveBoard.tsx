"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Standing = {
  entryId: string;
  teamName: string;
  teamTag?: string | null;
  seed: number;
  rank: number;
  played: number;
  wins: number;
  losses: number;
  buchholz: number;
  gameDifferential: number;
};

type Match = {
  id: string;
  stage: "swiss" | "single_elimination" | "semifinal" | "final";
  roundNumber: number;
  matchNumber: number;
  batchNumber: number;
  bestOf: number;
  teamAEntryId: string;
  teamBEntryId?: string | null;
  teamAName: string;
  teamBName?: string | null;
  teamAScore: number;
  teamBScore: number;
  winnerEntryId?: string | null;
  status: "scheduled" | "ready" | "live" | "final";
  isBye: boolean;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  refereeName?: string | null;
  streamed?: boolean;
  teamAReady?: boolean;
  teamBReady?: boolean;
};

type State = {
  format: {
    mode: "fast_swiss" | "single_elimination";
    swissRounds: number;
    playoffCut: number;
    estimatedMinutes: number;
    lockedTeamCount: number;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
  matches: Match[];
  standings: Standing[];
};

type Announcement = {
  id: string;
  kind: "info" | "schedule" | "important" | "critical" | "result";
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
};

function timeLabel(minutes: number): string {
  if (!minutes) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}H ${rest}M` : `${hours}H`;
}

function clock(value?: string | null): string {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function stageLabel(match: Match): string {
  if (match.stage === "swiss") return `SWISS R${match.roundNumber}`;
  if (match.stage === "semifinal") return "SEMIFINAL";
  if (match.stage === "final") return "GRAND FINAL";
  return `ELIM R${match.roundNumber}`;
}

function initials(name?: string | null): string {
  if (!name) return "—";
  const cleaned = name.trim().split(/\s+/).filter(Boolean);
  if (cleaned.length === 1) return cleaned[0].slice(0, 3).toUpperCase();
  return cleaned.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function TeamMark({ name, small = false }: { name?: string | null; small?: boolean }) {
  return <span className={small ? "teamMark teamMarkSmall" : "teamMark"}>{initials(name)}</span>;
}

function MatchSpotlight({ match }: { match: Match }) {
  return (
    <article className={`matchdaySpotlight premiumMatchCard matchdaySpotlight_${match.status}`}>
      <div className="matchdaySpotlightTop">
        <div>
          <span className={`matchdayState matchdayState_${match.status}`}>
            {match.status === "live" && <i />}
            {match.status}
          </span>
          {match.streamed && <span className="matchdayStream">FEATURED</span>}
        </div>
        <small>{stageLabel(match)} · BO{match.bestOf} · {clock(match.scheduledAt)}</small>
      </div>

      <div className="premiumVersus">
        <div className="premiumTeamSide">
          <TeamMark name={match.teamAName} />
          <div>
            <span>{match.teamAReady ? "READY" : match.status === "final" ? "FINAL" : "TEAM A"}</span>
            <strong>{match.teamAName}</strong>
          </div>
          {match.status === "final" && <b>{match.teamAScore}</b>}
        </div>

        <div className="premiumVsCore">
          <span>M{String(match.matchNumber).padStart(2, "0")}</span>
          <strong>VS</strong>
          <small>BATCH {match.batchNumber}</small>
        </div>

        <div className="premiumTeamSide premiumTeamSideRight">
          {match.status === "final" && <b>{match.teamBScore}</b>}
          <div>
            <span>{match.isBye ? "BYE" : match.teamBReady ? "READY" : match.status === "final" ? "FINAL" : "TEAM B"}</span>
            <strong>{match.teamBName || "BYE"}</strong>
          </div>
          <TeamMark name={match.teamBName || "BYE"} />
        </div>
      </div>

      <footer className="premiumMatchFooter">
        <div><span>REFEREE</span><strong>{match.refereeName || "TBD"}</strong></div>
        <div><span>SCHEDULE</span><strong>{clock(match.scheduledAt)}</strong></div>
        <div><span>SERIES</span><strong>BEST OF {match.bestOf}</strong></div>
      </footer>
    </article>
  );
}

export default function TournamentLiveBoard({ slug }: { slug: string }) {
  const [state, setState] = useState<State | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const [stateResponse, announcementResponse] = await Promise.all([
        fetch(`/api/tournaments/${slug}/state`, { cache: "no-store" }),
        fetch(`/api/tournaments/${slug}/announcements`, { cache: "no-store" }),
      ]);
      const [statePayload, announcementPayload] = await Promise.all([
        stateResponse.json(),
        announcementResponse.json(),
      ]);

      if (!stateResponse.ok) throw new Error(statePayload.error ?? "Unable to load tournament state.");
      if (!announcementResponse.ok) throw new Error(announcementPayload.error ?? "Unable to load announcements.");

      setState(statePayload as State);
      setAnnouncements((announcementPayload.announcements ?? []) as Announcement[]);
      setLastSync(new Date());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load tournament state.");
    }
  }, [slug]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  const live = useMemo(() => (state?.matches ?? []).filter((match) => match.status === "live"), [state?.matches]);
  const ready = useMemo(() => (state?.matches ?? []).filter((match) => match.status === "ready"), [state?.matches]);
  const scheduled = useMemo(() => (state?.matches ?? []).filter((match) => match.status === "scheduled" && !match.isBye), [state?.matches]);
  const final = useMemo(() => (state?.matches ?? []).filter((match) => match.status === "final"), [state?.matches]);

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const match of state?.matches ?? []) {
      const key = `${match.stage}:${match.roundNumber}`;
      map.set(key, [...(map.get(key) ?? []), match]);
    }
    return [...map.values()];
  }, [state?.matches]);

  const spotlight = live.length > 0 ? live : ready.length > 0 ? ready : scheduled.slice(0, 4);
  const finalMatch = state?.matches.find((match) => match.stage === "final");
  const semifinalMatches = state?.matches.filter((match) => match.stage === "semifinal") ?? [];

  const champion = finalMatch?.status === "final"
    ? finalMatch.teamAScore > finalMatch.teamBScore
      ? finalMatch.teamAName
      : finalMatch.teamBName
    : null;

  const runnerUp = finalMatch?.status === "final"
    ? finalMatch.teamAScore > finalMatch.teamBScore
      ? finalMatch.teamBName
      : finalMatch.teamAName
    : null;

  const semifinalists = semifinalMatches
    .filter((match) => match.status === "final")
    .map((match) => match.teamAScore > match.teamBScore ? match.teamBName : match.teamAName)
    .filter(Boolean) as string[];

  if (error) {
    return (
      <section className="matchdayShell premiumMatchday">
        <div className="matchdayUnavailable">MATCHDAY FEED UNAVAILABLE · {error}</div>
      </section>
    );
  }

  const signal = live.length
    ? "LIVE NOW"
    : ready.length
      ? "MATCHES READY"
      : state?.format
        ? "TOURNAMENT ACTIVE"
        : "PRE-EVENT";

  return (
    <section className="matchdayShell premiumMatchday">
      <div className="matchdaySignalBar">
        <div className="matchdaySignalLeft">
          <i className={live.length ? "matchdaySignalLive" : ""} />
          <span>{signal}</span>
          <b>RIFTCORE // MATCHDAY</b>
        </div>
        <div className="matchdaySignalRight">
          <span>AUTO SYNC · 20S</span>
          <small>{lastSync ? `LAST ${lastSync.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "SYNCING"}</small>
        </div>
      </div>

      <div className="matchdayMasthead premiumMatchdayMasthead">
        <div>
          <span>TOURNAMENT #001 / COMPETITION SIGNAL</span>
          <h2>{state?.format ? "THE FIELD IS MOVING." : "THE FIELD IS FORMING."}</h2>
          <p>
            Live pairings, standings, announcements and results come from the
            same tournament state used by Riftcore operations.
          </p>
        </div>

        <div className="matchdayPulse premiumPulse">
          <article><span>LIVE</span><strong>{live.length}</strong><i className={live.length ? "pulseHot" : ""} /></article>
          <article><span>READY</span><strong>{ready.length}</strong><i /></article>
          <article><span>FINAL</span><strong>{final.length}</strong><i /></article>
          <article><span>FIELD</span><strong>{state?.format?.lockedTeamCount ?? "—"}</strong><i /></article>
        </div>
      </div>

      {announcements.length > 0 && (
        <div className="matchdayAnnouncements premiumAnnouncements">
          {announcements.slice(0, 3).map((announcement) => (
            <article key={announcement.id} className={`matchdayAnnouncement matchdayAnnouncement_${announcement.kind}`}>
              <div>
                <span>{announcement.kind}</span>
                {announcement.pinned && <b>PINNED</b>}
              </div>
              <h3>{announcement.title}</h3>
              <p>{announcement.body}</p>
              <small>{new Date(announcement.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}</small>
            </article>
          ))}
        </div>
      )}

      {!state?.format ? (
        <>
          <div className="matchdayPreflight premiumPreflight">
            <div><span>01</span><strong>ROSTER INTAKE</strong><p>Teams submit a validated 5+1 roster and captain identity.</p><i /></div>
            <div><span>02</span><strong>CHECK-IN</strong><p>The real field is confirmed before the engine takes a snapshot.</p><i /></div>
            <div><span>03</span><strong>FAST SWISS</strong><p>3 or 4 BO1 rounds based on the number of teams actually present.</p><i /></div>
            <div><span>04</span><strong>TOP 4 → FINAL</strong><p>BO3 semifinals feed directly into the BO3 championship match.</p></div>
          </div>

          <div className="placementPreview">
            <div className="matchdayBlockHead">
              <div><span>FINAL PLACEMENTS</span><strong>The podium is waiting.</strong></div>
              <small>LOCKED BY VERIFIED RESULTS</small>
            </div>
            <div className="placementPodium">
              <article className="placementSecond"><span>02</span><TeamMark name="TBD" /><strong>RUNNER-UP</strong><small>TBD</small></article>
              <article className="placementChampion"><span>01</span><TeamMark name="TBD" /><strong>CHAMPION</strong><small>TBD</small></article>
              <article className="placementThird"><span>03–04</span><TeamMark name="TBD" /><strong>TOP 4</strong><small>TBD</small></article>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="matchdayNowHeader premiumNowHeader">
            <div>
              <span>{live.length > 0 ? "NOW PLAYING" : ready.length > 0 ? "READY TO START" : "UP NEXT"}</span>
              <strong>
                {state.format.mode === "fast_swiss"
                  ? `${state.format.swissRounds}R FAST SWISS → TOP ${state.format.playoffCut}`
                  : "FAST SINGLE ELIMINATION"}
              </strong>
            </div>
            <div>
              <span>TARGET RUNTIME</span>
              <strong>{timeLabel(state.format.estimatedMinutes)}</strong>
            </div>
          </div>

          <div className="matchdaySpotlightGrid premiumSpotlightGrid">
            {spotlight.map((match) => <MatchSpotlight key={match.id} match={match} />)}
            {spotlight.length === 0 && (
              <div className="matchdayEmpty">No active or upcoming match is published yet.</div>
            )}
          </div>

          {state.format.mode === "fast_swiss" && state.standings.length > 0 && (
            <div className="matchdayStandingsBlock premiumStandingsBlock">
              <div className="matchdayBlockHead">
                <div><span>LIVE TABLE</span><strong>SWISS STANDINGS</strong></div>
                <small>WINS → BUCHHOLZ → GD → OPPONENT GD → SEED</small>
              </div>
              <div className="matchdayStandings premiumStandings">
                <div className="matchdayStandingsHead"><span>#</span><span>TEAM</span><span>W–L</span><span>BH</span><span>GD</span></div>
                {state.standings.map((standing) => (
                  <div className={standing.rank <= 4 ? "matchdayTopCut" : ""} key={standing.entryId}>
                    <b>{String(standing.rank).padStart(2, "0")}</b>
                    <span>
                      <TeamMark name={standing.teamName} small />
                      <span className="standingTeamCopy"><strong>{standing.teamName}</strong><small>{standing.teamTag || `SEED ${standing.seed}`}</small></span>
                    </span>
                    <span>{standing.wins}–{standing.losses}</span>
                    <span>{standing.buchholz}</span>
                    <span>{standing.gameDifferential > 0 ? "+" : ""}{standing.gameDifferential}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="placementPreview placementLive">
            <div className="matchdayBlockHead">
              <div><span>FINAL PLACEMENTS</span><strong>{champion ? "THE PODIUM IS LOCKED." : "ROAD TO THE PODIUM."}</strong></div>
              <small>{champion ? "TOURNAMENT RESULTS" : "UPDATES WITH PLAYOFF RESULTS"}</small>
            </div>
            <div className="placementPodium">
              <article className="placementSecond">
                <span>02</span>
                <TeamMark name={runnerUp || "TBD"} />
                <strong>RUNNER-UP</strong>
                <small>{runnerUp || "TBD"}</small>
              </article>
              <article className="placementChampion">
                <span>01</span>
                <TeamMark name={champion || "TBD"} />
                <strong>CHAMPION</strong>
                <small>{champion || "TBD"}</small>
              </article>
              <article className="placementThird">
                <span>03–04</span>
                <div className="placementTop4Marks">
                  <TeamMark name={semifinalists[0] || "TBD"} small />
                  <TeamMark name={semifinalists[1] || "TBD"} small />
                </div>
                <strong>TOP 4</strong>
                <small>{semifinalists.length ? semifinalists.join(" · ") : "TBD"}</small>
              </article>
            </div>
          </div>

          {grouped.length > 0 && (
            <div className="matchdayRoundsBlock premiumRoundsBlock">
              <div className="matchdayBlockHead">
                <div><span>ROUND ARCHIVE</span><strong>PAIRINGS + RESULTS</strong></div>
                <small>AUTO-REFRESHES EVERY 20 SECONDS</small>
              </div>
              <div className="matchdayRounds premiumRounds">
                {grouped.map((matches) => (
                  <article key={`${matches[0].stage}:${matches[0].roundNumber}`}>
                    <header>
                      <div><span>{stageLabel(matches[0])}</span><b>BO{matches[0].bestOf}</b></div>
                      <small>{matches.filter((match) => match.status === "final").length}/{matches.length} FINAL</small>
                    </header>
                    {matches.map((match) => (
                      <div className="matchdayRoundMatch premiumRoundMatch" key={match.id}>
                        <span className={`matchdayDot matchdayDot_${match.status}`} />
                        <div><TeamMark name={match.teamAName} small /><span><strong>{match.teamAName}</strong><small>{match.teamAReady ? "READY" : ""}</small></span></div>
                        <b>{match.status === "final" ? match.teamAScore : "—"}</b>
                        <em>:</em>
                        <b>{match.status === "final" ? match.teamBScore : "—"}</b>
                        <div className="matchdayTeamB"><span><strong>{match.teamBName || "BYE"}</strong><small>{match.teamBReady ? "READY" : ""}</small></span><TeamMark name={match.teamBName || "BYE"} small /></div>
                        <span>{match.status.toUpperCase()}</span>
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
