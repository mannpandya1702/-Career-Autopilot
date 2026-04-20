# Architecture — Career Autopilot

This document is the system-level map. For detail, see:
- Database schema: `database-schema.md`
- Build sequence: `build-phases.md`
- ATS adapters: `integrations.md`
- LLM routing & prompts: `llm-routing.md`
- Ops procedures: `runbooks/`

---

## System map

```
                        ┌───────────────────────────────────────────────────────┐
                        │                 USER INTERFACES                       │
                        │                                                       │
                        │  ┌──────────────────┐    ┌────────────────────────┐   │
                        │  │ Next.js Web App  │    │ Plasmo Chrome Ext.     │   │
                        │  │ (Vercel Hobby)   │    │ (user's own browser)   │   │
                        │  └────────┬─────────┘    └───────────┬────────────┘   │
                        └───────────┼────────────────────────────┼─────────────┘
                                    │                            │
                                    │ Supabase Auth (magic link) │
                                    │                            │
                        ┌───────────▼────────────────────────────▼─────────────┐
                        │                    SUPABASE                          │
                        │                                                      │
                        │  Postgres + pgvector + pgmq + pg_cron   Edge Funcs   │
                        │  Auth  |  Storage (PDFs/DOCX/screens)   Storage API  │
                        └───┬──────────────────────────────────────┬───────────┘
                            │                                      │
                            │ pgmq pull (workers poll)             │ REST/RPC
                            │                                      │
            ┌───────────────▼──────────────────────────────────────▼───────────┐
            │                   ORACLE VM (4 OCPU / 24 GB RAM)                │
            │                                                                 │
            │   Docker Compose stack:                                         │
            │                                                                 │
            │   crawler    scorer    tailor    verifier   submitter          │
            │      │         │         │          │           │              │
            │      └─────────┴─────────┴──────────┴───────────┘              │
            │                         │                                       │
            │                         ▼                                       │
            │            pyresparser-svc  openresume-svc  tectonic-svc        │
            │            (Python)         (Node)          (LaTeX)             │
            └────────────────────────────┬────────────────────────────────────┘
                                         │
                                         │ External APIs & scraping
                                         │
    ┌────────────────────────────────────┼──────────────────────────────────┐
    │                                    │                                  │
    │   LLM PROVIDERS                    │   ATS DIRECT APIs                │
    │   ──────────────                   │   ──────────────                 │
    │   Anthropic (SENSITIVE)            │   Greenhouse, Lever,             │
    │   Gemini (PUBLIC, free)            │   Ashby, Workable,               │
    │                                    │   SmartRecruiters                │
    │                                    │                                  │
    │   OBSERVABILITY                    │   EMAIL                          │
    │   ──────────────                   │   ──────                         │
    │   Sentry, PostHog, Axiom (free)    │   Gmail SMTP + IMAP              │
    │                                    │                                  │
    └───────────────────────────────────────────────────────────────────────┘

                                         GitHub Actions
                                         ──────────────
                                         - CI (PR + push)
                                         - Keepalive (daily Supabase ping)
                                         - Crawl-jobs (4x/day → enqueue)
```

---

## Data flow — the end-to-end happy path

```
   Every 6 hours                 ┌─────────────────────────┐
   (GH Actions cron) ──────────► │  crawl_jobs queue       │
                                 └───────────┬─────────────┘
                                             │ pull
                                             ▼
                                 ┌─────────────────────────┐
                     ┌─────────► │   crawler worker         │ ────► jobs table
                     │           │   (ATS adapters)         │       (dedupe)
                     │           └───────────┬─────────────┘
                     │                       │ enqueue new/updated
                     │                       ▼
                     │           ┌─────────────────────────┐
                     │           │   score_jobs queue       │
                     │           └───────────┬─────────────┘
                     │                       │
                     │                       ▼
                     │           ┌─────────────────────────┐       jd.parse (Gemini)
                     │           │   scorer worker          │ ────► embed.jd (Gemini)
                     │           │                          │       fit.judge (Gemini)
                     │           └───────────┬─────────────┘
                     │                       │ tier = pending_review
                     │                       ▼
                     │                       Jobs inbox (user reviews)
                     │                       │ user clicks Approve
                     │                       ▼
                     │           ┌─────────────────────────┐
                     │           │   tailor_jobs queue      │
                     │           └───────────┬─────────────┘
                     │                       │
                     │                       ▼
                     │           ┌─────────────────────────┐       tailor.resume (Claude)
                     │           │   tailor worker          │ ────► honestyCheck
                     │           │                          │       render PDF + DOCX
                     │           └───────────┬─────────────┘
                     │                       │
                     │                       ▼
                     │           ┌─────────────────────────┐
                     │           │   verify_jobs queue      │
                     │           └───────────┬─────────────┘
                     │                       │
                     │                       ▼
                     │           ┌─────────────────────────┐       pyresparser
                     │           │   verifier worker        │ ────► openresume
                     │           │                          │       simple
                     │           └───────────┬─────────────┘       → score → loop if < 80
                     │                       │ score ≥ 80
                     │                       ▼
                     │           cover.letter (Claude)
                     │           qa.answer × N (Claude)
                     │                       │
                     │                       ▼
                     │           Review workspace (user final approval)
                     │                       │ user clicks Submit
                     │                       ▼
                     │           ┌─────────────────────────┐
                     │           │   submit_jobs queue      │
                     │           └───────────┬─────────────┘
                     │                       │
                     │                       ▼
                     │           ┌─────────────────────────┐       ATS-direct APIs
                     │           │  submitter worker        │ ────► or Playwright
                     │           │                          │       or manual queue
                     │           └───────────┬─────────────┘
                     │                       │
                     │                       ▼
                     │           submissions table
                     │                       │
                     │                       ▼
                     │           follow-up worker (day 7, 14)
                     │                       │
                     │                       ▼
                     │           email classifier → outcomes
                     │                       │
                     │                       ▼
                     │           response predictor (nightly) ────► calibration
                     └───────────────────────┘
                              feedback loop
```

