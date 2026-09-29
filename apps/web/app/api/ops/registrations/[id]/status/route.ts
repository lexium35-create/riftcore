import { getRiftcoreSupabaseForToken } from "@/lib/supabase";
import { sendRiftcoreMail } from "@/lib/mail";

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
}

const copy: Record<string, {
  subject: string;
  title: string;
  intro: string;
  line: string;
  nextSteps: string[];
}> = {
  pending: {
    subject: "Roster is back in review",
    title: "Back in review.",
    intro: "Tournament staff moved this registration back into the review queue.",
    line: "Nothing has been rejected yet. Staff are checking the entry again before making the next decision.",
    nextSteps: [
      "Keep the captain email reachable.",
      "Watch your Riftcore profile for the next status change.",
      "Use the official community if staff ask the team to clarify something.",
    ],
  },
  verified: {
    subject: "You're in — registration accepted",
    title: "Team accepted.",
    intro: "Your roster passed staff verification and the team is accepted for this tournament.",
    line: "The registration is now official. Match-day instructions and check-in updates will follow through Riftcore and the official community channels.",
    nextSteps: [
      "Make sure the registered roster stays unchanged unless staff approve a change.",
      "Watch for check-in timing and match-day instructions.",
      "Join the official community so your captain does not miss operational updates.",
    ],
  },
  rejected: {
    subject: "Action needed — registration not accepted",
    title: "Registration needs attention.",
    intro: "Staff could not accept this team entry in its current form.",
    line: "This can happen when roster details, eligibility or tournament requirements do not match what staff need. Use the official community if you need clarification before submitting again.",
    nextSteps: [
      "Review the roster and contact information for mistakes.",
      "Check tournament requirements and any staff instructions.",
      "Contact Riftcore through the official community if the reason is unclear.",
    ],
  },
  withdrawn: {
    subject: "Registration withdrawn",
    title: "Entry withdrawn.",
    intro: "This team is no longer entered in the tournament.",
    line: "The withdrawn registration remains in account history, but it will not proceed into tournament operations.",
    nextSteps: [
      "No action is required if the withdrawal was intentional.",
      "Contact staff through the official community if this was unexpected.",
    ],
  },
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
      intro: message.intro,
      lines: [
        `${target.team_name} · ${target.tournament_name}`,
        message.line,
      ],
      facts: [
        { label: "Team", value: target.team_name },
        { label: "Tournament", value: target.tournament_name },
        { label: "Current status", value: body.status.toUpperCase() },
      ],
      nextSteps: message.nextSteps,
      status: body.status,
      cta: {
        label: "Open registration",
        href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://riftcore-five.vercel.app"}/account`,
      },
      secondaryCta: {
        label: "Open community",
        href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://riftcore-five.vercel.app"}/community`,
      },
    }).catch((mailError) => console.error("[status-mail]", mailError));
  }

  return Response.json({ ok: true, status: body.status });
}
