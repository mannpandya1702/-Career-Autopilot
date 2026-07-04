import 'server-only';

import type { Database } from '@career-autopilot/db';
import { createClient } from '@/lib/supabase/server';

type Row = Database['public']['Tables']['question_answers']['Row'];

export interface LoadedQaAnswer {
  id: string;
  question_text: string;
  question_type: string;
  word_limit: number | null;
  answer_text: string;
  source: string;
  confidence: number | null;
  consistency_check_passed: boolean | null;
  consistency_violations: string[] | null;
  created_at: string;
}

export async function listAnswersForJob(
  userId: string,
  jobId: string,
): Promise<LoadedQaAnswer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('question_answers')
    .select('*')
    .eq('user_id', userId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`question_answers fetch failed: ${error.message}`);
  return (data ?? []).map((row) => {
    const r = row as Row;
    return {
      id: r.id,
      question_text: r.question_text,
      question_type: r.question_type,
      word_limit: r.word_limit,
      answer_text: r.answer_text,
      source: r.source,
      confidence: r.confidence == null ? null : Number(r.confidence),
      consistency_check_passed: r.consistency_check_passed,
      consistency_violations: r.consistency_violations,
      created_at: r.created_at,
    };
  });
}
