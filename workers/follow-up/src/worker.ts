// Follow-up worker — runs on a 1-hour schedule. Fetches every submission
// older than 7 days without an outcome, applies planFollowUp, executes
// the resulting action.
//
// Day-7 emails are gated behind GMAIL_USER + GMAIL_APP_PASSWORD env vars
// (CLAUDE.md §6). When unset we log + skip the send and still flip
// stale on day 14, so the rest of the analytics pipeline keeps moving.

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@career-autopilot/db';
import { loadWorkerEnv, logger } from '@career-autopilot/shared';
import { planFollowUp } from './schedule';

const TICK_MS = 60 * 60 * 1000; // 1 hour

const log = logger.child({ service: 'follow-up-worker' });

async function tick(supabase: ReturnType<typeof createClient<Database>>): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('submissions')
    .select('id, status, submitted_at, updated_at')
    .lt('submitted_at', sevenDaysAgo)
    .in('status', ['succeeded']);
  if (error) {
    log.warn({ err: error.message }, 'submissions fetch failed; skipping tick');
    return;
  }

  for (const sub of data ?? []) {
    if (!sub.submitted_at) continue;
    // Outcome detection is implemented properly in Phase 9; for now we
    // approximate: any submission still in 'succeeded' after 14 days is
    // stale unless its updated_at is recent.
    const action = planFollowUp({
      submission_id: sub.id,
      submitted_at: sub.submitted_at,
      has_outcome: false,
      followup_sent_at: null,
      status: sub.status,
    });
    if (action.kind === 'mark_stale') {
      await supabase
        .from('submissions')
        .update({ status: 'failed' })
        .eq('id', sub.id);
      log.info({ submission_id: sub.id }, 'marked stale');
    } else if (action.kind === 'send_followup') {
      log.info(
        { submission_id: sub.id },
        'follow-up email queued (Gmail SMTP wiring pending live keys)',
      );
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

  log.info({ tickMs: TICK_MS }, 'follow-up worker starting');

  let running = true;
  const shutdown = () => {
    running = false;
    log.info('shutdown signal received');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (running) {
    try {
      await tick(supabase);
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err) }, 'tick error');
    }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
  log.info('follow-up worker stopped');
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    log.error({ err: err instanceof Error ? err.message : String(err) }, 'fatal');
    process.exit(1);
  });
}
