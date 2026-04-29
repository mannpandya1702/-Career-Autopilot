// P4.10 — deterministic auto-tiering rules based on the fit score. Turns
// a numeric overall_score + hard-filter pass into the `job_scores.tier` and
// the corresponding job status.
//
// Thresholds per docs/build-phases.md P4.10:
//   >= 85          → pending_review
//   70-84          → needs_decision
//   < 70           → low_fit
// Hard-filter rejected  → rejected

export type Tier = 'auto_apply' | 'pending_review' | 'needs_decision' | 'low_fit' | 'rejected';

export interface TierInput {
  hard_filter_pass: boolean;
  overall_score: number | null;
}

export function computeTier(input: TierInput): Tier {
  if (!input.hard_filter_pass) return 'rejected';
  const score = input.overall_score ?? 0;
  if (score >= 85) return 'pending_review';
  if (score >= 70) return 'needs_decision';
  return 'low_fit';
}

// Mapping from tier to the corresponding jobs.status value the UI filters on.
export function tierToJobStatus(tier: Tier): string {
  switch (tier) {
    case 'pending_review':
      return 'pending_review';
    case 'needs_decision':
      return 'needs_decision';
    case 'low_fit':
      return 'low_fit';
    case 'auto_apply':
      return 'pending_review'; // reviewed only when ENABLE_AUTO_SUBMIT flips
    case 'rejected':
      return 'low_fit';
  }
}
