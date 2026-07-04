import { describe, expect, it } from 'vitest';
import { LlmRouter, makeStubProvider } from '@career-autopilot/llm';
import type { MasterProfile, TailoredResume } from '@career-autopilot/resume';
import { runTailorPipeline } from './tailor-job';

const NOW = new Date().toISOString();

const MASTER: MasterProfile = {
  profile: {
    id: '11111111-1111-1111-1111-111111111111',
    user_id: '22222222-2222-2222-2222-222222222222',
    full_name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: null,
    location: null,
    linkedin_url: null,
    github_url: null,
    portfolio_url: null,
    headline: null,
    summary: null,
    derived_summary: null,
    visa_status: null,
    work_authorization: null,
    years_experience: 6,
    created_at: NOW,
    updated_at: NOW,
  },
  experiences: [
    {
      id: 'exp-1',
      user_id: '22222222-2222-2222-2222-222222222222',
      profile_id: '11111111-1111-1111-1111-111111111111',
      company: 'Acme',
      title: 'Senior Engineer',
      location: 'Remote',
      work_mode: 'remote',
      start_date: '2022-01-01',
      end_date: null,
      is_current: true,
      description: null,
      tech_stack: null,
      ord: 0,
      created_at: NOW,
      updated_at: NOW,
      bullets: [
        {
          id: 'b-1',
          user_id: '22222222-2222-2222-2222-222222222222',
          experience_id: 'exp-1',
          text: 'Led migration to Postgres reducing latency by 22%.',
          metrics: null,
          skill_tags: null,
          story_id: null,
          ord: 0,
          created_at: NOW,
          updated_at: NOW,
        },
      ],
    },
  ],
  projects: [],
  skills: [
    {
      id: 's1',
      user_id: '22222222-2222-2222-2222-222222222222',
      name: 'TypeScript',
      category: 'language',
      proficiency: 5,
      years_experience: 6,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  education: [
    {
      id: 'e-1',
      user_id: '22222222-2222-2222-2222-222222222222',
      profile_id: '11111111-1111-1111-1111-111111111111',
      institution: 'MIT',
      degree: 'BSc',
      field: 'CS',
      start_date: '2016-09-01',
      end_date: '2020-05-01',
      gpa: null,
      coursework: null,
      honors: null,
      ord: 0,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
};

const HONEST_OUTPUT: TailoredResume = {
  summary: 'Senior engineer with 6 years building distributed systems.',
  experience: [
    {
      company: 'Acme',
      title: 'Senior Engineer',
      location: 'Remote',
      start_date: '2022-01',
      end_date: 'Present',
      bullets: ['Led migration to Postgres reducing latency by 22%.'],
    },
  ],
  projects: [],
  skills: { languages: ['TypeScript'], frameworks: [], tools: [], domains: [] },
  education: [
    { institution: 'MIT', degree: 'BSc', field: 'CS', end_date: '2020-05' },
  ],
  certifications: [],
  selections: {
    experience_ids_used: ['exp-1'],
    bullet_ids_used: ['b-1'],
    alternate_variants_used: [],
  },
};

describe('runTailorPipeline', () => {
  it('returns the result on first attempt when honesty passes', async () => {
    const anthropic = makeStubProvider('anthropic', {
      generate: { 'tailor.resume': HONEST_OUTPUT },
    });
    const router = new LlmRouter({ providers: { anthropic } });
    const result = await runTailorPipeline(router, {
      master: MASTER,
      parsed_jd: {},
      raw_jd_text: 'JD body',
      company_name: 'Globex',
    });
    expect(result.honesty_check_passed).toBe(true);
    expect(result.regeneration_count).toBe(0);
    expect(result.llm_model).toBe('claude-haiku-4-5-20251001');
    expect(result.resume.summary).toContain('Senior engineer');
  });

  it('escalates to Sonnet after two Haiku honesty failures', async () => {
    const dishonest: TailoredResume = {
      ...HONEST_OUTPUT,
      experience: [
        {
          ...HONEST_OUTPUT.experience[0]!,
          bullets: ['Led migration to Cassandra reducing latency by 22%.'],
        },
      ],
    };
    let calls = 0;
    const provider = {
      name: 'anthropic' as const,
      async generate(req: { task: string }) {
        calls += 1;
        const payload = req.task === 'tailor.hard' ? HONEST_OUTPUT : dishonest;
        return {
          text: JSON.stringify(payload),
          tokensIn: 1,
          tokensOut: 1,
          cachedTokens: 0,
          latencyMs: 1,
          rawModel: 'stub',
        };
      },
    };
    const router = new LlmRouter({ providers: { anthropic: provider } });

    const result = await runTailorPipeline(router, {
      master: MASTER,
      parsed_jd: {},
      raw_jd_text: 'JD body',
      company_name: 'Globex',
    });
    expect(calls).toBe(3); // two haiku + one sonnet
    expect(result.regeneration_count).toBe(2);
    expect(result.llm_model).toBe('claude-sonnet-4-6');
    expect(result.honesty_check_passed).toBe(true);
  });
});
