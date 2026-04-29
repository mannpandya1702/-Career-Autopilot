import { describe, expect, it } from 'vitest';
import { greenhouseAdapter } from './greenhouse';

// Checked-in fixture: representative Greenhouse Job Board API response.
// Structure verified against docs/integrations.md §Greenhouse.
const FIXTURE = {
  jobs: [
    {
      id: 127817,
      internal_job_id: 144381,
      title: 'Vault Designer',
      updated_at: '2016-01-14T10:55:28-05:00',
      requisition_id: '50',
      location: { name: 'NYC' },
      absolute_url: 'https://boards.greenhouse.io/vaulttec/jobs/127817',
      language: 'en',
      metadata: null,
      content: 'This is the job description. &lt;p&gt;HTML is escaped.&lt;/p&gt;',
      departments: [{ id: 13583, name: 'Department of Departments' }],
      offices: [{ id: 8304, name: 'East Coast', location: 'United States' }],
    },
    {
      id: 200001,
      title: 'Senior Platform Engineer II',
      updated_at: '2024-05-01T12:00:00Z',
      location: { name: 'Remote' },
      absolute_url: 'https://boards.greenhouse.io/vaulttec/jobs/200001',
      content: '&lt;p&gt;Build our infra.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Kubernetes&lt;/li&gt;&lt;/ul&gt;',
    },
  ],
  meta: { total: 2 },
};

function makeFetch(body: unknown) {
  return (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
}

describe('greenhouseAdapter', () => {
  it('parses and normalises the fixture', async () => {
    const result = await greenhouseAdapter.list({
      ats_slug: 'vaulttec',
      fetchImpl: makeFetch(FIXTURE),
    });
    expect(result.vendor_job_count).toBe(2);
    const [first, second] = result.jobs;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.external_id).toBe('127817');
    expect(first?.title).toBe('Vault Designer');
    expect(first?.normalized_title).toBe('vault designer');
    expect(first?.location).toBe('NYC');
    expect(first?.apply_url).toBe('https://boards.greenhouse.io/vaulttec/jobs/127817');
    // Double-escaped HTML should be decoded and stripped.
    expect(first?.description).toContain('HTML is escaped.');
    expect(first?.description).not.toContain('&lt;');
    expect(first?.description_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first?.posted_at).toBe('2016-01-14T10:55:28-05:00');

    expect(second?.title).toBe('Senior Platform Engineer II');
    // Stopword "II" stripped by normaliseTitle.
    expect(second?.normalized_title).toBe('senior platform engineer');
  });

  it('throws AdapterHttpError on non-2xx', async () => {
    const fetchImpl = (async () => new Response('', { status: 404 })) as typeof fetch;
    await expect(
      greenhouseAdapter.list({ ats_slug: 'missing', fetchImpl }),
    ).rejects.toThrow(/Greenhouse 404/);
  });

  it('throws AdapterShapeError on malformed payload', async () => {
    await expect(
      greenhouseAdapter.list({ ats_slug: 'x', fetchImpl: makeFetch({ unexpected: 'shape' }) }),
    ).rejects.toThrow(/shape mismatch/);
  });
});
