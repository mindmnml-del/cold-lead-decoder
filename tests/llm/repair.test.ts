import { describe, expect, it, vi } from "vitest";
import {
  type CreateFn,
  type CreateRequest,
  type CreateResponse,
} from "../../lib/llm/deepseek";
import {
  LeadCardValidationError,
  SYSTEM_PROMPT,
  generateLeadCard,
} from "../../lib/llm/repair";
import { LeadCardSchema } from "../../lib/schema/leadCard";

const mkResp = (content: string): CreateResponse => ({
  choices: [{ message: { content } }],
});

const validCard = {
  company_name: "Acme Robotics",
  domain: "acme.example",
  summary: "Builds industrial robotic arms for warehouse automation.",
  category: "Industrial Robotics",
  positioning_signals: [
    "Patented gripper design",
    "Deployed in 200+ warehouses",
  ],
  likely_pain_points: [
    "Manual picking fatigue",
    "Throughput plateau in peak season",
  ],
  personalized_opener: "Noticed you launched the V3 gripper last quarter.",
  follow_up_angles: [
    "Ask about the V3 rollout timeline",
    "Reference the 200-warehouse milestone",
  ],
  confidence_notes: null,
  source_pages: ["https://acme.example/"],
  degraded: false,
  evidence: { opener_basis: "Homepage hero mentions V3 gripper launch." },
};

const validCardJson = JSON.stringify(validCard);

// Invalid: follow_up_angles has length 1, must be exactly 2 per schema.
const invalidCardA = { ...validCard, follow_up_angles: ["only one angle"] };
const invalidCardJsonA = JSON.stringify(invalidCardA);

// Invalid: positioning_signals has length 1, must be 2-4 per schema.
const invalidCardB = { ...validCard, positioning_signals: ["solo signal"] };
const invalidCardJsonB = JSON.stringify(invalidCardB);

const input = {
  domain: "acme.example",
  pageText: "Acme Robotics builds industrial robotic arms ...",
  sourcePages: ["https://acme.example/"],
  degraded: false,
};

describe("generateLeadCard — repair retry (ADR-005)", () => {
  it("R1: [REPAIR ATTEMPT] retries once on Zod failure and succeeds", async () => {
    const create = vi
      .fn<(req: CreateRequest) => Promise<CreateResponse>>()
      .mockResolvedValueOnce(mkResp(invalidCardJsonA))
      .mockResolvedValueOnce(mkResp(validCardJson));

    const card = await generateLeadCard({
      create: create as unknown as CreateFn,
      input,
    });

    expect(create).toHaveBeenCalledTimes(2);
    const reparsed = LeadCardSchema.safeParse(card);
    expect(reparsed.success).toBe(true);
  });

  it("R2: [REPAIR ATTEMPT] repair prompt includes Zod error path and message", async () => {
    const create = vi
      .fn<(req: CreateRequest) => Promise<CreateResponse>>()
      .mockResolvedValueOnce(mkResp(invalidCardJsonA))
      .mockResolvedValueOnce(mkResp(validCardJson));

    await generateLeadCard({
      create: create as unknown as CreateFn,
      input,
    });

    // Compute what the impl should have surfaced.
    const issues = LeadCardSchema.safeParse(invalidCardA);
    expect(issues.success).toBe(false);
    if (issues.success) return; // narrow for TS

    const repairReq = create.mock.calls[1]![0];
    const lastUser = [...repairReq.messages]
      .reverse()
      .find((m) => m.role === "user");
    expect(lastUser, "repair call should include a user message").toBeDefined();

    for (const issue of issues.error.issues) {
      const path = issue.path.join(".");
      expect(lastUser!.content).toContain(path);
      expect(lastUser!.content).toContain(issue.message);
    }
  });

  it("R3: [REPAIR ATTEMPT] repair prompt includes the prior assistant output verbatim", async () => {
    const create = vi
      .fn<(req: CreateRequest) => Promise<CreateResponse>>()
      .mockResolvedValueOnce(mkResp(invalidCardJsonA))
      .mockResolvedValueOnce(mkResp(validCardJson));

    await generateLeadCard({
      create: create as unknown as CreateFn,
      input,
    });

    const repairReq = create.mock.calls[1]![0];
    const assistantMsg = repairReq.messages.find((m) => m.role === "assistant");
    expect(
      assistantMsg,
      "repair call must echo the prior assistant output",
    ).toBeDefined();
    expect(assistantMsg!.content).toBe(invalidCardJsonA);
  });
});

describe("generateLeadCard — hard fail (ADR-005)", () => {
  it("R4: [HARD FAIL] throws LeadCardValidationError after two consecutive Zod failures", async () => {
    const create = vi
      .fn<(req: CreateRequest) => Promise<CreateResponse>>()
      .mockResolvedValueOnce(mkResp(invalidCardJsonA))
      .mockResolvedValueOnce(mkResp(invalidCardJsonB));

    await expect(
      generateLeadCard({
        create: create as unknown as CreateFn,
        input,
      }),
    ).rejects.toBeInstanceOf(LeadCardValidationError);
  });

  it("R5: [HARD FAIL] does NOT issue a third call", async () => {
    const create = vi
      .fn<(req: CreateRequest) => Promise<CreateResponse>>()
      .mockResolvedValueOnce(mkResp(invalidCardJsonA))
      .mockResolvedValueOnce(mkResp(invalidCardJsonB));

    await expect(
      generateLeadCard({
        create: create as unknown as CreateFn,
        input,
      }),
    ).rejects.toBeInstanceOf(LeadCardValidationError);

    expect(create).toHaveBeenCalledTimes(2);
  });

  it("R6: [HARD FAIL] preserves both raw outputs and ZodIssue arrays on the error", async () => {
    const create = vi
      .fn<(req: CreateRequest) => Promise<CreateResponse>>()
      .mockResolvedValueOnce(mkResp(invalidCardJsonA))
      .mockResolvedValueOnce(mkResp(invalidCardJsonB));

    let caught: unknown;
    try {
      await generateLeadCard({
        create: create as unknown as CreateFn,
        input,
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(LeadCardValidationError);
    const err = caught as LeadCardValidationError;
    expect(err.attempts).toHaveLength(2);
    expect(err.attempts[0]!.raw).toBe(invalidCardJsonA);
    expect(err.attempts[1]!.raw).toBe(invalidCardJsonB);
    expect(Array.isArray(err.attempts[0]!.issues)).toBe(true);
    expect(Array.isArray(err.attempts[1]!.issues)).toBe(true);
    expect(err.attempts[0]!.issues.length).toBeGreaterThan(0);
    expect(Array.isArray(err.attempts[0]!.issues[0]!.path)).toBe(true);
  });
});

describe("SYSTEM_PROMPT behavioral contract", () => {
  it("prompt contains role anchor as outside sales rep", () => {
    expect(SYSTEM_PROMPT).toContain("outside sales rep");
  });

  it("prompt contains BAD/GOOD exemplar pair", () => {
    expect(SYSTEM_PROMPT).toContain("BAD:");
    expect(SYSTEM_PROMPT).toContain("GOOD:");
  });

  it("prompt forbids value-prop summarizing", () => {
    expect(SYSTEM_PROMPT).toContain("Never summarize what they do");
  });

  it("prompt scopes opener_basis to trigger justification", () => {
    expect(SYSTEM_PROMPT).toContain("opener_basis must name WHY that trigger");
  });
});
