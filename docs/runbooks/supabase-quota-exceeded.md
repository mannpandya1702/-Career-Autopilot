# Runbook — Supabase free-tier quota exceeded

Triggered by:
- 503 / 429 from Supabase API.
- "Project paused" banner in the dashboard.
- The keepalive workflow (`.github/workflows/keepalive.yml`) failing.

Free-tier limits we routinely brush:
- 500MB database storage.
- 2GB egress bandwidth per month.
- 50K monthly auth users (irrelevant — single-user).
- Project pauses after 7 days of inactivity (the keepalive workflow
  exists specifically to prevent this).

---

## 0. Confirm the symptom

```bash
# Local — does the API answer?
curl -sS "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" -I

# Dashboard — Settings → Usage shows current consumption.
```

If the project is paused, **resume it** from the dashboard banner first.
This costs nothing and unblocks investigation.

---

## 1. Reduce write volume

The biggest contributors to size + bandwidth are:
- `jobs.raw_payload` (full vendor response per job).
- `submission_attempts.request_payload` + `response_payload`.
- `verifications.parser_results`.

```sql
-- Drop raw vendor payloads older than 60 days. Saves the most space.
delete from public.jobs
 where raw_payload is not null
   and last_seen_at < now() - interval '60 days';

-- Trim parser_results on old verifications.
update public.verifications
   set parser_results = '{}'::jsonb
 where created_at < now() - interval '90 days';
```

After cleanup, run `vacuum full` if you have permission (dashboard → SQL editor):

```sql
vacuum full public.jobs;
vacuum full public.verifications;
vacuum full public.submission_attempts;
```

---

## 2. Cap bandwidth

Most egress comes from the workers re-fetching jobs we already have.
Verify the crawler is hitting the dedup pass (it should — see
`workers/crawler/src/dedup.ts`).

```sql
-- Top egress culprits last hour.
select count(*), source
  from public.job_crawl_runs
 where started_at > now() - interval '1 hour'
group by source order by 1 desc;
```

If a single ATS run is unexpectedly large, lower its priority in
`config/target-companies.yml` and re-run `pnpm seed:companies`.

---

## 3. Long-term fix: upgrade

Free tier is ~$0; the next tier (Pro, $25/mo) lifts the database to
8GB and bandwidth to 250GB. Upgrade from the dashboard:

- Settings → Billing → Upgrade to Pro.
- Verify the old project keeps the same URL (it does; only quotas change).

After upgrading, drop the cleanup `delete` statements from any
periodic scripts — the headroom stops being meaningful.

---

## 4. Disaster: data loss

If we lost data because the project was paused for too long:

1. Restore from the most recent nightly `pg_dump`:

```bash
ssh <vm-user>@<vm-ip>
ls -la /var/backups/career-autopilot/
psql "$SUPABASE_DB_URL" < /var/backups/career-autopilot/career-autopilot-YYYY-MM-DD.sql
```

2. Re-run `pnpm db:types` to refresh the generated types.
3. Re-enqueue any in-flight work (`pnpm crawl:enqueue`, etc.).

See `recover-failed-migration.md` for partial-state recovery.
