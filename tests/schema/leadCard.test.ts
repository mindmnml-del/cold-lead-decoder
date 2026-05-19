import { describe, expect, it } from "vitest";
import { LeadCardSchema } from "../../lib/schema/leadCard";

const validCard = {
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
  source_pages: ["https://acme-robotics.com/", "https://acme-robotics.com/about"],
  degraded: false,
  evidence: {
    opener_basis: "Homepage case study with NorthRail citing 38% pick-error reduction in six weeks",
  },
};

describe("LeadCardSchema", () => {
  it("accepts a well-formed card", () => {
    expect(LeadCardSchema.safeParse(validCard).success).toBe(true);
  });

  describe("evidence.opener_basis is required", () => {
    it("rejects a card missing the evidence object", () => {
      const { evidence, ...rest } = validCard;
      void evidence;
      expect(LeadCardSchema.safeParse(rest).success).toBe(false);
    });

    it("rejects a card with evidence but no opener_basis", () => {
      const card = { ...validCard, evidence: {} as { opener_basis: string } };
      expect(LeadCardSchema.safeParse(card).success).toBe(false);
    });

    it("rejects an empty opener_basis string", () => {
      const card = { ...validCard, evidence: { opener_basis: "" } };
      expect(LeadCardSchema.safeParse(card).success).toBe(false);
    });
  });

  describe("string length caps", () => {
    it("rejects a personalized_opener longer than 400 chars", () => {
      const card = { ...validCard, personalized_opener: "x".repeat(401) };
      expect(LeadCardSchema.safeParse(card).success).toBe(false);
    });

    it("rejects a summary longer than 400 chars", () => {
      const card = { ...validCard, summary: "x".repeat(401) };
      expect(LeadCardSchema.safeParse(card).success).toBe(false);
    });

    it("rejects a company_name longer than 120 chars", () => {
      const card = { ...validCard, company_name: "x".repeat(121) };
      expect(LeadCardSchema.safeParse(card).success).toBe(false);
    });

    it("rejects an opener_basis longer than 300 chars", () => {
      const card = {
        ...validCard,
        evidence: { opener_basis: "x".repeat(301) },
      };
      expect(LeadCardSchema.safeParse(card).success).toBe(false);
    });

    it("rejects an array string element longer than 200 chars", () => {
      const card = {
        ...validCard,
        positioning_signals: ["x".repeat(201), "valid second signal"],
      };
      expect(LeadCardSchema.safeParse(card).success).toBe(false);
    });
  });

  describe("array bounds", () => {
    it("rejects positioning_signals with fewer than 2 items", () => {
      const card = { ...validCard, positioning_signals: ["only one"] };
      expect(LeadCardSchema.safeParse(card).success).toBe(false);
    });

    it("rejects positioning_signals with more than 4 items", () => {
      const card = {
        ...validCard,
        positioning_signals: ["a", "b", "c", "d", "e"],
      };
      expect(LeadCardSchema.safeParse(card).success).toBe(false);
    });

    it("rejects likely_pain_points with fewer than 2 items", () => {
      const card = { ...validCard, likely_pain_points: ["only one"] };
      expect(LeadCardSchema.safeParse(card).success).toBe(false);
    });

    it("rejects likely_pain_points with more than 3 items", () => {
      const card = {
        ...validCard,
        likely_pain_points: ["a", "b", "c", "d"],
      };
      expect(LeadCardSchema.safeParse(card).success).toBe(false);
    });

    it("rejects follow_up_angles with length != 2", () => {
      const oneAngle = { ...validCard, follow_up_angles: ["only one"] };
      const threeAngles = { ...validCard, follow_up_angles: ["a", "b", "c"] };
      expect(LeadCardSchema.safeParse(oneAngle).success).toBe(false);
      expect(LeadCardSchema.safeParse(threeAngles).success).toBe(false);
    });

    it("requires at least one source_pages entry", () => {
      const card = { ...validCard, source_pages: [] };
      expect(LeadCardSchema.safeParse(card).success).toBe(false);
    });
  });

  describe("required scalars", () => {
    it("rejects an empty company_name", () => {
      expect(
        LeadCardSchema.safeParse({ ...validCard, company_name: "" }).success,
      ).toBe(false);
    });

    it("rejects an empty domain", () => {
      expect(
        LeadCardSchema.safeParse({ ...validCard, domain: "" }).success,
      ).toBe(false);
    });

    it("rejects a missing degraded flag", () => {
      const { degraded, ...rest } = validCard;
      void degraded;
      expect(LeadCardSchema.safeParse(rest).success).toBe(false);
    });

    it("rejects a non-URL source_pages entry", () => {
      const card = { ...validCard, source_pages: ["not a url"] };
      expect(LeadCardSchema.safeParse(card).success).toBe(false);
    });
  });

  it("allows confidence_notes to be null or a capped string", () => {
    expect(
      LeadCardSchema.safeParse({ ...validCard, confidence_notes: null }).success,
    ).toBe(true);
    expect(
      LeadCardSchema.safeParse({ ...validCard, confidence_notes: "Limited public info" })
        .success,
    ).toBe(true);
    expect(
      LeadCardSchema.safeParse({ ...validCard, confidence_notes: "x".repeat(401) })
        .success,
    ).toBe(false);
  });
});
