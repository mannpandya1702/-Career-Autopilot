import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getJobById } from '@/lib/jobs/queries';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const job = await getJobById(id);
  if (!job) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ job });
}
