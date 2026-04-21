# Database Schema — Career Autopilot

Complete Postgres DDL for every table in the system. Organized by phase. Apply via Supabase migrations; never run DDL directly on a project with real data.

**Conventions:**
- Every user-scoped table has a `user_id uuid not null references auth.users(id) on delete cascade` column.
- Every table has `created_at timestamptz not null default now()` and `updated_at timestamptz not null default now()`.
- Timestamps use `timestamptz` always. Never `timestamp`.
- Soft deletes use `deleted_at timestamptz` where needed; most tables hard-delete on cascade.
- RLS is enabled on every user-scoped table with a policy allowing `auth.uid() = user_id` on SELECT, INSERT, UPDATE, DELETE.
- Surrogate primary keys: `id uuid default gen_random_uuid() primary key`. Natural keys are additional `unique` constraints.
- JSON columns use `jsonb`, never `json`.
- Enums are Postgres-native (`create type ... as enum`) not strings, because we want the DB to enforce validity.

**Extensions to enable (in the first migration):**
```sql
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";       -- pgvector for embeddings
create extension if not exists "pg_cron";      -- scheduling
create extension if not exists "pgmq";         -- message queue
```

**Updated-at trigger** (used by every table):
```sql
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
```

Attach with:
```sql
create trigger trg_<table>_updated_at before update on <table>
  for each row execute function set_updated_at();
```

---

## §1 — Core (Phase 1)

```sql
-- Extend auth.users with profile metadata
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Kolkata',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "user_profiles_select_own" on public.user_profiles
  for select using (auth.uid() = user_id);
create policy "user_profiles_insert_own" on public.user_profiles
  for insert with check (auth.uid() = user_id);
create policy "user_profiles_update_own" on public.user_profiles
  for update using (auth.uid() = user_id);

create trigger trg_user_profiles_updated_at before update on public.user_profiles
  for each row execute function set_updated_at();
```

Auto-create a `user_profiles` row on signup:
```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (user_id, display_name)
  values (new.id, new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

---

## §2 — Master profile (Phase 2)

```sql
-- Enums
create type experience_level as enum ('intern', 'entry', 'mid', 'senior', 'lead', 'principal');
create type work_mode as enum ('remote', 'hybrid', 'onsite');
create type job_type as enum ('full_time', 'part_time', 'contract', 'internship', 'freelance');
create type skill_category as enum ('language', 'framework', 'tool', 'domain', 'soft', 'certification', 'database', 'cloud');
create type story_dimension as enum (
  'leadership', 'conflict', 'failure', 'ambiguity', 'ownership',
  'influence', 'learning', 'metric_win', 'teamwork', 'customer_focus'
);

