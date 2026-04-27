import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listTrackerCards } from '@/lib/tracker/queries';
import { TrackerBoard } from './TrackerBoard';

export const metadata = { title: 'Tracker — Career Autopilot' };

export default async function TrackerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const cards = await listTrackerCards(user.id);
  return <TrackerBoard cards={cards} />;
}
