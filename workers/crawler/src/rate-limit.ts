// Per-ATS polite rate limit (default 1 request per 500ms) — docs/integrations.md.
// Token bucket is overkill for our single-worker case; a simple per-key
// "next allowed time" gate is enough and easy to reason about.

export class RateLimiter {
  private readonly nextByKey = new Map<string, number>();

  constructor(private readonly intervalMs = 500) {}

  async wait(key: string): Promise<void> {
    const now = Date.now();
    const nextAllowed = this.nextByKey.get(key) ?? 0;
    const delay = Math.max(0, nextAllowed - now);
    this.nextByKey.set(key, Math.max(now, nextAllowed) + this.intervalMs);
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
