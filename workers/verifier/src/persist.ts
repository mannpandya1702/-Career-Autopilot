// Persist a VerifyJobResult into the verifications table.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@career-autopilot/db';
import type { VerifyJobResult } from './verify-job';

export async function persistVerification(
  supabase: SupabaseClient<Database>,
  userId: string,
  tailoredResumeId: string,
  result: VerifyJobResult,
): Promise<{ id: string }> {
  const row: Database['public']['Tables']['verifications']['Insert'] = {
    user_id: userId,
    tailored_resume_id: tailoredResumeId,
    overall_score: result.score.overall,
    parse_agreement_score: result.score.parse_agreement,
    keyword_coverage_score: result.score.keyword_coverage,
    format_compliance_score: result.score.format_compliance,
    parser_results: result.parser_results as unknown as Json,
    missing_keywords:
      result.score.missing_keywords.length > 0 ? result.score.missing_keywords : null,
    format_issues:
      result.score.format_issues.length > 0 ? result.score.format_issues : null,
    passed: result.score.passed,
  };
  const { data, error } = await supabase
    .from('verifications')
    .insert(row)
    .select('id')
    .single();
  if (error) throw new Error(`verifications insert failed: ${error.message}`);
  return { id: data.id };
}
