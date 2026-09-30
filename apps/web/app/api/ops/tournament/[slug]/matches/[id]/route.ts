import { getRiftcoreSupabaseForToken } from "@/lib/supabase";

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
}

type EngineState = {
  format: {
    grandFinalBestOf: number;
  } | null;
  matches: Array<{
    id: string;
    stage: string;
    roundNumber: number;
    matchNumber: number;
    winnerEntryId: string | null;
    status: string;
  }>;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const token = bearer(request);
  if (!token) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const { slug, id } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | { teamAScore?: number; teamBScore?: number }
    | null;
  if (
    !Number.isInteger(body?.teamAScore) ||
    !Number.isInteger(body?.teamBScore)
  ) {
    return Response.json({ error: "A valid final score is required." }, { status: 400 });
  }

  const supabase = getRiftcoreSupabaseForToken(token);
  const { error } = await supabase.rpc("record_tournament_match_result", {
    p_match_id: id,
    p_team_a_score: body?.teamAScore,
    p_team_b_score: body?.teamBScore,
  });
  if (error) return Response.json({ error: error.message }, { status: 409 });

  const { data: stateData, error: stateError } = await supabase.rpc(
    "get_operator_tournament_engine_state",
    { p_tournament_slug: slug },
  );
  if (stateError) return Response.json({ error: stateError.message }, { status: 500 });
  const state = stateData as EngineState;

  const semifinals = (state.matches ?? []).filter(
    (match) => match.stage === "semifinal",
  );
  const finalExists = (state.matches ?? []).some((match) => match.stage === "final");

  if (
    semifinals.length === 2 &&
    semifinals.every((match) => match.status === "final" && match.winnerEntryId) &&
    !finalExists
  ) {
    const pairings = [
      {
        teamAEntryId: semifinals[0].winnerEntryId,
        teamBEntryId: semifinals[1].winnerEntryId,
        matchNumber: 1,
        batchNumber: 1,
      },
    ];
    const { error: finalError } = await supabase.rpc("create_tournament_round", {
      p_tournament_slug: slug,
      p_stage: "final",
      p_round_number: 1,
      p_best_of: state.format?.grandFinalBestOf ?? 3,
      p_pairings: pairings,
    });
    if (finalError) return Response.json({ error: finalError.message }, { status: 500 });
  }

  const { data: refreshed, error: refreshedError } = await supabase.rpc(
    "get_operator_tournament_engine_state",
    { p_tournament_slug: slug },
  );
  if (refreshedError) return Response.json({ error: refreshedError.message }, { status: 500 });
  return Response.json(refreshed);
}
