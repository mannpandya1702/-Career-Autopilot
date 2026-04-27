import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listManualReviewQueue } from '@/lib/queue/queries';
import { QueueList } from './QueueList';

export const metadata = { title: 'Manual review — Career Autopilot' };

export default async function QueuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const items = await listManualReviewQueue(user.id);
  return <QueueList items={items} />;
}
