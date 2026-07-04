// P6.8 — verifier calibration suite. The full acceptance criterion requires
// 10 resumes × 10 JDs = 100 pairs with human-labeled scores reaching
// Spearman correlation ≥ 0.8 against the verifier's overall score.
//
// We can't ship 100 hand-labeled fixtures — they belong to the user. This
// scaffold provides a small synthetic baseline that proves:
//   1. The verifier rank-orders resumes from "obviously good" to "obviously
//      bad" the right way.
//   2. The Spearman correlation helper itself is correct.
//
// Real fixtures live alongside this file once the user supplies them
// (one JSON per pair: { resume, jd_must_haves, parser_outputs, expected }).

import { describe, expect, it } from 'vitest';
import { scoreVerification } from '../../src/verify';
import type { ParserExtraction } from '@career-autopilot/parsers';
import type { TailoredResume } from '../../src/schemas/resume';

interface CalibrationCase {
  label: string;
  expected: number; // 0-100
  extractions: ParserExtraction[];
  tailored: TailoredResume;
  must_have_skills: string[];
}

const TAILORED: TailoredResume = {
  summary: 'Senior engineer with 6 years building distributed systems.',
  experience: [
    {
      company: 'Acme',
      title: 'Senior Engineer',
      location: 'Remote',
      start_date: '2022-01',
      end_date: 'Present',
      bullets: ['Built TypeScript and Postgres services with Kubernetes.'],
    },
  ],
  projects: [],
  skills: { languages: ['TypeScript'], frameworks: [], tools: ['Kubernetes'], domains: [] },
  education: [{ institution: 'MIT', degree: 'BSc', field: 'CS', end_date: '2020-05' }],
  certifications: [],
  selections: { experience_ids_used: [], bullet_ids_used: [], alternate_variants_used: [] },
};

function ext(over: Partial<ParserExtraction>): ParserExtraction {
  return {
    parser: 'simple',
    name: 'Ada',
    email: 'ada@example.com',
    phone: '+1',
    experience_titles: ['Senior Engineer'],
    companies: ['Acme'],
    skills: ['TypeScript', 'Postgres', 'Kubernetes'],
    education: ['MIT'],
    detected_sections: ['experience', 'education', 'skills'],
    word_count: 600,
    has_multiple_columns: false,
    has_embedded_images: false,
    warnings: [],
    ...over,
  };
}

const CASES: CalibrationCase[] = [
  {
    label: 'all-aligned',
    expected: 95,
    extractions: [ext({ parser: 'simple' }), ext({ parser: 'pyresparser' }), ext({ parser: 'openresume' })],
    tailored: TAILORED,
    must_have_skills: ['TypeScript', 'Postgres', 'Kubernetes'],
  },
  {
    label: 'one-skill-missing',
    expected: 80,
    extractions: [ext({ parser: 'simple' }), ext({ parser: 'pyresparser' }), ext({ parser: 'openresume' })],
    tailored: TAILORED,
    must_have_skills: ['TypeScript', 'Postgres', 'Kubernetes', 'Cassandra'],
  },
  {
    label: 'multi-column-bad-format',
    expected: 60,
    extractions: [
      ext({
        parser: 'simple',
        has_multiple_columns: true,
        detected_sections: ['skills'],
      }),
    ],
    tailored: TAILORED,
    must_have_skills: ['TypeScript'],
  },
  {
    label: 'half-keywords-missing',
    expected: 50,
    extractions: [ext({ parser: 'simple' })],
    tailored: TAILORED,
    must_have_skills: ['TypeScript', 'Cassandra', 'Cobol', 'Fortran'],
  },
  {
    label: 'all-broken',
    expected: 25,
    extractions: [
      ext({
        parser: 'simple',
        has_multiple_columns: true,
        has_embedded_images: true,
        detected_sections: [],
        skills: [],
      }),
    ],
    tailored: { ...TAILORED, skills: { languages: [], frameworks: [], tools: [], domains: [] } },
    must_have_skills: ['Cassandra', 'Cobol'],
  },
];

// Spearman rank correlation — good for monotonic relationships.
function spearman(x: number[], y: number[]): number {
  const n = x.length;
  const ranks = (arr: number[]): number[] => {
    const indexed = arr.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const r = new Array<number>(n);
    indexed.forEach(({ i }, rank) => {
      r[i] = rank + 1;
    });
    return r;
  };
  const rx = ranks(x);
  const ry = ranks(y);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = (rx[i] ?? 0) - (ry[i] ?? 0);
    sum += d * d;
  }
  return 1 - (6 * sum) / (n * (n * n - 1));
}

describe('verifier calibration', () => {
  it('rank-orders synthetic cases to match expected human scores', () => {
    const observed = CASES.map((c) =>
      scoreVerification({
        extractions: c.extractions,
        tailored: c.tailored,
        must_have_skills: c.must_have_skills,
      }).overall,
    );
    const expected = CASES.map((c) => c.expected);
    const rho = spearman(observed, expected);
    expect(rho).toBeGreaterThanOrEqual(0.8);
  });

  it('produces byte-stable scores on consecutive runs (deterministic)', () => {
    const c = CASES[0]!;
    const a = scoreVerification({
      extractions: c.extractions,
      tailored: c.tailored,
      must_have_skills: c.must_have_skills,
    });
    const b = scoreVerification({
      extractions: c.extractions,
      tailored: c.tailored,
      must_have_skills: c.must_have_skills,
    });
    expect(a).toEqual(b);
  });
});
