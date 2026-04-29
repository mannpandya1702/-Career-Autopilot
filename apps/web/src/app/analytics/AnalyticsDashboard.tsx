'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsSnapshot } from '@/lib/analytics/queries';

const FUNNEL_COLOURS = ['#1d4ed8', '#0ea5e9', '#10b981', '#f59e0b', '#15803d', '#b91c1c'];

export function AnalyticsDashboard({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const overallRate =
    snapshot.total_submissions > 0
      ? (snapshot.total_responses / snapshot.total_submissions) * 100
      : 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Live funnel and response-rate breakdowns. Costs roll in once the
          llm_calls table starts populating (Phase 11).
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total submissions" value={String(snapshot.total_submissions)} />
        <Stat label="Total responses" value={String(snapshot.total_responses)} />
        <Stat label="Response rate" value={`${overallRate.toFixed(1)}%`} />
        <Stat label="LLM cost (mo)" value={`$${snapshot.cost_total_usd_month.toFixed(2)}`} />
      </section>

      <section className="rounded-md border border-border bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">Funnel</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={snapshot.funnel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="stage" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count">
                {snapshot.funnel.map((_, i) => (
                  <Cell
                    key={i}
                    fill={FUNNEL_COLOURS[i % FUNNEL_COLOURS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RateChart
          title="Response rate by fit-score bucket"
          data={snapshot.response_rate_by_fit_bucket}
        />
        <RateChart
          title="Response rate by source"
          data={snapshot.response_rate_by_source}
        />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-3">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function RateChart({
  title,
  data,
}: {
  title: string;
  data: { bucket: string; applications: number; response_rate: number }[];
}) {
  const sorted = [...data].sort((a, b) => a.bucket.localeCompare(b.bucket));
  const enriched = sorted.map((d) => ({
    ...d,
    response_rate_pct: Number((d.response_rate * 100).toFixed(1)),
  }));
  return (
    <div className="rounded-md border border-border bg-white p-4">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={enriched}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="bucket" />
            <YAxis
              yAxisId="left"
              allowDecimals={false}
              label={{ value: 'apps', angle: -90, position: 'insideLeft' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip />
            <Bar yAxisId="left" dataKey="applications" fill="#94a3b8" />
            <Bar yAxisId="right" dataKey="response_rate_pct" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
