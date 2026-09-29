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
      subject: `Roster received — ${validation.value.teamName} / ${tournament.name}`,
      eyebrow: "RIFTCORE / TEAM REGISTRATION",
      title: "We have your roster.",
      intro: `${validation.value.teamName} is now in the review queue for ${tournament.name}.`,
      lines: [
        "This is not an acceptance yet. Riftcore staff will verify the roster and tournament details before the entry becomes official.",
      ],
      facts: [
        { label: "Reference", value: registration.id },
        { label: "Status", value: "Pending review" },
        { label: "Roster", value: `${validation.value.players.filter((player) => player.rosterRole === "starter").length} starters + ${validation.value.players.filter((player) => player.rosterRole === "substitute").length} substitute` },
        { label: "Captain email", value: validation.value.captainEmail },
      ],
      nextSteps: [
        "Keep the captain email reachable while staff review the entry.",
        "Watch your Riftcore profile for the registration status.",
        "Join the official community for tournament announcements and match-day coordination.",
      ],
      status: "Pending",
      cta: {
        label: "Track registration",
        href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://riftcore-five.vercel.app"}/account`,
      },
      secondaryCta: {
        label: "Open community",
        href: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://riftcore-five.vercel.app"}/community`,
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
