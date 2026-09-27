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
  rosterRole: "starter" | "substitute";
  isCaptain: boolean;
}

export interface TeamRegistrationInput {
  teamName: string;
  teamTag?: string;
  captainContact: string;
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
    players: Array.isArray(input.players)
      ? input.players.map((player) => ({
          ign: clean(player.ign ?? ""),
          mlbbId: clean(player.mlbbId ?? ""),
          serverId: clean(player.serverId ?? ""),
          rosterRole: player.rosterRole,
          isCaptain: Boolean(player.isCaptain),
        }))
      : [],
  };

  if (normalized.teamName.length < 2 || normalized.teamName.length > 40) {
    issues.push({
      field: "teamName",
      message: "Team name must be between 2 and 40 characters.",
    });
  }

  if (normalized.teamTag && normalized.teamTag.length > 8) {
    issues.push({
      field: "teamTag",
      message: "Team tag must be 8 characters or fewer.",
    });
  }

  if (normalized.captainContact.length < 3) {
    issues.push({
      field: "captainContact",
      message: "A captain contact method is required.",
    });
  }

  const starters = normalized.players.filter(
    (player) => player.rosterRole === "starter",
  );
  const substitutes = normalized.players.filter(
    (player) => player.rosterRole === "substitute",
  );

  if (starters.length !== teamSize) {
    issues.push({
      field: "players",
      message: `Exactly ${teamSize} starting players are required.`,
    });
  }

  if (substitutes.length > substituteSlots) {
    issues.push({
      field: "players",
      message: `A maximum of ${substituteSlots} substitute is allowed.`,
    });
  }

  normalized.players.forEach((player, index) => {
    if (!player.ign) {
      issues.push({
        field: `players.${index}.ign`,
        message: "IGN is required.",
      });
    }

    if (!/^\d+$/.test(player.mlbbId)) {
      issues.push({
        field: `players.${index}.mlbbId`,
        message: "MLBB account ID must contain digits only.",
      });
    }

    if (!/^\d+$/.test(player.serverId)) {
      issues.push({
        field: `players.${index}.serverId`,
        message: "Server ID must contain digits only.",
      });
    }
  });

  const captains = normalized.players.filter((player) => player.isCaptain);
  if (captains.length !== 1) {
    issues.push({
      field: "captain",
      message: "Exactly one starting player must be designated captain.",
    });
  } else if (captains[0].rosterRole !== "starter") {
    issues.push({
      field: "captain",
      message: "The captain must be one of the five starting players.",
    });
  }

  const identities = new Set<string>();
  normalized.players.forEach((player, index) => {
    if (!player.mlbbId || !player.serverId) return;

    const identity = `${player.mlbbId}:${player.serverId}`;
    if (identities.has(identity)) {
      issues.push({
        field: `players.${index}`,
        message: "The same MLBB account cannot appear twice on a roster.",
      });
    }
    identities.add(identity);
  });

  return issues.length === 0
    ? { ok: true, issues, value: normalized }
    : { ok: false, issues };
}

const matchTransitions: Record<MatchStatus, MatchStatus[]> = {
  scheduled: ["lobby_ready"],
  lobby_ready: ["scheduled", "live"],
  live: ["reported", "disputed"],
  reported: ["final", "disputed"],
  disputed: ["reported", "final"],
  final: [],
};

export function canTransitionMatch(
  from: MatchStatus,
  to: MatchStatus,
): boolean {
  return matchTransitions[from].includes(to);
}

export function assertMatchTransition(
  from: MatchStatus,
  to: MatchStatus,
): void {
  if (!canTransitionMatch(from, to)) {
    throw new Error(`Invalid match transition: ${from} -> ${to}`);
  }
}
