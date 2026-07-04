import { describe, expect, it } from 'vitest';
import type { ParserClient, ParserExtraction } from '@career-autopilot/parsers';
import type { TailoredResume } from '@career-autopilot/resume';
import { runVerifyJob } from './verify-job';

function fakeParser(
  name: ParserExtraction['parser'],
  result: Partial<ParserExtraction>,
): ParserClient {
  return {
    name,
    async parse(): Promise<ParserExtraction> {
      return {
        parser: name,
        name: 'Ada',
        email: 'ada@example.com',
        phone: '+1',
        experience_titles: ['Senior Engineer'],
        companies: ['Acme'],
        skills: ['TypeScript'],
        education: ['MIT'],
        detected_sections: ['experience', 'education', 'skills'],
        word_count: 600,
        has_multiple_columns: false,
        has_embedded_images: false,
        warnings: [],
        ...result,
      };
    },
  };
}

const TAILORED: TailoredResume = {
  summary: 'Senior engineer with 6 years.',
  experience: [
    {
      company: 'Acme',
      title: 'Senior Engineer',
      location: 'Remote',
      start_date: '2022-01',
      end_date: 'Present',
      bullets: ['Built TypeScript services.'],
    },
  ],
  projects: [],
  skills: { languages: ['TypeScript'], frameworks: [], tools: [], domains: [] },
  education: [{ institution: 'MIT', degree: 'BSc', field: 'CS', end_date: '2020-05' }],
  certifications: [],
  selections: { experience_ids_used: [], bullet_ids_used: [], alternate_variants_used: [] },
};

describe('runVerifyJob', () => {
  it('returns passed=true and no regeneration on a clean resume', async () => {
    const parsers = [
      fakeParser('simple', {}),
      fakeParser('pyresparser', {}),
      fakeParser('openresume', {}),
    ];
    const r = await runVerifyJob({
      pdfBuffer: Buffer.from(''),
      parsers,
      tailored: TAILORED,
      must_have_skills: ['TypeScript'],
      prior_regenerations: 0,
    });
    expect(r.score.passed).toBe(true);
    expect(r.should_regenerate).toBe(false);
    expect(r.feedback).toBeNull();
    expect(r.parser_results['simple']).toBeDefined();
  });

  it('triggers regeneration when score drops below threshold', async () => {
    const parsers = [
      fakeParser('simple', { has_multiple_columns: true, detected_sections: [] }),
    ];
    const r = await runVerifyJob({
      pdfBuffer: Buffer.from(''),
      parsers,
      tailored: TAILORED,
      must_have_skills: ['Cassandra', 'Cobol'],
      prior_regenerations: 0,
    });
    expect(r.score.passed).toBe(false);
    expect(r.should_regenerate).toBe(true);
    expect(r.feedback).toContain('Cassandra');
  });

  it('does not trigger regeneration past the regen budget', async () => {
    const parsers = [
      fakeParser('simple', { has_multiple_columns: true, detected_sections: [] }),
    ];
    const r = await runVerifyJob({
      pdfBuffer: Buffer.from(''),
      parsers,
      tailored: TAILORED,
      must_have_skills: ['Cassandra'],
      prior_regenerations: 2,
    });
    expect(r.score.passed).toBe(false);
    expect(r.should_regenerate).toBe(false);
    expect(r.feedback).toBeNull();
  });

  it('records parser failures in parser_results', async () => {
    const failing: ParserClient = {
      name: 'pyresparser',
      async parse() {
        throw new Error('service down');
      },
    };
    const parsers = [fakeParser('simple', {}), failing];
    const r = await runVerifyJob({
      pdfBuffer: Buffer.from(''),
      parsers,
      tailored: TAILORED,
      must_have_skills: ['TypeScript'],
      prior_regenerations: 0,
    });
    expect((r.parser_results['pyresparser'] as { error?: string }).error).toContain('service down');
  });
});
