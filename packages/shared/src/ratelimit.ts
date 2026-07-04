// Per-key token bucket backed by kv_store (CLAUDE.md §3 + docs/build-phases.md
// P11.1). Used by:
//   - the LLM router (one bucket per provider)
//   - the crawler worker (one bucket per ATS)
//   - the submitter worker (one bucket per ATS)
//
// State lives in Postgres so multiple worker instances share it. The
// `consume(key, n)` call atomically refills the bucket from the configured
// rate, decrements by `n`, and returns either { allowed: true } or
// { allowed: false, retryAfterMs }.

export interface BucketConfig {
  capacity: number;       // max tokens
  refillPerMinute: number; // tokens added per minute
}

export interface BucketState {
  tokens: number;
  last_refill_at: string; // ISO
}

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

// Pluggable storage so tests can drive an in-memory map and production
// passes a Supabase-backed adapter.
export interface BucketStore {
  get(key: string): Promise<BucketState | null>;
  set(key: string, state: BucketState): Promise<void>;
}

// In-memory store — single-process only. Used for tests + dev.
export class MemoryBucketStore implements BucketStore {
  private readonly map = new Map<string, BucketState>();
  async get(key: string): Promise<BucketState | null> {
    return this.map.get(key) ?? null;
  }
  async set(key: string, state: BucketState): Promise<void> {
    this.map.set(key, state);
  }
}

// Default rate-limit policies per CLAUDE.md §3 / docs/llm-routing.md §Rate
// limiting + docs/integrations.md "1 req / 500ms per ATS".
export const DEFAULT_BUCKETS: Record<string, BucketConfig> = {
  // Per-ATS — 1 req / 500ms = 120/min, with a small burst.
  'ats:greenhouse': { capacity: 30, refillPerMinute: 120 },
  'ats:lever': { capacity: 30, refillPerMinute: 120 },
  'ats:ashby': { capacity: 30, refillPerMinute: 120 },
  'ats:workable': { capacity: 30, refillPerMinute: 120 },
  // LLM providers — Gemini free-tier RPM, Anthropic conservative default.
  'llm:gemini-2.5-pro': { capacity: 5, refillPerMinute: 5 },
  'llm:gemini-2.5-flash': { capacity: 10, refillPerMinute: 10 },
  'llm:gemini-2.5-flash-lite': { capacity: 15, refillPerMinute: 15 },
  'llm:text-embedding-004': { capacity: 30, refillPerMinute: 60 },
  'llm:claude-haiku-4-5-20251001': { capacity: 5, refillPerMinute: 5 },
  'llm:claude-sonnet-4-6': { capacity: 5, refillPerMinute: 5 },
};

export class TokenBucket {
  constructor(
    private readonly store: BucketStore,
    private readonly buckets: Record<string, BucketConfig> = DEFAULT_BUCKETS,
  ) {}

  async consume(key: string, n = 1, now: Date = new Date()): Promise<ConsumeResult> {
    const config = this.buckets[key];
    if (!config) {
      // No bucket configured = unlimited; common for keys we haven't tuned.
      return { allowed: true, remaining: Number.POSITIVE_INFINITY, retryAfterMs: 0 };
    }
    const state = (await this.store.get(key)) ?? {
      tokens: config.capacity,
      last_refill_at: now.toISOString(),
    };
    const refilled = refill(state, config, now);
    if (refilled.tokens < n) {
      const deficit = n - refilled.tokens;
      const retryAfterMs = Math.ceil((deficit / config.refillPerMinute) * 60_000);
      // Persist the refilled state so the next call sees the same baseline.
      await this.store.set(key, refilled);
      return { allowed: false, remaining: refilled.tokens, retryAfterMs };
    }
    const next: BucketState = {
      tokens: refilled.tokens - n,
      last_refill_at: refilled.last_refill_at,
    };
    await this.store.set(key, next);
    return { allowed: true, remaining: next.tokens, retryAfterMs: 0 };
  }
}

function refill(state: BucketState, config: BucketConfig, now: Date): BucketState {
  const last = new Date(state.last_refill_at).getTime();
  const elapsedMs = Math.max(0, now.getTime() - last);
  const elapsedMin = elapsedMs / 60_000;
  const added = elapsedMin * config.refillPerMinute;
  const tokens = Math.min(config.capacity, state.tokens + added);
  return { tokens, last_refill_at: now.toISOString() };
}
