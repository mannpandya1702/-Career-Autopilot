import { describe, expect, it } from 'vitest';
import { greenhouseSubmitAdapter } from './greenhouse';
import type { SubmissionInput } from '../types';

const BASE_INPUT: SubmissionInput = {
  ats: 'greenhouse',
  ats_slug: 'acme',
  job_external_id: '123',
  apply_url: 'https://boards.greenhouse.io/acme/jobs/123',
  resume_pdf: Buffer.from('%PDF-1.4'),
  resume_filename: 'Ada_Lovelace.pdf',
  cover_letter_text: 'Cover',
  candidate: {
    full_name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: null,
    location: null,
    linkedin_url: null,
    github_url: null,
    portfolio_url: null,
  },
  answers: [],
};

describe('greenhouseSubmitAdapter', () => {
  it('routes to manual review when API key is missing', async () => {
    const r = await greenhouseSubmitAdapter.submit(BASE_INPUT, {
      enable_auto_submit: true,
    });
    expect(r.outcome).toBe('manual_review');
    if (r.outcome === 'manual_review') {
      expect(r.reason).toBe('missing_credentials');
    }
  });

  it('halts before POST when ENABLE_AUTO_SUBMIT=false', async () => {
    const r = await greenhouseSubmitAdapter.submit(
      { ...BASE_INPUT, ats_api_key: 'key' },
      { enable_auto_submit: false },
    );
    expect(r.outcome).toBe('manual_review');
    if (r.outcome === 'manual_review') {
      expect(r.reason).toBe('auto_submit_disabled');
    }
  });

  it('returns succeeded with candidate_id on a 200', async () => {
    let captured: { url?: string; method?: string } = {};
    const fetchImpl = (async (url: string, init: RequestInit) => {
      captured = { url };
      if (init.method) captured.method = init.method;
      return new Response(JSON.stringify({ success: true, candidate_id: 'cand-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const r = await greenhouseSubmitAdapter.submit(
      { ...BASE_INPUT, ats_api_key: 'key' },
      { enable_auto_submit: true, fetchImpl },
    );
    expect(r.outcome).toBe('succeeded');
    if (r.outcome === 'succeeded') {
      expect(r.external_confirmation_id).toBe('cand-1');
    }
    expect(captured.method).toBe('POST');
    expect(captured.url).toContain('/v1/boards/acme/jobs/123');
  });

  it('returns failed on non-2xx', async () => {
    const fetchImpl = (async () =>
      new Response('boom', { status: 500 })) as typeof fetch;
    const r = await greenhouseSubmitAdapter.submit(
      { ...BASE_INPUT, ats_api_key: 'key' },
      { enable_auto_submit: true, fetchImpl },
    );
    expect(r.outcome).toBe('failed');
  });
});
