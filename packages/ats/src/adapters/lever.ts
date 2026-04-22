// Lever Postings API adapter.
// Endpoint: GET https://api.lever.co/v0/postings/{site}?mode=json
// EU instance: https://api.eu.lever.co
// Source: docs/integrations.md §Lever.

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
import { LeverListResponseSchema, type LeverPosting } from '../schemas/lever';
import { stripHtml } from '../html-utils';
import type { WorkMode } from '@career-autopilot/db';

export const leverAdapter: Adapter = {
  ats: 'lever',
  async list(input: AdapterInput): Promise<AdapterResult> {
    const fetchImpl = input.fetchImpl ?? fetch;
    const host = input.region === 'eu' ? 'api.eu.lever.co' : 'api.lever.co';
    const url = `https://${host}/v0/postings/${encodeURIComponent(input.ats_slug)}?mode=json`;
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new AdapterHttpError(`Lever ${res.status}`, res.status, url);
    }
    const body = (await res.json()) as unknown;
    const parsed = LeverListResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new AdapterShapeError(
        `Lever response shape mismatch: ${parsed.error.issues
          .slice(0, 3)
          .map((i) => i.path.join('.'))
          .join(', ')}`,
        url,
      );
    }

    const jobs = await Promise.all(parsed.data.map(normaliseLeverPosting));
    return { jobs, vendor_job_count: jobs.length };
  },
};

function mapWorkplaceType(w: LeverPosting['workplaceType']): WorkMode | null {
  switch (w) {
    case 'remote':
      return 'remote';
    case 'hybrid':
      return 'hybrid';
    case 'on-site':
      return 'onsite';
    default:
      return null;
  }
}

async function normaliseLeverPosting(p: LeverPosting): Promise<NormalisedJob> {
  // Full JD = description + additional + lists (all HTML).
  const parts: string[] = [];
  if (p.description) parts.push(stripHtml(p.description));
  if (p.additional) parts.push(stripHtml(p.additional));
  for (const list of p.lists ?? []) {
    if (list.text) parts.push(list.text);
    if (list.content) parts.push(stripHtml(list.content));
  }
  const description = parts.filter(Boolean).join('\n\n');
  const postedAt = p.createdAt ? new Date(p.createdAt).toISOString() : null;
  const loc = p.categories?.location ?? null;
  return {
    external_id: p.id,
    title: p.text,
    normalized_title: normaliseTitle(p.text),
    location: loc,
    remote_policy: mapWorkplaceType(p.workplaceType),
    description,
    description_hash: await sha256Hex(description),
    salary_min: p.salaryRange?.min ?? null,
    salary_max: p.salaryRange?.max ?? null,
    salary_currency: p.salaryRange?.currency ?? null,
    apply_url: p.applyUrl ?? p.hostedUrl,
    posted_at: postedAt,
    raw_payload: p,
  };
}
