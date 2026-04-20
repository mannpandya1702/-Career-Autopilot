# Career Autopilot

A personal job-application automation system. Discovers jobs, tailors your resume per-job with a verified ATS score, writes cover letters, answers application questions, and submits — all on a free-tier infrastructure stack.

Built for one user (you). Not a SaaS. Not a bot-farm. A career co-pilot you control end to end.

---

## What it does

- **Discovers** jobs from ATS-direct APIs (Greenhouse, Lever, Ashby, Workable, SmartRecruiters) plus your configured target companies.
- **Scores** each job against your master profile using embeddings + an LLM judge.
- **Tailors** your resume as structured JSON (with an honesty constraint: never invents skills or metrics), renders to PDF and DOCX via a LaTeX template.
- **Verifies** the tailored resume with a 3-parser ensemble — computes an ATS score that is reproducible, not a black-box number.
- **Writes** a cover letter and answers application-form questions from your stored Q&A bank + STAR stories.
- **Submits** via ATS APIs where possible, Playwright for portals, or queues for your manual review.
- **Tracks** outcomes from your Gmail and feeds them back into the scorer.
- **Assists** on LinkedIn/Indeed via a Chrome extension that uses your own logged-in session.

---

## Cost

- **Infrastructure**: $0/mo (Vercel Hobby + Supabase Free + Oracle Cloud Always Free + GitHub Actions).
- **LLM**: $5-15/mo for privacy-opted-out Claude Haiku on tailoring / cover letter / Q&A.
- **Optional**: $5 Chrome Web Store fee (one-time, skip for personal use), ~$10/yr domain.

Total realistic Year-1 cost: $60-200 of actual spend.

---

## Tech stack

- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + shadcn/ui on Vercel.
- **Backend**: Supabase (Postgres + pgvector + pgmq + pg_cron + Auth + Storage + Edge Functions).
- **Workers**: TypeScript + Node 20 on an Oracle Cloud ARM VM (Docker Compose).
- **Browser automation**: Playwright.
- **Resume rendering**: LaTeX (Tectonic) for PDF, `docx` npm package for DOCX.
- **Resume parsing ensemble**: pyresparser (Python) + OpenResume port (Node) + pdf-parse baseline.
- **LLMs**: Anthropic Claude Haiku 4.5 (privacy path) + Google Gemini (free-tier for public-text tasks).
- **Embeddings**: Gemini `text-embedding-004`.
- **Chrome extension**: Plasmo (React + Manifest V3).
- **CI + scheduling**: GitHub Actions.
- **Observability**: Sentry + PostHog + Axiom + Better Stack (all free tiers).

---

## Quickstart

### 1. Provision infrastructure

Before cloning this repo, have these accounts and resources ready. Each is truly free; no trial-that-expires:

| Resource | Free tier | Sign up at |
|---|---|---|
| Supabase project (same region as your Oracle VM) | 500MB DB + 1GB storage + 50k MAU | [supabase.com](https://supabase.com) |
| Oracle Cloud ARM VM (4 OCPU / 24 GB / 200 GB) | Always free, non-expiring | [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) |
| Google AI Studio API key | 100-1000 RPD depending on model | [aistudio.google.com](https://aistudio.google.com/apikey) |
| Anthropic API key | Pay-as-you-go (~$5-15/mo at 30 apps/day) | [console.anthropic.com](https://console.anthropic.com/) |
| Vercel account | Unlimited hobby projects | [vercel.com](https://vercel.com) |
| GitHub repo + Actions enabled | 2000 min/mo | [github.com](https://github.com) |
| Gmail app password (2FA must be on) | 500 sends/day | [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) |

> **Tip:** Oracle Cloud ARM capacity is sometimes exhausted in popular regions. Try Mumbai / Hyderabad / Singapore first; retry over 2-3 days if "out of capacity."

### 2. Clone + install

```bash
git clone <your-repo> career-autopilot
cd career-autopilot
cp .env.example .env.local
# Fill in .env.local with your actual values from step 1
```

### 3. Hand the repo to Claude Code

Open Claude Code in the repo directory and run:

```
Read CLAUDE.md fully. Confirm the environment prerequisites in §5 are met.
Then begin Phase 1 from docs/build-phases.md. Stop after the phase's
acceptance criteria pass and wait for my approval.
```

Claude Code will:
1. Verify each prerequisite (pausing to ask for anything missing).
2. Scaffold the repo structure.
3. Set up Supabase migrations, Next.js web app, CI, and Vercel deploy.
4. Stop after Phase 1 and report.

Review, approve, and continue phase by phase. There are 11 phases; total solo build time with Claude Code is roughly 4-8 weeks part-time.

### 4. Onboard yourself

After Phase 2 is complete, visit your deployed web app, sign in with your email, and walk through the onboarding wizard. Upload your existing resume, confirm the extracted data, add STAR stories, set preferences. This is the single most important thing you will do in the system — good profile data makes good tailored resumes.

### 5. Enable auto-submit (only after you trust it)

After Phase 8, the system can submit. But `ENABLE_AUTO_SUBMIT=false` is the default — the system will go through every step up to submission and record what it would do, without actually submitting. Leave it off until you've reviewed at least 10 dry-run applications end-to-end.

When you flip it to `true`, start with `DAILY_APPLICATION_CAP=5` for a week. Monitor the manual-review queue and the analytics dashboard. Raise the cap gradually.

---

## Documentation map

- [`CLAUDE.md`](CLAUDE.md) — the contract. Rules for how code gets built.
- [`docs/architecture.md`](docs/architecture.md) — system map, data flow, architectural decisions.
- [`docs/build-phases.md`](docs/build-phases.md) — execution plan; 11 phases with tasks + acceptance criteria.
- [`docs/database-schema.md`](docs/database-schema.md) — full Postgres DDL.
- [`docs/integrations.md`](docs/integrations.md) — ATS endpoint patterns (verified against vendor docs).
- [`docs/llm-routing.md`](docs/llm-routing.md) — model selection, full prompt templates, caching.
- [`docs/runbooks/`](docs/runbooks/) — ops procedures for common incidents.

---

## Repository layout

```
career-autopilot/
├── CLAUDE.md                # The contract
├── README.md                # This file
├── .env.example             # Every env var documented
├── package.json             # pnpm workspace root
├── docker-compose.yml       # Oracle VM worker stack
├── apps/
│   ├── web/                 # Next.js frontend
│   └── extension/           # Plasmo Chrome extension
├── workers/                 # Background workers (Oracle VM)
│   ├── crawler/             # ATS crawler
│   ├── scorer/              # Fit scorer
│   ├── tailor/              # Resume tailor + render
│   ├── verifier/            # ATS parser ensemble
│   ├── submitter/           # Application submitter
│   └── follow-up/           # Follow-up emails
├── packages/                # Shared code
│   ├── shared/              # Types, schemas, constants
│   ├── db/                  # Supabase client + generated types
│   ├── llm/                 # LLM router + prompts
│   ├── ats/                 # ATS detection + adapters
│   ├── resume/              # Tailor, render, verify
│   └── parsers/             # Resume parser wrappers
├── supabase/
│   ├── migrations/          # SQL migrations
│   ├── functions/           # Edge Functions
│   └── seed.sql
├── docs/                    # All system docs
└── scripts/                 # One-off tools
```

---

## Contributing

This is a personal project — no PRs from strangers. If you fork it for your own use, good. Respect the honesty constraint: don't let your resume claim things you can't defend in an interview. That's the difference between a useful tool and a liability.

---

## License

MIT, for code. Your resume content and any data generated about you is yours alone.