import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listJobs } from '@/lib/jobs/queries';
import { JobsInbox } from './JobsInbox';

export const metadata = { title: 'Jobs — Career Autopilot' };

interface JobsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ALLOWED_STATUSES = new Set([
  'active',
  'closed',
  'pending_review',
  'needs_decision',
  'low_fit',
  'submitted',
  'responded',
  'interviewing',
  'offered',
  'rejected',
  'stale',
]);
const ALLOWED_ATS = new Set(['greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'custom'] as const);
type AllowedAts = 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters' | 'custom';

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const statusParam = typeof params['status'] === 'string' ? params['status'] : 'active';
  const atsParam = typeof params['ats'] === 'string' ? params['ats'] : undefined;

  const filters: Parameters<typeof listJobs>[0] = {
    status: ALLOWED_STATUSES.has(statusParam) ? statusParam : 'active',
    limit: 100,
  };
  if (atsParam && ALLOWED_ATS.has(atsParam as AllowedAts)) {
    filters.ats = atsParam as AllowedAts;
  }

  const jobs = await listJobs(filters);

  return <JobsInbox initialJobs={jobs} activeStatus={filters.status ?? 'active'} activeAts={filters.ats ?? 'all'} />;
}
