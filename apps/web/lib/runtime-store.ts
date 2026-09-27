import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  RegistrationStatus,
  TeamRegistrationInput,
} from "@riftcore/tournament-core";

export interface StoredRegistration {
  id: string;
  tournamentSlug: string;
  status: RegistrationStatus;
  submittedAt: string;
  team: TeamRegistrationInput;
}

interface RuntimeState {
  registrations: StoredRegistration[];
}

const emptyState: RuntimeState = {
  registrations: [],
};

function runtimeFile(): string {
  return (
    process.env.RIFTCORE_RUNTIME_FILE ??
    path.resolve(process.cwd(), "../../.riftcore/runtime.json")
  );
}

async function readState(): Promise<RuntimeState> {
  if (process.env.RIFTCORE_STORAGE_MODE === "disabled") {
    return emptyState;
  }

  try {
    const raw = await fs.readFile(runtimeFile(), "utf8");
    const parsed = JSON.parse(raw) as RuntimeState;
    return {
      registrations: Array.isArray(parsed.registrations)
        ? parsed.registrations
        : [],
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return emptyState;
    throw error;
  }
}

async function writeState(state: RuntimeState): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "File runtime storage is development-only. Configure a production storage adapter before deployment.",
    );
  }

  const file = runtimeFile();
  await fs.mkdir(path.dirname(file), { recursive: true });

  const temporary = `${file}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(temporary, file);
}

export async function saveRegistration(
  tournamentSlug: string,
  team: TeamRegistrationInput,
): Promise<StoredRegistration> {
  const state = await readState();

  const incomingIdentities = new Set(
    team.players.map((player) => `${player.mlbbId}:${player.serverId}`),
  );

  const conflict = state.registrations.find(
    (registration) =>
      registration.tournamentSlug === tournamentSlug &&
      registration.status !== "rejected" &&
      registration.status !== "withdrawn" &&
      registration.team.players.some((player) =>
        incomingIdentities.has(`${player.mlbbId}:${player.serverId}`),
      ),
  );

  if (conflict) {
    throw new Error(
      "One or more MLBB accounts are already registered for this tournament.",
    );
  }

  const record: StoredRegistration = {
    id: randomUUID(),
    tournamentSlug,
    status: "pending",
    submittedAt: new Date().toISOString(),
    team,
  };

  state.registrations.push(record);
  await writeState(state);

  return record;
}

export async function getTournamentRuntimeSummary(tournamentSlug: string) {
  const state = await readState();
  const records = state.registrations.filter(
    (registration) => registration.tournamentSlug === tournamentSlug,
  );

  return {
    total: records.length,
    pending: records.filter((record) => record.status === "pending").length,
    verified: records.filter((record) => record.status === "verified").length,
    rejected: records.filter((record) => record.status === "rejected").length,
    withdrawn: records.filter((record) => record.status === "withdrawn").length,
  };
}
