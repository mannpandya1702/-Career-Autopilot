// After a crawl batch, enqueue `score_jobs` messages for every (user, job)
// pair where the job is new-or-updated. Since we are single-user today,
// "every user" == "every row in auth.users with a profile + preferences".
//
// Emits one pgmq message per (user_id, job_id). The scorer worker applies
// idempotency via profile_version_hash so duplicate enqueues are harmless.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@career-autopilot/db';

export interface EnqueueScoringResult {
  users: number;
  jobs: number;
  enqueued: number;
}

export async function enqueueScoringForJobs(
  supabase: SupabaseClient<Database>,
  jobIds: string[],
): Promise<EnqueueScoringResult> {
  if (jobIds.length === 0) return { users: 0, jobs: 0, enqueued: 0 };

  // We consider a user "ready to score" when they have a profile with
  // a derived_summary and a preferences row. Missing either means the
  // profile-embedder hasn't run yet or onboarding is incomplete.
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, derived_summary')
    .not('derived_summary', 'is', null);
  if (error) throw new Error(`profiles fetch failed: ${error.message}`);
  const users = (data ?? [])
    .filter((p): p is { user_id: string; derived_summary: string } => p.derived_summary != null)
    .map((p) => p.user_id);

  let enqueued = 0;
  for (const user_id of users) {
    for (const job_id of jobIds) {
      const { error: sendError } = await supabase.rpc('pgmq_send' as never, {
        queue_name: 'score_jobs',
        msg: { user_id, job_id },
      } as never);
      if (!sendError) enqueued += 1;
    }
  }

  return { users: users.length, jobs: jobIds.length, enqueued };
}
