import { getRiftcoreSupabaseForToken } from "@/lib/supabase";

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
}

async function loadOperations(
  supabase: ReturnType<typeof getRiftcoreSupabaseForToken>,
  slug: string,
) {
  const [matchOps, announcements, incidents, activity] = await Promise.all([
    supabase.rpc("get_operator_match_ops", { p_tournament_slug: slug }),
    supabase.rpc("get_public_tournament_announcements", { p_tournament_slug: slug }),
    supabase.rpc("get_operator_tournament_incidents", { p_tournament_slug: slug }),
    supabase.rpc("get_operator_activity_feed", { p_tournament_slug: slug }),
  ]);

  const firstError =
    matchOps.error ?? announcements.error ?? incidents.error ?? activity.error;
  if (firstError) throw new Error(firstError.message);

  return {
    matchOps: matchOps.data ?? [],
    announcements: announcements.data ?? [],
    incidents: incidents.data ?? [],
    activity: activity.data ?? [],
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
    return Response.json(await loadOperations(supabase, slug));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load match operations." },
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
    | {
        action?: "update_match" | "announcement" | "archive_announcement" | "incident" | "resolve_incident";
        matchId?: string;
        status?: "scheduled" | "ready" | "live";
        roomCode?: string;
        roomPassword?: string;
        refereeName?: string;
        scheduledAt?: string | null;
        streamed?: boolean;
        teamAReady?: boolean;
        teamBReady?: boolean;
        opsNote?: string;
        kind?: "info" | "schedule" | "important" | "critical" | "result";
        title?: string;
        message?: string;
        pinned?: boolean;
        announcementId?: string;
        severity?: "normal" | "important" | "critical";
        category?: "match" | "lobby" | "no_show" | "connectivity" | "conduct" | "score" | "other";
        description?: string;
        incidentId?: string;
      }
    | null;

  if (!body?.action) return Response.json({ error: "Action is required." }, { status: 400 });
  const supabase = getRiftcoreSupabaseForToken(token);

  try {
    if (body.action === "update_match") {
      if (!body.matchId) throw new Error("Match is required.");
      const { error } = await supabase.rpc("update_tournament_match_ops", {
        p_match_id: body.matchId,
        p_status: body.status ?? null,
        p_room_code: body.roomCode ?? null,
        p_room_password: body.roomPassword ?? null,
        p_referee_name: body.refereeName ?? null,
        p_scheduled_at: body.scheduledAt ?? null,
        p_streamed: body.streamed ?? null,
        p_team_a_ready: body.teamAReady ?? null,
        p_team_b_ready: body.teamBReady ?? null,
        p_ops_note: body.opsNote ?? null,
      });
      if (error) throw new Error(error.message);
    } else if (body.action === "announcement") {
      const { error } = await supabase.rpc("create_tournament_announcement", {
        p_tournament_slug: slug,
        p_kind: body.kind ?? "info",
        p_title: body.title ?? "",
        p_body: body.message ?? "",
        p_pinned: body.pinned ?? false,
      });
      if (error) throw new Error(error.message);
    } else if (body.action === "archive_announcement") {
      if (!body.announcementId) throw new Error("Announcement is required.");
      const { error } = await supabase.rpc("archive_tournament_announcement", {
        p_announcement_id: body.announcementId,
      });
      if (error) throw new Error(error.message);
    } else if (body.action === "incident") {
      const { error } = await supabase.rpc("record_tournament_incident", {
        p_tournament_slug: slug,
        p_match_id: body.matchId ?? null,
        p_severity: body.severity ?? "normal",
        p_category: body.category ?? "match",
        p_title: body.title ?? "",
        p_description: body.description ?? "",
      });
      if (error) throw new Error(error.message);
    } else if (body.action === "resolve_incident") {
      if (!body.incidentId) throw new Error("Incident is required.");
      const { error } = await supabase.rpc("resolve_tournament_incident", {
        p_incident_id: body.incidentId,
      });
      if (error) throw new Error(error.message);
    }

    return Response.json(await loadOperations(supabase, slug));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Operation failed." },
      { status: 409 },
    );
  }
}
