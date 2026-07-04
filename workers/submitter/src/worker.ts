// pgmq polling loop for the submitter.
//
// Reads `{ submission_id }` from `submit_jobs`. For each:
//   1. Refuse if ENABLE_AUTO_SUBMIT=false AND adapter is non-Playwright
//      (Playwright still runs in dry-run mode with screenshots).
//   2. Refuse if the daily cap is exhausted.
//   3. Load submission + tailored resume PDF + cover letter + answers.
//   4. Pick the right adapter via pickSubmitAdapter.
//   5. Run the adapter; persist the attempt + maybe manual_review_queue row.
//   6. Archive the message regardless of outcome — failed/manual_review
//      submissions surface in the UI, not the queue.

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@career-autopilot/db';
import { loadWorkerEnv, logger } from '@career-autopilot/shared';
import { checkDailyCap } from './cap';
import { persistSubmissionResult } from './persist';
import { pickSubmitAdapter } from './router';
import type {
  AnswerInput,
  CandidateProfile,
  SubmissionInput,
  SubmissionOptions,
  SubmitResult,
} from './types';

const QUEUE_NAME = 'submit_jobs';
const MAX_ATTEMPTS = 3;
const VISIBILITY_TIMEOUT_SECONDS = 300;
const POLL_INTERVAL_MS = 5_000;

const MessageSchema = z.object({
  submission_id: z.string().uuid(),
});

const log = logger.child({ service: 'submitter-worker' });

async function processOnce(
  supabase: ReturnType<typeof createClient<Database>>,
  options: SubmissionOptions & { dailyCap: number },
): Promise<number> {
  const { data, error } = await supabase.rpc('pgmq_read' as never, {
    queue_name: QUEUE_NAME,
    vt: VISIBILITY_TIMEOUT_SECONDS,
    qty: 1,
  } as never);
  if (error) {
    log.warn({ error: error.message }, 'pgmq_read failed — queue may not exist yet');
    return 0;
  }
  const rows = data as unknown as { msg_id: number; read_ct: number; message: unknown }[];
  if (!rows || rows.length === 0) return 0;

  for (const row of rows) {
    const parsed = MessageSchema.safeParse(row.message);
    if (!parsed.success) {
      log.error({ msg_id: row.msg_id }, 'invalid message; archiving');
      await supabase.rpc('pgmq_archive' as never, {
        queue_name: QUEUE_NAME,
        msg_id: row.msg_id,
      } as never);
      continue;
    }

    const { submission_id } = parsed.data;
    const scope = log.child({ submission_id, msg_id: row.msg_id });
    try {
      await submitOne(supabase, submission_id, options, scope);
      await supabase.rpc('pgmq_archive' as never, {
        queue_name: QUEUE_NAME,
        msg_id: row.msg_id,
      } as never);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      scope.error({ err: message, read_ct: row.read_ct }, 'submit failed');
      if (row.read_ct >= MAX_ATTEMPTS) {
        await supabase.rpc('pgmq_send' as never, {
          queue_name: `${QUEUE_NAME}_dlq`,
          msg: { submission_id, error: message },
        } as never);
        await supabase.rpc('pgmq_archive' as never, {
          queue_name: QUEUE_NAME,
          msg_id: row.msg_id,
        } as never);
      }
    }
  }
  return rows.length;
}

