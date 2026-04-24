// Small inline-SVG ring showing a 0-100 fit score. Color-coded to the
// tier bands defined in packages/resume/src/fit/tiering.ts.

export function FitScoreRing({
  score,
  size = 40,
}: {
  score: number | null | undefined;
  size?: number;
}) {
  if (score == null) {
    return (
      <div
        className="inline-flex items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground"
        style={{ width: size, height: size }}
        title="Not scored yet"
      >
        —
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, score));
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);

  const color =
    pct >= 85
      ? '#15803d' // green
      : pct >= 70
        ? '#ca8a04' // amber
        : '#b91c1c'; // red

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      title={`Fit score: ${pct}/100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-[11px] font-semibold" style={{ color }}>
        {pct}
      </span>
    </div>
  );
}
