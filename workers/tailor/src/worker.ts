// pgmq polling loop for the tailor worker.
//
// Reads `{ user_id, job_id }` from `tailor_jobs`. Fetches master profile
// + parsed JD, runs runTailorPipeline, renders PDF + DOCX, uploads to
// Supabase Storage, persists tailored_resumes. 3-retry DLQ.
//
// Tectonic is required on PATH for live PDF rendering; the worker boots
// with the stub compiler so it can run on a CI box that doesn't have
// LaTeX installed.

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@career-autopilot/db';
import { loadWorkerEnv, logger } from '@career-autopilot/shared';
import { LlmRouter, makeStubProvider } from '@career-autopilot/llm';
import {
  renderDocx,
  renderPdf,
  stubLatexCompiler,
  tectonicCompiler,
  type LatexCompiler,
  type RenderHeader,
  type MasterProfile,
} from '@career-autopilot/resume';
import { runTailorPipeline } from './tailor-job';
import { persistTailoredResume } from './persist';

const QUEUE_NAME = 'tailor_jobs';
const MAX_ATTEMPTS = 3;
const VISIBILITY_TIMEOUT_SECONDS = 300;
const POLL_INTERVAL_MS = 5_000;

const MessageSchema = z.object({
  user_id: z.string().uuid(),
  job_id: z.string().uuid(),
  user_hint: z.string().optional(),
});

const log = logger.child({ service: 'tailor-worker' });

// Determine which Tectonic compiler to use. If `TECTONIC_AVAILABLE=true`
// is set, fall through to the live shellout; otherwise use the stub so
// Phase 5 boots end-to-end without LaTeX installed.
function pickCompiler(): LatexCompiler {
  return process.env['TECTONIC_AVAILABLE'] === 'true'
    ? tectonicCompiler
    : stubLatexCompiler;
}

