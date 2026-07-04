-- Phase 6 — ATS verifier.
-- Source of truth: docs/database-schema.md §6.

create table public.verifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tailored_resume_id uuid not null references public.tailored_resumes(id) on delete cascade,
  overall_score int not null,
  parse_agreement_score int not null,
  keyword_coverage_score int not null,
  format_compliance_score int not null,
  parser_results jsonb not null,
  missing_keywords text[],
  format_issues text[],
  passed boolean not null,
  created_at timestamptz not null default now()
);

create index idx_verifications_resume
  on public.verifications(tailored_resume_id, created_at desc);

alter table public.verifications enable row level security;

create policy "verifications_select_own" on public.verifications
  for select using (auth.uid() = user_id);
create policy "verifications_insert_own" on public.verifications
  for insert with check (auth.uid() = user_id);
create policy "verifications_delete_own" on public.verifications
  for delete using (auth.uid() = user_id);
