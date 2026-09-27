import { promises as fs } from "node:fs";
import path from "node:path";
import type { Tournament } from "@riftcore/tournament-core";

export interface TournamentConfig extends Tournament {
  registration: {
    opensAt: string | null;
    closesAt: string | null;
    checkInOpensAt: string | null;
    checkInClosesAt: string | null;
  };
  competitive: {
    defaultBestOf: number | null;
    grandFinalBestOf: number | null;
    thirdPlaceMatch: boolean | null;
  };
  prizePool: {
    currency: string;
    total: number | null;
    distribution: unknown[];
  };
  links: Record<string, string | null>;
}

function tournamentDataDir(): string {
  return (
    process.env.RIFTCORE_DATA_DIR ??
    path.resolve(process.cwd(), "../../data/tournaments")
  );
}

export async function listTournaments(): Promise<TournamentConfig[]> {
  const directory = tournamentDataDir();
  const files = await fs.readdir(directory);

  const records = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const raw = await fs.readFile(path.join(directory, file), "utf8");
        return JSON.parse(raw) as TournamentConfig;
      }),
  );

  return records.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getTournamentBySlug(
  slug: string,
): Promise<TournamentConfig | null> {
  const tournaments = await listTournaments();
  return tournaments.find((tournament) => tournament.slug === slug) ?? null;
}
