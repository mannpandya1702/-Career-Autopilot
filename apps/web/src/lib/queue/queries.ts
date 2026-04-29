import 'server-only';

import type { Database } from '@career-autopilot/db';
import { createClient } from '@/lib/supabase/server';

type Row = Database['public']['Tables']['manual_review_queue']['Row'];

export interface ManualReviewItem {
  id: string;
  submission_id: string;
  reason: string;
  context: Record<string, unknown> | null;
  screenshots: string[] | null;
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
  // Joined from submissions + jobs.
  job_title: string | null;
  company_name: string | null;
  apply_url: string | null;
}

export async function listManualReviewQueue(userId: string): Promise<ManualReviewItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('manual_review_queue')
    .select(
      'id, submission_id, reason, context, screenshots, resolved_at, resolution, created_at, submission:submissions(job:jobs(title, apply_url, company:companies(name)))',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`manual_review_queue fetch failed: ${error.message}`);

  type JoinShape = Row & {
    submission?: {
      job?: {
        title?: string;
        apply_url?: string;
        company?: { name?: string } | null;
      } | null;
    } | null;
  };

  return (data ?? []).map((row) => {
    const r = row as unknown as JoinShape;
    return {
      id: r.id,
      submission_id: r.submission_id,
      reason: r.reason,
      context: (r.context as Record<string, unknown> | null) ?? null,
      screenshots: r.screenshots,
      resolved_at: r.resolved_at,
      resolution: r.resolution,
      created_at: r.created_at,
      job_title: r.submission?.job?.title ?? null,
      company_name: r.submission?.job?.company?.name ?? null,
      apply_url: r.submission?.job?.apply_url ?? null,
    };
  });
}
