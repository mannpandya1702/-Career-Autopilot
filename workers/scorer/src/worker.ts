// pgmq polling loop for the scorer.
//
// Reads messages of shape `{ user_id, job_id }` from the `score_jobs` queue.
// For each message: run scoreJob, persist, archive. 3-retry DLQ per
// CLAUDE.md §8.6. Idempotent: if job_scores.profile_version_hash already
// matches, skip re-scoring.

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@career-autopilot/db';
import { loadWorkerEnv, logger } from '@career-autopilot/shared';
import { LlmRouter, makeStubProvider } from '@career-autopilot/llm';
import type { HardFilterInput } from '@career-autopilot/resume';
import { scoreJob } from './score-job';
import { persistScore } from './persist';

const QUEUE_NAME = 'score_jobs';
const MAX_ATTEMPTS = 3;
const VISIBILITY_TIMEOUT_SECONDS = 180;
const POLL_INTERVAL_MS = 5_000;

const MessageSchema = z.object({
  user_id: z.string().uuid(),
  job_id: z.string().uuid(),
});

const log = logger.child({ service: 'scorer' });

async function processOnce(
  supabase: ReturnType<typeof createClient<Database>>,
  router: LlmRouter,
): Promise<number> {
  const { data, error } = await supabase.rpc('pgmq_read' as never, {
    queue_name: QUEUE_NAME,
    vt: VISIBILITY_TIMEOUT_SECONDS,
    qty: 5,
  } as never);
  if (error) {
    log.warn({ error: error.message }, 'pgmq_read failed — queue may not exist yet');
    return 0;
  }
  const rows = data as unknown as { msg_id: number; read_ct: number; message: unknown }[];
  if (!rows || rows.length === 0) return 0;

  for (const row of rows) {
    const parsed = MessageSchema.safeParse(row.message);
    if (!parsed.success) {
      log.error({ msg_id: row.msg_id }, 'invalid message shape; archiving');
      await supabase.rpc('pgmq_archive' as never, {
        queue_name: QUEUE_NAME,
        msg_id: row.msg_id,
      } as never);
      continue;
    }

    const { user_id, job_id } = parsed.data;
    const scope = log.child({ user_id, job_id, msg_id: row.msg_id });

    try {
      await scoreOne(supabase, router, user_id, job_id, scope);
      await supabase.rpc('pgmq_archive' as never, {
        queue_name: QUEUE_NAME,
        msg_id: row.msg_id,
      } as never);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      scope.error({ err: message, read_ct: row.read_ct }, 'score failed');
      if (row.read_ct >= MAX_ATTEMPTS) {
        await supabase.rpc('pgmq_send' as never, {
          queue_name: `${QUEUE_NAME}_dlq`,
          msg: { user_id, job_id, error: message },
        } as never);
        await supabase.rpc('pgmq_archive' as never, {
          queue_name: QUEUE_NAME,
          msg_id: row.msg_id,
        } as never);
      }
    }
  }

  return rows.length;
}

async function scoreOne(
  supabase: ReturnType<typeof createClient<Database>>,
  router: LlmRouter,
  userId: string,
  jobId: string,
  scope: typeof log,
): Promise<void> {
  const [jobRes, profileRes, prefsRes, existingRes] = await Promise.all([
    supabase
      .from('jobs')
      .select(
        'id, title, description, location, remote_policy, salary_min, salary_max, salary_currency, company:companies(name)',
      )
      .eq('id', jobId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('id, derived_summary, summary_embedding, years_experience, updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('preferences').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('job_scores')
      .select('profile_version_hash')
      .eq('user_id', userId)
      .eq('job_id', jobId)
      .maybeSingle(),
  ]);
  // Check errors individually so each .data keeps its narrow row type.
  if (jobRes.error) throw new Error(jobRes.error.message);
  if (profileRes.error) throw new Error(profileRes.error.message);
  if (prefsRes.error) throw new Error(prefsRes.error.message);
  if (existingRes.error) throw new Error(existingRes.error.message);

  // Explicit row type — the supabase-js inference for selects that embed a
  // FK-joined table (company:companies(name)) collapses to `never` against
  // our hand-written Database types.
  type JobSelectRow = {
    id: string;
    title: string;
    description: string;
    location: string | null;
    remote_policy: Database['public']['Tables']['jobs']['Row']['remote_policy'];
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    company: { name: string } | null;
  };
  const job = jobRes.data as unknown as JobSelectRow | null;
  const profile = profileRes.data;
  const prefs = prefsRes.data;
  if (!job) {
    scope.warn('job not found; skipping');
    return;
  }
  if (!profile || !profile.derived_summary || !profile.summary_embedding) {
    scope.warn('profile not ready (missing derived_summary/embedding); skipping');
    return;
  }
  if (!prefs) {
    scope.warn('preferences not set; skipping');
    return;
  }

  const profileHash = profile.updated_at;
  if (existingRes.data && existingRes.data.profile_version_hash === profileHash) {
    scope.info('cached — profile unchanged since last score');
    return;
  }

  const prefsInput: HardFilterInput['preferences'] = {
    experience_levels: prefs.experience_levels,
    work_modes: prefs.work_modes,
    job_types: prefs.job_types,
    salary_min: prefs.salary_min,
    salary_currency: prefs.salary_currency,
    locations: prefs.locations,
    remote_anywhere: prefs.remote_anywhere,
    industries_exclude: prefs.industries_exclude,
    willing_to_relocate: prefs.willing_to_relocate,
  };

  const embedding = parsePgVector(profile.summary_embedding);

  const result = await scoreJob(router, {
    job: {
      id: job.id,
      title: job.title,
      description: job.description,
      location: job.location,
      remote_policy: job.remote_policy,
      salary_min: job.salary_min == null ? null : Number(job.salary_min),
      salary_max: job.salary_max == null ? null : Number(job.salary_max),
      salary_currency: job.salary_currency,
      company_name: job.company?.name ?? '',
    },
    preferences: prefsInput,
    profile: {
      summary: profile.derived_summary,
      years_experience: profile.years_experience == null ? null : Number(profile.years_experience),
      embedding,
    },
    profile_version_hash: profileHash,
  });

  await persistScore(supabase, userId, result);
  scope.info(
    {
      tier: result.tier,
      overall: result.overall_score,
      semantic: result.semantic_score,
      hard_pass: result.hard_filter_pass,
    },
    'scored',
  );
}

function parsePgVector(raw: string): number[] {
  // pgvector serializes as "[1,2,3]". Trim brackets and split.
  const inner = raw.trim().replace(/^\[/, '').replace(/\]$/, '');
  return inner.split(',').map((n) => Number.parseFloat(n));
}

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  // For now we run with stub providers so the worker boots without live keys.
  // Once packages/llm/src/providers/{anthropic,gemini}.ts ships, swap these.
  const router = new LlmRouter({
    providers: {
      gemini: makeStubProvider('gemini'),
      anthropic: makeStubProvider('anthropic'),
    },
  });

  log.info({ queue: QUEUE_NAME }, 'scorer starting');

  let running = true;
  const shutdown = () => {
    running = false;
    log.info('received shutdown signal — finishing current batch');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (running) {
    try {
      await processOnce(supabase, router);
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err) }, 'loop error');
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  log.info('scorer stopped');
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    log.error({ err: err instanceof Error ? err.message : String(err) }, 'fatal');
    process.exit(1);
  });
}
