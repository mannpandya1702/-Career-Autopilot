import { describe, expect, it } from 'vitest';
import { SEMANTIC_JUDGE_THRESHOLD, semanticScore } from './semantic';

describe('semanticScore', () => {
  it('returns 1 for identical vectors', () => {
    expect(semanticScore([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
  });

  it('returns 0 for opposite vectors', () => {
    expect(semanticScore([1, 0], [-1, 0])).toBeCloseTo(0, 6);
  });

  it('returns 0.5 for orthogonal vectors', () => {
    expect(semanticScore([1, 0], [0, 1])).toBeCloseTo(0.5, 6);
  });

  it('throws on length mismatch', () => {
    expect(() => semanticScore([1, 2], [1, 2, 3])).toThrow(/length mismatch/);
  });

  it('exposes the judge threshold', () => {
    expect(SEMANTIC_JUDGE_THRESHOLD).toBe(0.55);
  });
});
