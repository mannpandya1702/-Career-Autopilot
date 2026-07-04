import { describe, expect, it } from 'vitest';
import { LlmRouter } from './router';
import { makeStubProvider } from './providers/stub';
import { jdParsePrompt } from './prompts/jd-parse/v1';
import { fitJudgePrompt } from './prompts/fit-judge/v1';
import type { CallRecord } from './types';

describe('LlmRouter.call', () => {
  it('dispatches to the configured provider and validates output', async () => {
    const jdPayload = {
      must_have_skills: ['TypeScript'],
      nice_to_have_skills: [],
      required_years_experience: 3,
      required_education: null,
      role_seniority: 'senior' as const,
      work_authorization_required: null,
      tech_stack: ['TypeScript'],
      industry_domain: null,
      red_flags: [],
      keywords: ['typescript'],
      acronyms: [],
    };
    const gemini = makeStubProvider('gemini', {
      generate: { 'jd.parse': jdPayload },
    });
    const records: CallRecord[] = [];
    const router = new LlmRouter({
      providers: { gemini },
      sink: (r) => {
        records.push(r);
      },
    });

    const result = await router.call(jdParsePrompt, {
      title: 'Senior Engineer',
      company: 'Acme',
      jd_text: 'Need someone with TypeScript.',
    });

    expect(result.must_have_skills).toEqual(['TypeScript']);
    expect(records).toHaveLength(1);
    expect(records[0]?.task).toBe('jd.parse');
    expect(records[0]?.success).toBe(true);
    expect(records[0]?.provider).toBe('gemini');
  });

  it('retries once on invalid output, then throws', async () => {
    const gemini = makeStubProvider('gemini', {
      // Always returns {} — schema requires 10 fields, so this fails twice.
      generate: { 'jd.parse': {} },
    });
    const records: CallRecord[] = [];
    const router = new LlmRouter({
      providers: { gemini },
      sink: (r) => {
        records.push(r);
      },
    });

    await expect(
      router.call(jdParsePrompt, {
        title: 'Engineer',
        company: 'Acme',
        jd_text: 'Some JD',
      }),
    ).rejects.toThrow(/schema validation/);

    // Two attempts, both recorded as !success.
    expect(records).toHaveLength(2);
    expect(records.every((r) => !r.success)).toBe(true);
    expect(records.every((r) => r.errorCode === 'invalid_output')).toBe(true);
  });

  it('throws when provider is not configured', async () => {
    const router = new LlmRouter({ providers: {} });
    await expect(
      router.call(fitJudgePrompt, {
        profile_summary: 'x',
        profile_years: 3,
        parsed_jd: {
          must_have_skills: [],
          nice_to_have_skills: [],
          required_years_experience: null,
          required_education: null,
          role_seniority: 'mid',
          work_authorization_required: null,
          tech_stack: [],
          industry_domain: null,
          red_flags: [],
          keywords: [],
          acronyms: [],
        },
        hard_filter_failures: [],
      }),
    ).rejects.toThrow(/No provider configured/);
  });
});

describe('LlmRouter.embed', () => {
  it('delegates to the provider embedder', async () => {
    const gemini = makeStubProvider('gemini');
    const router = new LlmRouter({ providers: { gemini } });
    const vec = await router.embed('gemini', 'hello world', 'text-embedding-004');
    expect(vec).toHaveLength(768);
  });
});
