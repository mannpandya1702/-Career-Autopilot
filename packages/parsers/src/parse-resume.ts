// Public parser entry points. Each returns a best-effort structured object;
// the onboarding UI presents the result for user confirmation rather than
// silently committing (see docs/build-phases.md P2.4).
//
// Pipeline per CLAUDE.md §2.1 "verify before you code":
//   1. pdf2md -> markdown (pure JS, deterministic).
//   2. Deterministic section splitter (split-sections.ts).
//   3. Heuristic extractors (heuristics.ts) — emits a useful result without LLM.
//   4. Optional LLM enrichment (enrich.ts) merged over the heuristic result.

import pdf2md from '@opendocsg/pdf2md';

import {
  extractContact,
  extractEducation,
  extractExperiences,
  extractSkills,
  extractSummary,
  heuristicWarnings,
} from './heuristics';
import { EnrichmentSchema, mergeEnrichment, noopEnricher } from './enrich';
import type { LlmEnricher } from './enrich';
import { splitSections } from './split-sections';
import type { ParsedResume } from './types';

export interface ParseOptions {
  enricher?: LlmEnricher;
}

async function runPipeline(
  buffer: Buffer,
  source: ParsedResume['source'],
  options: ParseOptions = {},
): Promise<ParsedResume> {
  const enricher = options.enricher ?? noopEnricher;

  // pdf2md accepts an ArrayBuffer/TypedArray; Buffer is a subclass of Uint8Array.
  const markdown = await pdf2md(buffer);
  const sections = splitSections(markdown);

  const contact = extractContact(sections);
  const summary = extractSummary(sections);
  const experiences = extractExperiences(sections);
  const education = extractEducation(sections);
  const skills = extractSkills(sections);

  const heuristic: ParsedResume = {
    source,
    contact,
    ...(summary !== undefined ? { summary } : {}),
    experiences,
    projects: [], // heuristic pass skips; LLM may populate
    education,
    skills,
    raw_markdown: markdown,
    warnings: heuristicWarnings({ contact, experiences, skills }),
  };

  const unclassified = sections
    .filter((s) => s.label === 'unknown')
    .map((s) => s.raw_heading);
  if (unclassified.length > 0) heuristic.unclassified_sections = unclassified;

  // LLM enrichment — validated before merging. On validation failure we keep
  // the heuristic result and surface a warning rather than fail the import.
  const raw = await enricher.enrich({
    heuristic,
    raw_sections: sections.map((s) => ({ label: s.label, body: s.body })),
  });
  const parsed = EnrichmentSchema.safeParse(raw);
  if (!parsed.success) {
    heuristic.warnings.push({
      stage: 'enrich',
      message: `LLM enrichment returned invalid shape: ${parsed.error.issues
        .map((i) => i.path.join('.'))
        .join(', ')}`,
    });
    return heuristic;
  }
  return mergeEnrichment(heuristic, parsed.data);
}

export function parseResumePdf(buffer: Buffer, options?: ParseOptions): Promise<ParsedResume> {
  return runPipeline(buffer, 'resume_pdf', options);
}

export function parseLinkedInPdf(buffer: Buffer, options?: ParseOptions): Promise<ParsedResume> {
  return runPipeline(buffer, 'linkedin_pdf', options);
}
