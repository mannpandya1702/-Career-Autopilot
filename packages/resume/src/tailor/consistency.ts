// Cross-references Q&A answers + cover letter against the tailored resume.
// Flags contradictions like "resume says 2 years, answer says 3" so the
// submitter knows to block before sending an inconsistent application
// (CLAUDE.md §2.7 + docs/build-phases.md P7.6).
//
// We do this with deterministic regex extraction over years/percent/dollar
// metrics; richer NLI is a Phase 11 problem.

import type { TailoredResume } from '../schemas/resume';

export interface QaAnswerForCheck {
  question_text: string;
  answer_text: string;
}

export interface CoverLetterForCheck {
  greeting?: string | null;
  body: string;
  signoff?: string | null;
}

export interface ConsistencyResult {
  ok: boolean;
  violations: string[];
}

const YEARS_RE = /\b(\d{1,2}(?:\.\d)?)\s*(?:\+\s*)?years?\b/gi;
const PERCENT_RE = /\b(\d{1,3}(?:\.\d+)?)\s?%/g;
const DOLLAR_RE = /\$\s?(\d[\d,]*\.?\d*\s?[kKmMbB]?)/g;

export function checkConsistency(
  tailored: TailoredResume,
  qa: QaAnswerForCheck[] = [],
  coverLetter: CoverLetterForCheck | null = null,
): ConsistencyResult {
  const violations: string[] = [];

  const resumeText = serialiseResume(tailored);
  const resumeYears = collectYears(resumeText);
  const resumePercents = collectAll(PERCENT_RE, resumeText);
  const resumeDollars = collectAll(DOLLAR_RE, resumeText, normaliseMoney);

  // Q&A answers
  for (const a of qa) {
    const cmp = compareMetrics(
      a.answer_text,
      resumeYears,
      resumePercents,
      resumeDollars,
    );
    for (const issue of cmp) {
      violations.push(
        `Q&A answer to "${trim(a.question_text)}" ${issue}`,
      );
    }
  }

  // Cover letter body
  if (coverLetter) {
    const text = [coverLetter.greeting, coverLetter.body, coverLetter.signoff]
      .filter(Boolean)
      .join('\n');
    const cmp = compareMetrics(text, resumeYears, resumePercents, resumeDollars);
    for (const issue of cmp) {
      violations.push(`Cover letter ${issue}`);
    }
  }

  return { ok: violations.length === 0, violations };
}

function serialiseResume(t: TailoredResume): string {
  const parts: string[] = [t.summary];
  for (const e of t.experience) {
    parts.push(`${e.title} at ${e.company} (${e.start_date} - ${e.end_date})`);
    parts.push(...e.bullets);
  }
  for (const p of t.projects) {
    parts.push(p.name);
    parts.push(...p.bullets);
  }
  return parts.join('\n');
}

function compareMetrics(
  text: string,
  resumeYears: Set<string>,
  resumePercents: Set<string>,
  resumeDollars: Set<string>,
): string[] {
  const issues: string[] = [];
  const candidateYears = collectYears(text);
  for (const y of candidateYears) {
    if (!resumeYears.has(y)) {
      issues.push(`mentions ${y} years not present in tailored resume`);
    }
  }
  const candidatePercents = collectAll(PERCENT_RE, text);
  for (const p of candidatePercents) {
    if (!resumePercents.has(p)) {
      issues.push(`mentions ${p}% not present in tailored resume`);
    }
  }
  const candidateDollars = collectAll(DOLLAR_RE, text, normaliseMoney);
  for (const d of candidateDollars) {
    if (!resumeDollars.has(d)) {
      issues.push(`mentions $${d} not present in tailored resume`);
    }
  }
  return issues;
}

function collectYears(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(YEARS_RE)) {
    if (m[1]) out.add(m[1]);
  }
  return out;
}

function collectAll(
  re: RegExp,
  text: string,
  normaliser: (raw: string) => string = (x) => x,
): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(re)) {
    if (m[1]) out.add(normaliser(m[1]));
  }
  return out;
}

function normaliseMoney(raw: string): string {
  return raw.replace(/\s+/g, '').toLowerCase();
}

function trim(s: string): string {
  return s.length > 60 ? `${s.slice(0, 57)}...` : s;
}
