# Build Phases — Career Autopilot

This is your phase-by-phase execution guide. Work phases in order. Every phase has a goal, prerequisites, task list, and acceptance criteria. A phase is not done until every acceptance criterion is checked AND the user has approved progression.

Reference `CLAUDE.md` §2 for the hard rules that apply at every phase.

---

## How to use this document

- Each task has an ID like `P3.4` — phase 3, task 4. Use these in commit messages and PR descriptions.
- Tasks have explicit deliverables. If the deliverable is a file, the path is given.
- Acceptance criteria are binary (pass/fail). Run the test commands listed to verify.
- "Hints" are non-binding guidance. Use them as a starting point; deviate if you find a better solution, but document why.

---

## Phase 1 — Foundation

**Goal:** A deployable monorepo scaffold with CI, a clean Supabase schema, generated types, and a stubbed web app that loads and authenticates.

**Prerequisites:** All items in `CLAUDE.md` §5 provisioned.

### Tasks

**P1.1** — Initialize repo structure per `CLAUDE.md` §4. Write root config files:
- `package.json` with workspaces, engines, packageManager, and the scripts block from `CLAUDE.md` §11. Use the exact dependency versions from §3.
- `pnpm-workspace.yaml` listing `apps/*`, `workers/*`, `packages/*`.
- `tsconfig.base.json` with strict settings.
- `.eslintrc.cjs` using `eslint:recommended` + `@typescript-eslint/recommended` + a Next.js preset in the web app.
- `.prettierrc` with 2-space indent, single quotes, trailing commas.
- `.env.example` with every variable from `CLAUDE.md` §6.
- `.gitignore` covering `node_modules`, `.next`, `.env.local`, `.turbo`, `dist`, `.playwright`, `*.har`.
- `.nvmrc` = `20.18.0`.
- `README.md` with a human-facing quickstart.

**P1.2** — Create empty package directories with minimal `package.json` and `tsconfig.json` that extends the root:
- `packages/shared`, `packages/db`, `packages/llm`, `packages/ats`, `packages/resume`, `packages/parsers`.
- Each exports from `src/index.ts`.

**P1.3** — Scaffold Next.js 15 web app:
- `apps/web` with App Router.
- Tailwind CSS and shadcn/ui installed. Initialize shadcn with `npx shadcn@latest init` using defaults, base color `slate`, CSS variables on.
- A single route `/` showing "Career Autopilot" and a "Sign in" button.
- Supabase client setup: `apps/web/src/lib/supabase/client.ts` (browser), `apps/web/src/lib/supabase/server.ts` (server), both typed against the generated DB types.
- Env validation at `apps/web/src/env.ts` using `@t3-oss/env-nextjs`.

**P1.4** — Supabase: initial schema.
- Copy the SQL from `docs/database-schema.md` §1 (core tables) into a single migration: `supabase/migrations/<timestamp>_init.sql`.
- Apply: `pnpm db:migrate`.
- Generate types: `pnpm db:types`.
- Commit the generated `packages/db/src/types/database.ts`.

**P1.5** — Supabase Auth: magic-link email only. No password auth. In the Supabase dashboard (or via SQL), enable the email provider and disable sign-ups once the first account exists (single-user system).

**P1.6** — Auth flow in web app:
- `/login` page with magic-link form (email input → `supabase.auth.signInWithOtp`).
- Server-side route handler for the auth callback.
- Middleware that redirects unauthenticated users to `/login` for every route except `/login` itself.
- A `/app` route that's only reachable when signed in and shows the user's email.

**P1.7** — CI workflow `.github/workflows/ci.yml`:
- Triggers on PR and push to `main`.
- Runs `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- Caches pnpm store.

**P1.8** — Vercel deploy:
- Link the Vercel project to the GitHub repo.
- Set environment variables from `.env.example` in Vercel's project settings.
- Push to `main` and confirm the preview deploy works.

**P1.9** — Supabase keepalive workflow `.github/workflows/keepalive.yml`:
- Runs daily at a fixed UTC time.
- Executes `pnpm keepalive`, which calls a tiny health-check Edge Function that runs a `SELECT 1` and returns `{"ok": true}`.
- Prevents free-tier pause after 7 days inactivity.

**P1.10** — Observability minimum:
- Sentry SDK in the web app with PII scrubbing (`packages/shared/src/observability/scrub.ts`).
- Pino logger configured for workers (JSON output to stdout).
- A root error boundary in the web app.

### Acceptance criteria

- [ ] `pnpm install` completes with no warnings about missing peer deps that are known-problematic.
- [ ] `pnpm typecheck` passes across all workspaces.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test` passes (even with just placeholder tests).
- [ ] `pnpm build` produces a buildable web app.
- [ ] The Vercel preview URL loads; the sign-in flow sends a magic link to the user's email; signed-in users see `/app`.
- [ ] `pnpm db:migrate` applied cleanly. `pnpm db:types` produced a non-empty types file.
- [ ] The keepalive workflow runs on a manual trigger and returns 200.
- [ ] A demo Sentry error (a test button on `/app`) appears in the Sentry dashboard with no PII.

