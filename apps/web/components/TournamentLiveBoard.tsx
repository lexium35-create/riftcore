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
  teamAName: string;
  teamBName?: string | null;
  teamAScore: number;
  teamBScore: number;
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
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
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
  if (match.stage === "swiss") return `Swiss Round ${match.roundNumber}`;
  if (match.stage === "semifinal") return "Semifinal";
  if (match.stage === "final") return "Grand Final";
  return `Elimination Round ${match.roundNumber}`;
}

function MatchSpotlight({ match }: { match: Match }) {
  return (
    <article className={`matchdaySpotlight matchdaySpotlight_${match.status}`}>
      <div className="matchdaySpotlightTop">
        <div>
          <span className={`matchdayState matchdayState_${match.status}`}>{match.status}</span>
          {match.streamed && <span className="matchdayStream">FEATURED</span>}
        </div>
        <small>{stageLabel(match)} · BO{match.bestOf} · {clock(match.scheduledAt)}</small>
      </div>

      <div className="matchdayVersus">
        <div>
          <span>{match.teamAReady ? "READY" : match.status === "final" ? "FINAL" : "TEAM A"}</span>
          <strong>{match.teamAName}</strong>
          {match.status === "final" && <b>{match.teamAScore}</b>}
        </div>
        <em>VS</em>
        <div>
          <span>{match.isBye ? "BYE" : match.teamBReady ? "READY" : match.status === "final" ? "FINAL" : "TEAM B"}</span>
          <strong>{match.teamBName || "BYE"}</strong>
          {match.status === "final" && <b>{match.teamBScore}</b>}
        </div>
      </div>

      <footer>
        <span>{match.refereeName ? `REF · ${match.refereeName}` : "REFEREE TBD"}</span>
        <span>BATCH {match.batchNumber} · MATCH {match.matchNumber}</span>
      </footer>
    </article>
  );
}

