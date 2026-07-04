-- Phase 4 — Fit scoring.
-- Source of truth: docs/database-schema.md §4.
-- job_embeddings is shared (like jobs); job_scores is user-scoped.

-- ============================================================
-- job_embeddings — one row per job
-- ============================================================
create table public.job_embeddings (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  jd_embedding vector(768) not null,
  parsed_jd jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_job_embeddings_vec on public.job_embeddings
  using ivfflat (jd_embedding vector_cosine_ops) with (lists = 100);

alter table public.job_embeddings enable row level security;

create policy "job_embeddings_read_authenticated" on public.job_embeddings
  for select to authenticated using (true);

create trigger trg_job_embeddings_updated_at before update on public.job_embeddings
  for each row execute function set_updated_at();

-- ============================================================
-- job_scores — per (user, job)
-- ============================================================
create table public.job_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_version_hash text not null,
  hard_filter_pass boolean not null,
  hard_filter_reasons text[],
  semantic_score numeric(4,3),
  overall_score int,
  dimensions jsonb,
  must_have_gaps text[],
  judge_reasoning text,
  tier text not null check (tier in ('auto_apply', 'pending_review', 'needs_decision', 'low_fit', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index idx_job_scores_user_tier on public.job_scores(user_id, tier, overall_score desc);

alter table public.job_scores enable row level security;

create policy "job_scores_select_own" on public.job_scores
  for select using (auth.uid() = user_id);
create policy "job_scores_insert_own" on public.job_scores
  for insert with check (auth.uid() = user_id);
create policy "job_scores_update_own" on public.job_scores
  for update using (auth.uid() = user_id);
create policy "job_scores_delete_own" on public.job_scores
  for delete using (auth.uid() = user_id);

create trigger trg_job_scores_updated_at before update on public.job_scores
  for each row execute function set_updated_at();
