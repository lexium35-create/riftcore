import { getRiftcoreSupabaseForToken } from "@/lib/supabase";
import { sendRiftcoreMail } from "@/lib/mail";

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
}

const copy: Record<string, { subject: string; title: string; line: string }> = {
  pending: { subject: "Registration moved to pending review", title: "Back in review.", line: "Staff moved this registration back to pending review." },
  verified: { subject: "Registration accepted", title: "Team accepted.", line: "Your roster has been verified and accepted for this tournament." },
  rejected: { subject: "Registration rejected", title: "Registration rejected.", line: "Staff rejected this registration. Review your details and contact tournament operations if you need clarification." },
  withdrawn: { subject: "Registration withdrawn", title: "Registration withdrawn.", line: "This team registration has been withdrawn from the tournament." },
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const accessToken = bearer(request);
  if (!accessToken) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { status?: string } | null;
  if (!body?.status || !copy[body.status]) return Response.json({ error: "Invalid status." }, { status: 400 });

  const supabase = getRiftcoreSupabaseForToken(accessToken);
  const { error } = await supabase.rpc("set_registration_status", {
    p_registration_id: id,
    p_status: body.status,
  });
  if (error) return Response.json({ error: error.message }, { status: 403 });

  const { data, error: targetError } = await supabase.rpc("get_registration_notification_targets", {
    p_registration_id: id,
  });
  if (targetError) return Response.json({ error: targetError.message }, { status: 500 });

  const target = (data ?? [])[0] as any;
  if (target) {
    const recipients = [target.captain_email, ...(target.player_emails ?? [])];
    const message = copy[body.status];
    await sendRiftcoreMail({
      to: recipients,
      subject: `${message.subject} — ${target.team_name}`,
      eyebrow: "RIFTCORE / REGISTRATION STATUS",
      title: message.title,
      lines: [
        `${target.team_name} · ${target.tournament_name}`,
        message.line,
        `Current status: ${body.status.toUpperCase()}`,
      ],
      cta: {
        label: "Open account",
        href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://riftcore-five.vercel.app"}/account`,
      },
    }).catch((mailError) => console.error("[status-mail]", mailError));
  }

  return Response.json({ ok: true, status: body.status });
}