export default function TournamentLiveBoard({ slug }: { slug: string }) {
  const [state, setState] = useState<State | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const live = useMemo(
    () => (state?.matches ?? []).filter((match) => match.status === "live"),
    [state?.matches],
  );
  const ready = useMemo(
    () => (state?.matches ?? []).filter((match) => match.status === "ready"),
    [state?.matches],
  );
  const scheduled = useMemo(
    () => (state?.matches ?? []).filter((match) => match.status === "scheduled" && !match.isBye),
    [state?.matches],
  );
  const final = useMemo(
    () => (state?.matches ?? []).filter((match) => match.status === "final"),
    [state?.matches],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const match of state?.matches ?? []) {
      const key = `${match.stage}:${match.roundNumber}`;
      map.set(key, [...(map.get(key) ?? []), match]);
    }
    return [...map.values()];
  }, [state?.matches]);

  const spotlight = live.length > 0 ? live : ready.length > 0 ? ready : scheduled.slice(0, 4);

  if (error) {
    return (
      <section className="matchdayShell">
        <div className="matchdayUnavailable">MATCHDAY FEED UNAVAILABLE · {error}</div>
      </section>
    );
  }

  return (
    <section className="matchdayShell">
      <div className="matchdayMasthead">
        <div>
          <span>RIFTCORE / MATCHDAY</span>
          <h2>{state?.format ? "Tournament signal." : "Waiting for the field."}</h2>
          <p>
            Live pairings, tournament announcements, standings and match state
            update here as operations move the event forward.
          </p>
        </div>

        <div className="matchdayPulse">
          <article><span>LIVE</span><strong>{live.length}</strong></article>
          <article><span>READY</span><strong>{ready.length}</strong></article>
          <article><span>FINAL</span><strong>{final.length}</strong></article>
          <article><span>TEAMS</span><strong>{state?.format?.lockedTeamCount ?? "—"}</strong></article>
        </div>
      </div>

      {announcements.length > 0 && (
        <div className="matchdayAnnouncements">
          {announcements.slice(0, 4).map((announcement) => (
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
        <div className="matchdayPreflight">
          <div>
            <span>01</span>
            <strong>REGISTER + VERIFY</strong>
            <p>Teams enter the roster and staff clear valid entries.</p>
          </div>
          <div>
            <span>02</span>
            <strong>CHECK IN</strong>
            <p>The present field is confirmed before Round 1.</p>
          </div>
          <div>
            <span>03</span>
            <strong>LOCK FORMAT</strong>
            <p>9–12 teams → 3R Swiss. 13–24 → 4R Swiss. Top 4 playoffs.</p>
          </div>
          <div>
            <span>04</span>
            <strong>PLAY FAST</strong>
            <p>BO1 Swiss → BO3 semifinals → BO3 final.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="matchdayNowHeader">
            <div>
              <span>{live.length > 0 ? "NOW PLAYING" : ready.length > 0 ? "READY TO START" : "UP NEXT"}</span>
              <strong>
                {state.format.mode === "fast_swiss"
                  ? `${state.format.swissRounds}R Fast Swiss → Top ${state.format.playoffCut}`
                  : "Fast Single Elimination"}
              </strong>
            </div>
            <div>
              <span>TARGET RUNTIME</span>
              <strong>{timeLabel(state.format.estimatedMinutes)}</strong>
            </div>
          </div>

          <div className="matchdaySpotlightGrid">
            {spotlight.map((match) => <MatchSpotlight key={match.id} match={match} />)}
            {spotlight.length === 0 && (
              <div className="matchdayEmpty">
                No active or upcoming match is published yet.
              </div>
            )}
          </div>

          {state.format.mode === "fast_swiss" && state.standings.length > 0 && (
            <div className="matchdayStandingsBlock">
              <div className="matchdayBlockHead">
                <div><span>LIVE TABLE</span><strong>Swiss standings</strong></div>
                <small>Wins → Buchholz → GD → opponent GD → seed</small>
              </div>
              <div className="matchdayStandings">
                <div className="matchdayStandingsHead"><span>#</span><span>TEAM</span><span>W–L</span><span>BH</span><span>GD</span></div>
                {state.standings.map((standing) => (
                  <div className={standing.rank <= 4 ? "matchdayTopCut" : ""} key={standing.entryId}>
                    <b>{standing.rank}</b>
                    <span><strong>{standing.teamName}</strong><small>{standing.teamTag || `Seed ${standing.seed}`}</small></span>
                    <span>{standing.wins}–{standing.losses}</span>
                    <span>{standing.buchholz}</span>
                    <span>{standing.gameDifferential > 0 ? "+" : ""}{standing.gameDifferential}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {grouped.length > 0 && (
            <div className="matchdayRoundsBlock">
              <div className="matchdayBlockHead">
                <div><span>ROUND ARCHIVE</span><strong>Pairings + results</strong></div>
                <small>Auto-refreshes every 20 seconds</small>
              </div>
              <div className="matchdayRounds">
                {grouped.map((matches) => (
                  <article key={`${matches[0].stage}:${matches[0].roundNumber}`}>
                    <header>
                      <div><span>{stageLabel(matches[0])}</span><b>BO{matches[0].bestOf}</b></div>
                      <small>{matches.filter((match) => match.status === "final").length}/{matches.length} FINAL</small>
                    </header>
                    {matches.map((match) => (
                      <div className="matchdayRoundMatch" key={match.id}>
                        <span className={`matchdayDot matchdayDot_${match.status}`} />
                        <div><strong>{match.teamAName}</strong><small>{match.teamAReady ? "READY" : ""}</small></div>
                        <b>{match.status === "final" ? match.teamAScore : "—"}</b>
                        <em>:</em>
                        <b>{match.status === "final" ? match.teamBScore : "—"}</b>
                        <div className="matchdayTeamB"><strong>{match.teamBName || "BYE"}</strong><small>{match.teamBReady ? "READY" : ""}</small></div>
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
