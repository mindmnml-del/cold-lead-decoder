"use client";

import type { LeadCard as LeadCardData } from "../lib/schema/leadCard";

export interface LeadCardProps {
  card: LeadCardData;
}

export function LeadCard({ card }: LeadCardProps): JSX.Element {
  const handleCopy = () => {
    void navigator.clipboard.writeText(card.personalized_opener);
  };

  return (
    <article
      data-testid="lead-card"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{card.company_name}</h2>
          <p className="text-sm text-slate-500">
            {card.domain} · {card.category}
          </p>
        </div>
        {card.degraded ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
            Based on limited public info
          </span>
        ) : null}
      </header>

      <p className="mt-4 text-slate-700">{card.summary}</p>

      <section className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Positioning signals
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {card.positioning_signals.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Likely pain points
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {card.likely_pain_points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-lg bg-slate-50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Personalized opener
        </h3>
        <p className="mt-2 text-slate-900">{card.personalized_opener}</p>
        <p className="mt-2 text-xs italic text-slate-500">{card.evidence.opener_basis}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          Copy opener
        </button>
      </section>

      <section className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Follow-up angles
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {card.follow_up_angles.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>

      {card.confidence_notes ? (
        <p className="mt-4 text-xs text-slate-500">Notes: {card.confidence_notes}</p>
      ) : null}
    </article>
  );
}
