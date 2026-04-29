// Greenhouse Job Board API submission.
// Endpoint: POST https://boards-api.greenhouse.io/v1/boards/{token}/jobs/{id}
// Source: docs/integrations.md §Greenhouse > Submit an application.
//
// Auth: Basic {base64(api_key + ":")}. Without a key, we bail to
// manual-review with reason='missing_credentials' and let the user
// either supply a key or submit manually via the apply page.

import type { SubmissionInput, SubmitAdapter, SubmitResult } from '../types';

const BASE = 'https://boards-api.greenhouse.io/v1/boards';

export const greenhouseSubmitAdapter: SubmitAdapter = {
  ats: 'greenhouse',
  method: 'ats_api',
  async submit(input, options): Promise<SubmitResult> {
    const started = Date.now();
    const url = `${BASE}/${encodeURIComponent(input.ats_slug)}/jobs/${encodeURIComponent(
      input.job_external_id,
    )}`;

    if (!input.ats_api_key) {
      return {
        outcome: 'manual_review',
        reason: 'missing_credentials',
        context: { ats: 'greenhouse', apply_url: input.apply_url },
        attempt: {
          method: 'ats_api',
          success: false,
          request_payload: { url },
          response_payload: null,
          error_message: 'Greenhouse Job Board API key not configured',
          duration_ms: Date.now() - started,
        },
      };
    }

    if (!options.enable_auto_submit) {
      return {
        outcome: 'manual_review',
        reason: 'auto_submit_disabled',
        context: { ats: 'greenhouse', apply_url: input.apply_url, dry_run: true },
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
    const headers = new Headers({
      Authorization: `Basic ${base64Auth(input.ats_api_key)}`,
    });

    try {
      const res = await fetchImpl(url, { method: 'POST', body, headers });
      const responseText = await res.text();
      const parsed = safeJson(responseText);
      if (!res.ok) {
        return {
          outcome: 'failed',
          error: `Greenhouse ${res.status}: ${responseText.slice(0, 400)}`,
          attempt: {
            method: 'ats_api',
            success: false,
            request_payload: scrub(input),
            response_payload: parsed ?? { raw: responseText.slice(0, 2000) },
            error_message: `Greenhouse ${res.status}`,
            duration_ms: Date.now() - started,
          },
        };
      }
      const candidateId =
        parsed && typeof parsed === 'object' && 'candidate_id' in parsed
          ? String((parsed as { candidate_id: unknown }).candidate_id)
          : null;
      return {
        outcome: 'succeeded',
        external_confirmation_id: candidateId,
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
  const [first, ...rest] = input.candidate.full_name.split(/\s+/);
  form.append('first_name', first ?? input.candidate.full_name);
  form.append('last_name', rest.join(' '));
  form.append('email', input.candidate.email);
  if (input.candidate.phone) form.append('phone', input.candidate.phone);
  if (input.candidate.location) form.append('location', input.candidate.location);
  form.append(
    'resume',
    new Blob([new Uint8Array(input.resume_pdf)], { type: 'application/pdf' }),
    input.resume_filename,
  );
  if (input.cover_letter_text) {
    form.append('cover_letter_text', input.cover_letter_text);
  }
  return form;
}

function base64Auth(apiKey: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(`${apiKey}:`).toString('base64');
  }
  // browser fallback (workers run on Node, so this never fires in prod)
  return btoa(`${apiKey}:`);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Strip the resume bytes + Authorization header before persisting the
// attempt; the rest of the form is small and useful for debugging.
function scrub(input: SubmissionInput): Record<string, unknown> {
  return {
    ats: input.ats,
    ats_slug: input.ats_slug,
    job_external_id: input.job_external_id,
    apply_url: input.apply_url,
    candidate: {
      email: input.candidate.email,
      full_name_redacted_length: input.candidate.full_name.length,
    },
    resume_filename: input.resume_filename,
    cover_letter_chars: input.cover_letter_text?.length ?? 0,
  };
}
