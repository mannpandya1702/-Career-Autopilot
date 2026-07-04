// LinkedIn job page DOM extraction. CLAUDE.md §8.8 + §12 #7: we read
// the user's own session — never a headless bot. Selectors below were
// observed on linkedin.com/jobs/view/{id} pages; LinkedIn rotates
// markup so any breakage routes to docs/runbooks/ats-selector-broken.md
// per the standard playbook.

import type { ExtractedJob } from '../types';

// LinkedIn embeds the current job id in the URL as `?currentJobId=…` on
// /jobs/search/* views and in the path on /jobs/view/{id}.
const URL_ID_RE = /\/jobs\/view\/(\d+)|[?&]currentJobId=(\d+)/;

const SELECTORS = {
  title: [
    '.job-details-jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title h1',
    'h1.t-24',
  ],
  company: [
    '.job-details-jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
  ],
  location: [
    '.job-details-jobs-unified-top-card__bullet',
    '.jobs-unified-top-card__bullet',
  ],
  description: [
    '#job-details',
    '.jobs-description__content .jobs-box__html-content',
    '.jobs-description-content__text',
  ],
  easyApplyButton: [
    'button[aria-label*="Easy Apply"]',
    'button.jobs-apply-button[data-control-name="jobdetails_topcard_inapply"]',
  ],
};

export function isLinkedInJobUrl(url: string): boolean {
  if (!/linkedin\.com/.test(url)) return false;
  return /\/jobs\/(view|search)/.test(url);
}

export function extractLinkedInJobId(url: string): string | null {
  const m = url.match(URL_ID_RE);
  return m?.[1] ?? m?.[2] ?? null;
}

export function extractLinkedInJob(doc: Document, url: string): ExtractedJob | null {
  const title = pickText(doc, SELECTORS.title);
  const company = pickText(doc, SELECTORS.company);
  if (!title || !company) return null;

  const locationRaw = pickText(doc, SELECTORS.location);
  const description = pickText(doc, SELECTORS.description) ?? '';
  const remote = inferRemotePolicy(locationRaw, description);
  const easyApply = SELECTORS.easyApplyButton.some(
    (sel) => doc.querySelector(sel) !== null,
  );

  return {
    source: 'linkedin',
    source_url: url,
    external_id: extractLinkedInJobId(url),
    title: title.trim(),
    company: company.trim(),
    location: locationRaw ? cleanLocation(locationRaw) : null,
    remote_policy: remote,
    description: description.trim(),
    easy_apply: easyApply,
    posted_at: null, // LinkedIn shows "1 day ago" strings; resolve server-side.
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

function cleanLocation(raw: string): string {
  // LinkedIn appends "·" + posted date or "·" + remote tag — strip after the
  // first separator.
  return raw.split(/[·•]/)[0]?.trim() ?? raw.trim();
}

const REMOTE_RE = /\bremote\b/i;
const HYBRID_RE = /\bhybrid\b/i;
const ONSITE_RE = /\bon[-\s]?site\b/i;

export function inferRemotePolicy(
  ...sources: (string | null | undefined)[]
): ExtractedJob['remote_policy'] {
  const haystack = sources.filter(Boolean).join(' ');
  if (REMOTE_RE.test(haystack)) return 'remote';
  if (HYBRID_RE.test(haystack)) return 'hybrid';
  if (ONSITE_RE.test(haystack)) return 'onsite';
  return null;
}
