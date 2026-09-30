"use client";

import { useCallback, useEffect, useState } from "react";

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

export default function TournamentPrizePool({ slug }: { slug: string }) {
  const [finance, setFinance] = useState<FinanceState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/tournaments/${slug}/finance`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load prize pool.");
      setFinance(payload as FinanceState);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load prize pool.");
    }
  }, [slug]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (error) {
    return <section className="prizePoolShell"><div className="prizePoolError">{error}</div></section>;
  }

  if (!finance) {
    return <section className="prizePoolShell"><div className="prizePoolError">Loading prize pool…</div></section>;
  }

  return (
    <section className="prizePoolShell">
      <div className="prizePoolLead">
        <span>/ PRIZE POOL</span>
        <strong>{inr.format(finance.currentPrizePool)}</strong>
        <p>
          Starts at {inr.format(finance.basePrizePool)}. Every active team registration
          adds the full {inr.format(finance.joinFee)} entry fee, and verified donations
          are added 100% to the pool.
        </p>
      </div>

      <div className="prizePoolBreakdown">
        <article>
          <span>BASE POOL</span>
          <strong>{inr.format(finance.basePrizePool)}</strong>
        </article>
        <article>
          <span>TEAM FEES</span>
          <strong>+{inr.format(finance.registrationContribution)}</strong>
          <small>{finance.activeRegistrations} × {inr.format(finance.joinFee)}</small>
        </article>
        <article>
          <span>DONATIONS</span>
          <strong>+{inr.format(finance.donationTotal)}</strong>
          <small>{finance.donationCount} verified contribution{finance.donationCount === 1 ? "" : "s"}</small>
        </article>
        <article>
          <span>ENTRY FEE</span>
          <strong>{inr.format(finance.joinFee)}</strong>
          <small>Per team</small>
        </article>
      </div>

      {finance.projectedMaxPrizePool !== null && (
        <div className="prizePoolProjection">
          <span>AT {finance.maxTeams} TEAMS</span>
          <strong>{inr.format(finance.projectedMaxPrizePool)} + future donations</strong>
        </div>
      )}
    </section>
  );
}
