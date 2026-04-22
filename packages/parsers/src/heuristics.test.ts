import { describe, expect, it } from 'vitest';
import {
  extractContact,
  extractExperiences,
  extractSkills,
  heuristicWarnings,
} from './heuristics';
import { splitSections } from './split-sections';

const SAMPLE = [
  'Ada Lovelace',
  'ada@example.com | +1 415-555-0100',
  'https://linkedin.com/in/ada | https://github.com/ada | https://ada.dev',
  '',
  '# Summary',
  'Engineer with 7 years in distributed systems.',
  '',
  '# Experience',
  'Senior Engineer at Acme Corp',
  '- Led migration improving latency by 22%',
  '- Shipped service handling 10k qps',
  '',
  'Engineer at Foo Inc',
  '- Built auth layer in TypeScript',
  '',
  '# Skills',
  'TypeScript, React, Next.js, PostgreSQL, AWS, Docker, Playwright',
].join('\n');

describe('extractContact', () => {
  it('pulls name/email/phone/linkedin/github/portfolio', () => {
    const sections = splitSections(SAMPLE);
    const c = extractContact(sections);
    expect(c.full_name).toBe('Ada Lovelace');
    expect(c.email).toBe('ada@example.com');
    expect(c.phone).toContain('415');
    expect(c.linkedin_url).toMatch(/linkedin\.com\/in\/ada/);
    expect(c.github_url).toMatch(/github\.com\/ada/);
    expect(c.portfolio_url).toMatch(/ada\.dev/);
  });
});

describe('extractExperiences', () => {
  it('parses "<title> at <company>" and bullets', () => {
    const sections = splitSections(SAMPLE);
    const xp = extractExperiences(sections);
    expect(xp).toHaveLength(2);
    const acme = xp[0];
    expect(acme).toBeDefined();
    expect(acme?.company).toBe('Acme Corp');
    expect(acme?.title).toBe('Senior Engineer');
    expect(acme?.bullets).toHaveLength(2);
    expect(acme?.bullets[0]?.metric_candidates).toEqual(expect.arrayContaining(['22%']));
  });
});

describe('extractSkills', () => {
  it('splits comma-separated list and tags known categories', () => {
    const sections = splitSections(SAMPLE);
    const skills = extractSkills(sections);
    const ts = skills.find((s) => s.name === 'TypeScript');
    const pg = skills.find((s) => s.name === 'PostgreSQL');
    const aws = skills.find((s) => s.name === 'AWS');
    expect(ts?.category_guess).toBe('language');
    expect(pg?.category_guess).toBe('database');
    expect(aws?.category_guess).toBe('cloud');
  });
});

describe('heuristicWarnings', () => {
  it('warns when key fields are missing', () => {
    const warnings = heuristicWarnings({
      contact: {},
      experiences: [],
      skills: [],
    });
    expect(warnings).toHaveLength(3);
    expect(warnings.map((w) => w.stage)).toEqual(
      expect.arrayContaining(['extract', 'split']),
    );
  });
});
