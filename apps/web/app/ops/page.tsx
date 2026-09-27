import { notFound } from "next/navigation";
import { getTournamentRuntimeSummary } from "@/lib/registration-store";
import { getTournamentBySlug } from "@/lib/tournaments";

const TOURNAMENT_SLUG = "riftcore-2026-10-13";

export default async function OpsPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.RIFTCORE_ENABLE_UNAUTH_OPS !== "true"
  ) {
    notFound();
  }

  const tournament = await getTournamentBySlug(TOURNAMENT_SLUG);
  if (!tournament) notFound();

  const registrations =
    await getTournamentRuntimeSummary(TOURNAMENT_SLUG);

  return (
    <main className="shell">
      <p className="eyebrow">RIFTCORE / OPERATOR CONSOLE</p>
      <h1 className="pageTitle">Control room.</h1>
      <p className="lede">
        Development operator surface backed by the Riftcore Supabase project.
        Production access remains disabled until operator authentication and
        authorization are implemented.
      </p>

      <section className="statGrid">
        <article className="stat">
          <span>Total registrations</span>
          <strong>{registrations.total}</strong>
        </article>
        <article className="stat">
          <span>Pending review</span>
          <strong>{registrations.pending}</strong>
        </article>
        <article className="stat">
          <span>Verified</span>
          <strong>{registrations.verified}</strong>
        </article>
        <article className="stat">
          <span>Tournament state</span>
          <strong>{tournament.status}</strong>
        </article>
      </section>

      <section className="opsRail">
        <div>
          <span>01</span>
          <h2>Registration review</h2>
          <p>Pending: {registrations.pending}</p>
        </div>
        <div>
          <span>02</span>
          <h2>Check-in</h2>
          <p>Not opened</p>
        </div>
        <div>
          <span>03</span>
          <h2>Bracket</h2>
          <p>Awaiting format</p>
        </div>
        <div>
          <span>04</span>
          <h2>Match desk</h2>
          <p>No active matches</p>
        </div>
      </section>
    </main>
  );
}
