'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { JobWithCompany } from '@/lib/jobs/queries';

const STATUS_TABS = ['active', 'pending_review', 'needs_decision', 'low_fit', 'closed'] as const;
const ATS_TABS = ['all', 'greenhouse', 'lever', 'ashby', 'workable'] as const;

type StatusTab = (typeof STATUS_TABS)[number];

export function JobsInbox({
  initialJobs,
  activeStatus,
  activeAts,
}: {
  initialJobs: JobWithCompany[];
  activeStatus: string;
  activeAts: string;
}) {
  const [selected, setSelected] = useState<JobWithCompany | null>(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialJobs;
    return initialJobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        (j.company?.name.toLowerCase().includes(q) ?? false) ||
        (j.location?.toLowerCase().includes(q) ?? false),
    );
  }, [initialJobs, query]);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 px-6 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          {initialJobs.length} jobs in view. Click a row to preview the JD.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex gap-1 text-xs">
          {STATUS_TABS.map((s) => (
            <Link
              key={s}
              href={{ pathname: '/jobs', query: buildQuery(s, activeAts) }}
              className={tabClass(s === activeStatus)}
            >
              {s}
            </Link>
          ))}
        </nav>
        <nav className="flex gap-1 text-xs">
          {ATS_TABS.map((a) => (
            <Link
              key={a}
              href={{ pathname: '/jobs', query: buildQuery(activeStatus as StatusTab, a) }}
              className={tabClass(a === activeAts)}
            >
              {a}
            </Link>
          ))}
        </nav>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter title / company / location"
          className="input ml-auto max-w-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.2fr]">
        <ul className="flex flex-col gap-2">
          {filtered.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => setSelected(job)}
                className={[
                  'w-full rounded-md border px-3 py-2 text-left text-sm transition',
                  selected?.id === job.id ? 'border-foreground bg-muted' : 'border-border bg-white',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{job.title}</span>
                  {job.company && (
                    <span className="text-xs text-muted-foreground">
                      {job.company.name}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{job.location ?? '—'}</span>
                  {job.remote_policy && <span>· {job.remote_policy}</span>}
                  {job.posted_at && (
                    <span>· posted {new Date(job.posted_at).toLocaleDateString()}</span>
                  )}
                  {job.company?.ats_type && <span>· {job.company.ats_type}</span>}
                </div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              No jobs match. Run{' '}
              <code className="rounded bg-muted px-1 py-0.5">pnpm crawl:enqueue</code> after
              seeding companies.
            </li>
          )}
        </ul>

        <aside className="sticky top-4 flex max-h-[80vh] flex-col overflow-hidden rounded-md border border-border bg-white">
          {selected ? <JobDetail job={selected} /> : <EmptyDetail />}
        </aside>
      </div>
    </div>
  );
}

function JobDetail({ job }: { job: JobWithCompany }) {
  const [rawVisible, setRawVisible] = useState(false);
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">{job.title}</h2>
        <div className="mt-1 text-sm text-muted-foreground">
          {job.company?.name}
          {job.location && ` · ${job.location}`}
          {job.remote_policy && ` · ${job.remote_policy}`}
        </div>
        <div className="mt-3 flex gap-2">
          <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            Apply page ↗
          </a>
          <button type="button" className="btn-secondary" onClick={() => setRawVisible((v) => !v)}>
            {rawVisible ? 'Hide raw' : 'Show raw'}
          </button>
          <button type="button" className="btn-primary" disabled>
            Score this (Phase 4)
          </button>
        </div>
      </div>
      <div className="overflow-y-auto p-4 text-sm whitespace-pre-wrap">
        {rawVisible ? (
          <pre className="text-xs">{JSON.stringify(job.raw_payload ?? {}, null, 2)}</pre>
        ) : (
          job.description
        )}
      </div>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
      Select a job to view details.
    </div>
  );
}

function tabClass(active: boolean): string {
  return [
    'rounded-full border px-2.5 py-1',
    active
      ? 'border-foreground bg-foreground text-background'
      : 'border-border text-muted-foreground hover:text-foreground',
  ].join(' ');
}

function buildQuery(status: StatusTab, ats: string): Record<string, string> {
  const q: Record<string, string> = { status };
  if (ats !== 'all') q['ats'] = ats;
  return q;
}
