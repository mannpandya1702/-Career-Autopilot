import { describe, expect, it } from 'vitest';
import { pickSubmitAdapter } from './router';
import type { SubmitAdapter } from './types';

const playwright: SubmitAdapter = {
  ats: 'custom',
  method: 'playwright',
  async submit() {
    return {
      outcome: 'succeeded',
      external_confirmation_id: null,
      attempt: {
        method: 'playwright',
        success: true,
        request_payload: null,
        response_payload: null,
        duration_ms: 1,
      },
    };
  },
};

describe('pickSubmitAdapter', () => {
  it('routes greenhouse to API when key present', () => {
    const a = pickSubmitAdapter('greenhouse', { hasGreenhouseKey: true });
    expect(a?.ats).toBe('greenhouse');
    expect(a?.method).toBe('ats_api');
  });

  it('routes greenhouse to playwright when key absent', () => {
    const a = pickSubmitAdapter('greenhouse', { playwrightAdapter: playwright });
    expect(a?.method).toBe('playwright');
  });

  it('routes lever directly to API regardless of key', () => {
    expect(pickSubmitAdapter('lever')?.method).toBe('ats_api');
  });

  it('routes ashby to API only when key present', () => {
    expect(pickSubmitAdapter('ashby', { hasAshbyKey: true })?.method).toBe('ats_api');
    expect(
      pickSubmitAdapter('ashby', { playwrightAdapter: playwright })?.method,
    ).toBe('playwright');
  });

  it('routes workable to playwright always (or builtin manual-review stub)', () => {
    expect(pickSubmitAdapter('workable')?.ats).toBe('workable');
    expect(pickSubmitAdapter('workable', { playwrightAdapter: playwright })?.method).toBe(
      'playwright',
    );
  });

  it('returns null for custom when no playwright adapter is wired', () => {
    expect(pickSubmitAdapter('custom')).toBeNull();
  });
});
