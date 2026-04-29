import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAnalyticsSnapshot } from '@/lib/analytics/queries';
import { AnalyticsDashboard } from './AnalyticsDashboard';

export const metadata = { title: 'Analytics — Career Autopilot' };

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const snapshot = await getAnalyticsSnapshot(user.id);
  return <AnalyticsDashboard snapshot={snapshot} />;
}
