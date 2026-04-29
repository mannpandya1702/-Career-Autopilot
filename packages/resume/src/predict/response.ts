// Response predictor — pure-JS logistic regression. Trained nightly on
// historical outcomes; predicts P(positive_response) given a feature
// vector for an unsubmitted job.
//
// Per docs/build-phases.md P9.5: features are fit_score, verifier_score,
// source (one-hot), company-size bucket, posting-age bucket, has_referral.
// Inputs are normalised + concatenated into a feature vector before
// training. The trained model is a simple {weights, bias, version}
// triple — small enough to ship as JSON to the web app.

export type PositiveOutcome =
  | 'callback'
  | 'interview_invite'
  | 'interview_completed'
  | 'offer'
  | 'accepted';

const POSITIVE_SET = new Set<PositiveOutcome>([
  'callback',
  'interview_invite',
  'interview_completed',
  'offer',
  'accepted',
]);

export interface TrainingExample {
  features: number[];
  // Outcome → 1 if positive, 0 otherwise.
  outcome: string;
}

export interface PredictorModel {
  weights: number[];
  bias: number;
  // Concept drift detection: inputs whose feature variance has shifted
  // > 2σ from the training distribution should be flagged downstream.
  feature_means: number[];
  feature_stds: number[];
  trained_at: string;
  n_examples: number;
}

export interface PredictorRawFeatures {
  fit_score: number; // 0-100
  verifier_score: number | null; // 0-100
  posting_age_days: number;
  company_size_bucket: 0 | 1 | 2 | 3; // <50, 50-500, 500-5000, 5000+
  has_referral: boolean;
  // One-hot. Only one of these is true for a given example.
  source_greenhouse: boolean;
  source_lever: boolean;
  source_ashby: boolean;
  source_workable: boolean;
  source_other: boolean;
}

export function vectoriseFeatures(f: PredictorRawFeatures): number[] {
  return [
    f.fit_score / 100,
    (f.verifier_score ?? 0) / 100,
    Math.min(60, f.posting_age_days) / 60,
    f.company_size_bucket / 3,
    f.has_referral ? 1 : 0,
    f.source_greenhouse ? 1 : 0,
    f.source_lever ? 1 : 0,
    f.source_ashby ? 1 : 0,
    f.source_workable ? 1 : 0,
    f.source_other ? 1 : 0,
  ];
}

function sigmoid(z: number): number {
  if (z >= 0) {
    return 1 / (1 + Math.exp(-z));
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

export function isPositiveOutcome(stage: string): boolean {
  return POSITIVE_SET.has(stage as PositiveOutcome);
}

// Train a logistic regression model with batch gradient descent. Tiny
// dataset → no need for SGD or fancy optimizers; this converges in
// milliseconds for ≤ 1000 examples.
export function train(
  examples: TrainingExample[],
  options: { epochs?: number; lr?: number; l2?: number } = {},
): PredictorModel {
  const epochs = options.epochs ?? 200;
  const lr = options.lr ?? 0.1;
  const l2 = options.l2 ?? 0.001;
  if (examples.length === 0) {
    throw new Error('train: empty example set');
  }
  const dim = examples[0]!.features.length;
  if (examples.some((e) => e.features.length !== dim)) {
    throw new Error('train: feature dimension mismatch');
  }

  // Standardise features so gradient descent converges uniformly.
  const means = new Array<number>(dim).fill(0);
  const stds = new Array<number>(dim).fill(0);
  for (const e of examples) {
    for (let i = 0; i < dim; i++) means[i]! += e.features[i] ?? 0;
  }
  for (let i = 0; i < dim; i++) means[i]! /= examples.length;
  for (const e of examples) {
    for (let i = 0; i < dim; i++) {
      const d = (e.features[i] ?? 0) - means[i]!;
      stds[i]! += d * d;
    }
  }
  for (let i = 0; i < dim; i++) {
    stds[i] = Math.sqrt(stds[i]! / examples.length) || 1;
  }
  const standardise = (xs: number[]): number[] =>
    xs.map((x, i) => (x - (means[i] ?? 0)) / (stds[i] ?? 1));

  const weights = new Array<number>(dim).fill(0);
  let bias = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array<number>(dim).fill(0);
    let gradB = 0;
    for (const e of examples) {
      const x = standardise(e.features);
      const z = bias + dot(weights, x);
      const p = sigmoid(z);
      const y = isPositiveOutcome(e.outcome) ? 1 : 0;
      const err = p - y;
      for (let i = 0; i < dim; i++) gradW[i]! += err * (x[i] ?? 0);
      gradB += err;
    }
    for (let i = 0; i < dim; i++) {
      const reg = l2 * (weights[i] ?? 0);
      weights[i] = (weights[i] ?? 0) - lr * (gradW[i]! / examples.length + reg);
    }
    bias -= lr * (gradB / examples.length);
  }

  return {
    weights,
    bias,
    feature_means: means,
    feature_stds: stds,
    trained_at: new Date().toISOString(),
    n_examples: examples.length,
  };
}

export function predict(model: PredictorModel, features: number[]): number {
  const x = features.map(
    (v, i) => (v - (model.feature_means[i] ?? 0)) / (model.feature_stds[i] ?? 1),
  );
  return sigmoid(model.bias + dot(model.weights, x));
}

// Compute ROC AUC using the trapezoidal rule on (FPR, TPR) pairs sorted
// by descending score. Tied scores are grouped so the curve walks
// diagonally through them — without this, ROC AUC of all-equal scores
// is biased by sort order rather than returning the correct 0.5.
export function rocAuc(
  yTrue: number[],
  yScore: number[],
): number {
  if (yTrue.length !== yScore.length) {
    throw new Error('roc: length mismatch');
  }
  const pairs = yTrue
    .map((y, i) => ({ y, score: yScore[i] ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const positives = yTrue.filter((y) => y === 1).length;
  const negatives = yTrue.length - positives;
  if (positives === 0 || negatives === 0) return 0.5;

  let tp = 0;
  let fp = 0;
  let prevTpr = 0;
  let prevFpr = 0;
  let auc = 0;
  let i = 0;
  while (i < pairs.length) {
    // Walk through every pair sharing this score, then step the curve once.
    const groupScore = pairs[i]!.score;
    let groupTp = 0;
    let groupFp = 0;
    while (i < pairs.length && pairs[i]!.score === groupScore) {
      if (pairs[i]!.y === 1) groupTp += 1;
      else groupFp += 1;
      i += 1;
    }
    tp += groupTp;
    fp += groupFp;
    const tpr = tp / positives;
    const fpr = fp / negatives;
    auc += ((fpr - prevFpr) * (tpr + prevTpr)) / 2;
    prevTpr = tpr;
    prevFpr = fpr;
  }
  return auc;
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}
