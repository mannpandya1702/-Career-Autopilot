// email.classify — v1. Source: docs/llm-routing.md §`email.classify` — v1.
// PUBLIC: Email body has no profile fields, routes to Gemini Flash-Lite.

import { z } from 'zod';
import type { ContentBlock, PromptDefinition } from '../../types';

export const EmailClassificationSchema = z.object({
  outcome_type: z.enum([
    'submitted',
    'acknowledged',
    'callback',
    'rejection',
    'interview_invite',
    'interview_completed',
    'offer',
    'ghosted',
    'other',
  ]),
  job_match_signal: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(500),
});
export type EmailClassification = z.infer<typeof EmailClassificationSchema>;

export interface EmailClassifyInput {
  subject: string;
  from: string;
  body: string;
}

const SYSTEM_PROMPT = `Classify an inbound email as one of: callback | rejection | interview_invite | recruiter_outreach | status_update | spam | other.

Output JSON:
{
  "outcome_type": "submitted" | "acknowledged" | "callback" | "rejection" | "interview_invite" | "interview_completed" | "offer" | "ghosted" | "other",
  "job_match_signal": string | null,
  "confidence": number,
  "reasoning": string
}

No prose outside the JSON.`;

export const emailClassifyPrompt: PromptDefinition<EmailClassifyInput, EmailClassification> = {
  version: 'v1',
  task: 'email.classify',
  provider: 'gemini',
  model: 'gemini-2.5-flash-lite',
  privacy: 'PUBLIC',
  system: SYSTEM_PROMPT,
  buildMessages(input): ContentBlock[] {
    return [
      {
        role: 'user',
        text: `[SUBJECT]\n${input.subject}\n\n[FROM]\n${input.from}\n\n[BODY]\n${input.body.slice(0, 4000)}`,
      },
    ];
  },
  outputSchema: EmailClassificationSchema,
  maxOutputTokens: 500,
  timeoutMs: 15_000,
};