-- Main profile table (one row per user)
create table public.profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  location text,
  linkedin_url text,
  github_url text,
  portfolio_url text,
  headline text,
  summary text,
  derived_summary text,                      -- LLM-generated, privacy-safe
  summary_embedding vector(768),             -- Gemini text-embedding-004 dimension
  visa_status text,
  work_authorization text[],
  years_experience numeric(4,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
-- RLS policies (same pattern for every user-scoped table) -- omitted for brevity below; apply the standard four policies to each table.

create index idx_profiles_embedding on public.profiles
  using ivfflat (summary_embedding vector_cosine_ops) with (lists = 10);

-- Experiences
create table public.experiences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company text not null,
  title text not null,
  location text,
  work_mode work_mode,
  start_date date not null,
  end_date date,                             -- null = current
  is_current boolean generated always as (end_date is null) stored,
  description text,
  tech_stack text[],
  ord int not null default 0,                -- display order
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_experiences_user on public.experiences(user_id, ord);
alter table public.experiences enable row level security;

-- Bullets (the atomic unit of achievement)
create table public.experience_bullets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  experience_id uuid not null references public.experiences(id) on delete cascade,
  text text not null,
  metrics jsonb,                             -- {"revenue_usd": 180000, "improvement_pct": 22}
  skill_tags text[],                         -- ['typescript','react','supabase']
  story_id uuid,                             -- optional link to a STAR story
  ord int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Alternate phrasings for A/B testing
create table public.bullet_variants (
  id uuid default gen_random_uuid() primary key,
  bullet_id uuid not null references public.experience_bullets(id) on delete cascade,
  text text not null,
  emphasis_tags text[],                      -- what this phrasing emphasizes
  created_at timestamptz not null default now()
);

-- Projects (separate from experiences; think hackathons, personal work)
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  role text,
  start_date date,
  end_date date,
  description text,
  tech_stack text[],
  url text,
  metrics jsonb,
  skill_tags text[],
  ord int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Skills (the master list)
create table public.skills (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category skill_category not null,
  proficiency int check (proficiency between 1 and 5),
  years_experience numeric(3,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index idx_skills_user_category on public.skills(user_id, category);

-- Education
create table public.education (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  institution text not null,
  degree text,
  field text,
  start_date date,
  end_date date,
  gpa numeric(4,2),
  coursework text[],
  honors text[],
  ord int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- STAR stories
create table public.stories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  dimensions story_dimension[] not null,
  title text not null,
  situation text not null,
  task text not null,
  action text not null,
  result text not null,
  reflection text,
  linked_experience_id uuid references public.experiences(id),
  linked_project_id uuid references public.projects(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_stories_dimensions on public.stories using gin (dimensions);

-- Preferences (one row per user)
create table public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  experience_levels experience_level[] not null default '{}',
  work_modes work_mode[] not null default '{remote,hybrid}',
  job_types job_type[] not null default '{full_time}',
  salary_min numeric(12,2),
  salary_max numeric(12,2),
  salary_currency text not null default 'USD',
  locations text[],
  remote_anywhere boolean not null default false,
  industries_include text[],
  industries_exclude text[],
  company_size_min int,
  company_size_max int,
  notice_period_days int,
  willing_to_relocate boolean not null default false,
  daily_app_cap int not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Question bank
create table public.question_bank (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_key text not null,                 -- stable identifier: 'tell_me_about_yourself'
  question_text text not null,
  answer_text text not null,
  word_limit int,
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_key)
);

-- Audit trail for every profile change (for debugging downstream tailor misfires)
create table public.profile_audit (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,                  -- 'experience' | 'bullet' | 'skill' | ...
  entity_id uuid not null,
  action text not null,                       -- 'insert' | 'update' | 'delete'
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
```

Enable RLS and attach updated_at triggers to every table above.

---

## §3 — Job discovery (Phase 3)

```sql
create type ats_type as enum ('greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'custom');
create type job_status as enum ('new', 'scored', 'pending_review', 'needs_decision', 'low_fit', 'queued', 'submitted', 'responded', 'interviewing', 'offered', 'rejected', 'closed', 'stale');

-- Companies are shared across users (jobs data is public)
create table public.companies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  ats_type ats_type not null,
  ats_slug text not null,                     -- the identifier used in API URLs
  careers_url text,
  website text,
  industry text,
  size_min int,
  size_max int,
  research_pack jsonb,                         -- recent news, blog posts
  last_crawled_at timestamptz,
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ats_type, ats_slug)
);

-- Jobs (not user-scoped; shared data)
create table public.jobs (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  external_id text not null,                   -- id in the ATS
  title text not null,
  normalized_title text,                       -- lowercase, trimmed, common words removed
  location text,
  remote_policy work_mode,
  description text not null,
  description_hash text not null,              -- sha256; detect content changes
  salary_min numeric(12,2),
  salary_max numeric(12,2),
  salary_currency text,
  apply_url text not null,
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'active',       -- 'active' | 'closed'
  canonical_job_id uuid references public.jobs(id),  -- for dedup; null = canonical
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, external_id)
);

create index idx_jobs_company on public.jobs(company_id);
create index idx_jobs_status on public.jobs(status);
create index idx_jobs_posted on public.jobs(posted_at desc);
create index idx_jobs_title_trgm on public.jobs using gin (normalized_title gin_trgm_ops);
-- Requires: create extension pg_trgm;

-- Track ingestion runs
create table public.job_crawl_runs (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references public.companies(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  jobs_found int,
  jobs_new int,
  jobs_updated int,
  error text
);
```

---

## §4 — Fit scoring (Phase 4)

```sql
create table public.job_embeddings (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  jd_embedding vector(768) not null,
  parsed_jd jsonb not null,                    -- {must_have_skills, nice_to_have_skills, ...}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_job_embeddings_vec on public.job_embeddings
  using ivfflat (jd_embedding vector_cosine_ops) with (lists = 100);

-- Scores are per (user, job) since preferences differ per user
create table public.job_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_version_hash text not null,          -- so we recompute only when profile changed
  hard_filter_pass boolean not null,
  hard_filter_reasons text[],
  semantic_score numeric(4,3),                 -- 0.000-1.000
  overall_score int,                           -- 0-100
  dimensions jsonb,                            -- {skills, experience, domain, seniority, logistics}
  must_have_gaps text[],
  judge_reasoning text,
  tier text not null check (tier in ('auto_apply','pending_review','needs_decision','low_fit','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index idx_job_scores_user_tier on public.job_scores(user_id, tier, overall_score desc);
```

---

## §5 — Resume tailor (Phase 5)

```sql
create table public.tailored_resumes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_version_hash text not null,
  prompt_version text not null,                -- 'v1', 'v2' — which tailor prompt
  llm_model text not null,                     -- 'claude-haiku-4-5', etc.
  resume_json jsonb not null,                  -- the structured TailoredResume
  pdf_url text,                                -- Supabase Storage path
  docx_url text,
  honesty_check_passed boolean not null,
  honesty_violations text[],
  regeneration_count int not null default 0,
  tokens_in int,
  tokens_out int,
  cost_usd numeric(10,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tailored_resumes_user_job on public.tailored_resumes(user_id, job_id, created_at desc);
```

---

## §6 — ATS verifier (Phase 6)

```sql
create table public.verifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tailored_resume_id uuid not null references public.tailored_resumes(id) on delete cascade,
  overall_score int not null,                  -- 0-100
  parse_agreement_score int not null,
  keyword_coverage_score int not null,
  format_compliance_score int not null,
  parser_results jsonb not null,               -- {pyresparser: {...}, openresume: {...}, simple: {...}}
  missing_keywords text[],
  format_issues text[],
  passed boolean not null,                     -- overall_score >= threshold
  created_at timestamptz not null default now()
);

create index idx_verifications_resume on public.verifications(tailored_resume_id, created_at desc);
```

---

## §7 — Cover letter + Q&A (Phase 7)

```sql
create table public.cover_letters (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tailored_resume_id uuid not null references public.tailored_resumes(id) on delete cascade,
  prompt_version text not null,
  llm_model text not null,
  greeting text,
  body text not null,
  signoff text,
  word_count int,
  honesty_check_passed boolean not null,
  tokens_in int,
  tokens_out int,
  cost_usd numeric(10,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.question_answers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  tailored_resume_id uuid references public.tailored_resumes(id),
  question_hash text not null,                 -- sha256 of normalized question
  question_text text not null,
  question_type text not null,
  word_limit int,
  answer_text text not null,
  source text not null,                        -- 'cache' | 'generated'
  confidence numeric(3,2),
  consistency_check_passed boolean,
  consistency_violations text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id, question_hash)
);

create table public.answer_cache (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_hash text not null,
  question_text text not null,
  answer_text text not null,
  context_fingerprint text,                     -- when to invalidate
  hit_count int not null default 0,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_hash)
);

create index idx_answer_cache_user_hash on public.answer_cache(user_id, question_hash);
```

---

## §8 — Submission (Phase 8)

```sql
create type submit_method as enum ('ats_api', 'playwright', 'manual');
create type submit_status as enum ('queued', 'in_progress', 'succeeded', 'failed', 'skipped');

create table public.submissions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  tailored_resume_id uuid not null references public.tailored_resumes(id) on delete cascade,
  cover_letter_id uuid references public.cover_letters(id),
  method submit_method not null,
  status submit_status not null default 'queued',
  submitted_at timestamptz,
  external_confirmation_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table public.submission_attempts (
  id uuid default gen_random_uuid() primary key,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  attempt_number int not null,
  method submit_method not null,
  success boolean not null,
  request_payload jsonb,                        -- scrubbed of secrets
  response_payload jsonb,
  screenshots text[],                           -- Supabase Storage paths
  error_message text,
  error_stack text,
  duration_ms int,
  created_at timestamptz not null default now()
);

create table public.manual_review_queue (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  reason text not null,                         -- 'captcha' | 'sso' | 'selector_missing' | 'user_tier'
  context jsonb,                                -- last state before bailing
  screenshots text[],
  resolved_at timestamptz,
  resolution text,                              -- 'submitted_manually' | 'abandoned'
  created_at timestamptz not null default now()
);
```

---

## §9 — Outcomes (Phase 9)

```sql
create type outcome_type as enum (
  'submitted', 'acknowledged', 'callback', 'rejection',
  'interview_invite', 'interview_completed', 'offer', 'declined', 'accepted', 'ghosted'
);

create table public.outcomes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  stage outcome_type not null,
  reached_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_outcomes_user_stage on public.outcomes(user_id, stage);
create index idx_outcomes_submission on public.outcomes(submission_id, reached_at);

create table public.outcome_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  source text not null,                         -- 'email' | 'manual' | 'inferred'
  outcome_type outcome_type not null,
  confidence numeric(3,2),
  payload jsonb,
  created_at timestamptz not null default now()
);
```

---

## §10 — Ops tables (Phase 11)

```sql
-- Simple KV store for rate-limiter tokens, feature flags, etc.
create table public.kv_store (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Every LLM call recorded for cost tracking
create table public.llm_calls (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,                       -- 'anthropic' | 'gemini' | 'openai'
  model text not null,
  task text not null,                           -- 'tailor' | 'cover_letter' | 'judge' | ...
  prompt_version text,
  tokens_in int not null,
  tokens_out int not null,
  cached_tokens int not null default 0,
  cost_usd numeric(10,6) not null,
  latency_ms int,
  success boolean not null,
  error_code text,
  created_at timestamptz not null default now()
);

create index idx_llm_calls_user_time on public.llm_calls(user_id, created_at desc);
create index idx_llm_calls_task_time on public.llm_calls(task, created_at desc);

-- Aggregated nightly by pg_cron
create table public.daily_cost_summary (
  day date not null,
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null,
  model text not null,
  task text not null,
  total_tokens_in bigint not null,
  total_tokens_out bigint not null,
  total_cost_usd numeric(12,4) not null,
  call_count int not null,
  primary key (day, user_id, provider, model, task)
);
```

---

## Queues (pgmq)

Create these queues in the initial Phase 3 migration:

```sql
select pgmq.create('crawl_jobs');
select pgmq.create('score_jobs');
select pgmq.create('tailor_jobs');
select pgmq.create('verify_jobs');
select pgmq.create('submit_jobs');
select pgmq.create('follow_up_jobs');
```

Each queue has a matching DLQ (`_dlq` suffix) created automatically when a worker moves a permanently-failed message there.

---

## Scheduled jobs (pg_cron)

```sql
-- Nightly cost rollup
select cron.schedule('daily_cost_rollup', '0 1 * * *', $$
  insert into public.daily_cost_summary (day, user_id, provider, model, task, total_tokens_in, total_tokens_out, total_cost_usd, call_count)
  select current_date - 1, user_id, provider, model, task,
         sum(tokens_in), sum(tokens_out), sum(cost_usd), count(*)
  from public.llm_calls
  where created_at >= current_date - 1 and created_at < current_date
  group by user_id, provider, model, task
  on conflict (day, user_id, provider, model, task) do nothing;
$$);

-- Stale-job cleanup: jobs not seen in 30 days become 'closed'
select cron.schedule('stale_jobs_cleanup', '0 2 * * *', $$
  update public.jobs set status = 'closed', updated_at = now()
  where status = 'active' and last_seen_at < now() - interval '30 days';
$$);

-- Weekly: re-score jobs whose profile has updated since their last score
-- (triggered by enqueueing score_jobs messages; actual worker does the work)
```

---

## Standard RLS policy block

Apply this four-policy pattern to every user-scoped table. Replace `<table>` with the table name:

```sql
alter table public.<table> enable row level security;

create policy "<table>_select_own" on public.<table>
  for select using (auth.uid() = user_id);
create policy "<table>_insert_own" on public.<table>
  for insert with check (auth.uid() = user_id);
create policy "<table>_update_own" on public.<table>
  for update using (auth.uid() = user_id);
create policy "<table>_delete_own" on public.<table>
  for delete using (auth.uid() = user_id);
```

For shared-data tables (`companies`, `jobs`, `job_embeddings`, `job_crawl_runs`, `kv_store`), use a "service-role-only write, authenticated read" pattern:

```sql
alter table public.<table> enable row level security;
create policy "<table>_read_authenticated" on public.<table>
  for select to authenticated using (true);
-- Writes only via service role key (which bypasses RLS)
```

---

## Type generation

After every migration, regenerate the TS types:

```bash
pnpm db:types
# which runs:
# supabase gen types typescript --project-id <project-id> > packages/db/src/types/database.ts
```

Commit the generated file. Never edit it by hand.

---

## Rationale for key choices

- **Shared `jobs` and `companies`** (not user-scoped): jobs data is public. Sharing across users (if ever multi-tenant) massively reduces crawling cost.
- **`job_scores` is user-scoped**: same job scores differently per user (different preferences, different profile).
- **`profile_version_hash`**: we hash the profile state at scoring/tailoring time so we know when to invalidate cached outputs. Cheaper than full change-detection.
- **`description_hash` on jobs**: detects content changes without expensive diff.
- **Everything is a UUID**: no sequential IDs exposed. Even if the app were made public later, no enumeration attacks.
- **pgvector with `ivfflat`**: fast nearest-neighbor for the small scale here. Switch to `hnsw` only if scale exceeds ~100k jobs.
- **Enums, not strings**: DB enforces the valid value set. Zod schemas mirror the enums.

---

## Migration ordering

Run migrations in this order (timestamps chosen so they apply in sequence):

```
20250101000000_init.sql                      # extensions + user_profiles + updated_at fn
20250101000100_profile_domain.sql            # §2
20250101000200_job_discovery.sql             # §3
20250101000300_fit_scoring.sql               # §4
20250101000400_tailor.sql                    # §5
20250101000500_verifier.sql                  # §6
20250101000600_cover_letter_qa.sql           # §7
20250101000700_submission.sql                # §8
20250101000800_outcomes.sql                  # §9
20250101000900_ops.sql                       # §10 + queues + cron
```

Each phase's first task is to create its corresponding migration file. Never squash migrations after they've been applied to production.