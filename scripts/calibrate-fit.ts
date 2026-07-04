// P9.6 — fit-score calibration. Reads job_scores + outcomes, bucketises
// scores into 10-point bands, computes the actual positive-response rate
// per band, and fits a simple linear multiplier so the predicted score
// distribution lines up with the observed response distribution.
//
// The multiplier lands in kv_store keyed by `fit_calibration:{user_id}`
// — the scorer worker reads it before persisting to job_scores.tier.
//
// Usage:
//   pnpm tsx scripts/calibrate-fit.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@career-autopilot/db';
import { isPositiveOutcome } from '@career-autopilot/resume';

interface ScoreOutcomeRow {
  user_id: string;
  overall_score: number | null;
  outcome_stage: string | null;
}

const BAND_SIZE = 10;

async function main(): Promise<void> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment',
    );
  }

  const supabase = createClient<Database>(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from('job_scores')
    .select(
      'user_id, overall_score, job_id, submission:submissions!inner(id, outcomes:outcomes(stage, reached_at))',
    );
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[calibrate-fit] fetch failed:', error.message);
    process.exit(1);
  }

  type Joined = {
    user_id: string;
    overall_score: number | null;
    submission?: { outcomes?: { stage: string; reached_at: string }[] | null } | null;
  };
  const rows: ScoreOutcomeRow[] = ((data ?? []) as unknown as Joined[]).map((r) => {
    const stages = (r.submission?.outcomes ?? []).slice().sort((a, b) =>
      a.reached_at.localeCompare(b.reached_at),
    );
    const last = stages[stages.length - 1];
    return {
      user_id: r.user_id,
      overall_score: r.overall_score,
      outcome_stage: last?.stage ?? null,
    };
  });

  if (rows.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[calibrate-fit] no scored submissions yet — nothing to calibrate');
    return;
  }

  // Per-user calibration so multi-user expansion later still works.
  const byUser = new Map<string, ScoreOutcomeRow[]>();
  for (const row of rows) {
    if (row.overall_score == null || row.outcome_stage == null) continue;
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  for (const [userId, userRows] of byUser) {
    const bands = computeBands(userRows);
    const multiplier = fitMultiplier(bands);

    const value = {
      multiplier,
      bands,
      computed_at: new Date().toISOString(),
      n_samples: userRows.length,
    };

    const { error: upsertError } = await supabase.from('kv_store').upsert(
      {
        key: `fit_calibration:${userId}`,
        value,
      },
      { onConflict: 'key' },
    );
    if (upsertError) {
      // eslint-disable-next-line no-console
      console.error(`[calibrate-fit] kv_store upsert failed for ${userId}: ${upsertError.message}`);
      continue;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[calibrate-fit] ${userId}: n=${userRows.length}, multiplier=${multiplier.toFixed(3)}`,
    );
  }
}

function computeBands(
  rows: ScoreOutcomeRow[],
): { band: number; n: number; positive_rate: number }[] {
  const bandHits = new Map<number, { n: number; positive: number }>();
  for (const r of rows) {
    if (r.overall_score == null) continue;
    const band = Math.floor(r.overall_score / BAND_SIZE) * BAND_SIZE;
    const e = bandHits.get(band) ?? { n: 0, positive: 0 };
    e.n += 1;
    if (r.outcome_stage && isPositiveOutcome(r.outcome_stage)) e.positive += 1;
    bandHits.set(band, e);
  }
  return [...bandHits.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([band, agg]) => ({
      band,
      n: agg.n,
      positive_rate: agg.n > 0 ? agg.positive / agg.n : 0,
    }));
}

// Compare the predicted (band/100) to actual positive_rate. Compute the
// least-squares slope through the origin: multiplier = Σ(band·rate) / Σ(band²).
// A multiplier > 1 means scores under-predict response; < 1 means scores
// over-predict.
function fitMultiplier(
  bands: { band: number; positive_rate: number }[],
): number {
  let num = 0;
  let den = 0;
  for (const b of bands) {
    const predicted = (b.band + BAND_SIZE / 2) / 100;
    num += predicted * b.positive_rate;
    den += predicted * predicted;
  }
  if (den === 0) return 1;
  const m = num / den;
  // Clamp to [0.5, 2.0] so a tiny dataset can't blow up the scorer.
  return Math.max(0.5, Math.min(2, m));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
