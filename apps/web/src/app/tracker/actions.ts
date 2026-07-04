'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { OutcomeType } from '@career-autopilot/db';
import { createClient } from '@/lib/supabase/server';

const VALID_STAGES = new Set<OutcomeType>([
  'submitted',
  'acknowledged',
  'callback',
  'rejection',
  'interview_invite',
  'interview_completed',
  'offer',
  'declined',
  'accepted',
  'ghosted',
]);

export async function moveCard(
  submissionId: string,
  newStage: OutcomeType,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!VALID_STAGES.has(newStage)) {
    return { ok: false, error: `invalid stage: ${newStage}` };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify ownership.
  const subRes = await supabase
    .from('submissions')
    .select('id')
    .eq('id', submissionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (subRes.error) return { ok: false, error: subRes.error.message };
  if (!subRes.data) return { ok: false, error: 'submission not found' };

  const now = new Date().toISOString();

  // Append outcome row.
  const outRes = await supabase.from('outcomes').insert({
    user_id: user.id,
    submission_id: submissionId,
    stage: newStage,
    reached_at: now,
    notes: 'manual: moved on tracker board',
  });
  if (outRes.error) return { ok: false, error: outRes.error.message };

  // Append outcome event for the analytics stream.
  await supabase.from('outcome_events').insert({
    user_id: user.id,
    submission_id: submissionId,
    source: 'manual',
    outcome_type: newStage,
    confidence: 1,
    payload: { triggered_by: 'tracker_kanban_drag' },
  });

  revalidatePath('/tracker');
  return { ok: true };
}
