'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { JobWithCompany } from '@/lib/jobs/queries';
import { FitScoreRing } from './FitScoreRing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import {
  IconSearch,
  IconInbox,
  IconArrowRight,
  IconTarget,
  IconAlert,
} from '@/components/ui/icons';

const STATUS_TABS = [
  { key: 'active', label: 'Active' },
  { key: 'pending_review', label: 'Pending review' },
  { key: 'needs_decision', label: 'Needs decision' },
  { key: 'low_fit', label: 'Low fit' },
  { key: 'closed', label: 'Closed' },
] as const;

const ATS_TABS = [
  { key: 'all', label: 'All ATS' },
  { key: 'greenhouse', label: 'Greenhouse' },
  { key: 'lever', label: 'Lever' },
  { key: 'ashby', label: 'Ashby' },
  { key: 'workable', label: 'Workable' },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]['key'];

export function JobsInbox({
  initialJobs,
  activeStatus,
  activeAts,
}: {
  initialJobs: JobWithCompany[];
  activeStatus: string;
  activeAts: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialJobs[0]?.id ?? null);
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

  const selected = useMemo(
    () => filtered.find((j) => j.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const idx = filtered.findIndex((j) => j.id === selected?.id);
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = filtered[Math.min(filtered.length - 1, idx + 1)];
        if (next) setSelectedId(next.id);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = filtered[Math.max(0, idx - 1)];
        if (prev) setSelectedId(prev.id);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, selected?.id]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1 shadow-elevation-1">
          {STATUS_TABS.map(({ key, label }) => (
            <Link
              key={key}
              href={{ pathname: '/jobs', query: buildQuery(key, activeAts) }}
              scroll={false}
              className={pillClass(key === activeStatus)}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="hidden flex-wrap gap-1 rounded-lg border border-border bg-surface p-1 shadow-elevation-1 md:flex">
          {ATS_TABS.map(({ key, label }) => (
            <Link
              key={key}
              href={{ pathname: '/jobs', query: buildQuery(activeStatus as StatusTab, key) }}
              scroll={false}
              className={pillClass(key === activeAts)}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter title, company, location"
            className="pl-8"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="min-h-[600px] overflow-hidden rounded-lg border border-border bg-surface shadow-elevation-1">
          <div className="flex items-center justify-between border-b border-border bg-surface-elevated/60 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">
              <span className="tabular-nums font-mono text-foreground">{filtered.length}</span>{' '}
              {filtered.length === 1 ? 'job' : 'jobs'}
            </p>
            <p className="hidden text-2xs text-muted-foreground sm:block">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono">
                J
              </kbd>{' '}
              /{' '}
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono">
                K
              </kbd>{' '}
              to navigate
            </p>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              className="m-3 border-0 shadow-none"
              icon={<IconInbox className="size-5" />}
              title="No jobs in this bucket"
              description="Seed companies and run pnpm crawl:enqueue, or switch tabs above."
            />
          ) : (
            <ul className="max-h-[calc(100vh-260px)] divide-y divide-border/60 overflow-y-auto">
              {filtered.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  active={selected?.id === job.id}
                  onClick={() => setSelectedId(job.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="sticky top-[76px] max-h-[calc(100vh-96px)] overflow-hidden rounded-lg border border-border bg-surface shadow-elevation-1">
          {selected ? <JobDetail job={selected} /> : <EmptyDetail />}
        </div>
      </div>
    </div>
  );
}

function JobRow({
  job,
  active,
  onClick,
}: {
  job: JobWithCompany;
  active: boolean;
  onClick: () => void;
}) {
  const gaps = job.score?.must_have_gaps?.length ?? 0;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors duration-100',
          'hover:bg-muted/60',
          active && 'bg-primary/8 hover:bg-primary/10',
        )}
      >
        <FitScoreRing score={job.score?.overall_score ?? null} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{job.title}</span>
            {job.company?.ats_type ? (
              <Badge variant="outline" className="shrink-0 font-mono text-2xs">
                {job.company.ats_type}
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {job.company?.name ? (
              <span className="text-foreground/70">{job.company.name}</span>
            ) : null}
            {job.location ? <span>· {job.location}</span> : null}
            {job.remote_policy ? <span>· {job.remote_policy}</span> : null}
            {job.posted_at ? (
              <span>· {new Date(job.posted_at).toLocaleDateString()}</span>
            ) : null}
          </div>
          {gaps > 0 || job.score?.tier ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {job.score?.tier ? <TierBadge tier={job.score.tier} /> : null}
              {gaps > 0 ? (
                <Badge variant="destructive">
                  <IconAlert className="size-2.5" />
                  {gaps} gap{gaps === 1 ? '' : 's'}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </button>
    </li>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, { variant: 'success' | 'warning' | 'neutral' | 'destructive'; label: string }> = {
    strong_fit: { variant: 'success', label: 'Strong fit' },
    pending_review: { variant: 'warning', label: 'Pending review' },
    needs_decision: { variant: 'warning', label: 'Needs decision' },
    low_fit: { variant: 'destructive', label: 'Low fit' },
  };
  const cfg = map[tier] ?? { variant: 'neutral' as const, label: tier };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function JobDetail({ job }: { job: JobWithCompany }) {
  const [rawVisible, setRawVisible] = useState(false);
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-surface-elevated/40 p-5">
        <div className="flex items-start gap-4">
          <FitScoreRing score={job.score?.overall_score ?? null} size={64} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight">{job.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {job.company?.name}
              {job.location ? ` · ${job.location}` : null}
              {job.remote_policy ? ` · ${job.remote_policy}` : null}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={job.apply_url} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm">
                  Apply page
                  <IconArrowRight />
                </Button>
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRawVisible((v) => !v)}
                className="font-mono"
              >
                {rawVisible ? 'Hide' : 'Show'} raw
              </Button>
              <Button size="sm" disabled>
                <IconTarget /> Tailor résumé
              </Button>
            </div>
          </div>
        </div>

        {job.score ? (
          <div className="mt-4 space-y-3">
            {!job.score.hard_filter_pass ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <p className="font-semibold">Rejected by hard filters</p>
                <p className="mt-0.5 text-destructive/80">
                  {(job.score.hard_filter_reasons ?? []).join('; ')}
                </p>
              </div>
            ) : null}
            {job.score.dimensions ? (
              <DimensionsGrid dimensions={job.score.dimensions as Record<string, number>} />
            ) : null}
            {(job.score.must_have_gaps?.length ?? 0) > 0 ? (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
                <p className="text-xs font-semibold text-warning">Must-have gaps</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-foreground/80">
                  {job.score.must_have_gaps?.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            ) : null}
            {job.score.judge_reasoning ? (
              <p className="text-xs italic text-muted-foreground border-l-2 border-primary/40 pl-3">
                {job.score.judge_reasoning}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {rawVisible ? (
          <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-surface-elevated p-3 font-mono text-2xs text-foreground">
            {JSON.stringify(job.raw_payload ?? {}, null, 2)}
          </pre>
        ) : (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
            {job.description}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <EmptyState
        icon={<IconInbox className="size-5" />}
        title="Nothing selected"
        description="Pick a job from the list to inspect it here."
      />
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
      <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        Score breakdown
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {entries.map(([key, value]) => {
          const pct = Math.max(0, Math.min(100, Number(value) || 0));
          const color =
            pct >= 80 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive';
          return (
            <div
              key={key}
              className="rounded-md border border-border bg-surface p-2 text-center"
            >
              <p className="text-2xs uppercase text-muted-foreground">
                {DIMENSION_LABELS[key]}
              </p>
              <p className={cn('mt-0.5 font-mono text-base font-semibold tabular-nums', color)}>
                {pct}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pillClass(active: boolean): string {
  return cn(
    'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
    active
      ? 'bg-primary text-primary-foreground shadow-elevation-1'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );
}

function buildQuery(status: StatusTab, ats: string): Record<string, string> {
  const q: Record<string, string> = { status };
  if (ats !== 'all') q['ats'] = ats;
  return q;
}
