// Crawl one company: call the adapter, upsert jobs, mark missing ones closed,
// and record the run in job_crawl_runs.
//
// The upsert is by (company_id, external_id). When a job already exists, we
// update description + last_seen_at always; new jobs get first_seen_at=now().
// Jobs that were present previously but are NOT in the latest vendor response
// get status='closed' (stale-detection).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AtsType, NormalisedJob } from '@career-autopilot/ats';
import { getAdapter } from '@career-autopilot/ats';
import type { Database, Json } from '@career-autopilot/db';
import type { RateLimiter } from './rate-limit';

export interface CrawlCompanyInput {
  company_id: string;
  ats: AtsType;
  ats_slug: string;
  name?: string;
}

export interface CrawlCompanyResult {
  company_id: string;
  jobs_found: number;
  jobs_new: number;
  jobs_updated: number;
  jobs_closed: number;
  error?: string;
}

export async function crawlCompany(
  supabase: SupabaseClient<Database>,
  rl: RateLimiter,
  input: CrawlCompanyInput,
): Promise<CrawlCompanyResult> {
  const runStarted = new Date().toISOString();
  const { data: runRow, error: runError } = await supabase
    .from('job_crawl_runs')
    .insert({ company_id: input.company_id, started_at: runStarted })
    .select('id')
    .single();
  if (runError) throw new Error(`job_crawl_runs insert failed: ${runError.message}`);

  const adapter = getAdapter(input.ats);
  if (!adapter) {
    await completeRun(supabase, runRow.id, {
      jobs_found: 0,
      jobs_new: 0,
      jobs_updated: 0,
      error: `no adapter for ats=${input.ats}`,
    });
    return {
      company_id: input.company_id,
      jobs_found: 0,
      jobs_new: 0,
      jobs_updated: 0,
      jobs_closed: 0,
      error: `no adapter for ats=${input.ats}`,
    };
  }

  try {
    await rl.wait(input.ats);

    const listResult = await adapter.list({ ats_slug: input.ats_slug });
    const seenExternalIds = new Set(listResult.jobs.map((j) => j.external_id));

    // Pre-fetch existing jobs once so we can classify new vs updated + detect
    // previously-active jobs that disappeared.
    const existingResult = await supabase
      .from('jobs')
      .select('id,external_id,description_hash,status')
      .eq('company_id', input.company_id);
    if (existingResult.error) throw new Error(existingResult.error.message);
    const existingByExternalId = new Map(
      (existingResult.data ?? []).map((j) => [j.external_id, j]),
    );

    let jobs_new = 0;
    let jobs_updated = 0;
    const now = new Date().toISOString();

    // Batch upsert in chunks of 50 to keep payloads small.
    const chunks = chunk(listResult.jobs, 50);
    for (const batch of chunks) {
      const rows = batch.map((j) => buildJobRow(input.company_id, j, now));
      const { error } = await supabase
        .from('jobs')
        .upsert(rows, { onConflict: 'company_id,external_id' });
      if (error) throw new Error(`jobs upsert failed: ${error.message}`);
    }

    for (const job of listResult.jobs) {
      const existing = existingByExternalId.get(job.external_id);
      if (!existing) jobs_new += 1;
      else if (existing.description_hash !== job.description_hash) jobs_updated += 1;
    }

    // Close jobs that existed in our DB as 'active' but are missing from the
    // latest vendor response.
    const toClose = [...existingByExternalId.values()].filter(
      (j) => j.status === 'active' && !seenExternalIds.has(j.external_id),
    );
    if (toClose.length > 0) {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'closed' })
        .in(
          'id',
          toClose.map((j) => j.id),
        );
      if (error) throw new Error(`jobs close failed: ${error.message}`);
    }

    await supabase
      .from('companies')
      .update({ last_crawled_at: now })
      .eq('id', input.company_id);

    await completeRun(supabase, runRow.id, {
      jobs_found: listResult.jobs.length,
      jobs_new,
      jobs_updated,
    });

    return {
      company_id: input.company_id,
      jobs_found: listResult.jobs.length,
      jobs_new,
      jobs_updated,
      jobs_closed: toClose.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await completeRun(supabase, runRow.id, {
      jobs_found: 0,
      jobs_new: 0,
      jobs_updated: 0,
      error: message,
    });
    return {
      company_id: input.company_id,
      jobs_found: 0,
      jobs_new: 0,
      jobs_updated: 0,
      jobs_closed: 0,
      error: message,
    };
  }
}

function buildJobRow(
  companyId: string,
  j: NormalisedJob,
  now: string,
): Database['public']['Tables']['jobs']['Insert'] {
  return {
    company_id: companyId,
    external_id: j.external_id,
    title: j.title,
    normalized_title: j.normalized_title,
    location: j.location,
    remote_policy: j.remote_policy,
    description: j.description,
    description_hash: j.description_hash,
    salary_min: j.salary_min,
    salary_max: j.salary_max,
    salary_currency: j.salary_currency,
    apply_url: j.apply_url,
    posted_at: j.posted_at,
    last_seen_at: now,
    status: 'active',
    raw_payload: j.raw_payload as Json,
  };
}

async function completeRun(
  supabase: SupabaseClient<Database>,
  runId: string,
  patch: {
    jobs_found: number;
    jobs_new: number;
    jobs_updated: number;
    error?: string;
  },
): Promise<void> {
  const update: Database['public']['Tables']['job_crawl_runs']['Update'] = {
    completed_at: new Date().toISOString(),
    jobs_found: patch.jobs_found,
    jobs_new: patch.jobs_new,
    jobs_updated: patch.jobs_updated,
  };
  if (patch.error !== undefined) update.error = patch.error;
  const { error } = await supabase.from('job_crawl_runs').update(update).eq('id', runId);
  if (error) throw new Error(`job_crawl_runs update failed: ${error.message}`);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
