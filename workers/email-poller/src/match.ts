// Match an inbound classified email to one of our submissions.
// Heuristics:
//   1. The email's job_match_signal (a company/role string from the LLM)
//      gets fuzzy-compared to each submission's company name + job title.
//   2. The submission must be recent (≤ 60 days since submitted_at) and
//      not already in a terminal stage.
//
// Returns the submission_id of the best match, or null if no submission
// crosses the score threshold.

export interface SubmissionForMatch {
  submission_id: string;
  company_name: string | null;
  job_title: string | null;
  submitted_at: string;
  current_stage: string | null;
}

export interface EmailMatchInput {
  job_match_signal: string | null;
  email_body: string;
  email_from: string;
  candidates: SubmissionForMatch[];
  now?: Date;
}

const TERMINAL_STAGES = new Set([
  'rejection',
  'offer',
  'declined',
  'accepted',
  'ghosted',
]);

export function matchEmailToSubmission(input: EmailMatchInput): string | null {
  const now = input.now ?? new Date();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const candidates = input.candidates.filter((c) => {
    if (!c.submitted_at) return false;
    if (new Date(c.submitted_at) < sixtyDaysAgo) return false;
    if (c.current_stage && TERMINAL_STAGES.has(c.current_stage)) return false;
    return true;
  });
  if (candidates.length === 0) return null;

  const haystack = `${input.email_body} ${input.email_from} ${input.job_match_signal ?? ''}`.toLowerCase();
  let bestId: string | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = scoreCandidate(c, haystack, input.job_match_signal);
    if (score > bestScore) {
      bestScore = score;
      bestId = c.submission_id;
    }
  }
  return bestScore >= 2 ? bestId : null;
}

function scoreCandidate(
  c: SubmissionForMatch,
  haystack: string,
  signal: string | null,
): number {
  let score = 0;
  if (c.company_name) {
    const company = c.company_name.toLowerCase();
    if (haystack.includes(company)) score += 2;
    if (signal && signal.toLowerCase().includes(company)) score += 1;
  }
  if (c.job_title) {
    const title = c.job_title.toLowerCase();
    if (haystack.includes(title)) score += 1;
  }
  return score;
}
