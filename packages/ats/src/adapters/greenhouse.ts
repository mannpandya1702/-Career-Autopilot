// Greenhouse Job Board API adapter.
// Endpoint: GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
// Source: docs/integrations.md §Greenhouse.

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
import { GreenhouseListResponseSchema, type GreenhouseJob } from '../schemas/greenhouse';
import { decodeEntities, stripHtml } from '../html-utils';

const BASE = 'https://boards-api.greenhouse.io/v1/boards';

export const greenhouseAdapter: Adapter = {
  ats: 'greenhouse',
  async list(input: AdapterInput): Promise<AdapterResult> {
    const fetchImpl = input.fetchImpl ?? fetch;
    const url = `${BASE}/${encodeURIComponent(input.ats_slug)}/jobs?content=true`;
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new AdapterHttpError(`Greenhouse ${res.status}`, res.status, url);
    }
    const body = (await res.json()) as unknown;
    const parsed = GreenhouseListResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new AdapterShapeError(
        `Greenhouse response shape mismatch: ${parsed.error.issues
          .slice(0, 3)
          .map((i) => i.path.join('.'))
          .join(', ')}`,
        url,
      );
    }

    const jobs = await Promise.all(parsed.data.jobs.map(normaliseGreenhouseJob));
    return { jobs, vendor_job_count: jobs.length };
  },
};

async function normaliseGreenhouseJob(job: GreenhouseJob): Promise<NormalisedJob> {
  // content is double-escaped HTML; decode entities, then strip tags for storage.
  const decoded = job.content ? decodeEntities(job.content) : '';
  const description = stripHtml(decoded);
  const locationName = job.location?.name ?? null;
  return {
    external_id: String(job.id),
    title: job.title,
    normalized_title: normaliseTitle(job.title),
    location: locationName,
    remote_policy: null, // Greenhouse doesn't expose a structured remote flag in Job Board API.
    description,
    description_hash: await sha256Hex(description),
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    apply_url: job.absolute_url,
    posted_at: job.updated_at ?? job.first_published ?? null,
    raw_payload: job,
  };
}
