import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadFullProfileForUser } from '@/lib/profile/queries';
import { AppShell, PageHeader } from '@/components/app-shell';
import { SignOutButton } from '@/app/app/sign-out-button';
import { Button } from '@/components/ui/button';
import { IconFileText } from '@/components/ui/icons';
import { ProfileEditor } from './ProfileEditor';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const full = await loadFullProfileForUser(user.id);
  if (!full) redirect('/onboarding');

  return (
    <AppShell userEmail={user.email ?? null} headerActions={<SignOutButton />}>
      <PageHeader
        eyebrow="Source of truth"
        title="Master profile"
        description="Every tailored résumé and cover letter is anchored to what's here. If it's not in your profile, the tailor won't claim it."
        actions={
          <a href="/api/profile/export" download>
            <Button variant="secondary" size="sm">
              <IconFileText /> Export JSON
            </Button>
          </a>
        }
      />
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
    </AppShell>
  );
}
