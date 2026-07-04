// Zero-LLM heuristic extractors. These run first so we can give the user
// a useful preview even before the Gemini enrichment completes — and so the
// LLM call can be SKIPPED entirely when the heuristics already cover what we need.

import type {
  ParsedContact,
  ParsedEducation,
  ParsedExperience,
  ParsedExperienceBullet,
  ParsedSkill,
  ParserWarning,
} from './types';
import type { Section } from './split-sections';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
// Phone: international prefix optional, groups separated by space/dot/hyphen.
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/;
const LINKEDIN_RE = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_\-/]+/i;
const GITHUB_RE = /https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_\-/]+/i;
const URL_RE = /https?:\/\/[^\s)<>"']+/gi;
const METRIC_RE = /(\$\s?\d[\d,]*\.?\d*(?:\s?[kmbKMB])?|\d+(?:\.\d+)?\s?%|\d+(?:\.\d+)?\s?x\b|\b\d+\+?\s?(?:users|customers|req\/s|qps|hours|days))/g;

const MONTH_NAMES = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

// Common skill tokens; category_guess is set when the token matches a family.
// This list is intentionally short — the LLM enrichment fills in the rest.
const SKILL_CATEGORIES: Array<[RegExp, NonNullable<ParsedSkill['category_guess']>]> = [
  [/^(typescript|javascript|python|go|rust|java|kotlin|ruby|php|c\+\+|c#|swift|scala|r|sql)$/i, 'language'],
  [/^(react|next\.?js|vue|svelte|angular|fastapi|django|flask|rails|express|nest\.?js|spring|laravel|tailwindcss|tailwind)$/i, 'framework'],
  [/^(docker|kubernetes|k8s|terraform|ansible|git|github actions|jenkins|circleci|playwright|jest|vitest|webpack|vite)$/i, 'tool'],
  [/^(postgres|postgresql|mysql|mongodb|redis|elasticsearch|sqlite|dynamodb|snowflake|bigquery)$/i, 'database'],
  [/^(aws|gcp|azure|cloudflare|vercel|supabase|oracle cloud)$/i, 'cloud'],
];

export function extractContact(sections: Section[]): ParsedContact {
  const header = sections.find((s) => s.label === 'contact')?.body ?? '';
  // Fallbacks: scan the whole doc for email/phone/linkedin even if no
  // explicit CONTACT section existed.
  const all = sections.map((s) => s.body).join('\n');

  const email = header.match(EMAIL_RE)?.[0] ?? all.match(EMAIL_RE)?.[0];
  const phone = header.match(PHONE_RE)?.[0]?.trim();
  const linkedin = all.match(LINKEDIN_RE)?.[0];
  const github = all.match(GITHUB_RE)?.[0];

  // Portfolio URL = any other URL that isn't linkedin/github.
  const otherUrls = [...all.matchAll(URL_RE)]
    .map((m) => m[0])
    .filter((u) => !LINKEDIN_RE.test(u) && !GITHUB_RE.test(u));

  // Full name: first non-empty line of the header section.
  const headerLines = header.split('\n').map((l) => l.trim()).filter(Boolean);
  const full_name = headerLines[0];

  const contact: ParsedContact = {};
  if (full_name) contact.full_name = full_name;
  if (email) contact.email = email;
  if (phone) contact.phone = phone;
  if (linkedin) contact.linkedin_url = linkedin;
  if (github) contact.github_url = github;
  if (otherUrls[0]) contact.portfolio_url = otherUrls[0];
  return contact;
}

export function extractSummary(sections: Section[]): string | undefined {
  const s = sections.find((sec) => sec.label === 'summary')?.body.trim();
  return s && s.length > 0 ? s : undefined;
}

// Experience heuristics: split by blank lines; the first line of each block is
// "<title> at <company>" or "<company> — <title>"; remaining lines are bullets.
// This is intentionally simple — the LLM fixes messy cases in enrichSections().
export function extractExperiences(sections: Section[]): ParsedExperience[] {
  const body = sections.find((s) => s.label === 'experience')?.body;
  if (!body) return [];
  const blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  return blocks.map((block): ParsedExperience => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const header = lines[0] ?? '';
    let company = header;
    let title = '';
    const atMatch = header.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
    const dashMatch = header.match(/^(.+?)\s*[—–-]\s*(.+)$/);
    if (atMatch && atMatch[1] && atMatch[2]) {
      title = atMatch[1].trim();
      company = atMatch[2].trim();
    } else if (dashMatch && dashMatch[1] && dashMatch[2]) {
      company = dashMatch[1].trim();
      title = dashMatch[2].trim();
    }

    const bullets: ParsedExperienceBullet[] = lines.slice(1).map((text): ParsedExperienceBullet => {
      const clean = text.replace(/^[-*•·]\s*/, '');
      const metrics = [...clean.matchAll(METRIC_RE)].map((m) => m[0]);
      const bullet: ParsedExperienceBullet = { text: clean };
      if (metrics.length > 0) bullet.metric_candidates = metrics;
      return bullet;
    });

    return { company, title, bullets };
  });
}

export function extractEducation(sections: Section[]): ParsedEducation[] {
  const body = sections.find((s) => s.label === 'education')?.body;
  if (!body) return [];
  const blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block): ParsedEducation => {
    const firstLine = block.split('\n')[0]?.trim() ?? block.trim();
    return { institution: firstLine };
  });
}

export function extractSkills(sections: Section[]): ParsedSkill[] {
  const body = sections.find((s) => s.label === 'skills')?.body;
  if (!body) return [];
  const tokens = body
    .split(/[,\n•·;|]+/)
    .map((s) => s.replace(/^[-*]\s*/, '').trim())
    .filter((s) => s.length > 0 && s.length <= 40)
    // Drop phrases that are clearly not skills (too many words).
    .filter((s) => s.split(/\s+/).length <= 4);

  const seen = new Set<string>();
  const out: ParsedSkill[] = [];
  for (const raw of tokens) {
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const matched = SKILL_CATEGORIES.find(([re]) => re.test(raw));
    const skill: ParsedSkill = { name: raw };
    if (matched) skill.category_guess = matched[1];
    out.push(skill);
  }
  return out;
}

// Emit warnings for missing fields that the UI review step should highlight.
export function heuristicWarnings(parsed: {
  contact: ParsedContact;
  experiences: ParsedExperience[];
  skills: ParsedSkill[];
}): ParserWarning[] {
  const w: ParserWarning[] = [];
  if (!parsed.contact.email) {
    w.push({ stage: 'extract', message: 'No email detected — verify contact block.' });
  }
  if (parsed.experiences.length === 0) {
    w.push({ stage: 'split', message: 'No experience section detected.' });
  }
  if (parsed.skills.length === 0) {
    w.push({ stage: 'extract', message: 'No skills extracted; LLM enrichment will retry.' });
  }
  return w;
}

// Exported for use by the ISO-date normaliser in the LLM enrichment pass.
export const MONTHS = MONTH_NAMES;
