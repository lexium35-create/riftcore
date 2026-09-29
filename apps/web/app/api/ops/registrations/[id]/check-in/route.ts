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
      subject: `${body.checkedIn ? "Check-in confirmed" : "Check-in reverted"} — ${target.team_name}`,
      eyebrow: "RIFTCORE / MATCH OPS",
      title: body.checkedIn ? "You're checked in." : "Check-in reverted.",
      intro: body.checkedIn
        ? "Riftcore now has your team marked ready for tournament operations."
        : "Tournament staff reverted the team's check-in state.",
      lines: [
        `${target.team_name} · ${target.tournament_name}`,
        body.checkedIn
          ? "Keep the registered roster available and watch for lobby or referee instructions."
          : "The team is no longer marked ready. Check the official community or tournament page for the next instruction.",
      ],
      facts: [
        { label: "Team", value: target.team_name },
        { label: "Tournament", value: target.tournament_name },
        { label: "Check-in", value: body.checkedIn ? "Confirmed" : "Not checked in" },
      ],
      nextSteps: body.checkedIn
        ? [
            "Keep the full roster available.",
            "Watch Discord/Telegram for match-day coordination.",
            "Follow referee instructions once a lobby is assigned.",
          ]
        : [
            "Check why the state was reverted.",
            "Contact tournament staff through the official community if needed.",
          ],
      status: body.checkedIn ? "Checked in" : "Reverted",
      cta: {
        label: "Open tournament",
        href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://riftcore-five.vercel.app"}/tournament/riftcore-2026-10-13`,
      },
      secondaryCta: {
        label: "Open community",
        href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://riftcore-five.vercel.app"}/community`,
      },
    }).catch((mailError) => console.error("[checkin-mail]", mailError));
  }

  return Response.json({ ok: true, checkedIn: body.checkedIn });
}
