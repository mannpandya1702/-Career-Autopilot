import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Career Autopilot</h1>
      <p className="max-w-md text-muted-foreground">
        Your personal job-application co-pilot. Sign in to continue.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
      >
        Sign in
      </Link>
    </main>
  );
}
