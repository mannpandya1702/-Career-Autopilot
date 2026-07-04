-- Phase 2 — Master profile domain.
-- Source of truth: docs/database-schema.md §2.
-- Every user-scoped table gets RLS (select/insert/update/delete own) + updated_at trigger.

-- ============================================================
-- Enums
-- ============================================================
create type experience_level as enum ('intern', 'entry', 'mid', 'senior', 'lead', 'principal');
create type work_mode as enum ('remote', 'hybrid', 'onsite');
create type job_type as enum ('full_time', 'part_time', 'contract', 'internship', 'freelance');
create type skill_category as enum ('language', 'framework', 'tool', 'domain', 'soft', 'certification', 'database', 'cloud');
create type story_dimension as enum (
  'leadership', 'conflict', 'failure', 'ambiguity', 'ownership',
  'influence', 'learning', 'metric_win', 'teamwork', 'customer_focus'
);

-- ============================================================
-- profiles (one row per user)
-- ============================================================
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
  derived_summary text,
  summary_embedding vector(768),
  visa_status text,
  work_authorization text[],
  years_experience numeric(4,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function set_updated_at();

create index idx_profiles_embedding on public.profiles
  using ivfflat (summary_embedding vector_cosine_ops) with (lists = 10);

-- ============================================================
-- experiences
-- ============================================================
create table public.experiences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company text not null,
  title text not null,
  location text,
  work_mode work_mode,
  start_date date not null,
  end_date date,
  is_current boolean generated always as (end_date is null) stored,
  description text,
  tech_stack text[],
  ord int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_experiences_user on public.experiences(user_id, ord);

alter table public.experiences enable row level security;

create policy "experiences_select_own" on public.experiences
  for select using (auth.uid() = user_id);
create policy "experiences_insert_own" on public.experiences
  for insert with check (auth.uid() = user_id);
create policy "experiences_update_own" on public.experiences
  for update using (auth.uid() = user_id);
create policy "experiences_delete_own" on public.experiences
  for delete using (auth.uid() = user_id);

create trigger trg_experiences_updated_at before update on public.experiences
  for each row execute function set_updated_at();

-- ============================================================
-- experience_bullets
-- ============================================================
create table public.experience_bullets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  experience_id uuid not null references public.experiences(id) on delete cascade,
  text text not null,
  metrics jsonb,
  skill_tags text[],
  story_id uuid,
  ord int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_experience_bullets_exp on public.experience_bullets(experience_id, ord);

alter table public.experience_bullets enable row level security;

create policy "experience_bullets_select_own" on public.experience_bullets
  for select using (auth.uid() = user_id);
create policy "experience_bullets_insert_own" on public.experience_bullets
  for insert with check (auth.uid() = user_id);
create policy "experience_bullets_update_own" on public.experience_bullets
  for update using (auth.uid() = user_id);
create policy "experience_bullets_delete_own" on public.experience_bullets
  for delete using (auth.uid() = user_id);

create trigger trg_experience_bullets_updated_at before update on public.experience_bullets
  for each row execute function set_updated_at();

-- ============================================================
-- bullet_variants (owned via parent bullet; RLS via join)
-- ============================================================
create table public.bullet_variants (
  id uuid default gen_random_uuid() primary key,
  bullet_id uuid not null references public.experience_bullets(id) on delete cascade,
  text text not null,
  emphasis_tags text[],
  created_at timestamptz not null default now()
);

create index idx_bullet_variants_bullet on public.bullet_variants(bullet_id);

alter table public.bullet_variants enable row level security;

create policy "bullet_variants_select_via_bullet" on public.bullet_variants
  for select using (
    exists (
      select 1 from public.experience_bullets b
      where b.id = bullet_variants.bullet_id and b.user_id = auth.uid()
    )
  );
create policy "bullet_variants_insert_via_bullet" on public.bullet_variants
  for insert with check (
    exists (
      select 1 from public.experience_bullets b
      where b.id = bullet_variants.bullet_id and b.user_id = auth.uid()
    )
  );
create policy "bullet_variants_update_via_bullet" on public.bullet_variants
  for update using (
    exists (
      select 1 from public.experience_bullets b
      where b.id = bullet_variants.bullet_id and b.user_id = auth.uid()
    )
  );
create policy "bullet_variants_delete_via_bullet" on public.bullet_variants
  for delete using (
    exists (
      select 1 from public.experience_bullets b
      where b.id = bullet_variants.bullet_id and b.user_id = auth.uid()
    )
  );

-- ============================================================
-- projects
-- ============================================================
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

create index idx_projects_user on public.projects(user_id, ord);

alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id);
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);

create trigger trg_projects_updated_at before update on public.projects
  for each row execute function set_updated_at();

-- ============================================================
-- skills
-- ============================================================
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

alter table public.skills enable row level security;

