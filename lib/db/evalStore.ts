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
  return neon(url);
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
