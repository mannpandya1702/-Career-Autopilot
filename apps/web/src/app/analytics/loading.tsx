import { AppShell, PageHeader } from '@/components/app-shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function AnalyticsLoading() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Signals"
        title="Analytics"
        description="Response rates, funnel drop-off, and LLM spend."
      />
      <div className="flex flex-col gap-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-8 w-20" />
              <Skeleton className="mt-1 h-3 w-32" />
            </div>
          ))}
        </section>

        <div className="rounded-lg border border-border bg-surface p-5">
          <Skeleton className="mb-4 h-4 w-24" />
          <Skeleton className="h-72 w-full" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-5">
              <Skeleton className="mb-3 h-4 w-2/3" />
              <Skeleton className="h-60 w-full" />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
