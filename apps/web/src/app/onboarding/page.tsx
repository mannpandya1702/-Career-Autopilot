import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadFullProfileForUser } from '@/lib/profile/queries';
import { OnboardingWizard } from './OnboardingWizard';
import type { OnboardingInitialData } from './wizard-types';

export const metadata = { title: 'Onboarding — Career Autopilot' };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const full = await loadFullProfileForUser(user.id);

  const initial: OnboardingInitialData = full
    ? {
        profile: full.profile,
        experiences: full.experiences,
        projects: full.projects,
        skills: full.skills,
        education: full.education,
        stories: full.stories,
        preferences: full.preferences,
        questionBank: full.question_bank,
      }
    : {
        profile: null,
        experiences: [],
        projects: [],
        skills: [],
        education: [],
        stories: [],
        preferences: null,
        questionBank: [],
      };

  return <OnboardingWizard initial={initial} />;
}
