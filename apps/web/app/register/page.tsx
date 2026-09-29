"use client";

import { FormEvent, useMemo, useState } from "react";
import type { TeamRegistrationInput } from "@riftcore/tournament-core";

const TOURNAMENT_SLUG = "riftcore-2026-10-13";

type DraftPlayer = {
  ign: string;
  mlbbId: string;
  serverId: string;
};

const blankPlayer = (): DraftPlayer => ({
  ign: "",
  mlbbId: "",
  serverId: "",
});

export default function RegisterPage() {
  const [teamName, setTeamName] = useState("");
  const [teamTag, setTeamTag] = useState("");
  const [captainContact, setCaptainContact] = useState("");
  const [captainIndex, setCaptainIndex] = useState(0);
  const [players, setPlayers] = useState<DraftPlayer[]>([
    blankPlayer(),
    blankPlayer(),
    blankPlayer(),
    blankPlayer(),
    blankPlayer(),
    blankPlayer(),
  ]);
  const [includeSubstitute, setIncludeSubstitute] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const visiblePlayers = useMemo(
    () => players.slice(0, includeSubstitute ? 6 : 5),
    [includeSubstitute, players],
  );

  function updatePlayer(
    index: number,
    key: keyof DraftPlayer,
    value: string,
  ) {
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

    const payload: TeamRegistrationInput = {
      teamName,
      teamTag: teamTag || undefined,
      captainContact,
      players: visiblePlayers.map((player, index) => ({
        ...player,
        rosterRole: index < 5 ? "starter" : "substitute",
        isCaptain: index === captainIndex,
      })),
    };

    try {
      const response = await fetch(
        `/api/tournaments/${TOURNAMENT_SLUG}/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const issueText = Array.isArray(data.issues)
          ? data.issues.map((issue: { message: string }) => issue.message).join(" ")
          : "";
        throw new Error([data.error, issueText].filter(Boolean).join(" "));
      }

      setResult(`Registration received. Reference: ${data.registrationId}`);
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Registration failed.",
      );
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
          <a className="navOps" href="/login">Sign in</a>
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
          Submit five starters and one optional substitute. IDs are validated
          before the roster is admitted into tournament operations.
        </p>
      </section>

      <section className="registrationLayout">
        <aside className="registrationRail">
          <div className="railBlock">
            <span>ROSTER SPEC</span>
            <strong>05</strong>
            <p>Required starters</p>
          </div>
          <div className="railBlock">
            <span>SUBSTITUTE</span>
            <strong>01</strong>
            <p>Optional reserve slot</p>
          </div>
          <div className="railChecklist">
            <span>BEFORE SUBMITTING</span>
            <ol>
              <li>Use exact in-game names.</li>
              <li>Check MLBB and server IDs.</li>
              <li>Mark one starter as captain.</li>
              <li>Keep captain contact reachable.</li>
            </ol>
          </div>
        </aside>

        <form className="registrationForm" onSubmit={submit}>
          <section className="formPanel upgraded">
            <div className="panelHeading">
              <div>
                <span className="panelKicker">01 / TEAM IDENTITY</span>
                <h2>Team details</h2>
              </div>
              <span className="requiredNote">REQUIRED</span>
            </div>

            <div className="fieldGrid">
              <label>
                <span>Team name</span>
                <input
                  required
                  placeholder="e.g. Rift Hunters"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                />
              </label>
              <label>
                <span>Team tag</span>
                <input
                  maxLength={8}
                  placeholder="RHC"
                  value={teamTag}
                  onChange={(event) => setTeamTag(event.target.value)}
                />
              </label>
            </div>

            <label className="fullField">
              <span>Captain contact</span>
              <input
                required
                placeholder="Discord, Telegram or phone"
                value={captainContact}
                onChange={(event) => setCaptainContact(event.target.value)}
              />
            </label>
          </section>

          <section className="formPanel upgraded rosterPanel">
            <div className="panelHeading">
              <div>
                <span className="panelKicker">02 / COMPETITIVE ROSTER</span>
                <h2>Players</h2>
              </div>

              <label className="switchLabel">
                <input
                  type="checkbox"
                  checked={includeSubstitute}
                  onChange={(event) => setIncludeSubstitute(event.target.checked)}
                />
                <span className="switchTrack"><i /></span>
                Add substitute
              </label>
            </div>

            <div className="rosterHeader" aria-hidden="true">
              <span>Slot</span>
              <span>In-game name</span>
              <span>MLBB ID</span>
              <span>Server</span>
            </div>

            <div className="roster">
              {visiblePlayers.map((player, index) => (
                <article className="playerRow" key={index}>
                  <div className="playerMeta">
                    <span>{index < 5 ? `P0${index + 1}` : "SUB"}</span>
                    {index < 5 && (
                      <label className="captainChoice">
                        <input
                          type="radio"
                          name="captain"
                          checked={captainIndex === index}
                          onChange={() => setCaptainIndex(index)}
                        />
                        <span>Captain</span>
                      </label>
                    )}
                  </div>
                  <input
                    required
                    aria-label={`Player ${index + 1} in-game name`}
                    placeholder="IGN"
                    value={player.ign}
                    onChange={(event) =>
                      updatePlayer(index, "ign", event.target.value)
                    }
                  />
                  <input
                    required
                    inputMode="numeric"
                    aria-label={`Player ${index + 1} MLBB ID`}
                    placeholder="MLBB ID"
                    value={player.mlbbId}
                    onChange={(event) =>
                      updatePlayer(index, "mlbbId", event.target.value)
                    }
                  />
                  <input
                    required
                    inputMode="numeric"
                    aria-label={`Player ${index + 1} server ID`}
                    placeholder="Server ID"
                    value={player.serverId}
                    onChange={(event) =>
                      updatePlayer(index, "serverId", event.target.value)
                    }
                  />
                </article>
              ))}
            </div>
          </section>

          <div className="submitBar">
            <div>
              <span>READY FOR REVIEW</span>
              <p>Submission creates a pending registration for staff verification.</p>
            </div>
            <button className="ctaPrimary submitButton" disabled={submitting} type="submit">
              <span>{submitting ? "Submitting…" : "Submit team"}</span>
              <span>{submitting ? "···" : "↗"}</span>
            </button>
          </div>

          {result && <p className="formResult">{result}</p>}
        </form>
      </section>
    </main>
  );
}
