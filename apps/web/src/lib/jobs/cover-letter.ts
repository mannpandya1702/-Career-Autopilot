import 'server-only';

import type { Database } from '@career-autopilot/db';
import { createClient } from '@/lib/supabase/server';

type Row = Database['public']['Tables']['cover_letters']['Row'];

export interface LoadedCoverLetter {
  id: string;
  greeting: string | null;
  body: string;
  signoff: string | null;
  word_count: number | null;
  honesty_check_passed: boolean;
  llm_model: string;
  prompt_version: string;
  created_at: string;
}

export async function getLatestCoverLetter(
  userId: string,
  tailoredResumeId: string,
): Promise<LoadedCoverLetter | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cover_letters')
    .select('*')
    .eq('user_id', userId)
    .eq('tailored_resume_id', tailoredResumeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`cover_letters fetch failed: ${error.message}`);
  if (!data) return null;
  const row = data as Row;
  return {
    id: row.id,
    greeting: row.greeting,
    body: row.body,
    signoff: row.signoff,
    word_count: row.word_count,
    honesty_check_passed: row.honesty_check_passed,
    llm_model: row.llm_model,
    prompt_version: row.prompt_version,
    created_at: row.created_at,
  };
}
