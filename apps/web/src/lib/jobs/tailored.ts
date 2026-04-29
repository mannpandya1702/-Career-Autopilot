import 'server-only';

import type { Database } from '@career-autopilot/db';
import type { TailoredResume } from '@career-autopilot/resume';
import { createClient } from '@/lib/supabase/server';

type TailoredRow = Database['public']['Tables']['tailored_resumes']['Row'];

export interface LoadedTailoredResume {
  id: string;
  resume: TailoredResume;
  pdf_url: string | null;
  docx_url: string | null;
  honesty_check_passed: boolean;
  honesty_violations: string[] | null;
  regeneration_count: number;
  llm_model: string;
  prompt_version: string;
  created_at: string;
}

export async function getLatestTailoredResume(
  userId: string,
  jobId: string,
): Promise<LoadedTailoredResume | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tailored_resumes')
    .select('*')
    .eq('user_id', userId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`tailored_resumes fetch failed: ${error.message}`);
  if (!data) return null;
  const row = data as TailoredRow;
  return {
    id: row.id,
    resume: row.resume_json as unknown as TailoredResume,
    pdf_url: row.pdf_url,
    docx_url: row.docx_url,
    honesty_check_passed: row.honesty_check_passed,
    honesty_violations: row.honesty_violations,
    regeneration_count: row.regeneration_count,
    llm_model: row.llm_model,
    prompt_version: row.prompt_version,
    created_at: row.created_at,
  };
}
