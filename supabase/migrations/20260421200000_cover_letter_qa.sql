-- Phase 7 — Cover letter + Q&A.
-- Source of truth: docs/database-schema.md §7.

-- ============================================================
-- cover_letters
-- ============================================================
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

create index idx_cover_letters_resume
  on public.cover_letters(tailored_resume_id, created_at desc);

alter table public.cover_letters enable row level security;

create policy "cover_letters_select_own" on public.cover_letters
  for select using (auth.uid() = user_id);
create policy "cover_letters_insert_own" on public.cover_letters
  for insert with check (auth.uid() = user_id);
create policy "cover_letters_update_own" on public.cover_letters
  for update using (auth.uid() = user_id);
create policy "cover_letters_delete_own" on public.cover_letters
  for delete using (auth.uid() = user_id);

create trigger trg_cover_letters_updated_at before update on public.cover_letters
  for each row execute function set_updated_at();

-- ============================================================
-- question_answers
-- ============================================================
create table public.question_answers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  tailored_resume_id uuid references public.tailored_resumes(id),
  question_hash text not null,
  question_text text not null,
  question_type text not null,
  word_limit int,
  answer_text text not null,
  source text not null,
  confidence numeric(3,2),
  consistency_check_passed boolean,
  consistency_violations text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id, question_hash)
);

create index idx_question_answers_user_job
  on public.question_answers(user_id, job_id);

alter table public.question_answers enable row level security;

create policy "question_answers_select_own" on public.question_answers
  for select using (auth.uid() = user_id);
create policy "question_answers_insert_own" on public.question_answers
  for insert with check (auth.uid() = user_id);
create policy "question_answers_update_own" on public.question_answers
  for update using (auth.uid() = user_id);
create policy "question_answers_delete_own" on public.question_answers
  for delete using (auth.uid() = user_id);

create trigger trg_question_answers_updated_at before update on public.question_answers
  for each row execute function set_updated_at();

-- ============================================================
-- answer_cache
-- ============================================================
create table public.answer_cache (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_hash text not null,
  question_text text not null,
  answer_text text not null,
  context_fingerprint text,
  hit_count int not null default 0,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_hash)
);

create index idx_answer_cache_user_hash
  on public.answer_cache(user_id, question_hash);

alter table public.answer_cache enable row level security;

create policy "answer_cache_select_own" on public.answer_cache
  for select using (auth.uid() = user_id);
create policy "answer_cache_insert_own" on public.answer_cache
  for insert with check (auth.uid() = user_id);
create policy "answer_cache_update_own" on public.answer_cache
  for update using (auth.uid() = user_id);
create policy "answer_cache_delete_own" on public.answer_cache
  for delete using (auth.uid() = user_id);

create trigger trg_answer_cache_updated_at before update on public.answer_cache
  for each row execute function set_updated_at();
