-- Phase 11 — ops tables.
-- Source of truth: docs/database-schema.md §10.

-- ============================================================
-- kv_store — rate-limiter tokens, feature flags, calibration values.
-- Service-role-only (workers); not exposed to authenticated users.
-- ============================================================
create table public.kv_store (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index idx_kv_store_expires on public.kv_store(expires_at)
  where expires_at is not null;

alter table public.kv_store enable row level security;
-- No policies → only the service role can read/write. CLAUDE.md §6.

create trigger trg_kv_store_updated_at before update on public.kv_store
  for each row execute function set_updated_at();

-- ============================================================
-- llm_calls — every LLM call recorded for cost tracking
-- ============================================================
create table public.llm_calls (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  model text not null,
  task text not null,
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

alter table public.llm_calls enable row level security;

create policy "llm_calls_select_own" on public.llm_calls
  for select using (auth.uid() = user_id);
-- Inserts go through the service role (workers + API routes).

-- ============================================================
-- daily_cost_summary — aggregated nightly by pg_cron
-- ============================================================
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

create index idx_daily_cost_summary_user_day
  on public.daily_cost_summary(user_id, day desc);

alter table public.daily_cost_summary enable row level security;

create policy "daily_cost_summary_select_own" on public.daily_cost_summary
  for select using (auth.uid() = user_id);

-- ============================================================
-- pg_cron schedule for nightly cost rollup. Source: §database-schema.md §10.
-- The DO block guards against environments without pg_cron installed.
-- ============================================================
do $$
begin
  perform cron.schedule('daily_cost_rollup', '0 1 * * *', $cron$
    insert into public.daily_cost_summary (day, user_id, provider, model, task, total_tokens_in, total_tokens_out, total_cost_usd, call_count)
    select current_date - 1, user_id, provider, model, task,
           sum(tokens_in), sum(tokens_out), sum(cost_usd), count(*)
    from public.llm_calls
    where created_at >= current_date - 1 and created_at < current_date
    group by user_id, provider, model, task
    on conflict (day, user_id, provider, model, task) do nothing;
  $cron$);

  perform cron.schedule('stale_jobs_cleanup', '0 2 * * *', $cron$
    update public.jobs set status = 'closed', updated_at = now()
    where status = 'active' and last_seen_at < now() - interval '30 days';
  $cron$);
exception
  when undefined_function then
    raise notice 'pg_cron not installed; skipping schedule (dev-only path)';
end $$;
