// qa.answer — v1. Source: docs/llm-routing.md §`qa.answer` — v1.
// SENSITIVE: routes to Anthropic Claude Haiku 4.5.

import { z } from 'zod';
import type { ContentBlock, PromptDefinition } from '../../types';

export const QaAnswerSchema = z.object({
  answer: z.string(),
  source: z.string(), // 'qa_bank' | 'story_<id>' | 'resume' | 'generated'
  confidence: z.number().min(0).max(1),
  needs_human: z.boolean(),
});
export type QaAnswerOutput = z.infer<typeof QaAnswerSchema>;

export interface QaAnswerInput {
  // Stable per user — long TTL cacheable blocks.
  qa_bank_json: string;
  stories_json: string;
  // Stable per (user, job) — short TTL.
  tailored_resume_json: string;
  // Variable — the question.
  question_text: string;
  question_type: 'short_text' | 'long_text' | 'select' | 'multiselect' | 'number' | 'boolean';
  word_limit?: number;
}

const SYSTEM_PROMPT = `You are answering a single job-application question on behalf of a candidate. You have access to their tailored resume, their STAR stories, and their master Q&A bank.

HARD RULES:
1. The answer MUST NOT contradict the tailored resume. If the resume says 3 years of X, the answer cannot say 4.
2. Prefer short, direct answers. Only go long if the question asks for narrative (e.g., "Tell us about a time...").
3. Respect word limits strictly. If word_limit is given, stay at or below it.
4. If the question is a standard one (work auth, notice period, salary expectation), use the exact answer from the Q&A bank.
5. If the question is behavioral, use the most-relevant STAR story; shorten to fit.
6. If you genuinely cannot answer from the provided context, respond with an empty answer and set "needs_human": true.

Output JSON:
{
  "answer": string,
  "source": "qa_bank" | "story_{id}" | "resume" | "generated",
  "confidence": number,
  "needs_human": boolean
}

No prose outside the JSON.`;

export const qaAnswerPrompt: PromptDefinition<QaAnswerInput, QaAnswerOutput> = {
  version: 'v1',
  task: 'qa.answer',
  provider: 'anthropic',
  model: 'claude-haiku-4-5-20251001',
  privacy: 'SENSITIVE',
  system: SYSTEM_PROMPT,
  buildMessages(input): ContentBlock[] {
    return [
      { role: 'user', text: `[QA_BANK]\n${input.qa_bank_json}`, cache: 'long' },
      { role: 'user', text: `[STAR_STORIES]\n${input.stories_json}`, cache: 'long' },
      {
        role: 'user',
        text: `[TAILORED_RESUME]\n${input.tailored_resume_json}`,
        cache: 'short',
      },
      {
        role: 'user',
        text: `[QUESTION]\nText: ${input.question_text}\nType: ${input.question_type}${
          input.word_limit ? `\nWord limit: ${input.word_limit}` : ''
        }`,
      },
    ];
  },
  outputSchema: QaAnswerSchema,
  maxOutputTokens: 1000,
  timeoutMs: 30_000,
};
