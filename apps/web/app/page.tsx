const pillars = [
  "Registration",
  "Brackets",
  "Match Ops",
  "Refereeing",
  "Results",
];

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">RIFTCORE / COMPETITIVE OPERATIONS</p>
        <h1>Built for the rift.</h1>
        <p className="lede">
          MLBB tournaments with structured registration, reliable match
          operations and clean competitive infrastructure.
        </p>

        <div className="event">
          <span>Next operation</span>
          <strong>13 October 2026</strong>
        </div>
      </section>

      <section className="grid" aria-label="Riftcore systems">
        {pillars.map((pillar, index) => (
          <article className="card" key={pillar}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{pillar}</h2>
          </article>
        ))}
      </section>
    </main>
  );
}
