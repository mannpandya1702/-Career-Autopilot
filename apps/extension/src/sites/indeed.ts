// Indeed viewjob DOM extraction. Indeed's DOM is more stable than
// LinkedIn's; the canonical viewjob URL is /viewjob?jk={id}.

import { inferRemotePolicy } from './linkedin';
import type { ExtractedJob } from '../types';

const URL_ID_RE = /[?&]jk=([a-z0-9]+)/i;

const SELECTORS = {
  title: ['h1.jobsearch-JobInfoHeader-title', 'h1[data-testid="jobsearch-JobInfoHeader-title"]'],
  company: [
    'div[data-company-name]',
    'div.jobsearch-CompanyInfoContainer a',
    'div.jobsearch-InlineCompanyRating div:first-child',
  ],
  location: [
    'div[data-testid="job-location"]',
    'div.jobsearch-JobInfoHeader-subtitle div:nth-child(2)',
  ],
  description: ['#jobDescriptionText', 'div.jobsearch-jobDescriptionText'],
  easyApply: ['button[data-testid="indeedApplyButton"]', '#indeedApplyButton'],
};

export function isIndeedJobUrl(url: string): boolean {
  return /indeed\.com\/(viewjob|jobs)/i.test(url);
}

export function extractIndeedJobId(url: string): string | null {
  return url.match(URL_ID_RE)?.[1] ?? null;
}

export function extractIndeedJob(doc: Document, url: string): ExtractedJob | null {
  const title = pickText(doc, SELECTORS.title);
  const company = pickText(doc, SELECTORS.company);
  if (!title || !company) return null;

  const location = pickText(doc, SELECTORS.location);
  const description = pickText(doc, SELECTORS.description) ?? '';
  const easyApply = SELECTORS.easyApply.some((sel) => doc.querySelector(sel) !== null);

  return {
    source: 'indeed',
    source_url: url,
    external_id: extractIndeedJobId(url),
    title: title.trim(),
    company: company.trim(),
    location: location?.trim() ?? null,
    remote_policy: inferRemotePolicy(location, description),
    description: description.trim(),
    easy_apply: easyApply,
    posted_at: null,
  };
}

function pickText(doc: Document, selectors: string[]): string | null {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el?.textContent && el.textContent.trim().length > 0) {
      return el.textContent.trim();
    }
  }
  return null;
}
