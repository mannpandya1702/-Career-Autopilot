import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ExtensionHandoff } from './ExtensionHandoff';

export const metadata = { title: 'Connect extension — Career Autopilot' };

// /auth/extension is the bridge between the web app's authenticated
// session and the Chrome extension's local storage. The user opens
// this page from the popup, signs in if needed, then this page hands
// the session tokens to the extension via window.postMessage. The
// extension's content script (mounted on this exact origin) listens
// and persists the tokens via background.ts (CLAUDE.md §8.8).

export default async function ExtensionAuthPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login?next=/auth/extension');
  }

  return (
    <ExtensionHandoff
      accessToken={session.access_token}
      refreshToken={session.refresh_token}
      email={session.user.email ?? null}
    />
  );
}
