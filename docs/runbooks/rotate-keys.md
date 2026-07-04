# Runbook — Rotating API keys

When to run:
- Quarterly, on a calendar reminder.
- Immediately if a key has leaked (committed to git, posted in a chat,
  copy-pasted into a third-party tool).
- After offboarding any contractor who had access (irrelevant today —
  single-user — but the procedure is the same).

The goal is **no downtime**. We rotate by adding the new key alongside
the old, switching workers + web to the new one, then revoking the old.

---

## Supabase service-role key

1. Supabase dashboard → Settings → API → Service Role.
2. Click **Generate a new service_role key**.
3. Copy the new key. Do NOT delete the old one yet.
4. Update `SUPABASE_SERVICE_ROLE_KEY` in:
   - Vercel project settings (Production + Preview).
   - Oracle VM `/opt/career-autopilot/.env`.
   - GitHub Actions repo secrets.
5. Trigger a Vercel redeploy: `vercel --prod` or push an empty commit.
6. SSH to VM: `cd /opt/career-autopilot && docker compose up -d`.
7. Wait 5 minutes. Confirm no `unauthorized` errors in:
   - Sentry web app project.
   - `docker compose logs` on the VM.
8. Supabase dashboard → revoke the OLD service-role key.

If anything errors during steps 5–7, set the env back to the OLD key
and skip step 8 until the failing call is fixed.

---

## Anthropic API key

1. Anthropic console → API Keys → **Create key**, name it
   `career-autopilot-YYYYMMDD`.
2. Set spending limits identical to the old key.
3. Update `ANTHROPIC_API_KEY` everywhere (Vercel + VM + GH Actions).
4. Redeploy web; restart workers.
5. Wait for one tailor + cover-letter call to succeed end-to-end on a
   real job (use the `/queue` test page or trigger via `pnpm tsx` script).
6. Anthropic console → revoke the old key.

---

## Gemini (Google AI Studio) key

1. AI Studio → Get API key → **Create API key in new project** (or pick
   the existing project).
2. Update `GEMINI_API_KEY` everywhere.
3. Redeploy web; restart workers.
4. Wait for one `jd.parse` and one `embed.jd` call to succeed.
5. AI Studio → delete the old key.

---

## Gmail App Password

Used by the follow-up worker for outbound emails.

1. <https://myaccount.google.com/apppasswords> → revoke the old
   16-character app password.
2. Generate a new one for "Career Autopilot worker".
3. Update `GMAIL_APP_PASSWORD` on the VM only (web doesn't need it).
4. `docker compose restart follow-up-worker`.

---

## Greenhouse / Ashby per-company API keys

These are stored in `companies.api_key_encrypted` (Phase 11+ — until
then, env vars `GREENHOUSE_API_KEY` and `ASHBY_API_KEY` keyed by ats_slug).

1. Ask the company contact for a new key.
2. Update the env on the VM.
3. `docker compose restart submitter-worker`.
4. Test by enqueueing one submission to that company with
   `ENABLE_AUTO_SUBMIT=true` for a single dry-run.

---

## Sentry DSN

Lower priority — Sentry rejects writes with bad DSNs and we don't lose
data, only telemetry.

1. Sentry → Settings → Client Keys (DSN) → revoke + regenerate.
2. Update `SENTRY_DSN` in Vercel + VM.
3. Redeploy.

---

## Audit

After rotating, log the rotation in `docs/runbooks/key-rotation-log.md`
(create it on the first run):

```
2026-04-21 — Anthropic + Supabase service role rotated by <name>. Old keys revoked.
```
