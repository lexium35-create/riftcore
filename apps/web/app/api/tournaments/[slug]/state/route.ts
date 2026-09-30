import {
  calculateSwissStandings,
  type TournamentEngineEntry,
  type TournamentEngineMatch,
} from "@riftcore/tournament-core";
import { getRiftcoreSupabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const supabase = getRiftcoreSupabase();
  const { data, error } = await supabase.rpc("get_public_tournament_engine_state", {
    p_tournament_slug: slug,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const state = (data ?? { format: null, entries: [], matches: [] }) as {
    format: unknown;
    entries: TournamentEngineEntry[];
    matches: TournamentEngineMatch[];
  };

  return Response.json({
    ...state,
    standings: calculateSwissStandings(state.entries ?? [], state.matches ?? []),
  });
}
