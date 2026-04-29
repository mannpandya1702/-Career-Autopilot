// Deterministic, no-LLM, no-network parser used as the third parser in the
// verifier ensemble. It re-uses the already-built section splitter and
// heuristic extractors from the onboarding pipeline (pdf2md + regex).
//
// The only thing this parser DOES NOT detect well is multi-column layouts
// (pdf2md flattens columns into reading order) — for that signal we rely
// on word-density heuristics + cross-parser disagreement.

import pdf2md from '@opendocsg/pdf2md';
import {
  extractContact,
  extractEducation,
  extractExperiences,
  extractSkills,
} from '../heuristics';
import { splitSections } from '../split-sections';
import type { ParserClient, ParserExtraction } from './types';

const KNOWN_SECTION_NAMES = new Set([
  'contact',
  'summary',
  'experience',
  'projects',
  'education',
  'skills',
  'certifications',
  'awards',
  'publications',
]);

export const simpleParser: ParserClient = {
  name: 'simple',
  async parse(pdfBuffer: Buffer): Promise<ParserExtraction> {
    const markdown = await pdf2md(pdfBuffer);
    return parseFromMarkdown(markdown);
  },
};

// Exposed so tests can hand in pre-extracted markdown without spinning
// up pdf.js (which is heavy and async).
export function parseFromMarkdown(markdown: string): ParserExtraction {
  const sections = splitSections(markdown);
  const detected = sections
    .map((s) => s.label)
    .filter((l) => KNOWN_SECTION_NAMES.has(l));

  const contact = extractContact(sections);
  const exps = extractExperiences(sections);
  const edu = extractEducation(sections);
  const skills = extractSkills(sections);

  const wordCount = markdown.split(/\s+/).filter(Boolean).length;

  // pdf2md flattens columns; the best signal for multi-column we can detect
  // is many short consecutive lines that look like a sidebar (handful of
  // 1-2 word lines). We skip that here and let cross-parser disagreement
  // surface it instead — the ensemble's parse-agreement score handles it.
  const hasMultipleColumns = false;
  const hasEmbeddedImages = /!\[/.test(markdown);

  return {
    parser: 'simple',
    name: contact.full_name ?? null,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    experience_titles: exps.map((e) => e.title).filter(Boolean),
    companies: exps.map((e) => e.company).filter(Boolean),
    skills: skills.map((s) => s.name),
    education: edu.map((e) => e.institution),
    detected_sections: [...new Set(detected)],
    word_count: wordCount,
    has_multiple_columns: hasMultipleColumns,
    has_embedded_images: hasEmbeddedImages,
    warnings: [],
  };
}
