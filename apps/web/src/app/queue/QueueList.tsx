'use client';

import { useState, useTransition } from 'react';
import type { ManualReviewItem } from '@/lib/queue/queries';
import { resolveQueueItem } from './actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { IconArrowRight, IconCheck, IconX, IconLayers, IconAlert } from '@/components/ui/icons';

export function QueueList({ items }: { items: ManualReviewItem[] }) {
  const open = items.filter((i) => !i.resolved_at);
  const closed = items.filter((i) => !!i.resolved_at);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Open</span>
            <Badge variant="warning">{open.length}</Badge>
          </h2>
        </div>
        {open.length === 0 ? (
          <EmptyState
            icon={<IconCheck className="size-5" />}
            title="Queue is clear"
            description="No applications waiting on you. The worker will drop new items here if it hits a portal it can't autofill."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {open.map((i) => (
              <QueueItem key={i.id} item={i} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Resolved</span>
            <Badge variant="neutral">{closed.length}</Badge>
          </h2>
        </div>
        {closed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {closed.slice(0, 30).map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-elevation-1"
              >
                <div>
                  <span className="font-medium text-foreground">{i.job_title ?? 'Job'}</span>
                  {i.company_name ? (
                    <span className="text-muted-foreground"> · {i.company_name}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                  <Badge variant={i.resolution === 'submitted_manually' ? 'success' : 'neutral'}>
                    {(i.resolution ?? 'resolved').replace(/_/g, ' ')}
                  </Badge>
                  <span className="tabular-nums">
                    {new Date(i.resolved_at!).toLocaleString()}
                  </span>
                </div>
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
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-md bg-warning/10 text-warning">
                <IconLayers className="size-4" />
              </span>
              <div>
                <CardTitle>{item.job_title ?? 'Job'}</CardTitle>
                {item.company_name ? (
                  <CardDescription>{item.company_name}</CardDescription>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="warning">{item.reason}</Badge>
              <span className="text-2xs text-muted-foreground">
                Created {new Date(item.created_at).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {item.apply_url ? (
              <a href={item.apply_url} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm">
                  Apply page
                  <IconArrowRight />
                </Button>
              </a>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={pending}
              loading={pending}
              onClick={() => resolve('submitted_manually')}
            >
              <IconCheck /> Submitted manually
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => resolve('abandoned')}
            >
              <IconX /> Abandon
            </Button>
          </div>
        </div>
      </CardHeader>
      {(item.context && Object.keys(item.context).length > 0) || item.screenshots?.length ? (
        <CardContent className="pt-0">
          {item.context && Object.keys(item.context).length > 0 ? (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Worker context
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface-elevated p-3 font-mono text-2xs text-foreground/80">
                {JSON.stringify(item.context, null, 2)}
              </pre>
            </details>
          ) : null}
          {item.screenshots && item.screenshots.length > 0 ? (
            <p className="mt-3 text-2xs text-muted-foreground">
              {item.screenshots.length} screenshot{item.screenshots.length === 1 ? '' : 's'}{' '}
              recorded — download from the storage bucket if needed.
            </p>
          ) : null}
          {error ? (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <IconAlert className="size-3" />
              Resolve failed: {error}
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
