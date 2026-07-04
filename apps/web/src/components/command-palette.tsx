'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { cn } from '@/lib/utils';
import { useTheme } from './theme-provider';
import {
  IconSearch,
  IconHome,
  IconInbox,
  IconLayers,
  IconTrello,
  IconBarChart,
  IconUser,
  IconSun,
  IconMoon,
  IconMonitor,
  IconLogOut,
  IconSparkles,
  IconArrowRight,
} from './ui/icons';
import { createClient } from '@/lib/supabase/client';

type Action = {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  shortcut?: string;
  group: 'Navigate' | 'Theme' | 'Session' | 'Result';
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  run: () => void | Promise<void>;
};

type PaletteContextValue = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const PaletteContext = React.createContext<PaletteContextValue | null>(null);

export function useCommandPalette(): PaletteContextValue {
  const ctx = React.useContext(PaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be used inside CommandPaletteProvider');
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const value = React.useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <PaletteContext.Provider value={value}>
      {children}
      {isOpen ? <CommandPalette onClose={close} /> : null}
    </PaletteContext.Provider>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [query, setQuery] = React.useState('');
  const [activeIdx, setActiveIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const nav = React.useCallback(
    (path: Route) => {
      onClose();
      router.push(path);
    },
    [onClose, router],
  );

  const actions = React.useMemo<Action[]>(
    () => [
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        hint: '/app',
        keywords: 'home overview',
        group: 'Navigate',
        Icon: IconHome,
        run: () => nav('/app'),
      },
      {
        id: 'nav-jobs',
        label: 'Go to Jobs inbox',
        hint: '/jobs',
        keywords: 'inbox pipeline discover',
        group: 'Navigate',
        Icon: IconInbox,
        run: () => nav('/jobs'),
      },
      {
        id: 'nav-queue',
        label: 'Go to Review queue',
        hint: '/queue',
        keywords: 'manual review pending',
        group: 'Navigate',
        Icon: IconLayers,
        run: () => nav('/queue'),
      },
      {
        id: 'nav-tracker',
        label: 'Go to Tracker',
        hint: '/tracker',
        keywords: 'kanban applications funnel',
        group: 'Navigate',
        Icon: IconTrello,
        run: () => nav('/tracker'),
      },
      {
        id: 'nav-analytics',
        label: 'Go to Analytics',
        hint: '/analytics',
        keywords: 'metrics response rate charts',
        group: 'Navigate',
        Icon: IconBarChart,
        run: () => nav('/analytics'),
      },
      {
        id: 'nav-profile',
        label: 'Go to Master profile',
        hint: '/profile',
        keywords: 'contact skills stories preferences',
        group: 'Navigate',
        Icon: IconUser,
        run: () => nav('/profile'),
      },
      {
        id: 'nav-onboarding',
        label: 'Open onboarding wizard',
        hint: '/onboarding',
        keywords: 'setup import resume',
        group: 'Navigate',
        Icon: IconSparkles,
        run: () => nav('/onboarding'),
      },
      {
        id: 'theme-light',
        label: 'Set theme: Light',
        keywords: 'appearance color mode day',
        group: 'Theme',
        Icon: IconSun,
        run: () => {
          setTheme('light');
          onClose();
        },
      },
      {
        id: 'theme-dark',
        label: 'Set theme: Dark',
        keywords: 'appearance color mode night',
        group: 'Theme',
        Icon: IconMoon,
        run: () => {
          setTheme('dark');
          onClose();
        },
      },
      {
        id: 'theme-system',
        label: 'Set theme: System',
        keywords: 'appearance auto',
        group: 'Theme',
        Icon: IconMonitor,
        run: () => {
          setTheme('system');
          onClose();
        },
      },
      {
        id: 'sign-out',
        label: 'Sign out',
        keywords: 'logout leave exit',
        group: 'Session',
        Icon: IconLogOut,
        run: async () => {
          onClose();
          const supabase = createClient();
          await supabase.auth.signOut();
          router.replace('/login');
          router.refresh();
        },
      },
    ],
    [nav, onClose, router, setTheme],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => {
      const hay = `${a.label} ${a.hint ?? ''} ${a.keywords ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [actions, query]);

  const grouped = React.useMemo(() => {
    const map = new Map<Action['group'], Action[]>();
    for (const a of filtered) {
      const list = map.get(a.group) ?? [];
      list.push(a);
      map.set(a.group, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  React.useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  React.useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(Math.max(0, filtered.length - 1));
  }, [activeIdx, filtered.length]);

  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-cmd-idx="${activeIdx}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const a = filtered[activeIdx];
      if (a) void a.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let idxCursor = 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 grid place-items-start justify-center px-4 pt-[15vh] animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface/95 shadow-elevation-3 backdrop-blur animate-scale-in">
        <div className="flex items-center gap-2 border-b border-border/60 px-3">
          <IconSearch className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search actions, jump to page…"
            className="h-12 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden select-none rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:inline-flex">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {grouped.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">No matches for &ldquo;{query}&rdquo;</p>
              <p className="mt-1 text-2xs text-muted-foreground">
                Try &lsquo;jobs&rsquo;, &lsquo;theme&rsquo;, or a page name.
              </p>
            </div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="mb-1 last:mb-0">
                <div className="px-2 pb-1 pt-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </div>
                {items.map((a) => {
                  const idx = idxCursor++;
                  const active = idx === activeIdx;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      data-cmd-idx={idx}
                      onClick={() => void a.run()}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors duration-100',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground/85 hover:bg-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-7 shrink-0 place-items-center rounded-md',
                          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/70',
                        )}
                      >
                        <a.Icon className="size-3.5" />
                      </span>
                      <span className="flex-1 truncate">{a.label}</span>
                      {a.hint ? (
                        <span className="hidden font-mono text-2xs text-muted-foreground sm:inline">
                          {a.hint}
                        </span>
                      ) : null}
                      {active ? <IconArrowRight className="size-3.5 opacity-70" /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 bg-surface-elevated/50 px-3 py-2 text-2xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono">↵</kbd>
              select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono">⌘K</kbd>
            toggle
          </span>
        </div>
      </div>
    </div>
  );
}

export function CommandPaletteTrigger({ className }: { className?: string }) {
  const { open } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        'group inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface pl-2 pr-1.5 text-xs text-muted-foreground shadow-elevation-1 transition-colors',
        'hover:border-primary/40 hover:text-foreground',
        className,
      )}
      aria-label="Open command palette (Cmd or Ctrl + K)"
    >
      <IconSearch className="size-3.5" />
      <span className="hidden sm:inline">Search or jump…</span>
      <span className="ml-auto flex items-center gap-0.5 rounded border border-border bg-muted px-1 py-0.5 font-mono text-2xs">
        <span className="hidden md:inline">⌘</span>
        <span className="md:hidden">Ctrl</span>K
      </span>
    </button>
  );
}
