import type { z } from "zod";
import type { LeadCard } from "../schema/leadCard";
import type { CreateFn } from "./deepseek";

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

export declare function generateLeadCard(
  opts: GenerateLeadCardOpts,
): Promise<LeadCard>;
