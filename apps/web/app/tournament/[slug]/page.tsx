import { notFound } from "next/navigation";
import { getTournamentBySlug } from "@/lib/tournaments";
import AccountNavAction from "@/components/AccountNavAction";

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

  const [yearText, monthText, dayText] = tournament.date.split("-");
  const day = dayText.padStart(2, "0");
  const month = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1)))
    .toUpperCase();
  const year = Number(yearText);

  const phases = [
    ["01", "Registration", "Team details, roster and captain identity enter the system."],
    ["02", "Verification", "Staff reviews submitted IDs and marks eligible teams verified."],
    ["03", "Check-in", "Verified teams confirm readiness before the tournament window."],
    ["04", "Match ops", "Lobby coordination, referee control and provisional score reports."],
    ["05", "Finalization", "Validated results move into standings and tournament history."],
  ];

  return (
    <main className="siteShell">
      <nav className="navBar compact">
        <a className="brand" href="/">
          <span className="brandMark">R//C</span>
          <span className="brandWord">Riftcore</span>
        </a>
        <div className="navLinks">
          <a href="/">Home</a>
          <a href="/register">Register</a>
          <a href="/community">Community</a>
          <AccountNavAction />
        </div>
      </nav>

      <section className="tournamentHero">
        <div className="tournamentHeading">
          <div className="signalRow">
            <span className="liveDot" />
            <span>TOURNAMENT / {tournament.game}</span>
            <span className="signalMuted">{tournament.status.toUpperCase()}</span>
          </div>
          <h1 className="displayTitle">{tournament.name}</h1>
          <p className="heroLede">
            Official Riftcore operation brief. Registration feeds directly into
            verification, check-in and the staff control room.
          </p>
          <div className="heroActions">
            <a className="ctaPrimary" href="/register">
              <span>Register team</span>
              <span>↗</span>
            </a>
            <a className="ctaGhost" href="/ops">Staff console</a>
          </div>
        </div>

        <aside className="datePanel">
          <div className="datePanelTop">
            <span>OPERATION DATE</span>
            <span>IST</span>
          </div>
          <div className="dateHuge">{day}</div>
          <div className="dateBottom">
            <strong>{month}</strong>
            <span>{year}</span>
          </div>
        </aside>
      </section>

      <section className="statMatrix">
        <article>
          <span>STATUS</span>
          <strong>{tournament.status}</strong>
          <small>Current lifecycle state</small>
        </article>
        <article>
          <span>ROSTER</span>
          <strong>{tournament.teamSize} + {tournament.substituteSlots}</strong>
          <small>Starters + substitutes</small>
        </article>
        <article>
          <span>FORMAT</span>
          <strong>{displayValue(tournament.format)}</strong>
          <small>Published before match day</small>
        </article>
        <article>
          <span>MAX TEAMS</span>
          <strong>{displayValue(tournament.maxTeams, "OPEN")}</strong>
          <small>Registration capacity</small>
        </article>
      </section>

      <section className="tournamentBody">
        <div className="briefPanel">
          <div className="panelLabel">
            <span>/ OPERATION FLOW</span>
            <span>05 STAGES</span>
          </div>

          <div className="phaseList">
            {phases.map(([code, title, copy]) => (
              <article key={code}>
                <span>{code}</span>
                <div>
                  <h2>{title}</h2>
                  <p>{copy}</p>
                </div>
                <i />
              </article>
            ))}
          </div>
        </div>

        <aside className="tournamentSide">
          <div className="sideCard">
            <span className="panelLabelSolo">REGISTRATION WINDOW</span>
            <strong>{tournament.registration.opensAt ? "Scheduled" : "Open configuration"}</strong>
            <p>
              Registration timing is controlled by tournament operations. Team
              submissions are validated server-side before acceptance.
            </p>
          </div>

          <div className="sideCard">
            <span className="panelLabelSolo">COMPETITIVE SETTINGS</span>
            <dl>
              <div>
                <dt>Default series</dt>
                <dd>{tournament.competitive.defaultBestOf ? `BO${tournament.competitive.defaultBestOf}` : "TBD"}</dd>
              </div>
              <div>
                <dt>Grand final</dt>
                <dd>{tournament.competitive.grandFinalBestOf ? `BO${tournament.competitive.grandFinalBestOf}` : "TBD"}</dd>
              </div>
              <div>
                <dt>Prize pool</dt>
                <dd>{tournament.prizePool.total ? `₹${tournament.prizePool.total.toLocaleString("en-IN")}` : "TBD"}</dd>
              </div>
            </dl>
          </div>

          <div className="sideCard">
            <span className="panelLabelSolo">COMMUNITY SIGNAL</span>
            <strong>Stay connected</strong>
            <p>Official Telegram and Discord links live in the Riftcore community hub for announcements and match-day coordination.</p>
            <a className="textLink compactLink" href="/community">Open community →</a>
          </div>

          <a className="sideCta" href="/register">
            <span>
              <small>NEXT ACTION</small>
              Register your roster
            </span>
            <b>→</b>
          </a>
        </aside>
      </section>
    </main>
  );
}
