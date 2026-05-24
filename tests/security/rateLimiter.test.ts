import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetRateLimiterForTests,
  checkRateLimit,
  extractClientIp,
} from "../../lib/security/rateLimiter";

beforeEach(() => __resetRateLimiterForTests());
afterEach(() => __resetRateLimiterForTests());

describe("checkRateLimit (bucket enforcement)", () => {
  it("allows the first 5 requests from one identifier within the window", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit("1.2.3.4");
      expect(r.allowed).toBe(true);
    }
  });

  it("blocks the 6th request from the same identifier within the window", async () => {
    for (let i = 0; i < 5; i++) await checkRateLimit("1.2.3.4");
    const r = await checkRateLimit("1.2.3.4");
    expect(r.allowed).toBe(false);
  });

  it("tracks identifiers independently", async () => {
    for (let i = 0; i < 5; i++) await checkRateLimit("1.2.3.4");
    const other = await checkRateLimit("9.9.9.9");
    expect(other.allowed).toBe(true);
  });

  it("forgets requests older than the window (sliding behavior)", async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) await checkRateLimit("1.2.3.4", t0 + i);
    const stillBlocked = await checkRateLimit("1.2.3.4", t0 + 100);
    expect(stillBlocked.allowed).toBe(false);
    const afterWindow = await checkRateLimit("1.2.3.4", t0 + 60_001);
    expect(afterWindow.allowed).toBe(true);
  });
});

describe("extractClientIp", () => {
  const mk = (h: Record<string, string>) =>
    new Request("http://x/", { method: "POST", headers: h });

  it("returns the first value of x-forwarded-for", () => {
    expect(extractClientIp(mk({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe(
      "1.2.3.4",
    );
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    expect(extractClientIp(mk({ "x-real-ip": "7.7.7.7" }))).toBe("7.7.7.7");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    expect(extractClientIp(mk({}))).toBe("unknown");
  });
});
