import Link from 'next/link';
import { LoginForm } from './login-form';
import { BrandMark } from '@/components/app-shell';
import { ThemeToggle } from '@/components/theme-toggle';
import { IconCheck } from '@/components/ui/icons';

export const metadata = { title: 'Sign in' };

const PROMISES = [
  'Magic-link only. No password to lose.',
  'Sensitive prompts never touch free-tier LLMs.',
  'Auto-submit is off until you turn it on.',
];

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 right-1/3 size-[440px] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 size-[400px] rounded-full bg-accent/15 blur-3xl" />

      <header className="relative z-10 flex items-center justify-between px-6 py-6">
        <BrandMark />
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-16">
        <div className="grid w-full max-w-4xl gap-8 lg:grid-cols-[1.15fr,1fr] lg:gap-14">
          <div className="hidden lg:flex lg:flex-col lg:justify-center">
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-primary">
              Welcome back
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight">
              Pick up where the pipeline left off.
            </h1>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Your queue, tailors, and tracker are exactly as you left them. Sign in with the
              same email you onboarded with.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {PROMISES.map((p) => (
                <li key={p} className="flex items-start gap-2 text-foreground/80">
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <IconCheck className="size-2.5" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="animate-fade-in-up rounded-2xl border border-border bg-surface p-6 shadow-elevation-3 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;ll email you a one-time link. No password needed.
              </p>
            </div>
            <LoginForm />
            <p className="mt-6 text-xs text-muted-foreground">
              New here?{' '}
              <Link href="/" className="text-primary hover:underline">
                See how it works
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
