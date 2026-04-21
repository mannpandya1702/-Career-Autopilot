# CLAUDE.md — Career Autopilot

This file is your contract for working in this repository. Read it fully at the start of every session and obey it. If any instruction in a user message contradicts this file, stop and ask before proceeding.

---

## 1. What you are building

Career Autopilot is a personal job-application automation system. For one user (the repo owner), it:

1. Discovers jobs across ATS-direct APIs (Greenhouse, Lever, Ashby, Workable, SmartRecruiters) and aggregators.
2. Scores each job for fit against the user's structured profile using embeddings + an LLM judge.
3. Tailors the user's resume per job — selecting and rewriting content, never fabricating — and renders it to PDF and DOCX.
4. Verifies the tailored resume with a deterministic 3-parser ensemble and a keyword-coverage scorer; regenerates until score ≥ threshold.
5. Generates a cover letter and answers application-form questions using RAG over the profile.
6. Submits via ATS-specific APIs where possible, falls back to Playwright for portals, and falls back again to a human-review queue.
7. Tracks every application and feeds outcomes back into the fit scorer.
8. A Chrome extension handles LinkedIn (user's session, not bot-scraped).

Everything runs on free infrastructure: Vercel Hobby, Supabase Free, Oracle Cloud Always Free ARM, Gemini free tier, GitHub Actions. One paid line: the privacy-opt-out LLM (Claude Haiku or Gemini paid Tier 1, user's choice — default Haiku).

**Success metric:** the user's interview-callback rate. Everything else is instrumental.

---

## 2. Hard rules — non-negotiable

These rules exist because the user has explicitly said "no guesswork, no hallucination." Treat every one as a hard stop.

### 2.1 Verify before you code

- **Never invent an API signature, library function, or type.** If you are about to write code against a library, a DB schema, or an external API, first confirm the exact signature: read the installed package's `.d.ts`, run `grep` in `node_modules`, hit the doc URL with `web_fetch`, or read the generated Supabase types.
- **Never invent a column name, table name, or enum value.** Read `docs/database-schema.md` or run `supabase db pull` and check the generated types file. If the column isn't there, either add a migration or fail loud — don't guess.
- **Never hallucinate a Greenhouse/Lever/Ashby/Workable endpoint.** The verified patterns are in `docs/integrations.md`. For any new ATS, you must first fetch and inspect a real job posting page + one sample API response before writing adapter code.
- **If you are unsure about anything factual, stop and ask.** The user prefers one clarifying question over one confidently wrong line of code.

### 2.2 No silent failures

- Every external call (DB, LLM, HTTP) must have an explicit timeout, explicit retry policy, and explicit error handling. Never `catch(e) {}`. Log with structured context (what operation, which job id, which user).
- Every LLM response that is expected to be structured (JSON) must be validated with a Zod schema before use. If validation fails, retry once with a stricter system prompt; on second failure, surface the error and mark the job as `failed_tailor` in the DB.
- If a Playwright adapter cannot find a selector within its timeout, fail the job to the manual-review queue. Do not click "something that looks close."

### 2.3 Pin everything

- Node version in `.nvmrc` and `package.json#engines`.
- pnpm version in `package.json#packageManager`.
- Every dependency pinned with exact version (no `^`, no `~`) in the top-level `package.json`. Workspace packages use `workspace:*`.
- Every Docker image pinned to a SHA256 digest, not `:latest`.
- Supabase CLI version pinned in `package.json`.

### 2.4 Tests are part of done

A task is not complete until:

- Unit tests pass for new business logic (Vitest).
- Integration tests pass for any new ATS adapter or LLM router change.
- TypeScript compiles with zero errors under `--strict`.
- ESLint + Prettier pass.
- The relevant acceptance criteria in `docs/build-phases.md` for the current phase are checked off.

### 2.5 Privacy is a feature

- The user's master profile contains salary expectations, personal address, phone, visa status, and identifying details.
- The free-tier Gemini policy permits Google to use free-tier prompts for product improvement. Therefore: **any prompt that includes raw master-profile fields (identifiers, salary, phone, address) must route to the privacy-opted-out provider** (Claude Haiku by default, or Gemini paid Tier 1 if the user switches `LLM_PRIVACY_MODE=gemini_paid`).
- Free Gemini tier is only used for non-sensitive operations: JD parsing, keyword extraction from public job text, embedding of public JD content.
- Never log raw resume content, cover letter drafts, or master-profile fields to any external logging service (Sentry, Axiom, PostHog). Redact or substitute stable hashes.

### 2.6 No secrets in code

- All secrets via environment variables loaded through `@t3-oss/env-nextjs` (web) or a validated `env.ts` (workers). Validation fails the app at startup if anything is missing or malformed.
- `.env.local` is gitignored. `.env.example` is committed and must list every variable with a comment explaining what it is and where to get it.

### 2.7 Honesty constraint in the resume tailor

This is the most important product rule and it applies specifically to LLM prompts:

> **Every resume-tailoring and cover-letter prompt must include the instruction: "Only re-emphasize and rephrase experience, skills, and metrics that exist in the provided master profile. Never invent tools, years of experience, employers, metrics, or achievements. If the job requires something the candidate does not have, do not claim it — the output will fail downstream verification anyway."**

Then: after generation, run the `honestyCheck()` function (in `shared/tailor/honesty.ts`) which verifies that every skill and metric in the output appears in the master profile's source set. If verification fails, regenerate once; if it fails again, fail the job.

---

## 3. Tech stack — pinned

Never change a version below without explicit user approval.

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20.18.0 (LTS) |
| Package manager | pnpm | 9.12.3 |
| Language | TypeScript | 5.6.3 |
| Frontend framework | Next.js (App Router) | 15.1.0 |
| UI library | React | 19.0.0 |
| Styling | Tailwind CSS | 3.4.15 |
| Component primitives | shadcn/ui (Radix) | as-of-install |
| Forms | react-hook-form | 7.53.2 |
| Validation | Zod | 3.23.8 |
| Data fetching | TanStack Query | 5.62.2 |
| Client state | Zustand | 5.0.2 |
| Charts | Recharts | 2.14.1 |
| Drag-and-drop | @dnd-kit/core | 6.2.0 |
| Diff viewer | react-diff-viewer-continued | 4.0.0 |
| Rich text | @tiptap/react | 2.10.3 |
| DB + Auth + Storage | Supabase | CLI 1.219.2 |
| Vector | pgvector (via Supabase) | 0.7.x |
| Queue | pgmq (via Supabase) | 1.5.x |
| Scheduler | pg_cron (via Supabase) | 1.6.x |
| Worker runtime | Node.js | same as above |
| Browser automation | Playwright | 1.49.0 |
| PDF rendering | Tectonic (LaTeX) | 0.15.0 |
| DOCX generation | docx (npm) | 9.1.0 |
| Resume parser #1 | pyresparser (Python 3.11) | 1.0.6 |
| Resume parser #2 | @opendocsg/pdf2md + custom parser port | latest-pinned |
| LLM SDK (privacy) | @anthropic-ai/sdk | 0.32.1 |
| LLM SDK (free) | @google/generative-ai | 0.21.0 |
| Embeddings | Gemini text-embedding-004 via @google/generative-ai | same |
| Chrome extension | Plasmo | 0.89.4 |
| Testing | Vitest | 2.1.8 |
| E2E testing | Playwright Test | same |
| Linter | ESLint | 9.16.0 |
| Formatter | Prettier | 3.4.2 |

**Before installing, verify each version still exists on npm by running `pnpm view <pkg> versions --json` and checking the latest compatible version.** If a version above has been deprecated or yanked, stop and ask the user before substituting.

---

## 4. Repository structure

This is a pnpm workspace monorepo. Do not deviate.

```
career-autopilot/
├── CLAUDE.md                        # This file
├── README.md                        # Human-facing setup
├── .env.example                     # Every env var documented
├── .nvmrc                           # 20.18.0
├── package.json                     # Root; defines workspaces
├── pnpm-workspace.yaml
├── tsconfig.base.json               # Strict settings, inherited
├── .eslintrc.cjs
├── .prettierrc
├── docker-compose.yml               # For Oracle VM worker stack
├── .github/workflows/               # CI + scheduled crawls
│   ├── ci.yml
│   ├── keepalive.yml                # Pings Supabase daily
│   └── crawl-jobs.yml               # 4x daily ATS crawl
├── apps/
│   ├── web/                         # Next.js 15 frontend
│   └── extension/                   # Plasmo Chrome extension
├── workers/
│   ├── crawler/                     # ATS API + Playwright crawlers
│   ├── scorer/                      # Fit scoring worker
│   ├── tailor/                      # Resume tailoring + render
│   ├── verifier/                    # ATS parser ensemble
│   ├── submitter/                   # Application submission
│   └── follow-up/                   # Follow-up emails
├── packages/
│   ├── shared/                      # Types, schemas, constants
│   ├── db/                          # Supabase client + generated types
│   ├── llm/                         # LLM router, prompts, caching
│   ├── ats/                         # ATS detection + adapters
│   ├── resume/                      # Tailor logic, renderer, schemas
│   └── parsers/                     # Resume parser wrappers
├── supabase/
│   ├── migrations/                  # SQL migrations (timestamped)
│   ├── functions/                   # Edge Functions (Deno)
│   └── seed.sql                     # Dev seed data
├── docs/
│   ├── architecture.md              # Full architecture reference
│   ├── build-phases.md              # Detailed phase-by-phase plan
│   ├── database-schema.md           # Full DB schema w/ rationale
│   ├── integrations.md              # ATS-specific endpoint patterns
│   ├── llm-routing.md               # Model selection + prompts
│   └── runbooks/                    # Ops runbooks
└── scripts/
    ├── bootstrap.sh                 # One-shot dev setup
    ├── gen-types.sh                 # Regenerate Supabase types
    └── check-quotas.ts              # Verify Gemini/Anthropic quotas
```

Whenever you need detail deeper than what's in `CLAUDE.md`, go to `docs/`. Do not invent structure outside this tree.

---

## 5. Environment prerequisites — the user provisions these before you code

You cannot code against infrastructure that doesn't exist. Before Phase 1, confirm all of these are provisioned. If any are missing, pause and list what's missing; do not proceed.

1. **Oracle Cloud Always Free account** with an ARM Ampere A1 Flex instance (4 OCPU / 24 GB / 200 GB block storage). Home region must match user's proximity. Confirm by asking user for SSH access and IP.
2. **Supabase project** (free tier). Note the region; ideally same continent as Oracle VM. User provides the project URL, anon key, service role key, DB password.
3. **Google AI Studio API key** for Gemini free tier. User provides `GEMINI_API_KEY`.
4. **Anthropic API key** for Claude Haiku privacy-safe path. User provides `ANTHROPIC_API_KEY`.
5. **GitHub repo** (private) with Actions enabled.
6. **Vercel account** linked to GitHub.
7. **Gmail app password** for SMTP notifications (user configures an app password in Google account settings).
8. **Domain (optional)** — default is `yourapp.vercel.app`.

Record what's provisioned in `docs/runbooks/environment.md` at the start of Phase 1.

---

## 6. Environment variables — the full set

Every variable goes in `.env.example` with a comment. The web app validates via `@t3-oss/env-nextjs`; workers validate via a `packages/shared/src/env.ts` that parses `process.env` through Zod. If any required var is missing, startup fails with a clear error.

```
# ---- Supabase ----
NEXT_PUBLIC_SUPABASE_URL=                   # https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=              # public anon key
SUPABASE_SERVICE_ROLE_KEY=                  # server-only; never expose to client
SUPABASE_DB_URL=                            # postgresql://... for migrations

# ---- LLM providers ----
GEMINI_API_KEY=                             # Google AI Studio
ANTHROPIC_API_KEY=                          # Anthropic console
LLM_PRIVACY_MODE=claude_haiku               # one of: claude_haiku | gemini_paid

# ---- Email ----
GMAIL_USER=                                 # your@gmail.com
GMAIL_APP_PASSWORD=                         # 16-char app password

# ---- Observability ----
SENTRY_DSN=                                 # optional; leave blank to disable
POSTHOG_KEY=                                # optional
AXIOM_TOKEN=                                # optional

# ---- Worker-only ----
WORKER_ID=worker-1                          # unique identifier per worker instance
PLAYWRIGHT_HEADLESS=true
TECTONIC_CACHE_DIR=/var/cache/tectonic

# ---- Feature flags ----
ENABLE_AUTO_SUBMIT=false                    # SAFETY: false until user explicitly enables
ENABLE_LINKEDIN_EXTENSION=true
DAILY_APPLICATION_CAP=30                    # hard cap, even if queue is larger
```

**Safety default:** `ENABLE_AUTO_SUBMIT=false` for the entire build period. The user must flip this explicitly after they have personally reviewed the pipeline on a batch of 10+ dry-run applications.

---

## 7. The build plan

Execute phases in order. Each phase has acceptance criteria in `docs/build-phases.md`. **You may not start phase N+1 until every acceptance criterion for phase N passes and the user has confirmed.** This is the single most important workflow rule.

Phases:

1. **Foundation** — monorepo scaffold, Supabase project, DB migrations, generated types, CI, deploy.
2. **Master profile + onboarding** — schema, UI, parser import, validation.
3. **Job discovery** — Greenhouse + Lever + Ashby crawlers, dedup, storage.
4. **Fit scoring** — embeddings, LLM judge, filters, ranking UI.
5. **Resume tailor + render** — structured tailor, honesty check, LaTeX + DOCX render.
6. **ATS verifier** — 3-parser ensemble, scoring formula, regeneration loop.
7. **Cover letter + Q&A** — RAG, cache, answer consistency check.
8. **Submitter** — ATS-direct APIs first, Playwright adapters, manual-review fallback.
9. **Tracker + analytics** — outcomes, funnel, A/B, response predictor.
10. **Chrome extension** — LinkedIn fit-score overlay + Easy Apply assist.
11. **Hardening** — rate limiting, error budgets, monitoring, runbooks.

See `docs/build-phases.md` for tasks, acceptance tests, and LLM prompts per phase.

---

## 8. Component-level rules

### 8.1 Database

- **Every schema change is a migration file.** Never write `ALTER TABLE` in ad-hoc code or psql. Create a new timestamped migration under `supabase/migrations/` (naming: `YYYYMMDDHHMMSS_description.sql`).
- **Apply via `pnpm db:migrate`.** The script runs `supabase db push`. Never use `supabase db reset` on a project that has real data without explicit user approval.
- **After any migration, regenerate types immediately** with `pnpm db:types`. The generated file is `packages/db/src/types/database.ts`. Commit generated types alongside the migration.
- **Row-level security (RLS) on every table** with user data. Even though this is single-user, enable RLS with `user_id = auth.uid()` policies from day one so productizing later is safe.

### 8.2 TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` in `tsconfig.base.json`. All packages extend this.
- **No `any`.** Use `unknown` and narrow. If you truly need to escape the type system, use `// @ts-expect-error` with a comment explaining why, never `// @ts-ignore`.
- **Domain types live in `packages/shared/src/types/`** and are imported everywhere. Never redefine a domain type in a feature folder.
- **Zod schemas are the source of truth for runtime boundaries** (API, LLM, user input). Infer TypeScript types from Zod: `type Job = z.infer<typeof JobSchema>`.

### 8.3 LLM calls

All LLM calls go through `packages/llm/src/router.ts`. Never import the Gemini or Anthropic SDK directly from feature code.

The router's responsibilities:
- Route to the correct provider based on task type and privacy classification.
- Apply the correct model per task (see `docs/llm-routing.md`).
- Enforce timeout (30s default, 120s for long generation).
- Retry on transient errors (429, 500, 503) with exponential backoff, capped at 3 retries.
- Validate output with the task's Zod schema; retry once on validation failure.
- Track tokens-in/tokens-out per call and write to the `llm_calls` table for cost tracking.
- Respect rate limits — the router maintains an in-memory token bucket per provider based on the published free-tier limits and `LLM_PRIVACY_MODE`.

Tasks and their default models (see `docs/llm-routing.md` for rationale and full prompt templates):

| Task | Default provider | Model | Privacy |
|---|---|---|---|
| JD parsing (public text) | Gemini free | gemini-2.5-flash-lite | OK to use free |
| Fit scoring (judge) | Gemini free | gemini-2.5-flash | OK to use free |
| Resume tailoring | Privacy | Haiku 4.5 or Gemini 2.5 Pro paid | Sensitive — never free |
| Cover letter | Privacy | Haiku 4.5 | Sensitive — never free |
| Q&A answer generation | Privacy | Haiku 4.5 | Sensitive — never free |
| Embedding (JD side) | Gemini free | text-embedding-004 | OK |
| Embedding (profile side) | Gemini free | text-embedding-004 | Profile embeddings are derived not raw — see §8.4 |

### 8.4 Prompts

- **Every prompt is a file**, never a string inline. Location: `packages/llm/src/prompts/<task>/<version>.ts`. Version is `v1`, `v2`, etc. Never mutate a shipped prompt; create a new version.
- Each prompt file exports: `system: string`, `user: (input) => string`, `outputSchema: ZodSchema`, and `cacheBreakpoints: string[]` (strings that mark stable prefix boundaries for Gemini implicit caching).
- The stable prefix (master profile, resume template, instruction block) goes FIRST. Variable content (JD text, question text) goes LAST.
- Profile-side embeddings use a **derived** summary ("Experienced Python engineer with 3 years building healthcare integrations...") rather than the raw profile; this keeps the free-tier embedding pathway privacy-safe.

### 8.5 Playwright adapters

- One adapter per ATS, in `workers/submitter/src/adapters/<ats>/index.ts`.
- Each adapter exports a function with a fixed signature:
  ```ts
  export async function submit(
    context: BrowserContext,
    job: Job,
    tailoredResume: RenderedResume,
    coverLetter: string,
    answers: QuestionAnswer[],
    options: AdapterOptions,
  ): Promise<SubmitResult>
  ```
- **Never use `page.waitForTimeout(ms)` as a synchronization primitive.** Wait for specific selectors or network responses.
- Every selector is defined as a constant at the top of the adapter file with a comment noting when it was last verified. If an adapter fails on a run, surface the selector that failed so the user can update it.
- Every adapter has a Playwright Test fixture in `workers/submitter/tests/adapters/<ats>.spec.ts` that runs against a saved HAR file (recorded once, replayed in CI).

### 8.6 Worker jobs

- Every long-running operation is a queued job via `pgmq`. Never do LLM calls or Playwright work inside an Edge Function or a Next.js request handler.
- Jobs have idempotency keys (derived from stable inputs) so re-runs are safe.
- Worker polling loop: `pgmq.read(queue, visibility_timeout)`, process, `pgmq.archive(queue, msg_id)` on success or `pgmq.delete` on permanent failure. On transient failure, let the message become visible again (do nothing) and it will retry.
- Dead-letter queue: after 3 retries, move to `<queue>_dlq` and emit a structured log.

### 8.7 Frontend

- **Server Components by default.** Client Components only when interactivity is required; mark with `"use client"`.
- **Data fetching in Server Components** uses the Supabase server client. Mutations from Client Components use Server Actions, never `fetch('/api/...')` unless there's a specific reason.
- **Forms use react-hook-form + Zod** with the same schema used on the server. Never hand-write form validation.
- **Never render user text without sanitization.** For rich text, use the TipTap-provided sanitizer. For plain text, React's default escaping is fine.
- **Optimistic UI only where safe.** If the mutation can fail (submission, DB write, LLM call), show a pending state until confirmation.

### 8.8 Chrome extension

- Plasmo framework, Manifest V3.
- **Never fetch from the extension to a domain other than the user's own backend** (Supabase URL or Vercel domain). The extension reads LinkedIn DOM in the user's tab and POSTs to the backend; it does not make cross-origin calls to third parties.
- The extension uses the user's Supabase session token; it never handles the service-role key.

---

## 9. Testing

- **Unit tests** for every pure function in `packages/`. Vitest, colocated in `*.test.ts`.
- **Integration tests** for every ATS adapter (against HAR fixtures) and every worker job type (with a test Supabase schema).
- **E2E tests** for the critical paths: onboarding, review-and-submit, and analytics. Playwright Test, runs against a local Next.js dev server + test Supabase.
- **Honesty test** for the resume tailor: given a fixed master profile and JD, the tailored output's skills and metrics must be a subset of the master profile's tokens. This is a deterministic check and must pass on every CI run.
- **Verifier test**: given a curated set of 10 resumes + JDs with known expected scores, the ATS verifier's score must correlate r > 0.8 with expected.

Coverage thresholds: 80% for `packages/shared`, `packages/llm`, `packages/resume`, `packages/ats`. Lower for UI.

---

## 10. Observability

- **Structured logs** via `pino`. JSON only. Every log line includes `workerId`, `jobId` (if applicable), `userId`, `stage`.
- **Sentry** captures exceptions with scrubbed payloads. A PII scrubber in `packages/shared/src/observability/scrub.ts` removes any field matching `email | phone | address | salary | ssn | dob | fullName` before sending.
- **PostHog** captures UI events (button clicks, phase transitions). Never send payloads containing user profile content.
- **Token usage** tracked in the `llm_calls` table and aggregated nightly into `daily_cost_summary` — the Analytics dashboard reads this to show current month's API spend.

---

## 11. Commands reference

All commands run from repo root via pnpm scripts. Never invent a command not listed here. If you need a new one, add it to the root `package.json` and document it here.

```
# Setup
pnpm install                        # Install all workspace deps
pnpm bootstrap                      # Runs scripts/bootstrap.sh — full local setup

# Development
pnpm dev                            # Runs web app in dev mode
pnpm dev:worker                     # Runs all workers locally
pnpm dev:extension                  # Runs extension in Plasmo dev mode

# Database
pnpm db:migrate                     # Apply pending migrations
pnpm db:types                       # Regenerate packages/db/src/types/database.ts
pnpm db:reset:local                 # DANGER: reset local DB only
pnpm db:seed                        # Apply supabase/seed.sql to local

# Testing
pnpm test                           # All unit tests
pnpm test:watch                     # Watch mode
pnpm test:integration               # Integration tests (requires local DB)
pnpm test:e2e                       # E2E Playwright
pnpm test:honesty                   # Honesty test for tailor
pnpm test:verifier                  # Verifier calibration

# Lint + types
pnpm lint
pnpm lint:fix
pnpm typecheck                      # tsc --noEmit across all packages

# Build + deploy
pnpm build                          # Build all apps + packages
pnpm deploy:web                     # Deploys web to Vercel (also triggered by GH Actions on main)
pnpm deploy:workers                 # Builds worker Docker images and pushes via SSH to Oracle VM

# Ops
pnpm quotas:check                   # Report current Gemini/Anthropic quota usage
pnpm queue:inspect                  # Print pgmq queue depths
pnpm keepalive                      # Manual Supabase keepalive ping
```

---

## 12. When to stop and ask

Stop and ask the user before:

1. Starting phase N+1 before phase N's acceptance criteria pass.
2. Enabling `ENABLE_AUTO_SUBMIT=true`. This is a safety gate.
3. Adding a new ATS adapter that wasn't in `docs/integrations.md`.
4. Adding a new external service (SaaS, API). Every addition is a sovereignty decision.
5. Modifying the honesty constraint in the tailor prompt.
6. Exceeding the daily application cap configured in env.
7. Implementing anything that would submit applications to LinkedIn via a headless browser. LinkedIn is handled by the extension only; this is a legal boundary.
8. Using any version not listed in §3.
9. You encounter an error you don't understand after one attempt at diagnosis.

---

## 13. When the user says "go"

On first invocation in a fresh repo, your execution order is:

1. Verify the environment prerequisites in §5 are satisfied. If not, list gaps.
2. Create the directory structure in §4.
3. Write `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.eslintrc.cjs`, `.prettierrc`, `.env.example`, `.nvmrc`, `.gitignore`, and `README.md`.
4. Run `pnpm install`.
5. Read `docs/build-phases.md` fully.
6. Begin Phase 1 — Foundation. Do not touch Phases 2+ yet.
7. On completion of each acceptance criterion in Phase 1, commit with a conventional-commits message (`feat(db): add initial schema`, etc.).
8. When Phase 1 is fully green, report to the user with: a summary of what's built, a list of all tests that pass, a link to any deployed preview, and a request for approval to proceed to Phase 2.

Never batch-complete multiple phases without user approval between them.

---

## 14. Commit + PR discipline

- Conventional Commits: `feat|fix|chore|docs|test|refactor|perf(scope): subject`.
- One logical change per commit. If you're mid-task and need to checkpoint, commit with `wip:` prefix and amend before requesting review.
- Never commit `.env.local`, build artifacts, `node_modules`, or Playwright HAR files containing real secrets.
- Every PR (even solo work) gets a description with: what changed, why, how tested, and any follow-ups.

---

## 15. Deep-dive references

When you need more than this file provides, go here:

- `docs/architecture.md` — Full system architecture, data flow, sequence diagrams.
- `docs/build-phases.md` — **Your primary execution guide.** Every phase has tasks, acceptance tests, and hints.
- `docs/database-schema.md` — Complete Postgres schema with rationale and RLS policies.
- `docs/integrations.md` — ATS-specific endpoint patterns, auth flows, known quirks.
- `docs/llm-routing.md` — Provider selection, full prompt templates by task version, caching strategy.
- `docs/runbooks/` — Operational runbooks: deploying, rotating keys, recovering from a failed migration, responding to an ATS site change.

If something is missing from the docs, create the doc file first, propose its structure to the user, then fill it in. Never write production code against undocumented behavior.

---

## 16. What "done" looks like

For the whole project: the user can onboard in under 15 minutes, discover > 50 jobs/day, tailor and verify at least 20/day with ATS score ≥ 80, submit approved applications with < 1% technical failure rate, and see response outcomes in the tracker — all within the free infrastructure budget and the one paid line (privacy LLM).

For any given session: you executed only what the current phase required, every test passed, and the user has a clear next instruction.

Work carefully, verify everything, and ask when you're unsure. The user's career is the thing you're building — precision matters more than speed.