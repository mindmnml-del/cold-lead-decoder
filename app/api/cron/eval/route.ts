import { decodeDomain } from "../../../../lib/pipeline/decodeDomain";
import { saveEvalRun, __initDatabase } from "../../../../lib/db/evalStore";

export const runtime = "nodejs";
export const maxDuration = 60;

const DOMAINS = [
  "stripe.com",
  "notion.so",
  "linear.app",
  "figma.com",
  "vercel.com",
  "resend.com",
  "planetscale.com",
  "railway.app",
  "supabase.com",
  "clerk.dev",
  "prisma.io",
  "turso.tech",
  "upstash.com",
  "inngest.com",
  "trigger.dev",
  "loops.so",
  "cal.com",
  "dub.co",
  "hashnode.com",
  "daily.dev",
];

export async function GET(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await __initDatabase();

  let processed = 0;
  let failed = 0;

  for (const domain of DOMAINS) {
    const start = Date.now();
    let success = false;
    try {
      const result = await decodeDomain(domain);
      success = result.kind === "ok";
    } catch {
      success = false;
    }
    const latency_ms = Date.now() - start;

    try {
      await saveEvalRun({
        domain,
        timestamp: new Date(),
        success,
        latency_ms,
        repair_used: null,
        cost_usd: null,
        banned_phrase_triggered: null,
      });
    } catch {
      // storage failure on a single row must not crash the run
    }

    if (success) processed++;
    else failed++;
  }

  return Response.json({ processed, failed });
}
