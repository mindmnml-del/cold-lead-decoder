type Bucket = number[];

const buckets = new Map<string, Bucket>();

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const MAX = envInt("RATE_LIMIT_MAX", 5);
const WINDOW_MS = envInt("RATE_LIMIT_WINDOW_MS", 60_000);

export interface RateLimitResult {
  allowed: boolean;
}

export async function checkRateLimit(
  identifier: string,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const cutoff = now - WINDOW_MS;
  const prev = buckets.get(identifier) ?? [];
  const fresh = prev.filter((t) => t > cutoff);
  fresh.push(now);
  buckets.set(identifier, fresh);
  return { allowed: fresh.length <= MAX };
}

export function __resetRateLimiterForTests(): void {
  buckets.clear();
}

export function extractClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0];
    if (first) return first.trim();
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
