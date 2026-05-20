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

const SYSTEM_PROMPT = `You are a B2B sales-research assistant.
Respond with a single valid JSON object and nothing else — no prose, no markdown fences, no commentary.

Required JSON shape:
{
  "company_name": string (1–120),
  "domain": string (1–253),
  "summary": string (1–400),
  "category": string (1–80),
  "positioning_signals": string[] (2–4 items, each 1–200 chars),
  "likely_pain_points": string[] (2–3 items, each non-empty),
  "personalized_opener": string (1–400),
  "follow_up_angles": string[] (exactly 2 items, each non-empty),
  "confidence_notes": string | null (max 400),
  "source_pages": string[] of URLs (must be a subset of the provided source_pages),
  "degraded": boolean,
  "evidence": { "opener_basis": string (1–300, required, non-empty) }
}

CRITICAL: Frame personalized_opener from the perspective of a seller reaching out TO this company. Do NOT summarize what they do. Instead, identify a concrete detail on their site that gives a reason to reach out (e.g., "I saw you are expanding into X, which is why..."). opener_basis must explain WHY this detail makes the opener relevant — not what the company does.

Use only facts present in the provided page text. Do not invent details.`;

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
