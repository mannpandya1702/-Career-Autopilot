// Enqueue a pgmq message per active company into `crawl_jobs`.
// Called by .github/workflows/crawl-jobs.yml on a 4x daily cron.
//
// Usage:
//   pnpm crawl:enqueue

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@career-autopilot/db';

async function main(): Promise<void> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment',
    );
  }

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('companies')
    .select('id, ats_type, ats_slug')
    .order('priority', { ascending: false });
  if (error) {
    throw new Error(`companies fetch failed: ${error.message}`);
  }

  let enqueued = 0;
  for (const company of data ?? []) {
    const { error: sendError } = await supabase.rpc('pgmq_send' as never, {
      queue_name: 'crawl_jobs',
      msg: { company_id: company.id },
    } as never);
    if (sendError) {
      // eslint-disable-next-line no-console
      console.error(`[enqueue] ${company.ats_type}/${company.ats_slug}: ${sendError.message}`);
      continue;
    }
    enqueued += 1;
  }

  // eslint-disable-next-line no-console
  console.log(`[enqueue] queued ${enqueued}/${(data ?? []).length} companies`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
