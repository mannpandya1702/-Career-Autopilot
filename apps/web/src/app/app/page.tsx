import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell, PageHeader } from '@/components/app-shell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  IconArrowRight,
  IconInbox,
  IconLayers,
  IconTrello,
  IconBarChart,
  IconUser,
  IconSparkles,
} from '@/components/ui/icons';
import { SignOutButton } from './sign-out-button';
import { SentryTestButton } from './sentry-test-button';

export const metadata = { title: 'Dashboard' };

const SHORTCUTS: {
  href: Route;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  desc: string;
}[] = [
  {
    href: '/jobs',
    Icon: IconInbox,
    title: 'Jobs inbox',
    desc: 'Fresh openings, scored and ranked for your profile.',
  },
  {
    href: '/queue',
    Icon: IconLayers,
    title: 'Review queue',
    desc: 'Tailors waiting for your sign-off before they submit.',
  },
  {
    href: '/tracker',
    Icon: IconTrello,
    title: 'Application tracker',
    desc: 'Kanban of every application, from submitted to offer.',
  },
  {
    href: '/analytics',
    Icon: IconBarChart,
    title: 'Analytics',
    desc: 'Response rates, LLM spend, verifier calibration.',
  },
  {
    href: '/profile',
    Icon: IconUser,
    title: 'Master profile',
    desc: 'The single source of truth every tailor is anchored to.',
  },
];

export default async function AppHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <AppShell userEmail={user.email ?? null} headerActions={<SignOutButton />}>
      <PageHeader
        eyebrow="Overview"
        title={`Good to see you, ${user.email?.split('@')[0] ?? 'there'}.`}
        description="Your pipeline is idle. Jump into a workspace below or open the extension to score a job you're looking at right now."
        actions={<SentryTestButton />}
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Jobs in inbox" value="—" hint="Queue drains every 6 h" />
        <StatCard label="Awaiting review" value="—" hint="Verifier ≥ 80 only" />
        <StatCard label="Submitted this week" value="—" hint="Cap: 30/day" />
        <StatCard label="Callback rate" value="—" hint="Rolling 60 days" />
      </div>

      <div className="mb-8 rounded-lg border border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground shadow-elevation-2">
              <IconSparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Auto-submit is off.
              </p>
              <p className="text-xs text-muted-foreground">
                Every application waits in the queue for your explicit approval until you flip
                ENABLE_AUTO_SUBMIT.
              </p>
            </div>
          </div>
          <Badge variant="warning">Safety gate active</Badge>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Jump into
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHORTCUTS.map(({ href, Icon, title, desc }) => (
            <Link key={href} href={href} className="group">
              <Card interactive className="h-full">
                <CardHeader>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-4" />
                    </span>
                    <IconArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{desc}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s next</CardTitle>
            <CardDescription>
              These are the operational levers you can pull without leaving this screen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <NextItem>
                <strong>Seed companies</strong> — add Greenhouse/Lever slugs so the crawler has
                targets. Then run <code className="font-mono text-xs">pnpm crawl:enqueue</code>.
              </NextItem>
              <NextItem>
                <strong>Install the extension</strong> — score any LinkedIn or Indeed job you&apos;re
                already looking at.
              </NextItem>
              <NextItem>
                <strong>Turn on auto-submit</strong> — only after you&apos;ve reviewed 10+ dry-run
                applications and are happy with the output.
              </NextItem>
            </ul>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-elevation-1">
      <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-3xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1 text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function NextItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-foreground/80">
      <span className="mt-1.5 inline-block size-1 shrink-0 rounded-full bg-primary" />
      <span>{children}</span>
    </li>
  );
}
