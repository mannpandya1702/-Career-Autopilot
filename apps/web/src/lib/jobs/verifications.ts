import 'server-only';

import type { Database } from '@career-autopilot/db';
import { createClient } from '@/lib/supabase/server';

type Row = Database['public']['Tables']['verifications']['Row'];

export interface LoadedVerification {
  id: string;
  overall_score: number;
  parse_agreement_score: number;
  keyword_coverage_score: number;
  format_compliance_score: number;
  parser_results: Record<string, unknown>;
  missing_keywords: string[] | null;
  format_issues: string[] | null;
  passed: boolean;
  created_at: string;
}

export async function getLatestVerification(
  userId: string,
  tailoredResumeId: string,
): Promise<LoadedVerification | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('verifications')
    .select('*')
    .eq('user_id', userId)
    .eq('tailored_resume_id', tailoredResumeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`verifications fetch failed: ${error.message}`);
  if (!data) return null;
  const row = data as Row;
  return {
    id: row.id,
    overall_score: row.overall_score,
    parse_agreement_score: row.parse_agreement_score,
    keyword_coverage_score: row.keyword_coverage_score,
    format_compliance_score: row.format_compliance_score,
    parser_results: (row.parser_results as Record<string, unknown>) ?? {},
    missing_keywords: row.missing_keywords,
    format_issues: row.format_issues,
    passed: row.passed,
    created_at: row.created_at,
  };
}
