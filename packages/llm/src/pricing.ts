// Per-million-token prices. Update this file when vendors change pricing.
// Source: docs/llm-routing.md §Providers and models.
// USD per 1M tokens.

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion?: number;
}

const PRICING: Record<string, ModelPricing> = {
  // Anthropic — list prices; cached input at 10% of base per Anthropic docs.
  'claude-haiku-4-5-20251001': {
    inputPerMillion: 1.0,
    outputPerMillion: 5.0,
    cachedInputPerMillion: 0.1,
  },
  'claude-sonnet-4-6': {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cachedInputPerMillion: 0.3,
  },

  // Google — these route to the free tier by default; paid pricing shown for
  // when gemini_paid mode is enabled.
  'gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 10.0 },
  'gemini-2.5-flash': { inputPerMillion: 0.0, outputPerMillion: 0.0 },
  'gemini-2.5-flash-lite': { inputPerMillion: 0.0, outputPerMillion: 0.0 },
  'text-embedding-004': { inputPerMillion: 0.0, outputPerMillion: 0.0 },
};

export function computeCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
  cachedTokens = 0,
): number {
  const p = PRICING[model];
  if (!p) return 0;
  const uncachedIn = Math.max(0, tokensIn - cachedTokens);
  const inputCost =
    (uncachedIn / 1_000_000) * p.inputPerMillion +
    (cachedTokens / 1_000_000) * (p.cachedInputPerMillion ?? p.inputPerMillion);
  const outputCost = (tokensOut / 1_000_000) * p.outputPerMillion;
  return Number((inputCost + outputCost).toFixed(6));
}