create policy "skills_select_own" on public.skills
  for select using (auth.uid() = user_id);
create policy "skills_insert_own" on public.skills
  for insert with check (auth.uid() = user_id);
create policy "skills_update_own" on public.skills
  for update using (auth.uid() = user_id);
create policy "skills_delete_own" on public.skills
  for delete using (auth.uid() = user_id);

create trigger trg_skills_updated_at before update on public.skills
  for each row execute function set_updated_at();

-- ============================================================
-- education
-- ============================================================
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

create index idx_education_user on public.education(user_id, ord);

alter table public.education enable row level security;

create policy "education_select_own" on public.education
  for select using (auth.uid() = user_id);
create policy "education_insert_own" on public.education
  for insert with check (auth.uid() = user_id);
create policy "education_update_own" on public.education
  for update using (auth.uid() = user_id);
create policy "education_delete_own" on public.education
  for delete using (auth.uid() = user_id);

create trigger trg_education_updated_at before update on public.education
  for each row execute function set_updated_at();

-- ============================================================
-- stories (STAR)
-- ============================================================
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

alter table public.stories enable row level security;

create policy "stories_select_own" on public.stories
  for select using (auth.uid() = user_id);
create policy "stories_insert_own" on public.stories
  for insert with check (auth.uid() = user_id);
create policy "stories_update_own" on public.stories
  for update using (auth.uid() = user_id);
create policy "stories_delete_own" on public.stories
  for delete using (auth.uid() = user_id);

create trigger trg_stories_updated_at before update on public.stories
  for each row execute function set_updated_at();

-- Now that stories exists, add the FK from experience_bullets.story_id
alter table public.experience_bullets
  add constraint experience_bullets_story_id_fkey
  foreign key (story_id) references public.stories(id) on delete set null;

-- ============================================================
-- preferences (one row per user)
-- ============================================================
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

alter table public.preferences enable row level security;

create policy "preferences_select_own" on public.preferences
  for select using (auth.uid() = user_id);
create policy "preferences_insert_own" on public.preferences
  for insert with check (auth.uid() = user_id);
create policy "preferences_update_own" on public.preferences
  for update using (auth.uid() = user_id);
create policy "preferences_delete_own" on public.preferences
  for delete using (auth.uid() = user_id);

create trigger trg_preferences_updated_at before update on public.preferences
  for each row execute function set_updated_at();

-- ============================================================
-- question_bank
-- ============================================================
create table public.question_bank (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_key text not null,
  question_text text not null,
  answer_text text not null,
  word_limit int,
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_key)
);

create index idx_question_bank_user on public.question_bank(user_id);

alter table public.question_bank enable row level security;

create policy "question_bank_select_own" on public.question_bank
  for select using (auth.uid() = user_id);
create policy "question_bank_insert_own" on public.question_bank
  for insert with check (auth.uid() = user_id);
create policy "question_bank_update_own" on public.question_bank
  for update using (auth.uid() = user_id);
create policy "question_bank_delete_own" on public.question_bank
  for delete using (auth.uid() = user_id);

create trigger trg_question_bank_updated_at before update on public.question_bank
  for each row execute function set_updated_at();

-- ============================================================
-- skill_profiles (join table: skills to stories/experiences for weighting)
-- Referenced in §2 task P2.1 of build-phases.md; derived from skills usage.
-- ============================================================
create table public.skill_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  experience_id uuid references public.experiences(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  weight numeric(3,2) not null default 1.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (experience_id is not null)::int + (project_id is not null)::int <= 1
  )
);

create index idx_skill_profiles_user on public.skill_profiles(user_id, skill_id);

alter table public.skill_profiles enable row level security;

create policy "skill_profiles_select_own" on public.skill_profiles
  for select using (auth.uid() = user_id);
create policy "skill_profiles_insert_own" on public.skill_profiles
  for insert with check (auth.uid() = user_id);
create policy "skill_profiles_update_own" on public.skill_profiles
  for update using (auth.uid() = user_id);
create policy "skill_profiles_delete_own" on public.skill_profiles
  for delete using (auth.uid() = user_id);

create trigger trg_skill_profiles_updated_at before update on public.skill_profiles
  for each row execute function set_updated_at();

-- ============================================================
-- profile_audit (append-only, never updated)
-- ============================================================
create table public.profile_audit (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index idx_profile_audit_user on public.profile_audit(user_id, created_at desc);
create index idx_profile_audit_entity on public.profile_audit(entity_type, entity_id);

alter table public.profile_audit enable row level security;

-- Audit table is append-only: users can read their own rows and insert, but never update/delete.
create policy "profile_audit_select_own" on public.profile_audit
  for select using (auth.uid() = user_id);
create policy "profile_audit_insert_own" on public.profile_audit
  for insert with check (auth.uid() = user_id);
