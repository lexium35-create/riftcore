"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type FinanceState = {
  currency: "INR";
  basePrizePool: number;
  joinFee: number;
  registrationFeesToPrizePool: boolean;
  donationsEnabled: boolean;
  activeRegistrations: number;
  registrationContribution: number;
  donationTotal: number;
  donationCount: number;
  currentPrizePool: number;
  maxTeams: number | null;
  projectedMaxPrizePool: number | null;
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function useAnimatedAmount(target: number) {
  const [display, setDisplay] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const from = current.current;
    const distance = target - from;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 780);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + distance * eased);
      current.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return display;
}

export default function TournamentPrizePool({
  slug,
  variant = "full",
}: {
  slug: string;
  variant?: "full" | "signal";
}) {
  const [finance, setFinance] = useState<FinanceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/tournaments/${slug}/finance`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load prize pool.");
      setFinance(payload as FinanceState);
      setLastSync(new Date());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load prize pool.");
    }
  }, [slug]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const currentPrize = finance?.currentPrizePool ?? 0;
  const animatedPrize = useAnimatedAmount(currentPrize);

  const progress = useMemo(() => {
    if (!finance?.projectedMaxPrizePool || finance.projectedMaxPrizePool <= 0) return 0;
    return Math.max(0, Math.min(1, finance.currentPrizePool / finance.projectedMaxPrizePool));
  }, [finance]);

  const growth = useMemo(() => {
    if (!finance) return 0;
    return Math.max(0, finance.currentPrizePool - finance.basePrizePool);
  }, [finance]);

  const style = {
    "--pool-angle": `${Math.round(progress * 360)}deg`,
    "--pool-progress": `${Math.round(progress * 100)}%`,
  } as CSSProperties;

  if (error) {
    return (
      <section className={variant === "signal" ? "prizeSignal prizeSignalError" : "prizeArena prizeArenaError"}>
        <span>PRIZE SIGNAL OFFLINE</span>
        <small>{error}</small>
      </section>
    );
  }

  if (!finance) {
    return (
      <section className={variant === "signal" ? "prizeSignal prizeSignalLoading" : "prizeArena prizeArenaLoading"}>
        <span>SYNCING PRIZE POOL</span>
        <strong>₹—</strong>
      </section>
    );
  }

  if (variant === "signal") {
    return (
      <section className="prizeSignal" style={style}>
        <div className="prizeSignalHead">
          <span><i /> LIVE PRIZE POOL</span>
          <small>SYNC 10S</small>
        </div>

        <div className="prizeSignalAmount">
          <strong>{inr.format(animatedPrize)}</strong>
          <em>+{inr.format(growth)} GROWTH</em>
        </div>

        <div className="prizeSignalRail">
          <i />
          <span>{finance.activeRegistrations} TEAMS COUNTED</span>
          <b>{Math.round(progress * 100)}%</b>
        </div>

        <div className="prizeSignalFoot">
          <span>FEES +{inr.format(finance.registrationContribution)}</span>
          <span>DONATIONS +{inr.format(finance.donationTotal)}</span>
          <small>{lastSync ? `LIVE · ${lastSync.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "LIVE"}</small>
        </div>
      </section>
    );
  }

  return (
    <section className="prizeArena" style={style}>
      <div className="prizeArenaIntro">
        <div>
          <span className="prizeEyebrow"><i /> LIVE ECONOMY</span>
          <h2>The pool grows<br />with the field.</h2>
        </div>
        <p>
          Base pool + every active team&apos;s full entry fee + every verified
          donation. Nothing here is a decorative estimate: the number is pulled
          from Riftcore tournament finance and resynced every 10 seconds.
        </p>
      </div>

      <div className="prizeArenaStage">
        <div className="prizeOrbit">
          <div className="prizeOrbitTrack" />
          <div className="prizeOrbitTicks" />
          <div className="prizeOrbitCore">
            <span>LIVE PRIZE POOL</span>
            <strong>{inr.format(animatedPrize)}</strong>
            <em>{finance.activeRegistrations} ACTIVE TEAM{finance.activeRegistrations === 1 ? "" : "S"}</em>
          </div>
          <span className="prizeOrbitMarker prizeOrbitMarkerA">BASE {inr.format(finance.basePrizePool)}</span>
          <span className="prizeOrbitMarker prizeOrbitMarkerB">{finance.donationCount} DONATION{finance.donationCount === 1 ? "" : "S"}</span>
          <span className="prizeOrbitMarker prizeOrbitMarkerC">SYNC 10S</span>
        </div>

        <div className="prizeGrowth">
          <div className="prizeGrowthHead">
            <span>POOL GROWTH TRACE</span>
            <b>{lastSync ? `LIVE · ${lastSync.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "LIVE"}</b>
          </div>

          <ol className="prizeGrowthTimeline">
            <li className="prizeGrowthBase">
              <i />
              <div><span>STARTING GUARANTEE</span><strong>{inr.format(finance.basePrizePool)}</strong></div>
              <small>Locked base prize</small>
            </li>
            <li className="prizeGrowthTeams">
              <i />
              <div><span>TEAM ENTRY FLOW</span><strong>+{inr.format(finance.registrationContribution)}</strong></div>
              <small>{finance.activeRegistrations} × {inr.format(finance.joinFee)}</small>
            </li>
            <li className="prizeGrowthDonations">
              <i />
              <div><span>COMMUNITY BOOST</span><strong>+{inr.format(finance.donationTotal)}</strong></div>
              <small>{finance.donationCount} verified contribution{finance.donationCount === 1 ? "" : "s"}</small>
            </li>
          </ol>

          {finance.projectedMaxPrizePool !== null && (
            <div className="prizeProjection">
              <div className="prizeProjectionCopy">
                <span>FIELD CAP PROJECTION</span>
                <strong>{inr.format(finance.projectedMaxPrizePool)}</strong>
                <small>at {finance.maxTeams} teams · before future donations</small>
              </div>
              <div className="prizeProjectionTrack">
                <i />
              </div>
              <b>{Math.round(progress * 100)}%</b>
            </div>
          )}
        </div>
      </div>

      <div className="prizeTicker">
        <span>₹{finance.joinFee} / TEAM ENTERS THE POOL</span>
        <i />
        <span>100% VERIFIED DONATIONS ADDED</span>
        <i />
        <span>{finance.activeRegistrations} ACTIVE REGISTRATIONS COUNTED</span>
        <i />
        <span>LIVE FINANCE SIGNAL</span>
      </div>
    </section>
  );
}
