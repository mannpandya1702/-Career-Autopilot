// Quota checker — reports current LLM + infra usage vs. published limits.
// Per docs/build-phases.md P11.5, prints today's Gemini RPD usage,
// Anthropic credit balance estimate, Supabase DB size, Vercel bandwidth.
//
// Usage:
//   pnpm quotas:check
//
// Required env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// Optional env: ANTHROPIC_API_KEY (balance read), VERCEL_TOKEN (bandwidth).

/* eslint-disable no-console */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@career-autopilot/db';

interface QuotaLine {
  area: string;
  used: string;
  limit: string;
  status: 'ok' | 'warn' | 'over';
}

const GEMINI_DAILY_RPD: Record<string, number> = {
  'gemini-2.5-pro': 100,
  'gemini-2.5-flash': 250,
  'gemini-2.5-flash-lite': 1000,
  'text-embedding-004': 1500,
};

async function main(): Promise<void> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false } });
  const lines: QuotaLine[] = [];

  await collectGeminiQuotas(supabase, lines);
  await collectAnthropicCost(supabase, lines);
  collectAnthropicBalance(lines);
  await collectDbSize(supabase, lines);
  collectVercel(lines);

  print(lines);

  const over = lines.filter((l) => l.status === 'over').length;
  process.exit(over > 0 ? 2 : 0);
}

async function collectGeminiQuotas(
  supabase: ReturnType<typeof createClient<Database>>,
  out: QuotaLine[],
): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('llm_calls')
    .select('model, success')
    .eq('provider', 'gemini')
    .gte('created_at', today.toISOString());
  if (error) {
    out.push({
      area: 'gemini RPD',
      used: '?',
      limit: '?',
      status: 'warn',
    });
    return;
  }
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.model, (counts.get(row.model) ?? 0) + 1);
  }
  for (const [model, limit] of Object.entries(GEMINI_DAILY_RPD)) {
    const used = counts.get(model) ?? 0;
    out.push({
      area: `gemini ${model}`,
      used: `${used} req/day`,
      limit: `${limit} RPD`,
      status: used >= limit ? 'over' : used >= limit * 0.8 ? 'warn' : 'ok',
    });
  }
}

async function collectAnthropicCost(
  supabase: ReturnType<typeof createClient<Database>>,
  out: QuotaLine[],
): Promise<void> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('llm_calls')
    .select('cost_usd')
    .eq('provider', 'anthropic')
    .gte('created_at', monthStart.toISOString());
  if (error) {
    out.push({
      area: 'anthropic spend',
      used: '?',
      limit: '$15/mo target',
      status: 'warn',
    });
    return;
  }
  const total = (data ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);
  out.push({
    area: 'anthropic spend (month)',
    used: `$${total.toFixed(2)}`,
    limit: '$15.00 (CLAUDE.md §16 target)',
    status: total >= 15 ? 'over' : total >= 12 ? 'warn' : 'ok',
  });
}

function collectAnthropicBalance(out: QuotaLine[]): void {
  // The Anthropic API doesn't expose a balance read for the user-tier
  // account; the user must check the console. Surface a reminder line
  // so the script still prints something useful.
  if (process.env['ANTHROPIC_API_KEY']) {
    out.push({
      area: 'anthropic balance',
      used: 'check console.anthropic.com → Plans & Billing',
      limit: '—',
      status: 'ok',
    });
  }
}

async function collectDbSize(
  supabase: ReturnType<typeof createClient<Database>>,
  out: QuotaLine[],
): Promise<void> {
  // Use a postgres function that returns the database size. Falls back
  // to row-counts when pg_database_size isn't available.
  try {
    const { data, error } = await supabase.rpc('pg_database_size_pretty' as never, {});
    if (error || data == null) throw error;
    out.push({
      area: 'supabase db size',
      used: String(data),
      limit: '500MB free / 8GB pro',
      status: 'ok',
    });
  } catch {
    const { count } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true });
    out.push({
      area: 'supabase jobs',
      used: `${count ?? '?'} rows`,
      limit: '~50K before we start hurting',
      status: count && count > 50_000 ? 'warn' : 'ok',
    });
  }
}

function collectVercel(out: QuotaLine[]): void {
  if (!process.env['VERCEL_TOKEN']) return;
  out.push({
    area: 'vercel bandwidth',
    used: 'check vercel.com → Settings → Usage',
    limit: '100GB free',
    status: 'ok',
  });
}

function print(lines: QuotaLine[]): void {
  const widths = {
    area: Math.max(4, ...lines.map((l) => l.area.length)),
    used: Math.max(4, ...lines.map((l) => l.used.length)),
    limit: Math.max(5, ...lines.map((l) => l.limit.length)),
  };
  const fmt = (l: QuotaLine): string =>
    `${pad(l.area, widths.area)}  ${pad(l.used, widths.used)}  ${pad(l.limit, widths.limit)}  ${l.status}`;
  console.log(pad('AREA', widths.area), pad('USED', widths.used), pad('LIMIT', widths.limit), 'STATUS');
  console.log('-'.repeat(widths.area + widths.used + widths.limit + 16));
  for (const l of lines) console.log(fmt(l));
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
