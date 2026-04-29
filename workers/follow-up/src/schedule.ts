// Compute follow-up actions for a submission per docs/build-phases.md P8.10:
//   day 7 with no response  → send a brief follow-up via Gmail SMTP.
//   day 14 with no response → mark as 'stale' (status update only).
//
// "No response" means there's no outcome row downstream of the submission.
// Outcomes land in Phase 9 — until then, day-14-stale is the only action
// that's safe to run end-to-end. Day-7 follow-up emails are deferred until
// the cover-letter worker exists; the schedule helper is ready for it.

export type FollowUpAction =
  | { kind: 'send_followup'; submission_id: string }
  | { kind: 'mark_stale'; submission_id: string }
  | { kind: 'none' };

export interface SubmissionForSchedule {
  submission_id: string;
  submitted_at: string;
  has_outcome: boolean;
  followup_sent_at: string | null;
  status: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function planFollowUp(
  submission: SubmissionForSchedule,
  now: Date = new Date(),
): FollowUpAction {
  if (submission.has_outcome) return { kind: 'none' };
  if (submission.status === 'stale' || submission.status === 'failed' || submission.status === 'skipped') {
    return { kind: 'none' };
  }
  const submitted = new Date(submission.submitted_at).getTime();
  const ageDays = (now.getTime() - submitted) / DAY_MS;
  if (ageDays >= 14) return { kind: 'mark_stale', submission_id: submission.submission_id };
  if (ageDays >= 7 && !submission.followup_sent_at) {
    return { kind: 'send_followup', submission_id: submission.submission_id };
  }
  return { kind: 'none' };
}
