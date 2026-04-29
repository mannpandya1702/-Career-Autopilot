// pgmq polling loop for the verifier worker.
//
// Reads `{ tailored_resume_id }` from `verify_jobs`. For each:
//   1. Load the tailored_resumes row + its rendered PDF from Storage.
//   2. Run the 3-parser ensemble.
//   3. Score + persist a `verifications` row.
//   4. If score < threshold AND regen budget remains, push a tailor_jobs
//      message with the verifier feedback as user_hint.

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@career-autopilot/db';
import { loadWorkerEnv, logger } from '@career-autopilot/shared';
import {
  createOpenResumeClient,
  createPyresparserClient,
  simpleParser,
  type ParserClient,
} from '@career-autopilot/parsers';
import type { TailoredResume } from '@career-autopilot/resume';
import { runVerifyJob } from './verify-job';
import { persistVerification } from './persist';

const QUEUE_NAME = 'verify_jobs';
const MAX_ATTEMPTS = 3;
const VISIBILITY_TIMEOUT_SECONDS = 180;
const POLL_INTERVAL_MS = 5_000;

const MessageSchema = z.object({
  tailored_resume_id: z.string().uuid(),
});

const log = logger.child({ service: 'verifier-worker' });

function buildParsers(): ParserClient[] {
  const parsers: ParserClient[] = [simpleParser];
  const pyresparserUrl = process.env['PYRESPARSER_URL'];
  if (pyresparserUrl) {
    parsers.push(createPyresparserClient({ baseUrl: pyresparserUrl }));
  }
  const openresumeUrl = process.env['OPENRESUME_URL'];
  if (openresumeUrl) {
    parsers.push(createOpenResumeClient({ baseUrl: openresumeUrl }));
  }
  return parsers;
}

async function processOnce(
  supabase: ReturnType<typeof createClient<Database>>,
  parsers: ParserClient[],
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

    const { tailored_resume_id } = parsed.data;
    const scope = log.child({ tailored_resume_id, msg_id: row.msg_id });
    try {
      await verifyOne(supabase, parsers, tailored_resume_id, scope);
      await supabase.rpc('pgmq_archive' as never, {
        queue_name: QUEUE_NAME,
        msg_id: row.msg_id,
      } as never);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      scope.error({ err: message, read_ct: row.read_ct }, 'verify failed');
      if (row.read_ct >= MAX_ATTEMPTS) {
        await supabase.rpc('pgmq_send' as never, {
          queue_name: `${QUEUE_NAME}_dlq`,
          msg: { tailored_resume_id, error: message },
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

async function verifyOne(
  supabase: ReturnType<typeof createClient<Database>>,
  parsers: ParserClient[],
  tailoredResumeId: string,
  scope: typeof log,
): Promise<void> {
  const { data: row, error } = await supabase
    .from('tailored_resumes')
    .select('id, user_id, job_id, resume_json, pdf_url, regeneration_count')
    .eq('id', tailoredResumeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) {
    scope.warn('tailored_resume not found; skipping');
    return;
  }
  if (!row.pdf_url) throw new Error('tailored_resume.pdf_url missing — render first');

  // Download the PDF from Storage.
  const download = await supabase.storage.from('resumes').download(row.pdf_url);
  if (download.error) throw new Error(`storage download failed: ${download.error.message}`);
  const pdfBuffer = Buffer.from(await download.data.arrayBuffer());

  // Pull the parsed JD's must-have skills (set by the scorer in Phase 4).
  const jdRes = await supabase
    .from('job_embeddings')
    .select('parsed_jd')
    .eq('job_id', row.job_id)
    .maybeSingle();
  if (jdRes.error) throw new Error(jdRes.error.message);
  const parsedJd = jdRes.data?.parsed_jd as { must_have_skills?: string[] } | null;
  const mustHaves = parsedJd?.must_have_skills ?? [];

  const tailored = row.resume_json as unknown as TailoredResume;

  const result = await runVerifyJob({
    pdfBuffer,
    parsers,
    tailored,
    must_have_skills: mustHaves,
    prior_regenerations: row.regeneration_count,
  });

  await persistVerification(supabase, row.user_id, row.id, result);
  scope.info(
    {
      overall: result.score.overall,
      passed: result.score.passed,
      regen: result.should_regenerate,
    },
    'verified',
  );

  if (result.should_regenerate && result.feedback) {
    await supabase.rpc('pgmq_send' as never, {
      queue_name: 'tailor_jobs',
      msg: { user_id: row.user_id, job_id: row.job_id, user_hint: result.feedback },
    } as never);
    scope.info('regeneration enqueued');
  }
}

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const parsers = buildParsers();
  log.info({ queue: QUEUE_NAME, parsers: parsers.map((p) => p.name) }, 'verifier starting');

  let running = true;
  const shutdown = () => {
    running = false;
    log.info('shutdown signal received');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (running) {
    try {
      await processOnce(supabase, parsers);
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err) }, 'loop error');
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  log.info('verifier stopped');
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    log.error({ err: err instanceof Error ? err.message : String(err) }, 'fatal');
    process.exit(1);
  });
}
