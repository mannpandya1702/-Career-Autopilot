'use client';

import { useState, useTransition } from 'react';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';

const FormSchema = z.object({ email: z.string().email('Enter a valid email') });

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

export function LoginForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    const parsed = FormSchema.safeParse({ email: formData.get('email') });
    if (!parsed.success) {
      setStatus({ kind: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid input' });
      return;
    }
    setStatus({ kind: 'submitting' });
    startTransition(async () => {
      try {
        const supabase = createClient();
        const origin = window.location.origin;
        const { error } = await supabase.auth.signInWithOtp({
          email: parsed.data.email,
          options: { emailRedirectTo: `${origin}/auth/callback` },
        });
        if (error) throw error;
        setStatus({ kind: 'sent' });
      } catch (err) {
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to send magic link',
        });
      }
    });
  }

  if (status.kind === 'sent') {
    return (
      <p className="text-sm text-muted-foreground">
        Check your inbox for the sign-in link.
      </p>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-primary"
          placeholder="you@example.com"
        />
      </label>
      <button
        type="submit"
        disabled={isPending || status.kind === 'submitting'}
        className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {status.kind === 'submitting' ? 'Sending…' : 'Send magic link'}
      </button>
      {status.kind === 'error' ? (
        <p className="text-sm text-red-600">{status.message}</p>
      ) : null}
    </form>
  );
}
