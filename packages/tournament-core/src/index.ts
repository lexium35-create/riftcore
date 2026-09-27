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
