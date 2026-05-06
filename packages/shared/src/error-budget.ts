// Error-budget tracker per docs/build-phases.md P11.2.
// Each worker calls `record(workerId, success)` after every job. The
// tracker keeps a 1-hour rolling window in-memory and fires `onAlert`
// once when the failure rate crosses 20% AND we have ≥10 samples in
// the window. Once fired, it suppresses further alerts until the
// window recovers below 20% (de-bounce).
//
// The alert handler is injected; production wires it to a Gmail SMTP
// shim (CLAUDE.md §6 GMAIL_USER + GMAIL_APP_PASSWORD).

export interface ErrorBudgetOptions {
  windowMs?: number;
  minSamples?: number;
  failureRateThreshold?: number;
  onAlert?: (event: AlertEvent) => void | Promise<void>;
}

export interface AlertEvent {
  worker: string;
  failure_rate: number;
  failures: number;
  total: number;
  window_started_at: string;
  fired_at: string;
}

interface Sample {
  ts: number;
  ok: boolean;
}

export class ErrorBudget {
  private readonly windowMs: number;
  private readonly minSamples: number;
  private readonly threshold: number;
  private readonly onAlert: ErrorBudgetOptions['onAlert'];
  private readonly samples = new Map<string, Sample[]>();
  private readonly alerted = new Set<string>();

  constructor(opts: ErrorBudgetOptions = {}) {
    this.windowMs = opts.windowMs ?? 60 * 60 * 1000;
    this.minSamples = opts.minSamples ?? 10;
    this.threshold = opts.failureRateThreshold ?? 0.2;
    this.onAlert = opts.onAlert;
  }

  async record(worker: string, success: boolean, now: Date = new Date()): Promise<void> {
    const arr = this.samples.get(worker) ?? [];
    arr.push({ ts: now.getTime(), ok: success });
    const cutoff = now.getTime() - this.windowMs;
    while (arr.length > 0 && (arr[0]?.ts ?? 0) < cutoff) arr.shift();
    this.samples.set(worker, arr);

    const total = arr.length;
    const failures = arr.filter((s) => !s.ok).length;
    const rate = total > 0 ? failures / total : 0;

    if (total >= this.minSamples && rate >= this.threshold) {
      if (!this.alerted.has(worker) && this.onAlert) {
        this.alerted.add(worker);
        await this.onAlert({
          worker,
          failure_rate: Number(rate.toFixed(3)),
          failures,
          total,
          window_started_at: new Date(arr[0]?.ts ?? now.getTime()).toISOString(),
          fired_at: now.toISOString(),
        });
      }
    } else if (rate < this.threshold * 0.5) {
      // Recovery: clear the alert so we re-fire if we cross again.
      this.alerted.delete(worker);
    }
  }

  // Inspect helper for tests + the analytics dashboard.
  snapshot(worker: string, now: Date = new Date()): {
    total: number;
    failures: number;
    failure_rate: number;
  } {
    const cutoff = now.getTime() - this.windowMs;
    const arr = (this.samples.get(worker) ?? []).filter((s) => s.ts >= cutoff);
    const total = arr.length;
    const failures = arr.filter((s) => !s.ok).length;
    return {
      total,
      failures,
      failure_rate: total > 0 ? Number((failures / total).toFixed(3)) : 0,
    };
  }
}

// Default Gmail-SMTP alert sink. The actual SMTP wiring imports a
// pinned package (nodemailer) at deploy time; until then this just
// logs structured. Production passes a real sink via opts.onAlert.
export function consoleAlertSink(event: AlertEvent): void {
  // eslint-disable-next-line no-console
  console.warn('[error-budget] failure threshold crossed', event);
}
