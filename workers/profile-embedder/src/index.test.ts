import { describe, expect, it } from 'vitest';
import type { Profile, Experience, ExperienceBullet, Skill } from '@career-autopilot/resume';
import { computeProfileEmbedding, heuristicSummarizer, stubEmbedder } from './index';
import { toPgVectorLiteral } from './embed';

const now = new Date().toISOString();

const PROFILE: Profile = {
  id: '11111111-1111-1111-1111-111111111111',
  user_id: '22222222-2222-2222-2222-222222222222',
  full_name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: null,
  location: null,
  linkedin_url: null,
  github_url: null,
  portfolio_url: null,
  headline: 'Distributed systems engineer.',
  summary: null,
  derived_summary: null,
  visa_status: null,
  work_authorization: null,
  years_experience: 5,
  created_at: now,
  updated_at: now,
};

const EXPERIENCES: (Experience & { bullets: ExperienceBullet[] })[] = [
  {
    id: '33333333-3333-3333-3333-333333333333',
    user_id: PROFILE.user_id,
    profile_id: PROFILE.id,
    company: 'Acme',
    title: 'Senior Engineer',
    location: null,
    work_mode: 'remote',
    start_date: '2022-01-01',
    end_date: null,
    is_current: true,
    description: null,
    tech_stack: null,
    ord: 0,
    bullets: [],
    created_at: now,
    updated_at: now,
  },
];

const SKILLS: Skill[] = [
  {
    id: '44444444-4444-4444-4444-444444444444',
    user_id: PROFILE.user_id,
    name: 'TypeScript',
    category: 'language',
    proficiency: 5,
    years_experience: 5,
    created_at: now,
    updated_at: now,
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    user_id: PROFILE.user_id,
    name: 'React',
    category: 'framework',
    proficiency: 5,
    years_experience: 5,
    created_at: now,
    updated_at: now,
  },
];

describe('heuristicSummarizer', () => {
  it('produces a non-empty summary without raw PII tokens', async () => {
    const out = await heuristicSummarizer.summarize({
      profile: PROFILE,
      experiences: EXPERIENCES,
      skills: SKILLS,
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toContain('ada@example.com');
    expect(out).toContain('Senior Engineer');
    expect(out).toMatch(/TypeScript|React/);
  });
});

describe('stubEmbedder', () => {
  it('returns a 768-dim unit vector', async () => {
    const vec = await stubEmbedder.embed('hello world');
    expect(vec).toHaveLength(768);
    const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0));
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });
});

describe('computeProfileEmbedding', () => {
  it('returns derived_summary + 768-dim embedding', async () => {
    const result = await computeProfileEmbedding(
      { profile: PROFILE, experiences: EXPERIENCES, skills: SKILLS },
      { embedder: stubEmbedder },
    );
    expect(result.derived_summary.length).toBeGreaterThan(10);
    expect(result.summary_embedding).toHaveLength(768);
  });

  it('throws when embedder returns wrong dimensions', async () => {
    await expect(
      computeProfileEmbedding(
        { profile: PROFILE, experiences: EXPERIENCES, skills: SKILLS },
        {
          embedder: {
            dimension: 768,
            async embed() {
              return [1, 2, 3];
            },
          },
        },
      ),
    ).rejects.toThrow(/expected 768/);
  });
});

describe('toPgVectorLiteral', () => {
  it('serialises to pgvector format', () => {
    expect(toPgVectorLiteral([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]');
  });
});
