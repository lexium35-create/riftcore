export type TournamentStatus =
  | "draft"
  | "registration"
  | "check_in"
  | "live"
  | "completed"
  | "cancelled";

export type MatchStatus =
  | "scheduled"
  | "lobby_ready"
  | "live"
  | "reported"
  | "disputed"
  | "final";

export type RegistrationStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "withdrawn";

export interface Team {
  id: string;
  name: string;
  tag?: string;
  captainPlayerId: string;
  playerIds: string[];
  checkedIn: boolean;
}

export interface Player {
  id: string;
  ign: string;
  mlbbId: string;
  serverId: string;
  email?: string;
}

export interface Match {
  id: string;
  round: number;
  bestOf: number;
  teamAId?: string;
  teamBId?: string;
  scheduledAt?: string;
  lobbyId?: string;
  status: MatchStatus;
  winnerTeamId?: string;
}

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  game: "MLBB";
  date: string;
  timezone: string;
  status: TournamentStatus;
  teamSize: 5;
  substituteSlots: number;
  format: string | null;
  maxTeams: number | null;
}

export interface RegistrationPlayerInput {
  ign: string;
  mlbbId: string;
  serverId: string;
  email?: string;
  rosterRole: "starter" | "substitute";
  isCaptain: boolean;
}

