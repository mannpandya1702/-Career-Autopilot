import { describe, expect, it } from 'vitest';
import { LlmRouter, makeStubProvider } from '@career-autopilot/llm';
import type { HardFilterInput } from '@career-autopilot/resume';
import { scoreJob, canonicalJdForEmbedding } from './score-job';

const PREFS: HardFilterInput['preferences'] = {
  experience_levels: ['senior'],
  work_modes: ['remote', 'hybrid'],
  job_types: ['full_time'],
  salary_min: 100_000,
  salary_currency: 'USD',
  locations: null,
  remote_anywhere: true,
  industries_exclude: null,
  willing_to_relocate: false,
};

function baseJob() {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Senior Engineer',
    description: 'Senior TypeScript role. Full-time, remote.',
    location: null,
    remote_policy: 'remote' as const,
    salary_min: 140_000,
    salary_max: 180_000,
    salary_currency: 'USD',
    company_name: 'Acme',
  };
}

const PROFILE = {
  summary: 'Senior TypeScript engineer with 6 years of experience.',
  years_experience: 6,
  // Simple 768-dim vector; doesn't need to be semantically meaningful for tests.
  embedding: new Array<number>(768).fill(1 / Math.sqrt(768)),
};

describe('scoreJob', () => {
  it('short-circuits to rejected on hard filter failure', async () => {
    const router = new LlmRouter({
      providers: { gemini: makeStubProvider('gemini') },
    });
    const job = { ...baseJob(), salary_max: 50_000 }; // below floor
    const result = await scoreJob(router, {
      job,
      preferences: PREFS,
      profile: PROFILE,
      profile_version_hash: 'h1',
    });
    expect(result.hard_filter_pass).toBe(false);
    expect(result.tier).toBe('rejected');
    expect(result.parsed_jd).toBeNull();
    expect(result.semantic_score).toBeNull();
    expect(result.judgment).toBeNull();
  });

  it('runs the full pipeline when hard filter passes', async () => {
    // Stub Gemini to return well-formed outputs for both LLM tasks.
    const gemini = makeStubProvider('gemini', {
      generate: {
        'jd.parse': {
          must_have_skills: ['TypeScript'],
          nice_to_have_skills: [],
          required_years_experience: 5,
          required_education: null,
          role_seniority: 'senior',
          work_authorization_required: null,
          tech_stack: ['TypeScript'],
          industry_domain: null,
          red_flags: [],
          keywords: ['typescript'],
          acronyms: [],
        },
        'fit.judge': {
          overall_score: 88,
          dimensions: {
            skills: 95,
            experience: 90,
            domain: 80,
            seniority: 90,
            logistics: 85,
          },
          must_have_gaps: [],
          nice_to_have_matches: ['TypeScript'],
          reasoning: 'Strong fit on skills and seniority.',
        },
      },
    });
    const router = new LlmRouter({ providers: { gemini } });

    const result = await scoreJob(router, {
      job: baseJob(),
      preferences: PREFS,
      profile: PROFILE,
      profile_version_hash: 'h1',
    });
    expect(result.hard_filter_pass).toBe(true);
    expect(result.parsed_jd?.must_have_skills).toEqual(['TypeScript']);
    expect(result.jd_embedding).toHaveLength(768);
    expect(result.semantic_score).toBeGreaterThan(0);
    expect(result.judgment?.overall_score).toBe(88);
    expect(result.overall_score).toBe(88);
    expect(result.tier).toBe('pending_review');
  });

  it('skips fit.judge when semantic score is below threshold', async () => {
    // Orthogonal profile vs. JD vectors → semantic ≈ 0.5 which is below the
    // 0.55 threshold. We control that by stubbing the embedder to return a
    // vector orthogonal to the profile.
    const orthogonal = new Array<number>(768).fill(0);
    orthogonal[0] = 1;
    const gemini = makeStubProvider('gemini', {
      generate: {
        'jd.parse': {
          must_have_skills: [],
          nice_to_have_skills: [],
          required_years_experience: null,
          required_education: null,
          role_seniority: 'senior',
          work_authorization_required: null,
          tech_stack: [],
          industry_domain: null,
          red_flags: [],
          keywords: [],
          acronyms: [],
        },
      },
      embed: orthogonal,
    });
    const router = new LlmRouter({ providers: { gemini } });

    const result = await scoreJob(router, {
      job: baseJob(),
      preferences: PREFS,
      profile: {
        ...PROFILE,
        // Profile vector orthogonal to the JD vector.
        embedding: new Array<number>(768)
          .fill(0)
          .map((_, i) => (i === 1 ? 1 : 0)),
      },
      profile_version_hash: 'h1',
    });
    expect(result.judgment).toBeNull();
    expect(result.overall_score).toBeLessThanOrEqual(70);
    expect(result.tier).toBe('low_fit');
  });
});

describe('canonicalJdForEmbedding', () => {
  it('truncates descriptions over 300 words', () => {
    const words = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    const out = canonicalJdForEmbedding('Title', words, ['TS']);
    const body = out.split('\n\n')[1] ?? '';
    expect(body.split(/\s+/)).toHaveLength(300);
  });

  it('includes title + must-have skills verbatim', () => {
    const out = canonicalJdForEmbedding('Senior Eng', 'short jd', ['Go', 'k8s']);
    expect(out).toContain('Title: Senior Eng');
    expect(out).toContain('Skills: Go, k8s');
  });
});
