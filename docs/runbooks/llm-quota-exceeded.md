# Runbook — LLM quota exceeded

## When this fires

- Workers log `RateLimitError` / `QuotaExceededError` from Gemini or Anthropic.
- `pnpm quotas:check` reports near-100% usage.
- Scoring pipeline stalls; jobs pile up in `score_jobs` queue.

## Triage

### 1. Identify which provider is throttled

```bash
pnpm quotas:check
```

Output tells you:
- Gemini Pro / Flash / Flash-Lite current RPD vs. limit
- Anthropic current month's spend vs. monthly budget ($15 default)

### 2. If Gemini is throttled

**Cause:** Either you crossed 100 RPD on Pro, 250 RPD on Flash, or 1000 RPD on Flash-Lite. Daily limits reset at midnight Pacific.

**Fix (short term):**
- The router should automatically fall back: Pro → Flash → Flash-Lite.
- If all three are exhausted, the `score_jobs` queue will wait until reset. This is fine; jobs are preserved.
- Check `kv_store` for `gemini_quota_state` — the router caches rate-limit state there.

**Fix (medium term):**
- If you're consistently hitting quotas, you're doing more than this free tier supports. Options:
  1. Enable Gemini paid Tier 1 (still pay-as-you-go, no minimum): ~$3-8/mo at 30 apps/day. Set `LLM_PRIVACY_MODE=gemini_paid` in env if you want to switch the privacy path too.
  2. Reduce `DAILY_APPLICATION_CAP` so the pipeline pulls fewer jobs.

**Do NOT** create multiple GCP projects to "multiply" quota. All projects share the billing-account quota and this triggers anti-abuse detection.

### 3. If Anthropic is throttled

**Cause:** You've hit the per-minute rate limit for your account tier, OR your monthly budget is exhausted.

**Fix (rate limit):**
- Router should back off and retry. If it keeps firing after 3 retries, check your Anthropic console for the actual limit on your account.
- If legitimate, lower your `tailor` worker concurrency (default is 1; already minimum).

**Fix (budget):**
- Raise your monthly spend cap at the Anthropic console.
- Or temporarily set `LLM_PRIVACY_MODE=gemini_paid` (same privacy guarantee, lower cost).
- Or pause the `tailor_jobs` queue: `SELECT pgmq.set_queue_visibility_timeout('tailor_jobs', 3600);` and let yourself catch up.

## Root-cause review

After the incident, check:
- Are we calling `tailor.resume` more than needed? Check for retry loops in `verify_jobs` or `tailor_jobs` that might be regenerating excessively.
- Are we missing caching? Look at the `cached_tokens` column in `llm_calls` — if it's 0 across the board, the cache breakpoints are broken.
- Has the user's profile changed recently? Profile changes invalidate the long-TTL cache; expect a temporary cost spike.

## Alerting

The router emits a metric when any provider's remaining quota drops below 20%. Better Stack or Sentry should alert you. If not, add the alert now.