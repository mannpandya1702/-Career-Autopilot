// 30-minute Gmail IMAP polling loop. Per docs/build-phases.md P9.2:
//   1. Pull unread inbox messages since last cursor.
//   2. classifyEmail (Gemini Flash-Lite, PUBLIC).
//   3. matchEmailToSubmission against the user's recent submissions.
//   4. Append outcome_events row + bump outcomes.stage if matched.
//
// IMAP/OAuth wiring is left to the deploy step — the worker boots with a
// pluggable EmailFetcher so tests can inject fixed messages and the live
// fetcher (`@google-cloud/local-auth` + `imapflow`) is wired in once
// GMAIL_USER/GMAIL_APP_PASSWORD are configured.

import { createClient } from '@supabase/supabase-js';
import type { Database, OutcomeType } from '@career-autopilot/db';
import { loadWorkerEnv, logger } from '@career-autopilot/shared';
import { LlmRouter, classifyEmail, makeStubProvider } from '@career-autopilot/llm';
import { matchEmailToSubmission, type SubmissionForMatch } from './match';

const TICK_MS = 30 * 60 * 1000;

const log = logger.child({ service: 'email-poller' });

export interface RawEmail {
  message_id: string;
  subject: string;
  from: string;
  body: string;
  received_at: string;
}

export interface EmailFetcher {
  fetchUnread(sinceCursor: string | null): Promise<RawEmail[]>;
  ack(messageId: string): Promise<void>;
}

// Always-empty fetcher used when GMAIL credentials are missing.
const noopFetcher: EmailFetcher = {
  async fetchUnread() {
    return [];
  },
  async ack() {
    // no-op
  },
};

async function listOpenSubmissions(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
): Promise<SubmissionForMatch[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select(
      'id, submitted_at, job:jobs(title, company:companies(name)), outcomes:outcomes(stage, reached_at)',
    )
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  type JoinShape = {
    id: string;
    submitted_at: string | null;
    job?: { title?: string; company?: { name?: string } | null } | null;
    outcomes?: { stage: OutcomeType; reached_at: string }[] | null;
  };
  return ((data ?? []) as unknown as JoinShape[])
    .filter((row) => !!row.submitted_at)
    .map((row) => {
      const sortedStages = [...(row.outcomes ?? [])].sort((a, b) =>
        a.reached_at.localeCompare(b.reached_at),
      );
      const last = sortedStages[sortedStages.length - 1];
      return {
        submission_id: row.id,
        company_name: row.job?.company?.name ?? null,
        job_title: row.job?.title ?? null,
        submitted_at: row.submitted_at as string,
        current_stage: last?.stage ?? null,
      };
    });
}

async function processEmail(
  supabase: ReturnType<typeof createClient<Database>>,
  router: LlmRouter,
  userId: string,
  email: RawEmail,
): Promise<void> {
  const classification = await classifyEmail(router, {
    subject: email.subject,
    from: email.from,
    body: email.body,
  });

  if (classification.outcome_type === 'other') return;
  // Only the canonical 10 outcome types map to outcome_events.
  const validStages = new Set([
    'submitted',
    'acknowledged',
    'callback',
    'rejection',
    'interview_invite',
    'interview_completed',
    'offer',
    'ghosted',
  ]);
  if (!validStages.has(classification.outcome_type)) return;

  const candidates = await listOpenSubmissions(supabase, userId);
  const submissionId = matchEmailToSubmission({
    job_match_signal: classification.job_match_signal,
    email_body: email.body,
    email_from: email.from,
    candidates,
  });

  await supabase.from('outcome_events').insert({
    user_id: userId,
    submission_id: submissionId,
    source: 'email',
    outcome_type: classification.outcome_type as OutcomeType,
    confidence: classification.confidence,
    payload: {
      message_id: email.message_id,
      subject: email.subject,
      from: email.from,
      reasoning: classification.reasoning,
      job_match_signal: classification.job_match_signal,
    },
  });

  if (submissionId) {
    await supabase.from('outcomes').insert({
      user_id: userId,
      submission_id: submissionId,
      stage: classification.outcome_type as OutcomeType,
      reached_at: email.received_at,
      notes: `auto: ${classification.reasoning.slice(0, 200)}`,
    });
  }
}

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const router = new LlmRouter({ providers: { gemini: makeStubProvider('gemini') } });

  const fetcher: EmailFetcher = noopFetcher;
  log.info(
    { hasGmailCreds: !!env.GMAIL_USER, tickMs: TICK_MS },
    'email-poller starting',
  );

  let running = true;
  const shutdown = () => {
    running = false;
    log.info('shutdown signal received');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Cursor stored locally in env so a fresh boot doesn't re-import; the
  // production path stores it in kv_store keyed by user_id.
  let cursor: string | null = null;

  while (running) {
    try {
      const messages = await fetcher.fetchUnread(cursor);
      if (messages.length === 0) {
        log.info('no new messages');
      }
      // Single-user system today; iterate over user_profiles for users
      // with onboarded_at set.
      const { data: users } = await supabase
        .from('user_profiles')
        .select('user_id')
        .not('onboarded_at', 'is', null);
      const userId = users?.[0]?.user_id;
      if (userId) {
        for (const m of messages) {
          try {
            await processEmail(supabase, router, userId, m);
            await fetcher.ack(m.message_id);
          } catch (err) {
            log.error(
              { err: err instanceof Error ? err.message : String(err), message_id: m.message_id },
              'process failed',
            );
          }
        }
      }
      cursor = new Date().toISOString();
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err) }, 'tick error');
    }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
  log.info('email-poller stopped');
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    log.error({ err: err instanceof Error ? err.message : String(err) }, 'fatal');
    process.exit(1);
  });
}
