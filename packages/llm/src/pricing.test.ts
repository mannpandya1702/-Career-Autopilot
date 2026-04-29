import { describe, expect, it } from 'vitest';
import { computeCost } from './pricing';

describe('computeCost', () => {
  it('returns 0 for free Gemini models', () => {
    expect(computeCost('gemini-2.5-flash', 1_000_000, 500_000)).toBe(0);
    expect(computeCost('gemini-2.5-flash-lite', 10_000, 10_000)).toBe(0);
  });

  it('computes Haiku cost with cache discount', () => {
    // 1M uncached in × $1 + 0 cached + 1M out × $5 = $6.
    expect(computeCost('claude-haiku-4-5-20251001', 1_000_000, 1_000_000)).toBeCloseTo(6, 3);
    // 500k cached → $0.05 + 500k uncached → $0.5 + 0 out = $0.55
    expect(computeCost('claude-haiku-4-5-20251001', 1_000_000, 0, 500_000)).toBeCloseTo(
      0.55,
      3,
    );
  });

  it('returns 0 for an unknown model', () => {
    expect(computeCost('unknown-model', 1000, 1000)).toBe(0);
  });
});
