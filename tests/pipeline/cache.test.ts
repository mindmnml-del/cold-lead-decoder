import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodePipeline,
  type PipelineFetcher,
  type PipelineGenerator,
} from "../../lib/pipeline/decode";
import type { OpenerGuard, OpenerGuardResult } from "../../lib/opener/guard";
import type { LeadCard } from "../../lib/schema/leadCard";
import type { ScrapeResult } from "../../lib/scraper/extract";
import type { GenerateLeadCardInput } from "../../lib/llm/repair";
import {
  __resetCacheForTests,
  getCached,
  setCached,
} from "../../lib/cache/domainCache";

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
  pages: ["https://acme-robotics.com/", "https://acme-robotics.com/about"],
  degraded: false,
};

function mkFetcher(
  result: ScrapeResult,
): ReturnType<typeof vi.fn<(domain: string) => Promise<ScrapeResult>>> {
  return vi.fn<(domain: string) => Promise<ScrapeResult>>(async () => result);
}

function mkGenerator(
  card: LeadCard,
): ReturnType<
  typeof vi.fn<(input: GenerateLeadCardInput) => Promise<LeadCard>>
> {
  return vi.fn<(input: GenerateLeadCardInput) => Promise<LeadCard>>(
    async () => card,
  );
}

function mkGuard(
  outcome: OpenerGuardResult,
): ReturnType<typeof vi.fn<(opener: string) => OpenerGuardResult>> {
  return vi.fn<(opener: string) => OpenerGuardResult>(() => outcome);
}

describe("decodePipeline cache integration", () => {
  beforeEach(() => {
    __resetCacheForTests();
    vi.stubEnv("ENABLE_CACHE", "true");
  });

  it("[CACHE MISS] executes full pipeline and stores result when cache is empty", async () => {
    const fetcher = mkFetcher(healthyScrape);
    const generator = mkGenerator(validCard);
    const openerGuard = mkGuard({ valid: true });

    expect(getCached("acme-robotics.com")).toBeUndefined();

    const result = await decodePipeline("acme-robotics.com", {
      fetcher: fetcher as unknown as PipelineFetcher,
      generator: generator as unknown as PipelineGenerator,
      openerGuard: openerGuard as unknown as OpenerGuard,
    });

    expect(result.kind).toBe("ok");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(generator).toHaveBeenCalledTimes(1);
    expect(getCached("acme-robotics.com")).toBeDefined();
  });

  it("[CACHE HIT] returns cached card without invoking scraper or LLM", async () => {
    setCached("acme-robotics.com", validCard);

    const fetcher = mkFetcher(healthyScrape);
    const generator = mkGenerator(validCard);
    const openerGuard = mkGuard({ valid: true });

    const result = await decodePipeline("acme-robotics.com", {
      fetcher: fetcher as unknown as PipelineFetcher,
      generator: generator as unknown as PipelineGenerator,
      openerGuard: openerGuard as unknown as OpenerGuard,
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.card).toEqual(validCard);
    expect(fetcher).not.toHaveBeenCalled();
    expect(generator).not.toHaveBeenCalled();
    expect(openerGuard).not.toHaveBeenCalled();
  });

  it("[SCHEMA VALIDATION] rejects malformed cached data and falls through to full pipeline", async () => {
    setCached("acme-robotics.com", { not: "a valid lead card" });

    const fetcher = mkFetcher(healthyScrape);
    const generator = mkGenerator(validCard);
    const openerGuard = mkGuard({ valid: true });

    const result = await decodePipeline("acme-robotics.com", {
      fetcher: fetcher as unknown as PipelineFetcher,
      generator: generator as unknown as PipelineGenerator,
      openerGuard: openerGuard as unknown as OpenerGuard,
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.card).toEqual(validCard);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(generator).toHaveBeenCalledTimes(1);
  });

  it("[FEATURE FLAG OFF] does not read or write cache when ENABLE_CACHE is unset", async () => {
    vi.stubEnv("ENABLE_CACHE", "");
    setCached("acme-robotics.com", validCard);

    const fetcher = mkFetcher(healthyScrape);
    const generator = mkGenerator(validCard);
    const openerGuard = mkGuard({ valid: true });

    const result = await decodePipeline("acme-robotics.com", {
      fetcher: fetcher as unknown as PipelineFetcher,
      generator: generator as unknown as PipelineGenerator,
      openerGuard: openerGuard as unknown as OpenerGuard,
    });

    expect(result.kind).toBe("ok");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(generator).toHaveBeenCalledTimes(1);
  });
});
