import { AppShell, PageHeader } from '@/components/app-shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function QueueLoading() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Human-in-the-loop"
        title="Manual review queue"
        description="Applications the worker couldn't complete automatically."
      />
      <div className="flex flex-col gap-8">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-8 rounded-md" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-5">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-8 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                    <div className="flex gap-2 pt-1">
                      <Skeleton className="h-5 w-24 rounded-md" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
