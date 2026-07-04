import { describe, expect, it } from 'vitest';
import type { RenderHeader, TailoredResume } from '../schemas/resume';
import { buildLatex, escapeLatex } from './latex';
import { renderDocx } from './docx';
import { renderPdf, stubLatexCompiler } from './pdf';

const HEADER: RenderHeader = {
  full_name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+1 415-555-0100',
  location: 'San Francisco, CA',
  linkedin_url: 'https://linkedin.com/in/ada',
  github_url: 'https://github.com/ada',
  portfolio_url: null,
};

const RESUME: TailoredResume = {
  summary: 'Senior engineer with 6+ years building distributed systems.',
  experience: [
    {
      company: 'Acme & Co',
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
  projects: [
    {
      name: 'Open-source Tool',
      role: 'Maintainer',
      tech: ['TypeScript', 'Vite'],
      bullets: ['Designed plugin system used by 1000+ developers.'],
      url: 'https://example.com/tool',
    },
  ],
  skills: {
    languages: ['TypeScript', 'Python'],
    frameworks: ['React'],
    tools: ['Docker'],
    domains: ['Distributed Systems'],
  },
  education: [
    { institution: 'MIT', degree: 'BSc', field: 'CS', end_date: '2020-05' },
  ],
  certifications: ['AWS Solutions Architect'],
  selections: {
    experience_ids_used: ['exp-1'],
    bullet_ids_used: ['b-1', 'b-2'],
    alternate_variants_used: [],
  },
};

describe('escapeLatex', () => {
  it('escapes special characters', () => {
    expect(escapeLatex('Acme & Co')).toBe('Acme \\& Co');
    expect(escapeLatex('100%')).toBe('100\\%');
    expect(escapeLatex('a_b#c')).toBe('a\\_b\\#c');
  });
});

describe('buildLatex', () => {
  it('produces a complete \\documentclass document with our placeholders filled', () => {
    const tex = buildLatex(RESUME, HEADER);
    expect(tex).toContain('\\documentclass[11pt,letterpaper]{article}');
    expect(tex).toContain('\\textbf{ Ada Lovelace }');
    expect(tex).toContain('ada@example.com');
    // Special chars escaped:
    expect(tex).toContain('Acme \\& Co');
    expect(tex).toContain('22\\%');
    // Sections present:
    expect(tex).toContain('\\section*{Summary}');
    expect(tex).toContain('\\section*{Experience}');
    expect(tex).toContain('\\section*{Skills}');
    expect(tex).toContain('\\section*{Projects}');
    expect(tex).toContain('\\section*{Certifications}');
  });

  it('omits Projects + Certifications sections when empty', () => {
    const lean = { ...RESUME, projects: [], certifications: [] };
    const tex = buildLatex(lean, HEADER);
    expect(tex).not.toContain('\\section*{Projects}');
    expect(tex).not.toContain('\\section*{Certifications}');
  });
});

describe('renderPdf with stub compiler', () => {
  it('returns a buffer that begins with the PDF magic prefix', async () => {
    const buf = await renderPdf({
      resume: RESUME,
      header: HEADER,
      compiler: stubLatexCompiler,
    });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('renderDocx', () => {
  it('produces a non-empty .docx (zip) buffer', async () => {
    const buf = await renderDocx(RESUME, HEADER);
    expect(buf.length).toBeGreaterThan(1000);
    // .docx is a zip — magic bytes "PK".
    expect(buf.subarray(0, 2).toString('binary')).toBe('PK');
  });
});
