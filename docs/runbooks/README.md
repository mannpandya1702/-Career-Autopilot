# Operational runbooks

One file per scenario. Each runbook is short, opinionated, and assumes
you have terminal access to the Oracle VM + dashboard access to Supabase
+ Vercel. If a step in a runbook is wrong, fix the runbook in the same
PR as the underlying change — runbooks rot fast and silently.

| Scenario | File |
|---|---|
| Routine deploys | [`deploy.md`](deploy.md) |
| Rotating API keys (quarterly + on leak) | [`rotate-keys.md`](rotate-keys.md) |
| ATS adapter selectors broke | [`ats-selector-broken.md`](ats-selector-broken.md) |
| Gemini free-tier RPD exhausted | [`llm-quota-exceeded.md`](llm-quota-exceeded.md) |
| Supabase project paused or out of space | [`supabase-quota-exceeded.md`](supabase-quota-exceeded.md) |
| Failed `pnpm db:migrate` | [`recover-failed-migration.md`](recover-failed-migration.md) |

For ad-hoc audits run `pnpm quotas:check` — it lists current Gemini RPD
usage, Anthropic month-to-date spend, Supabase DB size, and Vercel
bandwidth in one table.

For backups, the nightly schedule lives in
[`.github/workflows/backup.yml`](../../.github/workflows/backup.yml) and
runs `scripts/backup-supabase.sh` against the production DB. Restoring
is a `psql … < backup.sql` away — the supabase-quota-exceeded runbook
walks the steps.
