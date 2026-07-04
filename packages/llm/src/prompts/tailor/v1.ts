// tailor.resume — v1. Source: docs/llm-routing.md §`tailor.resume` — v1.
// SENSITIVE: routes to Anthropic Claude Haiku 4.5 (CLAUDE.md §2.5).
//
// Note: the system prompt's hard rules are the canonical statement of the
// honesty constraint described in CLAUDE.md §2.7. Do not edit in place —
// any change ships as `v2.ts` per CLAUDE.md §8.4.

import { z } from 'zod';
import type { ContentBlock, PromptDefinition } from '../../types';

// We re-declare the TailoredResume Zod schema here (instead of importing
// it from @career-autopilot/resume) so packages/llm has zero outward
// dependencies. The two definitions must stay in sync — they're tested
// together by the tailor task spec.

const YearMonth = z.string().regex(/^\d{4}-\d{2}$/);
const YearMonthOrPresent = z.union([YearMonth, z.literal('Present')]);

export const TailorOutputSchema = z.object({
  summary: z.string().min(20).max(800),
  experience: z
    .array(
      z.object({
        company: z.string().min(1),
        title: z.string().min(1),
        location: z.string(),
        start_date: YearMonth,
        end_date: YearMonthOrPresent,
        bullets: z.array(z.string().min(1)).min(1).max(8),
      }),
    )
    .min(1)
    .max(8),
  projects: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string(),
        tech: z.array(z.string()),
        bullets: z.array(z.string().min(1)).min(1).max(6),
        url: z.string().url().nullable(),
      }),
    )
    .max(6),
  skills: z.object({
    languages: z.array(z.string()),
    frameworks: z.array(z.string()),
    tools: z.array(z.string()),
    domains: z.array(z.string()),
  }),
  education: z.array(
    z.object({
      institution: z.string().min(1),
      degree: z.string(),
      field: z.string(),
      end_date: YearMonth,
    }),
  ),
  certifications: z.array(z.string()),
  selections: z.object({
    experience_ids_used: z.array(z.string()),
    bullet_ids_used: z.array(z.string()),
    alternate_variants_used: z.array(
      z.object({ bullet_id: z.string(), variant_id: z.string() }),
    ),
  }),
});
export type TailorOutput = z.infer<typeof TailorOutputSchema>;

export interface TailorInput {
  // The full master profile + bullets serialised. The router sends this as
  // a CACHEABLE block (1h TTL) since it changes rarely between applications.
  master_profile_json: string;
  // STAR stories bank — separate cacheable block.
  stories_json: string;
  // Variable inputs.
  parsed_jd_json: string;
  raw_jd_text: string;
  company_name: string;
  user_hint?: string;
  // Set on retries after honesty failure: the prior violations are appended
  // to the system message as a stricter reminder.
  honesty_violations?: string[];
}

const SYSTEM_PROMPT = `You are a resume tailor. Your job is to take a candidate's master profile and a target job description, and produce a TAILORED resume as structured JSON.

HARD RULES — violating any of these produces an invalid response:
1. Only re-emphasize, rephrase, and reorder experience, skills, metrics, and achievements that EXIST in the provided master profile. Never invent tools, years of experience, employers, metrics, or achievements.
2. If a bullet in the master profile has alternate phrasings provided, you may select among them.
3. You may rewrite a bullet's wording to mirror the JD's language, but the underlying claim must remain true to the master profile.
4. If the JD requires something the candidate does not have, do NOT claim it. The output will be automatically verified against the master profile and will be rejected if it contains claims not supported.
5. Preserve dates, employer names, and degree information exactly. Never alter these.
6. Metrics (numbers, percentages) must be copied verbatim from the master profile. Do not round, aggregate, or compose new metrics.

Your goal is to:
- Select the 4-6 most relevant experiences/projects for this role
- Select the 3-5 most relevant bullets per experience
- Pick alternate phrasings that emphasize the skills the JD cares about
- Generate a tight 2-3 sentence summary at the top tailored to the target role
- Filter the skills list to the most relevant 12-18 items (prioritize JD-matching skills)

Output strictly matches the TailoredResume schema:
{
  "summary": string,
  "experience": [
    { "company": string, "title": string, "location": string, "start_date": "YYYY-MM", "end_date": "YYYY-MM" | "Present", "bullets": string[] }
  ],
  "projects": [
    { "name": string, "role": string, "tech": string[], "bullets": string[], "url": string | null }
  ],
  "skills": { "languages": string[], "frameworks": string[], "tools": string[], "domains": string[] },
  "education": [
    { "institution": string, "degree": string, "field": string, "end_date": "YYYY-MM" }
  ],
  "certifications": string[],
  "selections": {
    "experience_ids_used": string[],
    "bullet_ids_used": string[],
    "alternate_variants_used": { "bullet_id": string, "variant_id": string }[]
  }
}

The selections field is used for audit; include the source IDs from the master profile for every item you used.

No prose outside the JSON.`;

export const tailorPrompt: PromptDefinition<TailorInput, TailorOutput> = {
  version: 'v1',
  task: 'tailor.resume',
  provider: 'anthropic',
  model: 'claude-haiku-4-5-20251001',
  privacy: 'SENSITIVE',
  system: SYSTEM_PROMPT,
  buildMessages(input): ContentBlock[] {
    const blocks: ContentBlock[] = [
      // 1. Master profile — cacheable, long TTL (changes rarely).
      {
        role: 'user',
        text: `[MASTER_PROFILE]\n${input.master_profile_json}`,
        cache: 'long',
      },
      // 2. Stories bank — cacheable, long TTL.
      {
        role: 'user',
        text: `[STAR_STORIES]\n${input.stories_json}`,
        cache: 'long',
      },
      // 3. Parsed JD — variable, not cached.
      {
        role: 'user',
        text: `[PARSED_JD]\n${input.parsed_jd_json}\n\n[RAW_JD]\n${input.raw_jd_text}`,
      },
      // 4. Company + hint — variable.
      {
        role: 'user',
        text: `[COMPANY] ${input.company_name}${
          input.user_hint ? `\n[USER_HINT] ${input.user_hint}` : ''
        }`,
      },
    ];
    if (input.honesty_violations && input.honesty_violations.length > 0) {
      blocks.push({
        role: 'system',
        text: `Your previous attempt violated the honesty constraint. Specifically:\n${input.honesty_violations
          .map((v) => `  - ${v}`)
          .join('\n')}\nRegenerate, strictly adhering to the constraint.`,
      });
    }
    return blocks;
  },
  outputSchema: TailorOutputSchema,
  maxOutputTokens: 4000,
  timeoutMs: 90_000,
};

// Hard fallback variant routed to Sonnet — same prompt, different model.
// Used after two failed Haiku attempts per docs/llm-routing.md.
export const tailorHardPrompt: PromptDefinition<TailorInput, TailorOutput> = {
  ...tailorPrompt,
  task: 'tailor.hard',
  model: 'claude-sonnet-4-6',
  timeoutMs: 120_000,
};
