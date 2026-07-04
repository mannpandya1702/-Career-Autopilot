import { describe, expect, it } from 'vitest';
import { EnrichmentSchema, mergeEnrichment, noopEnricher } from './enrich';
import type { ParsedResume } from './types';

const BASE: ParsedResume = {
  source: 'resume_pdf',
  contact: { full_name: 'Ada', email: 'ada@example.com' },
  experiences: [
    {
      company: 'Acme',
      title: 'Engineer',
      bullets: [{ text: 'shipped' }],
    },
  ],
  projects: [],
  education: [],
  skills: [{ name: 'TypeScript', category_guess: 'language' }],
  raw_markdown: '',
  warnings: [],
};

describe('noopEnricher', () => {
  it('returns empty enrichment', async () => {
    await expect(
      noopEnricher.enrich({ heuristic: BASE, raw_sections: [] }),
    ).resolves.toEqual({});
  });
});

describe('EnrichmentSchema', () => {
  it('rejects malformed date', () => {
    const result = EnrichmentSchema.safeParse({
      experiences: [{ company: 'A', title: 'T', start_date: '2024/01/01' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts well-formed enrichment', () => {
    const result = EnrichmentSchema.safeParse({
      contact: { full_name: 'Ada', email: 'ada@example.com' },
      experiences: [{ company: 'Acme', title: 'Engineer', start_date: '2020-01-01', end_date: null }],
    });
    expect(result.success).toBe(true);
  });
});

describe('mergeEnrichment', () => {
  it('overlays contact fields without clobbering existing ones', () => {
    const merged = mergeEnrichment(BASE, {
      contact: { location: 'Bangalore' },
    });
    expect(merged.contact.full_name).toBe('Ada');
    expect(merged.contact.email).toBe('ada@example.com');
    expect(merged.contact.location).toBe('Bangalore');
  });

  it('adds dates to matching experience', () => {
    const merged = mergeEnrichment(BASE, {
      experiences: [
        {
          company: 'Acme',
          title: 'Engineer',
          start_date: '2020-01-01',
          end_date: '2024-01-01',
        },
      ],
    });
    expect(merged.experiences[0]?.start_date).toBe('2020-01-01');
    expect(merged.experiences[0]?.end_date).toBe('2024-01-01');
    // Bullets from base preserved when LLM omits them.
    expect(merged.experiences[0]?.bullets).toHaveLength(1);
  });

  it('deduplicates skills by lowercase name and keeps category_guess', () => {
    const merged = mergeEnrichment(BASE, {
      skills: [
        { name: 'typescript', category_guess: 'language' },
        { name: 'React', category_guess: 'framework' },
      ],
    });
    const names = merged.skills.map((s) => s.name.toLowerCase()).sort();
    expect(names).toEqual(['react', 'typescript']);
    expect(merged.skills.find((s) => s.name.toLowerCase() === 'react')?.category_guess).toBe(
      'framework',
    );
  });
});