**Stop. Report. Wait for approval.**

---

## Phase 2 — Master profile + onboarding

**Goal:** The user can import an existing resume, review extracted data, fill gaps, set preferences, and record a question bank. This is the structured source-of-truth for every downstream stage.

### Tasks

**P2.1** — Schema for profile domain. Add migration adding tables: `profiles`, `experiences`, `experience_bullets`, `bullet_variants`, `projects`, `skills`, `skill_profiles`, `stories`, `preferences`, `question_bank`. Full DDL in `docs/database-schema.md` §2. RLS enabled with `user_id = auth.uid()` policies.

**P2.2** — Regenerate types (`pnpm db:types`) and commit.

**P2.3** — `packages/resume/src/schemas/profile.ts` — Zod schemas for every profile entity, matching DB columns exactly. Export inferred TS types.

**P2.4** — Parser pipeline for imports. `packages/parsers/src/index.ts` exports:
- `parseResumePdf(buffer: Buffer): Promise<ParsedResume>` — uses `pdf2md` (pure JS) for text extraction, then a deterministic section splitter, then a Gemini call (Flash-Lite, free tier — this is OK because the uploaded file is the user's own and we extract into their own DB).
- `parseLinkedInPdf(buffer: Buffer): Promise<ParsedResume>` — same shape, different selectors.

The parser returns a best-effort structured object; the UI presents it for user confirmation rather than silently committing.

**P2.5** — Onboarding UI at `/onboarding`:
- Step 1 — Import: drag-and-drop for resume PDF and optional LinkedIn export PDF.
- Step 2 — Review: each extracted section shown in an editable form. Experiences as cards with inline edit. Missing/uncertain fields highlighted.
- Step 3 — Skills: the parser's extracted skills shown as chips; user adds/removes. Each skill is tagged with a category (`language | framework | tool | domain | soft | certification`).
- Step 4 — Preferences: form for experience level (enum select), work mode (multi-select: remote/hybrid/onsite), job types (multi-select: full-time/part-time/contract/internship/freelance), salary range (min/max with currency), locations (multi-input with "anywhere remote" checkbox), industries to include/exclude, company size range, notice period, visa/work-auth.
- Step 5 — Stories: a guided form to draft 6-8 STAR stories (Situation/Task/Action/Result). Preloaded prompts: leadership, conflict, failure, ambiguity, ownership, influence, learning, metric-driven win.
- Step 6 — Q&A bank: common questions with text inputs. Preseeded list: "Tell us about yourself" (150w / 300w / 500w variants), "Why this company" (template with placeholders), "Why leaving current role", "Salary expectation", "Notice period", "Willingness to relocate", "Work authorization".

Save-as-you-go with optimistic UI. Every step is revisit-able from `/profile` after onboarding.

**P2.6** — Profile editor at `/profile`:
- Tabs: Experience, Projects, Skills, Stories, Preferences, Q&A.
- Each tab renders the same forms as onboarding but in edit mode.
- Every change writes an entry to `profile_audit` with the before/after JSON (for debugging misfires in downstream tailoring).

**P2.7** — Profile export: a `Download profile as JSON` button in settings that returns the full profile as a JSON file. Required for trust ("my data is mine").

**P2.8** — Profile embedding worker: on profile save, a worker computes a derived summary paragraph (LLM on privacy provider) and embeds it. The **derived** summary (not raw fields) is embedded — this keeps free-tier Gemini embedding pathway safe for the later job-similarity step. Stored in `profile_embeddings.summary_embedding` as a pgvector column.

### Acceptance criteria

- [ ] Onboarding completes end-to-end with a real resume PDF: every field is either populated or explicitly marked null after user review.
- [ ] The resulting profile row has a non-empty `derived_summary` and `summary_embedding`.
- [ ] Editing any field in `/profile` writes an audit row.
- [ ] Profile export returns valid JSON that matches the Zod profile schema.
- [ ] Unit tests: resume parser handles 3 fixture PDFs (one clean, one multi-column, one image-heavy) with acceptable recall on name/email/experience/skills.
- [ ] Integration test: `POST /api/profile` roundtrip with a sample payload succeeds and returns the stored row.

**Stop. Report. Wait for approval.**

---

## Phase 3 — Job discovery

**Goal:** Crawl ATS-direct APIs on a schedule, write normalized job records to Supabase, deduplicate.

### Tasks

**P3.1** — Schema: `companies`, `jobs`, `job_sources`, `job_raw` (raw payload for debugging). DDL in `docs/database-schema.md` §3.

**P3.2** — `packages/ats/src/detect.ts` — given a careers-page URL or a raw job URL, return the ATS identifier (`greenhouse | lever | ashby | workable | smartrecruiters | custom`). Detection patterns in `docs/integrations.md`. Use deterministic URL regex + HTML fingerprint; never ask the LLM for this.

**P3.3** — `packages/ats/src/adapters/greenhouse.ts` — list-jobs adapter:
- Endpoint: `https://boards-api.greenhouse.io/v1/boards/{company}/jobs?content=true`.
- Returns all active jobs with full descriptions.
- Normalize to the internal `Job` schema.

**P3.4** — `packages/ats/src/adapters/lever.ts`:
- Endpoint: `https://api.lever.co/v0/postings/{company}?mode=json`.
- Same normalization shape.

**P3.5** — `packages/ats/src/adapters/ashby.ts`:
- Endpoint: `https://api.ashbyhq.com/posting-api/job-board/{company}?includeCompensation=true`.
- Normalize.

**P3.6** — `packages/ats/src/adapters/workable.ts`:
- Endpoint: `https://apply.workable.com/api/v1/widget/accounts/{company}?details=true`.
- Normalize.

**P3.7** — Companies seed: `scripts/seed-companies.ts` reads a YAML file `config/target-companies.yml` (format: `- name, ats, slug, priority`) and upserts into `companies`. Ship with ~50 companies across the four ATSes to start. Keep this list user-editable.

**P3.8** — Crawler worker at `workers/crawler/src/index.ts`:
- Reads pgmq queue `crawl_jobs`.
- For each message (a company id), routes to the right adapter, fetches all postings, upserts into `jobs` with a stable hash-based id.
- On conflict (existing job), updates `description` if changed and `last_seen_at` always. Deleted jobs (no longer in the API) get `status = 'closed'`.

**P3.9** — Crawl scheduler via GitHub Actions: `.github/workflows/crawl-jobs.yml` runs 4 times daily. The workflow executes a script that pushes messages to `crawl_jobs` for every active company.

**P3.10** — Dedup pass: `workers/crawler/src/dedup.ts` runs after a crawl batch. Groups by `(company_id, normalized_title, location)` and marks canonical job vs. duplicates. Keeps the source with the earliest `first_seen_at`.

**P3.11** — Jobs API in web app: `GET /api/jobs` with filters (status, date range, source). `GET /api/jobs/[id]` for a single job.

**P3.12** — Minimal Jobs inbox UI at `/jobs`:
- List view of jobs with column filters.
- Columns: company, title, location, posted, source, status.
- Click row → drawer with full JD, raw payload toggle, and a "Score this" button (stub for Phase 4).

### Acceptance criteria

- [ ] Each ATS adapter has unit tests against a checked-in HAR fixture per ATS (at minimum: one representative real company). Tests verify normalization maps all required fields.
- [ ] Running the crawler manually (`pnpm dev:worker -- --queue crawl_jobs`) with the seed companies produces > 100 jobs in the DB within a single run.
- [ ] Re-running the crawler within 24h does not create duplicates.
- [ ] The scheduled workflow runs and ingests jobs without human intervention.
- [ ] The Jobs inbox UI loads, filters work, and displays a populated list.
- [ ] Every adapter respects a per-adapter rate limit (configurable, default 1 request per 500ms).

**Stop. Report. Wait for approval.**

---

## Phase 4 — Fit scoring

**Goal:** Rank jobs by fit using hard filters + semantic similarity + LLM judge. Surface top-N for review.

### Tasks

**P4.1** — Schema: `job_embeddings`, `job_scores`, `fit_judgments`. DDL in `docs/database-schema.md` §4.

**P4.2** — Hard filter engine `packages/resume/src/fit/hard-filters.ts`:
- Input: `Job`, `Preferences`.
- Output: `{ pass: boolean, reasons: string[] }`.
- Rules: experience level match, work mode match, job type match, salary floor, location/country match, visa/work-auth compatibility. All deterministic; zero LLM.

**P4.3** — JD parser: `packages/llm/src/tasks/jd-parse.ts`. Uses Gemini Flash-Lite (free tier; JD text is public). Extracts structured `{must_have_skills, nice_to_have_skills, required_years, required_education, tech_stack, keywords, red_flags}`. Zod-validated output.

**P4.4** — JD embedding: after JD parsing, compute Gemini text-embedding-004 on a canonical representation (title + first-300-words of description + parsed skills). Store in `job_embeddings.jd_embedding`.

**P4.5** — Semantic similarity: `packages/resume/src/fit/semantic.ts` — cosine similarity between `profile_embeddings.summary_embedding` and `job_embeddings.jd_embedding`. Returns a 0-1 score.

**P4.6** — LLM judge: `packages/llm/src/tasks/fit-judge.ts`. Uses Gemini Flash (free tier). Takes the profile derived summary + parsed JD + hard-filter result. Returns `{overall_score: 0-100, dimensions: {skills, experience, domain, seniority, logistics}, reasoning: string, must_have_gaps: string[]}`. Zod-validated.

**P4.7** — Fit scoring worker at `workers/scorer/src/index.ts`:
- Reads pgmq queue `score_jobs`.
- For each job: run hard filters → if pass, parse JD → embed → compute semantic score → if semantic > 0.55, run LLM judge → store complete judgment.
- Jobs that fail hard filters store a `job_scores` row with `overall_score = 0` and the failure reasons.
- Idempotent: re-running on the same job skips if `updated_at` of profile hasn't changed since last score.

**P4.8** — After a crawl batch, enqueue scoring messages for all new-or-updated jobs.

**P4.9** — Fit-score presentation in Jobs inbox: show the overall score as a colored ring on each job card; show top-5 dimensions on the detail drawer; show must-have gaps prominently.

**P4.10** — Auto-tiering: jobs with `overall_score ≥ 85` → `status = 'pending_review'`. Jobs 70-84 → `status = 'needs_decision'`. Jobs < 70 → `status = 'low_fit'` (hidden by default in UI).

### Acceptance criteria

- [ ] Given a seeded profile and 50 diverse test jobs, hard filters correctly reject the ones they should (unit tests).
- [ ] LLM judge returns valid structured output for 100% of inputs in a 50-job test batch.
- [ ] The full scoring pipeline on 100 real jobs completes in under 15 minutes with no failures.
- [ ] Scores are deterministic enough that re-running on the same inputs yields within ±3 points (LLM non-determinism is bounded).
- [ ] The `/jobs` inbox shows fit scores and filters work correctly.

**Stop. Report. Wait for approval.**

---

## Phase 5 — Resume tailor + render

**Goal:** For each approved job, generate a tailored resume (as structured JSON), render to PDF and DOCX, save artifacts.

### Tasks

**P5.1** — Schema: `resume_variants`, `tailored_resumes`, `tailored_bullets`. DDL in `docs/database-schema.md` §5.

**P5.2** — Resume JSON schema: `packages/resume/src/schemas/resume.ts`. Sections (profile, summary, experience, projects, skills, education, certifications) with strict Zod validation. This is the sole output format of the tailor.

**P5.3** — Tailor prompt v1: `packages/llm/src/prompts/tailor/v1.ts`.
- System prompt contains the honesty constraint verbatim (see `CLAUDE.md` §2.7).
- Input: master profile (full), target JD (parsed), target company, optional notes.
- Output schema: `TailoredResume` (structured JSON).
- Cache breakpoint after the system prompt and after the master profile.

**P5.4** — Tailor task: `packages/llm/src/tasks/tailor.ts`. Always routes to privacy LLM. Runs through the llm router with timeout 90s, 1 retry.

**P5.5** — Honesty checker: `packages/resume/src/tailor/honesty.ts`:
- Input: master profile + tailored output.
- For every skill, metric, employer, duration in the tailored output, verifies it appears in the master profile (exact match for identifiers, fuzzy for phrasing).
- Returns `{ok: boolean, violations: string[]}`. On violation, tailor retries with a stricter system message listing the violations; second failure fails the job.

**P5.6** — Tailor worker at `workers/tailor/src/index.ts`:
- Reads `tailor_jobs` queue.
- Runs tailor → honesty check → loop.
- Writes `tailored_resumes` row with the final JSON.

**P5.7** — LaTeX template: `packages/resume/src/render/templates/ats-safe.tex`. Single-column, standard section headings, serif font, no tables, no graphics. Renders from the JSON via a templating function.

**P5.8** — PDF renderer: `packages/resume/src/render/pdf.ts` shells out to Tectonic (installed on Oracle VM). Runs in a child process with timeout 30s. Output file written to Supabase Storage under `resumes/{userId}/{jobId}.pdf`. Record URL in `tailored_resumes.pdf_url`.

**P5.9** — DOCX renderer: `packages/resume/src/render/docx.ts` uses the `docx` npm package. Same structure as LaTeX. Output to Storage at `resumes/{userId}/{jobId}.docx`.

**P5.10** — Render test fixture: 3 master-profile × 3 JD combinations. Expected: the rendered PDF parses cleanly through all three ATS parsers (see Phase 6) and extracts all required fields.

**P5.11** — UI: Review workspace at `/jobs/[id]/review`:
- Three panels: JD (left, with must-haves highlighted), tailored resume preview (middle, render the PDF inline via react-pdf), approve-bar (right, with "Regenerate", "Edit bullets", "Approve for submission").
- "Edit bullets" opens a modal to swap alternate phrasings or manually edit a single bullet.
- "Regenerate" re-runs tailor with an optional user hint ("emphasize the healthcare experience more").

### Acceptance criteria

- [ ] Given a master profile and 10 JDs, the tailor produces valid structured output for 10/10. Honesty checker passes for 10/10 (retry count recorded).
- [ ] Rendered PDFs open in Adobe Reader, Chrome, and macOS Preview without errors.
- [ ] DOCX opens in Word without formatting warnings.
- [ ] A golden-file test asserts that the rendered PDF for a fixed input is byte-stable (to catch inadvertent template drift).
- [ ] The review workspace loads a real tailored resume in under 3 seconds.

**Stop. Report. Wait for approval.**

---

## Phase 6 — ATS verifier

**Goal:** Deterministic, reproducible verification that the tailored resume will parse well. No Jobscan-style black-box score — we compute our own.

### Tasks

**P6.1** — Schema: `verifications`. DDL in `docs/database-schema.md` §6.

**P6.2** — Parser wrappers in `packages/parsers/`:
- **`pyresparser.ts`** — HTTP client to a small FastAPI service on Oracle VM that wraps pyresparser (Python 3.11). Service accepts PDF upload, returns structured JSON.
- **`openresume.ts`** — Port of OpenResume's parser logic to Node. Start with the 4-step algorithm (lines → sections → feature-scoring → extraction) from the open-resume.com docs. If porting is too heavy, set up an HTTP service similar to pyresparser.
- **`simple.ts`** — A pdf-parse + regex baseline that extracts email, phone, dates, and matches known skills. Deterministic fallback.

**P6.3** — Ensemble runner: `packages/resume/src/verify/ensemble.ts`:
- Input: PDF path + parsed JD requirements.
- Runs all three parsers in parallel with 20s timeout each.
- Returns `{parserResults: [...], consensus: {...}}`.

**P6.4** — Scorer: `packages/resume/src/verify/score.ts` computes:
- **Parse agreement (40%)**: fraction of fields (name, email, phone, experience titles, skills, education) where at least 2/3 parsers agree.
- **Keyword coverage (50%)**: for each must-have skill from JD, does it appear in the parsed skills list OR in an experience bullet text? Full term + acronym both checked.
- **Format compliance (10%)**: single column (no multi-column parse divergence), standard section headings detected, word count 400-900, no embedded images.

Final score 0-100. Threshold for "pass" configurable; default 80.

**P6.5** — Regeneration loop: if score < 80, produce a feedback message for the tailor ("missing skills: Playwright, VAPI; section 'Experience' not cleanly detected by parser 2") and re-run tailor with this feedback appended to the user message. Max 2 regeneration loops, then fail to manual-review.

**P6.6** — Verifier worker at `workers/verifier/src/index.ts`:
- Reads `verify_jobs` queue.
- Runs ensemble → scores → maybe triggers regeneration → writes `verifications` row.

**P6.7** — Docker Compose setup for Oracle VM worker stack:
- `docker-compose.yml` with services: `tailor-worker`, `verify-worker`, `crawler-worker`, `scorer-worker`, `submitter-worker`, `pyresparser-svc`, `openresume-svc`, `tectonic-svc`.
- Shared config via `.env` on the VM.
- Systemd unit file to start the stack on boot.
- Health-check endpoints on each service.

**P6.8** — Verifier calibration suite: 10 resumes × 10 JDs = 100 pairs with human-labeled expected scores (user supplies). Write `pnpm test:verifier` that runs the ensemble on all 100 and asserts Spearman correlation with expected scores ≥ 0.8.

**P6.9** — UI: Verification panel in the review workspace. Shows per-parser field agreement, keyword coverage with missing keywords highlighted, format checks, and the regeneration history.

### Acceptance criteria

- [ ] All three parsers are installed, reachable via HTTP from the worker stack, and respond to health checks.
- [ ] Running the ensemble on a fixed fixture produces byte-stable scores on 3 consecutive runs.
- [ ] The calibration suite passes with correlation ≥ 0.8 against user-labeled expected scores.
- [ ] The verifier correctly flags a known-bad resume (multi-column, image-based, missing section headings) with score < 60.
- [ ] The review workspace shows verification output within 5 seconds of tailoring completion.

**Stop. Report. Wait for approval.**

---

## Phase 7 — Cover letter + Q&A

**Goal:** Generate consistent cover letters and application-form answers that match the tailored resume.

### Tasks

**P7.1** — Schema: `cover_letters`, `question_answers`, `answer_cache`. DDL in `docs/database-schema.md` §7.

**P7.2** — Cover letter prompt v1: `packages/llm/src/prompts/cover-letter/v1.ts`.
- Inputs: tailored resume JSON, parsed JD, company name, optional tone hint, optional recent-company-news snippet (see P7.4).
- Output: `{greeting, body, signoff}` with total word-count limit.
- Honesty constraint (same as tailor).
- Cache breakpoints on system prompt and master-profile-derived persona.

**P7.3** — Cover letter task: `packages/llm/src/tasks/cover-letter.ts`. Routes to privacy LLM. Zod-validated. Post-generation honesty check similar to tailor.

**P7.4** — Company research auto-pack:
- Worker step: on fit score ≥ 85, fetch the company's `/blog`, `/news`, `/press` (if discoverable), or fall back to a Google News query via web search. Extract most-recent 3 items as `{date, title, snippet}`.
- Store in `companies.research_pack` JSON column.
- Cover letter prompt consumes the freshest item.

**P7.5** — Q&A answer generation: `packages/llm/src/tasks/answer-question.ts`.
- Input: question text, question type (short-text, long-text, select, multiselect, number, boolean), optional word limit, target job id (for context), tailored resume id.
- Pipeline: check `answer_cache` for (normalized_question_hash, user_id). If hit and confidence high → return cached. Else → RAG over `question_bank` + `stories` + tailored resume → LLM generate → store in cache.
- Output consistent with tailored resume: honesty check extended to verify no contradicting claims.

**P7.6** — Answer consistency check: `packages/resume/src/tailor/consistency.ts` cross-references all Q&A answers for a job against the tailored resume. Flags contradictions (e.g., resume says "2 years" but answer says "3 years"). Blocks submission on contradiction.

**P7.7** — UI: Cover letter editor in review workspace. TipTap rich text. "Regenerate" button. Side-by-side with the JD for context. Word count indicator.

**P7.8** — UI: Q&A panel in review workspace. Lists all answers grouped by question. Each answer editable. Contradiction warnings inline.

### Acceptance criteria

- [ ] Given a tailored resume and a JD, the cover letter generator produces a valid output structure in 5/5 runs.
- [ ] Consistency check correctly flags a planted contradiction (test fixture).
- [ ] For a set of 30 common ATS form questions, the generator produces answers within specified word limits.
- [ ] Answer cache hit rate ≥ 60% after 20 applications (measured).

**Stop. Report. Wait for approval.**

---

## Phase 8 — Submitter

**Goal:** Approved applications are submitted. ATS-API-first, Playwright for portals, manual-review queue as fallback.

### Tasks

**P8.1** — Schema: `submissions`, `submission_attempts`, `manual_review_queue`. DDL in `docs/database-schema.md` §8.

**P8.2** — Router: `workers/submitter/src/router.ts` detects target ATS from the job and routes to the correct adapter.

**P8.3** — Adapter: Greenhouse API submission.
- Endpoint: `POST https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{job_id}` with multipart form.
- Supports file uploads for resume and cover letter.
- Maps internal field names to Greenhouse's `first_name`, `last_name`, `email`, `phone`, `resume`, `cover_letter`, plus dynamic custom questions.

**P8.4** — Adapter: Lever submission (same pattern, Lever-specific endpoint and field mapping).

**P8.5** — Adapter: Ashby submission.

**P8.6** — Adapter: Workable submission.

**P8.7** — Generic Playwright adapter for portals without a public apply API:
- Loads the apply URL in a browser context.
- Fills standard fields (name, email, phone, resume upload, cover letter paste or upload) using a selector library that covers the top 5 portal patterns.
- Uses the LLM (privacy provider) to map unknown custom questions to the Q&A bank at runtime.
- Screenshots before submit + after success confirmation. Saved as attempt evidence.
- On any unexpected state (captcha, SSO, missing selectors), fails gracefully to manual-review with full context screenshot.

**P8.8** — Submitter worker at `workers/submitter/src/index.ts`:
- Reads `submit_jobs` queue.
- Respects `ENABLE_AUTO_SUBMIT` flag and `DAILY_APPLICATION_CAP`.
- Respects per-ATS rate limits.
- Records every attempt in `submission_attempts` with full context (request payload sanitized, response, screenshots).

**P8.9** — UI: Manual-review queue at `/queue`. Each item shows the pre-filled form, screenshots, and a "Submit manually — mark done" button.

**P8.10** — Follow-up scheduler worker at `workers/follow-up/src/index.ts`:
- On day 7 post-submission with no response, composes a brief follow-up via the privacy LLM and sends via Gmail SMTP.
- On day 14 with no response, marks application as stale.

### Acceptance criteria

- [ ] Each ATS adapter has an end-to-end integration test against a staging Greenhouse/Lever/Ashby/Workable account (if the user has one) OR a recorded HAR fixture that the test replays.
- [ ] With `ENABLE_AUTO_SUBMIT=false` and `DAILY_APPLICATION_CAP=30`, a dry-run of 10 approved jobs produces correct attempt records with no actual submissions.
- [ ] With `ENABLE_AUTO_SUBMIT=true` on a test job at a sandbox company (if available), a real submission succeeds and is recorded.
- [ ] Generic Playwright adapter successfully fills a test form on a portal not in the ATS list (user provides an example).
- [ ] Manual-review queue UI works end-to-end.

**Stop. Report. Wait for approval.**

---

## Phase 9 — Tracker + analytics

**Goal:** Every application's outcome is tracked; analytics drive calibration.

### Tasks

**P9.1** — Schema: `outcomes`, `outcome_events`. DDL in `docs/database-schema.md` §9.

**P9.2** — Gmail polling worker: on a 30-minute cron, hits the user's Gmail IMAP (via OAuth already configured) and classifies new inbound mail. Classification via privacy LLM: `{type: 'callback|rejection|interview-invite|recruiter|other', job_match: string|null, confidence: number}`. Writes `outcome_events`.

**P9.3** — Tracker UI at `/tracker`:
- Kanban with `Submitted → Acknowledged → Responded → Interviewing → Offered | Rejected`.
- Drag cards to move (records an outcome event).
- Click card → full application history.

**P9.4** — Analytics dashboard at `/analytics`:
- Funnel chart (Recharts).
- Response rate by fit-score bucket, by source, by day-of-week.
- Time-to-first-response histogram.
- API cost running total (this month).
- Resume variant A/B comparison.

**P9.5** — Response predictor: `packages/resume/src/predict/response.ts` trains a logistic regression nightly on historical outcomes. Features: fit score, verifier score, source, company-size bucket, posting-age-bucket, referral present (bool). Stored in a tiny SQLite file on the Oracle VM and served as JSON to the web app. Use scikit-learn or a pure-JS alternative like `ml-logistic-regression`.

**P9.6** — Fit-score calibration: a script `scripts/calibrate-fit.ts` compares predicted fit (LLM judge) to actual response rates and writes a calibration adjustment multiplier back to the profile. The scorer reads this and applies.

### Acceptance criteria

- [ ] Gmail classifier correctly labels 10/10 hand-labeled test emails.
- [ ] Kanban drag-to-move writes outcome events correctly.
- [ ] Analytics dashboard loads in < 2s with 200+ applications.
- [ ] Response predictor's ROC AUC on held-out data ≥ 0.7 after 50+ labeled outcomes.

**Stop. Report. Wait for approval.**

---

## Phase 10 — Chrome extension

**Goal:** LinkedIn/Indeed fit-score overlay + Easy Apply assist using the user's own session.

### Tasks

**P10.1** — Plasmo project at `apps/extension`. TypeScript, React, Manifest V3.

**P10.2** — Content script for `linkedin.com/jobs/*`:
- Detects a job posting page.
- Extracts title, company, location, description from the DOM.
- Sends to backend for fit scoring (Supabase RPC or Edge Function with the user's auth token).
- Overlays a fit-score widget at the top-right of the job posting.

**P10.3** — Easy Apply assist: when user clicks "Easy Apply" on LinkedIn:
- Content script intercepts the modal.
- Generates a tailored resume + cover letter + Q&A via backend.
- Auto-fills the form fields.
- User reviews and clicks submit (we never click submit on LinkedIn).

**P10.4** — Popup UI: extension icon opens a popup showing today's scored jobs from LinkedIn and quick actions.

**P10.5** — Settings: extension uses a Supabase magic-link auth flow (opens a tab to the web app's special `/auth/extension` route; the route sets a cookie and messages the extension's background page with a session token).

**P10.6** — Same flow for `indeed.com/viewjob` pages (simpler — Indeed's DOM is more stable).

### Acceptance criteria

- [ ] Loading a LinkedIn job page shows the fit-score widget within 2s.
- [ ] Easy Apply auto-fill works on 5 test LinkedIn jobs without errors.
- [ ] The extension never makes cross-origin requests to anything other than the user's backend.
- [ ] Extension passes Chrome Web Store review (if user chooses to publish).

**Stop. Report. Wait for approval.**

---

## Phase 11 — Hardening

**Goal:** Production-ready ops: rate limiting, error budgets, runbooks.

### Tasks

**P11.1** — Rate limiter: per-ATS and per-LLM-provider rate limiters in `packages/shared/src/ratelimit.ts` using a token-bucket backed by Redis-compatible storage (use Supabase `kv_store` table as a simple K/V).

**P11.2** — Error budget tracking: every worker emits a metric on success/failure. Alert (via Gmail) if failure rate > 20% in a 1-hour window.

**P11.3** — Runbooks in `docs/runbooks/`:
- `deploy.md` — deployment procedure.
- `rotate-keys.md` — rotating Supabase, Gemini, Anthropic keys.
- `ats-selector-broken.md` — what to do when a Playwright adapter breaks due to site changes.
- `llm-quota-exceeded.md` — what to do when Gemini free tier is exhausted.
- `supabase-quota-exceeded.md` — upgrading from free tier.
- `recover-failed-migration.md` — rolling back a bad migration.

**P11.4** — Backup: nightly Supabase DB dump to Oracle VM via `pg_dump` cron. Keep 14 days.

**P11.5** — `pnpm quotas:check` — prints current Gemini RPD usage, Anthropic credit balance, Supabase DB size, Vercel bandwidth.

**P11.6** — Load test: simulate 100 jobs/day end-to-end on a 7-day window. Confirm the system holds within free-tier limits.

**P11.7** — Documentation review: every file under `docs/` read by the user for accuracy. Any drift from the implementation is corrected.

### Acceptance criteria

- [ ] All runbooks reviewed by user.
- [ ] 7-day load test runs without a single unrecovered failure.
- [ ] Backups are created nightly and can be restored to a fresh Supabase project (test this once).
- [ ] `pnpm quotas:check` reports accurate numbers.

**This is the final phase. When it's done, the system is production-ready for the user's own job hunt.**

---

## Global notes for every phase

- **Commit early, commit often.** Every acceptance criterion should correspond to at least one commit.
- **Tests first for business logic.** UI is OK to build and then test, but logic in `packages/` gets tests before merge.
- **When an acceptance criterion is ambiguous, write the test first** — the test makes the criterion precise.
- **Surface cost.** Every LLM call logs tokens. The analytics dashboard shows running cost. If you notice a phase is driving cost disproportionately, flag it.
- **Never skip the "Stop. Report. Wait for approval." step between phases.** The user is the final QA on each phase.