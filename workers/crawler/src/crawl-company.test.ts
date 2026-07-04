import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@career-autopilot/db';
import { crawlCompany } from './crawl-company';
import { RateLimiter } from './rate-limit';

// Minimal SupabaseClient stub. Captures every insert/update/upsert so we can
// assert on what the crawler did without a real DB. Returns empty arrays
// everywhere reads aren't interesting to the test.
function makeFakeSupabase(initialExisting: Record<string, unknown>[] = []) {
  const calls: Record<string, unknown[]> = {
    'job_crawl_runs.insert': [],
    'job_crawl_runs.update': [],
    'jobs.upsert': [],
    'jobs.update': [],
    'companies.update': [],
    'rpc.pgmq_send': [],
  };

  // Chainable thenable that also supports the supabase-js filter methods we
  // touch (.eq/.in/.not) and resolves to { data, error }.
  const makeChain = (data: unknown): PromiseLike<{ data: unknown; error: null }> & {
    eq: (...args: unknown[]) => typeof chain;
    in: (...args: unknown[]) => typeof chain;
    not: (...args: unknown[]) => typeof chain;
    order: (...args: unknown[]) => typeof chain;
    limit: (...args: unknown[]) => typeof chain;
    maybeSingle: () => Promise<{ data: unknown; error: null }>;
    single: () => Promise<{ data: unknown; error: null }>;
    then: Promise<{ data: unknown; error: null }>['then'];
  } => {
    const chain = {
      eq: () => chain,
      in: () => chain,
      not: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data, error: null }),
      single: async () => ({ data, error: null }),
      then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
        Promise.resolve({ data, error: null }).then(resolve),
    };
    return chain as never;
  };

  const api: unknown = {
    from(table: string) {
      return {
        insert(payload: unknown) {
          if (table === 'job_crawl_runs') {
            calls['job_crawl_runs.insert']?.push(payload);
            return {
              select() {
                return {
                  async single() {
                    return { data: { id: 'run-1' }, error: null };
                  },
                };
              },
            };
          }
          throw new Error(`unexpected insert on ${table}`);
        },
        select() {
          if (table === 'jobs') return makeChain(initialExisting);
          if (table === 'profiles') return makeChain([]);
          return makeChain([]);
        },
        upsert(payload: unknown) {
          calls[`${table}.upsert`]?.push(payload);
          return Promise.resolve({ data: null, error: null });
        },
        update(payload: unknown) {
          calls[`${table}.update`]?.push(payload);
          return {
            eq: async () => ({ data: null, error: null }),
            in: async () => ({ data: null, error: null }),
          };
        },
      };
    },
    rpc(name: string, args: unknown) {
      calls[`rpc.${name}`]?.push(args);
      return Promise.resolve({ data: null, error: null });
    },
  };

  return { supabase: api as unknown as SupabaseClient<Database>, calls };
}

describe('crawlCompany', () => {
  it('inserts new jobs and reports counts', async () => {
    // Stub a fetch that returns 2 Greenhouse jobs.
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          jobs: [
            {
              id: 1,
              title: 'Engineer',
              absolute_url: 'https://boards.greenhouse.io/acme/jobs/1',
              location: { name: 'NYC' },
              content: '<p>Cool job.</p>',
              updated_at: '2025-01-01T00:00:00Z',
            },
            {
              id: 2,
              title: 'Designer',
              absolute_url: 'https://boards.greenhouse.io/acme/jobs/2',
              location: { name: 'SF' },
              content: '<p>Design stuff.</p>',
              updated_at: '2025-01-01T00:00:00Z',
            },
          ],
          meta: { total: 2 },
        }),
        { status: 200 },
      )) as typeof fetch;

    const prev = globalThis.fetch;
    globalThis.fetch = fetchImpl;

    try {
      const { supabase, calls } = makeFakeSupabase();
      const rl = new RateLimiter(0);
      const result = await crawlCompany(supabase, rl, {
        company_id: '11111111-1111-1111-1111-111111111111',
        ats: 'greenhouse',
        ats_slug: 'acme',
      });

      expect(result.error).toBeUndefined();
      expect(result.jobs_found).toBe(2);
      expect(result.jobs_new).toBe(2);
      expect(result.jobs_updated).toBe(0);
      expect(result.jobs_closed).toBe(0);
      expect(result.scoring_enqueued).toBe(0); // no users in the fake profile table

      expect(calls['jobs.upsert']).toHaveLength(1);
      const batch = calls['jobs.upsert']?.[0] as Record<string, unknown>[];
      expect(batch).toHaveLength(2);
      expect(batch[0]?.['external_id']).toBe('1');
      expect(batch[1]?.['external_id']).toBe('2');

      expect(calls['job_crawl_runs.insert']).toHaveLength(1);
      expect(calls['job_crawl_runs.update']).toHaveLength(1);
      const runUpdate = calls['job_crawl_runs.update']?.[0] as {
        jobs_found: number;
        jobs_new: number;
        completed_at: string;
      };
      expect(runUpdate.jobs_found).toBe(2);
      expect(runUpdate.jobs_new).toBe(2);
      expect(runUpdate.completed_at).toBeTruthy();
    } finally {
      globalThis.fetch = prev;
    }
  });

  it('records error on adapter failure', async () => {
    const fetchImpl = (async () => new Response('', { status: 500 })) as typeof fetch;
    const prev = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    try {
      const { supabase, calls } = makeFakeSupabase();
      const rl = new RateLimiter(0);
      const result = await crawlCompany(supabase, rl, {
        company_id: '22222222-2222-2222-2222-222222222222',
        ats: 'greenhouse',
        ats_slug: 'broken',
      });
      expect(result.error).toMatch(/Greenhouse 500/);
      expect(calls['jobs.upsert']).toHaveLength(0);
      const runUpdate = calls['job_crawl_runs.update']?.[0] as { error?: string };
      expect(runUpdate.error).toMatch(/Greenhouse 500/);
    } finally {
      globalThis.fetch = prev;
    }
  });
});
