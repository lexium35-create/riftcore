"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamRegistrationInput } from "@riftcore/tournament-core";
import { getRiftcoreBrowserSupabase } from "@/lib/supabase-browser";
import AccountNavAction from "@/components/AccountNavAction";

const TOURNAMENT_SLUG = "riftcore-2026-10-13";

type DraftPlayer = {
  ign: string;
  mlbbId: string;
  serverId: string;
  email: string;
};

const blankPlayer = (): DraftPlayer => ({ ign: "", mlbbId: "", serverId: "", email: "" });

export default function RegisterPage() {
  const router = useRouter();
  const supabase = useMemo(() => getRiftcoreBrowserSupabase(), []);
  const [teamName, setTeamName] = useState("");
  const [teamTag, setTeamTag] = useState("");
  const [captainContact, setCaptainContact] = useState("");
  const [captainEmail, setCaptainEmail] = useState("");
  const [captainIndex, setCaptainIndex] = useState(0);
  const [players, setPlayers] = useState<DraftPlayer[]>([
    blankPlayer(), blankPlayer(), blankPlayer(), blankPlayer(), blankPlayer(), blankPlayer(),
  ]);
  const [includeSubstitute, setIncludeSubstitute] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const visiblePlayers = useMemo(
    () => players.slice(0, includeSubstitute ? 6 : 5),
    [includeSubstitute, players],
  );

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      if (data.session?.user.email) setCaptainEmail((current) => current || data.session?.user.email || "");
    });
  }, [supabase]);

  function updatePlayer(index: number, key: keyof DraftPlayer, value: string) {
    setPlayers((current) =>
      current.map((player, playerIndex) =>
        playerIndex === index ? { ...player, [key]: value } : player,
      ),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSubmitting(false);
      router.push("/login?next=/register");
      return;
    }

    const payload: TeamRegistrationInput = {
      teamName,
      teamTag: teamTag || undefined,
      captainContact,
      captainEmail,
      players: visiblePlayers.map((player, index) => ({
        ...player,
        email: player.email || (index === captainIndex ? captainEmail : undefined),
        rosterRole: index < 5 ? "starter" : "substitute",
        isCaptain: index === captainIndex,
      })),
    };

    try {
      const response = await fetch(`/api/tournaments/${TOURNAMENT_SLUG}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        const issueText = Array.isArray(data.issues)
          ? data.issues.map((issue: { message: string }) => issue.message).join(" ")
          : "";
        throw new Error([data.error, issueText].filter(Boolean).join(" "));
      }

      setResult(`Registration received. Reference: ${data.registrationId}. We emailed the supplied contacts.`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="siteShell registrationPage">
      <nav className="navBar compact">
        <a className="brand" href="/">
          <span className="brandMark">R//C</span>
          <span className="brandWord">Riftcore</span>
        </a>
        <div className="navLinks">
          <a href="/tournament/riftcore-2026-10-13">Tournament</a>
          <AccountNavAction />
        </div>
      </nav>

      <section className="registrationHeader">
        <div>
          <div className="signalRow">
            <span className="liveDot" />
            <span>TEAM ENTRY / OPERATION 001</span>
            <span className="signalMuted">13 OCT 2026</span>
          </div>
          <h1 className="displayTitle">Enter the rift.</h1>
        </div>
        <p>
          Submit five starters and one optional substitute. Captain email is required;
          player emails are optional and used for tournament reach and status notices.
        </p>
      </section>

      {!signedIn && signedIn !== null && (
        <div className="formResult">
          A Riftcore account is required to register a team. <a href="/login?next=/register">Sign in →</a>
        </div>
      )}

      <section className="registrationLayout">
        <aside className="registrationRail">
          <div className="railBlock"><span>ROSTER SPEC</span><strong>05</strong><p>Required starters</p></div>
          <div className="railBlock"><span>SUBSTITUTE</span><strong>01</strong><p>Optional reserve slot</p></div>
          <div className="railChecklist">
            <span>BEFORE SUBMITTING</span>
            <ol>
              <li>Use exact in-game names.</li>
              <li>Check MLBB and server IDs.</li>
              <li>Mark one starter as captain.</li>
              <li>Use a reachable captain email.</li>
            </ol>
          </div>
        </aside>

        <form className="registrationForm" onSubmit={submit}>
          <section className="formPanel upgraded">
            <div className="panelHeading">
              <div><span className="panelKicker">01 / TEAM IDENTITY</span><h2>Team details</h2></div>
              <span className="requiredNote">REQUIRED</span>
            </div>

            <div className="fieldGrid">
              <label>
                <span>Team name</span>
                <input required placeholder="e.g. Rift Hunters" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
              </label>
              <label>
                <span>Team tag</span>
                <input maxLength={8} placeholder="RHC" value={teamTag} onChange={(e) => setTeamTag(e.target.value)} />
              </label>
            </div>

            <div className="fieldGrid contactGrid">
              <label>
                <span>Captain contact</span>
                <input required placeholder="Discord, Telegram or phone" value={captainContact} onChange={(e) => setCaptainContact(e.target.value)} />
              </label>
              <label>
                <span>Captain email / Gmail</span>
                <input required type="email" placeholder="captain@gmail.com" value={captainEmail} onChange={(e) => setCaptainEmail(e.target.value)} />
              </label>
            </div>
          </section>

          <section className="formPanel upgraded rosterPanel">
            <div className="panelHeading">
              <div><span className="panelKicker">02 / COMPETITIVE ROSTER</span><h2>Players</h2></div>
              <label className="switchLabel">
                <input type="checkbox" checked={includeSubstitute} onChange={(e) => setIncludeSubstitute(e.target.checked)} />
                <span className="switchTrack"><i /></span>
                Add substitute
              </label>
            </div>

            <div className="rosterHeader" aria-hidden="true">
              <span>Slot</span><span>In-game name</span><span>MLBB ID</span><span>Server</span><span>Email · optional</span>
            </div>

            <div className="roster">
              {visiblePlayers.map((player, index) => (
                <article className="playerRow" key={index}>
                  <div className="playerMeta">
                    <span>{index < 5 ? `P0${index + 1}` : "SUB"}</span>
                    {index < 5 && (
                      <label className="captainChoice">
                        <input type="radio" name="captain" checked={captainIndex === index} onChange={() => setCaptainIndex(index)} />
                        <span>Captain</span>
                      </label>
                    )}
                  </div>
                  <input required aria-label={`Player ${index + 1} in-game name`} placeholder="IGN" value={player.ign} onChange={(e) => updatePlayer(index, "ign", e.target.value)} />
                  <input required inputMode="numeric" aria-label={`Player ${index + 1} MLBB ID`} placeholder="MLBB ID" value={player.mlbbId} onChange={(e) => updatePlayer(index, "mlbbId", e.target.value)} />
                  <input required inputMode="numeric" aria-label={`Player ${index + 1} server ID`} placeholder="Server ID" value={player.serverId} onChange={(e) => updatePlayer(index, "serverId", e.target.value)} />
                  <input type="email" aria-label={`Player ${index + 1} email`} placeholder={index === captainIndex ? "Captain email auto-used" : "player@gmail.com"} value={player.email} onChange={(e) => updatePlayer(index, "email", e.target.value)} />
                </article>
              ))}
            </div>
          </section>

          <div className="submitBar">
            <div><span>READY FOR REVIEW</span><p>Submission is attached to your Riftcore account and enters staff verification.</p></div>
            <button className="ctaPrimary submitButton" disabled={submitting || signedIn === false} type="submit">
              <span>{submitting ? "Submitting…" : "Submit team"}</span><span>{submitting ? "···" : "↗"}</span>
            </button>
          </div>

          {result && <p className="formResult">{result}</p>}
        </form>
      </section>
    </main>
  );
}
