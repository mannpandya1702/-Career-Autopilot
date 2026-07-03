'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { IconLogOut } from '@/components/ui/icons';

export function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace('/login');
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={onClick} loading={isPending}>
      {isPending ? 'Signing out' : 'Sign out'}
      {!isPending ? <IconLogOut /> : null}
    </Button>
  );
}
