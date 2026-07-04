-- Phase 5 — Resume tailor + render.
-- Source of truth: docs/database-schema.md §5.

create table public.tailored_resumes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_version_hash text not null,
  prompt_version text not null,
  llm_model text not null,
  resume_json jsonb not null,
  pdf_url text,
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

create index idx_tailored_resumes_user_job
  on public.tailored_resumes(user_id, job_id, created_at desc);

alter table public.tailored_resumes enable row level security;

create policy "tailored_resumes_select_own" on public.tailored_resumes
  for select using (auth.uid() = user_id);
create policy "tailored_resumes_insert_own" on public.tailored_resumes
  for insert with check (auth.uid() = user_id);
create policy "tailored_resumes_update_own" on public.tailored_resumes
  for update using (auth.uid() = user_id);
create policy "tailored_resumes_delete_own" on public.tailored_resumes
  for delete using (auth.uid() = user_id);

create trigger trg_tailored_resumes_updated_at before update on public.tailored_resumes
  for each row execute function set_updated_at();
