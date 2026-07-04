import { describe, expect, it } from 'vitest';
import { computeTier } from './tiering';

describe('computeTier', () => {
  it('rejects when hard filter fails regardless of score', () => {
    expect(computeTier({ hard_filter_pass: false, overall_score: 99 })).toBe('rejected');
  });

  it('maps score ≥85 to pending_review', () => {
    expect(computeTier({ hard_filter_pass: true, overall_score: 90 })).toBe('pending_review');
    expect(computeTier({ hard_filter_pass: true, overall_score: 85 })).toBe('pending_review');
  });

  it('maps 70–84 to needs_decision', () => {
    expect(computeTier({ hard_filter_pass: true, overall_score: 84 })).toBe('needs_decision');
    expect(computeTier({ hard_filter_pass: true, overall_score: 70 })).toBe('needs_decision');
  });

  it('maps <70 to low_fit', () => {
    expect(computeTier({ hard_filter_pass: true, overall_score: 69 })).toBe('low_fit');
    expect(computeTier({ hard_filter_pass: true, overall_score: null })).toBe('low_fit');
  });
});
