'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';
import {
  IconHome,
  IconInbox,
  IconLayers,
  IconTrello,
  IconBarChart,
  IconUser,
  IconMenu,
  IconX,
  IconSparkles,
} from './ui/icons';

type NavItem = {
  href: Route;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: string;
};

const PRIMARY_NAV: NavItem[] = [
  { href: '/app', label: 'Dashboard', Icon: IconHome },
  { href: '/jobs', label: 'Jobs', Icon: IconInbox },
  { href: '/queue', label: 'Review Queue', Icon: IconLayers },
  { href: '/tracker', label: 'Tracker', Icon: IconTrello },
  { href: '/analytics', label: 'Analytics', Icon: IconBarChart },
];

const SECONDARY_NAV: NavItem[] = [{ href: '/profile', label: 'Profile', Icon: IconUser }];

export function AppShell({
  children,
  userEmail,
  headerActions,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
  headerActions?: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onMenuClick={() => setMobileOpen(true)}
          userEmail={userEmail}
          actions={headerActions}
        />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  return (
    <>
      {mobileOpen ? (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-foreground/40 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface',
          'transform transition-transform duration-200 ease-out-expo lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <BrandMark />
          <button
            aria-label="Close menu"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted lg:hidden"
          >
            <IconX className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          <NavSection label="Workspace" items={PRIMARY_NAV} />
          <NavSection label="Account" items={SECONDARY_NAV} />
        </nav>

        <div className="border-t border-border p-3">
          <div className="rounded-lg border border-border bg-surface-elevated p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <IconSparkles className="size-3.5 text-accent" />
              Honesty engine
            </div>
            <p className="mt-1 text-2xs text-muted-foreground leading-snug">
              Every tailor stays anchored to your master profile. No fabricated skills, ever.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavSection({ label, items }: { label: string; items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <div>
      <p className="mb-2 px-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map(({ href, label: itemLabel, Icon, badge }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors duration-150',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'size-4 shrink-0 transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                  )}
                />
                <span className="flex-1 truncate">{itemLabel}</span>
                {badge ? (
                  <span className="rounded bg-accent/15 px-1.5 py-0.5 text-2xs font-semibold text-accent">
                    {badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TopBar({
  onMenuClick,
  userEmail,
  actions,
}: {
  onMenuClick: () => void;
  userEmail?: string | null | undefined;
  actions?: React.ReactNode | undefined;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        aria-label="Open menu"
        onClick={onMenuClick}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted lg:hidden"
      >
        <IconMenu className="size-4" />
      </button>

      <div className="flex flex-1 items-center gap-3">{actions}</div>

      <ThemeToggle />

      {userEmail ? (
        <div
          className="hidden items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex"
          title={userEmail}
        >
          <span className="inline-block size-1.5 rounded-full bg-success" />
          <span className="max-w-[180px] truncate font-mono">{userEmail}</span>
        </div>
      ) : null}
    </header>
  );
}

export function BrandMark() {
  return (
    <Link href="/app" className="group inline-flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground shadow-elevation-2">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden="true"
        >
          <path d="m4 18 6-6-6-6" />
          <path d="M12 20h8" />
        </svg>
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          career.autopilot
        </span>
        <span className="text-2xs text-muted-foreground">Personal job engine</span>
      </span>
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
