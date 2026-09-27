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

      setResult(
        `Registration received. Reference: ${data.registrationId}`,
      );
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Registration failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shell narrow">
      <a className="backlink" href="/">← Riftcore</a>
      <p className="eyebrow">13 OCTOBER 2026 / TEAM REGISTRATION</p>
      <h1 className="pageTitle">Enter the rift.</h1>
      <p className="lede">
        Register five starters and an optional substitute. MLBB account and
        server IDs are validated before the registration is accepted.
      </p>

      <form className="formStack" onSubmit={submit}>
        <section className="formPanel">
          <h2>Team</h2>
          <div className="fieldGrid">
            <label>
              Team name
              <input
                required
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
              />
            </label>
            <label>
              Team tag
              <input
                maxLength={8}
                value={teamTag}
                onChange={(event) => setTeamTag(event.target.value)}
              />
            </label>
          </div>
          <label>
            Captain contact
            <input
              required
              placeholder="Discord, Telegram or phone"
              value={captainContact}
              onChange={(event) => setCaptainContact(event.target.value)}
            />
          </label>
        </section>

        <section className="formPanel">
          <div className="panelHeading">
            <h2>Roster</h2>
            <label className="toggle">
              <input
                type="checkbox"
                checked={includeSubstitute}
                onChange={(event) => setIncludeSubstitute(event.target.checked)}
              />
              Add substitute
            </label>
          </div>

          <div className="roster">
            {visiblePlayers.map((player, index) => (
              <article className="playerRow" key={index}>
                <div className="playerMeta">
                  <span>{index < 5 ? `P${index + 1}` : "SUB"}</span>
                  {index < 5 && (
                    <label className="captainChoice">
                      <input
                        type="radio"
                        name="captain"
                        checked={captainIndex === index}
                        onChange={() => setCaptainIndex(index)}
                      />
                      Captain
                    </label>
                  )}
                </div>
                <input
                  required
                  placeholder="IGN"
                  value={player.ign}
                  onChange={(event) =>
                    updatePlayer(index, "ign", event.target.value)
                  }
                />
                <input
                  required
                  inputMode="numeric"
                  placeholder="MLBB ID"
                  value={player.mlbbId}
                  onChange={(event) =>
                    updatePlayer(index, "mlbbId", event.target.value)
                  }
                />
                <input
                  required
                  inputMode="numeric"
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

        <button className="primaryButton" disabled={submitting} type="submit">
          {submitting ? "Submitting…" : "Submit team"}
        </button>

        {result && <p className="formResult">{result}</p>}
      </form>
    </main>
  );
}
