// Lever Postings API submission.
// Endpoint: POST https://api.lever.co/v0/postings/{site}/{id}
// Source: docs/integrations.md §Lever > Submit application.
//
// Lever doesn't require auth on the public Postings API but is heavily
// rate limited. We rely on the per-ATS rate limiter in the worker
// (default 1 req / 500ms) and back off on 429.

import type { SubmissionInput, SubmitAdapter, SubmitResult } from '../types';

const BASE = 'https://api.lever.co/v0/postings';
const EU_BASE = 'https://api.eu.lever.co/v0/postings';

export const leverSubmitAdapter: SubmitAdapter = {
  ats: 'lever',
  method: 'ats_api',
  async submit(input, options): Promise<SubmitResult> {
    const started = Date.now();
    const isEu = /api\.eu\.lever\.co|jobs\.eu\.lever\.co/i.test(input.apply_url);
    const url = `${isEu ? EU_BASE : BASE}/${encodeURIComponent(
      input.ats_slug,
    )}/${encodeURIComponent(input.job_external_id)}`;

    if (!options.enable_auto_submit) {
      return {
        outcome: 'manual_review',
        reason: 'auto_submit_disabled',
        context: { ats: 'lever', apply_url: input.apply_url, dry_run: true },
        attempt: {
          method: 'ats_api',
          success: false,
          request_payload: { url, dry_run: true },
          response_payload: null,
          error_message: 'ENABLE_AUTO_SUBMIT=false; halted before POST',
          duration_ms: Date.now() - started,
        },
      };
    }

    const fetchImpl = options.fetchImpl ?? fetch;
    const body = buildForm(input);

    try {
      const res = await fetchImpl(url, { method: 'POST', body });
      const responseText = await res.text();
      const parsed = safeJson(responseText);
      if (res.status === 429) {
        return {
          outcome: 'failed',
          error: 'Lever 429 (rate limited) — retry later',
          attempt: {
            method: 'ats_api',
            success: false,
            request_payload: scrub(input),
            response_payload: parsed ?? { raw: responseText.slice(0, 2000) },
            error_message: 'Lever 429',
            duration_ms: Date.now() - started,
          },
        };
      }
      if (!res.ok) {
        return {
          outcome: 'failed',
          error: `Lever ${res.status}: ${responseText.slice(0, 400)}`,
          attempt: {
            method: 'ats_api',
            success: false,
            request_payload: scrub(input),
            response_payload: parsed ?? { raw: responseText.slice(0, 2000) },
            error_message: `Lever ${res.status}`,
            duration_ms: Date.now() - started,
          },
        };
      }
      const applicationId =
        parsed && typeof parsed === 'object' && 'applicationId' in parsed
          ? String((parsed as { applicationId: unknown }).applicationId)
          : null;
      return {
        outcome: 'succeeded',
        external_confirmation_id: applicationId,
        attempt: {
          method: 'ats_api',
          success: true,
          request_payload: scrub(input),
          response_payload: parsed ?? { raw: responseText.slice(0, 2000) },
          duration_ms: Date.now() - started,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        outcome: 'failed',
        error: message,
        attempt: {
          method: 'ats_api',
          success: false,
          request_payload: scrub(input),
          response_payload: null,
          error_message: message,
          duration_ms: Date.now() - started,
        },
      };
    }
  },
};

function buildForm(input: SubmissionInput): FormData {
  const form = new FormData();
  form.append('name', input.candidate.full_name);
  form.append('email', input.candidate.email);
  if (input.candidate.phone) form.append('phone', input.candidate.phone);
  form.append(
    'resume',
    new Blob([new Uint8Array(input.resume_pdf)], { type: 'application/pdf' }),
    input.resume_filename,
  );
  if (input.candidate.linkedin_url) form.append('urls[linkedin]', input.candidate.linkedin_url);
  if (input.candidate.github_url) form.append('urls[github]', input.candidate.github_url);
  if (input.candidate.portfolio_url) form.append('urls[portfolio]', input.candidate.portfolio_url);
  if (input.cover_letter_text) form.append('comments', input.cover_letter_text);
  // Suppress the auto-confirm email so duplicates don't spam if we retry.
  form.append('silent', 'true');
  return form;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function scrub(input: SubmissionInput): Record<string, unknown> {
  return {
    ats: input.ats,
    ats_slug: input.ats_slug,
    job_external_id: input.job_external_id,
    apply_url: input.apply_url,
    candidate: { email: input.candidate.email },
    resume_filename: input.resume_filename,
    cover_letter_chars: input.cover_letter_text?.length ?? 0,
  };
}
