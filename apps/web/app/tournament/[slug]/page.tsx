import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournaments";

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);

  if (!tournament) notFound();

  return (
    <main className="shell">
      <a className="backlink" href="/">← Riftcore</a>
      <p className="eyebrow">TOURNAMENT / {tournament.game}</p>
      <h1 className="pageTitle">{tournament.name}</h1>

      <section className="statGrid">
        <article className="stat">
          <span>Date</span>
          <strong>{tournament.date}</strong>
        </article>
        <article className="stat">
          <span>Status</span>
          <strong>{tournament.status}</strong>
        </article>
        <article className="stat">
          <span>Team size</span>
          <strong>
            {tournament.teamSize} + {tournament.substituteSlots} sub
          </strong>
        </article>
        <article className="stat">
          <span>Format</span>
          <strong>{tournament.format ?? "TBD"}</strong>
        </article>
      </section>

      <div className="actionRow">
        <a className="primaryButton linkButton" href="/register">
          Register team
        </a>
      </div>
    </main>
  );
}
