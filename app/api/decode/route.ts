import { decodePipeline } from "../../../lib/pipeline/decode";
import { scrapeSite } from "../../../lib/scraper/extract";
import { generateLeadCard } from "../../../lib/llm/repair";
import { createDeepSeekFn } from "../../../lib/llm/deepseek";
import { bannedPhraseGuard } from "../../../lib/opener/guard";

export const runtime = "nodejs";

const STATUS_BY_REASON = {
  invalid_domain: 400,
  fetch_blocked: 403,
  decode_failed: 500,
} as const;

export async function POST(req: Request): Promise<Response> {
  let domain: unknown;
  try {
    const body = (await req.json()) as { domain?: unknown };
    domain = body?.domain;
  } catch {
    return Response.json(
      { reason: "invalid_domain", message: "Body must be JSON with { domain }" },
      { status: 400 },
    );
  }

  if (typeof domain !== "string") {
    return Response.json(
      { reason: "invalid_domain", message: "`domain` must be a string" },
      { status: 400 },
    );
  }

  const result = await decodePipeline(domain, {
    fetcher: (domain) => scrapeSite(`https://${domain}`),
    generator: (input) =>
      generateLeadCard({
        input,
        create: createDeepSeekFn(process.env.DEEPSEEK_API_KEY ?? ""),
      }),
    openerGuard: bannedPhraseGuard,
  });

  if (result.kind === "ok") {
    return Response.json(result.card, { status: 200 });
  }

  return Response.json(
    { reason: result.reason, message: result.message },
    { status: STATUS_BY_REASON[result.reason] },
  );
}
