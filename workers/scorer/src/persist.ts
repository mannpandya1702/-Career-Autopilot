// Persist a ScoreJobResult into job_embeddings + job_scores.
//
// job_embeddings is shared (one row per job): we only write when we have a
// fresh parsed_jd + embedding. job_scores is user-scoped and upserted on
// (user_id, job_id).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@career-autopilot/db';
import type { ScoreJobResult } from './score-job';
import { toPgVectorLiteral } from './score-job';

export async function persistScore(
  supabase: SupabaseClient<Database>,
  userId: string,
  result: ScoreJobResult,
): Promise<void> {
  // 1. Upsert job_embeddings when we produced fresh artifacts.
  if (result.parsed_jd && result.jd_embedding) {
    const { error } = await supabase
      .from('job_embeddings')
      .upsert({
        job_id: result.job_id,
        jd_embedding: toPgVectorLiteral(result.jd_embedding),
        parsed_jd: result.parsed_jd as unknown as Json,
      });
    if (error) {
      throw new Error(`job_embeddings upsert failed: ${error.message}`);
    }
  }

  // 2. Upsert job_scores.
  const row: Database['public']['Tables']['job_scores']['Insert'] = {
    user_id: userId,
    job_id: result.job_id,
    profile_version_hash: result.profile_version_hash,
    hard_filter_pass: result.hard_filter_pass,
    hard_filter_reasons:
      result.hard_filter_reasons.length > 0 ? result.hard_filter_reasons : null,
    semantic_score: result.semantic_score,
    overall_score: result.overall_score,
    dimensions: (result.judgment?.dimensions ?? null) as Json | null,
    must_have_gaps: result.judgment?.must_have_gaps ?? null,
    judge_reasoning: result.judgment?.reasoning ?? null,
    tier: result.tier,
  };

  const { error: scoreError } = await supabase
    .from('job_scores')
    .upsert(row, { onConflict: 'user_id,job_id' });
  if (scoreError) {
    throw new Error(`job_scores upsert failed: ${scoreError.message}`);
  }
}
