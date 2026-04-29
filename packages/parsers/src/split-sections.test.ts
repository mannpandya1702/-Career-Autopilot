import { describe, expect, it } from 'vitest';
import { splitSections } from './split-sections';

describe('splitSections', () => {
  it('splits on markdown headings and classifies known labels', () => {
    const md = [
      'Ada Lovelace',
      'ada@example.com',
      '',
      '# Summary',
      'Engineer with 5 years.',
      '',
      '## Experience',
      'Acme — Engineer',
      '- Did thing',
      '',
      '## Skills',
      'TypeScript, React, Postgres',
    ].join('\n');

    const sections = splitSections(md);
    const labels = sections.map((s) => s.label);
    expect(labels).toContain('contact');
    expect(labels).toContain('summary');
    expect(labels).toContain('experience');
    expect(labels).toContain('skills');
  });

  it('detects ALL CAPS headings when followed by blank line', () => {
    const md = [
      'Jane Doe',
      'jane@example.com',
      '',
      'EXPERIENCE',
      '',
      'Acme — Engineer',
      '- Shipped.',
    ].join('\n');

    const sections = splitSections(md);
    expect(sections.some((s) => s.label === 'experience')).toBe(true);
  });

  it('normalises heading aliases', () => {
    const md = ['# Professional Summary', 'text', '# Technical Skills', 'TS, React'].join('\n');
    const sections = splitSections(md);
    expect(sections.find((s) => s.raw_heading === 'Professional Summary')?.label).toBe('summary');
    expect(sections.find((s) => s.raw_heading === 'Technical Skills')?.label).toBe('skills');
  });
});
