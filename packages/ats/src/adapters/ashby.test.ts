import { describe, expect, it } from 'vitest';
import { ashbyAdapter } from './ashby';

const FIXTURE = {
  apiVersion: '1',
  jobs: [
    {
      title: 'Product Manager',
      location: 'Houston, TX',
      department: 'Product',
      team: 'Growth',
      isListed: true,
      isRemote: true,
      workplaceType: 'Remote',
      descriptionHtml: '<p>Join our team</p>',
      descriptionPlain: 'Join our team',
      publishedAt: '2021-04-30T16:21:55.393+00:00',
      employmentType: 'FullTime',
      jobUrl: 'https://jobs.ashbyhq.com/example/job',
      applyUrl: 'https://jobs.ashbyhq.com/example/abc123/application',
      compensation: {
        compensationTierSummary: '$81K – $87K • 0.5% – 1.75%',
        scrapeableCompensationSalarySummary: '$81K - $87K',
      },
    },
    {
      title: 'Unlisted Role',
      location: null,
      isListed: false,
      applyUrl: 'https://jobs.ashbyhq.com/example/unlisted/application',
    },
  ],
};

function makeFetch(body: unknown) {
  return (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
}

describe('ashbyAdapter', () => {
  it('skips isListed=false postings', async () => {
    const result = await ashbyAdapter.list({ ats_slug: 'example', fetchImpl: makeFetch(FIXTURE) });
    expect(result.jobs).toHaveLength(1);
    expect(result.vendor_job_count).toBe(2);
  });

  it('extracts id from applyUrl and normalises salary + work mode', async () => {
    const result = await ashbyAdapter.list({ ats_slug: 'example', fetchImpl: makeFetch(FIXTURE) });
    const [job] = result.jobs;
    expect(job?.external_id).toBe('abc123');
    expect(job?.title).toBe('Product Manager');
    expect(job?.remote_policy).toBe('remote');
    expect(job?.salary_min).toBe(81000);
    expect(job?.salary_max).toBe(87000);
    expect(job?.salary_currency).toBe('USD');
    expect(job?.posted_at).toBe('2021-04-30T16:21:55.393+00:00');
    expect(job?.description).toBe('Join our team');
  });
});
