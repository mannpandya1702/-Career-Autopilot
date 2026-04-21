'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';

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
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground disabled:opacity-60"
    >
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
