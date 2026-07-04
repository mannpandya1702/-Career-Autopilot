import { AppShell, PageHeader } from '@/components/app-shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Source of truth"
        title="Master profile"
        description="Every tailored résumé is anchored to what's here."
      />
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
          <Skeleton className="size-9 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>
        <Skeleton className="h-10 w-full max-w-md rounded-lg" />
        <div className="rounded-lg border border-border bg-surface p-5">
          <Skeleton className="mb-4 h-4 w-32" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
