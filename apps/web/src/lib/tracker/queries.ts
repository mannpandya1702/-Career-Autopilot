import 'server-only';

import type { OutcomeType } from '@career-autopilot/db';
import { createClient } from '@/lib/supabase/server';
import { STAGE_TO_COLUMN, type TrackerCard } from './types';

export type { KanbanColumn, TrackerCard } from './types';
export { KANBAN_COLUMNS } from './types';

export async function listTrackerCards(userId: string): Promise<TrackerCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('submissions')
    .select(
      'id, job_id, submitted_at, job:jobs(title, apply_url, company:companies(name)), outcomes:outcomes(stage, reached_at)',
    )
    .eq('user_id', userId)
    .in('status', ['succeeded', 'in_progress', 'queued']);
  if (error) throw new Error(`tracker fetch failed: ${error.message}`);

  type JoinShape = {
    id: string;
    job_id: string;
    submitted_at: string | null;
    job?: {
      title?: string;
      apply_url?: string;
      company?: { name?: string } | null;
    } | null;
    outcomes?: { stage: OutcomeType; reached_at: string }[] | null;
  };

  return ((data ?? []) as unknown as JoinShape[]).map((row) => {
    const sortedStages = [...(row.outcomes ?? [])].sort((a, b) =>
      a.reached_at.localeCompare(b.reached_at),
    );
    const lastStage = sortedStages[sortedStages.length - 1];
    const currentStage: OutcomeType | 'submitted' = lastStage?.stage ?? 'submitted';
    const column = lastStage ? STAGE_TO_COLUMN[lastStage.stage] : 'submitted';
    return {
      submission_id: row.id,
      job_id: row.job_id,
      job_title: row.job?.title ?? 'Job',
      company_name: row.job?.company?.name ?? '',
      apply_url: row.job?.apply_url ?? null,
      submitted_at: row.submitted_at,
      current_stage: currentStage,
      column,
      stage_reached_at: lastStage?.reached_at ?? row.submitted_at ?? new Date().toISOString(),
    };
  });
}
