// Persist a SubmitResult to the submissions / submission_attempts /
// manual_review_queue tables. Called by the worker after every adapter
// invocation.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, SubmitMethod, SubmitStatus } from '@career-autopilot/db';
import type { SubmitResult } from './types';

export interface PersistInput {
  user_id: string;
  job_id: string;
  tailored_resume_id: string;
  cover_letter_id: string | null;
  // The next attempt_number for this submission. The worker increments
  // monotonically.
  attempt_number: number;
  storedScreenshotPaths: string[];
}

export async function persistSubmissionResult(
  supabase: SupabaseClient<Database>,
  input: PersistInput,
  result: SubmitResult,
): Promise<{ submission_id: string }> {
  const status: SubmitStatus = mapStatus(result);
  const method: SubmitMethod = result.attempt.method;

  // 1. Upsert the submission row.
  const submissionRow: Database['public']['Tables']['submissions']['Insert'] = {
    user_id: input.user_id,
    job_id: input.job_id,
    tailored_resume_id: input.tailored_resume_id,
    cover_letter_id: input.cover_letter_id,
    method,
    status,
    submitted_at: result.outcome === 'succeeded' ? new Date().toISOString() : null,
    external_confirmation_id:
      result.outcome === 'succeeded' ? result.external_confirmation_id : null,
  };
  const { data: subRow, error: subError } = await supabase
    .from('submissions')
    .upsert(submissionRow, { onConflict: 'user_id,job_id' })
    .select('id')
    .single();
  if (subError) throw new Error(`submissions upsert failed: ${subError.message}`);

  // 2. Always append an attempt row.
  const attemptRow: Database['public']['Tables']['submission_attempts']['Insert'] = {
    submission_id: subRow.id,
    attempt_number: input.attempt_number,
    method,
    success: result.attempt.success,
    request_payload: (result.attempt.request_payload ?? null) as Json,
    response_payload: (result.attempt.response_payload ?? null) as Json,
    screenshots: input.storedScreenshotPaths.length > 0 ? input.storedScreenshotPaths : null,
    error_message: result.attempt.error_message ?? null,
    duration_ms: result.attempt.duration_ms,
  };
  const { error: attemptError } = await supabase
    .from('submission_attempts')
    .insert(attemptRow);
  if (attemptError) {
    throw new Error(`submission_attempts insert failed: ${attemptError.message}`);
  }

  // 3. Manual-review row when applicable.
  if (result.outcome === 'manual_review') {
    const { error: mrError } = await supabase.from('manual_review_queue').insert({
      user_id: input.user_id,
      submission_id: subRow.id,
      reason: result.reason,
      context: result.context as Json,
      screenshots:
        input.storedScreenshotPaths.length > 0 ? input.storedScreenshotPaths : null,
    });
    if (mrError) {
      throw new Error(`manual_review_queue insert failed: ${mrError.message}`);
    }
  }

  return { submission_id: subRow.id };
}

function mapStatus(result: SubmitResult): SubmitStatus {
  switch (result.outcome) {
    case 'succeeded':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'manual_review':
      return 'skipped';
  }
}
