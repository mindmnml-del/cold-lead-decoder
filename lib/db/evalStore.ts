import { neon } from "@neondatabase/serverless";

export interface EvalRun {
  domain: string;
  timestamp: Date;
  success: boolean;
  latency_ms: number;
  repair_used: boolean | null;
  cost_usd: number | null;
  banned_phrase_triggered: boolean | null;
}

function getClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url, {
    fetchOptions: { cache: "no-store" },
  });
}

export async function __initDatabase(): Promise<void> {
  const sql = getClient();
  await sql`
    CREATE TABLE IF NOT EXISTS eval_runs (
      domain TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL,
      success BOOLEAN NOT NULL,
      latency_ms INTEGER NOT NULL,
      repair_used BOOLEAN NULL,
      cost_usd NUMERIC NULL,
      banned_phrase_triggered BOOLEAN NULL
    )
  `;
}

export async function saveEvalRun(data: EvalRun): Promise<void> {
  const sql = getClient();
  await sql`
    INSERT INTO eval_runs (
      domain, timestamp, success, latency_ms,
      repair_used, cost_usd, banned_phrase_triggered
    ) VALUES (
      ${data.domain}, ${data.timestamp.toISOString()}, ${data.success}, ${data.latency_ms},
      ${data.repair_used}, ${data.cost_usd}, ${data.banned_phrase_triggered}
    )
  `;
}

export interface EvalSummary {
  successRate: number;
  repairRate: number | null;
  p50Latency: number;
  p95Latency: number;
  bannedPhraseRate: number;
  totalRuns: number;
  lastUpdated: Date | null;
}

export async function getWeeklyMetrics(): Promise<EvalSummary> {
  const sql = getClient();
  const rows = (await sql`
    SELECT success, latency_ms, repair_used, banned_phrase_triggered, timestamp
    FROM eval_runs
    WHERE timestamp > NOW() - INTERVAL '7 days'
  `) as Array<{
    success: boolean;
    latency_ms: number;
    repair_used: boolean | null;
    banned_phrase_triggered: boolean | null;
    timestamp: Date | string;
  }>;

  if (rows.length === 0) {
    return {
      successRate: 0,
      repairRate: null,
      p50Latency: 0,
      p95Latency: 0,
      bannedPhraseRate: 0,
      totalRuns: 0,
      lastUpdated: null,
    };
  }

  const total = rows.length;
  const successes = rows.filter((r) => r.success).length;
  const sorted = rows.map((r) => r.latency_ms).sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];

  const repairObserved = rows.filter((r) => r.repair_used !== null);
  const repairRate =
    repairObserved.length === 0
      ? null
      : repairObserved.filter((r) => r.repair_used === true).length / total;

  const bannedPhraseRate =
    rows.filter((r) => r.banned_phrase_triggered === true).length / total;

  const lastUpdated = rows.reduce<Date>((acc, r) => {
    const t = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
    return t > acc ? t : acc;
  }, new Date(0));

  return {
    successRate: successes / total,
    repairRate,
    p50Latency: p50,
    p95Latency: p95,
    bannedPhraseRate,
    totalRuns: total,
    lastUpdated,
  };
}
