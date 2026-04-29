// Deterministic stubs used by tests and by local dev when API keys are absent.
// Production swaps these for real Anthropic / Gemini adapters.

import type {
  EmbeddingRequest,
  EmbeddingResult,
  GenerationRequest,
  GenerationResult,
  Provider,
  ProviderName,
} from '../types';

export interface StubResponses {
  // Per-task JSON generation output.
  generate?: Partial<Record<string, unknown>>;
  // Per-model embedding.
  embed?: number[];
}

export function makeStubProvider(
  name: ProviderName,
  responses: StubResponses = {},
): Provider {
  return {
    name,
    async generate(req: GenerationRequest): Promise<GenerationResult> {
      const payload = responses.generate?.[req.task];
      const text = payload === undefined ? '{}' : JSON.stringify(payload);
      return {
        text,
        tokensIn: estimateTokens(req.system) + req.messages.reduce((n, m) => n + estimateTokens(m.text), 0),
        tokensOut: estimateTokens(text),
        cachedTokens: 0,
        latencyMs: 1,
        rawModel: req.model,
      };
    },
    async embed(req: EmbeddingRequest): Promise<EmbeddingResult> {
      const vec = responses.embed ?? deterministicEmbedding(req.text);
      return {
        vector: vec,
        tokensIn: estimateTokens(req.text),
        latencyMs: 1,
        dimension: vec.length,
      };
    },
  };
}

// Very rough token estimate — 1 token ~= 4 characters. Adequate for stubbed
// cost accounting in tests; real providers return accurate counts.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// A deterministic 768-dim vector derived from the input. Same bucket-hash
// approach as the profile-embedder stub so tests can reason about output.
function deterministicEmbedding(text: string): number[] {
  const vec = new Array<number>(768).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const bucket = i % 768;
    vec[bucket] = ((vec[bucket] ?? 0) + code) % 1000;
  }
  const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
  return vec.map((v) => v / norm);
}
