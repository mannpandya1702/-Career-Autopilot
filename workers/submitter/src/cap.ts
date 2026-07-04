// Daily application cap (CLAUDE.md §6 + §12 + docs/build-phases.md P8.8).
// The cap is enforced in-process by counting today's successful + queued
// submissions for this user. We block BEFORE invoking any adapter.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@career-autopilot/db';

export interface CapResult {
  allowed: boolean;
  used: number;
  cap: number;
}

export async function checkDailyCap(
  supabase: SupabaseClient<Database>,
  userId: string,
  cap: number,
): Promise<CapResult> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString())
    .in('status', ['queued', 'in_progress', 'succeeded']);
  if (error) throw new Error(`cap check failed: ${error.message}`);
  const used = count ?? 0;
  return { allowed: used < cap, used, cap };
}
