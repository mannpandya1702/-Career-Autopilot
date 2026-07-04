import { describe, expect, it } from 'vitest';
import type { TailoredResume } from '../schemas/resume';
import { checkConsistency } from './consistency';

const TAILORED: TailoredResume = {
  summary: 'Senior engineer with 6 years building distributed systems.',
  experience: [
    {
      company: 'Acme',
      title: 'Senior Engineer',
      location: 'Remote',
      start_date: '2022-01',
      end_date: 'Present',
      bullets: [
        'Led migration to Postgres reducing latency by 22%.',
        'Saved $180K annually by replacing the legacy queue.',
      ],
    },
  ],
  projects: [],
  skills: { languages: ['TypeScript'], frameworks: [], tools: [], domains: [] },
  education: [{ institution: 'MIT', degree: 'BSc', field: 'CS', end_date: '2020-05' }],
  certifications: [],
  selections: { experience_ids_used: [], bullet_ids_used: [], alternate_variants_used: [] },
};

describe('checkConsistency', () => {
  it('passes when answers reuse resume metrics', () => {
    const r = checkConsistency(
      TAILORED,
      [
        {
          question_text: 'How many years of experience do you have?',
          answer_text: 'I have 6 years of experience.',
        },
      ],
      null,
    );
    expect(r.ok).toBe(true);
  });

  it('flags an inconsistent years claim', () => {
    const r = checkConsistency(
      TAILORED,
      [
        {
          question_text: 'How many years of experience do you have?',
          answer_text: 'I have 10 years of experience.',
        },
      ],
      null,
    );
    expect(r.ok).toBe(false);
    expect(r.violations[0]).toMatch(/10 years/);
  });

  it('flags an invented percent in the cover letter', () => {
    const r = checkConsistency(TAILORED, [], {
      body: 'I improved query latency by 99% which transformed our infrastructure.',
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.includes('99'))).toBe(true);
  });

  it('flags an invented dollar metric', () => {
    const r = checkConsistency(TAILORED, [], {
      body: 'Saved $500k by rewriting our data pipeline.',
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.includes('500'))).toBe(true);
  });
});
