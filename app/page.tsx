"use client";

import { useState } from "react";
import { DomainForm } from "../components/DomainForm";
import { LeadCard } from "../components/LeadCard";
import type { LeadCard as LeadCardData } from "../lib/schema/leadCard";

export default function Home() {
  const [card, setCard] = useState<LeadCardData | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
      {/* Subtle ambient glow at the top */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[480px]"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 0%, rgba(245,158,11,0.05) 0%, rgba(245,158,11,0) 60%)",
        }}
      />

      <div className="mx-auto max-w-[640px] px-6 py-12 sm:px-8 sm:py-16">
        <header className="mb-10">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Cold Lead Decoder
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-neutral-50 sm:text-[32px]">
            Decode a company into an opener.
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-neutral-400">
            Drop a domain. Get a sharp, evidence-grounded cold opener you can send today.
          </p>
        </header>

        <DomainForm
          onSuccess={(c) => setCard(c)}
          onLoadingChange={(l) => {
            if (l) setCard(null);
            setLoading(l);
          }}
        />

        {card && !loading ? (
          <div className="mt-8">
            <LeadCard card={card} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
