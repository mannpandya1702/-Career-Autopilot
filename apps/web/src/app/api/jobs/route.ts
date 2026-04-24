import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { listJobs } from '@/lib/jobs/queries';

export const runtime = 'nodejs';

const QuerySchema = z.object({
  status: z.string().optional(),
  company_id: z.string().uuid().optional(),
  ats: z
    .enum(['greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'custom'])
    .optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor_posted_at: z.string().optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_query', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  // Strip undefineds so `exactOptionalPropertyTypes: true` is happy when
  // passing into listJobs.
  const filters: Parameters<typeof listJobs>[0] = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) (filters as Record<string, unknown>)[k] = v;
  }
  const jobs = await listJobs(filters);
  return NextResponse.json({ jobs });
}
