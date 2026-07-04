import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAnalyticsSnapshot } from '@/lib/analytics/queries';
import { AppShell, PageHeader } from '@/components/app-shell';
import { SignOutButton } from '@/app/app/sign-out-button';
import { AnalyticsDashboard } from './AnalyticsDashboard';

export const metadata = { title: 'Analytics' };

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const snapshot = await getAnalyticsSnapshot(user.id);
  return (
    <AppShell userEmail={user.email ?? null} headerActions={<SignOutButton />}>
      <PageHeader
        eyebrow="Signals"
        title="Analytics"
        description="Response rates, funnel drop-off, and LLM spend. Everything the honesty engine can measure."
      />
      <AnalyticsDashboard snapshot={snapshot} />
    </AppShell>
  );
}
