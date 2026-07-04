-- Phase 3 — Job discovery.
-- Source of truth: docs/database-schema.md §3.
-- Companies and jobs are SHARED across users (not user-scoped) because job data
-- is public and we want to dedup crawler work. Reads are authenticated-only;
-- writes go through the service role (bypasses RLS).

-- pg_trgm for fuzzy title matching in the dedup pass.
create extension if not exists "pg_trgm";

-- ============================================================
-- Enums
-- ============================================================
create type ats_type as enum ('greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'custom');
create type job_status as enum (
  'new',
  'scored',
  'pending_review',
  'needs_decision',
  'low_fit',
  'queued',
  'submitted',
  'responded',
  'interviewing',
  'offered',
  'rejected',
  'closed',
  'stale'
);

-- ============================================================
-- companies (shared; service-role writes, authenticated reads)
-- ============================================================
create table public.companies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  ats_type ats_type not null,
  ats_slug text not null,
  careers_url text,
  website text,
  industry text,
  size_min int,
  size_max int,
  research_pack jsonb,
  last_crawled_at timestamptz,
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ats_type, ats_slug)
);

create index idx_companies_ats on public.companies(ats_type, priority desc);

alter table public.companies enable row level security;

create policy "companies_read_authenticated" on public.companies
  for select to authenticated using (true);

create trigger trg_companies_updated_at before update on public.companies
  for each row execute function set_updated_at();

-- ============================================================
-- jobs (shared; stable hash-based dedup)
-- ============================================================
create table public.jobs (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  external_id text not null,
  title text not null,
  normalized_title text,
  location text,
  remote_policy work_mode,
  description text not null,
  description_hash text not null,
  salary_min numeric(12,2),
  salary_max numeric(12,2),
  salary_currency text,
  apply_url text not null,
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'active',
  canonical_job_id uuid references public.jobs(id),
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, external_id)
);

create index idx_jobs_company on public.jobs(company_id);
create index idx_jobs_status on public.jobs(status);
create index idx_jobs_posted on public.jobs(posted_at desc);
create index idx_jobs_last_seen on public.jobs(last_seen_at desc);
create index idx_jobs_title_trgm on public.jobs using gin (normalized_title gin_trgm_ops);

alter table public.jobs enable row level security;

create policy "jobs_read_authenticated" on public.jobs
  for select to authenticated using (true);

create trigger trg_jobs_updated_at before update on public.jobs
  for each row execute function set_updated_at();

-- ============================================================
-- job_crawl_runs (audit of crawler activity)
-- ============================================================
create table public.job_crawl_runs (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references public.companies(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  jobs_found int,
  jobs_new int,
  jobs_updated int,
  error text
);

create index idx_job_crawl_runs_company on public.job_crawl_runs(company_id, started_at desc);

alter table public.job_crawl_runs enable row level security;

create policy "job_crawl_runs_read_authenticated" on public.job_crawl_runs
  for select to authenticated using (true);

-- ============================================================
-- pgmq queues (per docs/database-schema.md "Queues" section)
-- pgmq.create is idempotent, but guard with a DO block for safety.
-- ============================================================
do $$
begin
  perform pgmq.create('crawl_jobs');
  perform pgmq.create('score_jobs');
  perform pgmq.create('tailor_jobs');
  perform pgmq.create('verify_jobs');
  perform pgmq.create('submit_jobs');
  perform pgmq.create('follow_up_jobs');
  perform pgmq.create('profile_embed_jobs');
exception
  when undefined_function then
    raise notice 'pgmq not installed; skipping queue creation (dev-only path)';
end $$;
