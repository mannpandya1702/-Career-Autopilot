// jd.parse — v1. Source: docs/llm-routing.md §`jd.parse` — v1.
// Public (JD text is not private); routes to Gemini Flash-Lite.

import { z } from 'zod';
import type { ContentBlock, PromptDefinition } from '../../types';

export const ParsedJdSchema = z.object({
  must_have_skills: z.array(z.string()),
  nice_to_have_skills: z.array(z.string()),
  required_years_experience: z.number().nullable(),
  required_education: z
    .object({
      level: z.enum(['bachelors', 'masters', 'phd', 'none']),
      field: z.string().nullable(),
    })
    .nullable(),
  role_seniority: z.enum([
    'intern',
    'entry',
    'mid',
    'senior',
    'lead',
    'principal',
    'unspecified',
  ]),
  work_authorization_required: z.array(z.string()).nullable(),
  tech_stack: z.array(z.string()),
  industry_domain: z.string().nullable(),
  red_flags: z.array(z.string()),
  keywords: z.array(z.string()),
  acronyms: z.array(z.object({ full: z.string(), abbrev: z.string() })),
});
export type ParsedJd = z.infer<typeof ParsedJdSchema>;

export interface JdParseInput {
  title: string;
  company: string;
  jd_text: string;
  location?: string;
  remote_policy?: string;
}

const SYSTEM_PROMPT = `You are a hiring requirements extractor. Given a job description, extract the structured requirements as JSON. Be precise and literal — do not infer requirements that aren't stated.

Output strictly matches this schema:
{
  "must_have_skills": string[],
  "nice_to_have_skills": string[],
  "required_years_experience": number | null,
  "required_education": { "level": "bachelors|masters|phd|none", "field": string | null } | null,
  "role_seniority": "intern|entry|mid|senior|lead|principal|unspecified",
  "work_authorization_required": string[] | null,
  "tech_stack": string[],
  "industry_domain": string | null,
  "red_flags": string[],
  "keywords": string[],
  "acronyms": { "full": string, "abbrev": string }[]
}

Rules:
- Do not invent requirements not present in the text.
- If a skill is listed as both required and preferred, classify as "must_have".
- Acronyms: extract every acronym that appears alongside its spelled-out form.
- No prose. JSON only.`;

export const jdParsePrompt: PromptDefinition<JdParseInput, ParsedJd> = {
  version: 'v1',
  task: 'jd.parse',
  provider: 'gemini',
  model: 'gemini-2.5-flash-lite',
  privacy: 'PUBLIC',
  system: SYSTEM_PROMPT,
  buildMessages(input): ContentBlock[] {
    const header = [
      `Title: ${input.title}`,
      `Company: ${input.company}`,
      input.location ? `Location: ${input.location}` : null,
      input.remote_policy ? `Remote policy: ${input.remote_policy}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    return [
      {
        role: 'user',
        text: `${header}\n\nJob description:\n"""\n${input.jd_text}\n"""`,
      },
    ];
  },
  outputSchema: ParsedJdSchema,
  maxOutputTokens: 2000,
  timeoutMs: 30_000,
};
