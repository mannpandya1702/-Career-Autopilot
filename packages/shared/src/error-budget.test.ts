import { describe, expect, it } from 'vitest';
import { ErrorBudget, type AlertEvent } from './error-budget';

describe('ErrorBudget', () => {
  it('does not fire below the minimum sample count', async () => {
    const events: AlertEvent[] = [];
    const eb = new ErrorBudget({
      minSamples: 10,
      failureRateThreshold: 0.2,
      onAlert: (e) => {
        events.push(e);
      },
    });
    for (let i = 0; i < 5; i++) await eb.record('w1', false);
    expect(events).toHaveLength(0);
  });

  it('fires once when failure rate crosses the threshold', async () => {
    const events: AlertEvent[] = [];
    const eb = new ErrorBudget({
      minSamples: 5,
      failureRateThreshold: 0.2,
      onAlert: (e) => {
        events.push(e);
      },
    });
    // 8 successes + 2 failures = 20% failure rate.
    for (let i = 0; i < 8; i++) await eb.record('w1', true);
    for (let i = 0; i < 2; i++) await eb.record('w1', false);
    expect(events).toHaveLength(1);
    expect(events[0]?.worker).toBe('w1');
    expect(events[0]?.failure_rate).toBeGreaterThanOrEqual(0.2);
  });

  it('does not double-fire while still elevated', async () => {
    const events: AlertEvent[] = [];
    const eb = new ErrorBudget({
      minSamples: 5,
      failureRateThreshold: 0.2,
      onAlert: (e) => {
        events.push(e);
      },
    });
    for (let i = 0; i < 8; i++) await eb.record('w1', true);
    for (let i = 0; i < 5; i++) await eb.record('w1', false);
    expect(events).toHaveLength(1);
  });

  it('re-fires after recovery', async () => {
    const events: AlertEvent[] = [];
    const eb = new ErrorBudget({
      minSamples: 5,
      failureRateThreshold: 0.2,
      onAlert: (e) => {
        events.push(e);
      },
    });
    // Spike, cool off, spike again.
    for (let i = 0; i < 8; i++) await eb.record('w1', true);
    for (let i = 0; i < 3; i++) await eb.record('w1', false); // 3/11 ≈ 27%
    expect(events).toHaveLength(1);
    // Flood with successes to drop the rate well below half-threshold.
    for (let i = 0; i < 200; i++) await eb.record('w1', true);
    for (let i = 0; i < 60; i++) await eb.record('w1', false); // ≈ 60/263 = 22%
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it('snapshot returns rolling-window stats', async () => {
    const eb = new ErrorBudget({ minSamples: 1 });
    for (let i = 0; i < 4; i++) await eb.record('w1', true);
    await eb.record('w1', false);
    const snap = eb.snapshot('w1');
    expect(snap.total).toBe(5);
    expect(snap.failures).toBe(1);
    expect(snap.failure_rate).toBeCloseTo(0.2, 2);
  });
});
