// One-off acceptance runner. Not part of the test suite.
// Hits POST http://localhost:3000/api/decode for each domain, records
// wall-clock latency, status, and the response body. Prints a summary table
// and writes a JSON dump to scripts/dirty-dozen.results.json.

import { writeFile } from "node:fs/promises";

const ENDPOINT = "http://localhost:3000/api/decode";

const DOMAINS = [
  // 6 high-quality marketing
  { tag: "marketing", domain: "stripe.com" },
  { tag: "marketing", domain: "linear.app" },
  { tag: "marketing", domain: "vercel.com" },
  { tag: "marketing", domain: "anthropic.com" },
  { tag: "marketing", domain: "notion.so" },
  { tag: "marketing", domain: "figma.com" },
  // 3 JS-heavy / SPA
  { tag: "spa", domain: "discord.com" },
  { tag: "spa", domain: "airbnb.com" },
  { tag: "spa", domain: "slack.com" },
  // 2 small/thin niche
  { tag: "thin", domain: "plausible.io" },
  { tag: "thin", domain: "usefathom.com" },
  // 1 NXDOMAIN
  { tag: "nxdomain", domain: "this-domain-definitely-does-not-exist-91827364.com" },
];

async function run(one) {
  const start = Date.now();
  let status = 0;
  let body = null;
  let err = null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: one.domain }),
    });
    status = res.status;
    body = await res.json().catch(() => null);
  } catch (e) {
    err = e?.message ?? String(e);
  }
  const ms = Date.now() - start;
  return { ...one, status, ms, body, err };
}

const results = [];
for (const d of DOMAINS) {
  process.stdout.write(`→ ${d.tag.padEnd(9)} ${d.domain} ... `);
  const r = await run(d);
  results.push(r);
  const opener = r.body?.personalized_opener?.slice(0, 80) ?? r.body?.message ?? r.err ?? "?";
  console.log(`${r.status} ${r.ms}ms  ${opener}`);
}

await writeFile(
  new URL("./dirty-dozen.results.json", import.meta.url),
  JSON.stringify(results, null, 2),
);

const oks = results.filter((r) => r.status === 200);
const avg = oks.length ? Math.round(oks.reduce((a, r) => a + r.ms, 0) / oks.length) : 0;
console.log("\n— summary —");
console.log(`ok:        ${oks.length}/${results.length}`);
console.log(`avg_ms_ok: ${avg}`);
console.log(`max_ms_ok: ${oks.length ? Math.max(...oks.map((r) => r.ms)) : 0}`);
console.log(`under_12s: ${oks.filter((r) => r.ms < 12000).length}/${oks.length}`);
