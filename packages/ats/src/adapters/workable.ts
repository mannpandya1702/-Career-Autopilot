// Workable widget accounts adapter (discovery-only; submission is Playwright).
// Endpoint: GET https://apply.workable.com/api/v1/widget/accounts/{account}?details=true
// Source: docs/integrations.md §Workable.

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
import { WorkableListResponseSchema, type WorkableJob } from '../schemas/workable';
import { stripHtml } from '../html-utils';
import type { WorkMode } from '@career-autopilot/db';

const BASE = 'https://apply.workable.com/api/v1/widget/accounts';

export const workableAdapter: Adapter = {
  ats: 'workable',
  async list(input: AdapterInput): Promise<AdapterResult> {
    const fetchImpl = input.fetchImpl ?? fetch;
    const url = `${BASE}/${encodeURIComponent(input.ats_slug)}?details=true`;
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new AdapterHttpError(`Workable ${res.status}`, res.status, url);
    }
    const body = (await res.json()) as unknown;
    const parsed = WorkableListResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new AdapterShapeError(
        `Workable response shape mismatch: ${parsed.error.issues
          .slice(0, 3)
          .map((i) => i.path.join('.'))
          .join(', ')}`,
        url,
      );
    }

    const jobs = await Promise.all(parsed.data.jobs.map(normaliseWorkableJob));
    return { jobs, vendor_job_count: jobs.length };
  },
};

function mapWorkplaceType(w: WorkableJob['location'] extends infer L ? L : never): WorkMode | null {
  const raw = (w as { workplace_type?: string } | null | undefined)?.workplace_type;
  if (raw === 'remote') return 'remote';
  if (raw === 'hybrid') return 'hybrid';
  if (raw === 'on_site') return 'onsite';
  return null;
}

function formatLocation(loc: WorkableJob['location']): string | null {
  if (!loc) return null;
  const parts = [loc.city, loc.region, loc.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

async function normaliseWorkableJob(j: WorkableJob): Promise<NormalisedJob> {
  // Full JD = description + requirements + benefits, each HTML.
  const parts: string[] = [];
  if (j.description) parts.push(stripHtml(j.description));
  if (j.requirements) parts.push(stripHtml(j.requirements));
  if (j.benefits) parts.push(stripHtml(j.benefits));
  const description = parts.filter(Boolean).join('\n\n');
  return {
    external_id: j.id,
    title: j.title,
    normalized_title: normaliseTitle(j.title),
    location: formatLocation(j.location ?? null),
    remote_policy: mapWorkplaceType(j.location),
    description,
    description_hash: await sha256Hex(description),
    salary_min: j.salary?.min ?? null,
    salary_max: j.salary?.max ?? null,
    salary_currency: j.salary?.currency ?? null,
    apply_url: j.apply_url,
    posted_at: j.created_at ?? (j.published_on ? `${j.published_on}T00:00:00Z` : null),
    raw_payload: j,
  };
}
