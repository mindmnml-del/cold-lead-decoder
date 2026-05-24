import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/pipeline/decodeDomain", () => ({
  decodeDomain: vi.fn(),
}));
vi.mock("../../lib/db/evalStore", () => ({
  saveEvalRun: vi.fn().mockResolvedValue(undefined),
  __initDatabase: vi.fn().mockResolvedValue(undefined),
}));

import { decodeDomain } from "../../lib/pipeline/decodeDomain";
import { saveEvalRun } from "../../lib/db/evalStore";
import { GET } from "../../app/api/cron/eval/route";

const mockedDecode = decodeDomain as unknown as ReturnType<typeof vi.fn>;
const mockedSave = saveEvalRun as unknown as ReturnType<typeof vi.fn>;

function mkRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/eval", {
    method: "GET",
    headers,
  });
}

describe("GET /api/cron/eval", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    mockedDecode.mockReset();
    mockedSave.mockReset().mockResolvedValue(undefined);
    process.env.CRON_SECRET = "test-secret";
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("[CRON AUTH] returns 401 when Authorization header is missing", async () => {
    const res = await GET(mkRequest());
    expect(res.status).toBe(401);
    expect(mockedSave).not.toHaveBeenCalled();
    expect(mockedDecode).not.toHaveBeenCalled();
  });

  it("[METRICS MEASUREMENT] writes one eval_run per domain with numeric latency", async () => {
    mockedDecode.mockResolvedValue({ kind: "ok", card: {} });
    const res = await GET(
      mkRequest({ authorization: "Bearer test-secret" }),
    );
    expect(res.status).toBe(200);
    expect(mockedSave).toHaveBeenCalled();

    const firstCall = mockedSave.mock.calls[0][0];
    expect(firstCall.domain).toBe("stripe.com");
    expect(typeof firstCall.latency_ms).toBe("number");
    expect(firstCall.latency_ms).toBeGreaterThanOrEqual(0);
    expect(firstCall.success).toBe(true);
    expect(firstCall.repair_used).toBeNull();
    expect(firstCall.cost_usd).toBeNull();
    expect(firstCall.banned_phrase_triggered).toBeNull();
  });
});
