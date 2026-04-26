// cover.letter — v1. Source: docs/llm-routing.md §`cover.letter` — v1.
// SENSITIVE: routes to Anthropic Claude Haiku 4.5 (CLAUDE.md §2.5).

import { z } from 'zod';
import type { ContentBlock, PromptDefinition } from '../../types';

export const CoverLetterSchema = z.object({
  greeting: z.string().min(1).max(200),
  body: z.string().min(50),
  signoff: z.string().min(1).max(200),
  word_count: z.number().int().nonnegative(),
});
export type CoverLetterOutput = z.infer<typeof CoverLetterSchema>;

export interface CoverLetterInput {
  candidate_name: string; // for the signoff
  // Tailored resume JSON serialised — cacheable per job.
  tailored_resume_json: string;
  // Parsed JD JSON — variable.
  parsed_jd_json: string;
  raw_jd_text: string;
  company_name: string;
  // Optional research pack from companies.research_pack (P7.4).
  research_pack_json?: string;
  tone_hint?: string;
}

const SYSTEM_PROMPT = `You are a cover-letter writer. Given a tailored resume, the target JD, the company name, and optional recent-company-research, write a concise cover letter of 200-280 words.

HARD RULES:
1. Every claim must be supported by the tailored resume. Do not invent projects, metrics, or experience.
2. Tone: professional but not stiff; conversational but not casual.
3. Structure: opening hook (1 sentence), why-this-role (2-3 sentences, cite one specific JD element), why-you (2-3 sentences, cite one specific resume item), why-this-company (1-2 sentences, cite recent-research if provided), close (1 sentence).
4. Do NOT start with "I am writing to apply for..." or similar boilerplate.
5. Do NOT use the phrase "I am a good fit" or "I would be a great asset" — show, don't assert.
6. If research is provided, weave it in naturally; if not, keep the why-this-company generic but specific to the role, not platitudes about the company's mission.

Output JSON:
{
  "greeting": string,
  "body": string,
  "signoff": string,
  "word_count": number
}

No prose outside the JSON.`;

export const coverLetterPrompt: PromptDefinition<CoverLetterInput, CoverLetterOutput> = {
  version: 'v1',
  task: 'cover.letter',
  provider: 'anthropic',
  model: 'claude-haiku-4-5-20251001',
  privacy: 'SENSITIVE',
  system: SYSTEM_PROMPT,
  buildMessages(input): ContentBlock[] {
    const blocks: ContentBlock[] = [
      // Stable per profile/run — long TTL.
      {
        role: 'user',
        text: `[CANDIDATE_NAME]\n${input.candidate_name}`,
        cache: 'long',
      },
      // Stable per job — short TTL.
      {
        role: 'user',
        text: `[TAILORED_RESUME]\n${input.tailored_resume_json}`,
        cache: 'short',
      },
      {
        role: 'user',
        text: `[PARSED_JD]\n${input.parsed_jd_json}\n\n[RAW_JD]\n${input.raw_jd_text}`,
      },
      {
        role: 'user',
        text: `[COMPANY] ${input.company_name}${
          input.research_pack_json
            ? `\n[RESEARCH_PACK]\n${input.research_pack_json}`
            : ''
        }${input.tone_hint ? `\n[TONE_HINT] ${input.tone_hint}` : ''}`,
      },
    ];
    return blocks;
  },
  outputSchema: CoverLetterSchema,
  maxOutputTokens: 1500,
  timeoutMs: 60_000,
};
