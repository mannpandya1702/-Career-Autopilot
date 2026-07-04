import { cn } from '@/lib/utils';

type Tier = 'strong' | 'ok' | 'weak' | 'none';

function tierOf(score: number | null | undefined): Tier {
  if (score == null) return 'none';
  if (score >= 85) return 'strong';
  if (score >= 70) return 'ok';
  return 'weak';
}

const TIER_CLASSES: Record<Exclude<Tier, 'none'>, { ring: string; text: string; bg: string }> = {
  strong: { ring: 'text-success', text: 'text-success', bg: 'bg-success/10' },
  ok: { ring: 'text-warning', text: 'text-warning', bg: 'bg-warning/10' },
  weak: { ring: 'text-destructive', text: 'text-destructive', bg: 'bg-destructive/10' },
};

export function FitScoreRing({
  score,
  size = 40,
  className,
}: {
  score: number | null | undefined;
  size?: number;
  className?: string;
}) {
  const tier = tierOf(score);

  if (tier === 'none') {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-full border border-dashed border-border font-mono text-2xs text-muted-foreground',
          className,
        )}
        style={{ width: size, height: size }}
        title="Not scored yet"
      >
        —
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, score as number));
  const stroke = Math.max(3, Math.round(size / 12));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const styles = TIER_CLASSES[tier];

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full',
        styles.bg,
        className,
      )}
      style={{ width: size, height: size }}
      title={`Fit score: ${pct}/100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="stroke-border/60"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={cn('transition-[stroke-dashoffset] duration-500 ease-out-expo', styles.ring)}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className={cn('absolute font-mono font-semibold tabular-nums', styles.text)}
        style={{ fontSize: Math.max(10, Math.round(size / 3.5)) }}
      >
        {pct}
      </span>
    </div>
  );
}
