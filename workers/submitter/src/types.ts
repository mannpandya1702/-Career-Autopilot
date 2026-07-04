// Common shape every submission adapter consumes + produces. Adapter call
// signatures (per docs/build-phases.md §8.5):
//
//   submit(context, job, tailoredResume, coverLetter, answers, options)
//     → SubmitResult
//
// Adapters never see secrets unless they're explicitly required to call
// the vendor API; in those cases the caller injects the key via options.
// Submission attempts that need a key but don't have one bail to manual
// review with reason='missing_credentials'.

import type { AtsType, SubmitMethod } from '@career-autopilot/db';

export interface CandidateProfile {
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
}

export interface AnswerInput {
  question_text: string;
  answer_text: string;
  question_type: string;
  word_limit: number | null;
}

export interface SubmissionInput {
  // Identifies what we are about to submit.
  ats: AtsType;
  ats_slug: string;
  job_external_id: string;
  apply_url: string;

  // Artefacts to upload.
  resume_pdf: Buffer;
  resume_filename: string;
  cover_letter_text: string | null;

  // The candidate.
  candidate: CandidateProfile;

  // The Q&A bank pre-baked for this job.
  answers: AnswerInput[];

  // Optional per-vendor API key when we have one. Without it, ATS-API
  // adapters bail to playwright (or to manual-review when neither path
  // is available).
  ats_api_key?: string;
}

export interface SubmissionOptions {
  // Hard guard: when false, adapters MUST run in dry-run and never POST
  // a real submission to the vendor. Default false (CLAUDE.md §6 + §12).
  enable_auto_submit: boolean;
  // Fixed total cap across all adapters. Worker enforces; adapters don't.
  fetchImpl?: typeof fetch;
}

export interface SubmissionAttemptRecord {
  method: SubmitMethod;
  success: boolean;
  request_payload: unknown;
  response_payload: unknown;
  error_message?: string;
  duration_ms: number;
}

export type ManualReviewReason =
  | 'missing_credentials'
  | 'captcha'
  | 'sso'
  | 'selector_missing'
  | 'auto_submit_disabled'
  | 'unsupported_ats'
  | 'unexpected_error';

export interface SubmitResultSucceeded {
  outcome: 'succeeded';
  external_confirmation_id: string | null;
  attempt: SubmissionAttemptRecord;
}

export interface SubmitResultManualReview {
  outcome: 'manual_review';
  reason: ManualReviewReason;
  context: Record<string, unknown>;
  attempt: SubmissionAttemptRecord;
}

export interface SubmitResultFailed {
  outcome: 'failed';
  error: string;
  attempt: SubmissionAttemptRecord;
}

export type SubmitResult =
  | SubmitResultSucceeded
  | SubmitResultManualReview
  | SubmitResultFailed;

export interface SubmitAdapter {
  readonly ats: AtsType;
  readonly method: SubmitMethod;
  submit(input: SubmissionInput, options: SubmissionOptions): Promise<SubmitResult>;
}

export class SubmitHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'SubmitHttpError';
  }
}
