import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sqlMock = vi.fn();

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => sqlMock),
}));

import { getWeeklyMetrics } from "../../lib/db/evalStore";

describe("getWeeklyMetrics", () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://test";
    sqlMock.mockReset();
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalUrl;
  });

  it("[METRICS AGGREGATION] computes success rate, p50/p95 latency, and null repairRate when all repair_used are null", async () => {
    const now = new Date("2026-05-24T12:00:00Z");
    const rows = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map(
      (latency, i) => ({
        success: i < 8,
        latency_ms: latency,
        repair_used: null,
        banned_phrase_triggered: null,
        timestamp: now,
      }),
    );
    sqlMock.mockResolvedValueOnce(rows);

    const summary = await getWeeklyMetrics();

    expect(summary.successRate).toBe(0.8);
    expect(summary.p50Latency).toBe(600);
    expect(summary.p95Latency).toBe(1000);
    expect(summary.repairRate).toBeNull();
    expect(summary.bannedPhraseRate).toBe(0);
    expect(summary.totalRuns).toBe(10);
    expect(summary.lastUpdated).toEqual(now);
  });
});
