import { describe, expect, it } from "vitest";
import goldenSet from "./golden_set.json";
import {
  decodePipeline,
  type PipelineFetcher,
  type PipelineGenerator,
} from "../../lib/pipeline/decode";
import { LeadCardSchema } from "../../lib/schema/leadCard";
import { bannedPhraseGuard } from "../../lib/opener/guard";
import { generateLeadCard } from "../../lib/llm/repair";
import { createDeepSeekFn } from "../../lib/llm/deepseek";
import type { ScrapeResult } from "../../lib/scraper/extract";

const HAS_KEY = Boolean(process.env.DEEPSEEK_API_KEY);

describe.skipIf(!HAS_KEY)("eval harness — property-based assertions", () => {
  it.each(goldenSet)(
    "[$id] $domain — card satisfies all properties",
    async ({ domain, mockPageText }) => {
      // Lazy construction: keep OpenAI client out of describe-body execution
      // so the skipIf branch never instantiates a client without an API key.
      const create = createDeepSeekFn(process.env.DEEPSEEK_API_KEY!);

      const fetcher: PipelineFetcher = async () =>
        ({
          text: mockPageText,
          pages: [`https://${domain}/`],
          degraded: mockPageText.length < 600,
        }) satisfies ScrapeResult;

      const generator: PipelineGenerator = (input) =>
        generateLeadCard({ create, input });

      const result = await decodePipeline(domain, {
        fetcher,
        generator,
        openerGuard: bannedPhraseGuard,
      });

      expect(result.kind).toBe("ok");
      if (result.kind !== "ok") return;
      const { card } = result;

      expect(LeadCardSchema.safeParse(card).success).toBe(true);

      expect(card.evidence.opener_basis.trim().length).toBeGreaterThan(0);

      expect(card.follow_up_angles).toHaveLength(2);

      const opener = card.personalized_opener.trim().toLowerCase();
      const name = card.company_name.trim().toLowerCase();
      expect(opener.startsWith(name)).toBe(false);

      expect(bannedPhraseGuard(card.personalized_opener).valid).toBe(true);
    },
    30_000,
  );
});
