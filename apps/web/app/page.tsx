import AccountNavAction from "@/components/AccountNavAction";
import BrandIcon from "@/components/BrandIcon";
import EventCountdown from "@/components/EventCountdown";

const systems = [
  ["01", "Roster Intake", "Structured 5+1 rosters, captain identity, MLBB IDs and server validation before a team enters competition."],
  ["02", "Matchday", "Check-in, live pairings, lobby readiness, referees and score control from one tournament signal."],
  ["03", "Swiss Engine", "Fast same-score pairings, no-repeat logic, standings and automatic top-cut progression."],
  ["04", "Broadcast", "Public match state, announcements, standings, results and a clean community-facing event surface."],
];

export default function Home() {
  return (
    <main className="siteShell premiumSite">
      <nav className="navBar premiumNav" aria-label="Primary navigation">
        <a className="brand premiumBrand" href="/">
          <span className="brandMark">R//C</span>
          <span className="brandWord">Riftcore</span>
        </a>

        <div className="premiumNavSignal">
          <i />
          <span>TOURNAMENT #001</span>
          <b>13 OCT</b>
        </div>

        <div className="navLinks">
          <a href="/tournament/riftcore-2026-10-13">Tournament</a>
          <a href="/register">Register</a>
          <a href="/community">Community</a>
          <AccountNavAction />
        </div>
      </nav>

      <section className="premiumHero">
        <div className="premiumHeroGrid" />
        <div className="premiumHeroGlow" />

        <div className="premiumHeroCopy">
          <div className="premiumHeroTags">
            <span>OPERATION // 001</span>
            <span>MLBB · INDIA</span>
            <span>FAST SWISS</span>
          </div>

          <h1>
            RIFTCORE
            <span>OPEN.</span>
          </h1>

          <div className="premiumHeroDeck">
            <p>
              One tournament surface for teams, referees and operations.
              Register once, check in, play, follow the live table and move.
            </p>
            <div>
              <span>13 OCT 2026</span>
              <strong>FAST. CLEAN. COMPETITIVE.</strong>
            </div>
          </div>

          <div className="heroActions premiumHeroActions">
            <a className="ctaPrimary premiumPrimary" href="/register">
              <span>Enter Tournament #001</span>
              <span>↗</span>
            </a>
            <a className="ctaGhost premiumGhost" href="/tournament/riftcore-2026-10-13">
              Matchday surface
            </a>
          </div>

          <div className="premiumHeroFoot">
            <div><span>ENTRY</span><strong>₹250 / TEAM</strong></div>
            <div><span>BASE PRIZE</span><strong>₹2,000+</strong></div>
            <div><span>FIELD</span><strong>UP TO 24</strong></div>
            <div><span>PLAYOFFS</span><strong>TOP 4 · BO3</strong></div>
          </div>
        </div>

        <aside className="premiumHeroHud">
          <div className="hudTop">
            <span>NEXT OPERATION</span>
            <b>R//001</b>
          </div>

          <EventCountdown
            slug="riftcore-2026-10-13"
            eventDate="2026-10-13"
          />

          <div className="hudEventCard">
            <div className="hudDateBlock">
              <strong>13</strong>
              <div><span>OCT</span><b>2026</b></div>
            </div>
            <div className="hudEventMeta">
              <div><span>FORMAT</span><strong>4R SWISS → TOP 4</strong></div>
              <div><span>SWISS</span><strong>BO1</strong></div>
              <div><span>PLAYOFFS</span><strong>BO3</strong></div>
            </div>
          </div>

          <a className="hudOpenLink" href="/tournament/riftcore-2026-10-13">
            <span>Open full event control surface</span>
            <b>→</b>
          </a>
        </aside>
      </section>

      <section className="premiumTicker" aria-label="Tournament profile">
        <div><span>STATUS</span><strong>PRE-EVENT</strong><i /></div>
        <div><span>GAME</span><strong>MOBILE LEGENDS</strong></div>
        <div><span>REGION</span><strong>INDIA</strong></div>
        <div><span>ROSTER</span><strong>5 + 1 SUB</strong></div>
        <div><span>OPS</span><strong>RIFTCORE CONTROL</strong></div>
      </section>

      <section className="premiumFeatureBlock">
        <div className="premiumSectionIntro">
          <div>
            <span>/ THE SYSTEM</span>
            <h2>Built like an event.<br />Not a form with a bracket.</h2>
          </div>
          <p>
            Tournament state should feel obvious: who is ready, what is live,
            what happens next, who advanced, and what requires staff attention.
          </p>
        </div>

        <div className="premiumSystemGrid">
          {systems.map(([code, title, copy]) => (
            <article key={code}>
              <div className="premiumCardIndex"><span>{code}</span><i /></div>
              <h3>{title}</h3>
              <p>{copy}</p>
              <b>RIFTCORE / {code}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="premiumMatchdayPreview">
        <div className="premiumSectionIntro">
          <div>
            <span>/ MATCHDAY</span>
            <h2>When it goes live,<br />the site changes with it.</h2>
          </div>
          <p>
            Live matches move to the top. Ready matches become “up next”.
            Standings, round state, referee signal and results update from the
            same backend operators use.
          </p>
        </div>

        <div className="broadcastMock">
          <div className="broadcastMockTop">
            <div><i /><span>LIVE SIGNAL</span></div>
            <small>SWISS ROUND 03 · BO1</small>
          </div>
          <div className="broadcastVersus">
            <div><span>SEED 02</span><strong>TEAM ALPHA</strong><small>READY</small></div>
            <b>VS</b>
            <div><span>SEED 05</span><strong>TEAM NOVA</strong><small>READY</small></div>
          </div>
          <div className="broadcastMockBottom">
            <span>REFEREE · ASSIGNED</span>
            <strong>UP NEXT / 07:35 PM</strong>
          </div>
        </div>
      </section>

      <section className="premiumCommunity">
        <div className="premiumSectionIntro">
          <div>
            <span>/ COMMUNITY</span>
            <h2>The event surface ends.<br />The signal keeps moving.</h2>
          </div>
          <p>
            Match-day announcements and team coordination continue through the
            official Riftcore community channels.
          </p>
        </div>

        <div className="premiumCommunityGrid">
          <a href="https://t.me/+2R97p2DNghQ5Njdl" target="_blank" rel="noreferrer">
            <div className="communityBrandIcon"><BrandIcon brand="telegram" size={30} /></div>
            <div><span>FAST SIGNAL</span><strong>Telegram</strong><p>Announcements, reminders and direct tournament pings.</p></div>
            <b>↗</b>
          </a>

          <a href="https://discord.gg/U4TbBEfR2Q" target="_blank" rel="noreferrer">
            <div className="communityBrandIcon"><BrandIcon brand="discord" size={32} /></div>
            <div><span>TEAM OPERATIONS</span><strong>Discord</strong><p>Captain coordination, disputes, support and voice rooms.</p></div>
            <b>↗</b>
          </a>
        </div>
      </section>

      <footer className="siteFooter premiumFooter">
        <div>
          <span className="brandMark">R//C</span>
          <strong>Riftcore</strong>
        </div>
        <div className="footerLinks">
          <a href="/tournament/riftcore-2026-10-13">Tournament #001</a>
          <a href="/register">Register</a>
          <a href="/community">Community</a>
        </div>
      </footer>
    </main>
  );
}
