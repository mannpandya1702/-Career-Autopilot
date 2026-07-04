import { describe, expect, it } from 'vitest';
import type {
  Education,
  Experience,
  ExperienceBullet,
  Profile,
  Skill,
} from '../schemas/profile';
import type { TailoredResume } from '../schemas/resume';
import { honestyCheck, type MasterProfile } from './honesty';

const NOW = new Date().toISOString();

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
  headline: null,
  summary: null,
  derived_summary: null,
  visa_status: null,
  work_authorization: null,
  years_experience: 6,
  created_at: NOW,
  updated_at: NOW,
};

const MASTER_EXP: Experience & { bullets: ExperienceBullet[] } = {
  id: 'exp-1',
  user_id: PROFILE.user_id,
  profile_id: PROFILE.id,
  company: 'Acme',
  title: 'Senior Engineer',
  location: 'Remote',
  work_mode: 'remote',
  start_date: '2022-01-01',
  end_date: null,
  is_current: true,
  description: null,
  tech_stack: ['TypeScript'],
  ord: 0,
  created_at: NOW,
  updated_at: NOW,
  bullets: [
    {
      id: 'b-1',
      user_id: PROFILE.user_id,
      experience_id: 'exp-1',
      text: 'Led migration to Postgres reducing query latency by 22%.',
      metrics: { latency_pct: 22 },
      skill_tags: ['Postgres'],
      story_id: null,
      ord: 0,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: 'b-2',
      user_id: PROFILE.user_id,
      experience_id: 'exp-1',
      text: 'Shipped auth service handling 10k qps using TypeScript and Redis.',
      metrics: { qps: 10000 },
      skill_tags: ['TypeScript', 'Redis'],
      story_id: null,
      ord: 1,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
};

const SKILLS: Skill[] = [
  { id: 's1', user_id: PROFILE.user_id, name: 'TypeScript', category: 'language', proficiency: 5, years_experience: 6, created_at: NOW, updated_at: NOW },
  { id: 's2', user_id: PROFILE.user_id, name: 'Postgres', category: 'database', proficiency: 4, years_experience: 5, created_at: NOW, updated_at: NOW },
  { id: 's3', user_id: PROFILE.user_id, name: 'Redis', category: 'database', proficiency: 4, years_experience: 4, created_at: NOW, updated_at: NOW },
];

const EDU: Education[] = [
  {
    id: 'e-1',
    user_id: PROFILE.user_id,
    profile_id: PROFILE.id,
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
];

const MASTER: MasterProfile = {
  profile: PROFILE,
  experiences: [MASTER_EXP],
  projects: [],
  skills: SKILLS,
  education: EDU,
};

const baseTailored: TailoredResume = {
  summary: 'Senior engineer with 6 years building distributed systems.',
  experience: [
    {
      company: 'Acme',
      title: 'Senior Engineer',
      location: 'Remote',
      start_date: '2022-01',
      end_date: 'Present',
      bullets: [
        'Led migration to Postgres reducing query latency by 22%.',
        'Shipped auth service handling 10k qps using TypeScript and Redis.',
      ],
    },
  ],
  projects: [],
  skills: {
    languages: ['TypeScript'],
    frameworks: [],
    tools: [],
    domains: [],
  },
  education: [
    { institution: 'MIT', degree: 'BSc', field: 'CS', end_date: '2020-05' },
  ],
  certifications: [],
  selections: {
    experience_ids_used: ['exp-1'],
    bullet_ids_used: ['b-1', 'b-2'],
    alternate_variants_used: [],
  },
};

describe('honestyCheck', () => {
  it('passes when every claim is supported', () => {
    const r = honestyCheck(baseTailored, MASTER);
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('flags an experience the master profile does not have', () => {
    const t = structuredClone(baseTailored);
    t.experience[0]!.company = 'Globex';
    const r = honestyCheck(t, MASTER);
    expect(r.ok).toBe(false);
    expect(r.violations[0]).toMatch(/Globex/);
  });

  it('flags a skill not in the master profile', () => {
    const t = structuredClone(baseTailored);
    t.skills.frameworks.push('Kubernetes');
    const r = honestyCheck(t, MASTER);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.includes('Kubernetes'))).toBe(true);
  });

  it('flags an invented metric', () => {
    const t = structuredClone(baseTailored);
    t.experience[0]!.bullets[0] =
      'Led migration to Postgres reducing query latency by 99%.';
    const r = honestyCheck(t, MASTER);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.includes('99%'))).toBe(true);
  });

  it('flags an invented capitalised entity', () => {
    const t = structuredClone(baseTailored);
    t.experience[0]!.bullets[1] =
      'Shipped auth service handling 10k qps using TypeScript and Cassandra.';
    const r = honestyCheck(t, MASTER);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.includes('Cassandra'))).toBe(true);
  });

  it('flags education that does not match master', () => {
    const t = structuredClone(baseTailored);
    t.education[0]!.institution = 'Stanford';
    const r = honestyCheck(t, MASTER);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.includes('Stanford'))).toBe(true);
  });

  it('flags dates outside the master range', () => {
    const t = structuredClone(baseTailored);
    t.experience[0]!.start_date = '2018-01';
    const r = honestyCheck(t, MASTER);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.includes('Dates'))).toBe(true);
  });
});
