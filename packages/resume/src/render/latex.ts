// Build the LaTeX source for a TailoredResume against the ats-safe template.
// All user-supplied strings flow through escapeLatex() — never spliced raw.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RenderHeader, TailoredResume } from '../schemas/resume';

const TEMPLATE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'templates',
  'ats-safe.tex',
);

let TEMPLATE_CACHE: string | null = null;
function loadTemplate(): string {
  if (TEMPLATE_CACHE === null) {
    TEMPLATE_CACHE = readFileSync(TEMPLATE_PATH, 'utf8');
  }
  return TEMPLATE_CACHE;
}

// LaTeX special chars that must be escaped to be rendered as plain text.
const ESCAPE_MAP: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '&': '\\&',
  '%': '\\%',
  $: '\\$',
  '#': '\\#',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

export function escapeLatex(input: string): string {
  return input.replace(/[\\&%$#_{}~^]/g, (c) => ESCAPE_MAP[c] ?? c);
}

export function buildLatex(
  resume: TailoredResume,
  header: RenderHeader,
): string {
  const template = loadTemplate();

  const headerParts = [
    header.email,
    header.phone,
    header.location,
    header.linkedin_url,
    header.github_url,
    header.portfolio_url,
  ]
    .filter((s): s is string => Boolean(s))
    .map(escapeLatex);

  const headerLine = headerParts.join(' \\textbar{} ');

  const experienceBlocks = resume.experience.map(buildExperienceBlock).join('\n');
  const educationBlocks = resume.education.map(buildEducationBlock).join('\n');
  const skillsBlock = buildSkillsBlock(resume);
  const projectsSection =
    resume.projects.length > 0
      ? `\\section*{Projects}\n${resume.projects.map(buildProjectBlock).join('\n')}`
      : '';
  const certsSection =
    resume.certifications.length > 0
      ? `\\section*{Certifications}\n\\begin{itemize}\n${resume.certifications
          .map((c) => `  \\item ${escapeLatex(c)}`)
          .join('\n')}\n\\end{itemize}`
      : '';

  return template
    .replaceAll('{{FULL_NAME}}', escapeLatex(header.full_name))
    .replaceAll('{{HEADER_LINE}}', headerLine)
    .replaceAll('{{SUMMARY}}', escapeLatex(resume.summary))
    .replaceAll('{{EXPERIENCE_BLOCKS}}', experienceBlocks)
    .replaceAll('{{PROJECTS_SECTION}}', projectsSection)
    .replaceAll('{{SKILLS_BLOCK}}', skillsBlock)
    .replaceAll('{{EDUCATION_BLOCKS}}', educationBlocks)
    .replaceAll('{{CERTIFICATIONS_SECTION}}', certsSection);
}

function buildExperienceBlock(exp: TailoredResume['experience'][number]): string {
  const dates = `${escapeLatex(exp.start_date)} -- ${
    exp.end_date === 'Present' ? 'Present' : escapeLatex(exp.end_date)
  }`;
  const bullets = exp.bullets
    .map((b) => `  \\item ${escapeLatex(b)}`)
    .join('\n');
  return [
    `\\textbf{${escapeLatex(exp.title)}} \\hfill ${dates} \\\\`,
    `${escapeLatex(exp.company)}${
      exp.location ? `, ${escapeLatex(exp.location)}` : ''
    }`,
    `\\begin{itemize}`,
    bullets,
    `\\end{itemize}`,
  ].join('\n');
}

function buildProjectBlock(p: TailoredResume['projects'][number]): string {
  const techLine = p.tech.length > 0 ? ` \\textit{(${p.tech.map(escapeLatex).join(', ')})}` : '';
  const urlLine = p.url ? ` -- \\href{${p.url}}{${escapeLatex(p.url)}}` : '';
  const bullets = p.bullets
    .map((b) => `  \\item ${escapeLatex(b)}`)
    .join('\n');
  return [
    `\\textbf{${escapeLatex(p.name)}}${techLine}${urlLine} \\\\`,
    p.role ? `${escapeLatex(p.role)}` : '',
    `\\begin{itemize}`,
    bullets,
    `\\end{itemize}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildEducationBlock(e: TailoredResume['education'][number]): string {
  return `\\textbf{${escapeLatex(e.institution)}} \\hfill ${escapeLatex(
    e.end_date,
  )} \\\\\n${escapeLatex(e.degree)}${e.field ? `, ${escapeLatex(e.field)}` : ''} \\\\[4pt]`;
}

function buildSkillsBlock(resume: TailoredResume): string {
  const lines: string[] = [];
  if (resume.skills.languages.length > 0) {
    lines.push(`\\textbf{Languages:} ${resume.skills.languages.map(escapeLatex).join(', ')}`);
  }
  if (resume.skills.frameworks.length > 0) {
    lines.push(`\\textbf{Frameworks:} ${resume.skills.frameworks.map(escapeLatex).join(', ')}`);
  }
  if (resume.skills.tools.length > 0) {
    lines.push(`\\textbf{Tools:} ${resume.skills.tools.map(escapeLatex).join(', ')}`);
  }
  if (resume.skills.domains.length > 0) {
    lines.push(`\\textbf{Domains:} ${resume.skills.domains.map(escapeLatex).join(', ')}`);
  }
  return lines.join(' \\\\\n');
}
