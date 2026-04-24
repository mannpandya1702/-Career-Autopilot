// pgmq polling loop for the crawler.
//
// Reads messages of shape `{ company_id: string }` from the `crawl_jobs` queue.
// For each message: run crawlCompany, archive on success, DLQ after 3 failed
// attempts (CLAUDE.md §8.6).
//
// Scheduled enqueueing happens in scripts/crawl-enqueue.ts (called from GH
// Actions 4x daily per docs/build-phases.md P3.9).

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@career-autopilot/db';
import { loadWorkerEnv, logger } from '@career-autopilot/shared';
import type { AtsType } from '@career-autopilot/ats';
import { crawlCompany } from './crawl-company';
import { runDedup } from './dedup';
import { RateLimiter } from './rate-limit';

const QUEUE_NAME = 'crawl_jobs';
const MAX_ATTEMPTS = 3;
const VISIBILITY_TIMEOUT_SECONDS = 120;
const POLL_INTERVAL_MS = 5_000;
const DEDUP_EVERY_N_BATCHES = 10;

const MessageSchema = z.object({ company_id: z.string().uuid() });

const log = logger.child({ service: 'crawler' });

async function processOnce(
  supabase: ReturnType<typeof createClient<Database>>,
  rl: RateLimiter,
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

    const { company_id } = parsed.data;
    const scope = log.child({ company_id, msg_id: row.msg_id });

    try {
      const { data: companyRow, error: companyError } = await supabase
        .from('companies')
        .select('id, ats_type, ats_slug, name')
        .eq('id', company_id)
        .maybeSingle();
      if (companyError) throw new Error(companyError.message);
      if (!companyRow) {
        scope.warn('company not found — archiving');
        await supabase.rpc('pgmq_archive' as never, {
          queue_name: QUEUE_NAME,
          msg_id: row.msg_id,
        } as never);
        continue;
      }

      const result = await crawlCompany(supabase, rl, {
        company_id: companyRow.id,
        ats: companyRow.ats_type as AtsType,
        ats_slug: companyRow.ats_slug,
        name: companyRow.name,
      });

      if (result.error) {
        scope.error({ err: result.error, read_ct: row.read_ct }, 'crawl failed');
        if (row.read_ct >= MAX_ATTEMPTS) {
          await supabase.rpc('pgmq_send' as never, {
            queue_name: `${QUEUE_NAME}_dlq`,
            msg: { company_id, error: result.error },
          } as never);
          await supabase.rpc('pgmq_archive' as never, {
            queue_name: QUEUE_NAME,
            msg_id: row.msg_id,
          } as never);
        }
        continue;
      }

      scope.info(
        {
          found: result.jobs_found,
          new: result.jobs_new,
          updated: result.jobs_updated,
          closed: result.jobs_closed,
        },
        'crawl complete',
      );
      await supabase.rpc('pgmq_archive' as never, {
        queue_name: QUEUE_NAME,
        msg_id: row.msg_id,
      } as never);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      scope.error({ err: message, read_ct: row.read_ct }, 'unexpected crawl error');
      if (row.read_ct >= MAX_ATTEMPTS) {
        await supabase.rpc('pgmq_send' as never, {
          queue_name: `${QUEUE_NAME}_dlq`,
          msg: { company_id, error: message },
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

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const rl = new RateLimiter(500);

  log.info({ queue: QUEUE_NAME }, 'crawler starting');

  let running = true;
  let batchCount = 0;
  const shutdown = () => {
    running = false;
    log.info('received shutdown signal — finishing current batch');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (running) {
    try {
      const processed = await processOnce(supabase, rl);
      if (processed > 0) {
        batchCount += 1;
        if (batchCount % DEDUP_EVERY_N_BATCHES === 0) {
          const dedup = await runDedup(supabase);
          log.info({ dedup }, 'dedup pass complete');
        }
      }
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err) }, 'loop error');
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  log.info('crawler stopped');
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    log.error({ err: err instanceof Error ? err.message : String(err) }, 'fatal');
    process.exit(1);
  });
}
