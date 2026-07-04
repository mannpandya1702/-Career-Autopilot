// Returns the autofill payload the LinkedIn / Indeed Easy Apply modal
// consumes. We do NOT generate a fresh tailored resume here (that's a
// 90-second LLM call); we serve the most-recent tailored resume we have
// for this company+title, falling back to the master profile contact
// info + a generic summary so the modal at least has the basics.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@career-autopilot/db';
import { env } from '@/env';
import { userFromBearer } from '@/lib/extension/auth';

export const runtime = 'nodejs';

const RequestSchema = z.object({
  job: z.object({
    title: z.string(),
    company: z.string(),
    description: z.string(),
  }),
});

export async function POST(request: Request): Promise<NextResponse> {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const supabase = createServiceClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  const profileRes = await supabase
    .from('profiles')
    .select('full_name, email, phone, derived_summary')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: 'no_profile' }, { status: 404 });
  }

  // Most-recent cover letter for this company+title (any tailored resume
  // we already produced). Best-effort — null when nothing matches.
  const tailoredRes = await supabase
    .from('tailored_resumes')
    .select(
      'id, resume_json, cover_letter:cover_letters(body), question_answers:question_answers(question_text, answer_text)',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  type TailoredRow = {
    cover_letter?: { body?: string } | null;
    question_answers?: { question_text: string; answer_text: string }[] | null;
  };
  const tailored = (tailoredRes.data as unknown as TailoredRow | null) ?? null;

  return NextResponse.json({
    full_name: profileRes.data.full_name,
    email: profileRes.data.email,
    phone: profileRes.data.phone,
    resume_summary: profileRes.data.derived_summary ?? '',
    cover_letter_body: tailored?.cover_letter?.body ?? null,
    answers: tailored?.question_answers ?? [],
  });
}
