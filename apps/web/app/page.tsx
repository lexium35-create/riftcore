import AccountNavAction from "@/components/AccountNavAction";
const systems = [
  {
    code: "01",
    title: "Registration",
    copy: "Structured rosters, captain identity, MLBB IDs and validation before a team enters the bracket.",
  },
  {
    code: "02",
    title: "Brackets",
    copy: "Tournament state that stays legible from registration through elimination and final standings.",
  },
  {
    code: "03",
    title: "Match Ops",
    copy: "Check-in, lobby readiness, score reporting and dispute handling without scattered spreadsheets.",
  },
  {
    code: "04",
    title: "Refereeing",
    copy: "Operator roles, evidence trails and explicit competitive rulings for every match-day decision.",
  },
  {
    code: "05",
    title: "Results",
    copy: "Verified outcomes become the source of truth for teams, staff and community updates.",
  },
];

const pulse = [
  ["FORMAT", "5v5 + 1 SUB"],
  ["GAME", "MLBB"],
  ["REGION", "INDIA"],
  ["CONTROL", "RIFTCORE OPS"],
];

export default function Home() {
  return (
    <main className="siteShell">
      <nav className="navBar" aria-label="Primary navigation">
        <a className="brand" href="/">
          <span className="brandMark">R//C</span>
          <span className="brandWord">Riftcore</span>
        </a>

        <div className="navLinks">
          <a href="/tournament/riftcore-2026-10-13">Tournament</a>
          <a href="/register">Register</a>
          <AccountNavAction />
        </div>
      </nav>

      <section className="heroStage">
        <div className="heroCopy">
          <div className="signalRow">
            <span className="liveDot" />
            <span>RIFTCORE / COMPETITIVE OPERATIONS</span>
            <span className="signalMuted">SEASON 01</span>
          </div>

          <h1>
            Built for
            <span>the rift.</span>
          </h1>

          <p className="heroLede">
            A tournament operating system for MLBB teams, referees and staff.
            Registration, check-in, match control and results stay in one
            deliberate flow.
          </p>

          <div className="heroActions">
            <a className="ctaPrimary" href="/register">
              <span>Register team</span>
              <span aria-hidden="true">↗</span>
            </a>
            <a className="ctaGhost" href="/tournament/riftcore-2026-10-13">
              View tournament
            </a>
          </div>
        </div>

        <aside className="operationCard" aria-label="Next Riftcore operation">
          <div className="operationTop">
            <span>OPERATION / 001</span>
            <span className="statusPill">
              <i />
              PREP
            </span>
          </div>

          <div className="operationDate">
            <strong>13</strong>
            <div>
              <span>OCT</span>
              <span>2026</span>
            </div>
          </div>

          <div className="operationMeta">
            <div>
              <span>GAME</span>
              <strong>Mobile Legends</strong>
            </div>
            <div>
              <span>ROSTER</span>
              <strong>5 + 1 substitute</strong>
            </div>
            <div>
              <span>TIMEZONE</span>
              <strong>Asia / Kolkata</strong>
            </div>
          </div>

          <a className="operationLink" href="/tournament/riftcore-2026-10-13">
            Open operation brief <span>→</span>
          </a>
        </aside>
      </section>

      <section className="pulseStrip" aria-label="Tournament profile">
        {pulse.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className="sectionBlock">
        <div className="sectionIntro">
          <div>
            <span className="sectionIndex">/ SYSTEM</span>
            <h2>One control plane.<br />Five tournament layers.</h2>
          </div>
          <p>
            Riftcore is built around operational clarity: every action has a
            place, every status has meaning, and tournament staff can see what
            needs attention without digging through chat history.
          </p>
        </div>

        <div className="systemGrid">
          {systems.map((system) => (
            <article className="systemCard" key={system.code}>
              <div className="systemCardHead">
                <span>{system.code}</span>
                <span className="systemNode" />
              </div>
              <h3>{system.title}</h3>
              <p>{system.copy}</p>
              <span className="systemArrow">↘</span>
            </article>
          ))}
        </div>
      </section>

      <section className="commandSection">
        <div className="commandVisual" aria-hidden="true">
          <span className="crosshair crosshairA">+</span>
          <span className="crosshair crosshairB">+</span>
          <div className="commandRing">
            <span>RIFTCORE</span>
            <strong>OPS</strong>
            <small>LIVE CONTROL</small>
          </div>
        </div>

        <div className="commandCopy">
          <span className="sectionIndex">/ CONTROL ROOM</span>
          <h2>Competition should feel intense. Operations should not.</h2>
          <p>
            Staff access is separated from public registration. Approved
            operators review teams, verify rosters and control check-in from a
            dedicated workspace.
          </p>
          <a className="textLink" href="/ops">
            Enter operator console <span>→</span>
          </a>
        </div>
      </section>

      <footer className="siteFooter">
        <div>
          <span className="brandMark">R//C</span>
          <strong>Riftcore</strong>
        </div>
        <p>Competitive infrastructure / Assam, India / 2026</p>
      </footer>
    </main>
  );
}
