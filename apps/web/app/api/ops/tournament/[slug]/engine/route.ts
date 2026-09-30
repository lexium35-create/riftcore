import {
  buildSingleEliminationFirstRound,
  buildSwissPairings,
  buildTopFourPairings,
  calculateSwissStandings,
  recommendFastFormat,
  type TournamentEngineEntry,
  type TournamentEngineMatch,
} from "@riftcore/tournament-core";
import { getRiftcoreSupabaseForToken } from "@/lib/supabase";

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
}

type EngineState = {
  format: {
    priority: string;
    mode: "fast_swiss" | "single_elimination";
    swissRounds: number;
    playoffCut: number;
    swissBestOf: number;
    playoffBestOf: number;
    grandFinalBestOf: number;
    maxConcurrentMatches: number;
    estimatedMinutes: number;
    lockedTeamCount: number;
  } | null;
  entries: TournamentEngineEntry[];
  matches: TournamentEngineMatch[];
};

async function getState(supabase: ReturnType<typeof getRiftcoreSupabaseForToken>, slug: string) {
  const { data, error } = await supabase.rpc("get_operator_tournament_engine_state", {
    p_tournament_slug: slug,
  });
  if (error) throw new Error(error.message);
  const state = (data ?? { format: null, entries: [], matches: [] }) as EngineState;
  return {
    ...state,
    standings: calculateSwissStandings(state.entries ?? [], state.matches ?? []),
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const token = bearer(request);
  if (!token) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const { slug } = await context.params;
  const supabase = getRiftcoreSupabaseForToken(token);

  try {
    return Response.json(await getState(supabase, slug));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load tournament engine." },
      { status: 403 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const token = bearer(request);
  if (!token) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const { slug } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | { action?: "start" | "next_round" | "create_playoffs"; maxConcurrentMatches?: number }
    | null;
  if (!body?.action) return Response.json({ error: "Action is required." }, { status: 400 });

  const supabase = getRiftcoreSupabaseForToken(token);

  try {
    if (body.action === "start") {
      const { data: registrations, error: registrationsError } = await supabase.rpc(
        "list_tournament_registrations",
        { p_tournament_slug: slug },
      );
      if (registrationsError) throw new Error(registrationsError.message);

      const eligible = ((registrations ?? []) as Array<{
        registration_status: string;
        checked_in: boolean;
      }>).filter(
        (registration) =>
          registration.registration_status === "verified" &&
          registration.checked_in === true,
      );
      const recommendation = recommendFastFormat(
        eligible.length,
        body.maxConcurrentMatches ?? 8,
      );
      if (eligible.length < 2) {
        throw new Error("At least two verified, checked-in teams are required.");
      }

      const { error: startError } = await supabase.rpc("start_tournament_engine", {
        p_tournament_slug: slug,
        p_mode: recommendation.mode,
        p_swiss_rounds: recommendation.swissRounds,
        p_playoff_cut: recommendation.playoffCut,
        p_swiss_best_of: recommendation.swissBestOf,
        p_playoff_best_of: recommendation.playoffBestOf,
        p_grand_final_best_of: recommendation.grandFinalBestOf,
        p_max_concurrent_matches: recommendation.maxConcurrentMatches,
        p_swiss_slot_minutes: recommendation.swissSlotMinutes,
        p_playoff_slot_minutes: recommendation.playoffSlotMinutes,
        p_buffer_minutes: recommendation.bufferMinutes,
        p_estimated_minutes: recommendation.estimatedMinutes,
      });
      if (startError) throw new Error(startError.message);

      const state = await getState(supabase, slug);
      const pairings =
        recommendation.mode === "fast_swiss"
          ? buildSwissPairings(
              state.entries,
              state.matches,
              1,
              recommendation.maxConcurrentMatches,
            )
          : buildSingleEliminationFirstRound(
              state.entries,
              recommendation.maxConcurrentMatches,
            );

      const { error: roundError } = await supabase.rpc("create_tournament_round", {
        p_tournament_slug: slug,
        p_stage: recommendation.mode === "fast_swiss" ? "swiss" : "single_elimination",
        p_round_number: 1,
        p_best_of: recommendation.swissBestOf,
        p_pairings: pairings,
      });
      if (roundError) throw new Error(roundError.message);

      return Response.json(await getState(supabase, slug));
    }

    const state = await getState(supabase, slug);
    if (!state.format) throw new Error("Tournament engine has not been started.");

    if (body.action === "next_round") {
      if (state.format.mode === "fast_swiss") {
        const swissMatches = state.matches.filter((match) => match.stage === "swiss");
        const currentRound = swissMatches.reduce(
          (max, match) => Math.max(max, match.roundNumber),
          0,
        );
        const currentMatches = swissMatches.filter(
          (match) => match.roundNumber === currentRound,
        );
        if (currentMatches.some((match) => match.status !== "final")) {
          throw new Error("Finish every match in the current Swiss round first.");
        }
        if (currentRound >= state.format.swissRounds) {
          throw new Error("All configured Swiss rounds are complete.");
        }

        const nextRound = currentRound + 1;
        const pairings = buildSwissPairings(
          state.entries,
          state.matches,
          nextRound,
          state.format.maxConcurrentMatches,
        );
        const { error } = await supabase.rpc("create_tournament_round", {
          p_tournament_slug: slug,
          p_stage: "swiss",
          p_round_number: nextRound,
          p_best_of: state.format.swissBestOf,
          p_pairings: pairings,
        });
        if (error) throw new Error(error.message);
        return Response.json(await getState(supabase, slug));
      }

      const elimination = state.matches.filter(
        (match) => match.stage === "single_elimination",
      );
      const currentRound = elimination.reduce(
        (max, match) => Math.max(max, match.roundNumber),
        0,
      );
      const current = elimination.filter((match) => match.roundNumber === currentRound);
      if (current.some((match) => match.status !== "final")) {
        throw new Error("Finish the current elimination round first.");
      }
      const winners = current
        .map((match) => match.winnerEntryId)
        .filter((value): value is string => Boolean(value));
      if (winners.length <= 1) {
        throw new Error("The elimination bracket is already complete.");
      }

      const pairings = [];
      for (let index = 0; index < winners.length; index += 2) {
        pairings.push({
          teamAEntryId: winners[index],
          teamBEntryId: winners[index + 1] ?? null,
          matchNumber: Math.floor(index / 2) + 1,
          batchNumber:
            Math.floor(
              Math.floor(index / 2) / state.format.maxConcurrentMatches,
            ) + 1,
        });
      }
      const isFinal = winners.length <= 2;
      const { error } = await supabase.rpc("create_tournament_round", {
        p_tournament_slug: slug,
        p_stage: isFinal ? "final" : "single_elimination",
        p_round_number: currentRound + 1,
        p_best_of: isFinal
          ? state.format.grandFinalBestOf
          : state.format.swissBestOf,
        p_pairings: pairings,
      });
      if (error) throw new Error(error.message);
      return Response.json(await getState(supabase, slug));
    }

    if (state.format.mode !== "fast_swiss") {
      throw new Error("Top 4 playoffs apply only to Fast Swiss.");
    }
    const swissMatches = state.matches.filter((match) => match.stage === "swiss");
    const lastRound = swissMatches.reduce(
      (max, match) => Math.max(max, match.roundNumber),
      0,
    );
    if (
      lastRound < state.format.swissRounds ||
      swissMatches.some((match) => match.status !== "final")
    ) {
      throw new Error("Finish every configured Swiss round before locking Top 4.");
    }
    if (state.matches.some((match) => match.stage === "semifinal")) {
      throw new Error("Top 4 playoffs already exist.");
    }

    const pairings = buildTopFourPairings(
      state.standings,
      state.format.maxConcurrentMatches,
    );
    const { error } = await supabase.rpc("create_tournament_round", {
      p_tournament_slug: slug,
      p_stage: "semifinal",
      p_round_number: 1,
      p_best_of: state.format.playoffBestOf,
      p_pairings: pairings,
    });
    if (error) throw new Error(error.message);

    return Response.json(await getState(supabase, slug));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Tournament action failed." },
      { status: 409 },
    );
  }
}
