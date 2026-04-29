-- Phase 8 — Submission.
-- Source of truth: docs/database-schema.md §8.

create type submit_method as enum ('ats_api', 'playwright', 'manual');
create type submit_status as enum ('queued', 'in_progress', 'succeeded', 'failed', 'skipped');

-- ============================================================
-- submissions — one row per (user, job) attempt
-- ============================================================
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

create index idx_submissions_user_status
  on public.submissions(user_id, status, created_at desc);

alter table public.submissions enable row level security;

create policy "submissions_select_own" on public.submissions
  for select using (auth.uid() = user_id);
create policy "submissions_insert_own" on public.submissions
  for insert with check (auth.uid() = user_id);
create policy "submissions_update_own" on public.submissions
  for update using (auth.uid() = user_id);
create policy "submissions_delete_own" on public.submissions
  for delete using (auth.uid() = user_id);

create trigger trg_submissions_updated_at before update on public.submissions
  for each row execute function set_updated_at();

-- ============================================================
-- submission_attempts — append-only log of every try
-- ============================================================
create table public.submission_attempts (
  id uuid default gen_random_uuid() primary key,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  attempt_number int not null,
  method submit_method not null,
  success boolean not null,
  request_payload jsonb,
  response_payload jsonb,
  screenshots text[],
  error_message text,
  error_stack text,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index idx_submission_attempts_submission
  on public.submission_attempts(submission_id, attempt_number);

alter table public.submission_attempts enable row level security;

-- Read via parent submission's owner. Writes via service role.
create policy "submission_attempts_select_via_parent" on public.submission_attempts
  for select using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_attempts.submission_id and s.user_id = auth.uid()
    )
  );

-- ============================================================
-- manual_review_queue
-- ============================================================
create table public.manual_review_queue (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  reason text not null,
  context jsonb,
  screenshots text[],
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz not null default now()
);

create index idx_manual_review_queue_user_open
  on public.manual_review_queue(user_id, resolved_at)
  where resolved_at is null;

alter table public.manual_review_queue enable row level security;

create policy "manual_review_queue_select_own" on public.manual_review_queue
  for select using (auth.uid() = user_id);
create policy "manual_review_queue_update_own" on public.manual_review_queue
  for update using (auth.uid() = user_id);
