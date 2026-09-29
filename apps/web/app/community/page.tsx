import AccountNavAction from "@/components/AccountNavAction";
import { RIFTCORE_COMMUNITY } from "@/lib/community";

const channels = [
  {
    label: "TELEGRAM / FAST LANE",
    title: "Riftcore Telegram",
    copy: "Announcements, registration reminders, match-day pings and fast community conversation. Cypher is already inside as the official Riftcore bot.",
    href: RIFTCORE_COMMUNITY.telegramGroup,
    action: "Join Telegram",
    meta: RIFTCORE_COMMUNITY.telegramBotHandle,
  },
  {
    label: "DISCORD / OPERATIONS",
    title: "Riftcore Discord",
    copy: "Structured tournament operations: captain desk, match coordination, score reporting, support, community rooms and staff-run match-day channels.",
    href: RIFTCORE_COMMUNITY.discord,
    action: "Join Discord",
    meta: "Official Riftcore server",
  },
];

export default function CommunityPage() {
  return (
    <main className="siteShell communityPage">
      <nav className="navBar compact" aria-label="Primary navigation">
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

      <section className="communityHero">
        <div>
          <div className="signalRow">
            <span className="liveDot" />
            <span>RIFTCORE / COMMUNITY NETWORK</span>
            <span className="signalMuted">OFFICIAL CHANNELS</span>
          </div>
          <h1 className="displayTitle">Stay in the loop.</h1>
        </div>
        <p>
          Riftcore is not only the registration surface. These are the official
          places where tournament announcements, match-day coordination and the
          community itself stay connected.
        </p>
      </section>

      <section className="communityGrid">
        {channels.map((channel, index) => (
          <article className="communityCard" key={channel.title}>
            <div className="communityCardTop">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <i />
            </div>
            <span className="communityLabel">{channel.label}</span>
            <h2>{channel.title}</h2>
            <p>{channel.copy}</p>
            <div className="communityMeta">{channel.meta}</div>
            <a href={channel.href} target="_blank" rel="noreferrer">
              <span>{channel.action}</span>
              <b>↗</b>
            </a>
          </article>
        ))}
      </section>

      <section className="communityBotPanel">
        <div>
          <span className="sectionIndex">/ CYPHER</span>
          <h2>One bot. One community signal.</h2>
          <p>
            {RIFTCORE_COMMUNITY.telegramBotHandle} is the connected Telegram bot
            for Riftcore. We use it for official group communication and future
            tournament automation.
          </p>
        </div>
        <a className="ctaPrimary" href={RIFTCORE_COMMUNITY.telegramBot} target="_blank" rel="noreferrer">
          <span>Open Cypher</span>
          <span>↗</span>
        </a>
      </section>

      <section className="communitySafety">
        <span>OFFICIAL LINK POLICY</span>
        <p>
          Tournament status, registration decisions and staff instructions should
          always point back to Riftcore or one of the official community links
          above. Treat random DMs and unofficial payment/registration links as
          unverified.
        </p>
      </section>
    </main>
  );
}
