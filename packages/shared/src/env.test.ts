import { describe, expect, it } from 'vitest';
import { loadWorkerEnv } from './env.js';

const baseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  GEMINI_API_KEY: 'g',
  ANTHROPIC_API_KEY: 'a',
} satisfies NodeJS.ProcessEnv;

describe('loadWorkerEnv', () => {
  it('applies defaults', () => {
    const env = loadWorkerEnv({ ...baseEnv });
    expect(env.WORKER_ID).toBe('worker-1');
    expect(env.ENABLE_AUTO_SUBMIT).toBe(false);
    expect(env.DAILY_APPLICATION_CAP).toBe(30);
  });

  it('fails with a readable error when a required key is missing', () => {
    expect(() => loadWorkerEnv({ ...baseEnv, ANTHROPIC_API_KEY: '' })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });
});
