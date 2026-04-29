// Deterministic section splitter — markdown in, labelled section chunks out.
// Runs BEFORE the LLM enrichment pass so the LLM only sees small, classified
// chunks (and so we can skip the LLM entirely when heuristics are confident).
//
// Header detection: any line that is
//   - a markdown heading (#, ##, ###),
//   - or ALL CAPS + short (<= 5 words) + followed by a blank line,
// and that matches one of the known labels below.

export type SectionLabel =
  | 'contact'
  | 'summary'
  | 'experience'
  | 'projects'
  | 'education'
  | 'skills'
  | 'certifications'
  | 'awards'
  | 'publications'
  | 'unknown';

export interface Section {
  label: SectionLabel;
  raw_heading: string;
  body: string;
}

// Alias → canonical label.  Case-insensitive match.
const LABEL_ALIASES: Record<string, SectionLabel> = {
  contact: 'contact',
  'contact info': 'contact',
  'contact information': 'contact',

  summary: 'summary',
  profile: 'summary',
  about: 'summary',
  objective: 'summary',
  'professional summary': 'summary',

  experience: 'experience',
  'work experience': 'experience',
  'professional experience': 'experience',
  employment: 'experience',
  'employment history': 'experience',
  career: 'experience',

  projects: 'projects',
  'side projects': 'projects',
  'personal projects': 'projects',

  education: 'education',
  academics: 'education',

  skills: 'skills',
  'technical skills': 'skills',
  'core competencies': 'skills',
  technologies: 'skills',
  stack: 'skills',

  certifications: 'certifications',
  certs: 'certifications',

  awards: 'awards',
  'awards and honors': 'awards',
  honors: 'awards',

  publications: 'publications',
  papers: 'publications',
};

const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.+?)\s*$/;

function normaliseHeading(line: string): string {
  return line.replace(/[:#*_`~]/g, ' ').trim().toLowerCase().replace(/\s+/g, ' ');
}

function classifyHeading(raw: string): SectionLabel {
  const key = normaliseHeading(raw);
  return LABEL_ALIASES[key] ?? 'unknown';
}

function isAllCapsHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 48) return false;
  const letters = trimmed.replace(/[^A-Za-z]/g, '');
  if (letters.length < 3) return false;
  if (letters !== letters.toUpperCase()) return false;
  const words = trimmed.split(/\s+/);
  return words.length <= 5;
}

export function splitSections(markdown: string): Section[] {
  const lines = markdown.split(/\r?\n/);
  const sections: Section[] = [];

  let currentLabel: SectionLabel = 'contact';
  let currentHeading = 'CONTACT';
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join('\n').trim();
    if (body.length === 0 && sections.length > 0) return;
    sections.push({ label: currentLabel, raw_heading: currentHeading, body });
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const mdHeading = line.match(HEADING_RE);

    let headingText: string | null = null;
    if (mdHeading) {
      headingText = mdHeading[2] ?? null;
    } else if (isAllCapsHeading(line)) {
      const next = lines[i + 1] ?? '';
      if (next.trim().length === 0 || i === 0) {
        headingText = line.trim();
      }
    }

    if (headingText) {
      const label = classifyHeading(headingText);
      if (label !== 'unknown' || headingText.length <= 40) {
        flush();
        currentLabel = label;
        currentHeading = headingText;
        continue;
      }
    }

    buffer.push(line);
  }

  flush();
  return sections;
}
