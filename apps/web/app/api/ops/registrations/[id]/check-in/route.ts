import { getRiftcoreSupabaseForToken } from "@/lib/supabase";
import { sendRiftcoreMail } from "@/lib/mail";

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const accessToken = bearer(request);
  if (!accessToken) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { checkedIn?: boolean } | null;
  if (typeof body?.checkedIn !== "boolean") return Response.json({ error: "Invalid check-in state." }, { status: 400 });

  const supabase = getRiftcoreSupabaseForToken(accessToken);
  const { error } = await supabase.rpc("set_registration_check_in", {
    p_registration_id: id,
    p_checked_in: body.checkedIn,
  });
  if (error) return Response.json({ error: error.message }, { status: 403 });

  const { data } = await supabase.rpc("get_registration_notification_targets", {
    p_registration_id: id,
  });
  const target = (data ?? [])[0] as any;
  if (target) {
    await sendRiftcoreMail({
      to: [target.captain_email, ...(target.player_emails ?? [])],
      subject: `${body.checkedIn ? "Team checked in" : "Check-in reverted"} — ${target.team_name}`,
      eyebrow: "RIFTCORE / MATCH OPS",
      title: body.checkedIn ? "Check-in confirmed." : "Check-in reverted.",
      lines: [
        `${target.team_name} · ${target.tournament_name}`,
        body.checkedIn
          ? "Your verified team is marked ready for tournament operations."
          : "Tournament staff reverted this team's check-in state.",
      ],
    }).catch((mailError) => console.error("[checkin-mail]", mailError));
  }

  return Response.json({ ok: true, checkedIn: body.checkedIn });
}
