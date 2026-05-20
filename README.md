# Cold Lead Decoder

> Turn company domains into outreach-ready lead cards in under 15 seconds.

Paste a company domain, get back a structured lead card with a personalized opener, positioning signals, likely pain points, and follow-up angles — all grounded in the company's own public website copy.

## Key Features

- **Hardened SSRF protection** — DNS-resolves every host (and every redirect target) and rejects responses pointing at private, loopback, link-local, or CGNAT IP ranges before any data is read.
- **DeepSeek-powered extraction** — Uses `deepseek-v4-flash` in strict JSON mode with thinking disabled and exponential backoff on 429/500/503, plus a single Zod-driven repair retry on validation failure.
- **Zod-validated cards** — The lead card schema is the single source of truth, shared between the API and the UI. The model never has the last word on shape.
- **Graceful degradation for JS-heavy sites** — Thin homepages trigger a conditional `/about` fetch; if content is still sparse the card is marked `degraded: true` and rendered with a "Based on limited public info" badge rather than aborted.

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **LLM**: DeepSeek (`deepseek-v4-flash`) via the OpenAI SDK
- **Validation**: Zod
- **Scraping**: `fetch` + `@mozilla/readability` + `jsdom`, with `cheerio` as fallback
- **Styling**: Tailwind CSS — no component library (see ADR-009)
- **Tests**: Vitest + React Testing Library

## Setup

Requirements: Node.js 20+ and a DeepSeek API key.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root with your DeepSeek key:

   ```
   DEEPSEEK_API_KEY=sk-...
   ```

   Get a key from <https://platform.deepseek.com/api_keys>. `.env.local` is gitignored.

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000> and paste a domain like `stripe.com`.

To run the test suite:

```bash
npm test
```

## Architecture

A single Node Route Handler — `POST /api/decode` — runs a linear four-stage pipeline. There is no database, no auth, and no queue in v1.

1. **Scrape** — `safeFetch` enforces the SSRF policy, follows up to 3 redirects, caps the body at ~1.5 MB, and re-applies the policy on every hop.
2. **Extract** — `@mozilla/readability` pulls the main content; `cheerio` is the fallback. Thin homepages trigger a single `/about` retry; if both are sparse the result is marked `degraded`.
3. **Generate** — A system prompt that pins the exact JSON shape calls DeepSeek in `json_object` mode. The response is parsed and validated against the Zod schema; on failure the model gets one repair attempt with the list of validation issues, then hard-fails to `decode_failed`.
4. **Guard** — A banned-phrase check on the `personalized_opener` stamps `confidence_notes` if the model regresses to generic fluff like *"I hope this finds you well"*.

All nine architectural decisions (framework, runtime, scraping strategy, LLM contract, schema authority, SSRF policy, persistence, failure UX, UI dependencies) are recorded in [`CLAUDE.md`](./CLAUDE.md) as ADR-001 through ADR-009.

## License

MIT — see [LICENSE](./LICENSE).
