import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadFullProfileForUser } from '@/lib/profile/queries';
import { ProfileEditor } from './ProfileEditor';

export const metadata = { title: 'Profile — Career Autopilot' };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const full = await loadFullProfileForUser(user.id);
  if (!full) redirect('/onboarding');

  return (
    <ProfileEditor
      data={{
        profile: full.profile,
        experiences: full.experiences,
        projects: full.projects,
        skills: full.skills,
        education: full.education,
        stories: full.stories,
        preferences: full.preferences,
        questionBank: full.question_bank,
      }}
    />
  );
}
