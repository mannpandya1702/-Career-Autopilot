// Worker-side environment validation.
// Imports from `@career-autopilot/shared/env`. Fails fast with a readable
// error if any required variable is missing or malformed.
//
// The web app uses @t3-oss/env-nextjs instead; see apps/web/src/env.ts.

import { z } from 'zod';

const booleanFromString = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');

const WorkerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_DB_URL: z.string().url().optional(),

  GEMINI_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  LLM_PRIVACY_MODE: z.enum(['claude_haiku', 'gemini_paid']).default('claude_haiku'),

  GMAIL_USER: z.string().email().optional(),
  GMAIL_APP_PASSWORD: z.string().min(1).optional(),

  SENTRY_DSN: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  POSTHOG_KEY: z.string().optional(),
  AXIOM_TOKEN: z.string().optional(),

  WORKER_ID: z.string().min(1).default('worker-1'),
  PLAYWRIGHT_HEADLESS: booleanFromString.default('true'),
  TECTONIC_CACHE_DIR: z.string().default('/var/cache/tectonic'),

  ENABLE_AUTO_SUBMIT: booleanFromString.default('false'),
  ENABLE_LINKEDIN_EXTENSION: booleanFromString.default('true'),
  DAILY_APPLICATION_CAP: z.coerce.number().int().positive().default(30),
});

export type WorkerEnv = z.infer<typeof WorkerEnvSchema>;

let cached: WorkerEnv | undefined;

export function loadWorkerEnv(source?: NodeJS.ProcessEnv): WorkerEnv {
  if (!source && cached) return cached;
  const parsed = WorkerEnvSchema.safeParse(source ?? process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Worker env validation failed:\n${issues}`);
  }
  if (!source) cached = parsed.data;
  return parsed.data;
}
