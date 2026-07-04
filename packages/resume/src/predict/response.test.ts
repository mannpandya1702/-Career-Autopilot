import { describe, expect, it } from 'vitest';
import {
  isPositiveOutcome,
  predict,
  rocAuc,
  train,
  vectoriseFeatures,
  type TrainingExample,
} from './response';

function makeExample(fit: number, hasReferral: boolean, label: 'callback' | 'rejection'): TrainingExample {
  return {
    features: vectoriseFeatures({
      fit_score: fit,
      verifier_score: 80,
      posting_age_days: 5,
      company_size_bucket: 1,
      has_referral: hasReferral,
      source_greenhouse: true,
      source_lever: false,
      source_ashby: false,
      source_workable: false,
      source_other: false,
    }),
    outcome: label,
  };
}

describe('isPositiveOutcome', () => {
  it('classifies callback / interview / offer as positive', () => {
    expect(isPositiveOutcome('callback')).toBe(true);
    expect(isPositiveOutcome('offer')).toBe(true);
    expect(isPositiveOutcome('rejection')).toBe(false);
    expect(isPositiveOutcome('ghosted')).toBe(false);
  });
});

describe('train + predict', () => {
  it('learns a separable pattern', () => {
    // Synthetic: high-fit + referral → callback, low-fit no-referral → rejection.
    const examples: TrainingExample[] = [];
    for (let i = 0; i < 50; i++) {
      examples.push(makeExample(85 + (i % 5), true, 'callback'));
      examples.push(makeExample(40 + (i % 10), false, 'rejection'));
    }
    const model = train(examples, { epochs: 400, lr: 0.2 });
    const goodFeatures = examples[0]!.features;
    const badFeatures = examples[1]!.features;
    expect(predict(model, goodFeatures)).toBeGreaterThan(predict(model, badFeatures));
    expect(predict(model, goodFeatures)).toBeGreaterThan(0.6);
    expect(predict(model, badFeatures)).toBeLessThan(0.4);
  });
});

describe('rocAuc', () => {
  it('returns 1.0 for a perfect classifier', () => {
    expect(rocAuc([0, 0, 1, 1], [0.1, 0.2, 0.7, 0.9])).toBe(1);
  });

  it('returns 0.5 for random scores', () => {
    expect(rocAuc([0, 1, 0, 1], [0.5, 0.5, 0.5, 0.5])).toBeCloseTo(0.5, 6);
  });
});
