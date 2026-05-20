import { describe, expect, it, vi } from "vitest";
import {
  type CreateFn,
  type CreateRequest,
  type CreateResponse,
} from "../../lib/llm/deepseek";
import { generateLeadCard } from "../../lib/llm/repair";
import { LeadCardSchema } from "../../lib/schema/leadCard";

const mkResp = (content: string): CreateResponse => ({
  choices: [{ message: { content } }],
});

const buyerFramedCard = {
  company_name: "SecureCloud",
  domain: "securecloud.example",
  summary: "SOC2 compliance automation platform for growing startups.",
  category: "Compliance / SaaS",
  positioning_signals: [
    "Targets pre-Series-B startups",
    "Automated SOC2 evidence collection",
  ],
  likely_pain_points: [
    "Manual evidence collection eats engineering time",
    "Audit deadlines slip during fundraising",
  ],
  personalized_opener:
    "I saw SecureCloud is automating SOC2 for startups — that usually means compliance reviews are eating engineering hours, which is why I wanted to reach out.",
  follow_up_angles: [
    "Ask about evidence-collection coverage",
    "Reference recent funding round",
  ],
  confidence_notes: null,
  source_pages: ["https://securecloud.example/"],
  degraded: false,
  evidence: {
    opener_basis:
      "Homepage hero highlights SOC2-for-startups focus, which signals compliance-team bandwidth pressure worth opening on.",
  },
};

const input = {
  domain: "securecloud.example",
  pageText: "We offer SOC2 compliance automation.",
  sourcePages: ["https://securecloud.example/"],
  degraded: false,
};

describe("personalized_opener — buyer-framing pin (ADR-004)", () => {
  it("[OPENER BUYER FRAMING] opener is not a seller-style company summary", async () => {
    // Sanity: fixture itself is a schema-valid LeadCard, so the test exercises
    // the framing assertion, not Zod validation.
    expect(LeadCardSchema.safeParse(buyerFramedCard).success).toBe(true);

    const create = vi
      .fn<[CreateRequest], Promise<CreateResponse>>()
      .mockResolvedValueOnce(mkResp(JSON.stringify(buyerFramedCard)));

    const card = await generateLeadCard({
      create: create as unknown as CreateFn,
      input,
    });

    expect(card.personalized_opener).not.toMatch(
      /^SecureCloud (offers|provides)/i,
    );
  });
});