export interface TeamRegistrationInput {
  teamName: string;
  teamTag?: string;
  captainContact: string;
  captainEmail: string;
  players: RegistrationPlayerInput[];
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface RegistrationValidation {
  ok: boolean;
  issues: ValidationIssue[];
  value?: TeamRegistrationInput;
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function cleanEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateTeamRegistration(
  input: TeamRegistrationInput,
  options: { teamSize?: number; substituteSlots?: number } = {},
): RegistrationValidation {
  const teamSize = options.teamSize ?? 5;
  const substituteSlots = options.substituteSlots ?? 1;
  const issues: ValidationIssue[] = [];

  const normalized: TeamRegistrationInput = {
    teamName: clean(input.teamName ?? ""),
    teamTag: input.teamTag ? clean(input.teamTag) : undefined,
    captainContact: clean(input.captainContact ?? ""),
    captainEmail: cleanEmail(input.captainEmail ?? ""),
    players: Array.isArray(input.players)
      ? input.players.map((player) => ({
          ign: clean(player.ign ?? ""),
          mlbbId: clean(player.mlbbId ?? ""),
          serverId: clean(player.serverId ?? ""),
          email: player.email ? cleanEmail(player.email) : undefined,
          rosterRole: player.rosterRole,
          isCaptain: Boolean(player.isCaptain),
        }))
      : [],
  };

  if (normalized.teamName.length < 2 || normalized.teamName.length > 40) {
    issues.push({ field: "teamName", message: "Team name must be between 2 and 40 characters." });
  }

  if (normalized.teamTag && normalized.teamTag.length > 8) {
    issues.push({ field: "teamTag", message: "Team tag must be 8 characters or fewer." });
  }

  if (normalized.captainContact.length < 3) {
    issues.push({ field: "captainContact", message: "A captain contact method is required." });
  }

  if (!validEmail(normalized.captainEmail)) {
    issues.push({ field: "captainEmail", message: "A valid captain email address is required." });
  }

  const starters = normalized.players.filter((player) => player.rosterRole === "starter");
  const substitutes = normalized.players.filter((player) => player.rosterRole === "substitute");

  if (starters.length !== teamSize) {
    issues.push({ field: "players", message: `Exactly ${teamSize} starting players are required.` });
  }

  if (substitutes.length > substituteSlots) {
    issues.push({ field: "players", message: `A maximum of ${substituteSlots} substitute is allowed.` });
  }

  normalized.players.forEach((player, index) => {
    if (!player.ign) issues.push({ field: `players.${index}.ign`, message: "IGN is required." });
    if (!/^\d+$/.test(player.mlbbId)) issues.push({ field: `players.${index}.mlbbId`, message: "MLBB account ID must contain digits only." });
    if (!/^\d+$/.test(player.serverId)) issues.push({ field: `players.${index}.serverId`, message: "Server ID must contain digits only." });
    if (player.email && !validEmail(player.email)) issues.push({ field: `players.${index}.email`, message: "Player email must be valid or left empty." });
  });

  const captains = normalized.players.filter((player) => player.isCaptain);
  if (captains.length !== 1) {
    issues.push({ field: "captain", message: "Exactly one starting player must be designated captain." });
  } else if (captains[0].rosterRole !== "starter") {
    issues.push({ field: "captain", message: "The captain must be one of the five starting players." });
  }

  const identities = new Set<string>();
  normalized.players.forEach((player, index) => {
    if (!player.mlbbId || !player.serverId) return;
    const identity = `${player.mlbbId}:${player.serverId}`;
    if (identities.has(identity)) {
      issues.push({ field: `players.${index}`, message: "The same MLBB account cannot appear twice on a roster." });
    }
    identities.add(identity);
  });

  return issues.length === 0 ? { ok: true, issues, value: normalized } : { ok: false, issues };
}

const matchTransitions: Record<MatchStatus, MatchStatus[]> = {
  scheduled: ["lobby_ready"],
  lobby_ready: ["scheduled", "live"],
  live: ["reported", "disputed"],
  reported: ["final", "disputed"],
  disputed: ["reported", "final"],
  final: [],
};

export function canTransitionMatch(from: MatchStatus, to: MatchStatus): boolean {
  return matchTransitions[from].includes(to);
}

export function assertMatchTransition(from: MatchStatus, to: MatchStatus): void {
  if (!canTransitionMatch(from, to)) throw new Error(`Invalid match transition: ${from} -> ${to}`);
}


export type FastTournamentMode = "single_elimination" | "fast_swiss";
export type TournamentMatchStage =
  | "swiss"
  | "single_elimination"
  | "semifinal"
  | "final";

export interface FastFormatRecommendation {
  mode: FastTournamentMode;
  label: string;
  swissRounds: number;
  playoffCut: number;
  swissBestOf: number;
  playoffBestOf: number;
  grandFinalBestOf: number;
  maxConcurrentMatches: number;
  swissSlotMinutes: number;
  playoffSlotMinutes: number;
  bufferMinutes: number;
  estimatedMinutes: number;
  warnings: string[];
}

export interface TournamentEngineEntry {
  id: string;
  seed: number;
  byeCount: number;
  teamName: string;
  teamTag?: string | null;
}

export interface TournamentEngineMatch {
  id?: string;
  stage: TournamentMatchStage;
  roundNumber: number;
  matchNumber: number;
  batchNumber: number;
  bestOf: number;
  teamAEntryId: string;
  teamBEntryId?: string | null;
  teamAName?: string | null;
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
}

export interface SwissStanding {
  entryId: string;
  teamName: string;
  teamTag?: string | null;
  seed: number;
  played: number;
  wins: number;
  losses: number;
  gameWins: number;
  gameLosses: number;
  gameDifferential: number;
  buchholz: number;
  opponentGameDifferential: number;
  byeCount: number;
  rank: number;
}

export interface TournamentPairing {
  teamAEntryId: string;
  teamBEntryId: string | null;
  matchNumber: number;
  batchNumber: number;
}

export function estimateFastTournamentMinutes(
  teamCount: number,
  mode: FastTournamentMode,
  swissRounds: number,
  maxConcurrentMatches = 8,
  swissSlotMinutes = 35,
  playoffSlotMinutes = 70,
  bufferMinutes = 25,
): number {
  if (teamCount < 2) return 0;
  const concurrency = Math.max(1, maxConcurrentMatches);

  if (mode === "fast_swiss") {
    const matchesPerRound = Math.floor(teamCount / 2);
    const swissBatches = Math.max(1, Math.ceil(matchesPerRound / concurrency));
    const swissMinutes = swissRounds * swissBatches * swissSlotMinutes;
    const semifinalMinutes = Math.ceil(2 / concurrency) * playoffSlotMinutes;
    return swissMinutes + semifinalMinutes + playoffSlotMinutes + bufferMinutes;
  }

  let active = teamCount;
  let minutes = bufferMinutes;
  while (active > 2) {
    const matches = Math.floor(active / 2);
    minutes += Math.max(1, Math.ceil(matches / concurrency)) * swissSlotMinutes;
    active = Math.ceil(active / 2);
  }
  return minutes + playoffSlotMinutes;
}

export function recommendFastFormat(
  teamCount: number,
  maxConcurrentMatches = 8,
): FastFormatRecommendation {
  const common = {
    swissBestOf: 1,
    playoffBestOf: 3,
    grandFinalBestOf: 3,
    maxConcurrentMatches: Math.max(1, maxConcurrentMatches),
    swissSlotMinutes: 35,
    playoffSlotMinutes: 70,
    bufferMinutes: 25,
  };

  if (teamCount < 2) {
    return {
      ...common,
      mode: "single_elimination",
      label: "Waiting for teams",
      swissRounds: 0,
      playoffCut: 0,
      estimatedMinutes: 0,
      warnings: ["At least two checked-in teams are required to start."],
    };
  }

  if (teamCount <= 8) {
    const estimatedMinutes = estimateFastTournamentMinutes(
      teamCount,
      "single_elimination",
      0,
      common.maxConcurrentMatches,
      common.swissSlotMinutes,
      common.playoffSlotMinutes,
      common.bufferMinutes,
    );
    return {
      ...common,
      mode: "single_elimination",
      label: "Fast single elimination",
      swissRounds: 0,
      playoffCut: 0,
      estimatedMinutes,
      warnings: [],
    };
  }

  const swissRounds = teamCount <= 12 ? 3 : teamCount <= 24 ? 4 : 5;
  const warnings =
    teamCount > 24
      ? ["This field is larger than Tournament #001's intended 24-team fast format."]
      : [];
  const estimatedMinutes = estimateFastTournamentMinutes(
    teamCount,
    "fast_swiss",
    swissRounds,
    common.maxConcurrentMatches,
    common.swissSlotMinutes,
    common.playoffSlotMinutes,
    common.bufferMinutes,
  );

  return {
    ...common,
    mode: "fast_swiss",
    label: `${swissRounds}-round Fast Swiss → Top 4`,
    swissRounds,
    playoffCut: 4,
    estimatedMinutes,
    warnings,
  };
}

export function calculateSwissStandings(
  entries: TournamentEngineEntry[],
  matches: TournamentEngineMatch[],
): SwissStanding[] {
  const swissMatches = matches.filter(
    (match) => match.stage === "swiss" && match.status === "final",
  );
  const rows = new Map<
    string,
    Omit<SwissStanding, "buchholz" | "opponentGameDifferential" | "rank">
  >();
  const opponents = new Map<string, string[]>();

  for (const entry of entries) {
    rows.set(entry.id, {
      entryId: entry.id,
      teamName: entry.teamName,
      teamTag: entry.teamTag,
      seed: entry.seed,
      played: 0,
      wins: 0,
      losses: 0,
      gameWins: 0,
      gameLosses: 0,
      gameDifferential: 0,
      byeCount: entry.byeCount,
    });
    opponents.set(entry.id, []);
  }

  for (const match of swissMatches) {
    const a = rows.get(match.teamAEntryId);
    const b = match.teamBEntryId ? rows.get(match.teamBEntryId) : undefined;
    if (!a) continue;

    a.played += 1;
    a.gameWins += match.teamAScore;
    a.gameLosses += match.teamBScore;

    if (b) {
      b.played += 1;
      b.gameWins += match.teamBScore;
      b.gameLosses += match.teamAScore;
      opponents.get(a.entryId)?.push(b.entryId);
      opponents.get(b.entryId)?.push(a.entryId);
    }

    if (match.winnerEntryId === a.entryId) {
      a.wins += 1;
      if (b) b.losses += 1;
    } else if (b && match.winnerEntryId === b.entryId) {
      b.wins += 1;
      a.losses += 1;
    }
  }

  for (const row of rows.values()) {
    row.gameDifferential = row.gameWins - row.gameLosses;
  }

  const standings = [...rows.values()].map((row) => {
    const opponentRows = (opponents.get(row.entryId) ?? [])
      .map((id) => rows.get(id))
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    return {
      ...row,
      buchholz: opponentRows.reduce((sum, opponent) => sum + opponent.wins, 0),
      opponentGameDifferential: opponentRows.reduce(
        (sum, opponent) => sum + opponent.gameDifferential,
        0,
      ),
      rank: 0,
    };
  });

  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    if (b.gameDifferential !== a.gameDifferential) {
      return b.gameDifferential - a.gameDifferential;
    }
    if (b.opponentGameDifferential !== a.opponentGameDifferential) {
      return b.opponentGameDifferential - a.opponentGameDifferential;
    }
    return a.seed - b.seed;
  });

