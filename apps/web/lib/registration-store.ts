import type {
  RegistrationStatus,
  TeamRegistrationInput,
} from "@riftcore/tournament-core";
import { getRiftcoreSupabase } from "@/lib/supabase";

export interface StoredRegistration {
  id: string;
  tournamentSlug: string;
  status: RegistrationStatus;
  submittedAt: string;
  team: TeamRegistrationInput;
}

type RegistrationRpcRow = {
  registration_id: string;
  registration_status: RegistrationStatus;
  submitted_at: string;
};

export async function saveRegistration(
  tournamentSlug: string,
  team: TeamRegistrationInput,
): Promise<StoredRegistration> {
  const supabase = getRiftcoreSupabase();

  const { data, error } = await supabase.rpc("submit_team_registration", {
    p_tournament_slug: tournamentSlug,
    p_team_name: team.teamName,
    p_team_tag: team.teamTag ?? null,
    p_captain_contact: team.captainContact,
    p_players: team.players,
  });

  if (error) {
    throw new Error(error.message);
  }

  const record = (data as RegistrationRpcRow[] | null)?.[0];

  if (!record) {
    throw new Error("Supabase did not return a registration record.");
  }

  return {
    id: record.registration_id,
    tournamentSlug,
    status: record.registration_status,
    submittedAt: record.submitted_at,
    team,
  };
}
