'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { IconCheck, IconAlert, IconX } from './icons';

type ToastTone = 'success' | 'error' | 'info';

type ToastRecord = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastContextValue = {
  toast: (t: { title: string; description?: string; tone?: ToastTone }) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);

  const remove = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    ({
      title,
      description,
      tone = 'info',
    }: {
      title: string;
      description?: string;
      tone?: ToastTone;
    }) => {
      const id = nextId++;
      const rec: ToastRecord = { id, title, tone };
      if (description !== undefined) rec.description = description;
      setToasts((prev) => [...prev, rec]);
      window.setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} record={t} onDismiss={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  record,
  onDismiss,
}: {
  record: ToastRecord;
  onDismiss: () => void;
}) {
  const { tone, title, description } = record;
  const style =
    tone === 'success'
      ? { border: 'border-success/30', bg: 'bg-success/5', accent: 'text-success', Icon: IconCheck }
      : tone === 'error'
        ? {
            border: 'border-destructive/30',
            bg: 'bg-destructive/5',
            accent: 'text-destructive',
            Icon: IconAlert,
          }
        : {
            border: 'border-primary/30',
            bg: 'bg-primary/5',
            accent: 'text-primary',
            Icon: IconCheck,
          };
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto animate-fade-in-up rounded-lg border p-3 shadow-elevation-3 backdrop-blur',
        style.border,
        style.bg,
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-surface', style.accent)}>
          <style.Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <IconX className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
