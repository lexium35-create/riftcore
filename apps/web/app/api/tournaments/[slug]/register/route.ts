import type { TeamRegistrationInput } from "@riftcore/tournament-core";
import { validateTeamRegistration } from "@riftcore/tournament-core";
import { saveRegistration } from "@/lib/registration-store";
import { getTournamentBySlug } from "@/lib/tournaments";
import { sendRiftcoreMail } from "@/lib/mail";

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const accessToken = bearer(request);
  if (!accessToken) {
    return Response.json({ error: "Sign in to register a team." }, { status: 401 });
  }

  const { slug } = await context.params;
  const tournament = await getTournamentBySlug(slug);

  if (!tournament) return Response.json({ error: "Tournament not found." }, { status: 404 });

  if (tournament.status !== "registration" && tournament.status !== "draft") {
    return Response.json({ error: "Registration is not currently available." }, { status: 409 });
  }

  let payload: TeamRegistrationInput;
  try {
    payload = (await request.json()) as TeamRegistrationInput;
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const validation = validateTeamRegistration(payload, {
    teamSize: tournament.teamSize,
    substituteSlots: tournament.substituteSlots,
  });

  if (!validation.ok || !validation.value) {
    return Response.json(
      { error: "Registration validation failed.", issues: validation.issues },
      { status: 422 },
    );
  }

  try {
    const registration = await saveRegistration(slug, validation.value, accessToken);
    const recipients = [
      validation.value.captainEmail,
      ...validation.value.players.map((player) => player.email ?? ""),
    ];

    await sendRiftcoreMail({
      to: recipients,
      subject: `Registration received — ${validation.value.teamName}`,
      eyebrow: "RIFTCORE / REGISTRATION",
      title: "Team entry received.",
      lines: [
        `${validation.value.teamName} has been submitted for ${tournament.name}.`,
        `Reference: ${registration.id}`,
        "Status: pending staff verification. You will receive another email when the registration is accepted, rejected or otherwise changed.",
      ],
      cta: {
        label: "Open Riftcore account",
        href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://riftcore-five.vercel.app"}/account`,
      },
    }).catch((error) => console.error("[registration-mail]", error));

    return Response.json(
      {
        registrationId: registration.id,
        status: registration.status,
        submittedAt: registration.submittedAt,
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to save registration." },
      { status: 409 },
    );
  }
}
