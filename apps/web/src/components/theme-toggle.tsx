'use client';

import * as React from 'react';
import { useTheme } from './theme-provider';
import { IconSun, IconMoon, IconMonitor } from './ui/icons';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'light', Icon: IconSun, label: 'Light' },
  { value: 'system', Icon: IconMonitor, label: 'System' },
  { value: 'dark', Icon: IconMoon, label: 'Dark' },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5 shadow-elevation-1"
    >
      {OPTIONS.map(({ value, Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex size-7 items-center justify-center rounded transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
