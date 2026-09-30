"use client";

import { useEffect, useMemo, useState } from "react";

type EngineState = {
  format: {
    startedAt?: string | null;
    completedAt?: string | null;
  } | null;
  matches?: Array<{ status: "scheduled" | "ready" | "live" | "final" }>;
};

function remaining(target: number) {
  const delta = Math.max(0, target - Date.now());
  return {
    days: Math.floor(delta / 86400000),
    hours: Math.floor((delta / 3600000) % 24),
    minutes: Math.floor((delta / 60000) % 60),
    seconds: Math.floor((delta / 1000) % 60),
    complete: delta <= 0,
  };
}

export default function EventCountdown({
  slug,
  eventDate,
  compact = false,
}: {
  slug: string;
  eventDate: string;
  compact?: boolean;
}) {
  const target = useMemo(
    () => new Date(`${eventDate}T00:00:00+05:30`).getTime(),
    [eventDate],
  );
  const [time, setTime] = useState(() => remaining(target));
  const [engine, setEngine] = useState<EngineState | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(remaining(target)), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch(`/api/tournaments/${slug}/state`, { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const payload = (await response.json()) as EngineState;
      if (active) setEngine(payload);
    }
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [slug]);

  const liveMatches = engine?.matches?.filter((match) => match.status === "live").length ?? 0;
  const completed = Boolean(engine?.format?.completedAt);
  const started = Boolean(engine?.format?.startedAt);

  const signal = completed
    ? "EVENT COMPLETE"
    : started
      ? liveMatches > 0
        ? `${liveMatches} LIVE MATCH${liveMatches === 1 ? "" : "ES"}`
        : "TOURNAMENT LIVE"
      : time.complete
        ? "EVENT DAY"
        : "EVENT DAY IN";

  return (
    <div className={compact ? "eventCountdown eventCountdownCompact" : "eventCountdown"}>
      <div className="eventCountdownSignal">
        <i className={started && !completed ? "eventLiveDot" : ""} />
        <span>{signal}</span>
        {!started && !completed && <small>13 OCT · IST</small>}
      </div>

      {!started && !completed && !time.complete ? (
        <div className="eventCountdownGrid" aria-label="Countdown to event day">
          <div><strong>{String(time.days).padStart(2, "0")}</strong><span>DAYS</span></div>
          <div><strong>{String(time.hours).padStart(2, "0")}</strong><span>HRS</span></div>
          <div><strong>{String(time.minutes).padStart(2, "0")}</strong><span>MIN</span></div>
          <div><strong>{String(time.seconds).padStart(2, "0")}</strong><span>SEC</span></div>
        </div>
      ) : (
        <div className="eventCountdownLiveCopy">
          <strong>{completed ? "GG." : started ? "MATCHDAY ACTIVE" : "13 OCTOBER 2026"}</strong>
          <span>{completed ? "Results are locked." : started ? "Follow pairings and scores below." : "Match start time will be published by operations."}</span>
        </div>
      )}
    </div>
  );
}
