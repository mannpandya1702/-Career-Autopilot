'use client';

import { useState, useTransition } from 'react';
import type { OutcomeType } from '@career-autopilot/db';
import { KANBAN_COLUMNS, type KanbanColumn, type TrackerCard } from '@/lib/tracker/types';
import { moveCard } from './actions';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { IconArrowRight, IconAlert } from '@/components/ui/icons';

const COLUMN_TO_STAGE: Record<KanbanColumn, OutcomeType> = {
  submitted: 'submitted',
  acknowledged: 'acknowledged',
  responded: 'callback',
  interviewing: 'interview_invite',
  offered: 'offer',
  rejected: 'rejection',
};

const COLUMN_STYLES: Record<
  KanbanColumn,
  { header: string; dot: string; count: 'neutral' | 'info' | 'primary' | 'success' | 'warning' | 'destructive' | 'accent' }
> = {
  submitted: { header: 'text-info', dot: 'bg-info', count: 'info' },
  acknowledged: { header: 'text-primary', dot: 'bg-primary', count: 'primary' },
  responded: { header: 'text-accent', dot: 'bg-accent', count: 'accent' },
  interviewing: { header: 'text-warning', dot: 'bg-warning', count: 'warning' },
  offered: { header: 'text-success', dot: 'bg-success', count: 'success' },
  rejected: { header: 'text-destructive', dot: 'bg-destructive', count: 'destructive' },
};

export function TrackerBoard({ cards }: { cards: TrackerCard[] }) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<KanbanColumn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grouped = new Map<KanbanColumn, TrackerCard[]>();
  for (const c of KANBAN_COLUMNS) grouped.set(c.key, []);
  for (const card of cards) grouped.get(card.column)?.push(card);
  for (const list of grouped.values()) {
    list.sort((a, b) => b.stage_reached_at.localeCompare(a.stage_reached_at));
  }

  const drop = (column: KanbanColumn) => {
    setOverCol(null);
    if (!draggedId) return;
    const stage = COLUMN_TO_STAGE[column];
    setError(null);
    startTransition(async () => {
      const r = await moveCard(draggedId, stage);
      if (!r.ok) setError(r.error);
      setDraggedId(null);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <IconAlert className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">{cards.length}</span> total
          applications across{' '}
          <span className="font-mono tabular-nums text-foreground">{KANBAN_COLUMNS.length}</span>{' '}
          stages.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {KANBAN_COLUMNS.map((c) => {
          const list = grouped.get(c.key) ?? [];
          const styles = COLUMN_STYLES[c.key];
          const isOver = overCol === c.key;
          return (
            <div
              key={c.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(c.key);
              }}
              onDragLeave={() => setOverCol((cur) => (cur === c.key ? null : cur))}
              onDrop={() => drop(c.key)}
              className={cn(
                'flex min-h-[420px] flex-col gap-2 rounded-lg border bg-surface-elevated/60 p-2.5 transition-colors duration-150',
                isOver
                  ? 'border-primary bg-primary/5 shadow-elevation-2'
                  : 'border-border',
              )}
            >
              <div className="flex items-center justify-between px-1 pt-1">
                <div className="flex items-center gap-2">
                  <span className={cn('inline-block size-2 rounded-full', styles.dot)} />
                  <h2
                    className={cn(
                      'text-2xs font-semibold uppercase tracking-wider',
                      styles.header,
                    )}
                  >
                    {c.label}
                  </h2>
                </div>
                <Badge variant={styles.count}>{list.length}</Badge>
              </div>

              <ul className="flex flex-col gap-2">
                {list.map((card) => (
                  <li
                    key={card.submission_id}
                    draggable
                    onDragStart={() => setDraggedId(card.submission_id)}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setOverCol(null);
                    }}
                    className={cn(
                      'group cursor-grab rounded-md border border-border bg-surface p-3 text-sm shadow-elevation-1 transition-all duration-150',
                      'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevation-2 active:cursor-grabbing',
                      pending && draggedId === card.submission_id && 'opacity-50',
                    )}
                  >
                    <p className="font-medium leading-tight text-foreground">{card.job_title}</p>
                    {card.company_name ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{card.company_name}</p>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between text-2xs text-muted-foreground">
                      <span className="font-mono">
                        {card.current_stage.replace(/_/g, ' ')}
                      </span>
                      {card.stage_reached_at ? (
                        <span className="tabular-nums">
                          {new Date(card.stage_reached_at).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                    {card.apply_url ? (
                      <a
                        href={card.apply_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-2xs text-primary opacity-0 transition-opacity group-hover:opacity-100 hover:underline"
                      >
                        Apply page <IconArrowRight className="size-2.5" />
                      </a>
                    ) : null}
                  </li>
                ))}
                {list.length === 0 ? (
                  <li className="flex items-center justify-center rounded-md border border-dashed border-border/70 p-4 text-center text-2xs text-muted-foreground">
                    Drop here
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
