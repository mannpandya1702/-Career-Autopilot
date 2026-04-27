import { describe, expect, it } from 'vitest';
import { leverSubmitAdapter } from './lever';
import type { SubmissionInput } from '../types';

const BASE: SubmissionInput = {
  ats: 'lever',
  ats_slug: 'leverdemo',
  job_external_id: 'abc',
  apply_url: 'https://jobs.lever.co/leverdemo/abc/apply',
  resume_pdf: Buffer.from('%PDF-1.4'),
  resume_filename: 'Ada.pdf',
  cover_letter_text: null,
  candidate: {
    full_name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: null,
    location: null,
    linkedin_url: 'https://linkedin.com/in/ada',
    github_url: null,
    portfolio_url: null,
  },
  answers: [],
};

describe('leverSubmitAdapter', () => {
  it('halts before POST when ENABLE_AUTO_SUBMIT=false', async () => {
    const r = await leverSubmitAdapter.submit(BASE, { enable_auto_submit: false });
    expect(r.outcome).toBe('manual_review');
    if (r.outcome === 'manual_review') {
      expect(r.reason).toBe('auto_submit_disabled');
    }
  });

  it('hits the EU host when apply_url is on api.eu.lever.co', async () => {
    let capturedUrl = '';
    const fetchImpl = (async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ ok: true, applicationId: 'app-1' }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    const r = await leverSubmitAdapter.submit(
      { ...BASE, apply_url: 'https://jobs.eu.lever.co/leverdemo/abc/apply' },
      { enable_auto_submit: true, fetchImpl },
    );
    expect(r.outcome).toBe('succeeded');
    expect(capturedUrl).toContain('api.eu.lever.co');
  });

  it('reports a 429 as failed (rate-limited)', async () => {
    const fetchImpl = (async () => new Response('rate limited', { status: 429 })) as typeof fetch;
    const r = await leverSubmitAdapter.submit(BASE, {
      enable_auto_submit: true,
      fetchImpl,
    });
    expect(r.outcome).toBe('failed');
  });
});
