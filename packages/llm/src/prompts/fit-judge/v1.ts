// fit.judge — v1. Source: docs/llm-routing.md §`fit.judge` — v1.
// Public (derived summary is privacy-safe per CLAUDE.md §2.5); routes to
// Gemini Flash.

import { z } from 'zod';
import type { ContentBlock, PromptDefinition } from '../../types';
import type { ParsedJd } from '../jd-parse/v1';

export const FitJudgmentSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  dimensions: z.object({
    skills: z.number().int().min(0).max(100),
    experience: z.number().int().min(0).max(100),
    domain: z.number().int().min(0).max(100),
    seniority: z.number().int().min(0).max(100),
    logistics: z.number().int().min(0).max(100),
  }),
  must_have_gaps: z.array(z.string()),
  nice_to_have_matches: z.array(z.string()),
  reasoning: z.string().min(10).max(2000),
});
export type FitJudgment = z.infer<typeof FitJudgmentSchema>;

export interface FitJudgeInput {
  profile_summary: string; // derived summary, not raw fields
  profile_years: number | null;
  parsed_jd: ParsedJd;
  hard_filter_failures: string[]; // the deterministic reasons already known
}

const SYSTEM_PROMPT = `You are a fit-evaluation assistant. Given a candidate's derived summary and a parsed job description, produce a structured fit score.

You never see the candidate's raw personal data — only a derived summary. You never see the employer's identity — only the job requirements.

Output strictly matches this schema:
{
  "overall_score": number,
  "dimensions": {
    "skills": number,
    "experience": number,
    "domain": number,
    "seniority": number,
    "logistics": number
  },
  "must_have_gaps": string[],
  "nice_to_have_matches": string[],
  "reasoning": string
}

Scoring guidance:
- 90+: Strong match, candidate should definitely apply.
- 75-89: Good match with minor gaps.
- 60-74: Partial match; worth reviewing but not auto-apply.
- < 60: Poor match; candidate likely lacks core requirements.

Be honest about gaps. Do not inflate scores to be encouraging.
No prose outside the JSON.`;

export const fitJudgePrompt: PromptDefinition<FitJudgeInput, FitJudgment> = {
  version: 'v1',
  task: 'fit.judge',
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  privacy: 'PUBLIC',
  system: SYSTEM_PROMPT,
  buildMessages(input): ContentBlock[] {
    // Stable-prefix first (cacheable): profile summary block. Then the
    // variable parsed JD block. Matches docs/llm-routing.md caching guidance.
    const blocks: ContentBlock[] = [
      {
        role: 'user',
        text: `[PROFILE_SUMMARY]\nYears of experience: ${
          input.profile_years ?? 'unspecified'
        }\nSummary: ${input.profile_summary}`,
        cache: 'long',
      },
      {
        role: 'user',
        text: `[PARSED_JD]\n${JSON.stringify(input.parsed_jd, null, 2)}`,
      },
    ];
    if (input.hard_filter_failures.length > 0) {
      blocks.push({
        role: 'user',
        text: `[DETERMINISTIC_FILTER_REASONS]\n${input.hard_filter_failures.join('\n')}\n\nFactor these into the "logistics" dimension but do not zero out the overall score on their account.`,
      });
    }
    return blocks;
  },
  outputSchema: FitJudgmentSchema,
  maxOutputTokens: 1500,
  timeoutMs: 30_000,
};
