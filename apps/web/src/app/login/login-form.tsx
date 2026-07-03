'use client';

import { useState, useTransition } from 'react';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { IconMail, IconArrowRight, IconCheck } from '@/components/ui/icons';

const FormSchema = z.object({ email: z.string().email('Enter a valid email') });

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'sent'; email: string }
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
        setStatus({ kind: 'sent', email: parsed.data.email });
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
      <div className="flex flex-col items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-6 text-center animate-fade-in-up">
        <div className="grid size-10 place-items-center rounded-full bg-success text-success-foreground">
          <IconCheck className="size-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Check your inbox</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            We sent a link to <span className="font-mono text-foreground">{status.email}</span>.
            It expires in 15 minutes.
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => setStatus({ kind: 'idle' })}
        >
          Use a different email
        </button>
      </div>
    );
  }

  const invalid = status.kind === 'error';
  const submitting = isPending || status.kind === 'submitting';

  return (
    <form action={onSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="email" required>
          Email
        </Label>
        <div className="relative">
          <IconMail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            invalid={invalid}
            placeholder="you@example.com"
            className="pl-8"
          />
        </div>
        {invalid ? <FieldError>{status.message}</FieldError> : null}
      </div>

      <Button type="submit" className="w-full" loading={submitting}>
        {submitting ? 'Sending' : 'Send magic link'}
        {!submitting ? <IconArrowRight /> : null}
      </Button>
    </form>
  );
}
