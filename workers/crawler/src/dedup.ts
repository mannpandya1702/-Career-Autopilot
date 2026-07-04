// P3.10 — Dedup pass. After a crawl batch, group jobs by
// (company_id, normalized_title, location) and mark the earliest-seen
// as canonical; others get their canonical_job_id set.
//
// We operate in-database using a single UPDATE with a window function to
// keep round-trips cheap.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@career-autopilot/db';

type JobRow = Pick<
  Database['public']['Tables']['jobs']['Row'],
  'id' | 'company_id' | 'normalized_title' | 'location' | 'first_seen_at' | 'canonical_job_id'
>;

export interface DedupResult {
  scanned: number;
  newly_deduped: number;
}

// Run in TypeScript (not pure SQL) because our generated supabase-js helpers
// can't express window functions; this is fine for our scale (~1k active jobs).
export async function runDedup(supabase: SupabaseClient<Database>): Promise<DedupResult> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, company_id, normalized_title, location, first_seen_at, canonical_job_id')
    .eq('status', 'active');
  if (error) throw new Error(`dedup select failed: ${error.message}`);

  const rows = (data ?? []) as JobRow[];
  const groups = new Map<string, JobRow[]>();
  for (const row of rows) {
    if (!row.normalized_title) continue;
    const key = [row.company_id, row.normalized_title, row.location ?? ''].join('::');
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let newly_deduped = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.first_seen_at.localeCompare(b.first_seen_at));
    const canonical = list[0];
    if (!canonical) continue;
    const duplicates = list
      .slice(1)
      .filter((j) => j.canonical_job_id !== canonical.id);
    if (duplicates.length === 0) continue;

    const { error: updateError } = await supabase
      .from('jobs')
      .update({ canonical_job_id: canonical.id })
      .in(
        'id',
        duplicates.map((j) => j.id),
      );
    if (updateError) throw new Error(`dedup update failed: ${updateError.message}`);
    newly_deduped += duplicates.length;
  }

  return { scanned: rows.length, newly_deduped };
}
