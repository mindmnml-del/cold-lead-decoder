import { getWeeklyMetrics } from "../../lib/db/evalStore";

export const dynamic = "force-dynamic";

export default async function EvalDashboardPage() {
  const m = await getWeeklyMetrics();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
      <div className="mx-auto max-w-[640px] px-6 py-12 sm:px-8 sm:py-16">
        <header className="mb-10">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Cold Lead Decoder — Eval
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-neutral-50 sm:text-[32px]">
            Last 7 days
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-neutral-400">
            {m.lastUpdated
              ? `Last updated: ${m.lastUpdated.toISOString()}`
              : "No data yet"}
          </p>
        </header>

        {m.totalRuns === 0 ? (
          <p className="rounded-md border border-neutral-800 bg-neutral-900/40 p-6 text-[14.5px] text-neutral-400">
            No eval runs recorded yet. The cron job runs nightly at 02:00 UTC.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Success rate" value={pct(m.successRate)} />
            <Metric label="p50 latency" value={`${m.p50Latency} ms`} />
            <Metric label="p95 latency" value={`${m.p95Latency} ms`} />
            <Metric
              label="Repair rate"
              value={m.repairRate === null ? "—" : pct(m.repairRate)}
            />
            <Metric label="Banned phrase rate" value={pct(m.bannedPhraseRate)} />
            <Metric label="Total runs" value={String(m.totalRuns)} />
          </dl>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/40 p-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-[18px] text-neutral-50">{value}</dd>
    </div>
  );
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