Every arrow that crosses a dotted boundary (service-to-service) goes through pgmq, so every step is retry-safe.

---

## Key architectural decisions

These are the decisions worth flagging because they constrain everything else. If you find yourself fighting one, re-read this section before "fixing" it.

### AD-1: ATS-API-first, Playwright-second, manual-third

**Decision:** Always try the ATS's public API before scraping HTML.

**Why:** Public APIs are fast (100ms), cheap (free), legal (they invite this usage), and stable. Playwright is slow (10s+), expensive (proxy costs + CPU), legally grey, and breaks when sites change. 60-70% of tech jobs route through Greenhouse/Lever/Ashby/Workable/SmartRecruiters.

**Consequence:** The system's reliability and cost profile improves dramatically as the target-companies list skews toward ATS-using companies. Bias toward those in the seed list.

### AD-2: Structured resume JSON, not free-text generation

**Decision:** The tailor outputs a typed JSON; rendering is deterministic.

**Why:** Free-text resumes from LLMs are parse-unfriendly (tables, creative headings, Unicode quirks) and ATS verification is noisy. Structured JSON with a known template means the rendered PDF always has the same section structure, which means parsers extract it reliably, which means the ATS score is a measurement, not a vibe.

**Consequence:** You cannot "let the LLM design a creative layout." That's a feature, not a limitation.

### AD-3: The master profile is the source of truth; everything else is derived

**Decision:** All downstream artifacts (derived summary, embeddings, tailored resumes, cover letters, Q&A answers) are regenerable from the master profile + the target JD.

**Why:** It makes schema migrations safer (regenerate), enables A/B testing (regenerate with a different prompt), and makes the "edit profile" flow simple (invalidate, regenerate).

**Consequence:** Computing derived artifacts has to be fast and cheap enough to regenerate often. That's what drives the cache-aggressively rule.

### AD-4: Privacy routing gates the free tier

**Decision:** Any prompt containing master-profile fields routes to Anthropic (no-training) by default. Gemini free tier only sees JD text, derived summaries, and company research.

**Why:** Free Gemini's ToS permits prompt data to be used for product improvement. The user's personal details — salary, address, visa status, family situation embedded in STAR stories — are not something we trade for free inference.

**Consequence:** The Haiku bill is ~$3-10/month. That's the one non-negotiable cost line in the system.

### AD-5: The honesty constraint is a three-layer defense

**Decision:** (1) Prompt tells the LLM not to invent; (2) Zod schema bounds the shape; (3) Post-generation code checks every claim against the master profile.

**Why:** Any single layer fails sometimes. Prompts can be over-influenced by the JD's aspirational language. Zod enforces shape but not content fidelity. Code checks content but could miss subtle paraphrasing. Together they produce a resume you can defend in the interview.

**Consequence:** The honesty checker is one of the two most-important files in the codebase (with the router). Test it aggressively.

### AD-6: pgmq instead of Redis/SQS

**Decision:** Use Postgres message queue via Supabase's pgmq extension.

**Why:** One less service, one fewer credential, one fewer billing line. Postgres handles tens of thousands of messages per day without breaking a sweat. When the user scales past 10k/day, revisit.

**Consequence:** Queue depth and worker lag are visible in the same SQL queries as everything else — makes ops simpler.

### AD-7: Single pane of glass — one database, two compute surfaces

**Decision:** All state in Supabase. Compute split only between Vercel (web app; stateless) and Oracle VM (workers; long-running).

**Why:** The alternative — separate queue, separate cache, separate analytics, separate feature-flag store — creates a web of credentials and sync problems. One database is much simpler.

**Consequence:** Every worker and every page query goes through Supabase. Schema and RLS have to be right from day one.

### AD-8: Chrome extension as the only LinkedIn/Indeed strategy

**Decision:** Never headless-scrape LinkedIn or Indeed. Use an extension that runs in the user's authenticated session.

