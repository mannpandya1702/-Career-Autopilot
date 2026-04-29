// LLM enrichment pass. Takes the heuristic result and asks Gemini Flash-Lite
// to fill gaps (missing dates, categorising skills, cleaning bullet text).
//
// This file defines the INTERFACE and a passthrough default. The actual Gemini
// implementation lives in `@career-autopilot/llm` (wired in Phase 2 completion
// once GEMINI_API_KEY is live). Tests inject a stub.
//
// Why an interface: CLAUDE.md §8.3 — no LLM SDK imports from feature code. The
// parser takes an enricher; the router in packages/llm constructs it.

import { z } from 'zod';
import type { ParsedResume } from './types';

// Narrow, structured input we send to the LLM. The raw markdown is NOT sent —
// only the already-split heuristic result and the raw section bodies.
export interface EnrichInput {
  heuristic: ParsedResume;
  raw_sections: Array<{ label: string; body: string }>;
}

// Subset the LLM is allowed to return. We merge it over the heuristic result.
export const EnrichmentSchema = z.object({
  contact: z
    .object({
      full_name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      headline: z.string().max(300).optional(),
    })
    .optional(),
  summary: z.string().max(2000).optional(),
  experiences: z
    .array(
      z.object({
        company: z.string(),
        title: z.string(),
        location: z.string().optional(),
        start_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        end_date: z
          .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
          .optional(),
        bullets: z
          .array(z.object({ text: z.string() }))
          .optional(),
        tech_stack: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  skills: z
    .array(
      z.object({
        name: z.string(),
        category_guess: z
          .enum([
            'language',
            'framework',
            'tool',
            'domain',
            'soft',
            'certification',
            'database',
            'cloud',
          ])
          .optional(),
      }),
    )
    .optional(),
});
export type Enrichment = z.infer<typeof EnrichmentSchema>;

export interface LlmEnricher {
  enrich(input: EnrichInput): Promise<Enrichment>;
}

// Default: do nothing. Used in tests and when GEMINI_API_KEY is absent.
// The onboarding UI shows the heuristic result with a "Refine with AI" button
// that calls the real enricher on demand once keys are configured.
export const noopEnricher: LlmEnricher = {
  async enrich() {
    return {};
  },
};

// Spread that drops keys whose value is undefined. Needed because Zod .optional()
// produces `T | undefined` which conflicts with exactOptionalPropertyTypes on
// the target types (which use `field?: T`, i.e. `T` only when present).
function definedOnly<T extends Record<string, unknown>>(
  obj: T | undefined,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  if (!obj) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as { [K in keyof T]?: Exclude<T[K], undefined> };
}

export function mergeEnrichment(base: ParsedResume, e: Enrichment): ParsedResume {
  const next: ParsedResume = {
    ...base,
    contact: { ...base.contact, ...definedOnly(e.contact) },
  };
  if (e.summary) next.summary = e.summary;

  if (e.experiences && e.experiences.length > 0) {
    next.experiences = e.experiences.map((le) => {
      const match = base.experiences.find(
        (b) => b.company === le.company && b.title === le.title,
      );
      const merged = match ?? { company: le.company, title: le.title, bullets: [] };
      return {
        ...merged,
        company: le.company,
        title: le.title,
        ...(le.location ? { location: le.location } : {}),
        ...(le.start_date ? { start_date: le.start_date } : {}),
        ...(le.end_date !== undefined ? { end_date: le.end_date } : {}),
        ...(le.tech_stack ? { tech_stack: le.tech_stack } : {}),
        bullets: le.bullets?.length
          ? le.bullets.map((b) => ({ text: b.text }))
          : merged.bullets,
      };
    });
  }

  if (e.skills && e.skills.length > 0) {
    // Merge unique by lowercase name; LLM wins on category_guess.
    const map = new Map<string, ParsedResume['skills'][number]>();
    for (const s of base.skills) map.set(s.name.toLowerCase(), s);
    for (const s of e.skills) {
      const key = s.name.toLowerCase();
      const existing = map.get(key);
      map.set(key, {
        name: existing?.name ?? s.name,
        ...(s.category_guess
          ? { category_guess: s.category_guess }
          : existing?.category_guess
            ? { category_guess: existing.category_guess }
            : {}),
      });
    }
    next.skills = [...map.values()];
  }

  return next;
}
