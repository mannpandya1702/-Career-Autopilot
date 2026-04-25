import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getJobById } from '@/lib/jobs/queries';
import { getLatestTailoredResume } from '@/lib/jobs/tailored';
import { getLatestVerification } from '@/lib/jobs/verifications';
import { ReviewWorkspace } from './ReviewWorkspace';

export const metadata = { title: 'Review — Career Autopilot' };

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const job = await getJobById(id);
  if (!job) notFound();

  const tailored = await getLatestTailoredResume(user.id, id);
  const verification = tailored
    ? await getLatestVerification(user.id, tailored.id)
    : null;

  return (
    <ReviewWorkspace job={job} tailored={tailored} verification={verification} />
  );
}
