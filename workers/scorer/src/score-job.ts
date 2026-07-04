// Core scoring pipeline for one (user, job) pair.
//
// Pipeline per docs/build-phases.md P4.7:
//   1. runHardFilters(job, preferences)  → deterministic pass/fail.
//   2. If passed, parse JD via jd.parse    (Gemini Flash-Lite).
//   3. Embed the JD via text-embedding-004 (Gemini).
//   4. cosineSimilarity(profileVec, jdVec) → 0-1 score.
//   5. If semantic > 0.55, run fit.judge   (Gemini Flash) for structured judgment.
//   6. computeTier(...) → 'pending_review' | 'needs_decision' | 'low_fit' | 'rejected'.
//
// Idempotency: callers pass a profile_version_hash; we skip when the stored
// row already matches the same hash for the same job.

import {
  embedJd,
  type LlmRouter,
  parseJd,
  type ParsedJd,
  judgeFit,
  type FitJudgment,
  toPgVectorLiteral,
} from '@career-autopilot/llm';
import {
  computeTier,
  runHardFilters,
  semanticScore,
  SEMANTIC_JUDGE_THRESHOLD,
  type HardFilterInput,
  type Tier,
} from '@career-autopilot/resume';

export interface ScoreJobInput {
  job: HardFilterInput['job'] & {
    id: string;
    company_name: string;
  };
  preferences: HardFilterInput['preferences'];
  profile: {
    summary: string; // derived summary, privacy-safe
    years_experience: number | null;
    embedding: number[]; // profile summary embedding, 768-dim
  };
  profile_version_hash: string;
}

export interface ScoreJobResult {
  job_id: string;
  profile_version_hash: string;
  hard_filter_pass: boolean;
  hard_filter_reasons: string[];
  parsed_jd: ParsedJd | null;
  jd_embedding: number[] | null;
  semantic_score: number | null;
  judgment: FitJudgment | null;
  overall_score: number | null;
  tier: Tier;
}

export async function scoreJob(
  router: LlmRouter,
  input: ScoreJobInput,
): Promise<ScoreJobResult> {
  // 1. Hard filter first. If it fails, skip every LLM call.
  const hard = runHardFilters({ job: input.job, preferences: input.preferences });

  if (!hard.pass) {
    return {
      job_id: input.job.id,
      profile_version_hash: input.profile_version_hash,
      hard_filter_pass: false,
      hard_filter_reasons: hard.reasons,
      parsed_jd: null,
      jd_embedding: null,
      semantic_score: null,
      judgment: null,
      overall_score: 0,
      tier: 'rejected',
    };
  }

  // 2. Parse the JD (Gemini Flash-Lite).
  const parsedJd = await parseJd(router, {
    title: input.job.title,
    company: input.job.company_name,
    jd_text: input.job.description,
    ...(input.job.location ? { location: input.job.location } : {}),
    ...(input.job.remote_policy ? { remote_policy: input.job.remote_policy } : {}),
  });

  // 3. Embed the canonical JD rep (title + first 300 words of description +
  //    parsed must-haves) per docs/build-phases.md P4.4.
  const canonicalJd = canonicalJdForEmbedding(
    input.job.title,
    input.job.description,
    parsedJd.must_have_skills,
  );
  const jdEmbedding = await embedJd(router, canonicalJd);

  // 4. Semantic similarity against the profile summary embedding.
  const sem = semanticScore(input.profile.embedding, jdEmbedding);

  // 5. If semantic score clears the threshold, run the LLM judge.
  let judgment: FitJudgment | null = null;
  if (sem >= SEMANTIC_JUDGE_THRESHOLD) {
    judgment = await judgeFit(router, {
      profile_summary: input.profile.summary,
      profile_years: input.profile.years_experience,
      parsed_jd: parsedJd,
      hard_filter_failures: [], // hard filter passed here, so no failures
    });
  }

  const overall =
    judgment?.overall_score ??
    (sem >= SEMANTIC_JUDGE_THRESHOLD
      ? Math.round(sem * 100)
      : Math.round(sem * 70)); // semantic-only fallback capped at 70

  const tier = computeTier({ hard_filter_pass: true, overall_score: overall });

  return {
    job_id: input.job.id,
    profile_version_hash: input.profile_version_hash,
    hard_filter_pass: true,
    hard_filter_reasons: [],
    parsed_jd: parsedJd,
    jd_embedding: jdEmbedding,
    semantic_score: Number(sem.toFixed(3)),
    judgment,
    overall_score: overall,
    tier,
  };
}

// "title + first 300 words of description + parsed must-have skills" —
// stable, cacheable shape per P4.4. We keep this deterministic so tests can
// assert on exact hashes downstream.
export function canonicalJdForEmbedding(
  title: string,
  description: string,
  mustHaves: string[],
): string {
  const words = description.split(/\s+/).slice(0, 300).join(' ');
  const skills = mustHaves.join(', ');
  return `Title: ${title}\n\n${words}\n\nSkills: ${skills}`;
}

// Exported for the persistence layer — the pgvector literal format.
export { toPgVectorLiteral };
