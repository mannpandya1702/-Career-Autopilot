// Ashby Public Job Posting API adapter.
// Endpoint: GET https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true
// Source: docs/integrations.md §Ashby.

import {
  type Adapter,
  type AdapterInput,
  type AdapterResult,
  AdapterHttpError,
  AdapterShapeError,
  type NormalisedJob,
  normaliseTitle,
  sha256Hex,
} from '../types';
import { AshbyListResponseSchema, type AshbyPosting } from '../schemas/ashby';
import { stripHtml } from '../html-utils';
import type { WorkMode } from '@career-autopilot/db';

const BASE = 'https://api.ashbyhq.com/posting-api/job-board';

// The discovery response doesn't include a top-level id; extract it from
// applyUrl. Pattern: jobs.ashbyhq.com/{org}/{id} or /{id}/application.
const ASHBY_ID_RE = /jobs\.ashbyhq\.com\/[^/]+\/([^/?#]+)/i;

export const ashbyAdapter: Adapter = {
  ats: 'ashby',
  async list(input: AdapterInput): Promise<AdapterResult> {
    const fetchImpl = input.fetchImpl ?? fetch;
    const url = `${BASE}/${encodeURIComponent(input.ats_slug)}?includeCompensation=true`;
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new AdapterHttpError(`Ashby ${res.status}`, res.status, url);
    }
    const body = (await res.json()) as unknown;
    const parsed = AshbyListResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new AdapterShapeError(
        `Ashby response shape mismatch: ${parsed.error.issues
          .slice(0, 3)
          .map((i) => i.path.join('.'))
          .join(', ')}`,
        url,
      );
    }

    const jobs = await Promise.all(parsed.data.jobs.filter(isListed).map(normaliseAshbyPosting));
    return { jobs, vendor_job_count: parsed.data.jobs.length };
  },
};

function isListed(p: AshbyPosting): boolean {
  return p.isListed !== false;
}

function mapWorkplaceType(w: AshbyPosting['workplaceType']): WorkMode | null {
  switch (w) {
    case 'Remote':
      return 'remote';
    case 'Hybrid':
      return 'hybrid';
    case 'OnSite':
      return 'onsite';
    default:
      return null;
  }
}

// Pull "$81K" / "$81,000" tokens from a summary like "$81K - $87K".
function parseSalarySummary(summary?: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  if (!summary) return { min: null, max: null, currency: null };
  const currencyMatch = summary.match(/\b(USD|EUR|GBP|INR|CAD|AUD)\b|[$€£₹]/);
  const currency = currencyMatch
    ? currencyMatch[1] ??
      ({ $: 'USD', '€': 'EUR', '£': 'GBP', '₹': 'INR' } as Record<string, string>)[currencyMatch[0]] ??
      null
    : null;
  const tokens = [...summary.matchAll(/([\d,.]+)\s*([Kk]|[Mm])?/g)]
    .map((m) => {
      const raw = (m[1] ?? '').replace(/,/g, '');
      const n = Number.parseFloat(raw);
      if (!Number.isFinite(n)) return null;
      const suffix = m[2]?.toLowerCase();
      if (suffix === 'k') return n * 1_000;
      if (suffix === 'm') return n * 1_000_000;
      return n;
    })
    .filter((n): n is number => n != null);
  return {
    min: tokens[0] ?? null,
    max: tokens[1] ?? null,
    currency,
  };
}

async function normaliseAshbyPosting(p: AshbyPosting): Promise<NormalisedJob> {
  const description = p.descriptionPlain ?? (p.descriptionHtml ? stripHtml(p.descriptionHtml) : '');
  const idFromUrl = p.applyUrl.match(ASHBY_ID_RE)?.[1];
  const externalId = p.id ?? idFromUrl ?? p.applyUrl;
  const salary = parseSalarySummary(
    p.compensation?.scrapeableCompensationSalarySummary ?? p.compensation?.compensationTierSummary,
  );
  return {
    external_id: externalId,
    title: p.title,
    normalized_title: normaliseTitle(p.title),
    location: p.location ?? null,
    remote_policy: p.isRemote ? 'remote' : mapWorkplaceType(p.workplaceType),
    description,
    description_hash: await sha256Hex(description),
    salary_min: salary.min,
    salary_max: salary.max,
    salary_currency: salary.currency,
    apply_url: p.applyUrl,
    posted_at: p.publishedAt ?? null,
    raw_payload: p,
  };
}
