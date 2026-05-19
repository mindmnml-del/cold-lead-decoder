# Cold Lead Decoder — Project Constitution

> Single input (a company domain) → one Node route handler → static scrape + DeepSeek call → Zod-validated card. No DB, no auth, no queue, no headless browser in v1.

## Tech Stack (locked)

- **Framework:** Next.js 14 (App Router, TypeScript)
- **API:** one Route Handler `POST /api/decode`, Node runtime (not Edge, not Server Action)
- **LLM:** DeepSeek via OpenAI SDK — model `deepseek-v4-flash`, **thinking disabled**, `response_format: { type: "json_object" }`, capped `max_tokens`, exponential backoff on 429/500/503
- **Validation:** Zod (single source of truth for API + UI)
- **Testing:** Vitest
- **Scraping:** native `fetch` + `@mozilla/readability` + `jsdom`; `cheerio` fallback
- **UI:** Tailwind (no component library)
- **Deploy:** Vercel; optional Vercel KV 24h domain cache (feature-flagged)

## Architecture Decision Records

### ADR-001 — Framework: Next.js 14 App Router + TypeScript
One Next.js app, App Router, TypeScript. One page, one route handler. Source: architecture.md §3, §8.

### ADR-002 — API surface: single Node Route Handler `POST /api/decode`
Not Edge (Readability/jsdom need Node). Not Server Action (no curlable contract, hard to test/reuse). Route handler graduates into the future SaaS endpoint. Source: §2 Option B, §3, §8.

### ADR-003 — Scraping: static `fetch` + Readability/cheerio, homepage + conditional `/about`
No headless browser in v1. Detect thin content → fetch `/about` once → if still thin, set `degraded=true` and continue (never abort). Hard caps: 8s timeout, ≤3 redirects, ~1.5 MB body cap, real User-Agent. Source: §4, §6, §13.

### ADR-004 — LLM: DeepSeek `deepseek-v4-flash`, thinking disabled, JSON mode + mandatory repair retry
DeepSeek's `json_object` mode guarantees parseable JSON, **not schema-valid** JSON (no Anthropic-style tool enforcement). System prompt must explicitly direct the model to return a single JSON object. Backoff on 429/500/503. One repair call on Zod failure. Hard fail after second failure. Source: §3, §4 steps 7–8, §8, §10, §14.

### ADR-005 — Schema: Zod as single source of truth, shared by API + UI
`lib/schema/leadCard.ts` is the contract. Rules enforced in Zod, not just the prompt: `follow_up_angles` length exactly 2; `positioning_signals` 2–4; `likely_pain_points` 2–3; every string non-empty and length-capped; `source_pages` ⊆ pages actually fetched. **Project deviation from arch §5:** `evidence.opener_basis` is **required** in the schema (arch doc had it optional-in-Zod / required-in-prompt; constitution locks it as schema-required to prevent silent prompt drift). Source: §3, §5, §10.

### ADR-006 — SSRF guard: DNS-resolve and check resolved IP, re-check after every redirect
String/regex checks on the hostname alone miss DNS-rebinding to internal IPs. Use `dns.promises.lookup` and reject if resolved IP falls in `10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, `100.64/10` (CGNAT, RFC 6598), `::1`, `fc00::/7`. Re-apply after each redirect. No shell, pure `fetch`. Source: §4 step 2, §6, §15 SEC-01.

### ADR-007 — Persistence: none in v1
No database, no auth, no queue. Optional Vercel KV cache (24h domain → card) is feature-flagged. Billing-phase concerns (Prisma singleton, Stripe idempotency, RLS, `org_id` FK) are explicitly deferred. Source: §3, §8, §12, §15.

### ADR-008 — Failure UX: every failure has a defined card state, never a raw 500
Invalid domain → inline field error. Fetch fail/timeout → "Couldn't reach this site". Thin content → card renders with "Based on limited public info" badge. Generic opener (banned-phrase guard) → mark `low_confidence` in `confidence_notes`, do not retry (keeps demo fast). LLM/validation hard fail → "Decode failed, try another domain" + retry button. Source: §4 step 11, §7.

### ADR-009 — UI components: strictly pure Tailwind CSS, no external libraries
No `shadcn/ui`, Radix, MUI, Headless UI, Chakra, DaisyUI, or any pre-built component kit in v1. All UI primitives (buttons, badges, inputs, skeletons, toasts) are hand-rolled with Tailwind utility classes. Rationale: zero dependency surface, zero bundle bloat, full control over keyboard/ARIA, and no risk of design drift from a third-party theme. `clsx` / `tailwind-merge` may be added later if class composition becomes unwieldy, but are **not** part of v1.

## Working Agreement

- **Always use `/browse`** for web research and external documentation lookups.
- **Always use `/review`** as the quality gate before committing or shipping.
- **TDD Iron Law:** RED → GREEN → REFACTOR → ANALYZE. No production code before a failing test.
- **GitNexus commands:** always invoke the direct binary `gitnexus` (not via `npx`) and always pass `--skip-agents-md`, e.g., `gitnexus analyze --skip-agents-md`. The `npx` shim crashes under Node 20.
- **Skill invocation:** use slash commands (`/brainstorming`, `/review`), not `superpowers:*` or other namespaced forms.
- **LLM call shape:** `deepseek-v4-flash`, thinking disabled, `json_object` mode, explicit "return one JSON object only" directive, capped `max_tokens`.
- **Out of scope for v1** (cut list): headless browser, multi-page crawl, provider router, DB, auth, queue, two-stage prompts, component library, streaming, settings/themes.
