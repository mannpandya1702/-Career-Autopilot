'use client';

import { useState, useTransition } from 'react';
import type { OutcomeType } from '@career-autopilot/db';
import { KANBAN_COLUMNS, type KanbanColumn, type TrackerCard } from '@/lib/tracker/types';
import { moveCard } from './actions';

// Map kanban columns to the canonical outcome stage we record when the
// user drops a card onto the column.
const COLUMN_TO_STAGE: Record<KanbanColumn, OutcomeType> = {
  submitted: 'submitted',
  acknowledged: 'acknowledged',
  responded: 'callback',
  interviewing: 'interview_invite',
  offered: 'offer',
  rejected: 'rejection',
};

export function TrackerBoard({ cards }: { cards: TrackerCard[] }) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grouped = new Map<KanbanColumn, TrackerCard[]>();
  for (const c of KANBAN_COLUMNS) grouped.set(c.key, []);
  for (const card of cards) {
    grouped.get(card.column)?.push(card);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => b.stage_reached_at.localeCompare(a.stage_reached_at));
  }

  const drop = (column: KanbanColumn) => {
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
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Drag cards across columns to record outcome events. Cards auto-move
            when the email-poller worker classifies an inbound message.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{cards.length} active</span>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {KANBAN_COLUMNS.map((c) => {
          const list = grouped.get(c.key) ?? [];
          return (
            <div
              key={c.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(c.key)}
              className="flex min-h-[300px] flex-col gap-2 rounded-md border border-border bg-slate-50 p-2"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {c.label}
                </h2>
                <span className="text-xs text-muted-foreground">{list.length}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {list.map((card) => (
                  <li
                    key={card.submission_id}
                    draggable
                    onDragStart={() => setDraggedId(card.submission_id)}
                    onDragEnd={() => setDraggedId(null)}
                    className={[
                      'cursor-grab rounded-md border border-border bg-white p-2 text-sm shadow-sm',
                      pending && draggedId === card.submission_id ? 'opacity-50' : '',
                    ].join(' ')}
                  >
                    <div className="font-medium leading-tight">{card.job_title}</div>
                    {card.company_name && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {card.company_name}
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{card.current_stage.replace(/_/g, ' ')}</span>
                      {card.stage_reached_at && (
                        <span>
                          {new Date(card.stage_reached_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {card.apply_url && (
                      <a
                        href={card.apply_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-[10px] text-blue-700 underline"
                      >
                        Apply page ↗
                      </a>
                    )}
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    Drop here
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
