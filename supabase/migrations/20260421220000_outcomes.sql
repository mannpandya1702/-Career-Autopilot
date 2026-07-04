-- Phase 9 — Outcomes.
-- Source of truth: docs/database-schema.md §9.

create type outcome_type as enum (
  'submitted',
  'acknowledged',
  'callback',
  'rejection',
  'interview_invite',
  'interview_completed',
  'offer',
  'declined',
  'accepted',
  'ghosted'
);

-- ============================================================
-- outcomes — current funnel stage per submission
-- ============================================================
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

alter table public.outcomes enable row level security;

create policy "outcomes_select_own" on public.outcomes
  for select using (auth.uid() = user_id);
create policy "outcomes_insert_own" on public.outcomes
  for insert with check (auth.uid() = user_id);
create policy "outcomes_update_own" on public.outcomes
  for update using (auth.uid() = user_id);
create policy "outcomes_delete_own" on public.outcomes
  for delete using (auth.uid() = user_id);

-- ============================================================
-- outcome_events — append-only stream of inbound signals
-- ============================================================
create table public.outcome_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  source text not null,
  outcome_type outcome_type not null,
  confidence numeric(3,2),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index idx_outcome_events_user on public.outcome_events(user_id, created_at desc);

alter table public.outcome_events enable row level security;

create policy "outcome_events_select_own" on public.outcome_events
  for select using (auth.uid() = user_id);
create policy "outcome_events_insert_own" on public.outcome_events
  for insert with check (auth.uid() = user_id);
