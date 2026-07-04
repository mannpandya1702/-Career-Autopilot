import { describe, expect, it } from 'vitest';
import { workableAdapter } from './workable';

const FIXTURE = {
  name: 'Example Co',
  description: 'Company description',
  jobs: [
    {
      id: 'ABC123',
      shortcode: 'ABC123',
      title: 'Senior Engineer',
      full_title: 'Senior Engineer - Platform',
      location: { city: 'Berlin', country: 'Germany', workplace_type: 'hybrid' },
      department: 'Engineering',
      published_on: '2025-01-15',
      created_at: '2025-01-10T12:00:00Z',
      apply_url: 'https://apply.workable.com/example/j/ABC123/',
      description: '<p>Build cool things.</p>',
      requirements: '<p>Requirements here.</p>',
      benefits: '<p>Benefits here.</p>',
      employment_type: 'Full-time',
      salary: null,
    },
  ],
};

function makeFetch(body: unknown) {
  return (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
}

describe('workableAdapter', () => {
  it('parses and normalises the fixture', async () => {
    const result = await workableAdapter.list({ ats_slug: 'example', fetchImpl: makeFetch(FIXTURE) });
    expect(result.vendor_job_count).toBe(1);
    const [job] = result.jobs;
    expect(job?.external_id).toBe('ABC123');
    expect(job?.title).toBe('Senior Engineer');
    expect(job?.location).toBe('Berlin, Germany');
    expect(job?.remote_policy).toBe('hybrid');
    expect(job?.description).toContain('Build cool things.');
    expect(job?.description).toContain('Requirements here.');
    expect(job?.description).toContain('Benefits here.');
    expect(job?.posted_at).toBe('2025-01-10T12:00:00Z');
    expect(job?.apply_url).toBe('https://apply.workable.com/example/j/ABC123/');
  });
});
