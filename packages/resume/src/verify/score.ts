// Verifier score, 0–100. Three components:
//   - Parse agreement   (40%)  — fraction of fields where ≥ 2/3 parsers agree.
//   - Keyword coverage  (50%)  — fraction of must-have JD skills present in
//                                the parsed skills list OR in any experience
//                                title / bullet text.
//   - Format compliance (10%)  — single-column, standard headings, word count
//                                in [400, 900], no embedded images.
//
// Anything below the threshold (default 80) triggers a regeneration loop.

import type { ParserExtraction } from '@career-autopilot/parsers';
import type { TailoredResume } from '../schemas/resume';

export interface VerifierScoreInput {
  extractions: ParserExtraction[];
  tailored: TailoredResume;
  must_have_skills: string[];
}

export interface VerifierScore {
  overall: number;
  parse_agreement: number;
  keyword_coverage: number;
  format_compliance: number;
  missing_keywords: string[];
  format_issues: string[];
  passed: boolean;
}

export const VERIFIER_PASS_THRESHOLD = 80;

export function scoreVerification(
  input: VerifierScoreInput,
  passThreshold = VERIFIER_PASS_THRESHOLD,
): VerifierScore {
  const parseAgreement = scoreParseAgreement(input.extractions);
  const { score: keywordCoverage, missing_keywords } = scoreKeywordCoverage(
    input.tailored,
    input.extractions,
    input.must_have_skills,
  );
  const { score: formatCompliance, issues: format_issues } = scoreFormatCompliance(
    input.extractions,
  );

  const overall = Math.round(
    parseAgreement * 0.4 + keywordCoverage * 0.5 + formatCompliance * 0.1,
  );

  return {
    overall,
    parse_agreement: parseAgreement,
    keyword_coverage: keywordCoverage,
    format_compliance: formatCompliance,
    missing_keywords,
    format_issues,
    passed: overall >= passThreshold,
  };
}

// ---- Parse agreement ----
// For each of {name, email, phone, experience_titles, skills, education}, count
// the parser as "matching" the consensus when its non-empty value is shared by
// at least one other parser. Score = fraction of (parser × field) cells that
// match consensus, scaled to 0-100.

const FIELDS = [
  'name',
  'email',
  'phone',
  'experience_titles',
  'skills',
  'education',
] as const;

export function scoreParseAgreement(extractions: ParserExtraction[]): number {
  if (extractions.length < 2) return 100;

  let matched = 0;
  let total = 0;
  for (const field of FIELDS) {
    const values = extractions.map((e) => normaliseField(e, field));
    for (const value of values) {
      if (value === null) continue;
      total += 1;
      const sharedBy = values.filter((v) => v !== null && fieldEquals(field, v, value));
      if (sharedBy.length >= 2) matched += 1;
    }
  }
  if (total === 0) return 0;
  return Math.round((matched / total) * 100);
}

function normaliseField(
  extraction: ParserExtraction,
  field: (typeof FIELDS)[number],
): string | string[] | null {
  switch (field) {
    case 'name':
      return extraction.name?.toLowerCase().trim() ?? null;
    case 'email':
      return extraction.email?.toLowerCase().trim() ?? null;
    case 'phone':
      return extraction.phone?.replace(/\D/g, '') ?? null;
    case 'experience_titles':
      return extraction.experience_titles.length > 0
        ? extraction.experience_titles.map((t) => t.toLowerCase().trim()).sort()
        : null;
    case 'skills':
      return extraction.skills.length > 0
        ? extraction.skills.map((s) => s.toLowerCase().trim()).sort()
        : null;
    case 'education':
      return extraction.education.length > 0
        ? extraction.education.map((s) => s.toLowerCase().trim()).sort()
        : null;
  }
}

function fieldEquals(
  field: (typeof FIELDS)[number],
  a: string | string[],
  b: string | string[],
): boolean {
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (field === 'skills') {
      // Accept ≥ 50% set overlap as agreement for skill lists.
      const setA = new Set(a);
      const setB = new Set(b);
      const intersection = [...setA].filter((x) => setB.has(x)).length;
      const union = new Set([...setA, ...setB]).size;
      return union > 0 && intersection / union >= 0.5;
    }
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
  return false;
}

// ---- Keyword coverage ----

