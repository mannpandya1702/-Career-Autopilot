// company.research — v1. Source: docs/llm-routing.md §`company.research` — v1.
// PUBLIC (no profile fields); routes to Gemini Flash.

import { z } from 'zod';
import type { ContentBlock, PromptDefinition } from '../../types';

export const ResearchPackSchema = z.object({
  recent_highlights: z.array(
    z.object({
      date: z.string(),
      headline: z.string(),
      one_sentence_summary: z.string(),
    }),
  ),
  notable_themes: z.array(z.string()).max(3),
  potential_talking_points: z.array(z.string()).max(3),
});
export type ResearchPack = z.infer<typeof ResearchPackSchema>;

export interface CompanyResearchInput {
  company_name: string;
  // Concatenated articles / blog posts / press releases.
  source_text: string;
}

const SYSTEM_PROMPT = `Given a set of recent articles, blog posts, or press releases about a company, produce a brief research pack focused on what matters for a candidate writing a cover letter.

Output JSON:
{
  "recent_highlights": [ { "date": "YYYY-MM-DD", "headline": string, "one_sentence_summary": string } ],
  "notable_themes": string[],
  "potential_talking_points": string[]
}

No prose outside the JSON.`;

export const companyResearchPrompt: PromptDefinition<CompanyResearchInput, ResearchPack> = {
  version: 'v1',
  task: 'company.research',
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  privacy: 'PUBLIC',
  system: SYSTEM_PROMPT,
  buildMessages(input): ContentBlock[] {
    return [
      {
        role: 'user',
        text: `[COMPANY] ${input.company_name}\n\n[SOURCE_TEXT]\n${input.source_text}`,
      },
    ];
  },
  outputSchema: ResearchPackSchema,
  maxOutputTokens: 1000,
  timeoutMs: 30_000,
};
