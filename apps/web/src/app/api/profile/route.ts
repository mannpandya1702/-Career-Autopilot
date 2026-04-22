import { NextResponse } from 'next/server';
import { ProfileInputSchema } from '@career-autopilot/resume';
import { createClient } from '@/lib/supabase/server';
import { loadProfileForUser } from '@/lib/profile/queries';
import { upsertProfile } from '@/lib/profile/mutations';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const profile = await loadProfileForUser(user.id);
  return NextResponse.json({ profile });
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const parsed = ProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  try {
    const { id } = await upsertProfile(user.id, parsed.data);
    const profile = await loadProfileForUser(user.id);
    return NextResponse.json({ id, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'upsert failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
