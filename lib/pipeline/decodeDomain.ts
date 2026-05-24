import { decodePipeline, type DecodeResult } from "./decode";
import { scrapeSite } from "../scraper/extract";
import { generateLeadCard } from "../llm/repair";
import { createDeepSeekFn } from "../llm/deepseek";
import { bannedPhraseGuard } from "../opener/guard";

export async function decodeDomain(domain: string): Promise<DecodeResult> {
  return decodePipeline(domain, {
    fetcher: (d) => scrapeSite(`https://${d}`),
    generator: (input) =>
      generateLeadCard({
        input,
        create: createDeepSeekFn(process.env.DEEPSEEK_API_KEY ?? ""),
      }),
    openerGuard: bannedPhraseGuard,
  });
}
