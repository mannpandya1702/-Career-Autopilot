import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limit';

describe('RateLimiter', () => {
  it('spaces calls for the same key by at least intervalMs', async () => {
    const rl = new RateLimiter(50);
    const start = Date.now();
    await rl.wait('greenhouse');
    await rl.wait('greenhouse');
    await rl.wait('greenhouse');
    const elapsed = Date.now() - start;
    // Two gaps of ~50ms between 3 calls.
    expect(elapsed).toBeGreaterThanOrEqual(90);
  });

  it('does not gate different keys against each other', async () => {
    const rl = new RateLimiter(50);
    const start = Date.now();
    await rl.wait('greenhouse');
    await rl.wait('lever');
    await rl.wait('ashby');
    const elapsed = Date.now() - start;
    // First calls per key should be immediate.
    expect(elapsed).toBeLessThan(30);
  });
});
