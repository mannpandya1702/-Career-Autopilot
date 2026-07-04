import { AppShell, PageHeader } from '@/components/app-shell';
import { JobRowSkeleton } from '@/components/ui/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function JobsLoading() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Pipeline"
        title="Jobs inbox"
        description="Fresh openings, scored against your master profile."
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-72 rounded-lg" />
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="ml-auto h-9 w-full max-w-xs rounded-md" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-elevation-1">
            <div className="flex items-center justify-between border-b border-border bg-surface-elevated/60 px-3 py-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
            <ul className="divide-y divide-border/60">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i}>
                  <JobRowSkeleton />
                </li>
              ))}
            </ul>
          </div>
          <div className="min-h-[500px] rounded-lg border border-border bg-surface shadow-elevation-1 p-5">
            <div className="flex items-start gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
