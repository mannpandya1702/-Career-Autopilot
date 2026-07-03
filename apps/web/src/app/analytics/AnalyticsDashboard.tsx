'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsSnapshot } from '@/lib/analytics/queries';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Token-driven series palette — teal → orange → warning/destructive
const FUNNEL_COLOURS = [
  'hsl(var(--primary))',
  'hsl(var(--info))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--accent))',
  'hsl(var(--destructive))',
];

const CHART_AXIS = { stroke: 'hsl(var(--muted-foreground))', fontSize: 11 };
const CHART_GRID = 'hsl(var(--border) / 0.6)';

export function AnalyticsDashboard({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const overallRate =
    snapshot.total_submissions > 0
      ? (snapshot.total_responses / snapshot.total_submissions) * 100
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total submissions"
          value={String(snapshot.total_submissions)}
          hint="All-time"
        />
        <Stat
          label="Total responses"
          value={String(snapshot.total_responses)}
          hint="Any inbound signal"
        />
        <Stat
          label="Response rate"
          value={`${overallRate.toFixed(1)}%`}
          hint="Rolling ratio"
          accent="primary"
        />
        <Stat
          label="LLM cost (mo)"
          value={`$${snapshot.cost_total_usd_month.toFixed(2)}`}
          hint="Current calendar month"
          accent="accent"
        />
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Funnel</CardTitle>
              <CardDescription>Applications by stage. Widest at the top.</CardDescription>
            </div>
            <Badge variant="info">{snapshot.funnel.length} stages</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snapshot.funnel} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="stage" {...CHART_AXIS} tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  {...CHART_AXIS}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip content={<TokenTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {snapshot.funnel.map((_, i) => (
                    <Cell key={i} fill={FUNNEL_COLOURS[i % FUNNEL_COLOURS.length] ?? 'hsl(var(--primary))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <RateChart
          title="Response rate by fit-score bucket"
          description="Does a higher fit score correlate with callbacks?"
          data={snapshot.response_rate_by_fit_bucket}
        />
        <RateChart
          title="Response rate by source"
          description="Which ATS surfaces reply the most?"
          data={snapshot.response_rate_by_source}
        />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'primary' | 'accent';
}) {
  const border =
    accent === 'primary'
      ? 'border-primary/25 bg-primary/5'
      : accent === 'accent'
        ? 'border-accent/25 bg-accent/5'
        : 'border-border bg-surface';
  const valueColor =
    accent === 'primary' ? 'text-primary' : accent === 'accent' ? 'text-accent' : 'text-foreground';
  return (
    <div className={`rounded-lg border p-4 shadow-elevation-1 ${border}`}>
      <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1.5 font-mono text-3xl font-semibold tabular-nums ${valueColor}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function RateChart({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: { bucket: string; applications: number; response_rate: number }[];
}) {
  const sorted = [...data].sort((a, b) => a.bucket.localeCompare(b.bucket));
  const enriched = sorted.map((d) => ({
    ...d,
    response_rate_pct: Number((d.response_rate * 100).toFixed(1)),
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={enriched} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="bucket" {...CHART_AXIS} tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="left"
                allowDecimals={false}
                {...CHART_AXIS}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(v: number) => `${v}%`}
                {...CHART_AXIS}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip content={<TokenTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
              />
              <Bar
                yAxisId="left"
                dataKey="applications"
                name="Applications"
                fill="hsl(var(--muted-foreground) / 0.5)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="response_rate_pct"
                name="Response %"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

type TooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
};

function TokenTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 shadow-elevation-3">
      <p className="mb-1 font-mono text-2xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {payload.map((entry, i) => (
        <div
          key={i}
          className="flex items-center gap-2 text-xs text-foreground/85 tabular-nums"
        >
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: entry.color ?? 'hsl(var(--primary))' }}
          />
          <span>{entry.name ?? 'value'}</span>
          <span className="ml-auto font-mono font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}
