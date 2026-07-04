import { AppShell, PageHeader } from '@/components/app-shell';
import { KanbanCardSkeleton } from '@/components/ui/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

const COLUMNS = ['Submitted', 'Acknowledged', 'Responded', 'Interviewing', 'Offered', 'Rejected'];

export default function TrackerLoading() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Application funnel"
        title="Tracker"
        description="Drag a card to record an outcome."
      />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {COLUMNS.map((col) => (
          <div
            key={col}
            className="flex min-h-[420px] flex-col gap-2 rounded-lg border border-border bg-surface-elevated/60 p-2.5"
          >
            <div className="flex items-center justify-between px-1 pt-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-6 rounded-md" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <KanbanCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
