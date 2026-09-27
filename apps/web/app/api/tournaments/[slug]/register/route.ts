import type { TeamRegistrationInput } from "@riftcore/tournament-core";
import { validateTeamRegistration } from "@riftcore/tournament-core";
import { saveRegistration } from "@/lib/registration-store";
import { getTournamentBySlug } from "@/lib/tournaments";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const tournament = await getTournamentBySlug(slug);

  if (!tournament) {
    return Response.json(
      { error: "Tournament not found." },
      { status: 404 },
    );
  }

  if (tournament.status !== "registration" && tournament.status !== "draft") {
    return Response.json(
      { error: "Registration is not currently available." },
      { status: 409 },
    );
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
      {
        error: "Registration validation failed.",
        issues: validation.issues,
      },
      { status: 422 },
    );
  }

  try {
    const registration = await saveRegistration(slug, validation.value);

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
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save registration.",
      },
      { status: 409 },
    );
  }
}
