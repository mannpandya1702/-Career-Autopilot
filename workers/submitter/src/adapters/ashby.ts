// Ashby Developer API submission.
// Endpoint: POST https://api.ashbyhq.com/applicationForm.submit
// Auth: Basic {base64(api_key + ":")}
// Source: docs/integrations.md §Ashby > Submit application.
//
// Without a vendor-supplied API key we cannot use the direct API and bail
// to the generic Playwright adapter — the worker handles that fallback.
// This adapter only fires when input.ats_api_key is present.

import type { SubmissionInput, SubmitAdapter, SubmitResult } from '../types';

const SUBMIT_URL = 'https://api.ashbyhq.com/applicationForm.submit';

export const ashbySubmitAdapter: SubmitAdapter = {
  ats: 'ashby',
  method: 'ats_api',
  async submit(input, options): Promise<SubmitResult> {
    const started = Date.now();

    if (!input.ats_api_key) {
      return {
        outcome: 'manual_review',
        reason: 'missing_credentials',
        context: { ats: 'ashby', apply_url: input.apply_url },
        attempt: {
          method: 'ats_api',
          success: false,
          request_payload: { url: SUBMIT_URL },
          response_payload: null,
          error_message: 'Ashby API key not configured — needs Playwright fallback',
          duration_ms: Date.now() - started,
        },
      };
    }

    if (!options.enable_auto_submit) {
      return {
        outcome: 'manual_review',
        reason: 'auto_submit_disabled',
        context: { ats: 'ashby', apply_url: input.apply_url, dry_run: true },
        attempt: {
          method: 'ats_api',
          success: false,
          request_payload: { url: SUBMIT_URL, dry_run: true },
          response_payload: null,
          error_message: 'ENABLE_AUTO_SUBMIT=false; halted before POST',
          duration_ms: Date.now() - started,
        },
      };
    }

    const fetchImpl = options.fetchImpl ?? fetch;
    const form = new FormData();
    form.append('jobPostingId', input.job_external_id);
    form.append(
      'applicationForm',
      JSON.stringify({
        fieldSubmissions: [
          { path: '_systemfield_name', value: input.candidate.full_name },
          { path: '_systemfield_email', value: input.candidate.email },
          ...(input.candidate.phone
            ? [{ path: '_systemfield_phone', value: input.candidate.phone }]
            : []),
          { path: '_systemfield_resume', value: 'resume_1' },
        ],
      }),
    );
    form.append(
      'resume_1',
      new Blob([new Uint8Array(input.resume_pdf)], { type: 'application/pdf' }),
      input.resume_filename,
    );
    if (input.cover_letter_text) {
      form.append('coverLetterText', input.cover_letter_text);
    }

    try {
      const res = await fetchImpl(SUBMIT_URL, {
        method: 'POST',
        body: form,
        headers: { Authorization: `Basic ${base64Auth(input.ats_api_key)}` },
      });
      const responseText = await res.text();
      const parsed = safeJson(responseText);
      if (!res.ok) {
        return {
          outcome: 'failed',
          error: `Ashby ${res.status}: ${responseText.slice(0, 400)}`,
          attempt: {
            method: 'ats_api',
            success: false,
            request_payload: scrub(input),
            response_payload: parsed ?? { raw: responseText.slice(0, 2000) },
            error_message: `Ashby ${res.status}`,
            duration_ms: Date.now() - started,
          },
        };
      }
      const submissionId =
        parsed && typeof parsed === 'object' && 'submissionId' in parsed
          ? String((parsed as { submissionId: unknown }).submissionId)
          : null;
      return {
        outcome: 'succeeded',
        external_confirmation_id: submissionId,
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

function base64Auth(apiKey: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(`${apiKey}:`).toString('base64');
  }
  return btoa(`${apiKey}:`);
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
