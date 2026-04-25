// Resume parser wrappers (pdf2md, pyresparser HTTP client, openresume port).
// Populated in Phase 2 (onboarding) and Phase 6 (verifier ensemble).

export const PARSERS_PACKAGE_VERSION = '0.1.0';

export type {
  ParsedContact,
  ParsedEducation,
  ParsedExperience,
  ParsedExperienceBullet,
  ParsedProject,
  ParsedResume,
  ParsedSkill,
  ParserWarning,
} from './types';

export type { Section, SectionLabel } from './split-sections';
export { splitSections } from './split-sections';

export {
  extractContact,
  extractEducation,
  extractExperiences,
  extractSkills,
  extractSummary,
  heuristicWarnings,
} from './heuristics';

export type { EnrichInput, Enrichment, LlmEnricher } from './enrich';
export { EnrichmentSchema, mergeEnrichment, noopEnricher } from './enrich';

export { parseLinkedInPdf, parseResumePdf } from './parse-resume';
export type { ParseOptions } from './parse-resume';

// Phase 6 — verifier parsers.
export * from './verify';
