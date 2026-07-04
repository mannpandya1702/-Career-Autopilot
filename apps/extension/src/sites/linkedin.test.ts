// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  extractLinkedInJob,
  extractLinkedInJobId,
  inferRemotePolicy,
  isLinkedInJobUrl,
} from './linkedin';

function makeDoc(html: string): Document {
  document.documentElement.innerHTML = `<head></head><body>${html}</body>`;
  return document;
}

describe('isLinkedInJobUrl', () => {
  it('matches /jobs/view + /jobs/search', () => {
    expect(isLinkedInJobUrl('https://www.linkedin.com/jobs/view/12345')).toBe(true);
    expect(isLinkedInJobUrl('https://linkedin.com/jobs/search/?currentJobId=42')).toBe(true);
    expect(isLinkedInJobUrl('https://www.linkedin.com/feed/')).toBe(false);
  });
});

describe('extractLinkedInJobId', () => {
  it('pulls from /jobs/view path', () => {
    expect(extractLinkedInJobId('https://www.linkedin.com/jobs/view/12345')).toBe('12345');
  });
  it('pulls from currentJobId param', () => {
    expect(
      extractLinkedInJobId('https://www.linkedin.com/jobs/search/?currentJobId=999&geoId=1'),
    ).toBe('999');
  });
  it('returns null when no id', () => {
    expect(extractLinkedInJobId('https://example.com/page')).toBeNull();
  });
});

describe('inferRemotePolicy', () => {
  it('detects remote / hybrid / onsite', () => {
    expect(inferRemotePolicy('Remote — anywhere')).toBe('remote');
    expect(inferRemotePolicy(null, 'Hybrid in NYC')).toBe('hybrid');
    expect(inferRemotePolicy('On-site, San Francisco')).toBe('onsite');
    expect(inferRemotePolicy('San Francisco, CA')).toBeNull();
  });
});

describe('extractLinkedInJob', () => {
  it('extracts the standard fields from a representative DOM', () => {
    const doc = makeDoc(`
      <h1 class="t-24">Senior Software Engineer</h1>
      <div class="job-details-jobs-unified-top-card__company-name">
        <a href="/company/acme">Acme Corp</a>
      </div>
      <span class="job-details-jobs-unified-top-card__bullet">San Francisco, CA · Remote</span>
      <div id="job-details">Build distributed systems with Postgres and TypeScript.</div>
      <button aria-label="Easy Apply to Acme">Easy Apply</button>
    `);
    const job = extractLinkedInJob(doc, 'https://www.linkedin.com/jobs/view/12345');
    expect(job).not.toBeNull();
    expect(job?.title).toBe('Senior Software Engineer');
    expect(job?.company).toBe('Acme Corp');
    expect(job?.location).toBe('San Francisco, CA');
    expect(job?.remote_policy).toBe('remote');
    expect(job?.description).toContain('Postgres');
    expect(job?.easy_apply).toBe(true);
    expect(job?.external_id).toBe('12345');
  });

  it('returns null when title or company is missing', () => {
    const doc = makeDoc(`<h1 class="t-24">Standalone Title</h1>`);
    expect(extractLinkedInJob(doc, 'https://www.linkedin.com/jobs/view/1')).toBeNull();
  });
});
