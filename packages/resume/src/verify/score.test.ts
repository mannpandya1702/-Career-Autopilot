import { describe, expect, it } from 'vitest';
import type { ParserExtraction } from '@career-autopilot/parsers';
import type { TailoredResume } from '../schemas/resume';
import {
  expandKeywordVariants,
  scoreFormatCompliance,
  scoreKeywordCoverage,
  scoreParseAgreement,
  scoreVerification,
} from './score';

function ext(over: Partial<ParserExtraction>): ParserExtraction {
  return {
    parser: 'simple',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+1 415-555-0100',
    experience_titles: ['Senior Engineer'],
    companies: ['Acme'],
    skills: ['TypeScript', 'Postgres'],
    education: ['MIT'],
    detected_sections: ['experience', 'education', 'skills'],
    word_count: 600,
    has_multiple_columns: false,
    has_embedded_images: false,
    warnings: [],
    ...over,
  };
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
      bullets: ['Led migration to Postgres reducing latency by 22%.'],
    },
  ],
  projects: [],
  skills: { languages: ['TypeScript'], frameworks: [], tools: [], domains: [] },
  education: [{ institution: 'MIT', degree: 'BSc', field: 'CS', end_date: '2020-05' }],
  certifications: [],
  selections: { experience_ids_used: [], bullet_ids_used: [], alternate_variants_used: [] },
};

describe('scoreParseAgreement', () => {
  it('returns 100 when all parsers agree', () => {
    const e = [ext({ parser: 'simple' }), ext({ parser: 'pyresparser' }), ext({ parser: 'openresume' })];
    expect(scoreParseAgreement(e)).toBe(100);
  });

  it('drops when parsers disagree on names', () => {
    const e = [
      ext({ parser: 'simple' }),
      ext({ parser: 'pyresparser', name: 'Different Person' }),
      ext({ parser: 'openresume', name: 'Yet Another' }),
    ];
    expect(scoreParseAgreement(e)).toBeLessThan(100);
  });
});

describe('scoreKeywordCoverage', () => {
  it('returns 100 when every must-have appears somewhere', () => {
    const r = scoreKeywordCoverage(TAILORED, [ext({})], ['TypeScript', 'Postgres']);
    expect(r.score).toBe(100);
    expect(r.missing_keywords).toEqual([]);
  });

  it('lists missing keywords', () => {
    const r = scoreKeywordCoverage(TAILORED, [ext({})], ['TypeScript', 'Cassandra']);
    expect(r.score).toBe(50);
    expect(r.missing_keywords).toEqual(['Cassandra']);
  });

  it('expands acronym pairs', () => {
    const r = scoreKeywordCoverage(
      TAILORED,
      [ext({ skills: ['Kubernetes', 'TypeScript'] })],
      ['k8s'],
    );
    expect(r.score).toBe(100);
  });
});

describe('scoreFormatCompliance', () => {
  it('returns 100 for clean format', () => {
    expect(scoreFormatCompliance([ext({})]).score).toBe(100);
  });

  it('docks points for multi-column + missing experience heading', () => {
    const r = scoreFormatCompliance([
      ext({ has_multiple_columns: true, detected_sections: ['skills', 'education'] }),
    ]);
    expect(r.score).toBeLessThan(50);
    expect(r.issues.some((i) => /multi-column/i.test(i))).toBe(true);
    expect(r.issues.some((i) => /Experience/i.test(i))).toBe(true);
  });

  it('docks points for word counts outside 400-900', () => {
    expect(scoreFormatCompliance([ext({ word_count: 200 })]).score).toBe(90);
    expect(scoreFormatCompliance([ext({ word_count: 1200 })]).score).toBe(95);
  });
});

describe('scoreVerification', () => {
  it('produces a passed=true result when all components are high', () => {
    const e = [ext({ parser: 'simple' }), ext({ parser: 'pyresparser' }), ext({ parser: 'openresume' })];
    const r = scoreVerification({
      extractions: e,
      tailored: TAILORED,
      must_have_skills: ['TypeScript'],
    });
    expect(r.overall).toBeGreaterThanOrEqual(80);
    expect(r.passed).toBe(true);
  });

  it('fails when keyword coverage tanks', () => {
    const e = [ext({ parser: 'simple', skills: [] })];
    const r = scoreVerification({
      extractions: e,
      tailored: { ...TAILORED, skills: { languages: [], frameworks: [], tools: [], domains: [] } },
      must_have_skills: ['Cassandra', 'Cobol'],
    });
    expect(r.passed).toBe(false);
    expect(r.missing_keywords.length).toBe(2);
  });
});

describe('expandKeywordVariants', () => {
  it('returns the keyword unchanged by default', () => {
    expect(expandKeywordVariants('React')).toEqual(['React']);
  });

  it('splits "Foo Bar (FB)" into both forms', () => {
    expect(expandKeywordVariants('Search Engine Optimization (SEO)')).toEqual(
      expect.arrayContaining(['Search Engine Optimization (SEO)', 'Search Engine Optimization', 'SEO']),
    );
  });

  it('expands known acronym pairs', () => {
    expect(expandKeywordVariants('k8s')).toEqual(expect.arrayContaining(['k8s', 'kubernetes']));
  });
});
