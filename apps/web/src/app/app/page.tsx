import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SignOutButton } from './sign-out-button';
import { SentryTestButton } from './sentry-test-button';

export const metadata = { title: 'Career Autopilot — App' };

export default async function AppHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Career Autopilot</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium">{user.email}</span>
        </p>
      </header>

      <section className="rounded-md border border-border bg-white p-4 text-sm">
        <p className="text-muted-foreground">
          This is the Phase 1 placeholder screen. Subsequent phases add onboarding, jobs, tailoring,
          review, and submission workflows here.
        </p>
      </section>

      <div className="flex items-center gap-3">
        <SignOutButton />
        <SentryTestButton />
      </div>
    </main>
  );
}
