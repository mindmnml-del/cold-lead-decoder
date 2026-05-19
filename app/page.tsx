"use client";

import { useState } from "react";
import { DomainForm } from "../components/DomainForm";
import { LeadCard } from "../components/LeadCard";
import type { LeadCard as LeadCardData } from "../lib/schema/leadCard";

export default function Home() {
  const [card, setCard] = useState<LeadCardData | null>(null);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Cold Lead Decoder
          </h1>
          <p className="mt-2 text-slate-600">
            Drop a company domain. Get a sharp opener you can send today.
          </p>
        </header>

        <DomainForm onSuccess={setCard} />

        {card ? (
          <div className="mt-8">
            <LeadCard card={card} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
