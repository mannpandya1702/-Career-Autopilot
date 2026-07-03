import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/app-shell';
import {
  IconArrowRight,
  IconSparkles,
  IconTarget,
  IconFileText,
  IconCheck,
  IconInbox,
  IconBriefcase,
  IconLayers,
} from '@/components/ui/icons';

export const metadata = { title: 'Career Autopilot — Your personal job engine' };

const PIPELINE = [
  {
    step: '01',
    title: 'Discover',
    body: 'Pulls fresh openings from Greenhouse, Lever, Ashby, Workable, SmartRecruiters — and dedupes them.',
    Icon: IconBriefcase,
  },
  {
    step: '02',
    title: 'Score',
    body: 'Vector-similar to your real experience, then judged by an LLM against your must-haves.',
    Icon: IconTarget,
  },
  {
    step: '03',
    title: 'Tailor',
    body: 'Rewrites your résumé per role — anchored to your master profile. No invented skills, ever.',
    Icon: IconFileText,
  },
  {
    step: '04',
    title: 'Verify',
    body: 'A 3-parser ATS ensemble confirms every tailor scores ≥ 80 before you see it.',
    Icon: IconCheck,
  },
  {
    step: '05',
    title: 'Submit',
    body: 'ATS-direct APIs first, Playwright for portals, human review as the safety net.',
    Icon: IconInbox,
  },
];

const PROMISES = [
  {
    title: 'Anchored to your profile',
    body: "Every claim traces back to something you actually did. If it's not in your master profile, the tailor won't say it.",
  },
  {
    title: 'Privacy-classified prompts',
    body: 'Sensitive fields (salary, address, phone) route only to the paid, opt-out LLM. Public JD text uses the free tier.',
  },
  {
    title: 'Human-in-the-loop by default',
    body: 'Auto-submit is off until you flip a hard-coded gate. Every application waits in the review queue for your sign-off.',
  },
];

const STATS = [
  { value: '≥ 80', label: 'ATS verifier score', hint: 'Below → auto-regenerate' },
  { value: '0', label: 'Auto-submits by default', hint: 'You flip the safety gate' },
  { value: '3', label: 'Parsers in the ensemble', hint: 'pyresparser · OpenResume · custom' },
  { value: '30/day', label: 'Application cap', hint: 'Hard-coded ceiling' },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <HeroBackdrop />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <BrandMark />
        <nav className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/login">
            <Button size="sm">
              Open workspace
              <IconArrowRight />
            </Button>
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <section className="mx-auto max-w-3xl pt-14 text-center sm:pt-20">
          <div className="inline-flex animate-fade-in-up items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-full rounded-full bg-success" />
            </span>
            <span className="font-mono">personal · single-user · privacy-first</span>
          </div>
          <h1
            className="mt-6 animate-fade-in-up text-balance text-5xl font-semibold tracking-tight sm:text-6xl"
            style={{ animationDelay: '80ms' }}
          >
            Your job hunt,{' '}
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              on autopilot.
            </span>
          </h1>
          <p
            className="mx-auto mt-5 max-w-xl animate-fade-in-up text-balance text-base text-muted-foreground sm:text-lg"
            style={{ animationDelay: '160ms' }}
          >
            Discover, score, tailor, verify, and submit — one honest pipeline. Nothing invented,
            nothing sent without your sign-off.
          </p>
          <div
            className="mt-8 flex animate-fade-in-up flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: '240ms' }}
          >
            <Link href="/login">
              <Button size="lg">
                Sign in with email
                <IconArrowRight />
              </Button>
            </Link>
            <a href="#pipeline">
              <Button size="lg" variant="secondary">
                How it works
              </Button>
            </a>
          </div>
        </section>

        <section className="mt-16 sm:mt-20">
          <div className="grid gap-3 rounded-2xl border border-border bg-surface/60 p-3 shadow-elevation-1 backdrop-blur sm:grid-cols-4">
            {STATS.map(({ value, label, hint }) => (
              <div
                key={label}
                className="rounded-lg bg-surface-elevated/60 p-4 text-center transition-colors hover:bg-surface"
              >
                <p className="font-mono text-2xl font-semibold tabular-nums text-primary sm:text-3xl">
                  {value}
                </p>
                <p className="mt-1 text-2xs font-medium uppercase tracking-wider text-foreground/80">
                  {label}
                </p>
                <p className="mt-0.5 text-2xs text-muted-foreground">{hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pipeline" className="mt-24 sm:mt-32">
          <div className="mb-10 text-center">
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-primary">
              The five stages
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              A pipeline, not a chatbot.
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              Each stage has its own worker, its own tests, and its own retry policy. What comes
              out at the end is signed off — either by verifier score or by you.
            </p>
          </div>

          <PipelineTrack />
        </section>

        <section className="mt-24 sm:mt-32">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 via-surface to-accent/5 p-8 sm:p-12">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-md">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <IconSparkles className="size-3" />
                  Honesty engine
                </div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl text-balance">
                  Every tailored line traces back to your profile.
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  If a role wants something you don&apos;t have, the tailor says so — it never
                  invents. And the ATS verifier scores your résumé the same way real applicant
                  tracking systems do, before anything is sent.
                </p>
              </div>
              <ul className="w-full max-w-md space-y-3">
                {PROMISES.map(({ title, body }) => (
                  <li
                    key={title}
                    className="rounded-lg border border-border bg-surface/70 p-3.5 shadow-elevation-1 backdrop-blur"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                        <IconCheck className="size-3" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-24 grid gap-4 rounded-2xl border border-border bg-surface p-8 shadow-elevation-1 sm:mt-32 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8">
          <div>
            <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-primary">
              Ready when you are
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              Sign in with your email. No password.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Magic-link auth via Supabase. Your queue and tailors stay exactly where you left them.
            </p>
          </div>
          <Link href="/login">
            <Button size="lg">
              Sign in
              <IconArrowRight />
            </Button>
          </Link>
        </section>

        <footer className="mt-16 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 pb-10 text-xs text-muted-foreground sm:flex-row">
          <span className="font-mono">career.autopilot · built for one</span>
          <span>Runs on free-tier infra. One paid line: the privacy LLM.</span>
        </footer>
      </main>
    </div>
  );
}

function HeroBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 right-1/4 size-[520px] rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-40 size-[420px] rounded-full bg-info/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/4 size-[480px] rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </>
  );
}

function PipelineTrack() {
  return (
    <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent lg:block"
      />
      {PIPELINE.map(({ step, title, body, Icon }, idx) => (
        <li
          key={step}
          className="group relative animate-fade-in-up rounded-lg border border-border bg-surface p-4 shadow-elevation-1 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevation-2"
          style={{ animationDelay: `${idx * 60}ms` }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-muted-foreground">{step}</span>
            <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-4" />
            </span>
          </div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1.5 text-xs text-muted-foreground">{body}</p>
          {idx < PIPELINE.length - 1 ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 rounded-full border border-border bg-surface p-1 text-muted-foreground group-hover:border-primary/40 group-hover:text-primary lg:inline-flex"
            >
              <IconArrowRight className="size-3" />
            </span>
          ) : null}
        </li>
      ))}
      <li className="hidden lg:block" aria-hidden="true">
        <div className="flex items-center justify-center rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 text-center text-xs text-primary">
          <IconLayers className="mr-1.5 size-3.5" /> One honest pipeline
        </div>
      </li>
    </ol>
  );
}
