// pgmq polling loop for the profile-embedder.
//
// Reads messages of shape `{ user_id: string }` from the `profile_embed_jobs`
// queue. For each message:
//   1. Loads profile + experiences + skills via service-role Supabase client.
//   2. Runs computeProfileEmbedding (privacy-provider LLM → Gemini embedder).
//   3. Persists derived_summary + summary_embedding.
//   4. Archives the message on success, leaves it visible on transient failure,
//      sends to DLQ after 3 failed attempts.
//
// The queue itself is created in the first Phase 3 migration per
// docs/database-schema.md; until then this worker runs but finds no messages.
//
// NOTE: the actual Gemini/Anthropic clients are wired via @career-autopilot/llm
// (populated in Phase 4). Running this file without the live key is fine — the
// loop just idles if summarizer/embedder aren't set.

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@career-autopilot/db';
import { loadWorkerEnv, logger } from '@career-autopilot/shared';
import { z } from 'zod';
import { computeProfileEmbedding, persistProfileEmbedding } from './index';
import { heuristicSummarizer } from './summarize';
import { stubEmbedder } from './embed';

const QUEUE_NAME = 'profile_embed_jobs';
const MAX_ATTEMPTS = 3;
const VISIBILITY_TIMEOUT_SECONDS = 60;
const POLL_INTERVAL_MS = 5_000;

const MessageSchema = z.object({
  user_id: z.string().uuid(),
});

const log = logger.child({ service: 'profile-embedder' });

async function processOnce(
  supabase: ReturnType<typeof createClient<Database>>,
): Promise<void> {
  // pgmq.read returns an array; we call via RPC.
  const { data, error } = await supabase.rpc('pgmq_read' as never, {
    queue_name: QUEUE_NAME,
    vt: VISIBILITY_TIMEOUT_SECONDS,
    qty: 1,
  } as never);
  if (error) {
    log.warn({ error: error.message }, 'pgmq_read failed — queue may not exist yet');
    return;
  }
  const rows = data as unknown as {
    msg_id: number;
    read_ct: number;
    message: unknown;
  }[];
  if (!rows || rows.length === 0) return;

  for (const row of rows) {
    const parsed = MessageSchema.safeParse(row.message);
    if (!parsed.success) {
      log.error({ msg_id: row.msg_id, issues: parsed.error.issues }, 'invalid message shape');
      await supabase.rpc('pgmq_archive' as never, {
        queue_name: QUEUE_NAME,
        msg_id: row.msg_id,
      } as never);
      continue;
    }

    const userId = parsed.data.user_id;
    const scope = log.child({ userId, msg_id: row.msg_id });

    try {
      const [profileResult, experiencesResult, skillsResult, bulletsResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('experiences').select('*').eq('user_id', userId).order('ord'),
        supabase.from('skills').select('*').eq('user_id', userId),
        supabase.from('experience_bullets').select('*').eq('user_id', userId),
      ]);
      for (const r of [profileResult, experiencesResult, skillsResult, bulletsResult]) {
        if (r.error) throw new Error(r.error.message);
      }
      const profile = profileResult.data;
      if (!profile) {
        scope.warn('profile not found — archiving message');
        await supabase.rpc('pgmq_archive' as never, {
          queue_name: QUEUE_NAME,
          msg_id: row.msg_id,
        } as never);
        continue;
      }

      const bullets = (bulletsResult.data ?? []) as never as (Database['public']['Tables']['experience_bullets']['Row'])[];
      const bulletsByExp = new Map<string, typeof bullets>();
      for (const b of bullets) {
        const list = bulletsByExp.get(b.experience_id) ?? [];
        list.push(b);
        bulletsByExp.set(b.experience_id, list);
      }

      const { summary_embedding: _drop, ...rest } = profile;
      type ExperienceRow = Database['public']['Tables']['experiences']['Row'];
      const expRows = (experiencesResult.data ?? []) as ExperienceRow[];
      const result = await computeProfileEmbedding(
        {
          profile: rest as never,
          experiences: expRows.map((e) => ({
            ...(e as unknown as Record<string, unknown>),
            bullets: bulletsByExp.get(e.id) ?? [],
          })) as never,
          skills: (skillsResult.data ?? []) as never,
        },
        {
          summarizer: heuristicSummarizer,
          embedder: stubEmbedder,
        },
      );
      await persistProfileEmbedding(supabase, userId, result);

      await supabase.rpc('pgmq_archive' as never, {
        queue_name: QUEUE_NAME,
        msg_id: row.msg_id,
      } as never);
      scope.info({ dims: result.summary_embedding.length }, 'embedding persisted');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      scope.error({ err: message, read_ct: row.read_ct }, 'embedding failed');
      if (row.read_ct >= MAX_ATTEMPTS) {
        await supabase.rpc('pgmq_send' as never, {
          queue_name: `${QUEUE_NAME}_dlq`,
          msg: { user_id: userId, error: message },
        } as never);
        await supabase.rpc('pgmq_archive' as never, {
          queue_name: QUEUE_NAME,
          msg_id: row.msg_id,
        } as never);
      }
      // else: let visibility timeout expire so the message retries
    }
  }
}

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  log.info({ queue: QUEUE_NAME }, 'profile-embedder starting');

  let running = true;
  const shutdown = () => {
    running = false;
    log.info('received shutdown signal — finishing current batch');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (running) {
    try {
      await processOnce(supabase);
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err) }, 'unexpected error');
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  log.info('profile-embedder stopped');
}

// Node entry-point guard: run main() only when executed directly.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    log.error({ err: err instanceof Error ? err.message : String(err) }, 'fatal');
    process.exit(1);
  });
}
