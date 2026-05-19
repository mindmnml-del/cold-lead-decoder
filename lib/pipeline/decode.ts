import type { LeadCard } from "../schema/leadCard";
import type { ScrapeResult } from "../scraper/extract";
import type { GenerateLeadCardInput } from "../llm/repair";
import type { OpenerGuard } from "../opener/guard";

export type PipelineFetcher = (domain: string) => Promise<ScrapeResult>;
export type PipelineGenerator = (
  input: GenerateLeadCardInput,
) => Promise<LeadCard>;

export interface PipelineOpts {
  fetcher: PipelineFetcher;
  generator: PipelineGenerator;
  openerGuard: OpenerGuard;
}

export type DecodeResult =
  | { kind: "ok"; card: LeadCard }
  | {
      kind: "error";
      reason: "invalid_domain" | "fetch_blocked" | "decode_failed";
      message: string;
    };

export async function decodePipeline(
  _domain: string,
  _opts: PipelineOpts,
): Promise<DecodeResult> {
  throw new Error("Not Implemented");
}
