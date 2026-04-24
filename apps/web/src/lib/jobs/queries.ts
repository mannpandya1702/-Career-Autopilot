import 'server-only';

import type { Database } from '@career-autopilot/db';
import { createClient } from '@/lib/supabase/server';

type JobRow = Database['public']['Tables']['jobs']['Row'];
type CompanyRow = Database['public']['Tables']['companies']['Row'];
type JobScoreRow = Database['public']['Tables']['job_scores']['Row'];

export interface JobWithCompany extends JobRow {
  company: Pick<CompanyRow, 'id' | 'name' | 'ats_type' | 'ats_slug'> | null;
  // Present only when the authenticated user has a score row for this job.
  score: Pick<
    JobScoreRow,
    | 'overall_score'
    | 'semantic_score'
    | 'tier'
    | 'hard_filter_pass'
    | 'hard_filter_reasons'
    | 'must_have_gaps'
    | 'judge_reasoning'
    | 'dimensions'
  > | null;
}

export interface ListJobsFilters {
  status?: string;
  company_id?: string;
  ats?: CompanyRow['ats_type'];
  source?: string;
  limit?: number;
  cursor_posted_at?: string;
  min_overall_score?: number;
  // When set, filters by the current user's job_scores.tier (per-user) rather
  // than the shared jobs.status column.
  tier?: JobScoreRow['tier'];
}

const TIER_STATUSES = new Set(['pending_review', 'needs_decision', 'low_fit']);

async function attachScores(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  jobIds: string[],
): Promise<Map<string, JobWithCompany['score']>> {
  if (jobIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('job_scores')
    .select(
      'job_id, overall_score, semantic_score, tier, hard_filter_pass, hard_filter_reasons, must_have_gaps, judge_reasoning, dimensions',
    )
    .eq('user_id', userId)
    .in('job_id', jobIds);
  if (error) throw new Error(`job_scores fetch failed: ${error.message}`);
  const map = new Map<string, JobWithCompany['score']>();
  for (const row of data ?? []) {
    const { job_id, ...rest } = row as { job_id: string } & NonNullable<
      JobWithCompany['score']
    >;
    map.set(job_id, rest);
  }
  return map;
}

export async function listJobs(filters: ListJobsFilters = {}): Promise<JobWithCompany[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const limit = Math.min(filters.limit ?? 50, 200);

  let query = supabase
    .from('jobs')
    .select('*, company:companies(id, name, ats_type, ats_slug)')
    .order('posted_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  // Tier-style status values (pending_review / needs_decision / low_fit)
  // live on job_scores.tier, not jobs.status.  Route them correctly.
  const tier =
    filters.tier ??
    (filters.status && TIER_STATUSES.has(filters.status)
      ? (filters.status as JobScoreRow['tier'])
      : undefined);
  if (filters.status && !TIER_STATUSES.has(filters.status)) {
    query = query.eq('status', filters.status);
  } else if (!filters.status && !tier) {
    query = query.eq('status', 'active');
  }
  if (filters.company_id) query = query.eq('company_id', filters.company_id);
  if (filters.cursor_posted_at) query = query.lt('posted_at', filters.cursor_posted_at);

  const { data, error } = await query;
  if (error) throw new Error(`jobs list failed: ${error.message}`);

  let rows = (data ?? []) as unknown as Omit<JobWithCompany, 'score'>[];
  if (filters.ats) {
    rows = rows.filter((r) => r.company?.ats_type === filters.ats);
  }

  const scoreMap = user
    ? await attachScores(
        supabase,
        user.id,
        rows.map((r) => r.id),
      )
    : new Map<string, JobWithCompany['score']>();

  let merged: JobWithCompany[] = rows.map((r) => ({
    ...r,
    score: scoreMap.get(r.id) ?? null,
  }));

  if (tier) {
    merged = merged.filter((r) => r.score?.tier === tier);
  }

  if (filters.min_overall_score != null) {
    const floor = filters.min_overall_score;
    merged = merged.filter((r) => (r.score?.overall_score ?? 0) >= floor);
  }

  return merged;
}

export async function getJobById(id: string): Promise<JobWithCompany | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('jobs')
    .select('*, company:companies(id, name, ats_type, ats_slug)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`job fetch failed: ${error.message}`);
  if (!data) return null;
  const scoreMap = user ? await attachScores(supabase, user.id, [id]) : new Map();
  return {
    ...(data as unknown as Omit<JobWithCompany, 'score'>),
    score: scoreMap.get(id) ?? null,
  };
}
