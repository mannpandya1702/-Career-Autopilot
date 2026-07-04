import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listManualReviewQueue } from '@/lib/queue/queries';
import { AppShell, PageHeader } from '@/components/app-shell';
import { SignOutButton } from '@/app/app/sign-out-button';
import { QueueList } from './QueueList';

export const metadata = { title: 'Manual review' };

export default async function QueuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const items = await listManualReviewQueue(user.id);
  return (
    <AppShell userEmail={user.email ?? null} headerActions={<SignOutButton />}>
      <PageHeader
        eyebrow="Human-in-the-loop"
        title="Manual review queue"
        description="Applications the worker couldn't complete automatically. Finish each by hand on the apply page, then mark it here."
      />
      <QueueList items={items} />
    </AppShell>
  );
}
