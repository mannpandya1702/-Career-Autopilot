// TailoredResume — the structured output of the tailor task. The renderer
// (PDF + DOCX) and the honesty checker both consume this exact shape.
// Source: docs/llm-routing.md §`tailor.resume` — v1.

import { z } from 'zod';

// Date string in YYYY-MM. Tailor outputs end_date='Present' for current roles.
const YearMonth = z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM');
const YearMonthOrPresent = z.union([YearMonth, z.literal('Present')]);

export const TailoredExperienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string(),
  start_date: YearMonth,
  end_date: YearMonthOrPresent,
  bullets: z.array(z.string().min(1)).min(1).max(8),
});
export type TailoredExperience = z.infer<typeof TailoredExperienceSchema>;

export const TailoredProjectSchema = z.object({
  name: z.string().min(1),
  role: z.string(),
  tech: z.array(z.string()),
  bullets: z.array(z.string().min(1)).min(1).max(6),
  url: z.string().url().nullable(),
});
export type TailoredProject = z.infer<typeof TailoredProjectSchema>;

export const TailoredSkillsSchema = z.object({
  languages: z.array(z.string()),
  frameworks: z.array(z.string()),
  tools: z.array(z.string()),
  domains: z.array(z.string()),
});
export type TailoredSkills = z.infer<typeof TailoredSkillsSchema>;

export const TailoredEducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string(),
  field: z.string(),
  end_date: YearMonth,
});
export type TailoredEducation = z.infer<typeof TailoredEducationSchema>;

export const TailoredSelectionsSchema = z.object({
  experience_ids_used: z.array(z.string()),
  bullet_ids_used: z.array(z.string()),
  alternate_variants_used: z.array(
    z.object({ bullet_id: z.string(), variant_id: z.string() }),
  ),
});
export type TailoredSelections = z.infer<typeof TailoredSelectionsSchema>;

export const TailoredResumeSchema = z.object({
  summary: z.string().min(20).max(800),
  experience: z.array(TailoredExperienceSchema).min(1).max(8),
  projects: z.array(TailoredProjectSchema).max(6),
  skills: TailoredSkillsSchema,
  education: z.array(TailoredEducationSchema),
  certifications: z.array(z.string()),
  selections: TailoredSelectionsSchema,
});
export type TailoredResume = z.infer<typeof TailoredResumeSchema>;

// Header info that the renderer needs but lives outside the JSON-validated
// payload — pulled from the master profile, not the LLM. Renderer takes
// both: `TailoredResume` plus this header.
export interface RenderHeader {
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
}
