import { describe, expect, it } from 'vitest';
import { MemoryBucketStore, TokenBucket } from './ratelimit';

describe('TokenBucket', () => {
  it('allows up to capacity instantly, then refuses with retry hint', async () => {
    const store = new MemoryBucketStore();
    const rl = new TokenBucket(store, {
      'llm:test': { capacity: 3, refillPerMinute: 60 },
    });
    const now = new Date('2026-04-21T00:00:00Z');
    expect((await rl.consume('llm:test', 1, now)).allowed).toBe(true);
    expect((await rl.consume('llm:test', 1, now)).allowed).toBe(true);
    expect((await rl.consume('llm:test', 1, now)).allowed).toBe(true);
    const denied = await rl.consume('llm:test', 1, now);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it('refills tokens over time', async () => {
    const store = new MemoryBucketStore();
    const rl = new TokenBucket(store, {
      'llm:test': { capacity: 5, refillPerMinute: 60 },
    });
    const t0 = new Date('2026-04-21T00:00:00Z');
    for (let i = 0; i < 5; i++) await rl.consume('llm:test', 1, t0);
    expect((await rl.consume('llm:test', 1, t0)).allowed).toBe(false);
    // 60/min = 1/sec → 1.5s should make ≥1 token available.
    const t1 = new Date(t0.getTime() + 1500);
    expect((await rl.consume('llm:test', 1, t1)).allowed).toBe(true);
  });

  it('returns unlimited for keys without a configured bucket', async () => {
    const rl = new TokenBucket(new MemoryBucketStore(), {});
    const r = await rl.consume('anything');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(Number.POSITIVE_INFINITY);
  });

  it('caps refilled tokens at capacity', async () => {
    const store = new MemoryBucketStore();
    const rl = new TokenBucket(store, {
      'llm:test': { capacity: 5, refillPerMinute: 60 },
    });
    const t0 = new Date('2026-04-21T00:00:00Z');
    await rl.consume('llm:test', 1, t0);
    // Wait an hour — bucket should be back at capacity, not 60+.
    const t1 = new Date(t0.getTime() + 3_600_000);
    const r = await rl.consume('llm:test', 1, t1);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });
});
