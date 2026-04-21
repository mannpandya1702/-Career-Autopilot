// Web app environment validation via @t3-oss/env-nextjs.
// Runs at import time on both the server and the client (only NEXT_PUBLIC_*
// variables reach the client bundle).

import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    SUPABASE_DB_URL: z.string().url().optional(),
    GEMINI_API_KEY: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().min(1),
    LLM_PRIVACY_MODE: z.enum(['claude_haiku', 'gemini_paid']).default('claude_haiku'),
    GMAIL_USER: z.string().email().optional(),
    GMAIL_APP_PASSWORD: z.string().optional(),
    SENTRY_DSN: z.string().url().optional().or(z.literal('').transform(() => undefined)),
    POSTHOG_KEY: z.string().optional(),
    AXIOM_TOKEN: z.string().optional(),
    ENABLE_AUTO_SUBMIT: z.enum(['true', 'false']).default('false'),
    ENABLE_LINKEDIN_EXTENSION: z.enum(['true', 'false']).default('true'),
    DAILY_APPLICATION_CAP: z.coerce.number().int().positive().default(30),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    LLM_PRIVACY_MODE: process.env.LLM_PRIVACY_MODE,
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    SENTRY_DSN: process.env.SENTRY_DSN,
    POSTHOG_KEY: process.env.POSTHOG_KEY,
    AXIOM_TOKEN: process.env.AXIOM_TOKEN,
    ENABLE_AUTO_SUBMIT: process.env.ENABLE_AUTO_SUBMIT,
    ENABLE_LINKEDIN_EXTENSION: process.env.ENABLE_LINKEDIN_EXTENSION,
    DAILY_APPLICATION_CAP: process.env.DAILY_APPLICATION_CAP,
  },
  emptyStringAsUndefined: true,
  skipValidation: process.env['SKIP_ENV_VALIDATION'] === 'true',
});
