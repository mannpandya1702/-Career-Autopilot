'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { JobWithCompany } from '@/lib/jobs/queries';
import { FitScoreRing } from './FitScoreRing';

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
                  'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition',
                  selected?.id === job.id ? 'border-foreground bg-muted' : 'border-border bg-white',
                ].join(' ')}
              >
                <FitScoreRing score={job.score?.overall_score ?? null} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{job.title}</span>
                    {job.company && (
                      <span className="shrink-0 text-xs text-muted-foreground">
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
                    {(job.score?.must_have_gaps?.length ?? 0) > 0 && (
                      <span className="text-red-700">
                        · {job.score?.must_have_gaps?.length} gap
                        {job.score?.must_have_gaps?.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
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
        <div className="flex items-start gap-3">
          <FitScoreRing score={job.score?.overall_score ?? null} size={56} />
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{job.title}</h2>
            <div className="mt-1 text-sm text-muted-foreground">
              {job.company?.name}
              {job.location && ` · ${job.location}`}
              {job.remote_policy && ` · ${job.remote_policy}`}
            </div>
          </div>
        </div>

        {job.score && (
          <div className="mt-4 space-y-3 text-xs">
            {!job.score.hard_filter_pass && (
              <div className="rounded border border-red-300 bg-red-50 p-2 text-red-700">
                Rejected by hard filters: {(job.score.hard_filter_reasons ?? []).join('; ')}
              </div>
            )}
            {job.score.dimensions && (
              <DimensionsGrid dimensions={job.score.dimensions as Record<string, number>} />
            )}
            {(job.score.must_have_gaps?.length ?? 0) > 0 && (
              <div>
                <div className="font-medium text-red-700">Must-have gaps</div>
                <ul className="mt-1 list-disc pl-4">
                  {job.score.must_have_gaps?.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {job.score.judge_reasoning && (
              <p className="text-muted-foreground">{job.score.judge_reasoning}</p>
            )}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            Apply page ↗
          </a>
          <button type="button" className="btn-secondary" onClick={() => setRawVisible((v) => !v)}>
            {rawVisible ? 'Hide raw' : 'Show raw'}
          </button>
          <button type="button" className="btn-primary" disabled>
            Tailor (Phase 5)
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

const DIMENSION_LABELS: Record<string, string> = {
  skills: 'Skills',
  experience: 'Experience',
  domain: 'Domain',
  seniority: 'Seniority',
  logistics: 'Logistics',
};

function DimensionsGrid({ dimensions }: { dimensions: Record<string, number> }) {
  const entries = Object.entries(dimensions).filter(([k]) => k in DIMENSION_LABELS);
  if (entries.length === 0) return null;
  return (
    <div>
      <div className="mb-1 font-medium">Score breakdown</div>
      <div className="grid grid-cols-5 gap-2">
        {entries.map(([key, value]) => {
          const pct = Math.max(0, Math.min(100, Number(value) || 0));
          return (
            <div key={key} className="rounded border border-border p-2 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">
                {DIMENSION_LABELS[key]}
              </div>
              <div className="mt-0.5 text-sm font-semibold">{pct}</div>
            </div>
          );
        })}
      </div>
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
