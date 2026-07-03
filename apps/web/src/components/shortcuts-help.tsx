'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { IconX } from './ui/icons';

type Shortcut = { keys: string[]; label: string };

const SHORTCUTS: { group: string; items: Shortcut[] }[] = [
  {
    group: 'Global',
    items: [
      { keys: ['⌘', 'K'], label: 'Open command palette' },
      { keys: ['?'], label: 'Show this cheat sheet' },
      { keys: ['Esc'], label: 'Close overlays' },
    ],
  },
  {
    group: 'Jobs inbox',
    items: [
      { keys: ['J'], label: 'Next job' },
      { keys: ['K'], label: 'Previous job' },
      { keys: ['↓'], label: 'Next job (alt)' },
      { keys: ['↑'], label: 'Previous job (alt)' },
    ],
  },
];

export function ShortcutsHelp() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        return;
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-50 grid place-items-center px-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-elevation-3 animate-scale-in">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <IconX className="size-4" />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
          {SHORTCUTS.map(({ group, items }) => (
            <div key={group}>
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              <ul className="space-y-1.5">
                {items.map((s) => (
                  <li key={s.label} className="flex items-center justify-between text-sm">
                    <span className="text-foreground/85">{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className={cn(
                            'inline-flex min-w-[24px] items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs text-foreground',
                          )}
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border bg-surface-elevated/50 px-4 py-2.5 text-2xs text-muted-foreground">
          Press{' '}
          <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono">?</kbd>{' '}
          again to close.
        </div>
      </div>
    </div>
  );
}
