// Public API for the profile-embedder worker. The pgmq polling loop lives in
// worker.ts; this module exposes the core operation so it can be called
// in-process (e.g. from a test) or by the loop.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@career-autopilot/db';
import type {
  Experience,
  ExperienceBullet,
  Profile,
  Skill,
} from '@career-autopilot/resume';
import { type Embedder, toPgVectorLiteral } from './embed';
import { heuristicSummarizer, type Summarizer } from './summarize';

export { heuristicSummarizer } from './summarize';
export type { Summarizer } from './summarize';
export { stubEmbedder, toPgVectorLiteral } from './embed';
export type { Embedder } from './embed';

export interface ComputeOptions {
  summarizer?: Summarizer;
  embedder: Embedder;
}

export interface ComputeResult {
  derived_summary: string;
  summary_embedding: number[];
}

export async function computeProfileEmbedding(
  input: {
    profile: Profile;
    experiences: (Experience & { bullets: ExperienceBullet[] })[];
    skills: Skill[];
  },
  options: ComputeOptions,
): Promise<ComputeResult> {
  const summarizer = options.summarizer ?? heuristicSummarizer;
  const derived = await summarizer.summarize(input);
  const vec = await options.embedder.embed(derived);
  if (vec.length !== options.embedder.dimension) {
    throw new Error(
      `embedding returned ${vec.length} dims, expected ${options.embedder.dimension}`,
    );
  }
  return { derived_summary: derived, summary_embedding: vec };
}

// Writes the derived summary + embedding back to the profiles row.
// The caller is responsible for providing a service-role Supabase client
// (RLS-bypassing, required because this worker is not acting as the user).
export async function persistProfileEmbedding(
  supabase: SupabaseClient<Database>,
  userId: string,
  result: ComputeResult,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      derived_summary: result.derived_summary,
      summary_embedding: toPgVectorLiteral(result.summary_embedding),
    })
    .eq('user_id', userId);
  if (error) {
    throw new Error(`profiles.summary_embedding update failed: ${error.message}`);
  }
}
