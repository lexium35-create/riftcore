"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Standing = {
  entryId: string;
  teamName: string;
  teamTag?: string | null;
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
  status: "scheduled" | "final";
  isBye: boolean;
};

type State = {
  format: {
    mode: "fast_swiss" | "single_elimination";
    swissRounds: number;
    playoffCut: number;
    estimatedMinutes: number;
    lockedTeamCount: number;
  } | null;
  matches: Match[];
  standings: Standing[];
};

function timeLabel(minutes: number): string {
  if (!minutes) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function stageLabel(match: Match): string {
  if (match.stage === "swiss") return `Swiss R${match.roundNumber}`;
  if (match.stage === "semifinal") return "Semifinal";
  if (match.stage === "final") return "Grand Final";
  return `Elimination R${match.roundNumber}`;
}

export default function TournamentLiveBoard({ slug }: { slug: string }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/tournaments/${slug}/state`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load tournament state.");
      setState(payload as State);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load tournament state.");
    }
  }, [slug]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const match of state?.matches ?? []) {
      const key = `${match.stage}:${match.roundNumber}`;
      map.set(key, [...(map.get(key) ?? []), match]);
    }
    return [...map.values()];
  }, [state?.matches]);

  if (error) {
    return <section className="liveBoardShell"><div className="liveBoardEmpty">Live board unavailable: {error}</div></section>;
  }

  if (!state?.format) {
    return (
      <section className="liveBoardShell">
        <div className="liveBoardHead">
          <div>
            <span>/ LIVE TOURNAMENT</span>
            <h2>Fast format locks after check-in.</h2>
          </div>
          <p>For Tournament #001, 9–12 teams use 3 Swiss BO1 rounds; 13–24 teams use 4. The Top 4 then play BO3 semifinals and a BO3 grand final.</p>
        </div>
        <div className="liveBoardEmpty">Pairings and standings appear here when tournament operations start the event.</div>
      </section>
    );
  }

  return (
    <section className="liveBoardShell">
      <div className="liveBoardHead">
        <div>
          <span>/ LIVE TOURNAMENT</span>
          <h2>{state.format.mode === "fast_swiss" ? `${state.format.swissRounds}R Fast Swiss → Top ${state.format.playoffCut}` : "Fast Single Elimination"}</h2>
        </div>
        <div className="liveBoardMeta">
          <div><span>LOCKED TEAMS</span><strong>{state.format.lockedTeamCount}</strong></div>
          <div><span>TARGET RUNTIME</span><strong>{timeLabel(state.format.estimatedMinutes)}</strong></div>
        </div>
      </div>

      {state.format.mode === "fast_swiss" && state.standings.length > 0 && (
        <div className="publicStandings">
          <div className="publicStandingsHead"><span>#</span><span>Team</span><span>W-L</span><span>Buchholz</span><span>GD</span></div>
          {state.standings.map((standing) => (
            <div className="publicStandingRow" key={standing.entryId}>
              <b>{standing.rank}</b>
              <div><strong>{standing.teamName}</strong><small>{standing.teamTag || "—"}</small></div>
              <span>{standing.wins}-{standing.losses}</span>
              <span>{standing.buchholz}</span>
              <span>{standing.gameDifferential > 0 ? "+" : ""}{standing.gameDifferential}</span>
            </div>
          ))}
        </div>
      )}

      {grouped.length > 0 && (
        <div className="publicRounds">
          {grouped.map((matches) => (
            <article className="publicRound" key={`${matches[0].stage}:${matches[0].roundNumber}`}>
              <div className="publicRoundTitle">
                <span>{stageLabel(matches[0])}</span>
                <small>{matches[0].bestOf === 1 ? "BO1" : `BO${matches[0].bestOf}`}</small>
              </div>
              {matches.map((match) => (
                <div className="publicMatch" key={match.id}>
                  <div><span>{match.teamAName}</span><strong>{match.status === "final" ? match.teamAScore : "—"}</strong></div>
                  <div><span>{match.teamBName || "BYE"}</span><strong>{match.status === "final" ? match.teamBScore : "—"}</strong></div>
                  <small>{match.isBye ? "ADVANCED" : match.status.toUpperCase()}</small>
                </div>
              ))}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
