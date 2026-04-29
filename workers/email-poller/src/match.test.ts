import { describe, expect, it } from 'vitest';
import { matchEmailToSubmission, type SubmissionForMatch } from './match';

const NOW = new Date('2026-04-21T00:00:00Z');

const SUBS: SubmissionForMatch[] = [
  {
    submission_id: 'a',
    company_name: 'Stripe',
    job_title: 'Senior Engineer',
    submitted_at: '2026-04-15T00:00:00Z',
    current_stage: null,
  },
  {
    submission_id: 'b',
    company_name: 'Linear',
    job_title: 'Staff Engineer',
    submitted_at: '2026-04-10T00:00:00Z',
    current_stage: null,
  },
  {
    submission_id: 'c',
    company_name: 'Vercel',
    job_title: 'Engineer',
    submitted_at: '2025-01-01T00:00:00Z', // > 60 days
    current_stage: null,
  },
];

describe('matchEmailToSubmission', () => {
  it('matches the company name in the email body', () => {
    const r = matchEmailToSubmission({
      job_match_signal: null,
      email_from: 'noreply@stripe.com',
      email_body: 'Thanks for applying to Stripe — next steps below.',
      candidates: SUBS,
      now: NOW,
    });
    expect(r).toBe('a');
  });

  it('uses the job_match_signal as a hint', () => {
    const r = matchEmailToSubmission({
      job_match_signal: 'Linear Staff Engineer',
      email_from: 'recruiting@example.com',
      email_body: 'We received your application.',
      candidates: SUBS,
      now: NOW,
    });
    expect(r).toBe('b');
  });

  it('skips submissions older than 60 days', () => {
    const r = matchEmailToSubmission({
      job_match_signal: null,
      email_from: 'noreply@vercel.com',
      email_body: 'Thanks for applying to Vercel.',
      candidates: SUBS,
      now: NOW,
    });
    expect(r).toBeNull();
  });

  it('skips submissions in terminal stages', () => {
    const r = matchEmailToSubmission({
      job_match_signal: null,
      email_from: 'noreply@stripe.com',
      email_body: 'Thanks for applying to Stripe.',
      candidates: [{ ...SUBS[0]!, current_stage: 'rejection' }],
      now: NOW,
    });
    expect(r).toBeNull();
  });
});
