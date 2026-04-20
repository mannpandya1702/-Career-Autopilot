# Runbook — Failed migration / Supabase recovery

## Failed migration

### When this fires
- `pnpm db:migrate` exits non-zero.
- Workers or web app crash with "relation does not exist" / "column does not exist" / permission errors post-deploy.

### Triage

**1. Read the error carefully.** Supabase migration errors are specific. Common causes:
- Syntax error in the migration SQL.
- Reference to a table/column that doesn't exist yet (you wrote the migrations in the wrong order).
- Missing extension (`pgvector`, `pgmq`, `pg_cron`) — enable in Supabase dashboard.
- RLS policy references a column that doesn't exist on the table.

**2. Check state:**
```bash
supabase db diff                                   # see what's actually applied
supabase migration list --db-url $SUPABASE_DB_URL  # see which migrations have run
```

**3. If the migration partially applied** (some statements ran before the failing one):
- Manually reverse the applied statements using `psql "$SUPABASE_DB_URL"`.
- Drop the partial changes so the migration can re-run cleanly.
- Fix the migration file.
- Re-run `pnpm db:migrate`.

**4. If you can't tell what applied** (messy state):
- Check a known-good backup timestamp (see Backup below).
- Restore from backup.
- Fix the migration.
- Re-apply cleanly.

### Prevention

- Always `pnpm db:migrate` against a local dev database first, not production.
- Use `supabase db reset --local` to verify the full migration set applies from scratch.
- After every migration: `pnpm db:types` and commit the regenerated types. Type drift is the canary for schema drift.
- Never edit a migration file that has already been applied in production. Create a new migration that adjusts.

---

## Supabase project paused (free-tier inactivity)

### When this fires
- Keepalive GitHub Action reports failure.
- Web app shows "fetch failed" errors on every query.
- Supabase dashboard shows the project as "Paused."

### Fix
1. Go to Supabase dashboard → your project → "Restore" button.
2. Wait ~2 minutes for resume.
3. Verify the keepalive workflow is running:
   - GitHub → your repo → Actions → "keepalive" workflow.
   - If it hasn't run in the last 24h, manually trigger it.
4. If the workflow is green but the project still paused: check the workflow is hitting a REAL endpoint that causes Postgres activity, not just a 404. The Edge Function it calls should do `SELECT 1`.

### Prevention
- Keepalive runs daily. If you see it green but the project paused, the Edge Function is broken — it's returning 200 without touching Postgres.
- Keep some normal traffic on the project (even a staging page that does a real query) as a secondary activity source.

---

## Oracle VM reclaimed

### When this fires
- Workers all offline.
- You get an email from Oracle about compute-reclamation.
- SSH to the VM fails ("host not found" or immediate TCP RST).

### Cause
Oracle reclaims Always-Free ARM instances if 95th-percentile CPU < 20% over a 7-day window. Your worker pool should prevent this, but a sustained idle period (holiday, extended outage upstream) can trigger reclamation.

### Fix
1. In the Oracle Cloud console, check your compute instances. The reclaimed one will be gone.
2. Provision a new ARM instance (4 OCPU / 24 GB). This is back to the same capacity-availability problem as the initial setup; may take retries.
3. Follow the bootstrap procedure in `docs/runbooks/deploy.md` to set up Docker, pull the image, inject env vars.
4. Restore data: worker state is in Supabase (pgmq queues, submission attempts). No local data loss; just compute loss.

### Prevention
- Ensure at least one worker is always doing real work (polling the pgmq queues counts).
- Add a cron inside the VM that runs a small CPU-burning task every 6 hours — e.g., rebuild the Tectonic cache, run `pnpm test:verifier` against the fixture set. Burns ~5 minutes of CPU.
- Monitor the VM with Better Stack; alert if it's unreachable.

---

## Backups

### What we back up
- Postgres: nightly `pg_dump` on the Oracle VM, 14-day retention.
- Resume PDFs / DOCX: already replicated in Supabase Storage (no local backup needed).
- Env files: manually export to a password manager or encrypted store.

### How to back up now (manual)
```bash
# On the Oracle VM
pg_dump "$SUPABASE_DB_URL" > /var/backups/career-autopilot-$(date +%F).sql
gzip /var/backups/career-autopilot-$(date +%F).sql
```

### How to restore
```bash
# Create a fresh Supabase project (or use the existing one if it's salvageable)
# Then:
gunzip -c /var/backups/career-autopilot-YYYY-MM-DD.sql.gz | psql "$NEW_SUPABASE_DB_URL"
# Regenerate types
pnpm db:types
# Redeploy web + workers
```

### Schedule
The `backup.sh` script should be in Oracle VM's crontab:
```
0 3 * * * /opt/career-autopilot/scripts/backup.sh
```

### Testing restores
Once a quarter, restore a backup to a throwaway Supabase project and verify the schema + data are intact. An untested backup is not a backup.