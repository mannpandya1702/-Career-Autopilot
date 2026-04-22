// Embedding interface. Gemini text-embedding-004 returns 768-dim vectors (see
// docs/database-schema.md §2 — profiles.summary_embedding is vector(768)).
// The concrete implementation plugs in once GEMINI_API_KEY is configured.

export interface Embedder {
  embed(text: string): Promise<number[]>;
  readonly dimension: number;
}

// Deterministic stub for tests and local dev: hashes the input into a 768-dim
// float array. NOT a real embedding — tests only.
export const stubEmbedder: Embedder = {
  dimension: 768,
  async embed(text) {
    const vec = new Array<number>(768).fill(0);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      vec[i % 768] = ((vec[i % 768] ?? 0) + code) % 1000;
    }
    const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
    return vec.map((v) => v / norm);
  },
};

// Postgres pgvector literal: '[0.1,0.2,...]'
export function toPgVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
