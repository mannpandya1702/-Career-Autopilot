import 'server-only';

import type { OutcomeType } from '@career-autopilot/db';
import { createClient } from '@/lib/supabase/server';

export interface FunnelStage {
  stage: string;
  count: number;
}

export interface ResponseRateByBucket {
  bucket: string;
  applications: number;
  responses: number;
  response_rate: number;
}

export interface AnalyticsSnapshot {
  funnel: FunnelStage[];
  response_rate_by_fit_bucket: ResponseRateByBucket[];
  response_rate_by_source: ResponseRateByBucket[];
  cost_total_usd_month: number;
  total_submissions: number;
  total_responses: number;
}

const POSITIVE_STAGES = new Set<OutcomeType>([
  'callback',
  'interview_invite',
  'interview_completed',
  'offer',
  'accepted',
]);

export async function getAnalyticsSnapshot(userId: string): Promise<AnalyticsSnapshot> {
  const supabase = await createClient();

  // Pull every submission with its latest outcome stage + score + source.
  const { data: subData, error: subError } = await supabase
    .from('submissions')
    .select(
      'id, job_id, status, job:jobs(company:companies(ats_type)), outcomes:outcomes(stage, reached_at), scores:job_scores(overall_score)',
    )
    .eq('user_id', userId);
  if (subError) throw new Error(`submissions fetch failed: ${subError.message}`);

  type Joined = {
    id: string;
    status: string;
    job?: { company?: { ats_type?: string } | null } | null;
    outcomes?: { stage: OutcomeType; reached_at: string }[] | null;
    scores?: { overall_score: number | null }[] | null;
  };

  const rows = (subData ?? []) as unknown as Joined[];

  const funnelMap = new Map<string, number>([
    ['submitted', 0],
    ['acknowledged', 0],
    ['responded', 0],
    ['interviewing', 0],
    ['offered', 0],
    ['rejected', 0],
  ]);
  const fitBuckets = new Map<string, { apps: number; responses: number }>([
    ['<60', { apps: 0, responses: 0 }],
    ['60-74', { apps: 0, responses: 0 }],
    ['75-84', { apps: 0, responses: 0 }],
    ['85+', { apps: 0, responses: 0 }],
  ]);
  const sourceBuckets = new Map<string, { apps: number; responses: number }>();

  let totalSubs = 0;
  let totalResponses = 0;

  for (const row of rows) {
    if (row.status !== 'succeeded') continue;
    totalSubs += 1;
    funnelMap.set('submitted', (funnelMap.get('submitted') ?? 0) + 1);

    const stages = (row.outcomes ?? []).slice().sort((a, b) =>
      a.reached_at.localeCompare(b.reached_at),
    );
    const last = stages[stages.length - 1];

    if (stages.some((s) => s.stage === 'acknowledged')) {
      funnelMap.set('acknowledged', (funnelMap.get('acknowledged') ?? 0) + 1);
    }
    if (stages.some((s) => POSITIVE_STAGES.has(s.stage))) {
      funnelMap.set('responded', (funnelMap.get('responded') ?? 0) + 1);
      totalResponses += 1;
    }
    if (
      stages.some((s) => s.stage === 'interview_invite' || s.stage === 'interview_completed')
    ) {
      funnelMap.set('interviewing', (funnelMap.get('interviewing') ?? 0) + 1);
    }
    if (stages.some((s) => s.stage === 'offer' || s.stage === 'accepted')) {
      funnelMap.set('offered', (funnelMap.get('offered') ?? 0) + 1);
    }
    if (last?.stage === 'rejection') {
      funnelMap.set('rejected', (funnelMap.get('rejected') ?? 0) + 1);
    }

    const score = row.scores?.[0]?.overall_score ?? null;
    const fitKey =
      score == null
        ? '<60'
        : score >= 85
          ? '85+'
          : score >= 75
            ? '75-84'
            : score >= 60
              ? '60-74'
              : '<60';
    const fitEntry = fitBuckets.get(fitKey)!;
    fitEntry.apps += 1;
    if (stages.some((s) => POSITIVE_STAGES.has(s.stage))) fitEntry.responses += 1;

    const ats = row.job?.company?.ats_type ?? 'other';
    const sourceEntry = sourceBuckets.get(ats) ?? { apps: 0, responses: 0 };
    sourceEntry.apps += 1;
    if (stages.some((s) => POSITIVE_STAGES.has(s.stage))) sourceEntry.responses += 1;
    sourceBuckets.set(ats, sourceEntry);
  }

  // Cost from llm_calls — but the table only ships in Phase 11. Until
  // then we surface 0; the Recharts dashboard shows the placeholder.
  const cost_total_usd_month = 0;

  return {
    funnel: [...funnelMap.entries()].map(([stage, count]) => ({ stage, count })),
    response_rate_by_fit_bucket: [...fitBuckets.entries()].map(([bucket, agg]) => ({
      bucket,
      applications: agg.apps,
      responses: agg.responses,
      response_rate: agg.apps > 0 ? agg.responses / agg.apps : 0,
    })),
    response_rate_by_source: [...sourceBuckets.entries()].map(([bucket, agg]) => ({
      bucket,
      applications: agg.apps,
      responses: agg.responses,
      response_rate: agg.apps > 0 ? agg.responses / agg.apps : 0,
    })),
    cost_total_usd_month,
    total_submissions: totalSubs,
    total_responses: totalResponses,
  };
}
