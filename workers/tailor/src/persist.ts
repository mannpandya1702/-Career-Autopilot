// Persist a TailorJobResult into tailored_resumes.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@career-autopilot/db';
import type { TailorJobResult } from './tailor-job';

export interface PersistInput {
  userId: string;
  jobId: string;
  profile_version_hash: string;
  pdf_url: string | null;
  docx_url: string | null;
}

export async function persistTailoredResume(
  supabase: SupabaseClient<Database>,
  input: PersistInput,
  result: TailorJobResult,
): Promise<{ id: string }> {
  const row: Database['public']['Tables']['tailored_resumes']['Insert'] = {
    user_id: input.userId,
    job_id: input.jobId,
    profile_version_hash: input.profile_version_hash,
    prompt_version: result.prompt_version,
    llm_model: result.llm_model,
    resume_json: result.resume as unknown as Json,
    pdf_url: input.pdf_url,
    docx_url: input.docx_url,
    honesty_check_passed: result.honesty_check_passed,
    honesty_violations:
      result.honesty_violations.length > 0 ? result.honesty_violations : null,
    regeneration_count: result.regeneration_count,
  };
  const { data, error } = await supabase
    .from('tailored_resumes')
    .insert(row)
    .select('id')
    .single();
  if (error) throw new Error(`tailored_resumes insert failed: ${error.message}`);
  return { id: data.id };
}
