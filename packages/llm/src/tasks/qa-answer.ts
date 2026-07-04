import type { LlmRouter } from '../router';
import {
  qaAnswerPrompt,
  type QaAnswerInput,
  type QaAnswerOutput,
} from '../prompts/qa-answer/v1';

export async function answerQuestion(
  router: LlmRouter,
  input: QaAnswerInput,
  context?: { userId?: string },
): Promise<QaAnswerOutput> {
  return router.call(qaAnswerPrompt, input, context);
}

// Stable hash of a normalised question — used to dedup against the
// answer_cache table. Lowercase, collapse whitespace, strip trailing
// punctuation. SHA-256 hex via Web Crypto.
export async function hashQuestion(question: string): Promise<string> {
  const normalised = question
    .toLowerCase()
    .replace(/[?!.]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const data = new TextEncoder().encode(normalised);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type { QaAnswerInput, QaAnswerOutput };
export { QaAnswerSchema } from '../prompts/qa-answer/v1';
