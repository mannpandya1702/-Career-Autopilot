import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getJobById } from '@/lib/jobs/queries';
import { getLatestTailoredResume } from '@/lib/jobs/tailored';
import { getLatestVerification } from '@/lib/jobs/verifications';
import { getLatestCoverLetter } from '@/lib/jobs/cover-letter';
import { listAnswersForJob } from '@/lib/jobs/qa';
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
  const [verification, coverLetter, answers] = await Promise.all([
    tailored ? getLatestVerification(user.id, tailored.id) : Promise.resolve(null),
    tailored ? getLatestCoverLetter(user.id, tailored.id) : Promise.resolve(null),
    listAnswersForJob(user.id, id),
  ]);

  return (
    <ReviewWorkspace
      job={job}
      tailored={tailored}
      verification={verification}
      coverLetter={coverLetter}
      answers={answers}
    />
  );
}
