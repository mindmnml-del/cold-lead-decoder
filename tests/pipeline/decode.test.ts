import { describe, expect, it, vi } from "vitest";
import {
  decodePipeline,
  type PipelineFetcher,
  type PipelineGenerator,
} from "../../lib/pipeline/decode";
import type { OpenerGuard, OpenerGuardResult } from "../../lib/opener/guard";
import type { LeadCard } from "../../lib/schema/leadCard";
import type { ScrapeResult } from "../../lib/scraper/extract";
import type { GenerateLeadCardInput } from "../../lib/llm/repair";

const validCard: LeadCard = {
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

const healthyScrape: ScrapeResult = {
  text: "Acme builds industrial robotic arms. NorthRail case study: 38% pick-error reduction in six weeks. 4-week deployment time.",
  pages: [
    "https://acme-robotics.com/",
    "https://acme-robotics.com/about",
  ],
  degraded: false,
};

function mkFetcher(
  result: ScrapeResult | Error,
): ReturnType<typeof vi.fn<[string], Promise<ScrapeResult>>> {
  if (result instanceof Error) {
    return vi.fn<[string], Promise<ScrapeResult>>(async () => {
      throw result;
    });
  }
  return vi.fn<[string], Promise<ScrapeResult>>(async () => result);
}

function mkGenerator(
  card: LeadCard,
): ReturnType<typeof vi.fn<[GenerateLeadCardInput], Promise<LeadCard>>> {
  return vi.fn<[GenerateLeadCardInput], Promise<LeadCard>>(async () => card);
}

function mkGuard(
  outcome: OpenerGuardResult,
): ReturnType<typeof vi.fn<[string], OpenerGuardResult>> {
  return vi.fn<[string], OpenerGuardResult>(() => outcome);
}

describe("decodePipeline", () => {
  it("[E2E SUCCESS] returns an ok result with the generated card when all layers succeed", async () => {
    const fetcher = mkFetcher(healthyScrape) as unknown as PipelineFetcher;
    const generator = mkGenerator(validCard) as unknown as PipelineGenerator;
    const openerGuard = mkGuard({ valid: true }) as unknown as OpenerGuard;

    const result = await decodePipeline("acme-robotics.com", {
      fetcher,
      generator,
      openerGuard,
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.card).toEqual(validCard);
  });

  it("[BANNED PHRASES] populates confidence_notes (no low_confidence field) when the opener guard rejects", async () => {
    const fetcher = mkFetcher(healthyScrape) as unknown as PipelineFetcher;
    const generator = mkGenerator(validCard) as unknown as PipelineGenerator;
    const openerGuard = mkGuard({
      valid: false,
      note: "Generic opener detected — based on banned phrase list",
    }) as unknown as OpenerGuard;

    const result = await decodePipeline("acme-robotics.com", {
      fetcher,
      generator,
      openerGuard,
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.card.confidence_notes).not.toBeNull();
    expect(result.card.confidence_notes).toContain("Generic opener detected");
    expect((result.card as Record<string, unknown>).low_confidence).toBeUndefined();
  });

  it("[SSRF BLOCK] returns an error result with reason fetch_blocked when the fetcher rejects with a blocked-IP error", async () => {
    const fetcher = mkFetcher(
      new Error("Blocked IP from DNS: evil.example → 10.0.0.5"),
    ) as unknown as PipelineFetcher;
    const generator = mkGenerator(validCard) as unknown as PipelineGenerator;
    const openerGuard = mkGuard({ valid: true }) as unknown as OpenerGuard;

    const result = await decodePipeline("evil.example", {
      fetcher,
      generator,
      openerGuard,
    });

    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("expected error");
    expect(result.reason).toBe("fetch_blocked");
    expect(result.message).toContain("Blocked IP from DNS");
    expect(result.message).toContain("10.0.0.5");
  });

  it("[FAILURE MAPPING] returns a degraded card with confidence_notes when the fetcher reports degraded content", async () => {
    const degradedScrape: ScrapeResult = {
      text: "<thin>",
      pages: ["https://x.com/"],
      degraded: true,
    };
    const degradedCard: LeadCard = {
      ...validCard,
      domain: "x.com",
      source_pages: ["https://x.com/"],
      degraded: true,
      confidence_notes: null,
    };
    const fetcher = mkFetcher(degradedScrape) as unknown as PipelineFetcher;
    const generator = mkGenerator(degradedCard) as unknown as PipelineGenerator;
    const openerGuard = mkGuard({ valid: true }) as unknown as OpenerGuard;

    const result = await decodePipeline("x.com", {
      fetcher,
      generator,
      openerGuard,
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.card.degraded).toBe(true);
    expect(result.card.confidence_notes).not.toBeNull();
    expect(result.card.confidence_notes?.toLowerCase()).toContain("limited");
  });
});