async function processOnce(
  supabase: ReturnType<typeof createClient<Database>>,
  router: LlmRouter,
  compiler: LatexCompiler,
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
      log.error({ msg_id: row.msg_id }, 'invalid message shape; archiving');
      await supabase.rpc('pgmq_archive' as never, {
        queue_name: QUEUE_NAME,
        msg_id: row.msg_id,
      } as never);
      continue;
    }

    const { user_id, job_id, user_hint } = parsed.data;
    const scope = log.child({ user_id, job_id, msg_id: row.msg_id });

    try {
      await tailorOne(supabase, router, compiler, user_id, job_id, user_hint, scope);
      await supabase.rpc('pgmq_archive' as never, {
        queue_name: QUEUE_NAME,
        msg_id: row.msg_id,
      } as never);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      scope.error({ err: message, read_ct: row.read_ct }, 'tailor failed');
      if (row.read_ct >= MAX_ATTEMPTS) {
        await supabase.rpc('pgmq_send' as never, {
          queue_name: `${QUEUE_NAME}_dlq`,
          msg: { user_id, job_id, error: message },
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

async function tailorOne(
  supabase: ReturnType<typeof createClient<Database>>,
  router: LlmRouter,
  compiler: LatexCompiler,
  userId: string,
  jobId: string,
  userHint: string | undefined,
  scope: typeof log,
): Promise<void> {
  const [profileRes, jobRes, embeddingRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('jobs')
      .select('id, title, description, company:companies(name)')
      .eq('id', jobId)
      .maybeSingle(),
    supabase
      .from('job_embeddings')
      .select('parsed_jd')
      .eq('job_id', jobId)
      .maybeSingle(),
  ]);
  if (profileRes.error) throw new Error(profileRes.error.message);
  if (jobRes.error) throw new Error(jobRes.error.message);
  if (embeddingRes.error) throw new Error(embeddingRes.error.message);

  type JobJoinRow = {
    id: string;
    title: string;
    description: string;
    company: { name: string } | null;
  };
  const profile = profileRes.data;
  const jobRow = jobRes.data as unknown as JobJoinRow | null;
  if (!profile) throw new Error('profile missing');
  if (!jobRow) throw new Error('job missing');
  if (!embeddingRes.data) throw new Error('parsed JD missing — score this job first');

  // Pull the rest of the master profile in parallel.
  const [expRes, bulletsRes, projectsRes, skillsRes, eduRes] = await Promise.all([
    supabase.from('experiences').select('*').eq('user_id', userId).order('ord'),
    supabase.from('experience_bullets').select('*').eq('user_id', userId).order('ord'),
    supabase.from('projects').select('*').eq('user_id', userId).order('ord'),
    supabase.from('skills').select('*').eq('user_id', userId).order('name'),
    supabase.from('education').select('*').eq('user_id', userId).order('ord'),
  ]);
  if (expRes.error) throw new Error(expRes.error.message);
  if (bulletsRes.error) throw new Error(bulletsRes.error.message);
  if (projectsRes.error) throw new Error(projectsRes.error.message);
  if (skillsRes.error) throw new Error(skillsRes.error.message);
  if (eduRes.error) throw new Error(eduRes.error.message);

  type ExperienceRow = Database['public']['Tables']['experiences']['Row'];
  type BulletRow = Database['public']['Tables']['experience_bullets']['Row'];
  const bullets = (bulletsRes.data ?? []) as BulletRow[];
  const bulletsByExp = new Map<string, BulletRow[]>();
  for (const b of bullets) {
    const list = bulletsByExp.get(b.experience_id) ?? [];
    list.push(b);
    bulletsByExp.set(b.experience_id, list);
  }
  const expRows = (expRes.data ?? []) as ExperienceRow[];
  const experiences = expRows.map((e) => ({
    ...e,
    bullets: bulletsByExp.get(e.id) ?? [],
  })) as MasterProfile['experiences'];

  // Drop summary_embedding from the row we send to the LLM.
  const { summary_embedding: _drop, ...profileForLlm } = profile;
  const master: MasterProfile = {
    profile: profileForLlm as unknown as MasterProfile['profile'],
    experiences,
    projects: (projectsRes.data ?? []) as MasterProfile['projects'],
    skills: (skillsRes.data ?? []) as MasterProfile['skills'],
    education: (eduRes.data ?? []) as MasterProfile['education'],
  };

  const result = await runTailorPipeline(
    router,
    {
      master,
      parsed_jd: embeddingRes.data.parsed_jd,
      raw_jd_text: jobRow.description,
      company_name: jobRow.company?.name ?? '',
      ...(userHint ? { user_hint: userHint } : {}),
    },
    { userId },
  );

  const header: RenderHeader = {
    full_name: master.profile.full_name,
    email: master.profile.email,
    phone: master.profile.phone ?? null,
    location: master.profile.location ?? null,
    linkedin_url: master.profile.linkedin_url ?? null,
    github_url: master.profile.github_url ?? null,
    portfolio_url: master.profile.portfolio_url ?? null,
  };

  const [pdfBuffer, docxBuffer] = await Promise.all([
    renderPdf({ resume: result.resume, header, compiler }),
    renderDocx(result.resume, header),
  ]);

  // Upload to Supabase Storage at resumes/{userId}/{jobId}.{ext}.
  const pdfPath = `resumes/${userId}/${jobId}.pdf`;
  const docxPath = `resumes/${userId}/${jobId}.docx`;
  const [pdfUpload, docxUpload] = await Promise.all([
    supabase.storage.from('resumes').upload(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    }),
    supabase.storage.from('resumes').upload(docxPath, docxBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    }),
  ]);
  if (pdfUpload.error) scope.warn({ err: pdfUpload.error.message }, 'pdf upload failed');
  if (docxUpload.error) scope.warn({ err: docxUpload.error.message }, 'docx upload failed');

  await persistTailoredResume(
    supabase,
    {
      userId,
      jobId,
      profile_version_hash: profile.updated_at,
      pdf_url: pdfUpload.error ? null : pdfPath,
      docx_url: docxUpload.error ? null : docxPath,
    },
    result,
  );
  scope.info(
    {
      honesty: result.honesty_check_passed,
      regen: result.regeneration_count,
      model: result.llm_model,
    },
    'tailored',
  );
}

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const supabase = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  const router = new LlmRouter({
    providers: {
      anthropic: makeStubProvider('anthropic'),
      gemini: makeStubProvider('gemini'),
    },
  });
  const compiler = pickCompiler();

  log.info({ queue: QUEUE_NAME }, 'tailor worker starting');

  let running = true;
  const shutdown = () => {
    running = false;
    log.info('received shutdown signal');
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (running) {
    try {
      await processOnce(supabase, router, compiler);
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : String(err) }, 'loop error');
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  log.info('tailor worker stopped');
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    log.error({ err: err instanceof Error ? err.message : String(err) }, 'fatal');
    process.exit(1);
  });
}
