'use client';

import { useState, useTransition } from 'react';
import type { ManualReviewItem } from '@/lib/queue/queries';
import { resolveQueueItem } from './actions';

export function QueueList({ items }: { items: ManualReviewItem[] }) {
  const open = items.filter((i) => !i.resolved_at);
  const closed = items.filter((i) => !!i.resolved_at);
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Manual review queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submissions that the worker couldn&rsquo;t complete automatically. Resolve each by
          finishing the application by hand on the apply page, or abandon if you no longer
          want to apply.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Open ({open.length})</h2>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {open.map((i) => (
              <QueueItem key={i.id} item={i} />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Resolved ({closed.length})</h2>
        {closed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {closed.slice(0, 30).map((i) => (
              <li
                key={i.id}
                className="rounded-md border border-border bg-white p-3 text-sm"
              >
                <span className="font-medium">{i.job_title ?? 'Job'}</span>
                {i.company_name && (
                  <span className="text-muted-foreground"> · {i.company_name}</span>
                )}
                <span className="ml-2 text-xs text-muted-foreground">
                  {i.resolution} · resolved {new Date(i.resolved_at!).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function QueueItem({ item }: { item: ManualReviewItem }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const resolve = (resolution: 'submitted_manually' | 'abandoned') => {
    startTransition(async () => {
      setError(null);
      const r = await resolveQueueItem(item.id, resolution);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <li className="rounded-md border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium">{item.job_title ?? 'Job'}</div>
          {item.company_name && (
            <div className="text-xs text-muted-foreground">{item.company_name}</div>
          )}
          <div className="mt-1 text-xs">
            <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800 border border-amber-200">
              {item.reason}
            </span>
            <span className="ml-2 text-muted-foreground">
              created {new Date(item.created_at).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.apply_url && (
            <a
              href={item.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Open apply page ↗
            </a>
          )}
          <button
            type="button"
            disabled={pending}
            className="btn-primary"
            onClick={() => resolve('submitted_manually')}
          >
            Submitted manually
          </button>
          <button
            type="button"
            disabled={pending}
            className="btn-secondary"
            onClick={() => resolve('abandoned')}
          >
            Abandon
          </button>
        </div>
      </div>
      {item.context && Object.keys(item.context).length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Context</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2 text-[11px]">
            {JSON.stringify(item.context, null, 2)}
          </pre>
        </details>
      )}
      {item.screenshots && item.screenshots.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {item.screenshots.length} screenshot{item.screenshots.length === 1 ? '' : 's'}
          recorded; download via the storage bucket if needed.
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-700">Resolve failed: {error}</p>
      )}
    </li>
  );
}
