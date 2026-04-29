import { describe, expect, it } from 'vitest';
import { leverAdapter } from './lever';

const FIXTURE = [
  {
    id: 'ff7ef527-b0d3-4c44-836a-8d6b58ac321e',
    text: 'Account Executive',
    hostedUrl: 'https://jobs.lever.co/leverdemo/ff7ef527/',
    applyUrl: 'https://jobs.lever.co/leverdemo/ff7ef527/apply',
    categories: {
      commitment: 'Full Time',
      department: 'Sales',
      location: 'Toronto',
      team: 'Account Executive',
    },
    createdAt: 1502907172814,
    descriptionPlain: 'Work at Lever...',
    description: '<div>Work at Lever.</div>',
    additionalPlain: 'The Lever Story...',
    additional: '<div>The Lever Story.</div>',
    lists: [
      { text: 'About the Gig:', content: '<li>Do stuff</li>' },
      { text: 'About You:', content: '<li>Be awesome</li>' },
    ],
    workplaceType: 'remote',
    salaryRange: { currency: 'USD', interval: 'per-year-salary', min: 80000, max: 120000 },
  },
];

function makeFetch(body: unknown) {
  return (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
}

describe('leverAdapter', () => {
  it('parses and normalises the fixture (bare array response)', async () => {
    const result = await leverAdapter.list({ ats_slug: 'leverdemo', fetchImpl: makeFetch(FIXTURE) });
    expect(result.vendor_job_count).toBe(1);
    const [job] = result.jobs;
    expect(job).toBeDefined();
    expect(job?.external_id).toBe('ff7ef527-b0d3-4c44-836a-8d6b58ac321e');
    expect(job?.title).toBe('Account Executive');
    expect(job?.location).toBe('Toronto');
    expect(job?.remote_policy).toBe('remote');
    // Description concatenates description + additional + list contents.
    expect(job?.description).toContain('Work at Lever.');
    expect(job?.description).toContain('The Lever Story.');
    expect(job?.description).toContain('About the Gig:');
    expect(job?.description).toContain('Do stuff');
    // createdAt ms → ISO.
    expect(job?.posted_at).toBe(new Date(1502907172814).toISOString());
    expect(job?.salary_min).toBe(80000);
    expect(job?.salary_max).toBe(120000);
    expect(job?.salary_currency).toBe('USD');
    expect(job?.apply_url).toBe('https://jobs.lever.co/leverdemo/ff7ef527/apply');
  });

  it('hits the EU host when region=eu', async () => {
    let capturedUrl = '';
    const fetchImpl = (async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;
    await leverAdapter.list({ ats_slug: 'x', region: 'eu', fetchImpl });
    expect(capturedUrl).toContain('api.eu.lever.co');
  });

  it('falls back to hostedUrl when applyUrl is missing', async () => {
    const [base] = FIXTURE;
    if (!base) throw new Error('fixture empty');
    const { applyUrl: _drop, ...rest } = base;
    const result = await leverAdapter.list({
      ats_slug: 'x',
      fetchImpl: makeFetch([rest]),
    });
    expect(result.jobs[0]?.apply_url).toBe(base.hostedUrl);
  });
});
