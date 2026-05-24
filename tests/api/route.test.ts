import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadCard } from "../../lib/schema/leadCard";

vi.mock("../../lib/pipeline/decode", () => ({
  decodePipeline: vi.fn(),
}));

import { decodePipeline } from "../../lib/pipeline/decode";
import { POST } from "../../app/api/decode/route";
import { __resetRateLimiterForTests } from "../../lib/security/rateLimiter";

const mockedDecode = decodePipeline as unknown as ReturnType<typeof vi.fn>;

const fixtureCard: LeadCard = {
  company_name: "Acme Robotics",
  domain: "acme-robotics.com",
  summary: "Acme builds industrial robotic arms for mid-market warehouses.",
  category: "Industrial robotics",
  positioning_signals: [
    "Targets warehouses with 10-50 SKUs/hour throughput",
    "Emphasizes 4-week deployment time on the homepage",
  ],
  likely_pain_points: [
    "Manual pick-pack at peak season strains seasonal hiring",
    "Existing WMS integrations are fragile",
  ],
  personalized_opener:
    "Saw your case study with NorthRail cutting pick errors by 38% in six weeks.",
  follow_up_angles: [
    "Ask how their integration layer handles legacy WMS quirks",
    "Probe seasonal peak load handling vs. their published throughput",
  ],
  confidence_notes: null,
  source_pages: [
    "https://acme-robotics.com/",
    "https://acme-robotics.com/about",
  ],
  degraded: false,
  evidence: {
    opener_basis:
      "Homepage case study with NorthRail citing 38% pick-error reduction in six weeks",
  },
};

function mkRequest(body: unknown): Request {
  return new Request("http://localhost/api/decode", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/decode", () => {
  beforeEach(() => {
    mockedDecode.mockReset();
    __resetRateLimiterForTests();
  });

  it("[200] returns card JSON when pipeline returns kind=ok", async () => {
    mockedDecode.mockResolvedValue({ kind: "ok", card: fixtureCard });
    const res = await POST(mkRequest({ domain: "acme-robotics.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(fixtureCard);
  });

  it("[400] returns 400 when reason=invalid_domain", async () => {
    mockedDecode.mockResolvedValue({
      kind: "error",
      reason: "invalid_domain",
      message: "invalid domain",
    });
    const res = await POST(mkRequest({ domain: "" }));
    expect(res.status).toBe(400);
  });

  it("[403] returns 403 when reason=fetch_blocked (SSRF)", async () => {
    mockedDecode.mockResolvedValue({
      kind: "error",
      reason: "fetch_blocked",
      message: "Blocked IP from DNS: evil.example → 10.0.0.5",
    });
    const res = await POST(mkRequest({ domain: "evil.example" }));
    expect(res.status).toBe(403);
  });

  it("[500] returns 500 when reason=decode_failed", async () => {
    mockedDecode.mockResolvedValue({
      kind: "error",
      reason: "decode_failed",
      message: "boom",
    });
    const res = await POST(mkRequest({ domain: "acme-robotics.com" }));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/decode — rate limiting", () => {
  beforeEach(() => {
    mockedDecode.mockReset();
    __resetRateLimiterForTests();
  });

  function mkIpRequest(ip: string, body: unknown): Request {
    return new Request("http://localhost/api/decode", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    });
  }

  it("[429] returns 429 after the limit is exceeded for one IP", async () => {
    mockedDecode.mockResolvedValue({ kind: "ok", card: fixtureCard });
    for (let i = 0; i < 5; i++) {
      const ok = await POST(mkIpRequest("1.2.3.4", { domain: "acme-robotics.com" }));
      expect(ok.status).toBe(200);
    }
    const blocked = await POST(mkIpRequest("1.2.3.4", { domain: "acme-robotics.com" }));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({
      reason: "rate_limited",
      message: expect.any(String),
    });
  });

  it("does not rate-limit requests from a different IP", async () => {
    mockedDecode.mockResolvedValue({ kind: "ok", card: fixtureCard });
    for (let i = 0; i < 5; i++) {
      await POST(mkIpRequest("1.2.3.4", { domain: "acme-robotics.com" }));
    }
    const other = await POST(mkIpRequest("9.9.9.9", { domain: "acme-robotics.com" }));
    expect(other.status).toBe(200);
  });
});
