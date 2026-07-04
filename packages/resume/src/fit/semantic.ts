// Semantic similarity between a profile summary embedding and a JD
// embedding. Both vectors must be 768-dim (Gemini text-embedding-004).
//
// Returns a normalised 0-1 score: cosine is in [-1, 1] so we clamp + scale.

export function semanticScore(
  profileVec: number[],
  jdVec: number[],
): number {
  if (profileVec.length !== jdVec.length) {
    throw new Error(
      `vector length mismatch: profile=${profileVec.length} vs jd=${jdVec.length}`,
    );
  }
  let dot = 0;
  let pNorm = 0;
  let jNorm = 0;
  for (let i = 0; i < profileVec.length; i++) {
    const p = profileVec[i] ?? 0;
    const j = jdVec[i] ?? 0;
    dot += p * j;
    pNorm += p * p;
    jNorm += j * j;
  }
  const denom = Math.sqrt(pNorm) * Math.sqrt(jNorm);
  if (denom === 0) return 0;
  const cos = dot / denom;
  // Clamp to [-1, 1] to handle floating point drift, then map to [0, 1].
  const clamped = Math.max(-1, Math.min(1, cos));
  return (clamped + 1) / 2;
}

// Threshold below which we skip the LLM judge (per P4.7: only call the judge
// when semantic > 0.55). Exposed as a named constant so one edit updates
// every caller.
export const SEMANTIC_JUDGE_THRESHOLD = 0.55;
