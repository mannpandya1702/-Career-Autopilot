# Runbook — ATS selector or response shape broken

## When this fires

- An ATS adapter's integration tests fail in CI.
- The crawler logs Zod validation errors for a specific ATS response.
- The submitter fails on a specific portal with "selector not found" or "timeout waiting for element."
- `verify-ats` script reports schema drift.

## For a discovery-side break (crawler returns Zod errors)

**1. Reproduce locally:**
```bash
pnpm tsx scripts/verify-ats.ts --ats=<greenhouse|lever|ashby|workable|smartrecruiters> \
  --sample-company=<the company that failed>
```

**2. Fetch a raw response:**
```bash
curl -s "https://<verified endpoint from docs/integrations.md>" > /tmp/raw.json
jq . /tmp/raw.json | less
```

**3. Compare to the documented shape in `docs/integrations.md`:**
- New fields? Extend the Zod schema with the new fields. `.passthrough()` is already enabled so unknown fields don't break — but you want to capture anything useful.
- Missing fields we assumed were always present? Make them `.optional()` or `.nullable()`, and update the normalizer to handle absence.
- Type changed (e.g., string → number)? Investigate: vendor change vs. edge case. Update schema + normalizer together.

**4. Update both files in the same commit:**
- The Zod schema in `packages/ats/src/schemas/<ats>.ts`.
- The documented example in `docs/integrations.md`.
- Regenerate tests fixtures if needed.

**5. Backfill:** If the change affects how jobs are normalized, you may want to re-crawl affected companies. Enqueue `crawl_jobs` messages for them manually.

## For a submission-side Playwright break

**1. Reproduce:**
```bash
pnpm dev:worker -- --worker submitter --job-id <failed_submission_id>
```

This runs the submitter in interactive mode; Playwright launches non-headless and you can see what happened.

**2. Inspect the screenshots:** The failed `submission_attempts` row has a `screenshots` array of Supabase Storage paths. Download and look at them.

**3. Identify what changed on the portal:**
- New field?
- Renamed selector?
- New captcha?
- SSO required?
- Required login before apply?

**4. If it's a selector change:** Update the selector constants at the top of the adapter file (`workers/submitter/src/adapters/<ats>/index.ts`). Add a comment noting the date of the change. Record the new selector in a test fixture.

**5. If it's captcha / SSO / anything requiring interaction:** Route this portal to the manual-review queue permanently. Add its URL pattern to the `PORTAL_BLOCKLIST` in `packages/ats/src/detect.ts`.

**6. If it's a vendor migration** (e.g., company moved from Lever to Greenhouse): Update the `companies` row with the new `ats_type` and `ats_slug`; re-crawl.

## Decision: patch vs. abandon

If a custom portal breaks for the third time in a month, stop investing. Route it permanently to manual review. The cost of keeping up with frequent DOM changes outweighs the convenience.

## Prevention

- The CI job `test:integration` runs ATS adapter tests against HAR fixtures every PR.
- The scheduled workflow `verify-ats.yml` (you should add this if missing) runs `pnpm ats:verify` daily and alerts on drift.
- Add new portals only after you have at least one successful manual application through them; this gives you a ground truth for the adapter's expected behavior.