**Why:** LinkedIn/Indeed actively detect and block bots; accounts get flagged. The extension pattern is how every commercial competitor (Simplify, Teal, Jobscan's extension) handles this, and it's the legal equivalent of the user clicking the button themselves.

**Consequence:** LinkedIn and Indeed coverage requires the user's browser to be open. Acceptable for a personal tool; reconsider if this becomes a multi-user SaaS.

### AD-9: Every phase is gated by acceptance criteria + user approval

**Decision:** No cascading phases. Claude Code stops after each phase's acceptance criteria pass and waits for the user to say "proceed."

**Why:** Multi-phase cascades tend to magnify compounding errors. An undetected schema issue in Phase 2 becomes a failing submitter in Phase 8, and rolling back is expensive. The stop-and-approve checkpoint bounds blast radius.

**Consequence:** Total build calendar time is longer than it could be. That's the correct tradeoff.

---

## Non-goals (in scope of v1)

These are explicitly out of scope for the first complete build. Do not implement them without an explicit user ask.

- Multi-user / multi-tenant. The system is built for one user but with RLS and user-scoped tables so productization is possible later.
- Billing/subscriptions. No Stripe integration.
- Mobile app. The web app is mobile-responsive; no native app.
- Referral outreach automation. The analytics surface shows who's in your network at a target company, but the system does not send outreach automatically.
- Recruiter-side features. The system is candidate-side only.
- Fine-tuning any LLM. We use off-the-shelf models with prompt engineering.
- Alternative output formats beyond PDF and DOCX. No HTML portfolios, no markdown resumes, no JSON-LD.

---

## Failure modes and mitigations

| Failure mode | Likelihood | Blast radius | Mitigation |
|---|---|---|---|
| Gemini free-tier quota exhausted mid-day | High | Scoring stalls until midnight Pacific | Fall back to Flash-Lite when Flash exhausted; queue remaining jobs until reset; surface to dashboard |
| Anthropic credit exhausted | Low | Tailor / cover / Q&A stall | Alert user at 80% of monthly budget; hard stop at 100% |
| Supabase free-tier paused (7 days idle) | Low (keepalive runs daily) | Entire system down | Keepalive GH Action; documented recovery runbook |
| Oracle VM reclaimed for idleness | Medium | Worker stack down | Keep CPU > 20% via scheduled workloads; monitor with Better Stack |
| ATS changes its JSON shape | Medium | One adapter breaks | Schema validation fails fast; ops runbook says update schema + adapter in one PR |
| Playwright adapter breaks due to site change | High (over months) | One portal breaks | Screenshot-on-failure + manual review fallback + selector-update runbook |
| LLM produces invalid JSON | Medium | One application fails | Validation retry + manual review on second failure |
| Honesty checker false-positives a legitimate rephrasing | Low | One application regenerates unnecessarily | Tune the fuzzy-match threshold based on calibration corpus |
| Submission succeeds but we don't detect confirmation | Medium | Duplicate submit attempts | Record `external_confirmation_id`; check before retry; idempotency key on submissions table |
| User's Gmail IMAP creds expire | Low | Outcome classifier stops | Daily health check; email the user if auth fails |

---

## Scaling envelope

The system is designed for one user generating 30-60 applications/day. Before scaling beyond that, revisit:

- **LLM costs** grow linearly. At 100 users × 30/day, the Haiku bill is ~$1000/mo. Needs a business model.
- **Oracle VM capacity**: 4 OCPU comfortably handles ~500 concurrent Playwright sessions/day. Past that, need to scale horizontally.
- **Supabase free tier**: 500MB DB, 1GB storage. Starts breaking at ~50 active users. Pro plan ($25/mo) is the next step.
- **Gemini free tier**: 100 RPD on Pro, 1000 RPD on Flash-Lite. Multi-user breaks this immediately. Would need to move to Gemini paid Tier 1.

If/when you scale past one user, the first thing to change is the LLM router to route per-user quotas and the Oracle VM to a scalable Kubernetes setup. Everything else is already user-scoped.

---

## Security model

- **AuthN:** Supabase Auth with magic-link only. No passwords.
- **AuthZ:** RLS everywhere. Workers use the service role key (bypasses RLS) inside the Oracle VM; that key never leaves the VM.
- **Secrets:** `.env` files locally (gitignored); Vercel env vars for web; Oracle VM `/etc/career-autopilot.env` with `chmod 600` for workers.
- **Storage:** Resume PDFs and screenshots in Supabase Storage with per-user-prefixed paths; bucket-level policy restricts access to the user's own files.
- **PII redaction:** every external logging call (Sentry, PostHog, Axiom) passes through the scrubber (`packages/shared/src/observability/scrub.ts`).
- **Chrome extension:** reads LinkedIn DOM in the user's tab; POSTs only to the user's own backend; never cross-origin to third parties.

---

## What "good" looks like in ops

- **Uptime:** worker stack > 99% over a 30-day window.
- **Median end-to-end latency** (job discovered → tailored resume ready for review): < 5 minutes.
- **ATS verifier pass rate** on first attempt: > 70% (remaining 30% use 1-2 regeneration loops).
- **Submission success rate** (API or Playwright, not counting manual-queue): > 95%.
- **LLM cost per application**: < $0.05.
- **User weekly active sessions**: daily (the user reviews their queue every day).

These are targets, not hard SLOs. A healthy system trends toward them; a degrading system drifts away.