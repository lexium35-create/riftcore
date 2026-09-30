import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournaments";
import AccountNavAction from "@/components/AccountNavAction";
import EventCountdown from "@/components/EventCountdown";
import TournamentLiveBoard from "@/components/TournamentLiveBoard";
import TournamentPrizePool from "@/components/TournamentPrizePool";

function displayValue(value: string | number | null | undefined, fallback = "TBD") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const phases = [
    ["01", "Registration", "Submit a complete 5+1 roster. Captain email is required and staff verify the entry before check-in."],
    ["02", "Check-in", "Only verified teams that are actually present are locked into the competition field."],
    ["03", "Fast Swiss", "9–12 teams play 3 BO1 rounds. 13–24 teams play 4. Same-score pairing, rematches avoided."],
    ["04", "Top 4", "Swiss positions lock #1 vs #4 and #2 vs #3. Both semifinals are BO3."],
    ["05", "Grand Final", "Semifinal winners move directly to a BO3 final. No third-place match."],
  ];

  return (
    <main className="siteShell premiumSite eventPage">
      <nav className="navBar premiumNav compact">
        <a className="brand premiumBrand" href="/">
          <span className="brandMark">R//C</span>
          <span className="brandWord">Riftcore</span>
        </a>

        <div className="premiumNavSignal">
          <i />
          <span>TOURNAMENT #001</span>
          <b>{tournament.game}</b>
        </div>

        <div className="navLinks">
          <a href="/">Home</a>
          <a href="/register">Register</a>
          <a href="/community">Community</a>
          <AccountNavAction />
        </div>
      </nav>

      <section className="eventHeroPremium">
        <div className="eventHeroBackdrop" />

        <div className="eventHeroMain">
          <div className="eventHeroMeta">
            <span>RIFTCORE OPEN // 001</span>
            <span>{tournament.game}</span>
            <span>INDIA</span>
          </div>

          <h1>
            13 OCT
            <span>RIFTCORE OPEN</span>
          </h1>

          <p>
            Fast Swiss into a four-team playoff. A compact MLBB tournament built
            to move quickly without losing match control, standings or referee
            clarity.
          </p>

          <div className="eventHeroActions">
            <a className="ctaPrimary premiumPrimary" href="/register">
              <span>Register team · ₹250</span>
              <span>↗</span>
            </a>
            <a className="ctaGhost premiumGhost" href="#matchday">
              View matchday
            </a>
          </div>

          <div className="eventHeroSpecs">
            <div><span>ROSTER</span><strong>{tournament.teamSize} + {tournament.substituteSlots}</strong><small>STARTERS + SUB</small></div>
            <div><span>FORMAT</span><strong>{displayValue(tournament.format)}</strong><small>FIELD-DEPENDENT</small></div>
            <div><span>CAP</span><strong>{displayValue(tournament.maxTeams, "OPEN")}</strong><small>TEAMS</small></div>
            <div><span>REGION</span><strong>INDIA</strong><small>IST MATCHDAY</small></div>
          </div>
        </div>

        <aside className="eventHeroSide">
          <div className="eventHeroStatus">
            <div><i /><span>PRE-EVENT SIGNAL</span></div>
            <b>{tournament.status.toUpperCase()}</b>
          </div>

          <EventCountdown
            slug={slug}
            eventDate={tournament.date}
          />

          <TournamentPrizePool slug={slug} variant="signal" />
        </aside>
      </section>

      <nav className="eventSubnav" aria-label="Tournament sections">
        <a href="#matchday"><i />MATCHDAY</a>
        <a href="#prize">PRIZE</a>
        <a href="#format">FORMAT</a>
        <a href="/register">REGISTER ↗</a>
      </nav>

      <div id="matchday">
        <TournamentLiveBoard slug={slug} />
      </div>

      <div id="prize">
        <TournamentPrizePool slug={slug} />
      </div>

      <section className="eventFormatSection" id="format">
        <div className="premiumSectionIntro">
          <div>
            <span>/ COMPETITION MAP</span>
            <h2>Five stages.<br />No dead time.</h2>
          </div>
          <p>
            The format adapts to the checked-in field so Tournament #001 stays
            finishable in a single focused event window.
          </p>
        </div>

        <div className="eventPhaseRail">
          {phases.map(([code, title, copy], index) => (
            <article key={code}>
              <div className="eventPhaseCode"><span>{code}</span>{index < phases.length - 1 && <i />}</div>
              <div><h3>{title}</h3><p>{copy}</p></div>
            </article>
          ))}
        </div>

        <div className="eventRulesGrid">
          <article>
            <span>SWISS</span>
            <strong>BO1</strong>
            <p>Short rounds keep the event moving while standings still reward consistent wins.</p>
          </article>
          <article>
            <span>TOP CUT</span>
            <strong>#1×#4 / #2×#3</strong>
            <p>The top four Swiss positions convert directly into two BO3 semifinals.</p>
          </article>
          <article>
            <span>GRAND FINAL</span>
            <strong>BO3</strong>
            <p>No third-place match. The event resolves directly into the championship series.</p>
          </article>
          <article>
            <span>PARALLEL FLOOR</span>
            <strong>{tournament.fastFormat?.maxConcurrentMatches ?? 8}</strong>
            <p>Riftcore batches simultaneous matches to compress the overall event runtime.</p>
          </article>
        </div>
      </section>

      <section className="eventBottomCta">
        <div>
          <span>READY FOR OPERATION #001?</span>
          <h2>Bring the roster.<br />We run the rest.</h2>
        </div>
        <a className="ctaPrimary premiumPrimary" href="/register">
          <span>Register for ₹250</span>
          <span>↗</span>
        </a>
      </section>
    </main>
  );
}
