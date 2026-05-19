import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadCard } from "../../lib/schema/leadCard";

vi.mock("../../lib/pipeline/decode", () => ({
  decodePipeline: vi.fn(),
}));

import { decodePipeline } from "../../lib/pipeline/decode";
import { POST } from "../../app/api/decode/route";

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
