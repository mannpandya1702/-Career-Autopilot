// Embedding tasks route to Gemini's text-embedding-004. Profile-summary
// embedding is privacy-safe because it's the DERIVED summary (not raw
// fields) — see CLAUDE.md §2.5.

import type { LlmRouter } from '../router';

const MODEL = 'text-embedding-004';

export async function embedJd(router: LlmRouter, text: string): Promise<number[]> {
  return router.embed('gemini', text, MODEL);
}

export async function embedProfileSummary(
  router: LlmRouter,
  derivedSummary: string,
): Promise<number[]> {
  return router.embed('gemini', derivedSummary, MODEL);
}

// Postgres pgvector literal: '[0.1,0.2,...]'.
export function toPgVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

// Cosine similarity (0–1) for two vectors of equal length.
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) return 0;
  return dot / denom;
}
