// Workable submission. Per docs/integrations.md §Workable, the public
// widget API is read-only — submissions go through the hosted apply form.
// We delegate to the generic Playwright adapter at runtime; this module
// exists so the router has an explicit ats: 'workable' handler that
// surfaces the correct manual-review reason when Playwright is unavailable.

import type { SubmitAdapter, SubmitResult } from '../types';

export const workableSubmitAdapter: SubmitAdapter = {
  ats: 'workable',
  method: 'playwright',
  async submit(input, _options): Promise<SubmitResult> {
    const started = Date.now();
    return {
      outcome: 'manual_review',
      reason: 'unsupported_ats',
      context: {
        ats: 'workable',
        apply_url: input.apply_url,
        note: 'Workable has no public submission API; use generic Playwright adapter',
      },
      attempt: {
        method: 'playwright',
        success: false,
        request_payload: { apply_url: input.apply_url },
        response_payload: null,
        error_message:
          'Workable submission requires Playwright; route via genericPlaywrightAdapter',
        duration_ms: Date.now() - started,
      },
    };
  },
};