async function submitOne(
  supabase: ReturnType<typeof createClient<Database>>,
  submissionId: string,
  options: SubmissionOptions & { dailyCap: number },
  scope: typeof log,
): Promise<void> {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, user_id, job_id, tailored_resume_id, cover_letter_id, status')
    .eq('id', submissionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    scope.warn('submission not found; skipping');
    return;
  }
  if (data.status === 'succeeded') {
    scope.info('already succeeded; skipping');
    return;
  }

  const cap = await checkDailyCap(supabase, data.user_id, options.dailyCap);
  if (!cap.allowed) {
    scope.warn({ used: cap.used, cap: cap.cap }, 'daily cap reached; deferring');
    return;
  }

  // Mark in_progress.
  await supabase
    .from('submissions')
    .update({ status: 'in_progress' })
    .eq('id', submissionId);

  // Load the inputs we need to submit.
  const [profileRes, jobRes, tailoredRes, coverRes, answersRes, companyRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', data.user_id).maybeSingle(),
    supabase.from('jobs').select('id, external_id, apply_url, company_id').eq('id', data.job_id).maybeSingle(),
    supabase
      .from('tailored_resumes')
      .select('id, pdf_url')
      .eq('id', data.tailored_resume_id)
      .maybeSingle(),
    data.cover_letter_id
      ? supabase
          .from('cover_letters')
          .select('greeting, body, signoff')
          .eq('id', data.cover_letter_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('question_answers')
      .select('question_text, question_type, word_limit, answer_text')
      .eq('user_id', data.user_id)
      .eq('job_id', data.job_id),
    supabase
      .from('jobs')
      .select('company:companies(ats_type, ats_slug)')
      .eq('id', data.job_id)
      .maybeSingle(),
  ]);
  if (profileRes.error) throw new Error(profileRes.error.message);
  if (jobRes.error) throw new Error(jobRes.error.message);
  if (tailoredRes.error) throw new Error(tailoredRes.error.message);
  if (coverRes.error) throw new Error(coverRes.error.message);
  if (answersRes.error) throw new Error(answersRes.error.message);
  if (companyRes.error) throw new Error(companyRes.error.message);

  const profile = profileRes.data;
  const job = jobRes.data;
  const tailored = tailoredRes.data;
  if (!profile || !job || !tailored?.pdf_url) {
    throw new Error('missing prerequisites — profile / job / tailored PDF');
  }
  const company = (companyRes.data as { company?: { ats_type: string; ats_slug: string } | null } | null)?.company;
  if (!company) throw new Error('company not found for job');

  // Download the rendered PDF.
  const download = await supabase.storage.from('resumes').download(tailored.pdf_url);
  if (download.error) throw new Error(`pdf download failed: ${download.error.message}`);
  const pdfBuffer = Buffer.from(await download.data.arrayBuffer());

  const candidate: CandidateProfile = {
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone ?? null,
    location: profile.location ?? null,
    linkedin_url: profile.linkedin_url ?? null,
    github_url: profile.github_url ?? null,
    portfolio_url: profile.portfolio_url ?? null,
  };

  const cover = coverRes.data
    ? `${(coverRes.data.greeting ?? '').trim()}\n\n${coverRes.data.body}\n\n${(coverRes.data.signoff ?? '').trim()}`.trim()
    : null;

  const answers: AnswerInput[] = (answersRes.data ?? []).map((row) => ({
    question_text: row.question_text,
    answer_text: row.answer_text,
    question_type: row.question_type,
    word_limit: row.word_limit ?? null,
  }));

  const submissionInput: SubmissionInput = {
    ats: company.ats_type as SubmissionInput['ats'],
    ats_slug: company.ats_slug,
    job_external_id: job.external_id,
    apply_url: job.apply_url,
    resume_pdf: pdfBuffer,
    resume_filename: `${profile.full_name.replace(/\s+/g, '_')}.pdf`,
    cover_letter_text: cover,
    candidate,
    answers,
    ...(process.env['GREENHOUSE_API_KEY'] && company.ats_type === 'greenhouse'
      ? { ats_api_key: process.env['GREENHOUSE_API_KEY'] }
      : {}),
    ...(process.env['ASHBY_API_KEY'] && company.ats_type === 'ashby'
      ? { ats_api_key: process.env['ASHBY_API_KEY'] }
      : {}),
  };

  const adapter = pickSubmitAdapter(company.ats_type as SubmissionInput['ats'], {
    hasGreenhouseKey: !!process.env['GREENHOUSE_API_KEY'],
    hasAshbyKey: !!process.env['ASHBY_API_KEY'],
  });
  if (!adapter) {
    const result: SubmitResult = {
      outcome: 'manual_review',
      reason: 'unsupported_ats',
      context: { ats: company.ats_type, apply_url: job.apply_url },
      attempt: {
        method: 'manual',
        success: false,
        request_payload: { ats: company.ats_type },
        response_payload: null,
        error_message: 'No adapter configured (Playwright not wired in)',
        duration_ms: 0,
      },
    };
    await persist(supabase, data, result);
    return;
  }

  const result = await adapter.submit(submissionInput, options);
  await persist(supabase, data, result);
  scope.info({ outcome: result.outcome, method: result.attempt.method }, 'submit complete');
}

async function persist(
  supabase: ReturnType<typeof createClient<Database>>,
  parent: { id: string; user_id: string; job_id: string; tailored_resume_id: string; cover_letter_id: string | null },
  result: SubmitResult,
): Promise<void> {
  // attempt_number = 1 + count of previous attempts for this submission.
  const { count, error } = await supabase
    .from('submission_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', parent.id);
  if (error) throw new Error(error.message);
  const attemptNumber = (count ?? 0) + 1;

  await persistSubmissionResult(
    supabase,
    {
      user_id: parent.user_id,
      job_id: parent.job_id,
      tailored_resume_id: parent.tailored_resume_id,
      cover_letter_id: parent.cover_letter_id,
      attempt_number: attemptNumber,
      storedScreenshotPaths: [], // worker uploads screenshots in a follow-up pass
    },
    result,
  );
}

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  // CLAUDE.md §12 hard gate: env value drives whether ATS-API adapters
  // actually POST. Even with this true, every adapter still records
  // attempt rows and screenshots so the user can audit.
  const options: SubmissionOptions & { dailyCap: number } = {
    enable_auto_submit: env.ENABLE_AUTO_SUBMIT,
    dailyCap: env.DAILY_APPLICATION_CAP,
  };
  log.info(
    {
      queue: QUEUE_NAME,
      enable_auto_submit: options.enable_auto_submit,
      daily_cap: options.dailyCap,
    },
    'submitter starting',
  );

  let running = true;
  const shutdown = () => {
    running = false;
    log.info('shutdown signal received');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (running) {
    try {
      await processOnce(supabase, options);
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err) }, 'loop error');
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  log.info('submitter stopped');
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    log.error({ err: err instanceof Error ? err.message : String(err) }, 'fatal');
    process.exit(1);
  });
}
