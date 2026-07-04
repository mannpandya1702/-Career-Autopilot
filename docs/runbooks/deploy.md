# Runbook — Deployment

End-to-end deploy. Run through this once per release; tag the resulting commit `release/YYYY-MM-DD`.

---

## 0. Pre-flight (every deploy)

```bash
git status                   # clean
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test
pnpm build                   # produces .next/ + tsc no-emit across workspaces
```

If any step fails, stop. Open a fix PR; do not deploy.

Confirm CLAUDE.md §3 versions match what you're shipping:

```bash
grep -E "node|pnpm|typescript|next|react|playwright|supabase" package.json apps/web/package.json
```

---

## 1. Apply pending Supabase migrations

```bash
# Connect the local CLI to the project (one-time per machine).
supabase login
supabase link --project-ref <project-ref>

# Show what's pending against the live DB. Verify by hand before push.
supabase db diff --linked

# Apply.
pnpm db:migrate
pnpm db:types                # regenerates packages/db/src/types/database.ts
git diff packages/db/src/types/database.ts   # commit any drift in a follow-up PR
```

If `db:migrate` fails partway, follow `recover-failed-migration.md` before
proceeding.

---

## 2. Deploy the web app (Vercel)

`main` push triggers a production deploy automatically:

```bash
git push origin main
```

Watch the build at <https://vercel.com/dashboard>. When the deploy turns
green:

- Open the production URL in an incognito window.
- Sign in via magic link.
- Visit `/onboarding`, `/jobs`, `/profile`, `/queue`, `/tracker`,
  `/analytics`. Each page should render without an error boundary.
- In Sentry: confirm the release tag matches the deploy SHA and the
  source maps uploaded.

---

## 3. Deploy the worker stack (Oracle VM)

```bash
ssh <vm-user>@<vm-ip>
cd /opt/career-autopilot
git fetch origin
git reset --hard origin/main           # destructive on purpose: VM is a build target, not a workspace
docker compose pull                    # pulls pinned image SHAs
docker compose build                   # rebuilds workers/* containers
docker compose up -d                   # rolling restart
docker compose ps                      # every service must be 'healthy' or 'up'
docker compose logs --tail=200 -f      # watch for cold-start errors for 2 minutes
```

Health checks to look for in the logs:

- `crawler starting`           (workers/crawler)
- `scorer starting`            (workers/scorer)
- `tailor worker starting`     (workers/tailor)
- `verifier starting`          (workers/verifier)
- `submitter starting`         (workers/submitter) — confirm `enable_auto_submit: false` on a fresh deploy
- `email-poller starting`      (workers/email-poller)
- `follow-up worker starting`  (workers/follow-up)
- `profile-embedder starting`  (workers/profile-embedder)

---

## 4. Smoke tests

```bash
# Trigger one crawl.
pnpm crawl:enqueue
# Within ~30s, expect new rows in jobs and at least one new run in job_crawl_runs.

# Confirm the Vercel preview can score a job (use the /jobs UI).
```

---

## 5. Rollback

If anything is wrong:

```bash
# Web — Vercel: redeploy the previous build from the dashboard.
# Workers:
ssh <vm-user>@<vm-ip>
cd /opt/career-autopilot
git reset --hard <previous-sha>
docker compose up -d --build
```

DB migrations — see `recover-failed-migration.md`.
