// Verify one tailored resume:
//   1. Run the ensemble (3 parsers) on the rendered PDF.
//   2. Score the result.
//   3. If score < threshold AND regen budget remains, build feedback string,
//      push tailor_jobs message with user_hint=feedback. Return loop=true.
//   4. Else return the score and let the worker persist it.

import {
  buildVerifierFeedback,
  MAX_VERIFIER_REGENERATIONS,
  runEnsemble,
  scoreVerification,
  VERIFIER_PASS_THRESHOLD,
  type VerifierScore,
  type ParserOutcome,
  type TailoredResume,
} from '@career-autopilot/resume';
import type { ParserClient, ParserExtraction } from '@career-autopilot/parsers';

export interface VerifyJobInput {
  pdfBuffer: Buffer;
  parsers: ParserClient[];
  tailored: TailoredResume;
  must_have_skills: string[];
  prior_regenerations: number;
  parserTimeoutMs?: number;
}

export interface VerifyJobResult {
  score: VerifierScore;
  outcomes: ParserOutcome[];
  parser_results: Record<string, ParserExtraction | { error: string }>;
  feedback: string | null;
  should_regenerate: boolean;
}

export async function runVerifyJob(input: VerifyJobInput): Promise<VerifyJobResult> {
  const ensemble = await runEnsemble({
    pdfBuffer: input.pdfBuffer,
    parsers: input.parsers,
    ...(input.parserTimeoutMs !== undefined ? { timeoutMs: input.parserTimeoutMs } : {}),
  });

  const parser_results: Record<string, ParserExtraction | { error: string }> = {};
  for (const o of ensemble.outcomes) {
    parser_results[o.parser] = o.ok && o.extraction
      ? o.extraction
      : { error: o.error ?? 'unknown' };
  }

  const score = scoreVerification(
    {
      extractions: ensemble.successful,
      tailored: input.tailored,
      must_have_skills: input.must_have_skills,
    },
    VERIFIER_PASS_THRESHOLD,
  );

  const should_regenerate =
    !score.passed && input.prior_regenerations < MAX_VERIFIER_REGENERATIONS;
  const feedback = should_regenerate ? buildVerifierFeedback(score) : null;

  return {
    score,
    outcomes: ensemble.outcomes,
    parser_results,
    feedback,
    should_regenerate,
  };
}
