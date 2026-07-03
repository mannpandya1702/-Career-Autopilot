import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/app-shell';
import {
  IconArrowRight,
  IconSparkles,
  IconTarget,
  IconFileText,
  IconCheck,
} from '@/components/ui/icons';

export const metadata = { title: 'Career Autopilot — Your personal job engine' };

const PIPELINE = [
  {
    step: '01',
    title: 'Discover',
    body: 'Pulls fresh openings from Greenhouse, Lever, Ashby, Workable, SmartRecruiters — and dedupes them.',
  },
  {
    step: '02',
    title: 'Score',
    body: 'Vector-similar to your real experience, then judged by an LLM against your must-haves.',
  },
  {
    step: '03',
    title: 'Tailor',
    body: 'Rewrites your résumé per role — anchored to your master profile. No invented skills, ever.',
  },
  {
    step: '04',
    title: 'Verify',
    body: 'A 3-parser ATS ensemble confirms every tailor scores ≥ 80 before you see it.',
  },
  {
    step: '05',
    title: 'Submit',
    body: 'ATS-direct APIs first, Playwright for portals, human review as the safety net.',
  },
];

const PROMISES = [
  'Only re-emphasizes experience that exists in your master profile.',
  'Sensitive prompts never touch free-tier LLMs.',
  'Nothing is auto-submitted until you flip the switch.',
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 right-1/4 size-[520px] rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/4 size-[480px] rounded-full bg-accent/15 blur-3xl" />

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
        <section className="mx-auto max-w-3xl pt-16 text-center sm:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="inline-block size-1.5 rounded-full bg-success animate-pulse" />
            <span className="font-mono">personal · single-user · privacy-first</span>
          </div>
          <h1 className="mt-6 text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
            Your job hunt,{' '}
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              on autopilot.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            Discover, score, tailor, verify, and submit — one honest pipeline. Nothing invented,
            nothing sent without your sign-off.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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

        <section id="pipeline" className="mt-24 sm:mt-32">
          <div className="mb-10 text-center">
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-primary">
              The five stages
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              A pipeline, not a chatbot.
            </h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PIPELINE.map(({ step, title, body }) => (
              <li
                key={step}
                className="group rounded-lg border border-border bg-surface p-5 shadow-elevation-1 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-elevation-2 hover:border-primary/30"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {step}
                  </span>
                  <StageIcon step={step} />
                </div>
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-24 sm:mt-32">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 sm:p-12">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <IconSparkles className="size-3" />
                  Honesty engine
                </div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Every tailored line traces back to your profile.
                </h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  If a role wants something you don&apos;t have, the tailor says so — it never
                  invents. And the ATS verifier scores your résumé the same way real applicant
                  tracking systems do, before anything is sent.
                </p>
              </div>
              <ul className="space-y-2 text-sm">
                {PROMISES.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                      <IconCheck className="size-2.5" />
                    </span>
                    <span className="text-foreground/80">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <footer className="mt-24 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 pb-10 text-xs text-muted-foreground sm:flex-row">
          <span className="font-mono">career.autopilot · built for one</span>
          <span>Runs on free-tier infra. One paid line: the privacy LLM.</span>
        </footer>
      </main>
    </div>
  );
}

function StageIcon({ step }: { step: string }) {
  const Cmp = step === '03' ? IconFileText : step === '04' ? IconCheck : IconTarget;
  return (
    <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
      <Cmp className="size-4" />
    </span>
  );
}
