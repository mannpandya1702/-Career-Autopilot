import { NextResponse } from 'next/server';
import { FullProfileSchema } from '@career-autopilot/resume';
import { createClient } from '@/lib/supabase/server';
import { loadFullProfileForUser } from '@/lib/profile/queries';

export const runtime = 'nodejs';

// P2.7 — "Download profile as JSON". Returns a file matching FullProfileSchema.
export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const full = await loadFullProfileForUser(user.id);
  if (!full) return NextResponse.json({ error: 'no_profile' }, { status: 404 });

  const payload = {
    ...full,
    exported_at: new Date().toISOString(),
    schema_version: 1 as const,
  };

  // Validate before sending: guarantees export matches the Zod contract
  // (acceptance criterion "Profile export returns valid JSON that matches the Zod schema").
  const parsed = FullProfileSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'export_shape_mismatch', issues: parsed.error.issues },
      { status: 500 },
    );
  }

  return new NextResponse(JSON.stringify(parsed.data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="career-autopilot-profile-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    },
  });
}
