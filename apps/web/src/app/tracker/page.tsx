import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listTrackerCards } from '@/lib/tracker/queries';
import { AppShell, PageHeader } from '@/components/app-shell';
import { SignOutButton } from '@/app/app/sign-out-button';
import { TrackerBoard } from './TrackerBoard';

export const metadata = { title: 'Tracker' };

export default async function TrackerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const cards = await listTrackerCards(user.id);
  return (
    <AppShell userEmail={user.email ?? null} headerActions={<SignOutButton />}>
      <PageHeader
        eyebrow="Application funnel"
        title="Tracker"
        description="Drag a card to record an outcome. Cards move automatically when the email poller classifies inbound mail."
      />
      <TrackerBoard cards={cards} />
    </AppShell>
  );
}