  return standings.map((standing, index) => ({
    ...standing,
    rank: index + 1,
  }));
}

function previousSwissPairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

export function buildSwissPairings(
  entries: TournamentEngineEntry[],
  matches: TournamentEngineMatch[],
  roundNumber: number,
  maxConcurrentMatches = 8,
): TournamentPairing[] {
  if (entries.length < 2) return [];

  const concurrency = Math.max(1, maxConcurrentMatches);
  const priorPairs = new Set(
    matches
      .filter(
        (match) =>
          match.stage === "swiss" &&
          Boolean(match.teamBEntryId),
      )
      .map((match) =>
        previousSwissPairKey(
          match.teamAEntryId,
          match.teamBEntryId as string,
        ),
      ),
  );

  if (roundNumber === 1) {
    const seeded = [...entries].sort((a, b) => a.seed - b.seed);
    const pairings: TournamentPairing[] = [];
    let bye: TournamentEngineEntry | null = null;

    if (seeded.length % 2 === 1) {
      bye =
        [...seeded].reverse().find((entry) => entry.byeCount === 0) ??
        seeded[seeded.length - 1];
      seeded.splice(
        seeded.findIndex((entry) => entry.id === bye?.id),
        1,
      );
    }

    const half = seeded.length / 2;
    for (let index = 0; index < half; index += 1) {
      const matchIndex = pairings.length;
      pairings.push({
        teamAEntryId: seeded[index].id,
        teamBEntryId: seeded[index + half].id,
        matchNumber: matchIndex + 1,
        batchNumber: Math.floor(matchIndex / concurrency) + 1,
      });
    }

    if (bye) {
      pairings.push({
        teamAEntryId: bye.id,
        teamBEntryId: null,
        matchNumber: pairings.length + 1,
        batchNumber: 1,
      });
    }

    return pairings;
  }

  const standings = calculateSwissStandings(entries, matches);
  const standingById = new Map(
    standings.map((standing, index) => [
      standing.entryId,
      { standing, index },
    ]),
  );
  const remaining = standings.map((standing) => standing.entryId);
  let byeEntryId: string | null = null;

  if (remaining.length % 2 === 1) {
    const byeStanding =
      [...standings]
        .reverse()
        .find((standing) => standing.byeCount === 0) ??
      standings[standings.length - 1];
    byeEntryId = byeStanding.entryId;
    remaining.splice(remaining.indexOf(byeEntryId), 1);
  }

  const pairings: TournamentPairing[] = [];

  while (remaining.length > 0) {
    const teamAEntryId = remaining.shift() as string;
    const aMeta = standingById.get(teamAEntryId);
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    remaining.forEach((candidateId, candidateIndex) => {
      const bMeta = standingById.get(candidateId);
      if (!aMeta || !bMeta) return;
      const rematch = priorPairs.has(
        previousSwissPairKey(teamAEntryId, candidateId),
      );
      const scoreGap = Math.abs(
        aMeta.standing.wins - bMeta.standing.wins,
      );
      const highLowPreference = -bMeta.index;
      const score =
        (rematch ? 100000 : 0) +
        scoreGap * 1000 +
        highLowPreference;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = candidateIndex;
      }
    });

    const teamBEntryId = remaining.splice(bestIndex, 1)[0];
    const matchIndex = pairings.length;
    pairings.push({
      teamAEntryId,
      teamBEntryId,
      matchNumber: matchIndex + 1,
      batchNumber: Math.floor(matchIndex / concurrency) + 1,
    });
  }

  if (byeEntryId) {
    pairings.push({
      teamAEntryId: byeEntryId,
      teamBEntryId: null,
      matchNumber: pairings.length + 1,
      batchNumber: 1,
    });
  }

  return pairings;
}

