import type { z } from "zod";
import { LeadCardSchema, type LeadCard } from "../schema/leadCard";
import {
  DEEPSEEK_MODEL,
  type ChatMessage,
  type CreateFn,
  type CreateRequest,
} from "./deepseek";

export interface GenerateLeadCardInput {
  domain: string;
  pageText: string;
  sourcePages: string[];
  degraded: boolean;
}

export interface GenerateLeadCardOpts {
  create: CreateFn;
  input: GenerateLeadCardInput;
}

export interface RepairAttempt {
  raw: string;
  issues: z.ZodIssue[];
}

export class LeadCardValidationError extends Error {
  readonly attempts: ReadonlyArray<RepairAttempt>;
  constructor(attempts: ReadonlyArray<RepairAttempt>) {
    super(
      `LeadCard validation failed after ${attempts.length} attempt(s)`,
    );
    this.name = "LeadCardValidationError";
    this.attempts = attempts;
  }
}

export const SYSTEM_PROMPT =
  "You are a B2B sales-research assistant.\n" +
  "Respond with a single valid JSON object and nothing else — no prose, no markdown fences, no commentary.\n" +
  "\n" +
  "Required JSON shape:\n" +
  "{\n" +
  '  "company_name": string (1–120),\n' +
  '  "domain": string (1–253),\n' +
  '  "summary": string (1–400),\n' +
  '  "category": string (1–80),\n' +
  '  "positioning_signals": string[] (2–4 items, each 1–200 chars),\n' +
  '  "likely_pain_points": string[] (2–3 items, each non-empty),\n' +
  '  "personalized_opener": string (1–400),\n' +
  '  "follow_up_angles": string[] (exactly 2 items, each non-empty),\n' +
  '  "confidence_notes": string | null (max 400),\n' +
  '  "source_pages": string[] of URLs (must be a subset of the provided source_pages),\n' +
  '  "degraded": boolean,\n' +
  '  "evidence": { "opener_basis": string (1–300, required, non-empty) }\n' +
  "}\n" +
  "\n" +
  "CRITICAL — personalized_opener:\n" +
  "You are an outside sales rep messaging this company; you do not yet know what you sell. " +
  "Your job is to cite ONE concrete trigger from their pages (a recent launch, hire, integration, customer, job post, or unusual claim) " +
  "and use it as the reason to reach out. " +
  'Never summarize what they do — that is what "summary" is for. ' +
  "opener_basis must name WHY that trigger justifies outreach, not describe the company.\n" +
  "\n" +
  'BAD: "Figma is a leading design tool. Our solution can help you scale design ops." (paraphrases value prop, vague "our solution", no trigger)\n' +
  'GOOD: "Saw you shipped the Figma MCP server last month — we help teams rolling out new developer integrations get adoption signal early." (specific recent event + plausible business reason)\n' +
  "\n" +
  "Use only facts present in the provided page text. Do not invent details.";

const MAX_TOKENS = 1500;

function buildUserPrompt(input: GenerateLeadCardInput): string {
  return [
    `Domain: ${input.domain}`,
    `Source pages: ${input.sourcePages.join(", ")}`,
    `Degraded: ${input.degraded}`,
    ``,
    `Page content:`,
    input.pageText,
  ].join("\n");
}

function buildRepairPrompt(issues: z.ZodIssue[]): string {
  const lines = issues.map(
    (i) => `- path: ${i.path.join(".")} — ${i.message}`,
  );
  return [
    `Your previous response failed Zod validation. Fix every issue below and return the entire corrected JSON object.`,
    ``,
    `Issues:`,
    ...lines,
    ``,
    `Return one JSON object only. No prose, no markdown fences.`,
  ].join("\n");
}

type ValidationOutcome =
  | { ok: true; data: LeadCard }
  | { ok: false; issues: z.ZodIssue[] };

function parseAndValidate(raw: string): ValidationOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  const result = LeadCardSchema.safeParse(parsed);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, issues: result.error.issues };
}

export async function generateLeadCard(
  opts: GenerateLeadCardOpts,
): Promise<LeadCard> {
  const system: ChatMessage = { role: "system", content: SYSTEM_PROMPT };
  const user: ChatMessage = {
    role: "user",
    content: buildUserPrompt(opts.input),
  };

  const req1: CreateRequest = {
    model: DEEPSEEK_MODEL,
    messages: [system, user],
    response_format: { type: "json_object" },
    max_tokens: MAX_TOKENS,
  };
  const res1 = await opts.create(req1);
  const raw1 = res1.choices?.[0]?.message?.content ?? "";
  const r1 = parseAndValidate(raw1);
  if (r1.ok) return r1.data;

  const assistant: ChatMessage = { role: "assistant", content: raw1 };
  const repair: ChatMessage = {
    role: "user",
    content: buildRepairPrompt(r1.issues),
  };
  const req2: CreateRequest = {
    model: DEEPSEEK_MODEL,
    messages: [system, user, assistant, repair],
    response_format: { type: "json_object" },
    max_tokens: MAX_TOKENS,
  };
  const res2 = await opts.create(req2);
  const raw2 = res2.choices?.[0]?.message?.content ?? "";
  const r2 = parseAndValidate(raw2);
  if (r2.ok) return r2.data;

  throw new LeadCardValidationError([
    { raw: raw1, issues: r1.issues },
    { raw: raw2, issues: r2.issues },
  ]);
}
