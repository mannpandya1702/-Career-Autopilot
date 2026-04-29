// Translate a verifier failure into a feedback string the tailor prompt
// can consume on the next pass. The tailor task accepts a `user_hint`
// already; we route this verifier feedback into that field so the model
// has explicit guidance on what to fix.
//
// Per docs/build-phases.md P6.5: max 2 regeneration loops, then fail to
// manual review. The worker tracks the count; this module just builds
// the feedback string.

import type { VerifierScore } from './score';

export const MAX_VERIFIER_REGENERATIONS = 2;

export function buildVerifierFeedback(score: VerifierScore): string {
  const lines: string[] = [];

  if (score.missing_keywords.length > 0) {
    lines.push(
      `The verifier could not find these must-have skills in the rendered resume: ${score.missing_keywords
        .slice(0, 10)
        .join(', ')}. If the candidate genuinely has them in the master profile, surface them more prominently in bullets or the skills section. Do NOT invent any.`,
    );
  }
  if (score.parse_agreement < 60) {
    lines.push(
      `Parsers disagreed on basic fields (parse-agreement ${score.parse_agreement}/100). Use the standard one-line "Title at Company" format on each experience and ensure dates are in the format YYYY-MM.`,
    );
  }
  for (const issue of score.format_issues) {
    lines.push(`Format issue: ${issue}.`);
  }

  if (lines.length === 0) {
    lines.push(
      `Overall verifier score ${score.overall} is below the 80 threshold. Tighten phrasing for clarity and ensure each must-have skill from the JD appears verbatim somewhere in the resume.`,
    );
  }
  return lines.join('\n\n');
}