export function buildTopFourPairings(
  standings: SwissStanding[],
  maxConcurrentMatches = 8,
): TournamentPairing[] {
  if (standings.length < 4) return [];
  const top = standings.slice(0, 4);
  return [
    {
      teamAEntryId: top[0].entryId,
      teamBEntryId: top[3].entryId,
      matchNumber: 1,
      batchNumber: 1,
    },
    {
      teamAEntryId: top[1].entryId,
      teamBEntryId: top[2].entryId,
      matchNumber: 2,
      batchNumber: maxConcurrentMatches >= 2 ? 1 : 2,
    },
  ];
}

export function buildSingleEliminationFirstRound(
  entries: TournamentEngineEntry[],
  maxConcurrentMatches = 8,
): TournamentPairing[] {
  const seeded = [...entries].sort((a, b) => a.seed - b.seed);
  const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(2, seeded.length)));
  const byeCount = bracketSize - seeded.length;
  const pairings: TournamentPairing[] = [];
  let matchNumber = 1;

  for (let index = 0; index < byeCount; index += 1) {
    pairings.push({
      teamAEntryId: seeded[index].id,
      teamBEntryId: null,
      matchNumber: matchNumber++,
      batchNumber: 1,
    });
  }

  let left = byeCount;
  let right = seeded.length - 1;
  while (left < right) {
    const matchIndex = pairings.length;
    pairings.push({
      teamAEntryId: seeded[left].id,
      teamBEntryId: seeded[right].id,
      matchNumber: matchNumber++,
      batchNumber:
        Math.floor((matchIndex - byeCount) / Math.max(1, maxConcurrentMatches)) +
        1,
    });
    left += 1;
    right -= 1;
  }

  return pairings;
}
