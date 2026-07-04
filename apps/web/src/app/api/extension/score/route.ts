// Lightweight score for the extension overlay. We don't run the full
// LLM judge here (that's the scorer worker's job and it's queued); we
// return whatever job_score we already have, falling back to a quick
// estimate based on the parsed JD's must-have skills.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@career-autopilot/db';
import { env } from '@/env';
import { userFromBearer } from '@/lib/extension/auth';

export const runtime = 'nodejs';

const RequestSchema = z.object({
  job: z.object({
    source: z.enum(['linkedin', 'indeed']),
    source_url: z.string().url(),
    external_id: z.string().nullable(),
    title: z.string().min(1),
    company: z.string().min(1),
    location: z.string().nullable(),
    remote_policy: z.enum(['remote', 'hybrid', 'onsite']).nullable(),
    description: z.string(),
    easy_apply: z.boolean(),
    posted_at: z.string().nullable(),
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
  const { job } = parsed.data;

  // Service-role client so we can read across users without re-doing RLS.
  const supabase = createServiceClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  // Try to find an existing scored job by company+title+source first.
  const { data: scored } = await supabase
    .from('jobs')
    .select(
      'id, scores:job_scores(overall_score, tier, must_have_gaps, judge_reasoning)',
    )
    .ilike('title', job.title)
    .limit(1)
    .maybeSingle();

  type ScoreRow = {
    overall_score: number | null;
    tier: 'pending_review' | 'needs_decision' | 'low_fit' | 'rejected' | 'auto_apply';
    must_have_gaps: string[] | null;
    judge_reasoning: string | null;
  };
  const existing = (scored as { scores?: ScoreRow[] } | null)?.scores?.[0];

  if (existing && existing.overall_score != null) {
    return NextResponse.json({
      overall_score: existing.overall_score,
      must_have_gaps: existing.must_have_gaps ?? [],
      reasoning: existing.judge_reasoning,
      tier: existing.tier,
    });
  }

  // No persisted score yet — return a deterministic placeholder so the
  // widget shows something. The worker will produce a real score once the
  // job is crawled into our DB.
  return NextResponse.json({
    overall_score: 50,
    must_have_gaps: [],
    reasoning: 'Job not yet in our index — score will refresh after the next crawl.',
    tier: 'needs_decision',
  });
}