export function scoreKeywordCoverage(
  tailored: TailoredResume,
  extractions: ParserExtraction[],
  mustHaves: string[],
): { score: number; missing_keywords: string[] } {
  if (mustHaves.length === 0) return { score: 100, missing_keywords: [] };

  // Build a "haystack" combining the parsed skill lists across parsers
  // and the tailored bullet text — ATS parsers often miss skills that
  // are inline in bullet text but the keyword still counts.
  const haystackParts: string[] = [];
  for (const e of extractions) {
    haystackParts.push(...e.skills);
    haystackParts.push(...e.experience_titles);
  }
  for (const exp of tailored.experience) {
    haystackParts.push(...exp.bullets);
    haystackParts.push(exp.title);
  }
  haystackParts.push(...tailored.skills.languages);
  haystackParts.push(...tailored.skills.frameworks);
  haystackParts.push(...tailored.skills.tools);
  haystackParts.push(...tailored.skills.domains);
  const haystack = haystackParts.join('\n').toLowerCase();

  const missing: string[] = [];
  let hits = 0;
  for (const skill of mustHaves) {
    const variants = expandKeywordVariants(skill);
    if (variants.some((v) => haystack.includes(v.toLowerCase()))) {
      hits += 1;
    } else {
      missing.push(skill);
    }
  }
  return {
    score: Math.round((hits / mustHaves.length) * 100),
    missing_keywords: missing,
  };
}

// Expand "Search Engine Optimization (SEO)" into ["Search Engine Optimization", "SEO"]
// and "k8s" → ["k8s", "kubernetes"]. The pairs come from the parsed JD when
// available; for now we use a small built-in set + the bracketed-acronym rule.
const ACRONYM_PAIRS: Array<[RegExp, string]> = [
  [/\bk8s\b/i, 'kubernetes'],
  [/\bkubernetes\b/i, 'k8s'],
  [/\bml\b/i, 'machine learning'],
  [/\bmachine learning\b/i, 'ml'],
  [/\bnlp\b/i, 'natural language processing'],
  [/\bnatural language processing\b/i, 'nlp'],
  [/\bci\/cd\b/i, 'continuous integration'],
];

export function expandKeywordVariants(keyword: string): string[] {
  const out = new Set<string>([keyword]);
  // "Foo Bar (FB)" → also try "FB" and "Foo Bar".
  const bracket = keyword.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (bracket) {
    out.add(bracket[1]?.trim() ?? '');
    out.add(bracket[2]?.trim() ?? '');
  }
  for (const [re, expansion] of ACRONYM_PAIRS) {
    if (re.test(keyword)) out.add(expansion);
  }
  return [...out].filter(Boolean);
}

// ---- Format compliance ----

export function scoreFormatCompliance(extractions: ParserExtraction[]): {
  score: number;
  issues: string[];
} {
  if (extractions.length === 0) return { score: 0, issues: ['No parsers succeeded'] };

  const issues: string[] = [];
  let points = 100;

  // Single column — flagged when ANY parser detected it.
  if (extractions.some((e) => e.has_multiple_columns)) {
    issues.push('Multi-column layout detected — ATS parsers struggle with this');
    points -= 35;
  }

  // No embedded images.
  if (extractions.some((e) => e.has_embedded_images)) {
    issues.push('Embedded images detected — ATS parsers ignore them');
    points -= 20;
  }

  // Standard sections — check the union of all detected sections covers
  // at least Experience + Education.
  const detected = new Set(extractions.flatMap((e) => e.detected_sections));
  if (!detected.has('experience')) {
    issues.push('Standard "Experience" heading not detected');
    points -= 25;
  }
  if (!detected.has('education')) {
    issues.push('Standard "Education" heading not detected');
    points -= 15;
  }

  // Word count band [400, 900]. Use the median of parser word counts so
  // we don't punish for one parser's flaky tokenisation.
  const counts = extractions.map((e) => e.word_count).sort((a, b) => a - b);
  const mid = counts[Math.floor(counts.length / 2)] ?? 0;
  if (mid < 400) {
    issues.push(`Word count ${mid} below recommended 400`);
    points -= 10;
  } else if (mid > 900) {
    issues.push(`Word count ${mid} above recommended 900`);
    points -= 5;
  }

  return { score: Math.max(0, Math.min(100, points)), issues };
}
